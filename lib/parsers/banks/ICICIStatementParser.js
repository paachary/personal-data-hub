const CSVStatementParser = require("../csvParser");

/**
 * ICICI Bank Statement Parser
 * Handles ICICI Bank specific statement formats (PDF, Excel, CSV)
 * Expected columns: Value Date | Description | Debit (Dr) | Credit (Cr) | Balance
 * ICICI often has multi-line descriptions
 */
class ICICIStatementParser extends CSVStatementParser {
    constructor() {
        super("ICICI");
    }

    /**
     * Override: ICICI-specific column detection
     * ICICI uses "Value Date" and "Debit (Dr)" / "Credit (Cr)" format
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

        // ICICI-specific column names
        const dateVariations = [
            "value date",
            "transaction date",
            "date",
            "posting date",
        ];
        const descVariations = [
            "description",
            "narration",
            "details",
            "transaction details",
        ];
        const debitVariations = ["debit", "dr", "debit (dr)", "amount debit"];
        const creditVariations = [
            "credit",
            "cr",
            "credit (cr)",
            "amount credit",
        ];
        const balanceVariations = [
            "balance",
            "closing balance",
            "balance carried forward",
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
     * Override: Extract ICICI-specific account metadata
     * @param {Array[]} headerRows - Rows before data table
     * @returns {Object} Account metadata
     */
    extractAccountMetadata(headerRows) {
        const text = headerRows.flat().join(" ");

        return {
            bankName: "ICICI Bank",
            accountNumber: this.extractICICIAccountNumber(text),
            customerName: this.extractCustomerName(text),
            customerId: this.extractCIFNumber(text),
        };
    }

    /**
     * Extract ICICI account number
     * ICICI patterns: "Account No: 020123456789" (10 digits) or variations
     * @param {string} text - Text to search
     * @returns {string|null} Account number
     */
    extractICICIAccountNumber(text) {
        const patterns = [
            /Account\s*(?:No\.?|Number)\s*[:\s]+(\d{10,12})/i,
            /A\/C\s*[:\s]+(\d{10,12})/i,
            /Account\s*[:\s]+(\d{10,12})/i,
            /(\d{10,12})/, // 10-12 digit ICICI account
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
     * Extract ICICI CIF (Customer ID) if available
     * @param {string} text - Text to search
     * @returns {string|null} CIF number
     */
    extractCIFNumber(text) {
        const patterns = [/CIF\s*[:\s]+(\d+)/i, /Customer\s*ID\s*[:\s]+(\d+)/i];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                return match[1].trim();
            }
        }

        return null;
    }

    /**
     * Extract transactions with ICICI-specific handling
     * ICICI often has multi-line descriptions that need consolidation
     * @param {string[][]} rows - Data rows
     * @param {Object} columnIndices - Column mapping
     * @returns {Object[]} Array of transactions
     */
    extractTransactions(rows, columnIndices) {
        const transactions = [];
        let currentTransaction = null;

        for (const row of rows) {
            if (!Array.isArray(row) || row.length === 0) continue;

            // Skip if all cells empty
            if (row.every((cell) => !cell || cell.toString().trim() === ""))
                continue;

            const dateVal =
                columnIndices.dateCol >= 0 ? row[columnIndices.dateCol] : null;

            // Check if this row starts a new transaction (has a date)
            if (dateVal && dateVal.toString().trim() !== "") {
                // Save previous transaction if exists
                if (currentTransaction) {
                    transactions.push(currentTransaction);
                }

                // Start new transaction
                currentTransaction = {
                    date: dateVal,
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
            } else if (currentTransaction) {
                // This is a continuation of the description (multi-line)
                const continuation =
                    columnIndices.descCol >= 0
                        ? row[columnIndices.descCol]
                        : "";
                if (continuation && continuation.toString().trim() !== "") {
                    currentTransaction.description +=
                        "; " + continuation.toString().trim();
                }
            }
        }

        // Don't forget the last transaction
        if (currentTransaction) {
            transactions.push(currentTransaction);
        }

        return transactions;
    }

    /**
     * Override: ICICI might use different date formats
     * Some ICICI statements use DD-Mon-YYYY
     * @param {string} dateStr - Raw date string
     * @returns {string} ISO format date
     */
    parseDate(dateStr) {
        // Try ICICI-specific formats first
        if (dateStr) {
            // DD-Mon-YYYY format (e.g., 01-Jan-2026)
            const monthMatch = dateStr.match(
                /(\d{1,2})-([A-Z][a-z]{2})-(\d{4})/i,
            );
            if (monthMatch) {
                const months = {
                    Jan: "01",
                    Feb: "02",
                    Mar: "03",
                    Apr: "04",
                    May: "05",
                    Jun: "06",
                    Jul: "07",
                    Aug: "08",
                    Sep: "09",
                    Oct: "10",
                    Nov: "11",
                    Dec: "12",
                };
                const month = months[monthMatch[2]] || "01";
                const day = String(monthMatch[1]).padStart(2, "0");
                const year = monthMatch[3];
                return `${year}-${month}-${day}`;
            }
        }

        // Fallback to generic parser
        const {
            parseDate,
        } = require("../../../lib/validators/statementValidator");
        return parseDate(dateStr);
    }
}

module.exports = ICICIStatementParser;
