const Database = require("better-sqlite3");
const { app } = require("electron");
const path = require("path");
const fs = require("fs");
const { getDbDir } = require("../dbPath");

let masterDb = null;

function getMasterDb() {
    if (masterDb) return masterDb;

    const dbPath = path.join(getDbDir(), "master.db");

    masterDb = new Database(dbPath);

    masterDb.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            first_name      TEXT,
            last_name       TEXT,
            username        TEXT UNIQUE,
            email           TEXT ,
            phone           TEXT,
            address_line1   TEXT,
            address_line2   TEXT,
            city            TEXT,
            state           TEXT,
            zip             TEXT,
            country         TEXT,
            salt            TEXT,
            password_hash   TEXT,
            vault_path      TEXT,
            requires_password_reset INTEGER DEFAULT 0,
            is_admin        INTEGER DEFAULT 0,    -- ← 0 = regular, 1 = admin
            mfa_secret TEXT DEFAULT NULL,           -- ← new column for MFA secret
            mfa_enabled INTEGER DEFAULT 0,            -- ← new column to indicate if MFA is enabled
            created_at      TEXT DEFAULT (datetime('now')) ,
            updated_at      TEXT

        );
    `);

    // ── Migration: add is_admin if not exists ─────────────
    const cols = masterDb.prepare(`PRAGMA table_info(users)`).all();

    const hasPhone = cols.some((c) => c.name === "phone");
    if (!hasPhone)
        masterDb.exec(`ALTER TABLE users ADD COLUMN phone TEXT DEFAULT NULL`);

    const hasAdmin = cols.some((c) => c.name === "is_admin");
    if (!hasAdmin)
        masterDb.exec(
            `ALTER TABLE users ADD COLUMN is_admin INTEGER DEFAULT 0`
        );

    const hasMfaSecret = cols.some((c) => c.name === "mfa_secret");
    if (!hasMfaSecret)
        masterDb.exec(
            `ALTER TABLE users ADD COLUMN mfa_secret TEXT DEFAULT NULL`
        );

    const hasMfaEnabled = cols.some((c) => c.name === "mfa_enabled");
    if (!hasMfaEnabled)
        masterDb.exec(
            `ALTER TABLE users ADD COLUMN mfa_enabled INTEGER DEFAULT 0`
        );

    const hasReset = cols.some((c) => c.name === "requires_password_reset");
    if (!hasReset)
        masterDb.exec(
            `ALTER TABLE users ADD COLUMN requires_password_reset INTEGER DEFAULT 0`
        );

    const hasCreatedAt = cols.some((c) => c.name === "created_at");
    if (!hasCreatedAt)
        masterDb.exec(
            `ALTER TABLE users ADD COLUMN created_at TEXT DEFAULT NULL`
        );

    const hasUpdatedAt = cols.some((c) => c.name === "updated_at"); // ← add
    if (!hasUpdatedAt)
        masterDb.exec(
            `ALTER TABLE users ADD COLUMN updated_at TEXT DEFAULT NULL`
        );

    masterDb.exec(`
        CREATE TABLE IF NOT EXISTS todos (
            id              TEXT PRIMARY KEY,
            title           TEXT NOT NULL,
            notes           TEXT,
            priority        TEXT DEFAULT 'medium',   -- low | medium | high
            status          TEXT DEFAULT 'pending',  -- pending | done
            due_date        TEXT,
            remind_at       TEXT,                    -- ISO datetime for notification
            reminded        INTEGER DEFAULT 0,       -- 1 = notification already sent
            source          TEXT DEFAULT 'manual',   -- manual | vault
            source_ref      TEXT,                    -- vault entry id if auto-generated
            created_at      TEXT DEFAULT (datetime('now')),
            updated_at      TEXT DEFAULT (datetime('now'))
        );
    `);

    return masterDb;
}

module.exports = { getMasterDb };
