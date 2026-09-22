// FILE: src/routes/batterRequestRoutes.js
// NEW FILE — Feature: Distributors module — "Daily Requirement"
// Mounted at /api/batter-requests in server.js (additive).
const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/batterRequestController");
const { protectDistributor, protectAdmin } = require("../middleware/auth");

// ── Distributor app (Distributors-PWA-App) ──
router.post("/", protectDistributor, ctrl.createOrUpdateMyRequest);
router.get("/mine", protectDistributor, ctrl.getMyRequests);

// ── Admin — "Daily Requirement" sidebar tab ──
router.get("/admin", protectAdmin, ctrl.getAllRequests);
router.put("/admin/:id/approve", protectAdmin, ctrl.approveRequest);
router.put("/admin/:id/reject", protectAdmin, ctrl.rejectRequest);

module.exports = router;