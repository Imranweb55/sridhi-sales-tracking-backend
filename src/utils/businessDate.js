// FILE: src/utils/businessDate.js
// PURPOSE: All "which day is this order/invoice for" logic goes through
// here. India Standard Time is UTC+5:30, fixed offset (no DST) — so we
// never rely on the server's local timezone (production servers often run
// in UTC), we always compute IST explicitly.

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

// Today's business date as "YYYY-MM-DD", in IST, regardless of server TZ.
function todayIST() {
  const nowIst = new Date(Date.now() + IST_OFFSET_MS);
  return nowIst.toISOString().slice(0, 10);
}

function isValidDateStr(d) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const parsed = new Date(`${d}T00:00:00+05:30`);
  return !isNaN(parsed.getTime());
}

// Returns the [start, end) UTC instant range that corresponds to one full
// IST calendar day — e.g. for "2026-08-11" this is
// 2026-08-10T18:30:00.000Z .. 2026-08-11T18:30:00.000Z, which is exactly
// midnight-to-midnight IST. Use this to query deliveryDate/createdAt so an
// Indian business day is never off-by-one against a UTC-stored Date.
function getISTDayRangeUTC(dateStr) {
  const start = new Date(`${dateStr}T00:00:00+05:30`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

module.exports = { todayIST, isValidDateStr, getISTDayRangeUTC };