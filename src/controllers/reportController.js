// FILE: src/controllers/reportController.js
// NEW FILE — Feature 3: "Sales Reports" (pie chart + day/month PDF data)
// This controller only returns JSON data. The actual PDF file is generated
// on the frontend with jsPDF (same library already used by ReportsPage.jsx),
// so no new PDF dependency is added to the backend.
const Delivery = require("../models/Delivery");

function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

async function daySummary(dayStart) {
  const dayEnd = addDays(dayStart, 1);
  const deliveries = await Delivery.find({ deliveryDate: { $gte: dayStart, $lt: dayEnd } })
    .populate("driver", "name employeeId");

  const completed = deliveries.filter(d => d.status === "completed");
  const pending    = deliveries.filter(d => d.status === "pending");
  const skipped    = deliveries.filter(d => d.status === "skipped");

  const sumBy = (list, key) => list.reduce((s, d) => s + (Number(d[key]) || 0), 0);

  return {
    deliveries,
    totalKg:        sumBy(completed, "quantity"),        // kg actually sold (delivered)
    totalAssignedKg:sumBy(deliveries, "quantity"),        // kg assigned regardless of outcome
    totalAmount:    sumBy(completed, "totalAmount"),
    cashCollected:  sumBy(completed.filter(d => d.paymentType === "cash"),  "amountReceived"),
    gpayCollected:  sumBy(completed.filter(d => d.paymentType === "gpay"),  "amountReceived"),
    mixedCollected: sumBy(completed.filter(d => d.paymentType === "mixed"), "amountReceived"),
    pendingAmount:  sumBy(deliveries, "pendingAmount"),
    completedCount: completed.length,
    pendingCount:   pending.length,
    skippedCount:   skipped.length,
  };
}

// GET /api/admin/sales-reports/daily?date=YYYY-MM-DD
exports.getDailyReport = async (req, res) => {
  try {
    const day  = req.query.date ? new Date(req.query.date) : new Date();
    const dayStart = startOfDay(day);
    const prevStart = addDays(dayStart, -1);

    const [today, yesterday] = await Promise.all([daySummary(dayStart), daySummary(prevStart)]);

    const changeKg = today.totalKg - yesterday.totalKg;
    const changePercent = yesterday.totalKg > 0
      ? Math.round((changeKg / yesterday.totalKg) * 100)
      : (today.totalKg > 0 ? 100 : 0);

    res.json({
      date: dayStart.toISOString().split("T")[0],
      ...today,
      previousDayKg: yesterday.totalKg,
      changeKg,
      changePercent,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};

// GET /api/admin/sales-reports/monthly?month=YYYY-MM
exports.getMonthlyReport = async (req, res) => {
  try {
    const now = new Date();
    const [y, m] = (req.query.month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`)
      .split("-").map(Number);

    const monthStart = new Date(y, m - 1, 1);
    const monthEnd   = new Date(y, m, 1); // exclusive
    const prevMonthStart = new Date(y, m - 2, 1);
    const prevMonthEnd   = new Date(y, m - 1, 1);

    const [deliveries, prevDeliveries] = await Promise.all([
      Delivery.find({ deliveryDate: { $gte: monthStart, $lt: monthEnd } }).populate("driver", "name employeeId"),
      Delivery.find({ deliveryDate: { $gte: prevMonthStart, $lt: prevMonthEnd } }),
    ]);

    const completed = deliveries.filter(d => d.status === "completed");
    const prevCompleted = prevDeliveries.filter(d => d.status === "completed");
    const sumBy = (list, key) => list.reduce((s, d) => s + (Number(d[key]) || 0), 0);

    // Build per-day kg breakdown for the whole month (only days that have data)
    const byDay = {};
    completed.forEach(d => {
      const key = new Date(d.deliveryDate).toISOString().split("T")[0];
      if (!byDay[key]) byDay[key] = { date: key, kg: 0, amount: 0 };
      byDay[key].kg     += d.quantity || 0;
      byDay[key].amount += d.totalAmount || 0;
    });
    const dailyBreakdown = Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date));

    const totalKg     = sumBy(completed, "quantity");
    const prevTotalKg = sumBy(prevCompleted, "quantity");
    const changeKg = totalKg - prevTotalKg;
    const changePercent = prevTotalKg > 0
      ? Math.round((changeKg / prevTotalKg) * 100)
      : (totalKg > 0 ? 100 : 0);

    res.json({
      month: `${y}-${String(m).padStart(2, "0")}`,
      deliveries,
      dailyBreakdown,
      totalKg,
      totalAmount:    sumBy(completed, "totalAmount"),
      cashCollected:  sumBy(completed.filter(d => d.paymentType === "cash"),  "amountReceived"),
      gpayCollected:  sumBy(completed.filter(d => d.paymentType === "gpay"),  "amountReceived"),
      mixedCollected: sumBy(completed.filter(d => d.paymentType === "mixed"), "amountReceived"),
      pendingAmount:  sumBy(deliveries, "pendingAmount"),
      completedCount: completed.length,
      previousMonthKg: prevTotalKg,
      changeKg,
      changePercent,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
};