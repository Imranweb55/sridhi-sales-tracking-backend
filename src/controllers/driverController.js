// FILE: src/controllers/driverController.js
// ADDED: moveToPorter, getPorterDeliveries, getTodayDeliveries returns section info

const jwt      = require("jsonwebtoken");
const User     = require("../models/User");
const Delivery = require("../models/Delivery");

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// Server-side price/GST recalculation — never trusts numbers sent from the
// browser. Re-derives subtotal/GST/totalAmount from quantity + pricePerKg
// every time, so a tampered or stale frontend calculation can never be saved.
//
// IMPORTANT: `totalAmount` (the pre-existing field used everywhere else in
// the app — customer running totals, sales reports, payment collection,
// and the invoice line-item amount) is always the PRE-GST subtotal. GST for
// an actual invoice document is applied separately, at download time, by
// the existing invoiceService (With GST / Without GST buttons). Storing a
// GST-inclusive number here would silently double-charge GST on invoices.
// gstEnabled/gstPercentage/gstAmount are saved purely as a record of what
// the admin previewed on the Assign Delivery screen.
function computeDeliveryPricing(body, existing = {}) {
  const quantity = body.quantity !== undefined ? Number(body.quantity) : Number(existing.quantity);
  if (!quantity || quantity <= 0) {
    const err = new Error("Quantity must be greater than 0.");
    err.statusCode = 400;
    throw err;
  }

  let pricePerKg = body.pricePerKg !== undefined ? Number(body.pricePerKg) : existing.pricePerKg;
  // Backward compatibility: older callers (or the mobile app) may still
  // send a plain totalAmount with no pricePerKg — derive one so the field
  // is always populated, without forcing every caller to change.
  if ((pricePerKg === undefined || pricePerKg === null || isNaN(pricePerKg)) && body.totalAmount !== undefined) {
    pricePerKg = quantity > 0 ? round2(Number(body.totalAmount) / quantity) : 0;
  }
  pricePerKg = round2(pricePerKg || 0);
  if (pricePerKg < 0) {
    const err = new Error("Price per KG cannot be negative.");
    err.statusCode = 400;
    throw err;
  }

  const gstEnabled = body.gstEnabled !== undefined ? Boolean(body.gstEnabled) : Boolean(existing.gstEnabled);
  const gstPercentage = gstEnabled ? 5 : 0;

  const subtotal = round2(quantity * pricePerKg);
  const gstAmount = round2((subtotal * gstPercentage) / 100);

  return {
    quantity, pricePerKg, subtotal, gstEnabled, gstPercentage, gstAmount,
    totalAmount: subtotal, // pre-GST, matches existing field semantics app-wide
  };
}

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || "90d" });

