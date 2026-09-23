// FILE: src/routes/productRoutes.js
// NEW FILE — Feature: real-time distributor workflow.
// Mounted at /api/products in server.js (additive).
const express = require("express");
const router = express.Router();
const ctrl = require("../controllers/productController");
const { protectAdmin, protectAdminOrDistributor } = require("../middleware/auth");

// Readable by both admin (Products settings page) and distributor (PWA
// batter request screen, to show rates / estimate margin).
router.get("/", protectAdminOrDistributor, ctrl.getProducts);

// Only admin can change rates.
router.put("/admin/:key", protectAdmin, ctrl.updateProduct);

module.exports = router;