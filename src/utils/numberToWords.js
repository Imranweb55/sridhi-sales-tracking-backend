// FILE: src/utils/numberToWords.js
// PURPOSE: Convert a rupee amount into the Indian words format used on the
// reference invoice, e.g. 1837.50 -> "INR One Thousand Eight Hundred
// Thirty Seven and Fifty paise Only"

const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen",
  "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n) {
  if (n < 20) return ONES[n];
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? " " + ONES[n % 10] : ""}`;
}

function threeDigits(n) {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  let out = "";
  if (h) out += `${ONES[h]} Hundred${rest ? " " : ""}`;
  if (rest) out += twoDigits(rest);
  return out.trim();
}

// Indian grouping: last 3 digits, then groups of 2 (thousand, lakh, crore)
function integerToWords(num) {
  if (num === 0) return "Zero";
  const crore = Math.floor(num / 10000000); num %= 10000000;
  const lakh = Math.floor(num / 100000); num %= 100000;
  const thousand = Math.floor(num / 1000); num %= 1000;
  const hundred = num;

  let parts = [];
  if (crore) parts.push(`${threeDigits(crore)} Crore`);
  if (lakh) parts.push(`${threeDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${threeDigits(thousand)} Thousand`);
  if (hundred) parts.push(threeDigits(hundred));
  return parts.join(" ").trim();
}

function amountToWords(amount) {
  const rounded = Math.round((Number(amount) || 0) * 100) / 100;
  const rupees = Math.floor(rounded);
  const paise = Math.round((rounded - rupees) * 100);

  let words = `INR ${integerToWords(rupees)}`;
  if (paise > 0) {
    words += ` and ${integerToWords(paise)} paise`;
  }
  words += " Only";
  return words;
}

module.exports = { amountToWords, integerToWords };