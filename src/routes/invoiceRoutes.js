// FILE: src/routes/invoiceRoutes.js
const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/invoiceController");
const { protectAny } = require("../middleware/auth");

// GET /api/invoice/:deliveryId?type=with-gst|without-gst
// Usable by both the driver app and the admin dashboard.
router.get("/:deliveryId", protectAny, ctrl.downloadInvoice);

module.exports = router;