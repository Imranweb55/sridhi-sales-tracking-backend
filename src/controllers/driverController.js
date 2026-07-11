// FILE: src/controllers/driverController.js
const jwt      = require("jsonwebtoken");
const User     = require("../models/User");
const Delivery = require("../models/Delivery");
// NEW (additive): powers the "Customers" tab (feature 2). Only used inside
// createDelivery below (an admin-only endpoint) — the mobile app's own
// endpoints (driverLogin, getMe, getTodayDeliveries, completeDelivery,
// skipDelivery) are untouched.
const { upsertFromDelivery } = require("./customerController");

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || "90d" });

// ── DRIVER LOGIN ────────────────────────────────────────────
exports.driverLogin = async (req, res) => {
  try {
    const { mobile, password } = req.body;
    if (!mobile || !password)
      return res.status(400).json({ message: "Mobile and password required" });
    const driver = await User.findOne({ mobile, role: "driver" }).select("+password");
    if (!driver) return res.status(401).json({ message: "Driver account not found" });
    const ok = await driver.matchPassword(password);
    if (!ok) return res.status(401).json({ message: "Incorrect password" });
    res.json({
      token:  signToken(driver._id),
      driver: { _id: driver._id, name: driver.name, mobile: driver.mobile,
                employeeId: driver.employeeId, role: driver.role, photo: driver.photo },
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── DRIVER ME ───────────────────────────────────────────────
exports.getMe = async (req, res) => {
  try {
    const driver = await User.findById(req.user._id).select("-password");
    res.json({ driver });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── TODAY'S DELIVERIES ──────────────────────────────────────
exports.getTodayDeliveries = async (req, res) => {
  try {
    const today    = new Date(); today.setHours(0,0,0,0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate()+1);
    const deliveries = await Delivery.find({
      driver: req.user._id,
      deliveryDate: { $gte: today, $lt: tomorrow },
    }).sort({ sortOrder: 1, createdAt: 1 });
    const summary = {
      total:     deliveries.length,
      completed: deliveries.filter(d => d.status==="completed").length,
      pending:   deliveries.filter(d => d.status==="pending").length,
      totalKg:   deliveries.reduce((s,d) => s+d.quantity, 0),
      totalAmt:  deliveries.reduce((s,d) => s+d.totalAmount, 0),
      collected: deliveries.reduce((s,d) => s+(d.amountReceived||0), 0),
    };
    res.json({ deliveries, summary });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── COMPLETE DELIVERY ───────────────────────────────────────
exports.completeDelivery = async (req, res) => {
  try {
    const { amountReceived, paymentType, pendingAmount, notes } = req.body;
    const delivery = await Delivery.findOne({ _id: req.params.id, driver: req.user._id });
    if (!delivery) return res.status(404).json({ message: "Delivery not found" });
    Object.assign(delivery, {
      status: "completed", amountReceived: amountReceived||0,
      paymentType: paymentType||"cash", pendingAmount: pendingAmount||0,
      notes: notes||"", completedAt: new Date(),
    });
    await delivery.save();
    res.json({ delivery });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── SKIP DELIVERY ───────────────────────────────────────────
exports.skipDelivery = async (req, res) => {
  try {
    const delivery = await Delivery.findOne({ _id: req.params.id, driver: req.user._id });
    if (!delivery) return res.status(404).json({ message: "Delivery not found" });
    delivery.status = "skipped";
    delivery.notes  = req.body.notes || "Skipped";
    await delivery.save();
    res.json({ delivery });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ════════════════════════════════════════════════════════════
// ADMIN routes
// ════════════════════════════════════════════════════════════

exports.getAllDrivers = async (req, res) => {
  try {
    const drivers = await User.find({ role: "driver" }).select("-password").sort({ name: 1 });
    res.json({ drivers });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.createDriver = async (req, res) => {
  try {
    const { name, mobile, password } = req.body;
    if (!name || !mobile || !password)
      return res.status(400).json({ message: "Name, mobile and password required." });
    if (password.length < 6)
      return res.status(400).json({ message: "Password must be at least 6 characters." });
    const exists = await User.findOne({ mobile });
    if (exists) return res.status(400).json({ message: "Mobile number already registered." });
    const count  = await User.countDocuments({ role: "driver" });
    const empId  = `DRV${String(count + 1).padStart(3, "0")}`;
    const driver = await User.create({ name: name.trim(), mobile: mobile.trim(), password, role: "driver", employeeId: empId });
    const safe   = await User.findById(driver._id).select("-password");
    res.status(201).json({ driver: safe });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.deleteDriver = async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "Driver deleted." });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getAllDeliveries = async (req, res) => {
  try {
    const { date } = req.query;
    const d = date ? new Date(date) : new Date(); d.setHours(0,0,0,0);
    const next = new Date(d); next.setDate(next.getDate()+1);
    const deliveries = await Delivery.find({ deliveryDate: { $gte: d, $lt: next } })
      .populate("driver","name employeeId mobile photo")
      .sort({ sortOrder: 1, createdAt: 1 });
    res.json({ deliveries });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getDriverDeliveries = async (req, res) => {
  try {
    const { date } = req.query;
    const d = date ? new Date(date) : new Date(); d.setHours(0,0,0,0);
    const next = new Date(d); next.setDate(next.getDate()+1);
    const deliveries = await Delivery.find({
      driver: req.params.id, deliveryDate: { $gte: d, $lt: next },
    }).sort({ sortOrder: 1, createdAt: 1 });
    res.json({ deliveries });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── SEARCH SHOPS FROM HISTORY ───────────────────────────────
// GET /api/driver/admin/shops?q=anna
// Returns distinct shops from past deliveries.
// First time: new shop → manual entry + map pin.
// Next time: type name → this returns the saved shop → click → all fields auto-filled.
exports.searchShops = async (req, res) => {
  try {
    const q     = req.query.q || "";
    const match = q.trim() ? { shopName: new RegExp(q.trim(), "i") } : {};
    const shops = await Delivery.aggregate([
      { $match: match },
      { $sort:  { createdAt: -1 } },
      { $group: {
          _id:         "$shopName",
          shopName:    { $first: "$shopName" },
          ownerName:   { $first: "$ownerName" },
          phone:       { $first: "$phone" },
          address:     { $first: "$address" },
          latitude:    { $first: "$latitude" },
          longitude:   { $first: "$longitude" },
          productName: { $first: "$productName" },
          totalAmount: { $first: "$totalAmount" },
          lastDelivery:{ $first: "$createdAt" },
        }
      },
      { $sort:  { lastDelivery: -1 } },
      { $limit: 8 },
    ]);
    res.json({ shops });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.createDelivery = async (req, res) => {
  try {
    const delivery = await Delivery.create({
      ...req.body,
      deliveryDate: req.body.deliveryDate ? new Date(req.body.deliveryDate) : new Date(),
    });
    // NEW (additive, feature 2): auto-add/update this shop's phone number in
    // the Customers directory. If the phone already exists there, this just
    // updates the running kg/order totals — it never creates a duplicate
    // customer row. Wrapped so a Customer-tracking issue can never break the
    // delivery response (same status code / same JSON shape as before).
    upsertFromDelivery(delivery).catch((err) =>
      console.error("Customer directory update failed:", err.message)
    );
    res.status(201).json({ delivery });
  } catch (err) { res.status(400).json({ message: err.message }); }
};

exports.updateDelivery = async (req, res) => {
  try {
    const delivery = await Delivery.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!delivery) return res.status(404).json({ message: "Not found" });
    res.json({ delivery });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.deleteDelivery = async (req, res) => {
  try {
    await Delivery.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
  } catch (err) { res.status(500).json({ message: err.message }); }
};