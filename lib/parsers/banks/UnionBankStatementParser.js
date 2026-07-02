const CSVStatementParser = require("../csvParser");

/**
 * Union Bank of India Statement Parser
 * Handles Union Bank specific statement formats (CSV, Excel, PDF)
 * Expected columns: Date | Narration | Debit | Credit | Balance
 */
class UnionBankStatementParser extends CSVStatementParser {
    constructor() {
        super("UNION");
    }

    /**
     * Override: Union Bank-specific column detection
     * Union Bank uses "Narration" instead of "Description"
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

        // Union Bank-specific column names
        const dateVariations = [
            "date",
            "transaction date",
            "posting date",
            "value date",
        ];
        const descVariations = [
            "narration",
            "description",
            "details",
            "particulars",
        ];
        const debitVariations = ["debit", "dr", "withdrawal", "amount out"];
        const creditVariations = ["credit", "cr", "deposit", "amount in"];
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
     * Override: Extract Union Bank-specific account metadata
     * @param {Array[]} headerRows - Rows before data table
     * @returns {Object} Account metadata
     */
    extractAccountMetadata(headerRows) {
        const text = headerRows.flat().join(" ");

        return {
            bankName: "Union Bank of India",
            accountNumber: this.extractUnionAccountNumber(text),
            customerName: this.extractCustomerName(text),
            customerId: null,
        };
    }

    /**
     * Extract Union Bank account number
     * Union Bank patterns vary, typically 12-16 digits
     * @param {string} text - Text to search
     * @returns {string|null} Account number
     */
    extractUnionAccountNumber(text) {
        const patterns = [
            /Account\s*(?:No\.?|Number)\s*[:\s]+(\d{12,16})/i,
            /A\.C\s*[:\s]+(\d{12,16})/i,
            /Account\s*[:\s]+(\d{12,16})/i,
            /(\d{12,16})/, // 12-16 digit Union account
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
     * Extract transactions with Union Bank-specific handling
     * Union Bank CSVs tend to be straightforward
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
     * Override: Handle Union Bank's date format (usually DD/MM/YYYY)
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
}

module.exports = UnionBankStatementParser;
