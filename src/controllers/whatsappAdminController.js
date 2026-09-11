// FILE: src/controllers/whatsappAdminController.js
// NEW FILE — Feature: WhatsApp Automation (admin-facing side)
// PURPOSE: Endpoints the Admin Dashboard browser calls directly, using the
// SAME protectAdmin auth every other admin route already uses. Nothing
// here changes any existing route, controller, or model.

const WhatsappRun = require("../models/WhatsappRun");
const dailyInvoiceService = require("../services/dailyInvoiceService");
const { todayIST } = require("../utils/businessDate");

// GET /api/admin/whatsapp/preview?date=YYYY-MM-DD
// Shows how many invoices are ready to send today, before the admin clicks
// Start. Reuses the exact same status calculation as the Daily Invoices
// page — no new business logic, just a filtered view of it.
exports.getSendPreview = async (req, res) => {
  try {
    const businessDate = req.query.date || todayIST();
    const status = await dailyInvoiceService.getDailyInvoiceStatus(businessDate);
    const ready = status.invoices.filter(
      (i) => i.pdfStatus === "generated" && i.whatsappGroupName
    );
    res.json({
      businessDate,
      count: ready.length,
      groups: ready.map((i) => ({
        whatsappGroupName: i.whatsappGroupName,
        pdfFileName: i.pdfFileName,
      })),
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
};

// POST /api/admin/whatsapp/start?date=YYYY-MM-DD
// Queues a new run. The local agent (running on the office PC) picks this
// up within a few seconds. Refuses to queue a second run while one is
// already queued/running, so the admin can't accidentally double-send.
exports.startAutomation = async (req, res) => {
  try {
    const businessDate = req.query.date || req.body?.date || todayIST();

    const alreadyActive = await WhatsappRun.findOne({
      status: { $in: ["queued", "running"] },
    });
    if (alreadyActive) {
      return res.status(409).json({
        message: "An automation run is already queued or in progress.",
      });
    }

    const run = await WhatsappRun.create({
      businessDate,
      status: "queued",
      message: "Waiting for the local sender on your PC to pick up this job...",
      triggeredBy: req.admin?._id,
    });

    res.json(run);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/admin/whatsapp/latest
// Used by the dashboard to poll live status after clicking Start.
exports.getLatestRun = async (req, res) => {
  try {
    const run = await WhatsappRun.findOne().sort({ createdAt: -1 });
    res.json(run || { status: "idle", message: "System ready" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/admin/whatsapp/logs
// Run history for the "Recent Activity" table.
exports.getRunHistory = async (req, res) => {
  try {
    const runs = await WhatsappRun.find().sort({ createdAt: -1 }).limit(50);
    res.json(runs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};