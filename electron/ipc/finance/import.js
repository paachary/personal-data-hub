const { ipcMain, dialog } = require("electron");
const path = require("path");
const { getFinanceDb } = require("../../../database/finance/financeDb");
const { getSession } = require("../auth.js");
const CSVStatementParser = require("../../../lib/parsers/csvParser");
const ExcelStatementParser = require("../../../lib/parsers/xlsxParser");

// Bank-specific CSV parsers
const HDFCStatementParser = require("../../../lib/parsers/banks/HDFCStatementParser");
const ICICIStatementParser = require("../../../lib/parsers/banks/ICICIStatementParser");
const SBIStatementParser = require("../../../lib/parsers/banks/SBIStatementParser");
const UnionBankStatementParser = require("../../../lib/parsers/banks/UnionBankStatementParser");
const StandardCharteredStatementParser = require("../../../lib/parsers/banks/StandardCharteredStatementParser");

// Bank-specific Excel parsers
const HDFCExcelStatementParser = require("../../../lib/parsers/banks/HDFCExcelStatementParser");
const ICICIExcelStatementParser = require("../../../lib/parsers/banks/ICICIExcelStatementParser");
const SBIExcelStatementParser = require("../../../lib/parsers/banks/SBIExcelStatementParser");
const UnionBankExcelStatementParser = require("../../../lib/parsers/banks/UnionBankExcelStatementParser");
const StandardCharteredExcelStatementParser = require("../../../lib/parsers/banks/StandardCharteredExcelStatementParser");

const TransactionAggregator = require("../../../lib/aggregation/transactionAggregator");
const {
    calculateFingerprint,
} = require("../../../lib/validators/statementValidator");

// Bank code to CSV parser mapping
const BANK_CSV_PARSER_MAP = {
    HDFC: HDFCStatementParser,
    ICICI: ICICIStatementParser,
    SBI: SBIStatementParser,
    UNION: UnionBankStatementParser,
    STANCHART: StandardCharteredStatementParser,
};

// Bank code to Excel parser mapping
const BANK_EXCEL_PARSER_MAP = {
    HDFC: HDFCExcelStatementParser,
    ICICI: ICICIExcelStatementParser,
    SBI: SBIExcelStatementParser,
    UNION: UnionBankExcelStatementParser,
    STANCHART: StandardCharteredExcelStatementParser,
};

/**
 * Register import handlers for statement processing
 */
