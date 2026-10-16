const ExcelStatementParser = require("../xlsxParser");

/**
 * HDFC Bank Excel Statement Parser
 * Extends the generic Excel parser with HDFC-specific column detection
 * HDFC uses "Withdrawal" and "Deposit" columns
 */
class HDFCExcelStatementParser extends ExcelStatementParser {
    constructor() {
        super("HDFC");
    }

    /**
     * Override: HDFC-specific column detection for Excel files
     * HDFC uses "Withdrawal", "Deposit" instead of "Debit", "Credit"
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
            "remarks",
            "description",
            "narration",
            "details",
            "particulars",
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
     * Override: Extract HDFC-specific account metadata
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
     * @param {string} text - Text to search
     * @returns {string|null} Account number
     */
    extractHDFCAccountNumber(text) {
        const patterns = [
            /Account\s*(?:No\.?|Number)\s*[:\s]+(\d{10,16})/i,
            /A\.C\s*[:\s]+(\d{10,16})/i,
            /Account\s*[:\s]+(\d{10,16})/i,
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
     * Extract customer name from header
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

module.exports = HDFCExcelStatementParser;
