"use strict";

const { isDateInFy } = require("../dates");
const {
  CAPITAL_GAIN_CATEGORIES,
  ASSET_CLASSES,
  sha256,
  readRawRows,
  findTable,
  text,
  parseAmount,
  parseDate,
  isIsoDate,
} = require("./common");

const REQUIRED_COLUMNS = [
  "Folio No", "ASSET CLASS NAME", "Scheme Name", "Date", "Date_1", "Units", "Amount",
  "STT", "Short Term", "Long Term Without Index",
];

// Debt funds bought on or after this date are taxed at slab rates whatever the holding period.
const DEBT_SLAB_TAXATION_FROM = "2023-04-01";

function classifyAsset(assetName) {
  if (/debt/i.test(assetName)) return "debt";
  if (/equity/i.test(assetName)) return "equity";
  return null;
}

function camsFingerprint({ folio, scheme, sale_date, units, sale_value }) {
  return sha256(["cams", folio, scheme, sale_date, units ?? "", sale_value ?? ""]);
}

function mapCamsRecord(record, fy) {
  const errors = [];
  const warnings = [];
  const folio = text(record.get("Folio No"));
  const scheme = text(record.get("Scheme Name"));
  const assetName = text(record.get("ASSET CLASS NAME"));
  const saleDate = parseDate(record.get("Date"));
  const purchaseDate = parseDate(record.get("Date_1"));
  const units = parseAmount(record.get("Units"));
  const saleValue = parseAmount(record.get("Amount"));
  const stt = parseAmount(record.get("STT")) ?? 0;
  const shortTerm = parseAmount(record.get("Short Term"));
  const longTerm = parseAmount(record.get("Long Term Without Index"));

  if (!folio || !scheme) errors.push("Folio or scheme name is missing.");
  if (!saleDate) errors.push("Sale date (Date) is missing or not a date.");
  else if (!isDateInFy(saleDate, fy)) errors.push(`Sale date ${saleDate} is outside FY ${fy}.`);
  if (saleValue === null) errors.push("Amount is missing or not a number.");
  if (purchaseDate && saleDate && purchaseDate > saleDate) errors.push("Purchase date is after the sale date.");

  const hasShort = shortTerm !== null && shortTerm !== 0;
  const hasLong = longTerm !== null && longTerm !== 0;
  if (hasShort && hasLong) errors.push("Both short-term and long-term gain are populated.");
  if (!hasShort && !hasLong) errors.push("No short-term or long-term gain value.");

  const asset = classifyAsset(assetName);
  let needsReview = false;
  if (!asset) {
    needsReview = true;
    warnings.push(`Asset class "${assetName || "blank"}" is unclear; review the category.`);
  }
  if (!purchaseDate) warnings.push("Purchase date (Date_1) is missing.");

  const isShortTerm = hasShort;
  let category;
  if (asset === "debt" && purchaseDate && purchaseDate >= DEBT_SLAB_TAXATION_FROM) {
    category = "stcgOther";
    warnings.push("Debt fund bought on or after 1 Apr 2023: taxed at slab rate.");
  } else if (asset === "debt" && !purchaseDate) {
    needsReview = true;
    warnings.push("Debt fund without a purchase date: the 1 Apr 2023 rule cannot be applied.");
    category = isShortTerm ? "stcgOther" : "ltcgOther";
  } else if (stt > 0) {
    if (asset === "debt") {
      needsReview = true;
      warnings.push("Debt fund shows STT; review the category.");
    }
    category = isShortTerm ? "stcg111A" : "ltcg112A";
  } else {
    category = isShortTerm ? "stcgOther" : "ltcgOther";
  }

  const gain = hasShort ? shortTerm : longTerm ?? 0;
  const hasAmounts = saleValue !== null && Number.isFinite(gain);
  const row = {
    kind: "cams",
    line: record.line,
    folio,
    scheme,
    asset_class: asset ?? "other",
    category,
    description: folio ? `${scheme} (Folio ${folio})` : scheme,
    units,
    sale_date: saleDate,
    purchase_date: purchaseDate,
    sale_value: saleValue,
    gain: hasAmounts ? gain : null,
    cost: hasAmounts ? saleValue - gain : null,
    source: "cams",
    needs_review: needsReview,
    errors,
    warnings,
  };
  row.fingerprint = camsFingerprint(row);
  return row;
}

/** Parses a CAMS/KFintech capital-gains statement (xlsx, xls or csv). Pure: no DB or file dialog. */
function parseCams(buffer, ext, fy) {
  const rawRows = readRawRows(buffer, ext);
  const records = findTable(rawRows, REQUIRED_COLUMNS);
  return records.map((record) => mapCamsRecord(record, fy));
}

/**
 * Checks a capital-gain row that came back from the renderer before it is written.
 * Returns an error message, or null when the row is safe to write.
 */
function validateCapitalGainRow(row, fy) {
  if (!CAPITAL_GAIN_CATEGORIES.includes(row.category)) return "Unknown category.";
  if (!ASSET_CLASSES.includes(row.asset_class)) return "Unknown asset class.";
  if (!isIsoDate(row.sale_date) || !isDateInFy(row.sale_date, fy)) return "Sale date is invalid for this FY.";
  if (row.purchase_date != null && !isIsoDate(row.purchase_date)) return "Purchase date is invalid.";
  if (!Number.isFinite(row.sale_value) || !Number.isFinite(row.gain)) return "Amounts must be numbers.";
  if (typeof row.folio !== "string" || typeof row.scheme !== "string" || !row.scheme) return "Folio or scheme is missing.";
  if (row.units != null && !Number.isFinite(row.units)) return "Units must be a number.";
  return null;
}

module.exports = { parseCams, mapCamsRecord, camsFingerprint, validateCapitalGainRow, REQUIRED_COLUMNS };
