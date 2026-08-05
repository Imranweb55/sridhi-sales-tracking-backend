// FILE: src/routes/driverRoutes.js
const express = require("express");
const router  = express.Router();
const ctrl    = require("../controllers/driverController");
const { protect, protectAdmin } = require("../middleware/auth");

// Public
router.post("/auth/login", ctrl.driverLogin);

// Driver app
router.get("/me",                           protect, ctrl.getMe);
router.get("/deliveries/today",             protect, ctrl.getTodayDeliveries);
router.get("/deliveries/porter",            protect, ctrl.getPorterDeliveries);
router.put("/deliveries/:id/complete",      protect, ctrl.completeDelivery);
router.put("/deliveries/:id/skip",          protect, ctrl.skipDelivery);
router.put("/deliveries/:id/porter",        protect, ctrl.moveToPorter);
router.put("/deliveries/:id/unporter",      protect, ctrl.moveToDelivery);

// Admin
router.get("/admin/shops",                  protectAdmin, ctrl.searchShops);
router.get("/admin/drivers",                protectAdmin, ctrl.getAllDrivers);
router.post("/admin/drivers",               protectAdmin, ctrl.createDriver);
router.delete("/admin/drivers/:id",         protectAdmin, ctrl.deleteDriver);
router.get("/admin/drivers/:id/deliveries", protectAdmin, ctrl.getDriverDeliveries);
router.get("/admin/deliveries",             protectAdmin, ctrl.getAllDeliveries);
router.post("/admin/deliveries",            protectAdmin, ctrl.createDelivery);
router.put("/admin/deliveries/:id",         protectAdmin, ctrl.updateDelivery);
router.delete("/admin/deliveries/:id",      protectAdmin, ctrl.deleteDelivery);

module.exports = router;