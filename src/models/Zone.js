// FILE: src/models/Zone.js
// NEW FILE — Feature: Distributors module (Chennai zone-wise split)
// PURPOSE: A "Zone" is one area of Chennai (e.g. "Ambattur", "Anna Nagar",
// "Velachery") that one or more distributors are appointed to. Zones are
// created by the admin from the Distributors Map page and then assigned
// to distributors. This is a brand-new, standalone collection — it does
// NOT touch Customer, User, Delivery or any existing model.
const mongoose = require("mongoose");

const ZoneSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, unique: true }, // e.g. "Ambattur"
    city: { type: String, default: "Chennai", trim: true },

    // Center point used to place the zone marker on the Distributors Map
    // (Google Map / Leaflet). Admin drops a pin when creating the zone.
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },

    notes: { type: String, trim: true, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Zone", ZoneSchema);