const XLSX = require("xlsx");
const BaseStatementParser = require("./BaseStatementParser");
const { normalizeBatch } = require("../validators/statementValidator");

/**
 * Generic Excel Statement Parser (.xls, .xlsx)
 * Works with any Excel file that has Date, Description, Debit, Credit, Balance columns
 */
class ExcelStatementParser extends BaseStatementParser {
    constructor(bankCode = "GENERIC") {
        super(bankCode, "xlsx");
    }

    /**
     * Parse Excel statement file
     * Auto-detects sheet and header row
     * @param {string} filePath - Path to Excel file
     * @returns {Promise<Object>} Parsed statement
     */
    async parse(filePath) {
        try {
            // Load workbook — use cellDates:false so we handle dates manually,
            // and codepage:1252 helps with older .xls BIFF5/BIFF8 files
            const workbook = XLSX.readFile(filePath, {
                cellDates: false,
                codepage: 1252,
                type: "buffer",
                raw: false,
            });

            // Get first sheet (skip hidden sheets)
            let sheetName = workbook.SheetNames[0];
            for (const name of workbook.SheetNames) {
                const sheet = workbook.Sheets[name];
                if (sheet.state !== "hidden") {
                    sheetName = name;
                    break;
                }
            }

            const sheet = workbook.Sheets[sheetName];
            if (!sheet) {
                throw new Error("No valid sheets found in workbook");
            }

            // Convert sheet to array of rows
            const records = XLSX.utils.sheet_to_json(sheet, {
                header: 1,
                defval: "",
            });

            if (records.length === 0) {
                throw new Error("Sheet is empty");
            }

            // DEBUG: Log first few rows to diagnose structure
            // console.log(
            //     `[${this.bankCode}/xlsx] Sheet: ${sheetName}, Total rows: ${records.length}`,
            // );
            // console.log(
            //     `[${this.bankCode}/xlsx] First 5 rows:`,
            //     records.slice(0, 5).map((r, i) => ({
            //         row: i,
            //         data: r,
            //         nonEmpty: r.filter((c) => c && c.toString().trim() !== "")
            //             .length,
            //     })),
            // );

            // Detect header row (skip merged cells at top, skip empty rows)
            const headerIndex = this.detectHeaderRowInSheet(records);
            if (headerIndex < 0) {
                throw new Error("Could not detect header row in sheet");
            }

            // Get header and extract column indices
            const headerRow = records[headerIndex];
            const columnIndices = this.getColumnIndices(headerRow);

            if (columnIndices.dateCol < 0 || columnIndices.descCol < 0) {
                console.error(
                    `[${this.bankCode}/xlsx] Column detection failed.`,
                );
                console.error(
                    `[${this.bankCode}/xlsx] Header row columns: ${headerRow
                        .slice(0, 10)
                        .map((h, i) => `${i}:"${h}"`)
                        .join(", ")}`,
                );
                throw new Error(
                    `Sheet must have Date and Description columns (date: ${columnIndices.dateCol}, desc: ${columnIndices.descCol})`,
                );
            }

            // Extract account metadata from header section
            const accountInfo = this.extractAccountMetadata(
                records.slice(0, headerIndex),
            );

            // Extract transactions from data rows
            const dataRows = records.slice(headerIndex + 1);
            const transactions = this.extractTransactions(
                dataRows,
                columnIndices,
            );

            // Normalize and validate
            const { valid, invalid } = normalizeBatch(transactions);

            if (invalid.length > 0) {
                console.warn(
                    `[${this.bankCode}/xlsx] ${invalid.length} invalid rows:`,
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
     * Detect header row by looking for key column names
     * @param {Array[]} records - Array of rows from sheet
     * @returns {number} Index of header row or -1
     */
    detectHeaderRowInSheet(records) {
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

        console.error(
            `[${this.bankCode}/xlsx] Detecting header from ${records.length} records`,
        );

        // Pass 1: Look for rows with 2+ header keywords AND 4+ non-empty cells
        for (let i = 0; i < Math.min(records.length, 40); i++) {
            const row = records[i];
            if (!Array.isArray(row) || row.length < 4) continue;

            // Skip rows with very few non-empty cells (metadata rows)
            const nonEmpty = row.filter(
                (c) => c && c.toString().trim() !== "",
            ).length;
            if (nonEmpty < 3) continue;

            const rowStr = row.join(" ").toLowerCase();
            const matches = headerKeywords.filter((kw) =>
                rowStr.includes(kw),
            ).length;

            if (matches >= 2) {
                console.error(
                    `[${this.bankCode}/xlsx] ✓ Pass 1: Header at row ${i} (${matches} keywords, ${nonEmpty} cells)`,
                );
                return i;
            }
        }

        console.error(
            `[${this.bankCode}/xlsx] Pass 1 failed, looking for structured table...`,
        );

        // Pass 2: Look for row with multiple columns and reasonable data (3+ non-empty cells, 4+ total columns)
        for (let i = 0; i < Math.min(records.length, 40); i++) {
            const row = records[i];
            if (!Array.isArray(row) || row.length < 4) continue;

            // Skip completely empty rows
            if (row.every((cell) => !cell || cell.toString().trim() === ""))
                continue;

            const nonEmpty = row.filter(
                (c) => c && c.toString().trim() !== "",
            ).length;

            // Rows with 3+ non-empty cells and 4+ total columns (likely a table header)
            if (nonEmpty >= 3) {
                console.error(
                    `[${this.bankCode}/xlsx] ✓ Pass 2: Header at row ${i} (${nonEmpty} non-empty cells)`,
                );
                console.error(
                    `[${this.bankCode}/xlsx]   Content: ${row.slice(0, 6).join(" | ")}`,
                );
                return i;
            }
        }

        console.error(`[${this.bankCode}/xlsx] ✗ No suitable header found`);
        return -1;
    }

    /**
     * Extract column indices for key fields
     * Matches against various column name variations
     * @param {string[]|Object} headerRow - Header row from sheet
     * @returns {Object} { dateCol, descCol, debitCol, creditCol, balanceCol }
     */
    getColumnIndices(headerRow) {
        const header = Array.isArray(headerRow)
            ? headerRow
            : Object.values(headerRow);
        const headerLower = header.map((h) =>
            h.toString().toLowerCase().trim(),
        );

        // Column name variations - common in Indian bank statements
        const dateVariations = [
            "date",
            "transaction date",
            "posting date",
            "value date",
            "tdate",
        ];
        const descVariations = [
            "remarks",
            "narration",
            "description",
            "details",
            "particulars",
            "memo",
        ];
        const debitVariations = [
            "withdrawals",
            "withdrawal",
            "debit",
            "dr",
            "out",
            "amount out",
        ];
        const creditVariations = [
            "deposits",
            "deposit",
            "credit",
            "cr",
            "in",
            "amount in",
        ];
        const balanceVariations = [
            "balance",
            "closing balance",
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
     * Extract transactions from Excel rows
     * @param {Array[]} rows - Array of data rows
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

            // Convert Excel numeric dates (serial dates) to ISO format
            if (typeof transaction.date === "number" && transaction.date > 0) {
                transaction.date = this.excelDateToISO(transaction.date);
            }

            transactions.push(transaction);
        }

        return transactions;
    }

    /**
     * Convert Excel serial date to ISO format
     * Excel stores dates as days since 1900-01-01 (with leap year bug)
     * @param {number} excelDate - Excel date serial number
     * @returns {string} ISO format date (YYYY-MM-DD)
     */
    excelDateToISO(excelDate) {
        // Excel epoch is 1900-01-01 (with leap year bug: 1900 is not a leap year but Excel thinks it is)
        const epochDate = new Date(1900, 0, -1); // Start at 1899-12-31
        const date = new Date(epochDate.getTime() + excelDate * 86400000);

        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");

        return `${year}-${month}-${day}`;
    }

    /**
     * Extract account metadata from header rows
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

module.exports = ExcelStatementParser;
