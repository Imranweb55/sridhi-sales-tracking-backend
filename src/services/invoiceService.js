// FILE: src/services/invoiceService.js
// PURPOSE: Reusable invoice PDF generator. Called by invoiceController for
// both "without-gst" (plain Invoice) and "with-gst" (Tax Invoice) types.
// All values are pulled from the Delivery (and, if matched, Customer)
// documents — nothing here is hardcoded per-invoice.

const PDFDocument = require("pdfkit");
const path = require("path");
const Delivery = require("../models/Delivery");
const Customer = require("../models/Customer");
const InvoiceCounter = require("../models/InvoiceCounter");
const company = require("../config/companyDetails");
const { amountToWords } = require("../utils/numberToWords");

const FONT_REGULAR = path.join(__dirname, "../assets/fonts/NotoSans-Regular.ttf");
const FONT_BOLD = path.join(__dirname, "../assets/fonts/NotoSans-Bold.ttf");

// ── Colours / layout constants (matched to reference design) ──────────
const NAVY = "#183a63";
const NAVY_LIGHT = "#eef2f7";
const BORDER = "#d7dde5";
const TEXT_MUTED = "#6b7280";
const PAGE_MARGIN = 40;
const PAGE_WIDTH = 595.28; // A4 pt
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;

function formatDate(d) {
  const date = new Date(d);
  const day = String(date.getDate()).padStart(2, "0");
  const month = date.toLocaleString("en-US", { month: "short" });
  const year = String(date.getFullYear()).slice(-2);
  return `${day}-${month}-${year}`;
}

