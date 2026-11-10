"use strict";

const { readRawRows, findTable, text, parseAmount, sha256 } = require("./common");

const TEMPLATE_HEADERS = ["type", "label", "amount"];
const TEMPLATE_TYPES = ["dividend", "interest_savings", "interest_deposit", "interest_other"];
const MAX_AMOUNT = 1e12;

const TEMPLATE_CSV = `${TEMPLATE_HEADERS.join(",")}\n` +
    "dividend,Example Ltd dividend,1200\n" +
    "interest_savings,Bank savings interest,4500\n";

/** Parses an income template (type,label,amount). Pure: no DB or file dialog. */
function parseIncomeTemplate(buffer, ext) {
    const records = findTable(readRawRows(buffer, ext), TEMPLATE_HEADERS);
    return records.map((record) => {
        const type = text(record.get("type"));
        const label = text(record.get("label"));
        const amount = parseAmount(record.get("amount"));
        const errors = [];
        if (!TEMPLATE_TYPES.includes(type)) errors.push(`Type must be one of: ${TEMPLATE_TYPES.join(", ")}.`);
        if (!label) errors.push("Label is missing.");
        if (amount === null || amount < 0) errors.push("Amount must be a number, zero or more.");
        const row = {
            kind: "income",
            line: record.line,
            type,
            label,
            amount,
            errors,
            warnings: [],
            needs_review: false,
        };
        row.fingerprint = sha256(["income", type, label, amount ?? ""]);
        return row;
    });
}

/** Checks a template row that came back from the renderer. Returns an error message or null. */
function validateIncomeRow(row) {
    if (!TEMPLATE_TYPES.includes(row.type)) return "Unknown income type.";
    if (typeof row.label !== "string" || !row.label.trim()) return "Label is missing.";
    if (!Number.isFinite(row.amount) || row.amount < 0 || row.amount > MAX_AMOUNT) return "Amount is invalid.";
    return null;
}

module.exports = { parseIncomeTemplate, validateIncomeRow, TEMPLATE_CSV, TEMPLATE_HEADERS, TEMPLATE_TYPES };
