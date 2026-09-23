// FILE: src/models/BatterRequest.js
// NEW FILE — Feature: Distributors module — "Daily Requirement"
// PURPOSE: Every day a distributor opens the Distributors-PWA-App and
// requests how many kg of Idly batter + Dosa batter they need (based on
// their assigned customers' orders that day). The admin sees all of
// these on the "Daily Requirement" tab, checks current stock, and
// approves (fully or partially, with a delivery time) or rejects.
const mongoose = require("mongoose");

const BatterRequestSchema = new mongoose.Schema(
  {
    distributor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Distributor",
      required: true,
    },

    requestDate: { type: Date, required: true, default: Date.now },

    // What the distributor asked for
    requestedIdlyKg: { type: Number, default: 0 },
    requestedDosaKg: { type: Number, default: 0 },

    // NEW (additive) — Feature: real-time distributor workflow (stock
    // carry-over). Snapshot of the distributor's currentStockKg at the
    // moment this request was created, so admin can see exactly how much
    // was already sitting in the fridge when the request was made.
    stockAtRequestTime: {
      idly: { type: Number, default: 0 },
      dosa: { type: Number, default: 0 },
    },

    // NEW (additive) — set only when the distributor already had enough
    // (or partial) stock to cover part of today's need but chose to
    // still request the full amount anyway — the PWA asks for a reason
    // in that case, and admin sees it here.
    carryOverReason: { type: String, trim: true, default: "" },

    // Snapshot of the customers/orders behind this request, so the admin
    // can see "today distributor X needs 40kg because these 12 customers
    // ordered" without having to cross-reference separately.
    customerOrders: [
      {
        customer: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
        shopName: { type: String, trim: true },
        idlyKg: { type: Number, default: 0 },
        dosaKg: { type: Number, default: 0 },
      },
    ],

    status: {
      type: String,
      enum: ["pending", "approved", "partially_approved", "rejected"],
      default: "pending",
    },

    // What the admin actually approved
    approvedIdlyKg: { type: Number, default: 0 },
    approvedDosaKg: { type: Number, default: 0 },
    deliveryTime: { type: String, trim: true, default: "" }, // e.g. "6:30 PM"
    adminNote: { type: String, trim: true, default: "" },

    respondedAt: { type: Date },
  },
  { timestamps: true }
);

module.exports = mongoose.model("BatterRequest", BatterRequestSchema);