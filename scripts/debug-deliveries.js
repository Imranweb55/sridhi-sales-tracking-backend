// Debug script — shows the RAW deliveryDate values stored in MongoDB for a
// driver, with zero query-range logic involved. Use this to tell apart:
//   (a) "server didn't reload the fixed code" vs
//   (b) "the record's deliveryDate was already shifted to the wrong day
//        before the fix was deployed" (caused by the old edit-overwrite bug)
//
// Usage:
//   node scripts/debug-deliveries.js <driverId> [YYYY-MM-DD]
//
// If you omit the date, it just lists every delivery for that driver,
// newest first, so you can see exactly what date each one is really on.

require("dotenv").config();
const mongoose = require("mongoose");
const Delivery = require("../src/models/Delivery");

async function main() {
  const driverId = process.argv[2];
  const dateArg  = process.argv[3];

  if (!driverId) {
    console.error("Usage: node scripts/debug-deliveries.js <driverId> [YYYY-MM-DD]");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to:", mongoose.connection.name);

  const filter = { driver: driverId };
  const all = await Delivery.find(filter).sort({ deliveryDate: -1, createdAt: -1 });

  console.log(`\nTotal deliveries for driver ${driverId}: ${all.length}\n`);
  console.log("shopName".padEnd(28), "section".padEnd(10), "status".padEnd(11), "deliveryDate (raw ISO, UTC)", "  updatedAt");
  console.log("-".repeat(110));
  for (const d of all) {
    console.log(
      String(d.shopName || "").slice(0, 26).padEnd(28),
      String(d.section || "").padEnd(10),
      String(d.status || "").padEnd(11),
      d.deliveryDate ? d.deliveryDate.toISOString() : "null",
      " ", d.updatedAt ? d.updatedAt.toISOString() : "null"
    );
  }

  if (dateArg) {
    const target = new Date(dateArg + "T00:00:00.000Z");
    const matches = all.filter(d => d.deliveryDate && d.deliveryDate.toISOString().slice(0,10) === target.toISOString().slice(0,10));
    console.log(`\nDeliveries whose deliveryDate is exactly ${dateArg} (UTC): ${matches.length}`);
    if (matches.length === 0 && all.length > 0) {
      console.log("^ None matched that exact date. Check the deliveryDate column above —");
      console.log("  if a record you expected on", dateArg, "instead shows a different date,");
      console.log("  it was likely shifted by the old edit-bug before the fix was deployed.");
      console.log("  If NO records exist at all for this driver, this is a data issue, not a query issue.");
    }
  }

  await mongoose.disconnect();
}

main().catch(err => { console.error(err); process.exit(1); });