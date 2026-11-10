"use strict";

const crypto = require("crypto");
const XLSX = require("xlsx");
const { parse } = require("csv-parse/sync");

const CAPITAL_GAIN_CATEGORIES = ["stcg111A", "ltcg112A", "ltcgOther", "stcgOther"];
const ASSET_CLASSES = ["equity", "debt", "other"];
const MAX_IMPORT_ROWS = 5000;
const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

function sha256(parts) {
  return crypto.createHash("sha256").update(parts.join("|")).digest("hex");
}

// Returns a 2D array of cell values. Blank rows are kept so that index + 1 is the file's row number.
function readRawRows(buffer, ext) {
  if (ext === "csv") {
    return parse(buffer.toString("utf8"), { bom: true, relax_column_count: true, skip_empty_lines: false });
  }
  if (ext === "xlsx" || ext === "xls") {
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!sheet) throw new Error("The workbook has no sheets.");
    return XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "", blankrows: true });
  }
  throw new Error(`Unsupported file type: .${ext}`);
}

function normaliseHeader(value) {
  return String(value ?? "").trim().replace(/[\s_]+/g, " ").toLowerCase();
}

// Finds the header row (within the first 30 rows) that contains every required column.
// Returns records whose `get(header)` takes a header name, matched case-insensitively.
function findTable(rawRows, requiredHeaders) {
  const wanted = requiredHeaders.map(normaliseHeader);
  const headerIndex = rawRows.slice(0, 30).findIndex((row) => {
    const names = new Set(row.map(normaliseHeader));
    return wanted.every((name) => names.has(name));
  });
  if (headerIndex < 0) {
    throw new Error(`Required columns not found: ${requiredHeaders.join(", ")}. Check that this is the expected file.`);
  }
  const headers = rawRows[headerIndex].map(normaliseHeader);
  const records = [];
  rawRows.slice(headerIndex + 1).forEach((cells, offset) => {
    if (cells.every((cell) => String(cell ?? "").trim() === "")) return;
    const values = Object.create(null);
    headers.forEach((name, column) => {
      if (name && !(name in values)) values[name] = cells[column] ?? "";
    });
    records.push({
      line: headerIndex + offset + 2,
      get: (name) => values[normaliseHeader(name)] ?? "",
    });
  });
  if (records.length > MAX_IMPORT_ROWS) {
    throw new Error(`The file has more than ${MAX_IMPORT_ROWS} rows. Split it and import in parts.`);
  }
  return records;
}

function text(value) {
  return String(value ?? "").trim();
}

// Accepts numbers, "1,234.50" and "(123)" for negatives. Returns null when the value is not a number.
function parseAmount(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const raw = text(value);
  if (raw === "") return null;
  const negative = /^\(.*\)$/.test(raw);
  const cleaned = raw.replace(/[(),\s]/g, "");
  if (!/^[-+]?\d*\.?\d+$/.test(cleaned)) return null;
  const number = Number(cleaned);
  return negative ? -Math.abs(number) : number;
}

function isoFromParts(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Returns an ISO date (YYYY-MM-DD) or null. Slash and dash dates are read as day/month/year.
function parseDate(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return isoFromParts(value.getUTCFullYear(), value.getUTCMonth() + 1, value.getUTCDate());
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 1) return null;
    const date = new Date(Math.round((value - 25569) * 86400000));
    return isoFromParts(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  }
  const raw = text(value);
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(raw);
  if (match) return isoFromParts(Number(match[1]), Number(match[2]), Number(match[3]));
  match = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(raw);
  if (match) return isoFromParts(Number(match[3]), Number(match[2]), Number(match[1]));
  match = /^(\d{1,2})[- ]([A-Za-z]{3})[a-z]*[- ,]+(\d{4})$/.exec(raw);
  if (match && MONTHS[match[2].toLowerCase()]) {
    return isoFromParts(Number(match[3]), MONTHS[match[2].toLowerCase()], Number(match[1]));
  }
  return null;
}

function isIsoDate(value) {
  return typeof value === "string" && parseDate(value) === value;
}

module.exports = {
  CAPITAL_GAIN_CATEGORIES,
  ASSET_CLASSES,
  MAX_IMPORT_ROWS,
  sha256,
  readRawRows,
  findTable,
  text,
  parseAmount,
  parseDate,
  isIsoDate,
};
