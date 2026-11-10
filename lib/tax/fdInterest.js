"use strict";

const { parseIsoDate, fyBounds } = require("./dates");

const DAY_MS = 86400000;

function requireDate(value, name) {
  if (!parseIsoDate(value)) throw new TypeError(`${name} must be an ISO date (YYYY-MM-DD): ${value}`);
  return value;
}

function toDayNumber(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
}

function addDays(iso, days) {
  return new Date((toDayNumber(iso) + days) * DAY_MS).toISOString().slice(0, 10);
}

// EDATE semantics: the day is clamped to the end of the target month.
function edate(iso, months) {
  const [y, m, d] = iso.split("-").map(Number);
  const total = m - 1 + months;
  const year = y + Math.floor(total / 12);
  const monthIndex = ((total % 12) + 12) % 12;
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, monthIndex, Math.min(d, daysInMonth))).toISOString().slice(0, 10);
}

function wholeMonths(start, iso) {
  const [sy, sm] = start.split("-").map(Number);
  const [ty, tm] = iso.split("-").map(Number);
  let months = (ty - sy) * 12 + (tm - sm);
  while (months > 0 && edate(start, months) > iso) months -= 1;
  return Math.max(0, months);
}

// Cumulative value V(t): whole quarters compound, the part-quarter earns simple interest.
function cumulativeValue(principal, ratePct, start, iso) {
  if (iso <= start) return principal;
  const rate = ratePct / 100;
  const quarters = Math.floor(wholeMonths(start, iso) / 3);
  const anchor = edate(start, 3 * quarters);
  const partDays = toDayNumber(iso) - toDayNumber(anchor);
  return principal * Math.pow(1 + rate / 4, quarters) * (1 + (rate * partDays) / 365);
}

function round2(value) {
  return Math.round(value * 100) / 100;
}

function normalise(input) {
  const { principal, ratePct, startDate, maturityDate = null, type } = input;
  if (!Number.isFinite(principal) || principal < 0) throw new TypeError("principal must be a non-negative number");
  if (!Number.isFinite(ratePct) || ratePct < 0) throw new TypeError("ratePct must be a non-negative number");
  if (type !== "cumulative" && type !== "payout") throw new TypeError("type must be 'cumulative' or 'payout'");
  requireDate(startDate, "startDate");
  if (maturityDate !== null) requireDate(maturityDate, "maturityDate");
  return { principal, ratePct, startDate, maturityDate, type };
}

function accruedAmount(fd, asOf) {
  const days = toDayNumber(asOf) - toDayNumber(fd.startDate);
  if (fd.type === "payout") return (fd.principal * (fd.ratePct / 100) * days) / 365;
  return cumulativeValue(fd.principal, fd.ratePct, fd.startDate, asOf) - fd.principal;
}

/**
 * Interest earned by an FD within a financial year.
 * The window is [windowStart, windowEnd): windowEnd is exclusive (the day after FY end, or maturity if earlier).
 */
function fdInterestForFy(input) {
  const { fy } = input;
  const fd = normalise(input);
  const { start: fyStart, end: fyEnd } = fyBounds(fy);
  const fyEndExclusive = addDays(fyEnd, 1);

  const windowStart = fd.startDate > fyStart ? fd.startDate : fyStart;
  let windowEnd = fyEndExclusive;
  if (fd.maturityDate !== null && fd.maturityDate < windowEnd) windowEnd = fd.maturityDate;

  const daysInFy = Math.max(0, toDayNumber(windowEnd) - toDayNumber(windowStart));
  if (daysInFy === 0) return { fy, windowStart, windowEnd: windowStart, daysInFy: 0, interest: 0 };

  const interest =
    fd.type === "payout"
      ? (fd.principal * (fd.ratePct / 100) * daysInFy) / 365
      : cumulativeValue(fd.principal, fd.ratePct, fd.startDate, windowEnd) -
        cumulativeValue(fd.principal, fd.ratePct, fd.startDate, windowStart);

  return { fy, windowStart, windowEnd, daysInFy, interest: round2(interest) };
}

/**
 * Interest accrued from the FD start up to `asOf` (what a bank statement shows), independent of any FY.
 * Payout FDs use simple interest from the start date; payouts already made are not deducted.
 */
function fdAccruedTo(input) {
  const fd = normalise(input);
  requireDate(input.asOf, "asOf");
  let asOf = input.asOf;
  if (fd.maturityDate !== null && asOf > fd.maturityDate) asOf = fd.maturityDate;
  if (asOf <= fd.startDate) return { asOf: input.asOf, accruedInterest: 0 };
  return { asOf: input.asOf, accruedInterest: round2(accruedAmount(fd, asOf)) };
}

module.exports = {
  fdInterestForFy,
  fdAccruedTo,
};
