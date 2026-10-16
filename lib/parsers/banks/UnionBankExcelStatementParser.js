const ExcelStatementParser = require("../xlsxParser");

/**
 * Union Bank Excel Statement Parser
 * Extends the generic Excel parser with Union Bank-specific column detection
 * Union Bank uses "Narration" instead of "Description"
 */
class UnionBankExcelStatementParser extends ExcelStatementParser {
    constructor() {
        super("UNION");
    }

    /**
     * Override parse to provide better error messages
     */
    async parse(filePath) {
        try {
            return await super.parse(filePath);
        } catch (error) {
            // If it's a column detection error, provide detailed info
            if (error.message.includes("must have Date and Description")) {
                console.error(
                    `[UNION/xlsx] Column detection failed - try uploading with visible headers`,
                );
            }
            throw error;
        }
    }

    /**
     * Override: Union Bank-specific column detection for Excel files
     * Union Bank uses "Remarks" for description, "Withdrawals"/"Deposits" for debit/credit
     * @param {string[]|Object} headerRow - Header row
     * @returns {Object} Column indices
     */
    getColumnIndices(headerRow) {
        const header = Array.isArray(headerRow)
            ? headerRow
            : Object.values(headerRow);
        const headerLower = header.map((h) =>
            h ? h.toString().toLowerCase().trim() : "",
        );

        console.error(
            `[UNION/xlsx] Header row (first 10): ${header.slice(0, 10).join(" | ")}`,
        );
        console.error(
            `[UNION/xlsx] Header lower: ${headerLower.slice(0, 10).join(" | ")}`,
        );

        // Union Bank-specific column names
        // Union Bank Excel uses: Date, Remarks (not Narration), Withdrawals, Deposits
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
            "amount out",
        ];
        const creditVariations = [
            "deposits",
            "deposit",
            "credit",
            "cr",
            "amount in",
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
                const idx = headerLower.findIndex(
                    (h) => h && h.includes(variation),
                );
                if (idx >= 0) {
                    console.error(
                        `[UNION/xlsx] Found column "${variation}" at index ${idx} (${header[idx]})`,
                    );
                    return idx;
                }
            }
            return -1;
        };

        const result = {
            dateCol: findColumn(dateVariations),
            descCol: findColumn(descVariations),
            debitCol: findColumn(debitVariations),
            creditCol: findColumn(creditVariations),
            balanceCol: findColumn(balanceVariations),
        };

        console.error(`[UNION/xlsx] Final column indices:`, result);
        return result;
    }

    /**
     * Override: Extract Union Bank-specific account metadata from header rows
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
     * Extract Union Bank account number from header text
     * Union Bank patterns: typically 12-16 digits
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
     * Extract customer name from header text
     * @param {string} text - Text to search
     * @returns {string|null} Customer name
     */
    extractCustomerName(text) {
        const patterns = [
            /Customer Name\s*[:\s]+([^\n,]+)/i,
            /Name\s*[:\s]+([^\n,]+)/i,
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

module.exports = UnionBankExcelStatementParser;
