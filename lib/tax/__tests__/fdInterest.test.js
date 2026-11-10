"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { fdInterestForFy, fdAccruedTo } = require("../fdInterest");

const FY = "2026-27";
const TOL = 0.5;
const near = (actual, expected, tol = TOL) =>
  assert.ok(Math.abs(actual - expected) <= tol, `expected ${actual} to be within ${tol} of ${expected}`);

test("cumulative: 8,00,000 at 6.45% from 24-Jun-2026 to 11-Sep-2027 covers 281 days in FY2026-27", () => {
  const r = fdInterestForFy({
    principal: 800000, ratePct: 6.45, startDate: "2026-06-24", maturityDate: "2027-09-11", type: "cumulative", fy: FY,
  });
  assert.equal(r.daysInFy, 281);
  near(r.interest, 40513.95);
});

test("accrued: same FD shows 15,916.64 at 15-Oct-2026 (bank showed 15,924.92)", () => {
  const r = fdAccruedTo({
    principal: 800000, ratePct: 6.45, startDate: "2026-06-24", maturityDate: "2027-09-11", type: "cumulative", asOf: "2026-10-15",
  });
  near(r.accruedInterest, 15916.64, 10);
});

test("cumulative: 5,00,000 at 7% from 1-Apr-2025 gives 38,511.38 for FY2026-27", () => {
  const r = fdInterestForFy({ principal: 500000, ratePct: 7, startDate: "2025-04-01", type: "cumulative", fy: FY });
  near(r.interest, 38511.38);
});

test("cumulative: 3,00,000 at 6.5% from 1-Oct-2025 to 1-Dec-2026 gives 13,627.22", () => {
  const r = fdInterestForFy({
    principal: 300000, ratePct: 6.5, startDate: "2025-10-01", maturityDate: "2026-12-01", type: "cumulative", fy: FY,
  });
  near(r.interest, 13627.22);
});

test("payout: 5,00,000 at 7% for the full year gives 35,000", () => {
  const r = fdInterestForFy({ principal: 500000, ratePct: 7, startDate: "2025-04-01", type: "payout", fy: FY });
  assert.equal(r.daysInFy, 365);
  near(r.interest, 35000);
});

test("payout: 2,00,000 at 6.5% from 1-Jul-2026 gives 9,758.90", () => {
  const r = fdInterestForFy({ principal: 200000, ratePct: 6.5, startDate: "2026-07-01", type: "payout", fy: FY });
  near(r.interest, 9758.9);
});

test("edge: FD starting after FY end earns 0", () => {
  const r = fdInterestForFy({ principal: 100000, ratePct: 7, startDate: "2027-04-02", type: "cumulative", fy: FY });
  assert.equal(r.interest, 0);
  assert.equal(r.daysInFy, 0);
});

test("edge: maturity before FY start earns 0", () => {
  const r = fdInterestForFy({
    principal: 100000, ratePct: 7, startDate: "2024-04-01", maturityDate: "2026-03-31", type: "payout", fy: FY,
  });
  assert.equal(r.interest, 0);
});

test("edge: missing maturity runs to FY end", () => {
  const withMaturity = fdInterestForFy({
    principal: 100000, ratePct: 7, startDate: "2025-04-01", maturityDate: null, type: "payout", fy: FY,
  });
  assert.equal(withMaturity.daysInFy, 365);
});

test("edge: rate 0 earns 0 for both types", () => {
  for (const type of ["cumulative", "payout"]) {
    const r = fdInterestForFy({ principal: 100000, ratePct: 0, startDate: "2025-04-01", type, fy: FY });
    assert.equal(r.interest, 0);
  }
});

test("validation: invalid type and invalid date are rejected", () => {
  assert.throws(() => fdInterestForFy({ principal: 1, ratePct: 1, startDate: "2025-04-01", type: "monthly", fy: FY }), TypeError);
  assert.throws(() => fdInterestForFy({ principal: 1, ratePct: 1, startDate: "01-04-2025", type: "payout", fy: FY }), TypeError);
});
