"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { buildSchedule } = require("../schedule");

const FY = "2026-27";
const base = { fy: FY, ageBand: "below60" };

test("234C: net tax 1,00,000 with late payments charges 150 (June) and 450 (Sept)", () => {
  const r = buildSchedule({
    ...base,
    netTax: 100000,
    payments: [
      { paidOn: "2026-06-10", amount: 10000 },
      { paidOn: "2026-09-10", amount: 20000 },
      { paidOn: "2026-12-10", amount: 50000 },
      { paidOn: "2027-03-10", amount: 20000 },
    ],
  });
  assert.equal(r.applicable, true);
  assert.deepEqual(r.instalments.map((i) => i.dueDate), ["2026-06-15", "2026-09-15", "2026-12-15", "2027-03-15"]);

  const [jun, sep, dec, mar] = r.instalments;
  assert.equal(jun.required, 15000);
  assert.equal(jun.paid, 10000);
  assert.equal(jun.shortfall, 5000);
  assert.equal(jun.interest234C.amount, 150);
  assert.equal(sep.required, 45000);
  assert.equal(sep.paid, 30000);
  assert.equal(sep.shortfall, 15000);
  assert.equal(sep.interest234C.amount, 450);
  assert.equal(dec.interest234C.amount, 0);
  assert.equal(mar.interest234C.amount, 0);
  assert.equal(r.totals.interest234C, 600);
  assert.equal(r.interest234B.applicable, false);
  assert.equal(r.totals.totalInterest, 600);
});

test("net tax 9,000 is below the threshold, so no advance tax is due", () => {
  const r = buildSchedule({ ...base, netTax: 9000, payments: [] });
  assert.equal(r.applicable, false);
  assert.equal(r.instalments.length, 4);
  assert.ok(r.instalments.every((i) => i.required === 0 && i.shortfall === 0 && i.interest234C.amount === 0));
  assert.equal(r.totals.totalInterest, 0);
  assert.match(r.reason, /below/);
});

test("resident senior with no business income is exempt, with a reason", () => {
  const r = buildSchedule({ ...base, ageBand: "senior", netTax: 100000, hasBusinessIncome: false, payments: [] });
  assert.equal(r.applicable, false);
  assert.equal(r.instalments.length, 4);
  assert.ok(r.instalments.every((i) => i.required === 0 && i.interest234C.amount === 0));
  assert.match(r.reason, /207\(2\)/);
});

test("presumptive 44AD: a single instalment of 100% on 15 Mar", () => {
  const r = buildSchedule({ ...base, netTax: 100000, presumptive44AD: true, hasBusinessIncome: true, payments: [] });
  assert.equal(r.instalments.length, 1);
  assert.equal(r.instalments[0].dueDate, "2027-03-15");
  assert.equal(r.instalments[0].cumulativePct, 100);
  assert.equal(r.instalments[0].required, 100000);
});

test("payments count toward every later instalment once made", () => {
  const r = buildSchedule({
    ...base,
    netTax: 100000,
    payments: [{ paidOn: "2026-06-25", amount: 15000 }],
  });
  assert.equal(r.instalments[0].paid, 0);
  assert.equal(r.instalments[1].paid, 15000);
  assert.equal(r.instalments[2].paid, 15000);
});

test("234B: under 90% of assessed tax by year end charges 1% per month for 4 months", () => {
  const r = buildSchedule({
    ...base,
    netTax: 100000,
    payments: [{ paidOn: "2026-06-10", amount: 50000 }],
  });
  assert.equal(r.interest234B.applicable, true);
  assert.equal(r.interest234B.shortfall, 50000);
  assert.equal(r.interest234B.months, 1);
  assert.equal(r.interest234B.amount, 500);
  assert.equal(r.totals.interest234B, 500);
});

test("234B: filingMonthsDelay overrides the default of 1 month", () => {
  const r = buildSchedule({
    ...base,
    netTax: 100000,
    filingMonthsDelay: 6,
    payments: [{ paidOn: "2026-06-10", amount: 50000 }],
  });
  assert.equal(r.interest234B.amount, 3000);
});

test("TDS/TCS is credited against the instalment base", () => {
  const r = buildSchedule({ ...base, netTax: 100000, tdsTcs: 40000, payments: [] });
  assert.equal(r.advanceTaxPayable, 60000);
  assert.equal(r.instalments[0].required, 9000);
});

test("gains arising after a due date are fully due at the next due date", () => {
  const r = buildSchedule({
    ...base,
    netTax: 100000,
    gainsAndDividendsByDate: [{ date: "2026-07-01", amount: 10000 }],
    payments: [],
  });
  assert.equal(r.instalments[0].required, 13500);
  assert.equal(r.instalments[1].required, 50500);
  assert.ok(r.notes.some((n) => /Verify/.test(n)));
});

test("gains outside the FY are rejected", () => {
  assert.throws(
    () => buildSchedule({ ...base, netTax: 100000, gainsAndDividendsByDate: [{ date: "2025-05-01", amount: 1000 }] }),
    RangeError,
  );
});

test("unknown age band is rejected", () => {
  assert.throws(() => buildSchedule({ ...base, ageBand: "child", netTax: 100000 }), TypeError);
});
