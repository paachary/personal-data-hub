const fs = require("fs");
const { parse } = require("csv-parse/sync");
const BaseStatementParser = require("./BaseStatementParser");
const { normalizeBatch } = require("../validators/statementValidator");

/**
 * Generic CSV Statement Parser
 * Works with any CSV that has Date, Description, Debit, Credit, Balance columns
 */
class CSVStatementParser extends BaseStatementParser {
    constructor(bankCode = "GENERIC") {
        super(bankCode, "csv");
    }

    /**
     * Parse CSV statement file
     * Auto-detects header row and column indices
     * @param {string} filePath - Path to CSV file
     * @returns {Promise<Object>} Parsed statement
     */
    async parse(filePath) {
        try {
            // Read file
            const fileContent = fs.readFileSync(filePath, "utf-8");

            // Parse CSV (try both with and without headers auto-detection)
            let records = parse(fileContent, {
                skip_empty_lines: true,
                trim: true,
                relax_quotes: true,
            });

            // Clean up records - convert to objects if array format
            records = records.map((record) => {
                if (Array.isArray(record)) {
                    return record;
                }
                return record;
            });

            if (records.length === 0) {
                throw new Error("CSV file is empty");
            }

            // Detect header row
            const headerIndex = this.detectHeaderRowInCSV(records);
            if (headerIndex < 0) {
                throw new Error("Could not detect header row in CSV");
            }

            // Get header and extract column indices
            const headerRow = records[headerIndex];
            const columnIndices = this.getColumnIndices(headerRow);

            if (!columnIndices.dateCol || !columnIndices.descCol) {
                throw new Error("CSV must have Date and Description columns");
            }

            // Extract account metadata from initial rows or extract from file
            const accountInfo = this.extractAccountMetadata(
                records.slice(0, headerIndex),
            );

            // Extract transactions
            const dataRows = records.slice(headerIndex + 1);
            const transactions = this.extractTransactions(
                dataRows,
                columnIndices,
            );

            // Normalize and validate
            const { valid, invalid } = normalizeBatch(transactions);

            if (invalid.length > 0) {
                console.warn(
                    `[${this.bankCode}/csv] ${invalid.length} invalid rows:`,
                    invalid.slice(0, 5),
                );
            }

            // Calculate missing balance if needed
            const finalTransactions = this.calculateMissingBalance(valid);

            return {
                account: {
                    bankName: accountInfo.bankName || "Unknown Bank",
                    accountNumber: accountInfo.accountNumber,
                    customerName: accountInfo.customerName,
                    customerId: accountInfo.customerId,
                },
                summary: this.createSummary(finalTransactions, {
                    openingBalance: finalTransactions[0]?.balance,
                    closingBalance:
                        finalTransactions[finalTransactions.length - 1]
                            ?.balance,
                }),
                transactions: finalTransactions,
                rawData: dataRows.map((row, idx) => ({
                    lineNumber: headerIndex + 2 + idx,
                    rawRow: row,
                })),
                validationErrors: invalid,
            };
        } catch (error) {
            throw new Error(this.formatError(error.message));
        }
    }

    /**
     * Detect header row in CSV by looking for column names
     * @param {Array[]} records - Array of CSV records
     * @returns {number} Index of header row or -1
     */
    detectHeaderRowInCSV(records) {
        const headerKeywords = [
            "date",
            "description",
            "debit",
            "credit",
            "balance",
            "amount",
            "withdrawal",
            "deposit",
            "narration",
            "particulars",
            "posting",
            "transaction",
            "value",
            "opening",
            "closing",
            "chq",
            "cheque",
        ];

        for (let i = 0; i < Math.min(records.length, 20); i++) {
            const row = records[i];
            if (!Array.isArray(row)) continue;

            const rowStr = row.join(" ").toLowerCase();
            const matches = headerKeywords.filter((kw) =>
                rowStr.includes(kw),
            ).length;

            // If row contains 2+ header keywords (reduced from 3+) and has 4+ columns, likely a header
            if (matches >= 2 && row.length >= 4) {
                return i;
            }
        }

        return -1;
    }

    /**
     * Extract column indices for key fields
     * Matches against various column name variations
     * @param {string[]|Object} headerRow - CSV header row
     * @returns {Object} { dateCol, descCol, debitCol, creditCol, balanceCol }
     */
    getColumnIndices(headerRow) {
        const header = Array.isArray(headerRow)
            ? headerRow
            : Object.values(headerRow);
        const headerLower = header.map((h) =>
            h.toString().toLowerCase().trim(),
        );

        // Define column name variations
        const dateVariations = [
            "date",
            "transaction date",
            "posting date",
            "value date",
            "tdate",
            "txn date",
        ];
        const descVariations = [
            "description",
            "narration",
            "details",
            "particulars",
            "memo",
            "txn details",
        ];
        const debitVariations = [
            "debit",
            "withdrawal",
            "dr",
            "out",
            "amount out",
            "debit amount",
        ];
        const creditVariations = [
            "credit",
            "deposit",
            "cr",
            "in",
            "amount in",
            "credit amount",
        ];
        const balanceVariations = [
            "balance",
            "closing balance",
            "balance brought forward",
            "cbf",
            "running balance",
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
     * Extract transactions from CSV rows
     * @param {string[][]} rows - Array of data rows
     * @param {Object} columnIndices - Column index mapping
     * @returns {Object[]} Array of transaction objects
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
                        : null,
                credit:
                    columnIndices.creditCol >= 0
                        ? row[columnIndices.creditCol]
                        : null,
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
     * Extract account metadata from statement header rows
     * @param {Array[]} headerRows - Rows before data table
     * @returns {Object} Account metadata
     */
    extractAccountMetadata(headerRows) {
        const text = headerRows.flat().join(" ");

        return {
            bankName: this.extractBankName(text),
            accountNumber: this.extractAccountNumber(text),
            customerName: this.extractCustomerName(text),
            customerId: null,
        };
    }

    /**
     * Extract bank name from text
     * @param {string} text - Text to search
     * @returns {string|null} Bank name or null
     */
    extractBankName(text) {
        const patterns = [
            /(.+?)\s*(?:Bank|Ltd|Limited)/i,
            /Bank\s*(?:of\s+)?(.+?)(?:\n|,|Statement)/i,
            /(HDFC|ICICI|SBI|Union|Standard\s*Chartered)/i,
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                return match[1].trim();
            }
        }

        return null;
    }
}

module.exports = CSVStatementParser;
