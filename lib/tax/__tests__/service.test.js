"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const Database = require("better-sqlite3");
const { applyTaxSchema } = require("../../../database/finance/taxSchema");
const { fdInterestForFy } = require("../fdInterest");
const service = require("../service");

const FY = "2025-26";
const USER_A = 1;
const USER_B = 2;

function createDb() {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE instrument_types (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT UNIQUE NOT NULL, description TEXT NOT NULL);
    CREATE TABLE investments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      instrument_type_id INTEGER NOT NULL,
      investment_name TEXT NOT NULL,
      amount REAL NOT NULL,
      investment_date TEXT NOT NULL,
      maturity_date TEXT,
      updated_at TEXT
    );
    INSERT INTO instrument_types (code, description) VALUES ('FD', 'Fixed Deposit'), ('MF', 'Mutual Funds');
  `);
  applyTaxSchema(db);
  return db;
}

function addFd(db, userId, name, rate, compounding = "cumulative") {
  const info = db
    .prepare(
      `INSERT INTO investments (user_id, instrument_type_id, investment_name, amount, investment_date, maturity_date, updated_at)
       VALUES (?, 1, ?, 100000, '2025-04-01', '2030-04-01', datetime('now'))`,
    )
    .run(userId, name);
  service.setInvestmentInterest(db, userId, info.lastInsertRowid, { rate, compounding });
  return info.lastInsertRowid;
}

test("applyTaxSchema is idempotent", () => {
  const db = createDb();
  applyTaxSchema(db);
  applyTaxSchema(db);
  const rateColumns = db.prepare("PRAGMA table_info(investments)").all().filter((c) => c.name === "interest_rate");
  assert.equal(rateColumns.length, 1);
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'tax_%'").all();
  assert.equal(tables.length, 5);
});

test("user A cannot read or change user B's tax rows or investments", () => {
  const db = createDb();
  const fdB = addFd(db, USER_B, "B's FD", 7);
  const incomeB = service.incomeSources.add(db, USER_B, FY, { kind: "interest_savings", amount: 40000 });
  service.payments.add(db, USER_B, FY, { paid_on: "2025-09-15", amount: 10000, kind: "advance" });
  service.saveTaxProfile(db, USER_B, FY, { salary: 1500000, regime_choice: "new" });

  assert.deepEqual(service.incomeSources.list(db, USER_A, FY), []);
  assert.deepEqual(service.payments.list(db, USER_A, FY), []);
  assert.equal(service.incomeSources.update(db, USER_A, incomeB, { amount: 1 }), 0);
  assert.equal(service.incomeSources.remove(db, USER_A, incomeB), 0);
  assert.equal(service.setInvestmentInterest(db, USER_A, fdB, { rate: 9 }), 0);

  service.saveTaxProfile(db, USER_A, FY, { salary: 100000 });
  assert.equal(service.getTaxProfile(db, USER_B, FY).salary, 1500000);

  const overviewA = service.getOverview(db, USER_A, FY);
  assert.equal(overviewA.fdInterest.length, 0);
  assert.equal(overviewA.payments.length, 0);
  assert.equal(overviewA.incomeTotals.interestSavings, 0);
  assert.equal(db.prepare("SELECT interest_rate FROM investments WHERE id = ?").get(fdB).interest_rate, 7);
});

test("an FD with a rate flows into the overview", () => {
  const db = createDb();
  addFd(db, USER_A, "Bank FD", 7);
  service.saveTaxProfile(db, USER_A, FY, { salary: 1200000, regime_choice: "new" });

  const overview = service.getOverview(db, USER_A, FY);
  const expected = fdInterestForFy({
    fy: FY, principal: 100000, ratePct: 7, startDate: "2025-04-01", maturityDate: "2030-04-01", type: "cumulative",
  }).interest;

  assert.equal(overview.fdInterest.length, 1);
  assert.equal(overview.fdInterest[0].source, "auto");
  assert.equal(overview.fdInterest[0].interest, expected);
  assert.equal(overview.incomeTotals.interestDeposits, expected);
  assert.equal(overview.tax.regimes.new.grossTotalIncome.normal, 1200000 + expected);
  assert.deepEqual(overview.fdMissingRate, []);
});

test("an FD without a rate is reported as missing a rate", () => {
  const db = createDb();
  const fd = addFd(db, USER_A, "No-rate FD", null);
  service.saveTaxProfile(db, USER_A, FY, { salary: 1000000 });

  const overview = service.getOverview(db, USER_A, FY);
  assert.deepEqual(overview.fdMissingRate, [{ investmentId: fd, name: "No-rate FD" }]);
  assert.equal(overview.incomeTotals.interestDeposits, 0);
});

test("a manual override beats the automatic FD interest", () => {
  const db = createDb();
  const fd = addFd(db, USER_A, "Bank FD", 7);
  service.saveTaxProfile(db, USER_A, FY, { salary: 1000000 });
  service.incomeSources.add(db, USER_A, FY, {
    kind: "interest_deposit", label: "Bank FD (bank statement)", amount: 5000, investment_id: fd, is_override: true,
  });

  const overview = service.getOverview(db, USER_A, FY);
  assert.equal(overview.fdInterest.length, 1);
  assert.equal(overview.fdInterest[0].source, "override");
  assert.equal(overview.fdInterest[0].interest, 5000);
  assert.equal(overview.incomeTotals.interestDeposits, 5000);
});

test("capital gain update recomputes gain, checks the FY, and is scoped to the owner", () => {
  const db = createDb();
  const { id } = service.capitalGains.add(db, USER_A, FY, {
    asset_class: "equity",
    category: "stcg111A",
    sale_date: "2025-06-10",
    sale_value: 50000,
    cost: 40000,
    gain: 10000,
  });

  assert.equal(service.capitalGains.update(db, USER_A, id, { sale_value: 70000, cost: 40000, gain: 1 }), 1);
  const row = service.capitalGains.list(db, USER_A, FY).find((r) => r.id === id);
  assert.equal(row.gain, 30000);

  assert.throws(
    () => service.capitalGains.update(db, USER_A, id, { sale_date: "2026-06-10" }),
    RangeError,
  );
  assert.equal(service.capitalGains.update(db, USER_B, id, { cost: 1 }), 0);
});

test("profile deductions are stored in ded_* columns and reach the old-regime computation", () => {
  const db = createDb();
  service.saveTaxProfile(db, USER_A, FY, {
    salary: 1500000, regime_choice: "old", ded_80c: 150000, ded_24b: 250000, ded_hra: 60000,
  });
  const overview = service.getOverview(db, USER_A, FY);
  assert.equal(overview.profile.ded_80c, 150000);
  assert.equal(overview.tax.regimes.old.deductions.c80C, 150000);
  assert.equal(overview.tax.regimes.old.deductions.s24b, 200000);
  assert.equal(overview.tax.regimes.old.deductions.hra, 60000);
});

test("saveTaxProfile rejects negative amounts and unknown enums", () => {
  const db = createDb();
  assert.throws(() => service.saveTaxProfile(db, USER_A, FY, { salary: -1 }), TypeError);
  assert.throws(() => service.saveTaxProfile(db, USER_A, FY, { ded_80c: "abc" }), TypeError);
  assert.throws(() => service.saveTaxProfile(db, USER_A, FY, { regime_choice: "both" }), TypeError);
  assert.throws(() => service.saveTaxProfile(db, USER_A, FY, { filing_months_delay: 13 }), TypeError);
});

test("dividend forecast averages the two prior FYs when enabled and no dividend is recorded", () => {
  const db = createDb();
  const { dividendHistory } = service;
  dividendHistory.add(db, USER_A, "2023-24", { source_label: "Co A", amount: 10000 });
  dividendHistory.add(db, USER_A, "2024-25", { source_label: "Co A", amount: 20000 });
  service.saveTaxProfile(db, USER_A, FY, { salary: 1000000, use_dividend_forecast: 1 });
  const overview = service.getOverview(db, USER_A, FY);
  assert.equal(overview.dividendForecast.amount, 15000);
  assert.equal(overview.incomeTotals.dividends, 15000);
  assert.ok(overview.notes.some((n) => n.includes("forecast")));

  service.saveTaxProfile(db, USER_A, FY, { use_dividend_forecast: 0 });
  assert.equal(service.getOverview(db, USER_A, FY).incomeTotals.dividends, 0);
});
