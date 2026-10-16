const XLSX = require("xlsx");

/**
 * Exports investments data to an Excel workbook
 * @param {Array} investments - Array of investment objects
 * @param {boolean} isAdmin - Whether to include User column (admin view)
 * @returns {Object} Excel workbook object ready to write
 */
function createInvestmentsWorkbook(investments, isAdmin = false) {
    // Prepare headers based on view type
    const headers = isAdmin
        ? [
              "User",
              "Ref ID",
              "Investment Name",
              "Bank",
              "Branch",
              "Instrument",
              "Type",
              "Amount (₹)",
              "Invested On",
              "Maturity Date",
              "Status",
          ]
        : [
              "Ref ID",
              "Investment Name",
              "Bank",
              "Branch",
              "Instrument",
              "Type",
              "Amount (₹)",
              "Invested On",
              "Maturity Date",
              "Status",
          ];

    // Transform data into rows
    const rows = investments.map((inv) => {
        const row = isAdmin ? [getUserDisplayName(inv)] : [];
        return row.concat([
            inv.investment_ref_id || "",
            inv.investment_name || "",
            inv.bank_name || "",
            inv.branch_name || "",
            inv.instrument_code || "",
            inv.investment_type_code || "",
            inv.amount || 0, // Will be formatted as currency by Excel
            inv.investment_date || "",
            inv.maturity_date || "",
            inv.is_closed ? "Closed" : "Active",
        ]);
    });

    // Add total row
    const amountColIndex = isAdmin ? 7 : 6;
    const totalRow = new Array(isAdmin ? 11 : 10).fill("");
    totalRow[amountColIndex - 1] = "TOTAL";
    totalRow[amountColIndex] = {
        f: `SUM(${getColumnLetter(amountColIndex)}2:${getColumnLetter(
            amountColIndex
        )}${rows.length + 1})`,
        t: "n",
    };
    rows.push(totalRow);

    // Create worksheet
    const wsData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Format column widths
    const colWidths = isAdmin
        ? [
              { wch: 20 }, // User
              { wch: 15 }, // Ref ID
              { wch: 25 }, // Investment Name
              { wch: 18 }, // Bank
              { wch: 15 }, // Branch
              { wch: 12 }, // Instrument
              { wch: 12 }, // Type
              { wch: 15 }, // Amount
              { wch: 15 }, // Invested On
              { wch: 15 }, // Maturity Date
              { wch: 12 }, // Status
          ]
        : [
              { wch: 15 }, // Ref ID
              { wch: 25 }, // Investment Name
              { wch: 18 }, // Bank
              { wch: 15 }, // Branch
              { wch: 12 }, // Instrument
              { wch: 12 }, // Type
              { wch: 15 }, // Amount
              { wch: 15 }, // Invested On
              { wch: 15 }, // Maturity Date
              { wch: 12 }, // Status
          ];
    ws["!cols"] = colWidths;

    // Style header row (bold)
    const headerRowCells = [];
    for (let i = 0; i < headers.length; i++) {
        const cellRef = XLSX.utils.encode_col(i) + "1";
        headerRowCells.push(cellRef);
        ws[cellRef].s = {
            font: { bold: true },
            fill: { fgColor: { rgb: "D3D3D3" } },
        };
    }

    // Style total row (bold)
    const totalRowNum = rows.length + 1;
    for (let i = 0; i < headers.length; i++) {
        const cellRef = XLSX.utils.encode_col(i) + totalRowNum;
        if (ws[cellRef]) {
            ws[cellRef].s = { font: { bold: true } };
        }
    }

    // Format amount column as currency
    for (let i = 2; i <= rows.length; i++) {
        const cellRef =
            XLSX.utils.encode_col(amountColIndex) + i;
        if (ws[cellRef]) {
            ws[cellRef].z = '#,##0.00';
        }
    }

    // Create workbook and add worksheet
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Investments");

    return wb;
}

/**
 * Helper to get column letter from index
 * @param {number} col - 0-based column index
 * @returns {string} Column letter (A, B, C, etc.)
 */
function getColumnLetter(col) {
    let letter = "";
    while (col >= 0) {
        letter = String.fromCharCode(65 + (col % 26)) + letter;
        col = Math.floor(col / 26) - 1;
    }
    return letter;
}

/**
 * Helper to format user display name
 * @param {Object} inv - Investment object with user info
 * @returns {string} Formatted user name with username
 */
function getUserDisplayName(inv) {
    if (inv.first_name && inv.last_name) {
        return `${inv.first_name} ${inv.last_name} (@${inv.username || ""})`;
    }
    return inv.username || "";
}

/**
 * Generate a filename with today's date and username
 * @param {string} username - The logged-in username
 * @returns {string} Filename in format: investments-username-YYYY-MM-DD.xlsx
 */
function generateFilename(username = "export") {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `investments-${username}-${year}-${month}-${day}.xlsx`;
}

module.exports = {
    createInvestmentsWorkbook,
    generateFilename,
};
