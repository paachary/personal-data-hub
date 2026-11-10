"use strict";

const service = require("../service");
const { validateCapitalGainRow, camsFingerprint } = require("./cams");
const { validateIncomeRow } = require("./template");

const TEMPLATE_DUPLICATE_NOTE =
    "Income template rows are not de-duplicated. Importing the same file again adds the rows again.";

function existingCapitalGainFingerprints(db, userId) {
    return new Set(
        db.prepare("SELECT fingerprint FROM tax_capital_gain WHERE user_id = ? AND fingerprint IS NOT NULL")
            .all(userId)
            .map((row) => row.fingerprint),
    );
}

function rowStatus(row) {
    if (row.errors.length > 0) return "error";
    if (row.duplicate) return "duplicate";
    if (row.needs_review || row.warnings.length > 0) return "warning";
    return "ok";
}

/**
 * Adds `status` and `duplicate` to parsed rows. Duplicates are rows already stored for this user, or
 * repeated inside the same file. Pure apart from reading existing fingerprints. Does not write.
 */
function annotate(db, userId, kind, rows) {
    const notes = [];
    const seen = new Set();
    let existing = null;
    if (kind === "cams") existing = existingCapitalGainFingerprints(db, userId);
    if (kind === "incomeTemplate") {
        notes.push(TEMPLATE_DUPLICATE_NOTE);
    }

    const annotated = rows.map((row) => {
        let duplicate = false;
        if (row.fingerprint) {
            duplicate = seen.has(row.fingerprint) || (existing !== null && existing.has(row.fingerprint));
            seen.add(row.fingerprint);
        }
        if (kind === "incomeTemplate" && !duplicate) {
            const repeated = `${row.type}|${row.label}|${row.amount}`;
            if (seen.has(repeated)) row.warnings = [...row.warnings, "Same line appears more than once in this file."];
            seen.add(repeated);
        }
        const out = { ...row, duplicate };
        out.status = rowStatus(out);
        out.selected = out.status === "ok" || out.status === "warning";
        return out;
    });
    return { rows: annotated, notes };
}

function capitalGainData(row, fy) {
    return {
        asset_class: row.asset_class,
        category: row.category,
        description: row.description,
        sale_date: row.sale_date,
        purchase_date: row.purchase_date ?? null,
        sale_value: row.sale_value,
        cost: row.cost,
        gain: row.gain,
        source: "cams",
        fingerprint: camsFingerprint(row),
        needs_review: row.needs_review ? true : false,
    };
}

/**
 * Writes the rows the user selected. Every row is re-validated first, so a bad row fails the whole batch
 * before anything is written. The write runs in one transaction. Duplicates are skipped, not errors.
 */
function commitRows(db, userId, fy, kind, rows) {
    if (!Array.isArray(rows) || rows.length === 0) throw new TypeError("No rows selected.");
    if (kind !== "cams" && kind !== "incomeTemplate") throw new TypeError("Unknown import kind.");

    const problems = [];
    rows.forEach((row, index) => {
        const message = kind === "cams" ? validateCapitalGainRow(row, fy) : validateIncomeRow(row);
        if (message) problems.push(`Row ${index + 1}: ${message}`);
    });
    if (problems.length > 0) {
        throw new RangeError(`Nothing was imported. ${problems.slice(0, 5).join(" ")}`);
    }

    return db.transaction(() => {
        let inserted = 0;
        let skipped = 0;
        for (const row of rows) {
            if (kind === "cams") {
                const result = service.capitalGains.add(db, userId, fy, capitalGainData(row, fy));
                if (result.inserted) inserted += 1;
                else skipped += 1;
            } else if (row.type === "dividend") {
                service.dividendHistory.add(db, userId, fy, { source_label: row.label, amount: row.amount });
                inserted += 1;
            } else {
                service.incomeSources.add(db, userId, fy, { kind: row.type, label: row.label, amount: row.amount });
                inserted += 1;
            }
        }
        return { inserted, skipped };
    })();
}

module.exports = { annotate, commitRows, capitalGainData };
