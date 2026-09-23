// FILE: src/utils/generateRandomPassword.js
// NEW FILE — Feature: real-time distributor workflow. Generates a real,
// random password (not a predictable "<id>@123" pattern) for a new
// distributor login, shown once to the admin on the Add Distributor
// screen so they can hand it to the distributor.
const generateRandomPassword = (length = 8) => {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789"; // no confusing 0/O/1/l/I
  let pwd = "";
  for (let i = 0; i < length; i++) {
    pwd += chars[Math.floor(Math.random() * chars.length)];
  }
  return pwd;
};

module.exports = generateRandomPassword;