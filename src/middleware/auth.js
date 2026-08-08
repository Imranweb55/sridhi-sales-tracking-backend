// FILE: src/middleware/auth.js
// PURPOSE: Protect routes — check JWT token before allowing access
// Used in every protected route

const jwt  = require("jsonwebtoken");
const User  = require("../models/User");
const Admin = require("../models/Admin");

// Protect employee routes (PWA)
exports.protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    }
    if (!token) return res.status(401).json({ message: "Not authorized, no token" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id);
    if (!req.user) return res.status(401).json({ message: "User not found" });

    next();
  } catch {
    res.status(401).json({ message: "Token invalid or expired" });
  }
};

// Protect admin routes (Admin Dashboard)
exports.protectAdmin = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith("Bearer")) {
      token = req.headers.authorization.split(" ")[1];
    }
    if (!token) return res.status(401).json({ message: "Not authorized" });

    const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET);
    req.admin = await Admin.findById(decoded.id);
    if (!req.admin) return res.status(401).json({ message: "Admin not found" });

    next();
  } catch {
    res.status(401).json({ message: "Admin token invalid or expired" });
  }
};

// NEW: Protect routes usable by EITHER a driver (PWA/mobile) or an admin
// (Admin Dashboard) — used for shared endpoints like invoice download,
// where both apps need access with their own token type.
exports.protectAny = async (req, res, next) => {
  let token;
  if (req.headers.authorization?.startsWith("Bearer")) {
    token = req.headers.authorization.split(" ")[1];
  }
  if (!token) return res.status(401).json({ message: "Not authorized, no token" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (user) { req.user = user; return next(); }
  } catch { /* fall through to try admin token */ }

  try {
    const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET);
    const admin = await Admin.findById(decoded.id);
    if (admin) { req.admin = admin; return next(); }
  } catch { /* fall through */ }

  res.status(401).json({ message: "Token invalid or expired" });
};