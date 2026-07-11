// FILE: src/controllers/driverLeadController.js
// NEW FILE — Feature 1: "Drivers List" (backup driver leads)
// Plain CRUD for admin only. Nothing here is called by the mobile app.
const DriverLead = require("../models/DriverLead");

// GET /api/admin/driver-leads
exports.getAll = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = status ? { status } : {};
    const leads = await DriverLead.find(filter).sort({ createdAt: -1 });
    res.json({ leads });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// GET /api/admin/driver-leads/:id
exports.getOne = async (req, res) => {
  try {
    const lead = await DriverLead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: "Lead not found" });
    res.json({ lead });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// POST /api/admin/driver-leads
exports.create = async (req, res) => {
  try {
    const { name, mobile } = req.body;
    if (!name || !mobile)
      return res.status(400).json({ message: "Name and mobile are required." });
    const lead = await DriverLead.create({
      name: name.trim(),
      mobile: mobile.trim(),
      altMobile: req.body.altMobile?.trim(),
      area: req.body.area?.trim(),
      vehicleType: req.body.vehicleType || "bike",
      experience: req.body.experience?.trim(),
      licenseAvailable: !!req.body.licenseAvailable,
      expectedSalary: req.body.expectedSalary ? Number(req.body.expectedSalary) : undefined,
      status: req.body.status || "available",
      notes: req.body.notes?.trim(),
      source: req.body.source?.trim(),
    });
    res.status(201).json({ lead });
  } catch (err) { res.status(400).json({ message: err.message }); }
};

// PUT /api/admin/driver-leads/:id
exports.update = async (req, res) => {
  try {
    const lead = await DriverLead.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!lead) return res.status(404).json({ message: "Lead not found" });
    res.json({ lead });
  } catch (err) { res.status(400).json({ message: err.message }); }
};

// DELETE /api/admin/driver-leads/:id
exports.remove = async (req, res) => {
  try {
    await DriverLead.findByIdAndDelete(req.params.id);
    res.json({ message: "Lead deleted." });
  } catch (err) { res.status(500).json({ message: err.message }); }
};