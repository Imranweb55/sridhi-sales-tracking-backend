// FILE: src/models/InvoiceCounter.js
// PURPOSE: Atomic sequence generator for invoice numbers.
// Reference design uses format  SRI/05008/26-27  where 05008 is a running
// sequence for the financial year (Apr–Mar) and is shared across both the
// "Invoice" (without GST) and "Tax Invoice" (with GST) documents — the two
// sample invoices provided (05007 and 05008) were issued back-to-back on
// the same day, one of each type.

const mongoose = require("mongoose");

const InvoiceCounterSchema = new mongoose.Schema({
  financialYear: { type: String, required: true, unique: true }, // e.g. "26-27"
  seq:           { type: Number, default: 5006 }, // first generated number will be 5007, matching reference sample
}, { timestamps: true });

InvoiceCounterSchema.statics.getFinancialYear = (date = new Date()) => {
  const y = date.getFullYear();
  const startYear = date.getMonth() + 1 >= 4 ? y : y - 1; // FY starts in April
  const shortStart = String(startYear).slice(-2);
  const shortEnd = String(startYear + 1).slice(-2);
  return `${shortStart}-${shortEnd}`;
};

// Returns the next invoice number string, e.g. "SRI/05009/26-27"
InvoiceCounterSchema.statics.getNextInvoiceNumber = async function (date = new Date()) {
  const financialYear = this.getFinancialYear(date);
  const counter = await this.findOneAndUpdate(
    { financialYear },
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  const seqStr = String(counter.seq).padStart(5, "0");
  return `SRI/${seqStr}/${financialYear}`;
};

module.exports = mongoose.model("InvoiceCounter", InvoiceCounterSchema);