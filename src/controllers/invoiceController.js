// FILE: src/controllers/invoiceController.js
// PURPOSE: HTTP layer for invoice generation. Thin — all PDF logic lives
// in services/invoiceService.js so it stays reusable/testable.

const Delivery = require("../models/Delivery");
const { generateInvoicePdf } = require("../services/invoiceService");

// GET /api/invoice/:deliveryId?type=with-gst|without-gst
exports.downloadInvoice = async (req, res) => {
  try {
    const { deliveryId } = req.params;
    const { type } = req.query;

    if (!type || !["with-gst", "without-gst"].includes(type)) {
      return res.status(400).json({ message: "Query param 'type' must be 'with-gst' or 'without-gst'." });
    }

    // A driver (non-admin caller) may only download invoices for their own
    // deliveries. Admins can download any delivery's invoice.
    if (req.user && !req.admin) {
      const owned = await Delivery.exists({ _id: deliveryId, driver: req.user._id });
      if (!owned) return res.status(404).json({ message: "Delivery not found" });
    }

    const { buffer, invoiceNo } = await generateInvoicePdf(deliveryId, type);

    const filename = `${invoiceNo.replace(/\//g, "-")}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", buffer.length);
    return res.send(buffer);
  } catch (err) {
    console.error("Invoice generation error:", err.message);
    const status = err.statusCode || 500;
    const message =
      status === 404 ? "Delivery not found" :
      status === 400 ? err.message :
      "Failed to generate invoice. Please try again.";
    return res.status(status).json({ message });
  }
};