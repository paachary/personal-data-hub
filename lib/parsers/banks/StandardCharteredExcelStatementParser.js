const ExcelStatementParser = require("../xlsxParser");

/**
 * Standard Chartered Bank Excel Statement Parser
 * Extends the generic Excel parser with Standard Chartered-specific column detection
 */
class StandardCharteredExcelStatementParser extends ExcelStatementParser {
    constructor() {
        super("STANCHART");
    }

    /**
     * Override: Standard Chartered-specific column detection for Excel files
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

        // Standard Chartered-specific column names
        const dateVariations = [
            "date",
            "transaction date",
            "posting date",
            "value date",
        ];
        const descVariations = [
            "remarks",
            "narration",
            "description",
            "details",
            "particulars",
        ];
        const debitVariations = ["debit", "dr", "withdrawals", "withdrawal"];
        const creditVariations = ["credit", "cr", "deposits", "deposit"];
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
     * Override: Extract Standard Chartered-specific account metadata
     * @param {Array[]} headerRows - Rows before data table
     * @returns {Object} Account metadata
     */
    extractAccountMetadata(headerRows) {
        const text = headerRows.flat().join(" ");

        return {
            bankName: "Standard Chartered Bank",
            accountNumber: this.extractStandardCharteredAccountNumber(text),
            customerName: this.extractCustomerName(text),
            customerId: null,
        };
    }

    /**
     * Extract Standard Chartered account number
     * @param {string} text - Text to search
     * @returns {string|null} Account number
     */
    extractStandardCharteredAccountNumber(text) {
        const patterns = [
            /Account\s*(?:No\.?|Number)\s*[:\s]+(\d{10,16})/i,
            /A\.C\s*[:\s]+(\d{10,16})/i,
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
     * Extract customer name
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

module.exports = StandardCharteredExcelStatementParser;
