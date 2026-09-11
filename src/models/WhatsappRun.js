// FILE: src/models/WhatsappRun.js
// NEW FILE — Feature: WhatsApp Automation
// Purpose: One row per "Start Automation" click from the dashboard. Acts
// as the job queue between the admin dashboard (creates a "queued" row)
// and the local sending agent running on the office PC (claims it, sets
// it "running", then reports back "success"/"failed" with counts).

const mongoose = require("mongoose");

const WhatsappRunSchema = new mongoose.Schema({
  businessDate: { type: String, required: true }, // "YYYY-MM-DD", IST calendar date
  status: {
    type: String,
    enum: ["queued", "running", "success", "failed"],
    default: "queued",
  },
  sentCount: { type: Number, default: 0 },
  skippedCount: { type: Number, default: 0 },
  message: { type: String, default: "" },
  startedAt: { type: Date },
  finishedAt: { type: Date },
  triggeredBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
}, { timestamps: true });

module.exports = mongoose.model("WhatsappRun", WhatsappRunSchema);