"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const Database = require("better-sqlite3");
const { applyTaxSchema } = require("../../../database/finance/taxSchema");

function legacyDb() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE investments (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL);
    CREATE TABLE tax_profile (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      fy TEXT NOT NULL,
      age_band TEXT NOT NULL DEFAULT 'below60',
      regime_choice TEXT NOT NULL DEFAULT 'compare',
      has_business_income INTEGER NOT NULL DEFAULT 0,
      presumptive_44ad INTEGER NOT NULL DEFAULT 0,
      salary REAL NOT NULL DEFAULT 0,
      house_property REAL NOT NULL DEFAULT 0,
      business_income REAL NOT NULL DEFAULT 0,
      deductions_json TEXT,
      tds_tcs REAL NOT NULL DEFAULT 0,
      filing_months_delay INTEGER NOT NULL DEFAULT 4,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, fy)
    );
    CREATE INDEX idx_tax_profile_user_fy ON tax_profile(user_id, fy);
  `);
  return db;
}

test("migration moves deductions_json into ded_* columns and drops the legacy table", () => {
  const db = legacyDb();
  db.prepare(
    `INSERT INTO tax_profile (user_id, fy, salary, tds_tcs, deductions_json)
     VALUES (1, '2025-26', 1200000, 500, ?)`,
  ).run(JSON.stringify({ c80C: 150000, c80D: 25000, c80CCD1B: 50000, hra: 60000, other: 1000 }));
  db.prepare(
    `INSERT INTO tax_profile (user_id, fy, salary, deductions_json) VALUES (2, '2025-26', 500000, 'not json')`,
  ).run();

  applyTaxSchema(db);

  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='tax_profile_legacy'").all();
  assert.equal(tables.length, 0);
  const cols = db.prepare("PRAGMA table_info(tax_profile)").all().map((c) => c.name);
  assert.ok(!cols.includes("deductions_json"));
  assert.ok(cols.includes("ded_24b"));
  assert.ok(cols.includes("use_dividend_forecast"));

  const a = db.prepare("SELECT * FROM tax_profile WHERE user_id = 1").get();
  assert.equal(a.salary, 1200000);
  assert.equal(a.tds_tcs, 500);
  assert.equal(a.ded_80c, 150000);
  assert.equal(a.ded_80d, 25000);
  assert.equal(a.ded_80ccd1b, 50000);
  assert.equal(a.ded_hra, 60000);
  assert.equal(a.ded_other, 1000);
  assert.equal(a.ded_24b, 0);
  assert.equal(a.use_dividend_forecast, 0);

  const b = db.prepare("SELECT * FROM tax_profile WHERE user_id = 2").get();
  assert.equal(b.ded_80c, 0);
  assert.equal(b.ded_hra, 0);
});

test("migration is a no-op on a second run", () => {
  const db = legacyDb();
  applyTaxSchema(db);
  applyTaxSchema(db);
  const indexes = db.prepare("PRAGMA index_list(tax_profile)").all().map((i) => i.name);
  assert.ok(indexes.includes("idx_tax_profile_user_fy"));
});
