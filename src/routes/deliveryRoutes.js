// FILE: src/routes/deliveryRoutes.js
// NEW FILE — Feature: real-time distributor workflow.
// Mounted at /api/deliveries in server.js (additive).
const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/deliveryController");
const { protectDistributor, protectAdmin } = require("../middleware/auth");

// ── Distributor app (Distributors-PWA-App) ──
router.post("/", protectDistributor, ctrl.submitDeliveries);
router.get("/mine", protectDistributor, ctrl.getMyDeliveries);
router.get("/mine/summary", protectDistributor, ctrl.getMySummary);
router.get("/mine/ledger", protectDistributor, ctrl.getMyLedger);

// ── Admin monitoring ──
router.get("/admin", protectAdmin, ctrl.getAdminDeliveries);
router.get("/admin/summary", protectAdmin, ctrl.getAdminSummary);

module.exports = router;