function money(n) {
  return Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// NOTE: the core Helvetica font (WinAnsi encoding) has no glyph for ₹, so
// we register a Noto Sans TTF (bundled in src/assets/fonts) which supports
// the Indian Rupee sign and use that font throughout the PDF instead.
const CUR = "₹";

// Fetch the delivery + best-effort matched customer record (for GSTIN etc.)
async function getInvoiceSourceData(deliveryId) {
  const delivery = await Delivery.findById(deliveryId).populate("driver", "name employeeId");
  if (!delivery) {
    const err = new Error("Delivery not found");
    err.statusCode = 404;
    throw err;
  }
  if (delivery.status !== "completed") {
    const err = new Error("Invoice can only be generated for a completed delivery");
    err.statusCode = 400;
    throw err;
  }
  const customer = await Customer.findOne({ phone: delivery.phone });
  return { delivery, customer };
}

function drawHeaderInfoTable(doc, rows, x, y, width) {
  const rowH = 30;
  const labelW = width * 0.52;
  doc.lineWidth(0.75).strokeColor(BORDER);
  rows.forEach((row, i) => {
    const ry = y + i * rowH;
    doc.rect(x, ry, width, rowH).stroke();
    doc.rect(x, ry, labelW, rowH).stroke();
    doc.fontSize(8.5).fillColor("#111827").font("NotoSans")
      .text(row[0], x + 8, ry + 5, { width: labelW - 16 });
    doc.font("NotoSans-Bold").fontSize(9)
      .text(row[1] || "-", x + labelW + 8, ry + 9, { width: width - labelW - 16 });
  });
  return y + rows.length * rowH;
}

function drawAddressBlock(doc, x, y, width, lines) {
  doc.fontSize(9).fillColor("#111827").font("NotoSans");
  let cy = y;
  lines.forEach((line) => {
    doc.text(line, x, cy, { width });
    cy += 15;
  });
  return cy;
}

function drawPartyBox(doc, x, y, width, height, headerLabel, party) {
  doc.rect(x, y, width, height).lineWidth(0.75).strokeColor(BORDER).stroke();
  doc.rect(x, y, width, 22).fillColor(NAVY).fill();
  doc.fillColor("#ffffff").font("NotoSans-Bold").fontSize(9)
    .text(headerLabel, x + 10, y + 6);

  let cy = y + 32;
  doc.fillColor("#111827").font("NotoSans-Bold").fontSize(10)
    .text(party.name, x + 12, cy, { width: width - 24 });
  cy += 16;
  doc.font("NotoSans").fontSize(9).fillColor("#111827");
  party.addressLines.forEach((line) => {
    doc.text(line, x + 12, cy, { width: width - 24 });
    cy += 14;
  });
  if (party.gstin) {
    doc.text(`GSTIN/UIN    : ${party.gstin}`, x + 12, cy, { width: width - 24 });
    cy += 14;
  }
  doc.text(`State Name  : ${party.stateName}, Code : ${party.stateCode}`, x + 12, cy, { width: width - 24 });
}

function drawItemsTable(doc, x, y, width, items, withGst) {
  const cols = withGst
    ? [
        { key: "sl", label: "Sl.\nNo.", w: 0.06 },
        { key: "desc", label: "Description of\nGoods and Services", w: 0.30 },
        { key: "hsn", label: "HSN/SAC", w: 0.13 },
        { key: "qty", label: "Quantity", w: 0.15 },
        { key: "rate", label: `Rate (${CUR})`, w: 0.12 },
        { key: "per", label: "per", w: 0.08 },
        { key: "amt", label: `Amount (${CUR})`, w: 0.16 },
      ]
    : [
        { key: "sl", label: "Sl.\nNo.", w: 0.06 },
        { key: "desc", label: "Description of\nGoods and Services", w: 0.30 },
        { key: "hsn", label: "HSN/SAC", w: 0.13 },
        { key: "qty", label: "Quantity", w: 0.15 },
        { key: "rate", label: `Rate (${CUR})`, w: 0.12 },
        { key: "per", label: "per", w: 0.08 },
        { key: "amt", label: `Amount (${CUR})`, w: 0.16 },
      ];

  let cx = x;
  const colX = cols.map((c) => {
    const thisX = cx;
    cx += c.w * width;
    return thisX;
  });
  const colW = cols.map((c) => c.w * width);

  const headerH = 34;
  doc.rect(x, y, width, headerH).fillColor(NAVY).fill();
  doc.font("NotoSans-Bold").fontSize(9).fillColor("#ffffff");
  cols.forEach((c, i) => {
    doc.text(c.label, colX[i] + 6, y + 7, { width: colW[i] - 12, align: i >= 3 ? "center" : "left" });
  });

  let ry = y + headerH;
  const rowH = 26;
  doc.font("NotoSans").fontSize(9.5).fillColor("#111827");
  let totalQty = 0;
  let totalAmt = 0;

  items.forEach((item, i) => {
    doc.rect(x, ry, width, rowH).lineWidth(0.5).strokeColor(BORDER).stroke();
    const values = {
      sl: String(i + 1),
      desc: item.description,
      hsn: item.hsn,
      qty: `${item.quantity.toFixed(3)} ${item.unit}`,
      rate: money(item.rate),
      per: item.unit,
      amt: money(item.amount),
    };
    cols.forEach((c, ci) => {
      doc.font(c.key === "amt" ? "NotoSans-Bold" : "NotoSans")
        .text(values[c.key], colX[ci] + 6, ry + 8, {
          width: colW[ci] - 12,
          align: ["qty", "rate", "per", "amt"].includes(c.key) ? "center" : "left",
        });
    });
    totalQty += item.quantity;
    totalAmt += item.amount;
    ry += rowH;
  });

  // NOTE: no blank filler rows are added here — the table shows exactly
  // one row per delivery line item (e.g. a combined "Idly & Dosa Batter"
  // delivery stays a single row, it is never split into two).

  // Totals row
  const totalsH = 26;
  doc.rect(x, ry, width, totalsH).lineWidth(0.75).strokeColor(BORDER).stroke();
  doc.font("NotoSans-Bold").fontSize(9);
  doc.text("Total Quantity", colX[1] + 6, ry + 8, { width: colW[1] + colW[2] - 12 });
  doc.text(`${totalQty.toFixed(3)} Kgs`, colX[3] + 6, ry + 8, { width: colW[3] - 12, align: "center" });
  doc.text("Total Amount", colX[4], ry + 8, { width: colW[4] + colW[5] - 10, align: "right" });
  doc.text(money(totalAmt), colX[6] + 6, ry + 8, { width: colW[6] - 12, align: "center" });
  ry += totalsH;

  return { bottomY: ry, totalQty, totalAmt, colX, colW };
}

function drawGstBreakup(doc, x, y, width, taxableValue, cgstPct, sgstPct, igstPct) {
  const cgstAmt = (taxableValue * cgstPct) / 100;
  const sgstAmt = (taxableValue * sgstPct) / 100;
  const igstAmt = (taxableValue * igstPct) / 100;
  const totalGst = cgstAmt + sgstAmt + igstAmt;

  const cols = igstPct > 0
    ? [
        { label: "HSN/SAC", w: 0.16 },
        { label: `Taxable Value (${CUR})`, w: 0.20 },
        { label: `IGST\n${igstPct}% (${CUR})`, w: 0.20 },
        { label: `Total GST (${CUR})`, w: 0.44 },
      ]
    : [
        { label: "HSN/SAC", w: 0.16 },
        { label: `Taxable Value (${CUR})`, w: 0.20 },
        { label: `CGST\n${cgstPct}% (${CUR})`, w: 0.20 },
        { label: `SGST\n${sgstPct}% (${CUR})`, w: 0.20 },
        { label: `Total GST (${CUR})`, w: 0.24 },
      ];

  let cx = x;
  const colX = cols.map((c) => { const t = cx; cx += c.w * width; return t; });
  const colW = cols.map((c) => c.w * width);

  const headH = 30;
  doc.rect(x, y, width, headH).fillColor(NAVY_LIGHT).fill();
  doc.rect(x, y, width, headH).lineWidth(0.75).strokeColor(BORDER).stroke();
  doc.font("NotoSans-Bold").fontSize(8.5).fillColor("#111827");
  cols.forEach((c, i) => {
    doc.text(c.label, colX[i] + 6, y + 6, { width: colW[i] - 12, align: "center" });
  });

  const rowY = y + headH;
  const rowH = 24;
  doc.rect(x, rowY, width, rowH).lineWidth(0.75).strokeColor(BORDER).stroke();
  doc.font("NotoSans").fontSize(9);
  const values = igstPct > 0
    ? [company.defaultHsnCode, money(taxableValue), money(igstAmt), money(totalGst)]
    : [company.defaultHsnCode, money(taxableValue), money(cgstAmt), money(sgstAmt), money(totalGst)];
  values.forEach((v, i) => {
    doc.text(v, colX[i] + 6, rowY + 7, { width: colW[i] - 12, align: "center" });
  });

  return { bottomY: rowY + rowH, cgstAmt, sgstAmt, igstAmt, totalGst };
}

function drawGrandTotalBar(doc, x, y, width, grandTotal) {
  const barW = width * 0.42;
  const barX = x + width - barW;
  const h = 30;
  doc.rect(barX, y, barW, h).fillColor(NAVY).fill();
  doc.fillColor("#ffffff").font("NotoSans-Bold").fontSize(10)
    .text(`GRAND TOTAL (${CUR})`, barX + 12, y + 9);
  doc.fontSize(12).text(money(grandTotal), barX, y + 7, { width: barW - 12, align: "right" });
  return y + h;
}

function drawFooter(doc, x, y, width, grandTotalWords) {
  doc.font("NotoSans").fontSize(9).fillColor("#111827")
    .text("Amount Chargeable (in words)", x, y);
  doc.font("NotoSans-Bold").fontSize(10)
    .text(grandTotalWords, x, y + 14, { width });

  const boxY = y + 40;
  const boxH = 70;
  const leftW = width * 0.55;
  doc.rect(x, boxY, width, boxH).lineWidth(0.75).strokeColor(BORDER).stroke();
  doc.moveTo(x + leftW, boxY).lineTo(x + leftW, boxY + boxH).strokeColor(BORDER).stroke();

  doc.font("NotoSans-Bold").fontSize(9).text("Terms & Conditions", x + 10, boxY + 10);
  doc.font("NotoSans").fontSize(8.5).fillColor(TEXT_MUTED)
    .text("We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.",
      x + 10, boxY + 24, { width: leftW - 20 });

  doc.font("NotoSans-Bold").fontSize(9).fillColor("#111827")
    .text(`for ${company.name}`, x + leftW + 10, boxY + 10, { width: width - leftW - 20, align: "center" });
  doc.font("NotoSans").fontSize(8.5).fillColor("#111827")
    .text("Authorised Signatory", x + leftW + 10, boxY + boxH - 20, { width: width - leftW - 20, align: "center" });

  doc.font("NotoSans").fontSize(8).fillColor(TEXT_MUTED)
    .text("This is a Computer Generated Invoice", x, boxY + boxH + 16, { width, align: "center" });
}

// ── Main entry point ────────────────────────────────────────────────
async function generateInvoicePdf(deliveryId, type) {
  if (!["with-gst", "without-gst"].includes(type)) {
    const err = new Error("Invalid invoice type. Use 'with-gst' or 'without-gst'.");
    err.statusCode = 400;
    throw err;
  }

  const { delivery, customer } = await getInvoiceSourceData(deliveryId);
  const withGst = type === "with-gst";
  const invoiceDate = delivery.completedAt || new Date();
  const invoiceNo = await InvoiceCounter.getNextInvoiceNumber(invoiceDate);

  const buyer = {
    name: delivery.shopName,
    // Split the free-text delivery address into readable lines, matching
    // the multi-line address block style in the reference design.
    addressLines: String(delivery.address || "").split(",").map((s) => s.trim()).filter(Boolean),
    gstin: withGst ? (customer?.gstin || "") : "",
    stateName: company.stateName,
    stateCode: company.stateCode,
  };

  const rate = delivery.quantity ? delivery.totalAmount / delivery.quantity : 0;
  const items = [
    {
      description: delivery.productName || "Product",
      hsn: company.defaultHsnCode,
      quantity: delivery.quantity || 0,
      unit: (delivery.unit || "kg").replace(/^kg$/i, "Kgs"),
      rate,
      amount: delivery.totalAmount || 0,
    },
  ];

  const doc = new PDFDocument({ size: "A4", margin: PAGE_MARGIN, bufferPages: true });
  doc.registerFont("NotoSans", FONT_REGULAR);
  doc.registerFont("NotoSans-Bold", FONT_BOLD);
  const chunks = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const x = PAGE_MARGIN;
  let y = PAGE_MARGIN;
  const w = CONTENT_WIDTH;

  // ── Top header: company name + doc title + info table ──
  const infoTableW = w * 0.38;
  const leftColW = w - infoTableW - 20;
  const nameW = leftColW * 0.58;

  doc.font("NotoSans-Bold").fontSize(17).fillColor(NAVY)
    .text(company.name, x, y, { width: nameW });
  doc.fontSize(17).text(withGst ? "TAX INVOICE" : "INVOICE", x + nameW, y, { width: leftColW - nameW, align: "center" });

  const infoRows = [
    ["Invoice No.", invoiceNo],
    ["Invoice Date", formatDate(invoiceDate)],
    ["Mode/Terms of Payment", delivery.paymentType ? delivery.paymentType.toUpperCase() : "-"],
    ["Buyer's Order No.", "-"],
    ["Dispatch Doc No.", "-"],
    ["Delivery Note Date", "-"],
  ];
  const infoBottomY = drawHeaderInfoTable(doc, infoRows, x + w - infoTableW, y, infoTableW);

  let leftY = y + 30;
  leftY = drawAddressBlock(doc, x, leftY, leftColW, company.addressLines);
  doc.fontSize(9).fillColor("#111827");
  doc.text(`Phone: ${company.phone}`, x, leftY); leftY += 14;
  doc.text(`Email: ${company.email}`, x, leftY); leftY += 14;
  if (withGst) { doc.text(`GSTIN/UIN : ${company.gstin}`, x, leftY); leftY += 14; }
  doc.text(`State Name : ${company.stateName}, Code : ${company.stateCode}`, x, leftY);
  leftY += 14;

  y = Math.max(leftY, infoBottomY) + 20;

  // ── Bill To / Ship To ──
  const boxW = (w - 16) / 2;
  const boxH = 32 + 16 + buyer.addressLines.length * 14 + (buyer.gstin ? 14 : 0) + 14 + 10;
  drawPartyBox(doc, x, y, boxW, boxH, "BILL TO", buyer);
  drawPartyBox(doc, x + boxW + 16, y, boxW, boxH, "SHIP TO", buyer);
  y += boxH + 20;

  // ── Items table ──
  const { bottomY, totalAmt } = drawItemsTable(doc, x, y, w, items, withGst);
  y = bottomY + 10;

  let grandTotal = totalAmt;
  if (withGst) {
    const { bottomY: gstBottomY, totalGst } = drawGstBreakup(
      doc, x, y, w, totalAmt, company.cgstPercent, company.sgstPercent, company.igstPercent
    );
    y = gstBottomY + 10;
    grandTotal = totalAmt + totalGst;
  }

  y = drawGrandTotalBar(doc, x, y, w, grandTotal) + 20;

  drawFooter(doc, x, y, w, amountToWords(grandTotal));

  doc.end();
  const buffer = await done;
  return { buffer, invoiceNo, grandTotal };
}

module.exports = { generateInvoicePdf };