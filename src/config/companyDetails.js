// FILE: src/config/companyDetails.js
// PURPOSE: Static seller (company) details used on generated invoice PDFs.
// Pulled from the reference invoice design provided by the client.
// Kept in one place so it can later be swapped for a DB-backed / env-based
// value without touching invoiceService.js.

module.exports = {
  name: "SRIDHI VENTURES",
  addressLines: [
    "No 17/48 Anainagar NRS Road,",
    "Agraharam, Korattur, Chennai - 600076",
    "Tamil Nadu, India",
  ],
  phone: "8925832941",
  email: "sridhiventure@gmail.com",
  gstin: process.env.COMPANY_GSTIN || "33ADOF52540N2ZO",
  stateName: "Tamil Nadu",
  stateCode: "33",
  // GST split used on "With GST" invoices — configurable via env, falls
  // back to the 2.5% + 2.5% (5% total) shown in the reference design.
  cgstPercent: Number(process.env.COMPANY_CGST_PERCENT || 2.5),
  sgstPercent: Number(process.env.COMPANY_SGST_PERCENT || 2.5),
  igstPercent: Number(process.env.COMPANY_IGST_PERCENT || 0),
  // Default HSN/SAC code for our products (batter). Can be overridden per
  // delivery via delivery.hsnCode if that field is ever added.
  defaultHsnCode: "2106",
};