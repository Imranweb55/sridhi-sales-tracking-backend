// FILE: src/controllers/dailyInvoiceController.js
// PURPOSE: Thin HTTP layer — all business logic lives in
// services/dailyInvoiceService.js (STEP 20: keep responsibilities separate).

const DailyInvoice = require("../models/DailyInvoice");
const dailyInvoiceService = require("../services/dailyInvoiceService");
const { readPdf } = require("../utils/pdfStorage");

// GET /api/admin/invoices/daily?date=YYYY-MM-DD  (date optional, defaults to today IST)
exports.getDailyStatus = async (req, res) => {
  try {
    const date = req.query.date || dailyInvoiceService.todayIST();
    const data = await dailyInvoiceService.getDailyInvoiceStatus(date);
    res.json(data);
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
};

// POST /api/admin/invoices/daily/generate?date=YYYY-MM-DD  (date optional, defaults to today IST)
exports.generateDaily = async (req, res) => {
  try {
    const date = req.query.date || req.body?.date || dailyInvoiceService.todayIST();
    const data = await dailyInvoiceService.generateDailyInvoices(date);
    res.json(data);
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
};

// GET /api/admin/invoices/daily/:id/download
// Downloads one already-generated Daily Invoice PDF. Only ever resolves a
// file through a DailyInvoice DB id — the frontend never sends a
// filesystem path (STEP 15/16 security requirement).
exports.downloadDailyInvoice = async (req, res) => {
  try {
    const row = await DailyInvoice.findById(req.params.id).populate("customer", "shopName");
    if (!row || row.status !== "generated") {
      return res.status(404).json({ message: "Invoice not found." });
    }
    const buffer = readPdf(row.pdfPath);
    if (!buffer) {
      return res.status(404).json({ message: "Invoice file missing on server. Try generating again." });
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${row.pdfFileName}"`);
    res.setHeader("Content-Length", buffer.length);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};