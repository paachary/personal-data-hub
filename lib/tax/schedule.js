"use strict";

const { getRules } = require("./rules");
const { parseIsoDate, fyBounds, isDateInFy } = require("./dates");

const AGE_BANDS = ["below60", "senior", "superSenior"];
// s.234C(1) proviso: no interest on the June shortfall if 12% is paid by 15 Jun, nor on the September shortfall if 36% is paid by 15 Sep.
const TOLERANCE_JUNE_PCT = 12;
const TOLERANCE_SEPT_PCT = 36;
const MONTHS_FINAL_INSTALMENT = 1;

function round2(value) {
  return Math.round(value * 100) / 100;
}

function requireNonNegative(value, name) {
  if (!Number.isFinite(value) || value < 0) throw new TypeError(`${name} must be a non-negative number`);
}

function sumAmounts(items) {
  return items.reduce((total, item) => total + item.amount, 0);
}

function dueDateFor(fy, dueOn) {
  const startYear = Number(fyBounds(fy).start.slice(0, 4));
  const month = Number(dueOn.slice(0, 2));
  const year = month >= 4 ? startYear : startYear + 1;
  return `${year}-${dueOn}`;
}

function containsVerifyFlag(node) {
  if (Array.isArray(node)) return node.some(containsVerifyFlag);
  if (node && typeof node === "object") {
    if (node.verify === true) return true;
    return Object.values(node).some(containsVerifyFlag);
  }
  return false;
}

function validateInput({ netTax, tdsTcs, payments, ageBand, gainsAndDividendsByDate, filingMonthsDelay, fy }) {
  requireNonNegative(netTax, "netTax");
  requireNonNegative(tdsTcs, "tdsTcs");
  if (!AGE_BANDS.includes(ageBand)) throw new TypeError(`ageBand must be one of ${AGE_BANDS.join(", ")}`);
  if (!Number.isInteger(filingMonthsDelay) || filingMonthsDelay < 0) {
    throw new TypeError("filingMonthsDelay must be a non-negative integer");
  }
  payments.forEach((p) => {
    if (!parseIsoDate(p.paidOn)) throw new TypeError(`Invalid payment date: ${p.paidOn}`);
    requireNonNegative(p.amount, "payment amount");
  });
  gainsAndDividendsByDate.forEach((g) => {
    if (!isDateInFy(g.date, fy)) throw new RangeError(`Gains date ${g.date} is outside FY ${fy}`);
    requireNonNegative(g.amount, "gains amount");
  });
}

/**
 * Advance-tax schedule for one financial year.
 * netTax is the total tax liability; tdsTcs is credited against it. Instalments apply to netTax - tdsTcs.
 * gainsAndDividendsByDate amounts are part of that liability and are treated as fully due at the first due date on or after they arise.
 */
