"use strict";

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const FY = /^(\d{4})-(\d{2})$/;

function parseIsoDate(value) {
  const match = typeof value === "string" ? ISO_DATE.exec(value) : null;
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    return null;
  }
  return value;
}

function fyOf(isoDate) {
  if (!parseIsoDate(isoDate)) throw new TypeError(`Invalid date: ${isoDate}`);
  const year = Number(isoDate.slice(0, 4));
  const month = Number(isoDate.slice(5, 7));
  const start = month >= 4 ? year : year - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

function fyBounds(fy) {
  const match = FY.exec(String(fy));
  if (!match) throw new TypeError(`Invalid financial year: ${fy}`);
  const start = Number(match[1]);
  if (Number(match[2]) !== (start + 1) % 100) throw new RangeError(`Invalid financial year: ${fy}`);
  return { start: `${start}-04-01`, end: `${start + 1}-03-31` };
}

// Returns the FY `years` before (negative) or after (positive) `fy`, e.g. shiftFy("2025-26", -1) is "2024-25".
function shiftFy(fy, years) {
  const start = Number(fyBounds(fy).start.slice(0, 4)) + years;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

function isDateInFy(isoDate, fy) {
  if (!parseIsoDate(isoDate)) throw new TypeError(`Invalid date: ${isoDate}`);
  const { start, end } = fyBounds(fy);
  return isoDate >= start && isoDate <= end;
}

// Period `from` and `to` are both inclusive, matching capitalGains.periods in the rules files.
function findPeriod(periods, isoDate) {
  return periods.find((p) => p.from <= isoDate && (p.to === null || isoDate <= p.to)) || null;
}

module.exports = {
  parseIsoDate,
  fyOf,
  fyBounds,
  shiftFy,
  isDateInFy,
  findPeriod,
};