exports.driverLogin = async (req, res) => {
  try {
    const { mobile, password } = req.body;
    if (!mobile || !password) return res.status(400).json({ message: "Mobile and password required" });
    const driver = await User.findOne({ mobile, role: "driver" }).select("+password");
    if (!driver) return res.status(401).json({ message: "Driver account not found" });
    const ok = await driver.matchPassword(password);
    if (!ok) return res.status(401).json({ message: "Incorrect password" });
    res.json({
      token: signToken(driver._id),
      driver: { _id: driver._id, name: driver.name, mobile: driver.mobile,
                employeeId: driver.employeeId, role: driver.role, photo: driver.photo },
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getMe = async (req, res) => {
  try {
    const driver = await User.findById(req.user._id).select("-password");
    res.json({ driver });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── TODAY'S DELIVERIES (section: "delivery" only) ──────────
exports.getTodayDeliveries = async (req, res) => {
  try {
    const today = new Date(); today.setHours(0,0,0,0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate()+1);
    const deliveries = await Delivery.find({
      driver: req.user._id,
      deliveryDate: { $gte: today, $lt: tomorrow },
      section: "delivery", // only main delivery section
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

// ── PORTER DELIVERIES (GET /api/driver/deliveries/porter) ───
// Deliveries driver moved to porter section today
exports.getPorterDeliveries = async (req, res) => {
  try {
    const today = new Date(); today.setHours(0,0,0,0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate()+1);
    const deliveries = await Delivery.find({
      driver: req.user._id,
      deliveryDate: { $gte: today, $lt: tomorrow },
      section: "porter",
    }).sort({ updatedAt: -1 });
    res.json({ deliveries });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── MOVE TO PORTER (PUT /api/driver/deliveries/:id/porter) ──
// Driver moves a delivery to porter section
exports.moveToPorter = async (req, res) => {
  try {
    const delivery = await Delivery.findOne({ _id: req.params.id, driver: req.user._id });
    if (!delivery) return res.status(404).json({ message: "Delivery not found" });
    delivery.section    = "porter";
    delivery.porterNote = req.body.note || "Moved to porter by driver";
    await delivery.save();
    res.json({ delivery, message: "Moved to porter section" });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// ── MOVE BACK TO DELIVERY (PUT /api/driver/deliveries/:id/unporter) ─
exports.moveToDelivery = async (req, res) => {
  try {
    const delivery = await Delivery.findOne({ _id: req.params.id, driver: req.user._id });
    if (!delivery) return res.status(404).json({ message: "Not found" });
    delivery.section    = "delivery";
    delivery.porterNote = "";
    await delivery.save();
    res.json({ delivery });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

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

// ════ ADMIN APIs ════════════════════════════════════════════

exports.getAllDrivers = async (req, res) => {
  try {
    const drivers = await User.find({ role: "driver" }).select("-password").sort({ name: 1 });
    res.json({ drivers });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.createDriver = async (req, res) => {
  try {
    const { name, mobile, password } = req.body;
    if (!name||!mobile||!password) return res.status(400).json({ message: "Name, mobile and password required." });
    if (password.length<6) return res.status(400).json({ message: "Password min 6 chars." });
    const exists = await User.findOne({ mobile });
    if (exists) return res.status(400).json({ message: "Mobile already registered." });
    const count  = await User.countDocuments({ role: "driver" });
    const driver = await User.create({ name:name.trim(), mobile:mobile.trim(), password, role:"driver", employeeId:`DRV${String(count+1).padStart(3,"0")}` });
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

// NEW — sets the route/area label for a driver (e.g. "Ambattur Route").
// Used only to group/label sections on the Daily Order Sheet PDF; doesn't
// touch delivery assignment, auth, or anything else.
exports.updateDriverRoute = async (req, res) => {
  try {
    const { route } = req.body;
    const driver = await User.findByIdAndUpdate(
      req.params.id,
      { route: (route || "").trim() },
      { new: true }
    ).select("-password");
    if (!driver) return res.status(404).json({ message: "Driver not found" });
    res.json({ driver });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getAllDeliveries = async (req, res) => {
  try {
    const { date, section } = req.query;
    const d = date ? new Date(date) : new Date(); d.setHours(0,0,0,0);
    const next = new Date(d); next.setDate(next.getDate()+1);
    const filter = { deliveryDate: { $gte: d, $lt: next } };
    if (section) filter.section = section;
    const deliveries = await Delivery.find(filter)
      .populate("driver","name employeeId mobile photo")
      .sort({ sortOrder: 1, createdAt: 1 });
    res.json({ deliveries });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.getDriverDeliveries = async (req, res) => {
  try {
    const { date, section } = req.query;
    const d = date ? new Date(date) : new Date(); d.setHours(0,0,0,0);
    const next = new Date(d); next.setDate(next.getDate()+1);
    const filter = { driver: req.params.id, deliveryDate: { $gte: d, $lt: next } };
    if (section) filter.section = section;
    const deliveries = await Delivery.find(filter).sort({ sortOrder: 1, createdAt: 1 });
    res.json({ deliveries });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.searchShops = async (req, res) => {
  try {
    const q     = req.query.q || "";
    const match = q.trim() ? { shopName: new RegExp(q.trim(),"i") } : {};
    const shops = await Delivery.aggregate([
      { $match: match },
      { $sort: { createdAt: -1 } },
      { $group: { _id:"$shopName", shopName:{$first:"$shopName"}, ownerName:{$first:"$ownerName"},
          phone:{$first:"$phone"}, address:{$first:"$address"}, latitude:{$first:"$latitude"},
          longitude:{$first:"$longitude"}, productName:{$first:"$productName"},
          totalAmount:{$first:"$totalAmount"}, lastDelivery:{$first:"$createdAt"} } },
      { $sort: { lastDelivery: -1 } }, { $limit: 8 },
    ]);
    res.json({ shops });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

exports.createDelivery = async (req, res) => {
  try {
    const pricing = computeDeliveryPricing(req.body);
    const delivery = await Delivery.create({
      ...req.body,
      ...pricing, // server-recomputed quantity/pricePerKg/subtotal/gst*/totalAmount always win
      deliveryDate: req.body.deliveryDate ? new Date(req.body.deliveryDate) : new Date(),
    });
    res.status(201).json({ delivery });
  } catch (err) {
    res.status(err.statusCode || 400).json({ message: err.message });
  }
};

exports.updateDelivery = async (req, res) => {
  try {
    const existing = await Delivery.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    const pricing = computeDeliveryPricing(req.body, existing);
    const delivery = await Delivery.findByIdAndUpdate(
      req.params.id,
      { ...req.body, ...pricing },
      { new: true }
    );
    res.json({ delivery });
  } catch (err) {
    res.status(err.statusCode || 500).json({ message: err.message });
  }
};

exports.deleteDelivery = async (req, res) => {
  try {
    await Delivery.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
  } catch (err) { res.status(500).json({ message: err.message }); }
};