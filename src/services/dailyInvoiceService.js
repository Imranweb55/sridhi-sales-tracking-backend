// FILE: src/services/dailyInvoiceService.js
// PURPOSE: Core logic for the Daily Invoice feature. Deliberately kept
// separate from invoiceService.js (per-delivery invoice PDF engine, reused
// unchanged here) and from any future WhatsApp automation (STEP 20:
// separate responsibilities — order data / invoice generation / invoice
// storage / daily status / WhatsApp mapping).

const Customer = require("../models/Customer");
const Delivery = require("../models/Delivery");
const DailyInvoice = require("../models/DailyInvoice");
const { generateInvoicePdf } = require("./invoiceService"); // REUSE — same engine as the existing per-delivery Download Invoice button
const { getISTDayRangeUTC, todayIST, isValidDateStr } = require("../utils/businessDate");
const { savePdf, readPdf } = require("../utils/pdfStorage");

function assertValidDate(businessDate) {
  if (!isValidDateStr(businessDate)) {
    const err = new Error("Invalid date. Use YYYY-MM-DD.");
    err.statusCode = 400;
    throw err;
  }
}

// getTodaysOrders() — STEP 2. A customer "took an order" on businessDate
// if they have a COMPLETED delivery whose deliveryDate falls in that IST
// calendar day. We deliberately gate on status "completed" — that's the
// same precondition the existing per-delivery invoice engine already
// enforces (services/invoiceService.js throws otherwise), so "hasOrder"
// here always means "an invoice can actually be generated right now".
// A delivery still pending completion simply isn't counted as an order
// yet — it will be, automatically, the moment the driver marks it done.
async function getTodaysOrders(businessDate) {
  const { start, end } = getISTDayRangeUTC(businessDate);
  const deliveries = await Delivery.find({
    deliveryDate: { $gte: start, $lt: end },
    status: "completed",
  }).sort({ completedAt: -1, createdAt: -1 });

  // One order per customer per day: if a customer somehow has more than
  // one completed delivery the same day, use the most recent one.
  const byPhone = new Map();
  for (const d of deliveries) {
    if (!byPhone.has(d.phone)) byPhone.set(d.phone, d);
  }
  return byPhone;
}

// getDailyInvoiceStatus() — STEP 7/10/11. Always safe to call before
// "Generate" has ever been clicked for that date — computes hasOrder
// fresh from Delivery data every time, and merges in whatever
// DailyInvoice rows already exist (generated / error). Implements the
// exact 3-state (+ not-yet-generated) logic from STEP 6/12.
async function getDailyInvoiceStatus(businessDate) {
  assertValidDate(businessDate);

  const [customers, ordersByPhone, existingRows] = await Promise.all([
    Customer.find().sort({ shopName: 1 }),
    getTodaysOrders(businessDate),
    DailyInvoice.find({ businessDate }),
  ]);
  const existingByCustomer = new Map(existingRows.map(r => [String(r.customer), r]));

  const invoices = customers.map((c) => {
    const order = ordersByPhone.get(c.phone);
    const hasOrder = !!order;
    const row = existingByCustomer.get(String(c._id));

    // STEP 12 — correct precedence: order status decides whether an
    // invoice is EXPECTED; PDF/row existence only decides its state.
    let pdfStatus = "not_required";
    let pdfFileName = null;
    let errorMessage;
    if (hasOrder) {
      if (row?.status === "generated") { pdfStatus = "generated"; pdfFileName = row.pdfFileName; }
      else if (row?.status === "error") { pdfStatus = "error"; errorMessage = row.errorMessage; }
      else pdfStatus = "pending"; // order exists, "Generate Today's Invoices" just hasn't been run yet for it
    }

    return {
      dailyInvoiceId: row?._id || null,
      customerId: c._id,
      customerName: c.shopName,
      phone: c.phone,
      whatsappGroupName: c.whatsappGroupName || "",
      businessDate,
      hasOrder,
      pdfFileName,
      pdfStatus,   // "generated" | "error" | "pending" | "not_required"
      errorMessage,
    };
  });

  const customersWithOrders   = invoices.filter(i => i.hasOrder).length;
  const invoicesGenerated     = invoices.filter(i => i.pdfStatus === "generated").length;
  const invoicesFailed        = invoices.filter(i => i.pdfStatus === "error").length;
  const customersWithoutOrders = invoices.length - customersWithOrders;

  return {
    date: businessDate,
    totalCustomers: customers.length,
    customersWithOrders,
    invoicesGenerated,
    invoicesFailed,
    customersWithoutOrders,
    invoices,
  };
}

// generateDailyInvoices() — STEP 4/5/17. Only touches customers who have
// an order today. Idempotent: if a customer already has a "generated"
// DailyInvoice row for this date AND the PDF file still exists on disk,
// it's left completely alone — no re-call to generateInvoicePdf, so no
// new invoice number gets minted and no duplicate file gets created.
async function generateDailyInvoices(businessDate) {
  assertValidDate(businessDate);

  const [customers, ordersByPhone] = await Promise.all([
    Customer.find(),
    getTodaysOrders(businessDate),
  ]);

  for (const c of customers) {
    const order = ordersByPhone.get(c.phone);
    if (!order) continue; // STEP 5 — no order, no invoice, no DailyInvoice row at all

    const existing = await DailyInvoice.findOne({ customer: c._id, businessDate });
    if (existing?.status === "generated" && readPdf(existing.pdfPath)) {
      continue; // already generated and file is intact — reuse, don't regenerate
    }

    try {
      // REUSE the existing invoice engine exactly as the per-delivery
      // Download Invoice button does — same PDF design, same GST/no-GST
      // logic, same invoice numbering sequence.
      const { buffer, invoiceNo } = await generateInvoicePdf(order._id, "without-gst");
      const pdfFileName = `${c._id}_${businessDate}.pdf`;
      const pdfPath = savePdf(businessDate, pdfFileName, buffer);

      await DailyInvoice.findOneAndUpdate(
        { customer: c._id, businessDate },
        {
          customer: c._id, delivery: order._id, businessDate,
          invoiceType: "without-gst", invoiceNumber: invoiceNo,
          pdfFileName, pdfPath, status: "generated",
          errorMessage: undefined, generatedAt: new Date(),
        },
        { upsert: true, setDefaultsOnInsert: true }
      );
    } catch (err) {
      // STEP 6, STATE C — order existed but generation failed. Recorded
      // as an explicit error, never silently treated as "no order".
      await DailyInvoice.findOneAndUpdate(
        { customer: c._id, businessDate },
        { customer: c._id, delivery: order._id, businessDate, status: "error", errorMessage: err.message },
        { upsert: true, setDefaultsOnInsert: true }
      );
    }
  }

  return getDailyInvoiceStatus(businessDate);
}

module.exports = { getDailyInvoiceStatus, generateDailyInvoices, todayIST, getTodaysOrders };