/*
 * Tax module migration (applied from initFinanceDb()).
 *
 * - Creates the tax_* tables. All statements use IF NOT EXISTS.
 * - Adds investments.interest_rate and investments.compounding. A column is
 *   added only when PRAGMA table_info shows it is missing. Existing rows keep
 *   NULL, which means "no rate yet" (such FDs are reported as missing a rate).
 * - Safe to run more than once.
 */

const TAX_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS tax_profile (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id              INTEGER NOT NULL,
    fy                   TEXT NOT NULL,
    age_band             TEXT NOT NULL DEFAULT 'below60' CHECK(age_band IN ('below60','senior','superSenior')),
    regime_choice        TEXT NOT NULL DEFAULT 'compare' CHECK(regime_choice IN ('old','new','compare')),
    has_business_income  INTEGER NOT NULL DEFAULT 0,
    presumptive_44ad     INTEGER NOT NULL DEFAULT 0,
    salary               REAL NOT NULL DEFAULT 0,
    house_property       REAL NOT NULL DEFAULT 0,
    business_income      REAL NOT NULL DEFAULT 0,
    deductions_json      TEXT,
    tds_tcs              REAL NOT NULL DEFAULT 0,
    filing_months_delay  INTEGER NOT NULL DEFAULT 4,
    notes                TEXT,
    created_at           TEXT DEFAULT (datetime('now')),
    updated_at           TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, fy)
);
CREATE INDEX IF NOT EXISTS idx_tax_profile_user_fy ON tax_profile(user_id, fy);

CREATE TABLE IF NOT EXISTS tax_income_source (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id        INTEGER NOT NULL,
    fy             TEXT NOT NULL,
    kind           TEXT NOT NULL CHECK(kind IN ('interest_savings','interest_deposit','interest_other','dividend','rental','other')),
    label          TEXT,
    amount         REAL NOT NULL,
    investment_id  INTEGER,
    is_override    INTEGER NOT NULL DEFAULT 0,
    meta_json      TEXT,
    created_at     TEXT DEFAULT (datetime('now')),
    updated_at     TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (investment_id) REFERENCES investments(id)
);
CREATE INDEX IF NOT EXISTS idx_tax_income_source_user_fy ON tax_income_source(user_id, fy);

CREATE TABLE IF NOT EXISTS tax_dividend_history (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id        INTEGER NOT NULL,
    fy             TEXT NOT NULL,
    source_label   TEXT NOT NULL,
    amount         REAL NOT NULL,
    created_at     TEXT DEFAULT (datetime('now')),
    updated_at     TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tax_dividend_history_user_fy ON tax_dividend_history(user_id, fy);

CREATE TABLE IF NOT EXISTS tax_capital_gain (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id        INTEGER NOT NULL,
    fy             TEXT NOT NULL,
    asset_class    TEXT NOT NULL,
    category       TEXT NOT NULL,
    description    TEXT,
    sale_date      TEXT NOT NULL,
    purchase_date  TEXT,
    sale_value     REAL,
    cost           REAL,
    gain           REAL NOT NULL,
    source         TEXT NOT NULL DEFAULT 'manual' CHECK(source IN ('manual','cams')),
    fingerprint    TEXT NOT NULL,
    needs_review   INTEGER NOT NULL DEFAULT 0,
    created_at     TEXT DEFAULT (datetime('now')),
    updated_at     TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, fingerprint)
);
CREATE INDEX IF NOT EXISTS idx_tax_capital_gain_user_fy ON tax_capital_gain(user_id, fy);

CREATE TABLE IF NOT EXISTS tax_payment (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id        INTEGER NOT NULL,
    fy             TEXT NOT NULL,
    paid_on        TEXT NOT NULL,
    amount         REAL NOT NULL,
    kind           TEXT NOT NULL CHECK(kind IN ('advance','self_assessment','tds','tcs')),
    reference      TEXT,
    created_at     TEXT DEFAULT (datetime('now')),
    updated_at     TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tax_payment_user_fy ON tax_payment(user_id, fy);
`;

const INVESTMENT_COLUMNS = [
    { name: "interest_rate", definition: "REAL" },
    {
        name: "compounding",
        definition: "TEXT CHECK(compounding IN ('cumulative','payout'))",
    },
];

const TAX_PROFILE_COLUMNS = [
    { name: "reminders_enabled", definition: "INTEGER NOT NULL DEFAULT 0" },
];

function existingColumns(db, table) {
    return new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name));
}

function addMissingColumns(db, table, columns) {
    const present = existingColumns(db, table);
    for (const column of columns) {
        if (!present.has(column.name)) {
            db.exec(`ALTER TABLE ${table} ADD COLUMN ${column.name} ${column.definition}`);
        }
    }
}

function applyTaxSchema(db) {
    db.transaction(() => {
        db.exec(TAX_TABLES_SQL);
        addMissingColumns(db, "investments", INVESTMENT_COLUMNS);
        addMissingColumns(db, "tax_profile", TAX_PROFILE_COLUMNS);
    })();
}

module.exports = { applyTaxSchema };
