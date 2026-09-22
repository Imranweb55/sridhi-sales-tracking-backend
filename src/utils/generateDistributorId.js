// FILE: src/utils/generateDistributorId.js
// NEW FILE — Feature: Distributors module
// PURPOSE: Auto-generate a distributor login ID, same idea as
// generateEmployeeId.js (which is left untouched) but with a DIST prefix
// so distributor IDs are never confused with driver/employee IDs.
const generateDistributorId = (name, existingCount = 0) => {
  const initials = name
    .trim()
    .split(" ")
    .map((n) => n[0]?.toUpperCase() || "")
    .join("");
  const seq = String(existingCount + 1).padStart(3, "0");
  return `DIST${initials}${seq}`;
};

module.exports = generateDistributorId;