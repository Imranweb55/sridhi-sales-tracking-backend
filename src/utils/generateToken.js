// FILE: src/utils/generateToken.js
// PURPOSE: Create JWT tokens for employee and admin login

const jwt = require("jsonwebtoken");

// For employee (PWA login)
const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || "7d" });

// For admin (Admin Dashboard login)
const generateAdminToken = (id) =>
  jwt.sign({ id }, process.env.ADMIN_JWT_SECRET, { expiresIn: process.env.ADMIN_JWT_EXPIRE || "1d" });

// NEW — Feature: Distributors module. For distributor (Distributors-PWA-App
// login). Uses its own secret so it never overlaps with the driver or
// admin tokens above.
const generateDistributorToken = (id) =>
  jwt.sign({ id }, process.env.DISTRIBUTOR_JWT_SECRET, {
    expiresIn: process.env.DISTRIBUTOR_JWT_EXPIRE || "30d",
  });

module.exports = { generateToken, generateAdminToken, generateDistributorToken };