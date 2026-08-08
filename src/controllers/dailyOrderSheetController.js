// FILE: src/controllers/dailyOrderSheetController.js
// PURPOSE: HTTP layer for the Daily Order Sheet PDF. Thin — all PDF
// building lives in services/dailyOrderSheetService.js.

const { generateDailyOrderSheetPdf } = require("../services/dailyOrderSheetService");

// GET /api/admin/daily-order-sheet?date=YYYY-MM-DD
exports.downloadDailyOrderSheet = async (req, res) => {
  try {
    const { date } = req.query;
    const { buffer, fileDateLabel } = await generateDailyOrderSheetPdf(date);

    const filename = `Daily_Order_Sheet_${fileDateLabel}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Length", buffer.length);
    return res.send(buffer);
  } catch (err) {
    console.error("Daily order sheet generation error:", err.message);
    const status = err.statusCode || 500;
    const message = status === 400 ? err.message : "Failed to generate the daily order sheet. Please try again.";
    return res.status(status).json({ message });
  }
};