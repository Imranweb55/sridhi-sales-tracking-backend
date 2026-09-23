// FILE: src/models/Product.js
// NEW FILE — Feature: Distributor real-time workflow (margin tracking).
// PURPOSE: The two batter types (Idly, Dosa) as a tiny admin-managed
// catalog, holding two rates per product:
//   - companyRatePerKg: what the admin/company charges the DISTRIBUTOR
//   - customerRatePerKg: the default price the distributor charges the
//     CUSTOMER for that kg
// margin per kg = customerRatePerKg - companyRatePerKg. This is what
// lets the PWA and admin dashboard compute "today's margin" / "total
// margin" without the distributor typing a rate every time. Admin can
// still edit these rates any time from the new Products page.
// Standalone collection — doesn't touch Customer, Distributor, or any
// existing model.
const mongoose = require("mongoose");

const ProductSchema = new mongoose.Schema(
  {
    // Stable machine key used everywhere in code ("idly" / "dosa") so
    // existing idlyKg/dosaKg fields elsewhere in the app line up with
    // this catalog without needing a bigger refactor.
    key: { type: String, required: true, unique: true, enum: ["idly", "dosa"] },
    name: { type: String, required: true, trim: true }, // "Idly Batter"
    unit: { type: String, default: "kg" },

    companyRatePerKg: { type: Number, required: true, default: 0 },
    customerRatePerKg: { type: Number, required: true, default: 0 },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Product", ProductSchema);