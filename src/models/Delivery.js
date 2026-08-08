// FILE: src/models/Delivery.js
// ADDED: section field — "delivery" | "porter"
// Driver can move a delivery to porter section from dashboard
const mongoose = require("mongoose");

const DeliverySchema = new mongoose.Schema({
  driver:        { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  // NEW — links this delivery to the existing Customer record it was
  // created from (via the Assign Delivery autocomplete). Optional so
  // deliveries created the old way (manual entry, no customer picked)
  // keep working exactly as before — phone number remains the fallback
  // match used everywhere else in the app (invoices, customer totals).
  customer:      { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
  deliveryDate:  { type: Date, required: true },
  shopName:      { type: String, required: true, trim: true },
  ownerName:     { type: String, required: true, trim: true },
  phone:         { type: String, required: true, trim: true },
  address:       { type: String, required: true, trim: true },
  latitude:      { type: Number },
  longitude:     { type: Number },
  productName:   { type: String, default: "Idly Batter", trim: true },
  quantity:      { type: Number, required: true },
  unit:          { type: String, default: "kg" },
  // NEW — per-kg price + GST breakdown entered on the Assign Delivery
  // form. totalAmount (below, pre-existing field) keeps its original
  // meaning everywhere else in the app (customer totals, sales reports,
  // payment collection, invoice line-item amount) — it is always the
  // PRE-GST bill for this delivery, i.e. equal to `subtotal`. GST for an
  // actual invoice document is still applied at download time by the
  // existing invoiceService (With GST / Without GST buttons), so storing
  // GST-inclusive numbers here would double-charge GST on the invoice.
  // gstEnabled/gstPercentage/gstAmount are kept purely as a record of
  // what the admin previewed while assigning this delivery.
  pricePerKg:    { type: Number },
  subtotal:      { type: Number },
  gstEnabled:    { type: Boolean, default: false },
  gstPercentage: { type: Number, default: 0 },
  gstAmount:     { type: Number, default: 0 },
  totalAmount:   { type: Number, required: true },
  sortOrder:     { type: Number, default: 0 },
  status:        { type: String, enum: ["pending","completed","skipped"], default: "pending" },
  // NEW: section — driver can move to porter
  section:       { type: String, enum: ["delivery","porter"], default: "delivery" },
  porterNote:    { type: String, trim: true }, // why moved to porter
  amountReceived:{ type: Number, default: 0 },
  paymentType:   { type: String, enum: ["cash","gpay","mixed","pending"], default: "pending" },
  pendingAmount: { type: Number, default: 0 },
  notes:         { type: String, trim: true },
  completedAt:   { type: Date },
}, { timestamps: true });

module.exports = mongoose.model("Delivery", DeliverySchema);