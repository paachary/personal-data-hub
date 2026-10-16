/**
 * Base class for all statement parsers
 * Defines the interface and common parsing logic
 */
class BaseStatementParser {
    /**
     * Initialize parser with bank code and file format
     * @param {string} bankCode - Bank identifier (e.g., 'HDFC', 'ICICI')
     * @param {string} format - File format ('pdf', 'csv', 'xlsx')
     */
    constructor(bankCode, format) {
        this.bankCode = bankCode;
        this.format = format;
    }

    /**
     * Parse statement file (must be implemented by subclasses)
     * @param {string} filePath - Path to statement file
     * @returns {Promise<Object>} Parsed statement {
     *   account: { bankName, accountNumber, customerName, customerId },
     *   summary: { openingBalance, closingBalance, totalDebits, totalCredits, startDate, endDate },
     *   transactions: [ { date, description, debit, credit, balance } ],
     *   rawData: [ { lineNumber, rawRow } ]
     * }
     */
    async parse(filePath) {
        throw new Error("parse() must be implemented by subclass");
    }

    /**
     * Extract table rows from raw text using line grouping and regex
     * Useful for text-based PDF parsing
     * @param {string} text - Raw text from PDF
     * @returns {Object[]} Array of detected table rows
     */
    extractTableFromText(text) {
        const lines = text
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l.length > 0);
        const rows = [];
        let currentRow = [];

