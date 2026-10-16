const CSVStatementParser = require("../csvParser");

/**
 * HDFC Bank Statement Parser
 * Handles HDFC Bank specific statement formats (PDF, Excel, CSV)
 * Expected columns: Date | Description | Withdrawal/Debit | Deposit/Credit | Balance
 */
class HDFCStatementParser extends CSVStatementParser {
    constructor() {
        super("HDFC");
    }

    /**
     * Override: HDFC-specific column detection
     * HDFC uses column names like "Withdrawal", "Deposit" instead of "Debit", "Credit"
     * @param {string[]|Object} headerRow - Header row
     * @returns {Object} Column indices
     */
    getColumnIndices(headerRow) {
        const header = Array.isArray(headerRow)
            ? headerRow
            : Object.values(headerRow);
        const headerLower = header.map((h) =>
            h.toString().toLowerCase().trim(),
        );

        // HDFC-specific column names
        const dateVariations = [
            "date",
            "transaction date",
            "posting date",
            "value date",
        ];
        const descVariations = [
            "description",
            "narration",
            "details",
            "chq no",
        ];
        const debitVariations = ["withdrawal", "debit", "dr", "amount"];
        const creditVariations = ["deposit", "credit", "cr", "amount"];
        const balanceVariations = [
            "balance",
            "closing balance",
            "balance brought forward",
        ];

        const findColumn = (variations) => {
            for (const variation of variations) {
                const idx = headerLower.findIndex((h) => h.includes(variation));
                if (idx >= 0) return idx;
            }
            return -1;
        };

        return {
            dateCol: findColumn(dateVariations),
            descCol: findColumn(descVariations),
            debitCol: findColumn(debitVariations),
            creditCol: findColumn(creditVariations),
            balanceCol: findColumn(balanceVariations),
        };
    }

    /**
     * Override: Extract HDFC-specific account metadata
     * HDFC statements usually have account info in header
     * @param {Array[]} headerRows - Rows before data table
     * @returns {Object} Account metadata
     */
    extractAccountMetadata(headerRows) {
        const text = headerRows.flat().join(" ");

        return {
            bankName: "HDFC Bank",
            accountNumber: this.extractHDFCAccountNumber(text),
            customerName: this.extractCustomerName(text),
            customerId: null,
        };
    }

    /**
     * Extract HDFC account number
     * HDFC patterns: "Account No: 50100123456789" or "A/C: 50100123456789"
     * @param {string} text - Text to search
     * @returns {string|null} Account number
     */
    extractHDFCAccountNumber(text) {
        const patterns = [
            /Account\s*No\.?\s*[:\s]+(\d{14,16})/i,
            /A\/C\s*[:\s]+(\d{14,16})/i,
            /Account\s*[:\s]+(\d{14,16})/i,
            /(\d{14,16})/, // 14-16 digit HDFC account
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
     * Override: Normalize amount for HDFC format
     * HDFC sometimes uses comma-separated Indian format: 10,00,000.50
     * @param {string|number} amount - Raw amount
     * @returns {number} Normalized amount
     */
    normalizeAmount(amount) {
        // Use parent implementation from validator
        const {
            normalizeAmount,
        } = require("../../../lib/validators/statementValidator");
        return normalizeAmount(amount);
    }

    /**
     * Override: Handle HDFC's specific date formats
     * HDFC typically uses: DD/MM/YYYY
     * @param {string} dateStr - Raw date string
     * @returns {string} ISO format date
     */
    parseDate(dateStr) {
        // Use parent implementation from validator
        const {
            parseDate,
        } = require("../../../lib/validators/statementValidator");
        return parseDate(dateStr);
    }

    /**
     * Extract transactions with HDFC-specific handling
     * HDFC might have cheque numbers or reference numbers in description
     * @param {string[][]} rows - Data rows
     * @param {Object} columnIndices - Column mapping
     * @returns {Object[]} Array of transactions
     */
    extractTransactions(rows, columnIndices) {
        const transactions = [];

        for (const row of rows) {
            if (!Array.isArray(row) || row.length === 0) continue;

            // Skip if all cells empty
            if (row.every((cell) => !cell || cell.toString().trim() === ""))
                continue;

            // Handle HDFC's cheque number in description
            let description =
                columnIndices.descCol >= 0 ? row[columnIndices.descCol] : "";
            let chequeNo = null;

            // Extract cheque number if present (e.g., "By Chq# 123456")
            const chequeMatch = description.match(/[Cc]hq[#\s]?(\d+)/);
            if (chequeMatch) {
                chequeNo = chequeMatch[1];
                description = description
                    .replace(/[Cc]hq[#\s]?\d+/g, "")
                    .trim();
            }

            // For HDFC, either withdrawal or deposit is populated (not both)
            const debitVal =
                columnIndices.debitCol >= 0
                    ? row[columnIndices.debitCol]
                    : null;
            const creditVal =
                columnIndices.creditCol >= 0
                    ? row[columnIndices.creditCol]
                    : null;

            const transaction = {
                date:
                    columnIndices.dateCol >= 0
                        ? row[columnIndices.dateCol]
                        : null,
                description,
                debit:
                    debitVal && debitVal.toString().trim() !== ""
                        ? debitVal
                        : 0,
                credit:
                    creditVal && creditVal.toString().trim() !== ""
                        ? creditVal
                        : 0,
                balance:
                    columnIndices.balanceCol >= 0
                        ? row[columnIndices.balanceCol]
                        : null,
            };

            if (chequeNo) {
                transaction.chequeNo = chequeNo;
            }

            transactions.push(transaction);
        }

        return transactions;
    }
}

module.exports = HDFCStatementParser;
