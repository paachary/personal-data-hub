"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { computeTax } = require("../engine");
const { fyOf, fyBounds, isDateInFy, findPeriod, parseIsoDate } = require("../dates");
const { getRules } = require("../rules");

const newRegime = (salary, extra = {}) => ({
  fy: "2025-26", ageBand: "below60", regime: "new", salary, ...extra,
});

test("golden 1: new regime, salary 12L plus savings interest, rebate wipes tax", () => {
  const r = computeTax(newRegime(1200000, { interestSavings: 35000 })).regimes.new;
  assert.equal(r.grossTotalIncome.normal, 1235000);
  assert.equal(r.taxableIncome.normal, 1160000);
  assert.equal(r.slabTax, 56000);
  assert.equal(r.rebate87A.mode, "rebate");
  assert.equal(r.rebate87A.rebate, 56000);
  assert.equal(r.totalTax, 0);
});

test("golden 2: new regime, marginal relief on 87A", () => {
  const r = computeTax(newRegime(1285000)).regimes.new;
  assert.equal(r.taxableIncome.normal, 1210000);
  assert.equal(r.slabTax, 61500);
  assert.equal(r.rebate87A.mode, "marginalRelief");
  assert.equal(r.normalTax, 10000);
  assert.equal(r.cess.amount, 400);
  assert.equal(r.totalTax, 10400);
});

test("golden 3: old regime, 111A gain taxed at 20% and not reduced by 87A", () => {
  const r = computeTax({
    fy: "2025-26",
    ageBand: "below60",
    regime: "old",
    salary: 450000,
    capitalGains: [{ category: "stcg111A", transferDate: "2025-06-01", gain: 100000 }],
  }).regimes.old;
  assert.equal(r.taxableIncome.normal, 400000);
  assert.equal(r.slabTax, 7500);
  assert.equal(r.rebate87A.rebate, 7500);
  assert.equal(r.normalTax, 0);
  assert.equal(r.specialTax.stcg111A, 20000);
  assert.equal(r.totalTax, 20800);
});

test("golden 4: new regime, surcharge limited by marginal relief at 50L", () => {
  const r = computeTax(newRegime(5085000)).regimes.new;
  assert.equal(r.taxableIncome.normal, 5010000);
  assert.equal(r.slabTax, 1083000);
  assert.equal(r.surcharge.rate, 0.10);
  assert.equal(r.surcharge.uncapped, 108300);
  assert.equal(r.surcharge.marginalReliefApplied, true);
  assert.equal(r.surcharge.amount, 7000);
  assert.equal(r.totalTax, 1133600);
});

test("golden 5: new regime, 112A exemption and 12.5% rate (income above rebate limit)", () => {
  const r = computeTax({
    fy: "2025-26",
    ageBand: "below60",
    regime: "new",
    salary: 1000000,
    capitalGains: [{ category: "ltcg112A", transferDate: "2025-06-01", saleValue: 300000, cost: 100000 }],
  }).regimes.new;
  assert.equal(r.ltcg112AExemption.limit, 125000);
  assert.equal(r.capitalGainsBuckets[0].taxable, 75000);
  assert.equal(r.specialTax.ltcg112A, 9375);
  assert.equal(r.rebate87A.mode, "rebate");
  assert.equal(r.cess.amount, 375);
  assert.equal(r.totalTax, 9750);
});

test("gain and saleValue/cost must agree", () => {
  assert.throws(() => computeTax({
    fy: "2025-26", ageBand: "below60", regime: "new", salary: 0,
    capitalGains: [{ category: "ltcg112A", transferDate: "2025-06-01", gain: 5, saleValue: 300000, cost: 100000 }],
  }), RangeError);
});

test("112A exemption uses the 23-Jul-2024 boundary in FY2024-25", () => {
  const periods = getRules("2024-25").capitalGains.periods;
  assert.equal(findPeriod(periods, "2024-07-22").from, "2024-04-01");
  assert.equal(findPeriod(periods, "2024-07-23").from, "2024-07-23");
  const before = computeTax({
    fy: "2024-25", ageBand: "below60", regime: "new", salary: 1000000,
    capitalGains: [{ category: "ltcg112A", transferDate: "2024-07-22", gain: 200000 }],
  }).regimes.new;
  const after = computeTax({
    fy: "2024-25", ageBand: "below60", regime: "new", salary: 1000000,
    capitalGains: [{ category: "ltcg112A", transferDate: "2024-07-23", gain: 200000 }],
  }).regimes.new;
  assert.equal(before.ltcg112AExemption.limit, 100000);
  assert.equal(after.ltcg112AExemption.limit, 125000);
});

test("date helpers: FY mapping and bounds", () => {
  assert.equal(fyOf("2025-04-01"), "2025-26");
  assert.equal(fyOf("2025-03-31"), "2024-25");
  assert.deepEqual(fyBounds("2025-26"), { start: "2025-04-01", end: "2026-03-31" });
  assert.equal(isDateInFy("2026-03-31", "2025-26"), true);
  assert.equal(isDateInFy("2026-04-01", "2025-26"), false);
  assert.equal(parseIsoDate("2025-02-30"), null);
});

test("validation: bad inputs are rejected", () => {
  assert.throws(() => computeTax({ ...newRegime(0), fy: "1999-00" }), { name: "UnknownFinancialYear" });
  assert.throws(() => computeTax({ ...newRegime(0), ageBand: "teen" }), TypeError);
  assert.throws(() => computeTax({ ...newRegime(0), regime: "neither" }), TypeError);
  assert.throws(() => computeTax({
    ...newRegime(0),
    capitalGains: [{ category: "ltcg112A", transferDate: "2024-03-31", gain: 1 }],
  }), RangeError);
  assert.throws(() => computeTax(newRegime(-1)), RangeError);
});

test("both regimes: recommendation is the cheaper regime and saving is the difference", () => {
  const out = computeTax({ ...newRegime(1000000), regime: "both", deductions: { c80C: 150000 } });
  const { old, new: fresh } = out.regimes;
  assert.equal(out.saving, Math.abs(old.totalTax - fresh.totalTax));
  assert.equal(out.recommended, old.totalTax < fresh.totalTax ? "old" : "new");
});

test("property: total tax never falls as salary rises, and recommendation is never costlier", () => {
  const gainSets = [
    [],
    [{ category: "stcg111A", transferDate: "2025-06-01", gain: 150000 }],
    [{ category: "ltcg112A", transferDate: "2025-06-01", gain: 400000 }],
    [{ category: "ltcgOther", transferDate: "2025-06-01", gain: 300000 }],
  ];
  for (const capitalGains of gainSets) {
    let prevOld = -Infinity;
    let prevNew = -Infinity;
    for (let salary = 0; salary <= 6000000; salary += 25000) {
      const out = computeTax({ fy: "2025-26", ageBand: "below60", regime: "both", salary, capitalGains });
      const { old, new: fresh } = out.regimes;
      assert.ok(old.totalTax >= prevOld, `old regime fell at salary ${salary}`);
      assert.ok(fresh.totalTax >= prevNew, `new regime fell at salary ${salary}`);
      assert.ok(out.regimes[out.recommended].totalTax <= Math.max(old.totalTax, fresh.totalTax));
      prevOld = old.totalTax;
      prevNew = fresh.totalTax;
    }
  }
});
