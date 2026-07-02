const CSVStatementParser = require("../csvParser");

/**
 * State Bank of India (SBI) Statement Parser
 * Handles SBI specific statement formats (PDF, Excel, CSV)
 * Expected columns: Transaction Date | Cheque No | Description | Withdrawal | Deposit | Balance
 */
class SBIStatementParser extends CSVStatementParser {
    constructor() {
        super("SBI");
    }

    /**
     * Override: SBI-specific column detection
     * SBI has unique column: "Cheque No"
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

        // SBI-specific column names
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
        const debitVariations = ["withdrawal", "debit", "dr", "amount out"];
        const creditVariations = ["deposit", "credit", "cr", "amount in"];
        const balanceVariations = ["balance", "closing balance"];
        const chequeVariations = ["cheque", "cheque no", "chq no", "chq"];

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
            chequeCol: findColumn(chequeVariations),
        };
    }

    /**
     * Override: Extract SBI-specific account metadata
     * @param {Array[]} headerRows - Rows before data table
     * @returns {Object} Account metadata
     */
    extractAccountMetadata(headerRows) {
        const text = headerRows.flat().join(" ");

        return {
            bankName: "State Bank of India",
            accountNumber: this.extractSBIAccountNumber(text),
            customerName: this.extractCustomerName(text),
            customerId: null,
        };
    }

    /**
     * Extract SBI account number
     * SBI patterns: "Account No: 11234567890" or variations
     * @param {string} text - Text to search
     * @returns {string|null} Account number
     */
    extractSBIAccountNumber(text) {
        const patterns = [
            /Account\s*(?:No\.?|Number)\s*[:\s]+(\d{11,16})/i,
            /A\.C\s*[:\s]+(\d{11,16})/i,
            /Account\s*[:\s]+(\d{11,16})/i,
            /(\d{11,16})/, // 11-16 digit SBI account
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
     * Extract transactions with SBI-specific handling
     * SBI might have cheque numbers that need to be extracted
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

            let description =
                columnIndices.descCol >= 0 ? row[columnIndices.descCol] : "";
            let chequeNo = null;

            // Extract cheque number if present in cheque column
            if (columnIndices.chequeCol >= 0) {
                const chequeCell = row[columnIndices.chequeCol];
                if (chequeCell && chequeCell.toString().trim() !== "") {
                    chequeNo = chequeCell.toString().trim();
                    // Append cheque number to description if not already there
                    if (!description.includes(chequeNo)) {
                        description =
                            `Chq# ${chequeNo} - ${description}`.trim();
                    }
                }
            }

            // Also check in description for cheque patterns
            const descChequeMatch = description.match(/[Cc]hq[#\s]?(\d+)/);
            if (descChequeMatch && !chequeNo) {
                chequeNo = descChequeMatch[1];
            }

            const transaction = {
                date:
                    columnIndices.dateCol >= 0
                        ? row[columnIndices.dateCol]
                        : null,
                description,
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

            if (chequeNo) {
                transaction.chequeNo = chequeNo;
            }

            transactions.push(transaction);
        }

        return transactions;
    }

    /**
     * Override: Handle SBI's date format (usually DD/MM/YYYY)
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

module.exports = SBIStatementParser;
