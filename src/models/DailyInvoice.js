// FILE: src/models/DailyInvoice.js
// PURPOSE: The MongoDB record that IS the "Customer -> WhatsApp Group ->
// Today's Invoice -> PDF" mapping the feature spec asks for. One row per
// (customer, businessDate) — enforced by the unique index below, which is
// what makes "Generate Today's Invoices" safe to click more than once
// (STEP 17: idempotency) without minting duplicate invoice numbers or
// duplicate files.
//
// A row only ever exists for a customer who HAD an order that day — a
// customer with no order simply has no row for that date (STEP 5/12: we
// never fabricate a "not_required" row, that status is computed on read
// by dailyInvoiceService, not stored).

const mongoose = require("mongoose");

const DailyInvoiceSchema = new mongoose.Schema({
  customer:      { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
  // The specific completed Delivery this invoice was generated from —
  // reuses the exact same invoice engine (services/invoiceService.js)
  // that the existing per-delivery "Download Invoice" button already uses.
  delivery:      { type: mongoose.Schema.Types.ObjectId, ref: "Delivery", required: true },
  businessDate:  { type: String, required: true }, // "YYYY-MM-DD", IST calendar date
  invoiceType:   { type: String, enum: ["with-gst", "without-gst"], default: "without-gst" },
  invoiceNumber: { type: String },
  pdfFileName:   { type: String },
  // Path relative to utils/pdfStorage.js STORAGE_ROOT — never an absolute
  // filesystem path, and never sent to the frontend (STEP 15/16).
  pdfPath:       { type: String },
  status:        { type: String, enum: ["generated", "error"], required: true },
  errorMessage:  { type: String },
  generatedAt:   { type: Date },
}, { timestamps: true });

DailyInvoiceSchema.index({ customer: 1, businessDate: 1 }, { unique: true });

module.exports = mongoose.model("DailyInvoice", DailyInvoiceSchema);