// FILE: src/models/Customer.js
// NEW FILE — Feature: "Customers" directory
// Purpose: a running directory of every customer we currently deliver to.
// A Customer record is created automatically the first time a delivery is
// added for a given phone number (see customerController.upsertFromDelivery,
// called from driverController.createDelivery). If the phone number already
// exists, we do NOT create a duplicate — we just update the running totals
// on the existing record (kg delivered, order count, last delivery date).
const mongoose = require("mongoose");

const CustomerSchema = new mongoose.Schema({
  shopName:        { type: String, required: true, trim: true },
  ownerName:       { type: String, trim: true },
  phone:           { type: String, required: true, trim: true, unique: true, index: true },
  address:         { type: String, trim: true },

  // Manually set by admin on the Customer detail page. Defaults to
  // "irregular" for every newly-discovered customer. The daily / monthly
  // "kg sold per day" figure on the Customers tab and Sales Reports tab
  // only counts kg from customers tagged "regular".
  tag:             { type: String, enum: ["regular", "irregular"], default: "irregular" },

  totalKg:         { type: Number, default: 0 },   // running total across all deliveries
  totalOrders:     { type: Number, default: 0 },
  totalAmount:     { type: Number, default: 0 },

  firstDeliveryDate:{ type: Date },
  lastDeliveryDate: { type: Date },
  lastDriver:      { type: mongoose.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

module.exports = mongoose.model("Customer", CustomerSchema);