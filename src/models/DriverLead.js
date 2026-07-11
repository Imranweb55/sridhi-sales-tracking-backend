// FILE: src/models/DriverLead.js
// NEW FILE — Feature: "Drivers List" (backup driver leads)
// Purpose: manually-added leads for backup drivers, so the admin has
// someone to call when a regular driver doesn't show up for duty.
// This is completely separate from the "User" (role: driver) model, which
// is the real login account used by the driver mobile app — nothing here
// touches that model or any mobile-facing route.
const mongoose = require("mongoose");

const DriverLeadSchema = new mongoose.Schema({
  name:            { type: String, required: true, trim: true },
  mobile:          { type: String, required: true, trim: true },
  altMobile:       { type: String, trim: true },
  area:            { type: String, trim: true },          // where the driver lives / can operate
  vehicleType:     { type: String, enum: ["bike", "auto", "van", "own_lorry", "other"], default: "bike" },
  experience:      { type: String, trim: true },           // e.g. "2 years", free text
  licenseAvailable:{ type: Boolean, default: false },
  expectedSalary:  { type: Number },
  status:          { type: String, enum: ["available", "contacted", "hired", "not_interested"], default: "available" },
  notes:           { type: String, trim: true },           // free notes admin can update any time
  source:          { type: String, trim: true },           // e.g. "referral", "olx", "walk-in"
}, { timestamps: true });

module.exports = mongoose.model("DriverLead", DriverLeadSchema);