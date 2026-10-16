const fs = require("fs");
const { PDFParse } = require("pdf-parse");
const BaseStatementParser = require("./BaseStatementParser");
const { normalizeBatch } = require("../validators/statementValidator");

/**
 * Generic PDF Statement Parser (text-based PDFs only)
 * For scanned PDFs, OCR support can be added in Phase 2
 */
class PDFStatementParser extends BaseStatementParser {
    constructor(bankCode = "GENERIC") {
        super(bankCode, "pdf");
    }

    /**
     * Parse PDF statement file
     * Extracts text and detects tabular data
     * @param {string} filePath - Path to PDF file
     * @returns {Promise<Object>} Parsed statement
     */
    async parse(filePath) {
        try {
            // Read PDF file
            const fileBuffer = fs.readFileSync(filePath);

            // Extract text from PDF
            const parser = new PDFParse();
            const data = await parser(fileBuffer);
            const fullText = data.text;

            if (!fullText || fullText.trim().length === 0) {
                throw new Error(
                    "PDF appears to be scanned or contains no extractable text. Please provide a text-based PDF or CSV/Excel file.",
                );
            }

            // Extract account metadata from top of document
            const accountInfo = this.extractAccountMetadata(fullText);

            // Detect table structure and extract rows
            const tableRows = this.extractTableFromPDF(fullText);

            if (tableRows.length === 0) {
                throw new Error("Could not detect transaction table in PDF");
            }

            // Detect header row and column indices
            const headerIndex = this.detectHeaderRowInTable(tableRows);
            if (headerIndex < 0) {
                throw new Error("Could not detect table header in PDF");
            }

            const columnIndices = this.getColumnIndices(tableRows[headerIndex]);

            if (columnIndices.dateCol < 0 || columnIndices.descCol < 0) {
                throw new Error("Could not map Date and Description columns");
            }

            // Extract transaction data rows
            const dataRows = tableRows.slice(headerIndex + 1);

            // Remove duplicate headers that appear in middle of table
            const cleanedRows = this.removeDuplicateHeaders(
                dataRows,
                tableRows[headerIndex],
            );

            // Consolidate multi-line descriptions
            const consolidatedRows =
                this.consolidateMultilineDescriptions(cleanedRows);

            // Extract transactions
            const transactions = this.extractTransactions(
                consolidatedRows,
                columnIndices,
            );

            // Normalize and validate
            const { valid, invalid } = normalizeBatch(transactions);

            if (invalid.length > 0) {
                console.warn(
                    `[${this.bankCode}/pdf] ${invalid.length} invalid rows:`,
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
                    openingBalance: accountInfo.openingBalance,
                    closingBalance: accountInfo.closingBalance,
                }),
                transactions: finalTransactions,
                rawData: consolidatedRows.map((row, idx) => ({
                    lineNumber: idx + 1,
                    rawRow: row,
                })),
                validationErrors: invalid,
                extractionConfidence: this.calculateConfidence(
                    invalid,
                    finalTransactions,
                ),
            };
        } catch (error) {
            throw new Error(this.formatError(error.message));
        }
    }

    /**
     * Extract table structure from PDF text
     * Tries multiple strategies to detect rows
     * @param {string} text - Full PDF text
     * @returns {Object[]} Array of detected rows with columns
     */
    extractTableFromPDF(text) {
        const lines = text
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l.length > 0);
        const rows = [];

        // Strategy 1: Look for lines with date patterns (indicates transaction rows)
        const datePattern = /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}/;
        let currentRow = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];

            // If line starts with date, it's a new transaction
            if (datePattern.test(line)) {
                if (currentRow.length > 0) {
                    rows.push(currentRow);
                }
                currentRow = [line];
            } else if (currentRow.length > 0) {
                // Continue accumulating cells for current row
                currentRow.push(line);

                // Heuristic: if accumulated 5+ cells or we see a digit amount, might be end of row
                if (currentRow.length >= 5 && /[\d,]+\.?\d*/.test(line)) {
                    // Could be end of row, try to parse
                    const parsed = this.parsePDFRow(currentRow);
                    if (
                        parsed &&
                        parsed.date &&
                        parsed.date.match(datePattern)
                    ) {
                        rows.push(currentRow);
                        currentRow = [];
                    }
                }
            }
        }

        if (currentRow.length > 0) {
            rows.push(currentRow);
        }

        return rows.map((row, idx) => this.parsePDFRow(row, idx));
    }

    /**
     * Parse a detected table row from PDF text
     * Groups cells and tries to extract structured data
     * @param {string[]|string} rowCells - Array of text cells or single text
     * @param {number} rowIndex - Row index
     * @returns {Object} Parsed row with date, description, amounts
     */
    parsePDFRow(rowCells, rowIndex = 0) {
        const cells = Array.isArray(rowCells) ? rowCells : [rowCells];

        if (cells.length === 0) return null;

        // Combine all cells into a string
        const rowText = cells.join(" ");

        // Extract date (should be at start)
        const dateMatch = rowText.match(/^(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/);
        const date = dateMatch ? dateMatch[1] : null;

        if (!date) return null;

        // Remove date from text
        let remaining = rowText.replace(
            /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}\s*/,
            "",
        );

        // Extract amounts (last 2-3 numeric values are likely debit, credit, balance)
        const amountMatches = remaining.match(/[\d,]+\.?\d*/g) || [];

        // Extract amounts from end (working backwards: balance, credit/debit, debit, description)
        let balance = null;
        let credit = null;
        let debit = null;

        if (amountMatches.length >= 3) {
            balance = this.parseAmount(amountMatches[amountMatches.length - 1]);
            credit = this.parseAmount(amountMatches[amountMatches.length - 2]);
            debit = this.parseAmount(amountMatches[amountMatches.length - 3]);

            // Remove last 3 amounts from remaining text
            remaining = remaining.replace(
                /[\d,]+\.?\d*\s*[\d,]+\.?\d*\s*[\d,]+\.?\d*\s*$/,
                "",
            );
        } else if (amountMatches.length === 2) {
            credit = this.parseAmount(amountMatches[amountMatches.length - 1]);
            debit = this.parseAmount(amountMatches[amountMatches.length - 2]);
            remaining = remaining.replace(
                /[\d,]+\.?\d*\s*[\d,]+\.?\d*\s*$/,
                "",
            );
        } else if (amountMatches.length === 1) {
            // Single amount - could be debit or credit, try to determine from context
            debit = this.parseAmount(amountMatches[0]);
            remaining = remaining.replace(/[\d,]+\.?\d*\s*$/, "");
        }

        // Whatever remains is description
        const description = remaining.trim();

        return {
            date,
            description,
            debit: debit || 0,
            credit: credit || 0,
            balance,
        };
    }

    /**
     * Helper to parse amount string (remove commas, currency symbols)
     * @param {string} amountStr - Amount string
     * @returns {number} Parsed amount
     */
    parseAmount(amountStr) {
        if (!amountStr) return 0;
        const cleaned = amountStr.replace(/[₹$€£,]/g, "");
        const num = parseFloat(cleaned);
        return isNaN(num) ? 0 : Math.abs(num);
    }

    /**
     * Detect header row in table rows
     * @param {Object[]} rows - Array of parsed rows
     * @returns {number} Index of header row or -1
     */
    detectHeaderRowInTable(rows) {
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
        ];

        for (let i = 0; i < Math.min(rows.length, 5); i++) {
            const row = rows[i];
            if (!row) continue;

            const rowStr = Object.values(row).join(" ").toLowerCase();
            const matches = headerKeywords.filter((kw) =>
                rowStr.includes(kw),
            ).length;

            if (matches >= 2) {
                return i;
            }
        }

        return -1;
    }

    /**
     * Get column indices from header row
     * @param {Object} headerRow - Header row object
     * @returns {Object} Column index mapping
     */
    getColumnIndices(headerRow) {
        // For PDF, we've already parsed the structure
        return {
            dateCol: 0,
            descCol: 1,
            debitCol: 2,
            creditCol: 3,
            balanceCol: 4,
        };
    }

    /**
     * Extract transactions from rows
     * @param {Object[]} rows - Array of parsed rows
     * @param {Object} columnIndices - Column mapping (unused for PDF since already parsed)
     * @returns {Object[]} Array of transactions
     */
    extractTransactions(rows, columnIndices) {
        return rows.filter((row) => row !== null);
    }

    /**
     * Extract account metadata from PDF text
     * @param {string} text - Full PDF text
     * @returns {Object} Account metadata
     */
    extractAccountMetadata(text) {
        // Get first 1000 chars (usually has account info)
        const headerText = text.substring(0, 2000);

        return {
            bankName: this.extractBankName(headerText),
            accountNumber: this.extractAccountNumber(headerText),
            customerName: this.extractCustomerName(headerText),
            customerId: null,
            openingBalance: this.extractOpeningBalance(text),
            closingBalance: this.extractClosingBalance(text),
        };
    }

    /**
     * Extract bank name from text
     * @param {string} text - Text to search
     * @returns {string|null} Bank name or null
     */
    extractBankName(text) {
        const patterns = [
            /(HDFC\s*Bank)/i,
            /(ICICI\s*Bank)/i,
            /(State\s*Bank|SBI)/i,
            /(Union\s*Bank)/i,
            /(Standard\s*Chartered)/i,
            /(.+?)\s*(?:Bank|Limited|Ltd)/i,
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
     * Extract opening balance from text
     * @param {string} text - Full PDF text
     * @returns {number|null}
     */
    extractOpeningBalance(text) {
        const patterns = [
            /Opening\s*Balance\s*[:\s]+[\d,]+\.?\d*/i,
            /Opening\s*[:\s]+([\d,]+\.?\d*)/i,
            /Previous\s*Balance\s*[:\s]+([\d,]+\.?\d*)/i,
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) {
                const numStr = match[1] || match[0];
                return this.parseAmount(numStr);
            }
        }

        return null;
    }

    /**
     * Extract closing balance from text
     * @param {string} text - Full PDF text
     * @returns {number|null}
     */
    extractClosingBalance(text) {
        const patterns = [
            /Closing\s*Balance\s*[:\s]+([\d,]+\.?\d*)/i,
            /Final\s*Balance\s*[:\s]+([\d,]+\.?\d*)/i,
            /Balance\s*at\s*end\s*[:\s]+([\d,]+\.?\d*)/i,
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                return this.parseAmount(match[1]);
            }
        }

        return null;
    }

    /**
     * Calculate extraction confidence score
     * @param {Object[]} invalidRows - Invalid transaction rows
     * @param {Object[]} validTransactions - Valid transactions
     * @returns {number} Confidence (0-1)
     */
    calculateConfidence(invalidRows, validTransactions) {
        const total = invalidRows.length + validTransactions.length;
        if (total === 0) return 0;
        return validTransactions.length / total;
    }
}

module.exports = PDFStatementParser;
