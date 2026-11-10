"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const Database = require("better-sqlite3");
const XLSX = require("xlsx");
const { applyTaxSchema } = require("../../../database/finance/taxSchema");
const service = require("../service");
const { parseCams } = require("../importers/cams");
const { parseAmount, parseDate } = require("../importers/common");
const { parseIncomeTemplate } = require("../importers/template");
const { parseAis } = require("../importers/ais");
const { previewImport, commitRows } = require("../importers");

const FY = "2025-26";
const USER = 1;
const HEADER = "Folio No,ASSET CLASS NAME,Scheme Name,Date,Date_1,Units,Amount,STT,Short Term,Long Term Without Index";

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
    INSERT INTO instrument_types (code, description) VALUES ('FD', 'Fixed Deposit');
  `);
  applyTaxSchema(db);
  return db;
}

function csv(lines) {
  return Buffer.from([HEADER, ...lines].join("\n"), "utf8");
}

function byLine(rows, line) {
  return rows.find((row) => row.line === line);
}

test("parseAmount reads commas, brackets and blanks", () => {
  assert.equal(parseAmount("1,234.50"), 1234.5);
  assert.equal(parseAmount("(120)"), -120);
  assert.equal(parseAmount(""), null);
  assert.equal(parseAmount("abc"), null);
});

test("parseDate reads ISO, day-first and Excel serial dates", () => {
  assert.equal(parseDate("2025-06-15"), "2025-06-15");
  assert.equal(parseDate("15/06/2025"), "2025-06-15");
  assert.equal(parseDate("15-Jun-2025"), "2025-06-15");
  assert.equal(parseDate(45823), "2025-06-15");
  assert.equal(parseDate("31/02/2025"), null);
});

test("CAMS categories follow asset class, STT and purchase date", () => {
  const rows = parseCams(
    csv([
      "F1,Equity Fund,Eq Short,15/06/2025,01/01/2025,10,1500,1.5,200,0",
      "F1,Equity Fund,Eq Long,15/06/2025,01/01/2024,10,5000,5,0,800",
      "F2,Equity Fund,Eq NoSTT Short,15/06/2025,01/01/2025,10,1000,0,100,0",
      "F3,Debt Fund,Debt Post 2023,15/06/2025,10/01/2024,10,1300,0,300,0",
      "F3,Debt Fund,Debt Pre 2023,15/06/2025,10/01/2022,10,1800,0,0,800",
    ]),
    "csv",
    FY,
  );
  assert.deepEqual(rows.map((r) => r.category), [
    "stcg111A", "ltcg112A", "stcgOther", "stcgOther", "ltcgOther",
  ]);
  assert.equal(rows[0].gain, 200);
  assert.equal(rows[0].cost, 1300);
  assert.equal(rows[3].warnings.some((w) => w.includes("slab")), true);
});

test("CAMS row with both short and long gain is an error", () => {
  const rows = parseCams(csv(["F1,Equity Fund,Mixed,15/06/2025,01/01/2025,10,1500,1.5,200,800"]), "csv", FY);
  assert.equal(rows[0].errors.length, 1);
  assert.match(rows[0].errors[0], /Both/);
});

test("CAMS sale date outside the FY is an error", () => {
  const rows = parseCams(csv(["F1,Equity Fund,Old,01/06/2024,01/01/2023,10,1500,1.5,200,0"]), "csv", FY);
  assert.match(rows[0].errors[0], /outside FY/);
});

test("CAMS XLSX round trip reads a title row and Excel dates", () => {
  const sheet = XLSX.utils.aoa_to_sheet([
    ["CAMS capital gains report"],
    HEADER.split(","),
    ["F9", "Equity Fund", "Round Trip", new Date(Date.UTC(2025, 5, 15)), new Date(Date.UTC(2025, 0, 1)), 10, 1500, 1.5, 200, 0],
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, "Gains");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  const rows = parseCams(buffer, "xlsx", FY);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].sale_date, "2025-06-15");
  assert.equal(rows[0].purchase_date, "2025-01-01");
  assert.equal(rows[0].category, "stcg111A");
  assert.deepEqual(rows[0].errors, []);
});

test("preview flags rows already stored and rows repeated in the file", () => {
  const db = createDb();
  const buffer = csv([
    "F1,Equity Fund,Dup,15/06/2025,01/01/2025,10,1500,1.5,200,0",
    "F1,Equity Fund,Dup,15/06/2025,01/01/2025,10,1500,1.5,200,0",
  ]);
  const first = previewImport(db, USER, "cams", buffer, "csv", FY);
  assert.equal(first.rows[0].status, "ok");
  assert.equal(first.rows[1].status, "duplicate");

  const committed = commitRows(db, USER, FY, "cams", [first.rows[0]]);
  assert.deepEqual(committed, { inserted: 1, skipped: 0 });

  const again = previewImport(db, USER, "cams", buffer, "csv", FY);
  assert.equal(again.rows[0].status, "duplicate");
  assert.equal(again.rows[0].selected, false);
  assert.equal(service.capitalGains.list(db, USER, FY).length, 1);
});

test("commit re-validates rows and writes nothing when one is invalid", () => {
  const db = createDb();
  const preview = previewImport(
    db,
    USER,
    "cams",
    csv(["F1,Equity Fund,Good,15/06/2025,01/01/2025,10,1500,1.5,200,0"]),
    "csv",
    FY,
  );
  const good = preview.rows[0];
  const bad = { ...good, category: "madeUp", folio: "F2", scheme: "Bad" };
  assert.throws(() => commitRows(db, USER, FY, "cams", [good, bad]), /Unknown category/);
  assert.equal(service.capitalGains.list(db, USER, FY).length, 0);
});

test("commit ignores a renderer-supplied fingerprint and stores the server-computed one", () => {
  const db = createDb();
  const preview = previewImport(
    db,
    USER,
    "cams",
    csv(["F1,Equity Fund,Fp,15/06/2025,01/01/2025,10,1500,1.5,200,0"]),
    "csv",
    FY,
  );
  commitRows(db, USER, FY, "cams", [{ ...preview.rows[0], fingerprint: "forged" }]);
  const stored = service.capitalGains.list(db, USER, FY)[0];
  assert.notEqual(stored.fingerprint, "forged");
  assert.equal(stored.source, "cams");
});

test("income template parses and commits to the right tables", () => {
  const db = createDb();
  const buffer = Buffer.from("type,label,amount\ndividend,Acme,1200\ninterest_savings,Bank,4500\nrental,Flat,9000\n", "utf8");
  const rows = parseIncomeTemplate(buffer, "csv");
  assert.equal(byLine(rows, 4).errors.length, 1);
  const valid = rows.filter((row) => row.errors.length === 0);
  assert.equal(valid.length, 2);

  commitRows(db, USER, FY, "incomeTemplate", valid);
  assert.equal(service.dividendHistory.list(db, USER, FY)[0].source_label, "Acme");
  assert.equal(service.incomeSources.list(db, USER, FY)[0].kind, "interest_savings");
});

test("AIS import refuses an unknown layout with a clear message", () => {
  const buffer = Buffer.from("anything,here\n1,2\n", "utf8");
  assert.throws(() => parseAis(buffer, "csv"), /not supported yet/);
});

test("a file without the required columns is rejected", () => {
  assert.throws(() => parseCams(Buffer.from("a,b\n1,2\n"), "csv", FY), /Required columns not found/);
});
