const { ipcMain } = require("electron");
const { getMasterDb } = require("../../../database/master/masterdb"); // ← add

const { getFinanceDb } = require("../../../database/finance/financeDb");
const { getSession } = require("../auth.js");

function requireAdmin() {
    const session = getSession();
    if (!session.isAdmin) throw new Error("Admin access required.");
}

function registerInvestmentHandlers() {
    // ── Lookup data ───────────────────────────────────────

    ipcMain.handle("finance:getInstrumentTypes", () => {
        return getFinanceDb()
            .prepare(`SELECT * FROM instrument_types ORDER BY code`)
            .all();
    });

    ipcMain.handle("finance:getInvestmentTypes", () => {
        return getFinanceDb()
            .prepare(`SELECT * FROM investment_types ORDER BY code`)
            .all();
    });

    ipcMain.handle(
        "finance:addInstrumentType",
        (event, { code, description }) => {
            requireAdmin(); // ← guard

            const db = getFinanceDb();
            const result = db
                .prepare(
                    `INSERT OR IGNORE INTO instrument_types (code, description) VALUES (?, ?)`
                )
                .run(code.toUpperCase(), description);
            return { success: true, id: result.lastInsertRowid };
        }
    );

    // ── Investments CRUD ──────────────────────────────────

    ipcMain.handle("investments:getByUser", (event, user_id) => {
        const db = getFinanceDb();
        return db
            .prepare(
                `
            SELECT
                i.*,
                it.code  AS instrument_code,
                it.description AS instrument_desc,
                ivt.code AS investment_type_code,
                ivt.description AS investment_type_desc,
                bm.bank_name,
                bm.branch_name,
                bm.city,
                uba.account_number,
                uba.account_type,
                CASE
                    WHEN i.maturity_date IS NOT NULL
                     AND i.maturity_date < date('now') THEN 1
                    ELSE 0
                END AS is_closed
            FROM investments i
            JOIN instrument_types    it  ON i.instrument_type_id  = it.id
            JOIN investment_types    ivt ON i.investment_type_id   = ivt.id
            JOIN user_bank_accounts  uba ON i.account_id           = uba.id
            JOIN bank_master         bm  ON uba.bank_master_id     = bm.id
            WHERE i.user_id = ?
            ORDER BY i.investment_date DESC
        `
            )
            .all(user_id);
    });

    ipcMain.handle("investments:add", (event, payload) => {
        const db = getFinanceDb();
        const {
            investment_ref_id,
            user_id,
            account_id,
            instrument_type_id,
            investment_type_id,
            investment_name,
            amount,
            investment_date,
            maturity_date,
        } = payload;

        const result = db
            .prepare(
                `
            INSERT INTO investments
                (investment_ref_id, user_id, account_id, instrument_type_id, investment_type_id,
                 investment_name, amount, investment_date, maturity_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
            )
            .run(
                investment_ref_id,
                user_id,
                account_id,
                instrument_type_id,
                investment_type_id,
                investment_name,
                amount,
                investment_date,
                maturity_date || null
            );
        return { success: true, id: result.lastInsertRowid };
    });

    ipcMain.handle("investments:update", (event, payload) => {
        const db = getFinanceDb();
        const {
            id,
            account_id,
            instrument_type_id,
            investment_type_id,
            investment_name,
            amount,
            investment_date,
            maturity_date,
        } = payload;

        db.prepare(
            `
            UPDATE investments SET
                account_id=?, instrument_type_id=?, investment_type_id=?,
                investment_name=?, amount=?, investment_date=?, maturity_date=?,
                updated_at=datetime('now')
            WHERE id=?
        `
        ).run(
            account_id,
            instrument_type_id,
            investment_type_id,
            investment_name,
            amount,
            investment_date,
            maturity_date || null,
            id
        );
        return { success: true };
    });

    ipcMain.handle("investments:delete", (event, id) => {
        getFinanceDb().prepare(`DELETE FROM investments WHERE id=?`).run(id);
        return { success: true };
    });

    ipcMain.handle(
        "finance:updateInstrumentType",
        (event, { id, code, description }) => {
            requireAdmin();
            getFinanceDb()
                .prepare(
                    `UPDATE instrument_types SET code=?, description=?, updated_at=datetime('now') WHERE id=?`
                )
                .run(code, description, id);
            return { success: true };
        }
    );

    ipcMain.handle("finance:deleteInstrumentType", (event, id) => {
        requireAdmin();
        getFinanceDb()
            .prepare(`DELETE FROM instrument_types WHERE id=?`)
            .run(id);
        return { success: true };
    });

    ipcMain.handle(
        "finance:addInvestmentType",
        (event, { code, description }) => {
            requireAdmin();
            const result = getFinanceDb()
                .prepare(
                    `INSERT OR IGNORE INTO investment_types (code, description) VALUES (?, ?)`
                )
                .run(code, description);
            return { success: true, id: result.lastInsertRowid };
        }
    );

    ipcMain.handle(
        "finance:updateInvestmentType",
        (event, { id, code, description }) => {
            requireAdmin();
            getFinanceDb()
                .prepare(
                    `UPDATE investment_types SET code=?, description=?, updated_at=datetime('now') WHERE id=?`
                )
                .run(code, description, id);
            return { success: true };
        }
    );

    ipcMain.handle("finance:deleteInvestmentType", (event, id) => {
        requireAdmin();
        getFinanceDb()
            .prepare(`DELETE FROM investment_types WHERE id=?`)
            .run(id);
        return { success: true };
    });

    ipcMain.handle("investments:getAllUsers", () => {
        const financeDb = getFinanceDb();
        const masterDb = getMasterDb();
        const masterPath = masterDb.name;

        financeDb.exec(`ATTACH DATABASE '${masterPath}' AS masterdb KEY ''`); // ← KEY '' for unencrypted

        const rows = financeDb
            .prepare(
                `
            SELECT
                inv.*,
                uba.account_number,
                uba.account_type,
                bm.bank_name,
                bm.branch_name,
                bm.city,
                inst.code AS instrument_code,
                it.code   AS investment_type_code,
                u.username,
                u.first_name,
                u.last_name
            FROM investments inv
            JOIN user_bank_accounts uba ON inv.account_id          = uba.id
            JOIN bank_master         bm ON uba.bank_master_id      = bm.id
            JOIN instrument_types  inst ON inv.instrument_type_id  = inst.id
            JOIN investment_types    it ON inv.investment_type_id  = it.id
            JOIN masterdb.users       u ON inv.user_id             = u.id
            ORDER BY u.username, inv.investment_date DESC
        `
            )
            .all();

        financeDb.exec(`DETACH DATABASE masterdb`);
        return rows;
    });
}

module.exports = { registerInvestmentHandlers };
