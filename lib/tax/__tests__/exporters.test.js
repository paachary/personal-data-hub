"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const XLSX = require("xlsx");
const { buildTaxWorkbook, buildTaxSummaryDocx } = require("../../exporters/taxExporter");

const overview = {
  fy: "2025-26",
  recommendedRegime: "new",
  netTax: 10400,
  tax: { regimes: { new: { totalTax: 10400 } } },
  schedule: {
    applicable: true,
    advanceTaxPayable: 8000,
    interest234B: { amount: 0 },
    totals: { interest234C: 120 },
    instalments: [
      { dueDate: "2025-06-15", cumulativePct: 15, required: 1560, paid: 0, shortfall: 1560, interest234C: { amount: 30 } },
      { dueDate: "2025-09-15", cumulativePct: 45, required: 4680, paid: 2000, shortfall: 2680, interest234C: { amount: 90 } },
    ],
  },
  incomeTotals: { salary: 1200000, savingsInterest: 35000 },
  capitalGains: [
    { sale_date: "2025-08-01", asset_class: "equity", category: "stcg", description: "ABC", gain: 5000, needs_review: 1 },
  ],
  payments: [{ paid_on: "2025-09-10", amount: 2000, kind: "advance", reference: "CHALLAN-1" }],
};

test("workbook has the five expected sheets in order", () => {
  const wb = buildTaxWorkbook(overview);
  assert.deepEqual(wb.SheetNames, ["Overview", "Instalments", "Income", "Capital Gains", "Payments"]);
});

test("Overview sheet carries the FY, regime and advance tax payable", () => {
  const rows = XLSX.utils.sheet_to_json(buildTaxWorkbook(overview).Sheets.Overview, { header: 1 });
  assert.deepEqual(rows[1], ["Financial year", "2025-26"]);
  assert.deepEqual(rows[2], ["Recommended regime", "new"]);
  assert.deepEqual(rows.find((r) => r[0] === "Advance tax payable"), ["Advance tax payable", 8000]);
});

test("Instalments sheet has one row per instalment with shortfall and 234C interest", () => {
  const rows = XLSX.utils.sheet_to_json(buildTaxWorkbook(overview).Sheets.Instalments, { header: 1 });
  assert.equal(rows.length, 3);
  assert.deepEqual(rows[2], ["2025-09-15", 45, 4680, 2000, 2680, 90]);
});

test("Capital Gains marks needs_review as Yes/No", () => {
  const rows = XLSX.utils.sheet_to_json(buildTaxWorkbook(overview).Sheets["Capital Gains"], { header: 1 });
  assert.equal(rows[1][5], "Yes");
});

test("empty overview still builds a workbook without throwing", () => {
  const wb = buildTaxWorkbook({ fy: "2025-26", schedule: { instalments: [] } });
  assert.equal(wb.SheetNames.length, 5);
});

test("Word summary is a non-empty zip (docx) buffer", async () => {
  const buf = await buildTaxSummaryDocx(overview);
  assert.ok(Buffer.isBuffer(buf));
  assert.equal(buf.slice(0, 2).toString("ascii"), "PK");
  assert.ok(buf.length > 1000);
});