function buildSchedule(input) {
  const {
    fy,
    netTax,
    tdsTcs = 0,
    payments = [],
    ageBand,
    hasBusinessIncome = false,
    presumptive44AD = false,
    gainsAndDividendsByDate = [],
    filingMonthsDelay = 1,
  } = input;

  validateInput({ fy, netTax, tdsTcs, payments, ageBand, gainsAndDividendsByDate, filingMonthsDelay });

  const rules = getRules(fy);
  const { end: fyEnd } = fyBounds(fy);
  const advanceTaxPayable = Math.max(0, netTax - tdsTcs);
  const threshold = rules.advanceTax.threshold.value;
  const monthlyRate234C = rules.interest234C.monthlyRate.value;
  const monthsStandard = rules.interest234C.months.value;
  const notes = [];

  const paidOnOrBefore = (iso) => round2(sumAmounts(payments.filter((p) => p.paidOn <= iso)));
  const plan = presumptive44AD
    ? [{ dueOn: rules.advanceTax.instalments[rules.advanceTax.instalments.length - 1].dueOn, pct: 100 }]
    : rules.advanceTax.instalments.map((i) => ({ dueOn: i.dueOn, pct: i.cumulativePct.value }));
  const dueDates = plan.map((p) => dueDateFor(fy, p.dueOn));
  const emptyResult = (reason) => ({
    fy,
    netTax,
    tdsTcs,
    advanceTaxPayable,
    applicable: false,
    reason,
    instalments: dueDates.map((dueDate, k) => {
      const paid = paidOnOrBefore(dueDate);
      return {
        dueDate,
        cumulativePct: plan[k].pct,
        required: 0,
        paid,
        shortfall: 0,
        surplus: paid,
        interest234C: { months: 0, toleranceApplied: false, amount: 0 },
      };
    }),
    interest234B: { applicable: false, assessedTax: netTax, creditedAdvanceAndTds: 0, shortfall: 0, months: 0, amount: 0 },
    totals: { required: 0, paid: paidOnOrBefore(fyEnd), shortfallAtYearEnd: 0, interest234C: 0, interest234B: 0, totalInterest: 0 },
    notes,
  });

  if (advanceTaxPayable < threshold) {
    return emptyResult(`Tax payable after TDS/TCS (Rs ${advanceTaxPayable}) is below Rs ${threshold}; no advance tax is due.`);
  }
  if (ageBand !== "below60" && !hasBusinessIncome && !presumptive44AD) {
    return emptyResult("Resident senior (60+) with no business or professional income is exempt from advance tax (s.207(2)).");
  }


  const gainsByInstalment = plan.map(() => 0);
  let gainsTotal = 0;
  let lateGains = false;
  gainsAndDividendsByDate.forEach((g) => {
    let index = dueDates.findIndex((d) => d >= g.date);
    if (index === -1) {
      index = dueDates.length - 1;
      lateGains = true;
    }
    gainsByInstalment[index] += g.amount;
    gainsTotal += g.amount;
  });
  if (gainsTotal > advanceTaxPayable) {
    throw new RangeError("Gains and dividends tax cannot exceed the tax payable after TDS/TCS");
  }
  const baseTax = advanceTaxPayable - gainsTotal;

  let cumulativeGains = 0;
  const instalments = plan.map((p, k) => {
    cumulativeGains += gainsByInstalment[k];
    const dueDate = dueDates[k];
    const required = round2(baseTax * (p.pct / 100) + cumulativeGains);
    const paid = paidOnOrBefore(dueDate);
    const shortfall = round2(Math.max(0, required - paid));
    const surplus = round2(Math.max(0, paid - required));

    const isFinal = k === plan.length - 1;
    const months = isFinal ? MONTHS_FINAL_INSTALMENT : monthsStandard;
    let toleranceApplied = false;
    if (!presumptive44AD && k === 0 && paid >= (advanceTaxPayable * TOLERANCE_JUNE_PCT) / 100) toleranceApplied = true;
    if (!presumptive44AD && k === 1 && paid >= (advanceTaxPayable * TOLERANCE_SEPT_PCT) / 100) toleranceApplied = true;
    const amount = toleranceApplied ? 0 : round2(shortfall * monthlyRate234C * months);

    return {
      dueDate,
      cumulativePct: p.pct,
      required,
      paid,
      shortfall,
      surplus,
      interest234C: { months, toleranceApplied, amount },
    };
  });

  const interest234C = round2(sumAmounts(instalments.map((i) => ({ amount: i.interest234C.amount }))));

  const advancePaidByYearEnd = paidOnOrBefore(fyEnd);
  const creditedByYearEnd = round2(advancePaidByYearEnd + tdsTcs);
  const interest234B = {
    applicable: false,
    assessedTax: netTax,
    creditedAdvanceAndTds: creditedByYearEnd,
    shortfall: 0,
    months: 0,
    amount: 0,
  };
  if (creditedByYearEnd < (rules.interest234B.minAdvanceTaxPct.value / 100) * netTax) {
    const shortfall = round2(netTax - creditedByYearEnd);
    interest234B.applicable = true;
    interest234B.shortfall = shortfall;
    interest234B.months = filingMonthsDelay;
    interest234B.amount = round2(shortfall * rules.interest234B.monthlyRate.value * filingMonthsDelay);
    notes.push(
      `234B assumes the shortfall is paid ${filingMonthsDelay} month(s) after 1 April (default 1, matching the planner sheet). Override with filingMonthsDelay.`,
    );
  }

  if (presumptive44AD) notes.push("Presumptive (44AD): the full tax is due by the single instalment on 15 Mar.");
  if (gainsTotal > 0) {
    notes.push("Gains and dividends are treated as fully due at the first due date on or after they arise (conservative). Verify.");
  }
  if (lateGains) {
    notes.push("Some gains arise after 15 Mar; they are attributed to the final instalment. Verify.");
  }
  if (!presumptive44AD && instalments[0].interest234C.toleranceApplied) {
    notes.push("No 234C interest on the June instalment: at least 12% was paid by 15 Jun.");
  }
  if (!presumptive44AD && instalments[1].interest234C.toleranceApplied) {
    notes.push("No 234C interest on the September instalment: at least 36% was paid by 15 Sep.");
  }
  notes.push(
    "234C interest is charged on the cumulative shortfall at each due date for the stated months; payments made after a due date do not reduce it.",
  );
  if (containsVerifyFlag({ advanceTax: rules.advanceTax, interest234B: rules.interest234B, interest234C: rules.interest234C })) {
    notes.push(`Thresholds and rates for FY ${fy} are marked verify in the rules file.`);
  }

  const totalInterest = round2(interest234C + interest234B.amount);
  const finalInstalment = instalments[instalments.length - 1];

  return {
    fy,
    netTax,
    tdsTcs,
    advanceTaxPayable,
    applicable: true,
    reason: null,
    instalments,
    interest234B,
    totals: {
      required: finalInstalment.required,
      paid: advancePaidByYearEnd,
      shortfallAtYearEnd: finalInstalment.shortfall,
      interest234C,
      interest234B: interest234B.amount,
      totalInterest,
    },
    notes,
  };
}

module.exports = {
  buildSchedule,
};
