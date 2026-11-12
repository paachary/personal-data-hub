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
    ded_80c              REAL NOT NULL DEFAULT 0,
    ded_80d              REAL NOT NULL DEFAULT 0,
    ded_80ccd1b          REAL NOT NULL DEFAULT 0,
    ded_hra              REAL NOT NULL DEFAULT 0,
    ded_24b              REAL NOT NULL DEFAULT 0,
    ded_other            REAL NOT NULL DEFAULT 0,
    use_dividend_forecast INTEGER NOT NULL DEFAULT 0,
    tds_tcs              REAL NOT NULL DEFAULT 0,
    filing_months_delay  INTEGER NOT NULL DEFAULT 1,
    reminders_enabled    INTEGER NOT NULL DEFAULT 0,
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

const LEGACY_PROFILE_TABLE = "tax_profile_legacy";

// Deduction keys used by the pre-v2 deductions_json blob.
const LEGACY_DEDUCTION_COLUMNS = [
    { json: "c80C", column: "ded_80c" },
    { json: "c80D", column: "ded_80d" },
    { json: "c80CCD1B", column: "ded_80ccd1b" },
    { json: "hra", column: "ded_hra" },
    { json: "other", column: "ded_other" },
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

// Moves the legacy tax_profile (deductions_json blob) to the v2 layout.
// Renames the old table first: its index shares the v2 index name, so it is dropped here.
// The copy happens after TAX_TABLES_SQL creates the new table; the legacy table is then removed.
function renameLegacyProfile(db) {
    if (!existingColumns(db, "tax_profile").has("deductions_json")) {
        return false;
    }
    db.exec("DROP INDEX IF EXISTS idx_tax_profile_user_fy");
    db.exec(`ALTER TABLE tax_profile RENAME TO ${LEGACY_PROFILE_TABLE}`);
    return true;
}

function copyLegacyProfile(db) {
    const legacy = existingColumns(db, LEGACY_PROFILE_TABLE);
    const reminders = legacy.has("reminders_enabled") ? "COALESCE(reminders_enabled, 0)" : "0";
    const deductionSelects = LEGACY_DEDUCTION_COLUMNS.map(
        ({ json }) =>
            `CASE WHEN json_valid(deductions_json) THEN COALESCE(CAST(json_extract(deductions_json, '$.${json}') AS REAL), 0) ELSE 0 END`
    );
    const targets = [
        "id", "user_id", "fy", "age_band", "regime_choice", "has_business_income",
        "presumptive_44ad", "salary", "house_property", "business_income",
        ...LEGACY_DEDUCTION_COLUMNS.map((d) => d.column),
        "tds_tcs", "filing_months_delay", "reminders_enabled", "notes", "created_at", "updated_at",
    ];
    const sources = [
        "id", "user_id", "fy", "age_band", "regime_choice", "has_business_income",
        "presumptive_44ad", "salary", "house_property", "business_income",
        ...deductionSelects,
        "tds_tcs", "filing_months_delay", reminders, "notes", "created_at", "updated_at",
    ];
    db.exec(`
        INSERT INTO tax_profile (${targets.join(", ")})
        SELECT ${sources.join(", ")} FROM ${LEGACY_PROFILE_TABLE}
    `);
    db.exec(`DROP TABLE ${LEGACY_PROFILE_TABLE}`);
}

function applyTaxSchema(db) {
    db.transaction(() => {
        const migrateProfile = renameLegacyProfile(db);
        db.exec(TAX_TABLES_SQL);
        addMissingColumns(db, "investments", INVESTMENT_COLUMNS);
        if (migrateProfile) {
            copyLegacyProfile(db);
        }
    })();
}

module.exports = { applyTaxSchema };
