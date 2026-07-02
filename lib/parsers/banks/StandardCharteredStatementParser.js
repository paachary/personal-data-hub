const CSVStatementParser = require("../csvParser");

/**
 * Standard Chartered Bank Statement Parser
 * Handles Standard Chartered specific statement formats (PDF, Excel, CSV)
 * Expected columns: Transaction Date | Description | Amount (Dr) | Amount (Cr) | Running Balance
 */
class StandardCharteredStatementParser extends CSVStatementParser {
    constructor() {
        super("STANCHART");
    }

    /**
     * Override: Standard Chartered-specific column detection
     * SC uses "Amount (Dr)" and "Amount (Cr)" format
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

        // SC-specific column names
        const dateVariations = [
            "transaction date",
            "date",
            "posting date",
            "value date",
        ];
        const descVariations = [
            "description",
            "narration",
            "details",
            "particulars",
        ];
        const debitVariations = [
            "amount (dr)",
            "debit",
            "dr",
            "amount debit",
            "withdrawal",
        ];
        const creditVariations = [
            "amount (cr)",
            "credit",
            "cr",
            "amount credit",
            "deposit",
        ];
        const balanceVariations = [
            "running balance",
            "balance",
            "closing balance",
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
     * Override: Extract Standard Chartered-specific account metadata
     * @param {Array[]} headerRows - Rows before data table
     * @returns {Object} Account metadata
     */
    extractAccountMetadata(headerRows) {
        const text = headerRows.flat().join(" ");

        return {
            bankName: "Standard Chartered Bank",
            accountNumber: this.extractSCAccountNumber(text),
            customerName: this.extractCustomerName(text),
            customerId: null,
        };
    }

    /**
     * Extract Standard Chartered account number
     * SC patterns: "Account Number: 00123456789" or variations
     * @param {string} text - Text to search
     * @returns {string|null} Account number
     */
    extractSCAccountNumber(text) {
        const patterns = [
            /Account\s*(?:Number|No\.?)\s*[:\s]+(\d{10,16})/i,
            /A\.C\s*[:\s]+(\d{10,16})/i,
            /Account\s*[:\s]+(\d{10,16})/i,
            /(\d{10,16})/, // 10-16 digit SC account
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
     * Extract transactions with SC-specific handling
     * SC statements tend to be well-formatted
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

            const transaction = {
                date:
                    columnIndices.dateCol >= 0
                        ? row[columnIndices.dateCol]
                        : null,
                description:
                    columnIndices.descCol >= 0
                        ? row[columnIndices.descCol]
                        : "",
                debit:
                    columnIndices.debitCol >= 0
                        ? row[columnIndices.debitCol]
                        : 0,
                credit:
                    columnIndices.creditCol >= 0
                        ? row[columnIndices.creditCol]
                        : 0,
                balance:
                    columnIndices.balanceCol >= 0
                        ? row[columnIndices.balanceCol]
                        : null,
            };

            transactions.push(transaction);
        }

        return transactions;
    }

    /**
     * Override: Handle SC's date format (usually DD/MM/YYYY or YYYY-MM-DD)
     * @param {string} dateStr - Raw date string
     * @returns {string} ISO format date
     */
    parseDate(dateStr) {
        // Use generic parser
        const {
            parseDate,
        } = require("../../../lib/validators/statementValidator");
        return parseDate(dateStr);
    }

    /**
     * Handle potential multi-currency transactions
     * SC statements might have currency indicators
     * @param {string} description - Transaction description
     * @returns {Object} { description, currency }
     */
    extractCurrency(description) {
        const currencyMatch = description.match(/(INR|USD|EUR|GBP|JPY)/i);
        if (currencyMatch) {
            return {
                description: description.replace(currencyMatch[0], "").trim(),
                currency: currencyMatch[1].toUpperCase(),
            };
        }
        return { description, currency: "INR" };
    }
}

module.exports = StandardCharteredStatementParser;
