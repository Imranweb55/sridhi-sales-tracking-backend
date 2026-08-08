// FILE: src/services/dailyOrderSheetService.js
// PURPOSE: Generates the printable "Daily Order Sheet" PDF the admin uses
// to manually call every customer and write down today's Idly/Dosa
// quantity by hand. This is completely separate from invoiceService.js —
// it never touches invoices, deliveries, or the completed/GST workflow.
//
// DATA SOURCE (reuses existing collections — nothing duplicated):
//   - Customer collection  -> the running customer directory (already
//     exists, one row per phone number — see models/Customer.js)
//   - Customer.lastDriver  -> ObjectId ref to User, already set every time
//     a delivery is saved for that customer (customerController.js).
//     We use this as the "which route is this customer normally on"
//     signal — it's literally "who delivered to them last", which is
//     exactly the grouping the admin asked for.
//   - User (role: "driver") -> the real driver accounts. We added ONE new
//     field, `route` (a plain string label like "Ambattur Route"), set by
//     the admin from the Deliveries page. That's the only DB change this
//     feature required.

const PDFDocument = require("pdfkit");
const path = require("path");
const Customer = require("../models/Customer");
const User = require("../models/User");

const FONT_REGULAR = path.join(__dirname, "../assets/fonts/NotoSans-Regular.ttf");
const FONT_BOLD = path.join(__dirname, "../assets/fonts/NotoSans-Bold.ttf");

const NAVY = "#183a63";
const NAVY_LIGHT = "#eef2f7";
const BORDER = "#9aa5b1"; // slightly darker than the invoice border — needs to print clearly on paper
const TEXT_MUTED = "#6b7280";
const PAGE_MARGIN = 40;
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE_MARGIN * 2;
const BOTTOM_LIMIT = PAGE_HEIGHT - PAGE_MARGIN;

const BLANK_ROWS_PER_SECTION = 10;
const ROW_H = 26; // tall enough for handwriting
const HEADER_H = 24;

const COLS = [
  { key: "no", label: "No", w: 0.08 },
  { key: "hotel", label: "Hotel / Customer Name", w: 0.36 },
  { key: "phone", label: "Phone Number", w: 0.22 },
  { key: "qty", label: "Today's Idly/Dosa Quantity", w: 0.34 },
];

function formatDate(d) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function formatFileDate(d) {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

// ── Pagination helper ───────────────────────────────────────────────
// Keeps track of the current y cursor, adds a fresh page (and re-draws
// the running page header) whenever the next chunk of content wouldn't
// fit, and re-draws the table header when a table is split across pages.
function makeCursor(doc, dateLabel) {
  let y = PAGE_MARGIN;

  function drawPageHeader() {
    doc.font("NotoSans-Bold").fontSize(16).fillColor(NAVY)
      .text("DAILY ORDER SHEET", PAGE_MARGIN, y);
    doc.font("NotoSans").fontSize(10).fillColor(TEXT_MUTED)
      .text(`Date: ${dateLabel}`, PAGE_MARGIN, y + 22);
    y += 46;
  }

  drawPageHeader();

  return {
    get y() { return y; },
    set y(v) { y = v; },
    ensureSpace(needed, redrawTableHeaderFn) {
      if (y + needed > BOTTOM_LIMIT) {
        doc.addPage();
        y = PAGE_MARGIN;
        drawPageHeader();
        if (redrawTableHeaderFn) y = redrawTableHeaderFn(y);
      }
      return y;
    },
  };
}

function colX() {
  let cx = PAGE_MARGIN;
  return COLS.map((c) => {
    const x = cx;
    cx += c.w * CONTENT_WIDTH;
    return x;
  });
}
function colW() {
  return COLS.map((c) => c.w * CONTENT_WIDTH);
}

function drawSectionTitle(doc, y, title, subtitle) {
  doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, 26).fillColor(NAVY).fill();
  doc.font("NotoSans-Bold").fontSize(11).fillColor("#ffffff")
    .text(title, PAGE_MARGIN + 10, y + 7);
  if (subtitle) {
    doc.font("NotoSans").fontSize(9).fillColor("#dbe4f0")
      .text(subtitle, PAGE_MARGIN + 10, y + 7, { width: CONTENT_WIDTH - 20, align: "right" });
  }
  return y + 26 + 8;
}

function drawTableHeader(doc, y) {
  const x = colX();
  const w = colW();
  doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, HEADER_H).fillColor(NAVY_LIGHT).fill();
  doc.rect(PAGE_MARGIN, y, CONTENT_WIDTH, HEADER_H).lineWidth(0.75).strokeColor(BORDER).stroke();
  doc.font("NotoSans-Bold").fontSize(9).fillColor("#111827");
  COLS.forEach((c, i) => {
    doc.text(c.label, x[i] + 6, y + 7, { width: w[i] - 12, align: i === 0 ? "center" : "left" });
  });
  return y + HEADER_H;
}

