const crypto = require("crypto");

/**
 * Validation rules for transaction rows
 * Each rule has a test function and error message
 */
const TRANSACTION_VALIDATION_RULES = [
    {
        name: "hasDate",
        test: (row) =>
            row.date !== null &&
            row.date !== undefined &&
            row.date.toString().trim() !== "",
        message: "Transaction date is required",
    },
    {
        name: "hasDescription",
        test: (row) =>
            row.description !== null &&
            row.description !== undefined &&
            row.description.toString().trim() !== "",
        message: "Transaction description is required",
    },
    {
        name: "hasAmount",
        test: (row) =>
            (row.debit !== null && row.debit !== undefined && row.debit > 0) ||
            (row.credit !== null && row.credit !== undefined && row.credit > 0),
        message: "Transaction must have either debit or credit amount",
    },
    {
        name: "validAmount",
        test: (row) => {
            const debit = row.debit || 0;
            const credit = row.credit || 0;
            return !isNaN(debit) && !isNaN(credit) && debit >= 0 && credit >= 0;
        },
        message: "Debit/Credit amounts must be valid positive numbers",
    },
    {
        name: "noNegativeBalance",
        test: (row) =>
            row.balance === null ||
            row.balance === undefined ||
            !isNaN(row.balance),
        message: "Balance must be a valid number",
    },
];

/**
 * Validate a single transaction row
 * @param {Object} row - Transaction row with date, description, debit, credit, balance
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validateTransactionRow(row) {
    const errors = [];

    for (const rule of TRANSACTION_VALIDATION_RULES) {
        try {
            if (!rule.test(row)) {
                errors.push(rule.message);
            }
        } catch (e) {
            errors.push(`${rule.name}: ${e.message}`);
        }
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Generate unique fingerprint hash for duplicate detection
 * Hash is based on: date + description + debit + credit
 * @param {Object} txn - Transaction with date, description, debit, credit
 * @returns {string} SHA256 hash hex string
 */
function calculateFingerprint(txn) {
    const key = `${txn.date}|${txn.description.trim()}|${txn.debit || 0}|${txn.credit || 0}`;
    return crypto.createHash("sha256").update(key).digest("hex");
}

/**
 * Normalize amount: handle Indian number format (1,23,456.50) and various formats
 * @param {string|number} amount - Raw amount value
 * @returns {number} Normalized amount or 0
 */
function normalizeAmount(amount) {
    if (amount === null || amount === undefined || amount === "") return 0;

    // Handle numeric input
    if (typeof amount === "number") {
        return Math.abs(amount); // Ensure positive
    }

    // Convert to string and clean
    let str = amount.toString().trim();

    // Handle special formats like "2L" for 200,000 (lakh)
    if (str.match(/^[\d,]+L$/i)) {
        const num = parseFloat(str.replace(/L$/i, "").replace(/,/g, ""));
        return isNaN(num) ? 0 : num * 100000;
    }

    // Remove currency symbols (₹, $, etc.)
    str = str.replace(/[₹$€£]/g, "").trim();

    // Handle parentheses for negative (accounting format)
    const isNegative = str.startsWith("(") && str.endsWith(")");
    if (isNegative) {
        str = str.slice(1, -1);
    }

    // Remove commas and spaces
    str = str.replace(/,/g, "").replace(/\s/g, "");

    const num = parseFloat(str);
    return isNaN(num) ? 0 : Math.abs(num);
}

/**
 * Parse date in multiple formats
 * Supports: DD/MM/YYYY, MM/DD/YYYY, DD-MM-YYYY, MM-DD-YYYY, YYYY-MM-DD, ISO strings, MMMM DD, YYYY
 * @param {string|Date} dateStr - Raw date string
 * @returns {string|null} ISO format date string (YYYY-MM-DD) or null if invalid
 */