function registerImportHandlers() {
    /**
     * Handler: Open file picker to select statement file
     * Returns file path and metadata
     */
    ipcMain.handle(
        "finance:selectStatementFile",
        async (event, { bankCode, format }) => {
            try {
                const { filePaths, canceled } = await dialog.showOpenDialog({
                    properties: ["openFile"],
                    filters: [
                        {
                            name: "Bank Statements",
                            extensions: ["csv", "xlsx", "xls"],
                        },
                        { name: "CSV Files", extensions: ["csv"] },
                        { name: "Excel Files", extensions: ["xlsx", "xls"] },
                        { name: "All Files", extensions: ["*"] },
                    ],
                });

                if (canceled || filePaths.length === 0) {
                    return {
                        success: false,
                        message: "File selection cancelled",
                    };
                }

                const filePath = filePaths[0];
                const fileName = path.basename(filePath);
                const stats = require("fs").statSync(filePath);

                return {
                    success: true,
                    filePath,
                    fileName,
                    size: stats.size,
                    bankCode,
                    format,
                };
            } catch (error) {
                console.error("[finance:selectStatementFile]", error);
                return { success: false, message: error.message };
            }
        },
    );

    /**
     * Handler: Import statement file
     * Parses file, validates rows, detects duplicates, stores in database
     */
    ipcMain.handle(
        "finance:importStatements",
        async (event, { accountId, bankCode, filePath, format }) => {
            const session = getSession();
            if (!session?.userId) {
                return { success: false, message: "User not authenticated" };
            }

            const db = getFinanceDb();

            try {
                // Validate account ownership
                const account = db
                    .prepare(
                        `SELECT id, user_id FROM user_bank_accounts WHERE id = ?`,
                    )
                    .get(accountId);

                if (!account) {
                    return { success: false, message: "Account not found" };
                }

                if (account.user_id !== session.userId) {
                    return {
                        success: false,
                        message:
                            "Access denied: account does not belong to this user",
                    };
                }

                // Determine parser based on file extension or provided format
                const fileExt = path.extname(filePath).toLowerCase().slice(1);
                const detectedFormat = format || fileExt;

                // PDF format not currently supported
                if (detectedFormat === "pdf") {
                    return {
                        success: false,
                        message:
                            "PDF format is not currently supported. Please use CSV or Excel files.",
                    };
                }

                // Select parser: use bank-specific parser if available
                let ParserClass;

                if (detectedFormat === "csv") {
                    // For CSV, use bank-specific parser if available (has bank-specific column detection)
                    const BankCSVParser = BANK_CSV_PARSER_MAP[bankCode];
                    ParserClass = BankCSVParser || CSVStatementParser;
                } else if (["xlsx", "xls"].includes(detectedFormat)) {
                    // For Excel, use bank-specific parser if available (has bank-specific column detection)
                    const BankExcelParser = BANK_EXCEL_PARSER_MAP[bankCode];
                    ParserClass = BankExcelParser || ExcelStatementParser;
                } else {
                    return {
                        success: false,
                        message: `Unsupported file format: ${detectedFormat}`,
                    };
                }

                // Parse statement file
                console.error(
                    `[finance:importStatements] Format: ${detectedFormat}, Bank: ${bankCode}, Parser: ${ParserClass.name}`,
                );

                let parsed;
                try {
                    const parser = new ParserClass(bankCode);
                    parsed = await parser.parse(filePath);
                } catch (parseError) {
                    console.error(
                        `[finance:importStatements] ❌ Parse failed:`,
                        parseError.message,
                    );
                    console.error(
                        `[finance:importStatements] Stack:`,
                        parseError.stack,
                    );
                    return {
                        success: false,
                        message: `Parse error: ${parseError.message}`,
                    };
                }

                if (!parsed || !parsed.transactions) {
                    return {
                        success: false,
                        message: "Failed to parse statement file",
                    };
                }

                // Create statement metadata record
                const statementId = db
                    .prepare(
                        `
                INSERT INTO statements 
                (user_id, account_id, bank_code, file_name, start_date, end_date, 
                 opening_balance, closing_balance, total_debits, total_credits, row_count, import_status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
                    )
                    .run(
                        session.userId,
                        accountId,
                        bankCode,
                        path.basename(filePath),
                        parsed.summary.startDate,
                        parsed.summary.endDate,
                        parsed.summary.openingBalance,
                        parsed.summary.closingBalance,
                        parsed.summary.totalDebits,
                        parsed.summary.totalCredits,
                        parsed.transactions.length,
                        "success",
                    ).lastInsertRowid;

                // console.log(
                //     `[finance:importStatements] Created statement record: ${statementId}`,
                // );

                // Store raw data for audit trail
                if (parsed.rawData && parsed.rawData.length > 0) {
                    const rawDataStmt = db.prepare(`
                    INSERT INTO statement_raw_data (statement_id, line_number, raw_row_json)
                    VALUES (?, ?, ?)
                `);

                    for (const rawRow of parsed.rawData) {
                        rawDataStmt.run(
                            statementId,
                            rawRow.lineNumber,
                            JSON.stringify(rawRow.rawRow),
                        );
                    }

                    // console.log(
                    //     `[finance:importStatements] Stored ${parsed.rawData.length} raw data records`,
                    // );
                }

                // Import transactions with duplicate detection
                const transactionStmt = db.prepare(`
                INSERT INTO transactions 
                (statement_id, account_id, date, description, debit, credit, balance, fingerprint_hash)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);

                let imported = 0;
                let skipped = 0;
                const duplicates = [];
                const errors = [];

                for (const txn of parsed.transactions) {
                    try {
                        const fingerprint = calculateFingerprint(txn);

                        // Check for existing duplicate
                        const existing = db
                            .prepare(
                                `
                        SELECT id FROM transactions 
                        WHERE fingerprint_hash = ? AND account_id = ?
                    `,
                            )
                            .get(fingerprint, accountId);

                        if (existing) {
                            skipped++;
                            duplicates.push({
                                date: txn.date,
                                description: txn.description,
                                amount: txn.debit || txn.credit,
                            });
                            continue;
                        }

                        // Insert transaction
                        transactionStmt.run(
                            statementId,
                            accountId,
                            txn.date,
                            txn.description,
                            txn.debit || 0,
                            txn.credit || 0,
                            txn.balance || null,
                            fingerprint,
                        );

                        imported++;
                    } catch (err) {
                        errors.push({
                            date: txn.date,
                            description: txn.description,
                            error: err.message,
                        });
                    }
                }

                // console.log(
                //     `[finance:importStatements] Imported: ${imported}, Skipped: ${skipped}, Errors: ${errors.length}`,
                // );

                // Post-import: Aggregate transactions for trend analysis
                // console.log(
                //     `[finance:importStatements] Aggregating transactions for account ${accountId}`,
                // );
                const aggregator = new TransactionAggregator(db);
                const aggregationResult =
                    aggregator.aggregateTransactions(accountId);
                // console.log(
                //     `[finance:importStatements] Aggregation complete:`,
                //     aggregationResult,
                // );

                // Validation errors from parsing
                const parsingErrors = parsed.validationErrors || [];

                return {
                    success: true,
                    statementId,
                    imported,
                    skipped,
                    duplicates: duplicates.length,
                    errors: errors.length,
                    parsingErrors: parsingErrors.slice(0, 10), // Return first 10 parsing errors
                    message: `Successfully imported ${imported} transactions (${skipped} duplicates skipped, ${errors.length} errors)`,
                };
            } catch (error) {
                console.error("[finance:importStatements] Error:", error);
                return { success: false, message: error.message };
            }
        },
    );

    /**
     * Handler: Get list of imported statements for an account
     */
    ipcMain.handle("finance:getStatements", (event, { accountId }) => {
        const session = getSession();
        if (!session?.userId) return [];

        const db = getFinanceDb();

        // Verify account ownership
        const account = db
            .prepare(`SELECT id, user_id FROM user_bank_accounts WHERE id = ?`)
            .get(accountId);

        if (!account || account.user_id !== session.userId) {
            return [];
        }

        return db
            .prepare(
                `
            SELECT id, bank_code, file_name, import_date, start_date, end_date,
                   opening_balance, closing_balance, total_debits, total_credits,
                   row_count, import_status
            FROM statements
            WHERE account_id = ?
            ORDER BY import_date DESC
        `,
            )
            .all(accountId);
    });

    /**
     * Handler: Get transactions from a specific statement
     */
    ipcMain.handle(
        "finance:getStatementTransactions",
        (event, { statementId, accountId }) => {
            const session = getSession();
            if (!session?.userId) return [];

            const db = getFinanceDb();

            // Verify account ownership
            const account = db
                .prepare(
                    `SELECT id, user_id FROM user_bank_accounts WHERE id = ?`,
                )
                .get(accountId);

            if (!account || account.user_id !== session.userId) {
                return [];
            }

            return db
                .prepare(
                    `
            SELECT id, date, description, debit, credit, balance
            FROM transactions
            WHERE statement_id = ? AND account_id = ?
            ORDER BY date ASC
        `,
                )
                .all(statementId, accountId);
        },
    );

    /**
     * Handler: Get trend data for account
     */
    ipcMain.handle(
        "finance:getTrendData",
        (event, { accountId, period, fromDate, toDate }) => {
            const session = getSession();
            if (!session?.userId) return [];

            const db = getFinanceDb();

            // Verify account ownership
            const account = db
                .prepare(
                    `SELECT id, user_id FROM user_bank_accounts WHERE id = ?`,
                )
                .get(accountId);

            if (!account || account.user_id !== session.userId) {
                return [];
            }

            try {
                const aggregator = new TransactionAggregator(db);
                return aggregator.getTrendData(
                    accountId,
                    period,
                    fromDate,
                    toDate,
                );
            } catch (error) {
                console.error("[finance:getTrendData]", error);
                return [];
            }
        },
    );

    /**
     * Handler: Clear all statement data for a specific account (or all accounts for admin)
     */
    ipcMain.handle(
        "finance:clearStatementData",
        async (event, { accountId } = {}) => {
            const session = getSession();
            if (!session?.userId) {
                return { success: false, message: "User not authenticated" };
            }

            const db = getFinanceDb();

            // Helper: safely delete from a table if it exists
            const safeDelete = (query, params = []) => {
                try {
                    db.prepare(query).run(...params);
                } catch (e) {
                    if (!e.message.includes("no such table")) {
                        throw e; // re-throw non-table errors
                    }
                    // Silently ignore "no such table" errors
                }
            };

            try {
                if (accountId) {
                    // Clear a specific account's data only
                    const stmtIds = db
                        .prepare(
                            `SELECT id FROM statements WHERE account_id = ?`,
                        )
                        .all(accountId)
                        .map((r) => r.id);

                    if (stmtIds.length > 0) {
                        const placeholders = stmtIds.map(() => "?").join(",");
                        safeDelete(
                            `DELETE FROM statement_raw_data WHERE statement_id IN (${placeholders})`,
                            stmtIds,
                        );
                        safeDelete(
                            `DELETE FROM transactions WHERE statement_id IN (${placeholders})`,
                            stmtIds,
                        );
                    }
                    safeDelete(
                        `DELETE FROM transaction_summaries_daily WHERE account_id = ?`,
                        [accountId],
                    );
                    safeDelete(
                        `DELETE FROM transaction_summaries_weekly WHERE account_id = ?`,
                        [accountId],
                    );
                    safeDelete(
                        `DELETE FROM transaction_summaries_monthly WHERE account_id = ?`,
                        [accountId],
                    );
                    safeDelete(
                        `DELETE FROM transaction_summaries_yearly WHERE account_id = ?`,
                        [accountId],
                    );
                    safeDelete(`DELETE FROM statements WHERE account_id = ?`, [
                        accountId,
                    ]);
                } else {
                    // Admin: clear all statement data for this user's accounts
                    const userAccountIds = db
                        .prepare(
                            `SELECT id FROM user_bank_accounts WHERE user_id = ?`,
                        )
                        .all(session.userId)
                        .map((r) => r.id);

                    for (const aid of userAccountIds) {
                        const stmtIds = db
                            .prepare(
                                `SELECT id FROM statements WHERE account_id = ?`,
                            )
                            .all(aid)
                            .map((r) => r.id);

                        if (stmtIds.length > 0) {
                            const placeholders = stmtIds
                                .map(() => "?")
                                .join(",");
                            safeDelete(
                                `DELETE FROM statement_raw_data WHERE statement_id IN (${placeholders})`,
                                stmtIds,
                            );
                            safeDelete(
                                `DELETE FROM transactions WHERE statement_id IN (${placeholders})`,
                                stmtIds,
                            );
                        }
                        safeDelete(
                            `DELETE FROM transaction_summaries_daily WHERE account_id = ?`,
                            [aid],
                        );
                        safeDelete(
                            `DELETE FROM transaction_summaries_weekly WHERE account_id = ?`,
                            [aid],
                        );
                        safeDelete(
                            `DELETE FROM transaction_summaries_monthly WHERE account_id = ?`,
                            [aid],
                        );
                        safeDelete(
                            `DELETE FROM transaction_summaries_yearly WHERE account_id = ?`,
                            [aid],
                        );
                        safeDelete(
                            `DELETE FROM statements WHERE account_id = ?`,
                            [aid],
                        );
                    }
                }

                // console.log(
                //     `[finance:clearStatementData] Cleared data for account: ${accountId ?? "all"}`,
                // );
                return { success: true };
            } catch (error) {
                console.error("[finance:clearStatementData]", error);
                return { success: false, message: error.message };
            }
        },
    );
}

module.exports = { registerImportHandlers };
