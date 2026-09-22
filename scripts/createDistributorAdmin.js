// FILE: scripts/createDistributorAdmin.js
// NEW FILE — Feature: two Admin Dashboard login types.
// PURPOSE: There is no public "sign up" endpoint for Admin accounts (by
// design — admins are created deliberately, not self-registered). This
// script creates ONE real, working "Distributors" admin login, using
// the exact same Admin model + password hashing as every other admin —
// it does NOT add any new route or change adminController.js /
// adminRoutes.js in any way. It only reuses the existing `role` field on
// the Admin model (which the login API already returns — no backend
// change needed there either).
//
// HOW TO USE — set a REAL password before running this:
//   1. Open this file and change ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME
//      below to whatever you want this distributor-admin's real login to be.
//   2. From the backend project root, run:
//        node scripts/createDistributorAdmin.js
//   3. You'll see "✅ Distributor admin created" with the email you chose.
//      Log into the Admin Dashboard with that email/password and select
//      the "Distributors" tab on the login screen.
//   4. You can delete/re-run this script any time to create more
//      distributor-admin accounts — it's just a one-off tool, not part
//      of the running server.
require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../src/config/db");
const Admin = require("../src/models/Admin");

// ── EDIT THESE 3 LINES BEFORE RUNNING ──
const ADMIN_NAME     = "Sridhi Distributors Admin";
const ADMIN_EMAIL    = "sridhdistributors@admin.com";
const ADMIN_PASSWORD = "sridhi@123"; // real password — hashed automatically by the Admin model
// ────────────────────────────────────────

(async () => {
  await connectDB();

  const existing = await Admin.findOne({ email: ADMIN_EMAIL });
  if (existing) {
    existing.role = "distributor_admin";
    if (ADMIN_PASSWORD) existing.password = ADMIN_PASSWORD; // triggers re-hash via pre-save hook
    await existing.save();
    console.log(`✅ Existing admin "${ADMIN_EMAIL}" updated to role "distributor_admin".`);
  } else {
    await Admin.create({
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD, // hashed automatically by Admin.js's pre("save") hook
      role: "distributor_admin",
    });
    console.log(`✅ Distributor admin created: ${ADMIN_EMAIL}`);
  }

  await mongoose.disconnect();
  process.exit(0);
})().catch((err) => {
  console.error("❌ Failed to create distributor admin:", err.message);
  process.exit(1);
});