        for (const line of lines) {
            // If line looks like a table cell (contains digits, spaces, or special chars)
            if (/[\d\s]/g.test(line)) {
                currentRow.push(line);

                // Heuristic: if line contains date-like pattern, end of row
                if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}/.test(line)) {
                    if (currentRow.length > 2) {
                        rows.push({
                            date: currentRow[0],
                            description: currentRow.slice(1, -2).join(" "),
                            amount: currentRow[currentRow.length - 2],
                            balance: currentRow[currentRow.length - 1],
                        });
                        currentRow = [];
                    }
                }
            }
        }

        return rows;
    }

    /**
     * Detect header row in a table by pattern matching
     * @param {Object[]} rows - Array of rows to scan
     * @param {string[]} expectedHeaders - Array of expected header names (case-insensitive)
     * @returns {number} Index of header row or -1 if not found
     */
    detectHeaderRow(rows, expectedHeaders = []) {
        if (rows.length === 0) return -1;

        for (let i = 0; i < Math.min(rows.length, 10); i++) {
            const row = rows[i];
            const rowStr = Object.values(row).join(" ").toLowerCase();

            // Check if row contains expected headers
            const matches = expectedHeaders.filter((h) =>
                rowStr.includes(h.toLowerCase()),
            );

            if (matches.length >= Math.max(1, expectedHeaders.length / 2)) {
                return i;
            }
        }

        return -1;
    }

    /**
     * Skip rows before header (common in bank statements)
     * @param {Object[]} rows - Array of rows
     * @param {number} headerIndex - Index of header row
     * @returns {Object[]} Rows after header (excluding header)
     */
    skipToData(rows, headerIndex) {
        if (headerIndex < 0 || headerIndex >= rows.length) {
            return rows;
        }
        return rows.slice(headerIndex + 1);
    }

    /**
     * Join multi-line descriptions (common in PDFs)
     * A new description line starts with a date
     * @param {Object[]} rows - Array of rows with potentially multi-line descriptions
     * @returns {Object[]} Rows with consolidated descriptions
     */
    consolidateMultilineDescriptions(rows) {
        const result = [];
        let currentRow = null;

        for (const row of rows) {
            // If row has a date, it's a new transaction
            if (
                row.date &&
                row.date.match(/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}/)
            ) {
                if (currentRow) {
                    result.push(currentRow);
                }
                currentRow = { ...row };
            } else if (currentRow) {
                // This is a continuation of the description
                currentRow.description =
                    `${currentRow.description}; ${row.description || ""}`.trim();
            }
        }

        if (currentRow) {
            result.push(currentRow);
        }

        return result;
    }

    /**
     * Remove duplicate header rows that appear in middle of table
     * @param {Object[]} rows - Array of rows
     * @param {Object} headerRow - Expected header row for comparison
     * @returns {Object[]} Rows with duplicate headers removed
     */
    removeDuplicateHeaders(rows, headerRow = null) {
        if (!headerRow) return rows;

        return rows.filter((row) => {
            // Check if row matches header pattern
            for (const [key, value] of Object.entries(headerRow)) {
                if (
                    value &&
                    row[key] &&
                    row[key].toLowerCase() === value.toLowerCase()
                ) {
                    return false; // Skip this row (it's a header)
                }
            }
            return true;
        });
    }

    /**
     * Extract account number from statement text (common patterns)
     * @param {string} text - Raw text from statement
     * @returns {string|null} Account number or null
     */
    extractAccountNumber(text) {
        // Common patterns: "Account No: 12345678", "AC: 1234567890"
        const patterns = [
            /Account\s*(?:No\.?|Number|#)?\s*[:\s]+(\d+)/i,
            /A\/C\s*[:\s]+(\d+)/i,
            /Acc(?:ount)?\s*[:\s]+(\d+)/i,
            /(\d{9,18})/, // Fallback: any 9-18 digit number
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                return match[1].trim();
            }
        }

        return null;
    }

    /**
     * Extract customer name from statement text
     * @param {string} text - Raw text from statement
     * @returns {string|null} Customer name or null
     */
    extractCustomerName(text) {
        // Look for "Customer Name:", "Name:", etc.
        const patterns = [
            /(?:Customer\s*)?Name\s*[:\s]+([A-Za-z\s]+?)(?:\n|,|Account)/i,
            /(?:Dear|Hello|Mr\.?|Ms\.?|Dr\.?)\s+([A-Za-z\s]+?)(?:\n|,|Account)/i,
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                return match[1].trim();
            }
        }

        return null;
    }

    /**
     * Determine if a row contains balance information
     * @param {Object} row - Row to check
     * @returns {boolean} True if row has balance column
     */
    hasBalanceColumn(row) {
        return (
            row.balance !== null &&
            row.balance !== undefined &&
            row.balance.toString().trim() !== ""
        );
    }

    /**
     * Calculate missing balance using running balance logic
     * If balance column is missing, calculate from debit/credit
     * @param {Object[]} transactions - Array of transactions
     * @returns {Object[]} Transactions with calculated balance
     */
    calculateMissingBalance(transactions) {
        let runningBalance = transactions[0]?.balance || 0;

        return transactions.map((txn, idx) => {
            if (txn.balance === null || txn.balance === undefined) {
                // Calculate from previous balance and current debit/credit
                runningBalance =
                    runningBalance + (txn.credit || 0) - (txn.debit || 0);
                return { ...txn, balance: runningBalance };
            }
            runningBalance = txn.balance;
            return txn;
        });
    }

    /**
     * Validate date range consistency
     * @param {Object[]} transactions - Array of transactions
     * @returns {Object} { startDate, endDate, isValid: boolean }
     */
    getDateRange(transactions) {
        if (transactions.length === 0) {
            return { startDate: null, endDate: null, isValid: false };
        }

        const dates = transactions
            .map((t) => t.date)
            .filter((d) => d && !isNaN(new Date(d).getTime()))
            .sort();

        return {
            startDate: dates[0] || null,
            endDate: dates[dates.length - 1] || null,
            isValid: dates.length > 0,
        };
    }

    /**
     * Format error with context
     * @param {string} message - Error message
     * @param {number} lineNum - Line number (optional)
     * @returns {string} Formatted error
     */
    formatError(message, lineNum = null) {
        const context = lineNum ? ` (line ${lineNum})` : "";
        return `[${this.bankCode}/${this.format}]${context}: ${message}`;
    }

    /**
     * Create a summary report of parsed data
     * @param {Object[]} transactions - Array of transactions
     * @param {Object} accountInfo - Account information
     * @returns {Object} Summary object
     */
    createSummary(transactions, accountInfo = {}) {
        const totalDebits = transactions.reduce(
            (sum, t) => sum + (t.debit || 0),
            0,
        );
        const totalCredits = transactions.reduce(
            (sum, t) => sum + (t.credit || 0),
            0,
        );
        const dateRange = this.getDateRange(transactions);

        return {
            ...accountInfo,
            totalTransactions: transactions.length,
            totalDebits,
            totalCredits,
            net: totalCredits - totalDebits,
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
            openingBalance:
                transactions[0]?.balance || accountInfo.openingBalance,
            closingBalance:
                transactions[transactions.length - 1]?.balance ||
                accountInfo.closingBalance,
        };
    }
}

module.exports = BaseStatementParser;
