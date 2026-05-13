const Database = require("better-sqlite3-multiple-ciphers");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const keytar = require("keytar");
const { getDbDir } = require("../dbPath");

const KEYTAR_SERVICE = "personal-data-finance";
const KEYTAR_ACCOUNT = "finance-db-key";

let financeDb = null;
let financeDbKey = null; // cached after first load

// ── Get or create a stable app-level finance DB key ──────

async function getFinanceKey() {
    if (financeDbKey) return financeDbKey;

    let key = await keytar.getPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT);
    if (!key) {
        // First ever launch — generate and store permanently
        key = crypto.randomBytes(32).toString("hex");
        await keytar.setPassword(KEYTAR_SERVICE, KEYTAR_ACCOUNT, key);
    }

    financeDbKey = key;
    return key;
}

// ── Sync wrapper for IPC handlers ─────────────────────────

function getFinanceDb() {
    if (financeDb) return financeDb;
    throw new Error(
        "[financeDb] DB not initialised — call initFinanceDb() after login first."
    );
}

async function initFinanceDb() {
    if (financeDb) return financeDb;

    const key = await getFinanceKey();
    const dbPath = path.join(getDbDir(), "finance.db");
    const isNew = !fs.existsSync(dbPath);

    financeDb = new Database(dbPath);
    financeDb.pragma(`key="${key}"`);

    if (!isNew) {
        try {
            financeDb.prepare("SELECT 1").get();
        } catch (err) {
            financeDb.close();
            financeDb = null;
            throw new Error(
                `[financeDb] Cannot decrypt existing DB. ${err.message}`
            );
        }
    }

    // ── Migrations ────────────────────────────────────────
    financeDb.exec(`
        CREATE TABLE IF NOT EXISTS bank_master (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            bank_name   TEXT NOT NULL,
            branch_name TEXT NOT NULL,
            city        TEXT NOT NULL,
            created_at  TEXT DEFAULT (datetime('now')),
            updated_at  TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS user_bank_accounts (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id         INTEGER NOT NULL,
            bank_master_id  INTEGER NOT NULL,
            account_number  TEXT,
            account_type    TEXT CHECK(account_type IN ('Savings','Current','NRE','NRO')),
            created_at      TEXT DEFAULT (datetime('now')),
            updated_at      TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (bank_master_id) REFERENCES bank_master(id)
        );
        CREATE TABLE IF NOT EXISTS instrument_types (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            code        TEXT UNIQUE NOT NULL,
            description TEXT NOT NULL,
            created_at  TEXT DEFAULT (datetime('now')),
            updated_at  TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS investment_types (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            code        TEXT UNIQUE NOT NULL,
            description TEXT NOT NULL,
            created_at  TEXT DEFAULT (datetime('now')),
            updated_at  TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS investments (
            id                  INTEGER PRIMARY KEY AUTOINCREMENT,
            investment_ref_id   TEXT NOT NULL,
            user_id             INTEGER NOT NULL,
            account_id          INTEGER NOT NULL,
            instrument_type_id  INTEGER NOT NULL,
            investment_type_id  INTEGER NOT NULL,
            investment_name     TEXT NOT NULL,
            amount              REAL NOT NULL,
            investment_date     TEXT NOT NULL,
            maturity_date       TEXT,
            is_closed           INTEGER DEFAULT 0,
            created_at          TEXT DEFAULT (datetime('now')),
            updated_at          TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (account_id)         REFERENCES user_bank_accounts(id),
            FOREIGN KEY (instrument_type_id) REFERENCES instrument_types(id),
            FOREIGN KEY (investment_type_id) REFERENCES investment_types(id)
        );
    `);

    // ── Seed ──────────────────────────────────────────────
    const insertInstrument = financeDb.prepare(
        `INSERT OR IGNORE INTO instrument_types (code, description) VALUES (?, ?)`
    );
    const insertInvestmentType = financeDb.prepare(
        `INSERT OR IGNORE INTO investment_types (code, description) VALUES (?, ?)`
    );

    for (const s of [
        { code: "FD", description: "Fixed Deposit" },
        { code: "MF", description: "Mutual Funds" },
        { code: "LIC", description: "Life Insurance" },
        { code: "NPS", description: "National Pension Scheme" },
        { code: "MI", description: "Medical Insurance" },
        { code: "ELSS", description: "Equity Linked Savings Scheme" },
        { code: "PPF", description: "Public Provident Fund" },
        { code: "BONDS", description: "Bonds" },
    ])
        insertInstrument.run(s.code, s.description);

    for (const s of [
        { code: "LUMPSUM", description: "Lumpsum / One Time" },
        { code: "SIP", description: "Systematic Investment Plan" },
        { code: "SWP", description: "Systematic Withdrawal Plan" },
        { code: "STP", description: "Systematic Transfer Plan" },
    ])
        insertInvestmentType.run(s.code, s.description);

    return financeDb;
}

function closeFinanceDb() {
    if (financeDb) {
        financeDb.close();
        financeDb = null;
    }
}

module.exports = { getFinanceDb, initFinanceDb, closeFinanceDb };