function parseDate(dateStr) {
    if (!dateStr) return null;

    // If already a Date object
    if (dateStr instanceof Date) {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) {
            return d.toISOString().split("T")[0];
        }
        return null;
    }

    const str = dateStr.toString().trim();

    // Try ISO format first (YYYY-MM-DD)
    const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
        const d = new Date(`${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`);
        if (!isNaN(d.getTime())) {
            return isoMatch[1] + "-" + isoMatch[2] + "-" + isoMatch[3];
        }
    }

    // Try DD/MM/YY or MM/DD/YY (2-digit year - assume 2000s)
    // Convert YY to YYYY: 00-99 maps to 2000-2099
    const slashYYMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
    if (slashYYMatch) {
        const day = parseInt(slashYYMatch[1], 10);
        const month = parseInt(slashYYMatch[2], 10);
        const yearYY = parseInt(slashYYMatch[3], 10);
        const year = 2000 + yearYY; // Convert YY to YYYY (00-99 → 2000-2099)

        // Heuristic: if day > 12, assume DD/MM format
        if (day > 12) {
            const d = new Date(year, month - 1, day);
            if (!isNaN(d.getTime())) {
                return d.toISOString().split("T")[0];
            }
        } else {
            // Try both formats
            let d = new Date(year, month - 1, day);
            if (!isNaN(d.getTime()) && d.getDate() === day) {
                return d.toISOString().split("T")[0];
            }
            // Try MM/DD/YY
            d = new Date(year, day - 1, month);
            if (!isNaN(d.getTime()) && d.getDate() === month) {
                return d.toISOString().split("T")[0];
            }
        }
    }

    // Try DD/MM/YYYY or MM/DD/YYYY
    const slashMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (slashMatch) {
        const day = parseInt(slashMatch[1], 10);
        const month = parseInt(slashMatch[2], 10);
        const year = parseInt(slashMatch[3], 10);

        // Heuristic: if day > 12, assume DD/MM format
        if (day > 12) {
            const d = new Date(year, month - 1, day);
            if (!isNaN(d.getTime())) {
                return d.toISOString().split("T")[0];
            }
        } else {
            // Try both formats
            let d = new Date(year, month - 1, day);
            if (!isNaN(d.getTime()) && d.getDate() === day) {
                return d.toISOString().split("T")[0];
            }
            // Try MM/DD/YYYY
            d = new Date(year, day - 1, month);
            if (!isNaN(d.getTime()) && d.getDate() === month) {
                return d.toISOString().split("T")[0];
            }
        }
    }

    // Try DD-MM-YY or MM-DD-YY (2-digit year)
    const dashYYMatch = str.match(/^(\d{1,2})-(\d{1,2})-(\d{2})$/);
    if (dashYYMatch) {
        const day = parseInt(dashYYMatch[1], 10);
        const month = parseInt(dashYYMatch[2], 10);
        const yearYY = parseInt(dashYYMatch[3], 10);
        const year = 2000 + yearYY;

        if (day > 12) {
            const d = new Date(year, month - 1, day);
            if (!isNaN(d.getTime())) {
                return d.toISOString().split("T")[0];
            }
        } else {
            const d = new Date(year, month - 1, day);
            if (!isNaN(d.getTime())) {
                return d.toISOString().split("T")[0];
            }
        }
    }

    // Try DD-MM-YYYY or MM-DD-YYYY
    const dashMatch = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
    if (dashMatch) {
        const day = parseInt(dashMatch[1], 10);
        const month = parseInt(dashMatch[2], 10);
        const year = parseInt(dashMatch[3], 10);

        if (day > 12) {
            const d = new Date(year, month - 1, day);
            if (!isNaN(d.getTime())) {
                return d.toISOString().split("T")[0];
            }
        } else {
            const d = new Date(year, month - 1, day);
            if (!isNaN(d.getTime())) {
                return d.toISOString().split("T")[0];
            }
        }
    }

    // Try Date constructor (may handle various formats)
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
        return d.toISOString().split("T")[0];
    }

    return null;
}

/**
 * Normalize a transaction row with all validators and normalizers applied
 * @param {Object} rawRow - Raw row from parser
 * @returns {Object} { transaction, validation }
 *   - transaction: { date, description, debit, credit, balance, fingerprint_hash }
 *   - validation: { valid, errors }
 */
function normalizeTransaction(rawRow) {
    const transaction = {
        date: parseDate(rawRow.date),
        description: (rawRow.description || "").toString().trim(),
        debit: normalizeAmount(rawRow.debit),
        credit: normalizeAmount(rawRow.credit),
        balance:
            rawRow.balance !== null && rawRow.balance !== undefined
                ? normalizeAmount(rawRow.balance)
                : null,
    };

    const validation = validateTransactionRow(transaction);

    if (validation.valid) {
        transaction.fingerprint_hash = calculateFingerprint(transaction);
    }

    return { transaction, validation };
}

/**
 * Normalize a batch of transaction rows
 * @param {Object[]} rows - Array of raw transaction rows
 * @returns {Object} {
 *   valid: Object[],
 *   invalid: { lineNum, row, errors }[]
 * }
 */
function normalizeBatch(rows) {
    const valid = [];
    const invalid = [];

    rows.forEach((rawRow, idx) => {
        const lineNum = idx + 1;
        const { transaction, validation } = normalizeTransaction(rawRow);

        if (validation.valid) {
            valid.push(transaction);
        } else {
            invalid.push({
                lineNum,
                row: rawRow,
                errors: validation.errors,
            });
        }
    });

    return { valid, invalid };
}

module.exports = {
    TRANSACTION_VALIDATION_RULES,
    validateTransactionRow,
    calculateFingerprint,
    normalizeAmount,
    parseDate,
    normalizeTransaction,
    normalizeBatch,
};
