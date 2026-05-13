const { ipcMain } = require("electron");
const { getMasterDb } = require("../../../database/master/masterdb"); // ← add

const { getFinanceDb } = require("../../../database/finance/financeDb");
const { getSession } = require("../auth.js");

function requireAdmin() {
    const session = getSession();
    if (!session.isAdmin) throw new Error("Admin access required.");
}

function registerBankHandlers() {
    // ── Bank Master CRUD ──────────────────────────────────

    ipcMain.handle("banks:getAll", () => {
        const session = getSession();
        if (!session?.userId) return { success: false, banks: [] };
        const db = getFinanceDb();
        return db.prepare(`SELECT * FROM bank_master ORDER BY bank_name`).all();
    });

    ipcMain.handle("banks:add", (event, { bank_name, branch_name, city }) => {
        requireAdmin();
        const db = getFinanceDb();
        const stmt = db.prepare(
            `INSERT INTO bank_master (bank_name, branch_name, city) VALUES (?, ?, ?)`
        );
        const result = stmt.run(bank_name, branch_name, city);
        return { success: true, id: result.lastInsertRowid };
    });

    ipcMain.handle(
        "banks:update",
        (event, { id, bank_name, branch_name, city }) => {
            requireAdmin();
            const db = getFinanceDb();
            db.prepare(
                `UPDATE bank_master SET bank_name=?, branch_name=?, city=?, updated_at=datetime('now') WHERE id=?`
            ).run(bank_name, branch_name, city, id);
            return { success: true };
        }
    );

    ipcMain.handle("banks:delete", (event, id) => {
        requireAdmin();
        const db = getFinanceDb();
        db.prepare(`DELETE FROM bank_master WHERE id=?`).run(id);
        return { success: true };
    });

    // ── User Bank Accounts ────────────────────────────────

    ipcMain.handle("accounts:getByUser", (event, user_id) => {
        const db = getFinanceDb();
        return db
            .prepare(
                `
            SELECT uba.*, bm.bank_name, bm.branch_name, bm.city
            FROM user_bank_accounts uba
            JOIN bank_master bm ON uba.bank_master_id = bm.id
            WHERE uba.user_id = ?
            ORDER BY bm.bank_name
        `
            )
            .all(user_id);
    });

    ipcMain.handle(
        "accounts:add",
        (event, { user_id, bank_master_id, account_number, account_type }) => {
            const db = getFinanceDb();
            const result = db
                .prepare(
                    `INSERT INTO user_bank_accounts (user_id, bank_master_id, account_number, account_type)
             VALUES (?, ?, ?, ?)`
                )
                .run(user_id, bank_master_id, account_number, account_type);
            return { success: true, id: result.lastInsertRowid };
        }
    );

    ipcMain.handle(
        "accounts:update",
        (event, { id, bank_master_id, account_number, account_type }) => {
            const db = getFinanceDb();
            db.prepare(
                `UPDATE user_bank_accounts SET bank_master_id=?, account_number=?, account_type=?, updated_at=datetime('now')
             WHERE id=?`
            ).run(bank_master_id, account_number, account_type, id);
            return { success: true };
        }
    );

    ipcMain.handle("accounts:delete", (event, id) => {
        const db = getFinanceDb();
        db.prepare(`DELETE FROM user_bank_accounts WHERE id=?`).run(id);
        return { success: true };
    });

    ipcMain.handle("banks:getAllUsers", () => {
        // ── Get finance data ──────────────────────────────
        const financeDb = getFinanceDb();
        const rows = financeDb
            .prepare(
                `SELECT uba.id, uba.user_id, uba.account_number, uba.account_type,
                        bm.bank_name, bm.branch_name, bm.city
                 FROM user_bank_accounts uba
                 JOIN bank_master bm ON uba.bank_master_id = bm.id
                 ORDER BY bm.bank_name`
            )
            .all();

        // ── Enrich with user info from master DB ──────────
        const masterDb = getMasterDb();
        return rows.map((row) => {
            const user = masterDb
                .prepare(
                    `SELECT username, first_name, last_name FROM users WHERE id = ?`
                )
                .get(row.user_id);
            return { ...row, ...user };
        });
    });
}

module.exports = { registerBankHandlers };