function drawRow(doc, y, no, hotel, phone) {
  const x = colX();
  const w = colW();
  COLS.forEach((c, i) => {
    doc.rect(x[i], y, w[i], ROW_H).lineWidth(0.5).strokeColor(BORDER).stroke();
  });
  doc.font("NotoSans").fontSize(9.5).fillColor("#111827");
  doc.text(String(no ?? ""), x[0] + 4, y + 8, { width: w[0] - 8, align: "center" });
  doc.text(hotel || "", x[1] + 6, y + 8, { width: w[1] - 12 });
  doc.text(phone || "", x[2] + 6, y + 8, { width: w[2] - 12 });
  // qty column (x[3]) is intentionally left blank — handwriting space
  return y + ROW_H;
}

function drawTable(doc, cursor, rows, blankCount, startNo = 1) {
  cursor.y = drawTableHeader(doc, cursor.y);
  let no = startNo;

  rows.forEach((r) => {
    cursor.ensureSpace(ROW_H, (y) => drawTableHeader(doc, y));
    cursor.y = drawRow(doc, cursor.y, no, r.hotel, r.phone);
    no += 1;
  });

  for (let i = 0; i < blankCount; i++) {
    cursor.ensureSpace(ROW_H, (y) => drawTableHeader(doc, y));
    cursor.y = drawRow(doc, cursor.y, "", "", "");
  }

  return no;
}

// ── Main entry point ────────────────────────────────────────────────
async function generateDailyOrderSheetPdf(dateInput) {
  const date = dateInput ? new Date(dateInput) : new Date();
  if (isNaN(date.getTime())) {
    const err = new Error("Invalid date.");
    err.statusCode = 400;
    throw err;
  }
  const dateLabel = formatDate(date);
  const fileDateLabel = formatFileDate(date);

  const [customers, drivers] = await Promise.all([
    Customer.find().sort({ shopName: 1 }),
    User.find({ role: "driver" }).sort({ name: 1 }),
  ]);

  const doc = new PDFDocument({ size: "A4", margin: PAGE_MARGIN, bufferPages: true });
  doc.registerFont("NotoSans", FONT_REGULAR);
  doc.registerFont("NotoSans-Bold", FONT_BOLD);
  const chunks = [];
  doc.on("data", (c) => chunks.push(c));
  const done = new Promise((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const cursor = makeCursor(doc, dateLabel);

  // ── Section 1: OVERALL CUSTOMER LIST ──
  cursor.y = drawSectionTitle(doc, cursor.y, "OVERALL CUSTOMER LIST", `${customers.length} customer${customers.length === 1 ? "" : "s"}`);
  drawTable(
    doc, cursor,
    customers.map((c) => ({ hotel: c.shopName, phone: c.phone })),
    BLANK_ROWS_PER_SECTION
  );
  cursor.y += 20;

  // ── Section 2: ROUTE-WISE ORDER LIST ──
  cursor.ensureSpace(60);
  cursor.y = drawSectionTitle(doc, cursor.y, "ROUTE-WISE ORDER LIST");

  // Group customers by their last-delivered-to driver, matching the
  // existing route assignment rather than inventing a new one.
  const byDriver = new Map(drivers.map((d) => [String(d._id), []]));
  const unassigned = [];
  customers.forEach((c) => {
    const key = c.lastDriver ? String(c.lastDriver) : null;
    if (key && byDriver.has(key)) byDriver.get(key).push(c);
    else unassigned.push(c);
  });

  if (drivers.length === 0) {
    cursor.ensureSpace(20);
    doc.font("NotoSans").fontSize(9.5).fillColor(TEXT_MUTED)
      .text("No drivers found yet — add a driver on the Deliveries page to enable route sections.", PAGE_MARGIN, cursor.y);
    cursor.y += 24;
  }

  drivers.forEach((driver) => {
    const driverCustomers = byDriver.get(String(driver._id)) || [];
    cursor.ensureSpace(26 + 8 + HEADER_H + ROW_H);
    cursor.y = drawSectionTitle(
      doc, cursor.y,
      `DRIVER: ${(driver.name || "—").toUpperCase()}`,
      `ROUTE: ${(driver.route || "Not set").toUpperCase()}`
    );
    drawTable(
      doc, cursor,
      driverCustomers.map((c) => ({ hotel: c.shopName, phone: c.phone })),
      BLANK_ROWS_PER_SECTION
    );
    cursor.y += 20;
  });

  // Customers who were never matched to a driver yet (e.g. added directly
  // as a Customer record, or their delivering driver was later removed).
  if (unassigned.length > 0) {
    cursor.ensureSpace(26 + 8 + HEADER_H + ROW_H);
    cursor.y = drawSectionTitle(doc, cursor.y, "UNASSIGNED CUSTOMERS", "No route/driver on file yet");
    drawTable(
      doc, cursor,
      unassigned.map((c) => ({ hotel: c.shopName, phone: c.phone })),
      BLANK_ROWS_PER_SECTION
    );
  }

  doc.end();
  const buffer = await done;
  return { buffer, fileDateLabel };
}

module.exports = { generateDailyOrderSheetPdf };