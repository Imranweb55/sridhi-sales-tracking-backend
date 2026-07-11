// FILE: src/controllers/customerController.js
// NEW FILE — Feature 2: "Customers" directory
const Customer = require("../models/Customer");
const Delivery = require("../models/Delivery");

// ─────────────────────────────────────────────────────────────
// INTERNAL HELPER — called from driverController.createDelivery
// whenever the admin adds a delivery in the Deliveries tab.
// Matches on phone number:
//   - phone NOT found  -> create a new Customer (tag defaults "irregular")
//   - phone IS found   -> do NOT create a duplicate row, just add this
//                         delivery's kg/amount onto the existing totals
// This function never throws to the caller's request/response cycle —
// the caller wraps it and only logs failures, so a Customer-tracking
// problem can never break the (mobile-facing-independent) delivery save.
// ─────────────────────────────────────────────────────────────
exports.upsertFromDelivery = async (delivery) => {
  const phone = (delivery.phone || "").trim();
  if (!phone) return null;

  const existing = await Customer.findOne({ phone });

  if (existing) {
    existing.totalKg     += Number(delivery.quantity) || 0;
    existing.totalOrders += 1;
    existing.totalAmount += Number(delivery.totalAmount) || 0;
    existing.lastDeliveryDate = delivery.deliveryDate || new Date();
    existing.lastDriver   = delivery.driver;
    // Keep the shop/owner/address fresh in case it changed slightly,
    // without touching the tag the admin may have already set.
    if (delivery.shopName)  existing.shopName  = delivery.shopName;
    if (delivery.ownerName) existing.ownerName = delivery.ownerName;
    if (delivery.address)   existing.address   = delivery.address;
    await existing.save();
    return existing;
  }

  return Customer.create({
    shopName:   delivery.shopName,
    ownerName:  delivery.ownerName,
    phone,
    address:    delivery.address,
    tag:        "irregular",
    totalKg:      Number(delivery.quantity) || 0,
    totalOrders:  1,
    totalAmount:  Number(delivery.totalAmount) || 0,
    firstDeliveryDate: delivery.deliveryDate || new Date(),
    lastDeliveryDate:  delivery.deliveryDate || new Date(),
    lastDriver: delivery.driver,
  });
};

// GET /api/admin/customers
// Returns the full customer list plus the headline stats used at the
// top of the Customers tab: total client count and today's kg sold,
// where the kg figure only counts customers tagged "regular".
exports.getCustomers = async (req, res) => {
  try {
    const customers = await Customer.find().sort({ lastDeliveryDate: -1 });

    const regularCustomers = customers.filter(c => c.tag === "regular");
    const regularPhones    = regularCustomers.map(c => c.phone);

    const today    = new Date(); today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);

    const todaysRegularDeliveries = regularPhones.length
      ? await Delivery.find({
          phone: { $in: regularPhones },
          deliveryDate: { $gte: today, $lt: tomorrow },
        })
      : [];

    const stats = {
      totalCustomers:   customers.length,
      regularCount:     regularCustomers.length,
      irregularCount:   customers.length - regularCustomers.length,
      todayKgRegular:   todaysRegularDeliveries.reduce((s, d) => s + (d.quantity || 0), 0),
    };

    res.json({ customers, stats });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// GET /api/admin/customers/:id
// Customer profile + their full delivery history (matched by phone,
// pulled straight from the Delivery collection — no data duplication).
exports.getCustomerById = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ message: "Customer not found" });

    const deliveries = await Delivery.find({ phone: customer.phone })
      .populate("driver", "name employeeId mobile")
      .sort({ deliveryDate: -1, createdAt: -1 });

    res.json({ customer, deliveries });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// PUT /api/admin/customers/:id/tag   { tag: "regular" | "irregular" }
exports.updateCustomerTag = async (req, res) => {
  try {
    const { tag } = req.body;
    if (!["regular", "irregular"].includes(tag))
      return res.status(400).json({ message: "tag must be 'regular' or 'irregular'." });
    const customer = await Customer.findByIdAndUpdate(req.params.id, { tag }, { new: true });
    if (!customer) return res.status(404).json({ message: "Customer not found" });
    res.json({ customer });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// DELETE /api/admin/customers/:id
exports.deleteCustomer = async (req, res) => {
  try {
    await Customer.findByIdAndDelete(req.params.id);
    res.json({ message: "Customer removed." });
  } catch (err) { res.status(500).json({ message: err.message }); }
};