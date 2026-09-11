// FILE: src/controllers/whatsappAgentController.js
// NEW FILE — Feature: WhatsApp Automation (local agent-facing side)
// PURPOSE: Endpoints called only by whatsapp_agent.py running on the
// office PC — never by a browser. Protected by protectAgent (a shared
// secret key), completely separate from the admin JWT login flow, so the
// existing Admin Dashboard / mobile app auth is never touched.

const WhatsappRun = require("../models/WhatsappRun");
const DailyInvoice = require("../models/DailyInvoice");
const dailyInvoiceService = require("../services/dailyInvoiceService");
const { readPdf } = require("../utils/pdfStorage");

// GET /api/agent/whatsapp/next-job
// The agent polls this every few seconds. Atomically claims the oldest
// "queued" run (findOneAndUpdate) so two agent instances can never pick
// up and double-send the same job.
exports.getNextJob = async (req, res) => {
  try {
    const run = await WhatsappRun.findOneAndUpdate(
      { status: "queued" },
      {
        status: "running",
        startedAt: new Date(),
        message: "Automation process started on the local PC...",
      },
      { sort: { createdAt: 1 }, new: true }
    );

    if (!run) return res.json({ job: null });

    const status = await dailyInvoiceService.getDailyInvoiceStatus(run.businessDate);
    const groups = status.invoices
      .filter((i) => i.pdfStatus === "generated" && i.whatsappGroupName)
      .map((i) => ({
        dailyInvoiceId: i.dailyInvoiceId,
        whatsappGroupName: i.whatsappGroupName,
        pdfFileName: i.pdfFileName,
      }));

    res.json({
      job: {
        runId: run._id,
        businessDate: run.businessDate,
        groups,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET /api/agent/whatsapp/invoices/:id/download
// Same file lookup as the admin dashboard's existing download endpoint
// (controllers/dailyInvoiceController.js), just reachable with the agent
// key instead of an admin browser session. Does not modify or duplicate
// the original endpoint.
exports.downloadForAgent = async (req, res) => {
  try {
    const row = await DailyInvoice.findById(req.params.id);
    if (!row || row.status !== "generated") {
      return res.status(404).json({ message: "Invoice not found." });
    }
    const buffer = readPdf(row.pdfPath);
    if (!buffer) {
      return res.status(404).json({ message: "Invoice file missing on server." });
    }
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${row.pdfFileName}"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// POST /api/agent/whatsapp/jobs/:runId/complete
// The agent calls this once it finishes (or fails) sending everything.
exports.completeJob = async (req, res) => {
  try {
    const { status, sentCount, skippedCount, message } = req.body;
    const run = await WhatsappRun.findByIdAndUpdate(
      req.params.runId,
      {
        status: status || "success",
        sentCount: sentCount || 0,
        skippedCount: skippedCount || 0,
        message: message || "",
        finishedAt: new Date(),
      },
      { new: true }
    );
    if (!run) return res.status(404).json({ message: "Run not found." });
    res.json(run);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};