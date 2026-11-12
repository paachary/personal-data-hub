"use strict";

const { getRules } = require("./rules");
const { parseIsoDate, isDateInFy, findPeriod } = require("./dates");

const AGE_BANDS = ["below60", "senior", "superSenior"];
const REGIME_INPUTS = ["old", "new", "both"];
const CATEGORIES = ["stcg111A", "ltcg112A", "ltcgOther", "stcgOther"];
const OLD_SLAB_BAND = { below60: "under60", senior: "senior60to79", superSenior: "superSenior80plus" };
const { LIMIT_80C, LIMIT_80CCD1B, LIMIT_24B_SELF_OCCUPIED } = require("./limits");

function roundTo10(amount) {
  return Math.round(amount / 10) * 10;
}

function sum(values) {
  return values.reduce((a, b) => a + b, 0);
}

function money(value, name) {
  if (value === undefined || value === null) return 0;
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number`);
  }
  return value;
}

function nonNegative(value, name) {
  const amount = money(value, name);
  if (amount < 0) throw new RangeError(`${name} cannot be negative`);
  return amount;
}

function valueOf(ctx, wrapper, label) {
  if (wrapper.verify) ctx.verifyItems.add(label);
  return wrapper.value;
}

function slabTax(income, slabs, ctx) {
  let tax = 0;
  for (const band of slabs) {
    if (income <= band.from) break;
    const upper = band.to === null ? income : Math.min(income, band.to);
    tax += (upper - band.from) * band.rate.value;
    if (band.verify || band.rate.verify) ctx.verifyItems.add(`slab band from ${band.from}`);
  }
  return tax;
}

function slabBreakdown(income, slabs) {
  return slabs.map((band) => {
    const upTo = band.to;
    const taxable = income <= band.from ? 0 : Math.max(0, Math.min(income, upTo === null ? income : upTo) - band.from);
    return {
      from: band.from,
      to: upTo,
      rate: band.rate.value,
      taxableInSlab: taxable,
      taxInSlab: taxable * band.rate.value,
    };
  });
}

function gainOf(entry, index) {
  if (entry.gain !== undefined && entry.gain !== null) {
    const gain = money(entry.gain, `capitalGains[${index}].gain`);
    if (entry.saleValue !== undefined && entry.cost !== undefined) {
      const computed = money(entry.saleValue, `capitalGains[${index}].saleValue`) - money(entry.cost, `capitalGains[${index}].cost`);
      if (Math.abs(gain - computed) > 0.5) {
        throw new RangeError(`capitalGains[${index}].gain does not equal saleValue - cost`);
      }
    }
    return gain;
  }
  if (entry.saleValue === undefined || entry.cost === undefined) {
    throw new TypeError(`capitalGains[${index}] needs either gain or both saleValue and cost`);
  }
  return money(entry.saleValue, `capitalGains[${index}].saleValue`) - money(entry.cost, `capitalGains[${index}].cost`);
}

function buildCapitalGains(gains, ctx) {
  let stcgOther = 0;
  const buckets = new Map();

  gains.forEach((entry, index) => {
    if (!entry || typeof entry !== "object") throw new TypeError(`capitalGains[${index}] must be an object`);
    if (!CATEGORIES.includes(entry.category)) {
      throw new TypeError(`capitalGains[${index}].category must be one of ${CATEGORIES.join(", ")}`);
    }
    if (!parseIsoDate(entry.transferDate)) {
      throw new TypeError(`capitalGains[${index}].transferDate must be YYYY-MM-DD`);
    }
    if (!isDateInFy(entry.transferDate, ctx.fy)) {
      throw new RangeError(`capitalGains[${index}].transferDate ${entry.transferDate} is outside FY ${ctx.fy}`);
    }
    const gain = gainOf(entry, index);

    if (entry.category === "stcgOther") {
      stcgOther += gain;
      return;
    }

    const period = findPeriod(ctx.rules.capitalGains.periods, entry.transferDate);
    if (!period) throw new RangeError(`No capital gains rate period covers ${entry.transferDate}`);

    const key = `${entry.category}|${period.from}`;
    if (!buckets.has(key)) {
      if (entry.category === "ltcgOther" && period.ltcgOther.indexation) {
        ctx.notes.add("Indexation is not applied; supply LTCG on pre-23-Jul-2024 assets as computed by you.");
      }
      buckets.set(key, {
        category: entry.category,
        periodFrom: period.from,
        rate: valueOf(ctx, period[entry.category], `${entry.category} rate from ${period.from}`),
        exemptionLimit: entry.category === "ltcg112A"
          ? valueOf(ctx, period.ltcg112AExemption, `112A exemption from ${period.from}`)
          : 0,
        gross: 0,
      });
    }
    buckets.get(key).gross += gain;
  });

  if (stcgOther < 0 || [...buckets.values()].some((b) => b.gross < 0)) {
    ctx.notes.add("Capital losses are floored at zero per bucket; set-off across heads is not modelled.");
  }

  return {
    stcgOther: Math.max(0, stcgOther),
    buckets: [...buckets.values()].map((b) => ({ ...b, gross: Math.max(0, b.gross) })),
  };
}

function computeSurcharge({ regime, ctx, totalTaxable, specialTaxable, specialTax, normalAfterRebate, dividendTax, slabs }) {
  const { bands, regimeCap, capitalGainsAndDividendsCap, marginalRelief } = ctx.rules.surcharge;
  const band = bands.filter((b) => totalTaxable > b.above).pop();
  if (!band) {
    return { threshold: null, rate: 0, uncapped: 0, marginalReliefApplied: false, amount: 0 };
  }

  const bandRate = valueOf(ctx, band.rate, `surcharge rate above ${band.above}`);
  const regimeMax = regimeCap[regime] ? valueOf(ctx, regimeCap[regime], `${regime} surcharge cap`) : Infinity;
  const normalRate = Math.min(bandRate, regimeMax);
  const specialRate = Math.min(normalRate, valueOf(ctx, capitalGainsAndDividendsCap, "special-rate surcharge cap"));

  const normalPart = normalAfterRebate - dividendTax;
  const uncapped = normalPart * normalRate + (dividendTax + specialTax) * specialRate;

  let amount = uncapped;
  let marginalReliefApplied = false;
  if (marginalRelief) {
    const threshold = band.above;
    const taxAtThreshold = slabTax(Math.max(0, threshold - specialTaxable), slabs, ctx) + specialTax;
    const ceiling = taxAtThreshold + (totalTaxable - threshold) - (normalAfterRebate + specialTax);
    if (ceiling < uncapped) {
      amount = Math.max(0, ceiling);
      marginalReliefApplied = true;
    }
  }

  ctx.notes.add("Surcharge: marginal relief at each threshold; special-rate and dividend tax surcharge capped at 15%.");
  return { threshold: band.above, rate: normalRate, uncapped, marginalReliefApplied, amount };
}

function computeRegime(regime, input, ctx, cg) {
  const { rules, notes } = ctx;
  const rr = rules.regimes[regime];
  const isOld = regime === "old";
  const slabs = isOld ? rr.slabs[OLD_SLAB_BAND[input.ageBand]] : rr.slabs.all;

  const salary = nonNegative(input.salary, "salary");
  const houseProperty = money(input.houseProperty, "houseProperty");
  const businessIncome = input.hasBusinessIncome ? money(input.businessIncome, "businessIncome") : 0;
  const interestSavings = nonNegative(input.interestSavings, "interestSavings");
  const interestDeposits = nonNegative(input.interestDeposits, "interestDeposits");
  const interestOther = nonNegative(input.interestOther, "interestOther");
  const dividends = nonNegative(input.dividends, "dividends");

  const grossNormal = salary + houseProperty + businessIncome + interestSavings + interestDeposits
    + interestOther + dividends + cg.stcgOther;

  const d = input.deductions || {};
  const deductions = {
    standard: salary > 0 ? valueOf(ctx, rr.standardDeduction, `${regime} standard deduction`) : 0,
    c80C: 0,
    c80D: 0,
    c80CCD1B: 0,
    hra: 0,
    other: 0,
    s24b: 0,
    s80TTA: 0,
    s80TTB: 0,
  };
  if (isOld) {
    deductions.c80C = Math.min(nonNegative(d.c80C, "deductions.c80C"), LIMIT_80C);
    deductions.c80D = nonNegative(d.c80D, "deductions.c80D");
    deductions.c80CCD1B = Math.min(nonNegative(d.c80CCD1B, "deductions.c80CCD1B"), LIMIT_80CCD1B);
    deductions.hra = nonNegative(d.hra, "deductions.hra");
    deductions.other = nonNegative(d.other, "deductions.other");
    deductions.s24b = Math.min(nonNegative(d.s24b, "deductions.s24b"), LIMIT_24B_SELF_OCCUPIED);
    if (input.ageBand === "below60") {
      deductions.s80TTA = Math.min(valueOf(ctx, rules.deductions["80TTA"].limit, "80TTA limit"), interestSavings);
    } else {
      deductions.s80TTB = Math.min(
        valueOf(ctx, rules.deductions["80TTB"].limit, "80TTB limit"),
        interestSavings + interestDeposits,
      );
    }
    notes.add("80C is capped at 1,50,000 and 80CCD(1B) at 50,000 (statutory limits, not in the rules file).");
    notes.add("80D, HRA and other deductions are used as supplied; age-based 80D limits and HRA exemption are not computed.");
    notes.add("Section 24(b) home loan interest is capped at 2,00,000 (self-occupied property). Let-out property interest is not uncapped here.");
  } else if (sum([d.c80C, d.c80D, d.c80CCD1B, d.hra, d.other, d.s24b].map((v) => Number(v) || 0)) > 0) {
    notes.add("Chapter VI-A and HRA deductions are ignored in the new regime.");
  }
  const totalDeductions = sum(Object.values(deductions));

  const normalBeforeRounding = grossNormal - totalDeductions;
  if (normalBeforeRounding < 0) {
    notes.add("Deductions larger than normal income are not carried forward or set off against capital gains.");
  }
  const normalTaxable = roundTo10(Math.max(0, normalBeforeRounding));

  const zeroRateLimit = slabs[0].to;
  const buckets = cg.buckets.map((b) => ({ ...b, amount: b.gross, exemption: 0, basicOffset: 0 }));
  const byRateDesc = (a, b) => b.rate - a.rate;
  const bucket112A = buckets.filter((b) => b.category === "ltcg112A").sort(byRateDesc);

  const exemptionLimit = bucket112A.length ? Math.max(...bucket112A.map((b) => b.exemptionLimit)) : 0;
  let exemptionLeft = exemptionLimit;
  for (const b of bucket112A) {
    const used = Math.min(exemptionLeft, b.amount);
    b.exemption = used;
    b.amount -= used;
    exemptionLeft -= used;
  }
  if (bucket112A.length) {
    notes.add("112A exemption is applied to 112A gains only, highest-rate bucket first (assumption); its limit is taken from the rules period.");
  }

  let unusedBasic = Math.max(0, zeroRateLimit - normalTaxable);
  const unusedBeforeSpecial = unusedBasic;
  const offsetOrder = [
    ...buckets.filter((b) => b.category === "stcg111A").sort(byRateDesc),
    ...bucket112A,
    ...buckets.filter((b) => b.category === "ltcgOther").sort(byRateDesc),
  ];
  for (const b of offsetOrder) {
    const offset = Math.min(unusedBasic, b.amount);
    b.basicOffset = offset;
    b.amount -= offset;
    unusedBasic -= offset;
  }
  if (buckets.length) {
    notes.add("Unused basic exemption is set off against STCG 111A first, then 112A, then other LTCG (assumption).");
  }
  for (const b of buckets) {
    b.taxable = b.amount;
    b.tax = b.taxable * b.rate;
  }

  const specialTaxable = sum(buckets.map((b) => b.taxable));
  const specialTax = sum(buckets.map((b) => b.tax));
  const specialTaxByCategory = (category) => sum(buckets.filter((b) => b.category === category).map((b) => b.tax));

  const slabTaxNormal = slabTax(normalTaxable, slabs, ctx);
  const totalTaxable = normalTaxable + specialTaxable;
  const rebateRule = rr.rebate87A;
  const rebateLimit = valueOf(ctx, rebateRule.incomeLimit, `${regime} 87A income limit`);
  const rebateMax = valueOf(ctx, rebateRule.maxAmount, `${regime} 87A maximum rebate`);
  let rebateMode = "none";
  let rebate = 0;
  if (totalTaxable <= rebateLimit) {
    rebateMode = "rebate";
    rebate = Math.min(rebateMax, slabTaxNormal);
  } else if (rebateRule.marginalRelief) {
    rebateMode = "marginalRelief";
    rebate = slabTaxNormal - Math.min(slabTaxNormal, totalTaxable - rebateLimit);
  }
  const normalAfterRebate = slabTaxNormal - rebate;
  if (specialTaxable > 0) {
    notes.add("87A eligibility uses total taxable income including special-rate income; the rebate reduces normal-income tax only (verify).");
  }

  const dividendsInTaxable = Math.min(dividends, normalTaxable);
  const dividendTax = slabTaxNormal - slabTax(normalTaxable - dividendsInTaxable, slabs, ctx);
  if (dividends > 0) {
    notes.add("Dividend tax is the incremental slab tax on dividends, used only to apply the 15% surcharge cap.");
  }

  const taxBeforeSurcharge = normalAfterRebate + specialTax;
  const surcharge = computeSurcharge({
    regime, ctx, totalTaxable, specialTaxable, specialTax, normalAfterRebate, dividendTax, slabs,
  });

  const cessRate = valueOf(ctx, rules.cess, "cess rate");
  const cessAmount = (taxBeforeSurcharge + surcharge.amount) * cessRate;
  const totalTax = roundTo10(taxBeforeSurcharge + surcharge.amount + cessAmount);
  const tdsTcs = nonNegative(input.tdsTcs, "tdsTcs");

  return {
    regime,
    grossTotalIncome: {
      normal: grossNormal,
      special: sum(cg.buckets.map((b) => b.gross)),
      total: grossNormal + sum(cg.buckets.map((b) => b.gross)),
    },
    deductions: { ...deductions, total: totalDeductions },
    taxableIncome: { normal: normalTaxable, special: specialTaxable, total: totalTaxable },
    basicExemption: { zeroRateLimit, unusedBeforeSpecial, unusedAfterSpecial: unusedBasic },
    ltcg112AExemption: { limit: exemptionLimit, used: exemptionLimit - exemptionLeft },
    capitalGainsBuckets: buckets.map((b) => ({
      category: b.category,
      periodFrom: b.periodFrom,
      rate: b.rate,
      gross: b.gross,
      exemption: b.exemption,
      basicOffset: b.basicOffset,
      taxable: b.taxable,
      tax: b.tax,
    })),
    slabTax: slabTaxNormal,
    slabBreakdown: slabBreakdown(normalTaxable, slabs),
    rebate87A: { mode: rebateMode, incomeLimit: rebateLimit, maxAmount: rebateMax, rebate },
    normalTax: normalAfterRebate,
    specialTax: {
      stcg111A: specialTaxByCategory("stcg111A"),
      ltcg112A: specialTaxByCategory("ltcg112A"),
      ltcgOther: specialTaxByCategory("ltcgOther"),
      total: specialTax,
    },
    taxBeforeSurcharge,
    surcharge,
    cess: { rate: cessRate, amount: cessAmount },
    totalTax,
    tdsTcs,
    balance: totalTax - tdsTcs,
  };
}

/**
 * Computes income tax for one financial year under the requested regime(s).
 * Pure: no I/O and no clock. Dates are supplied in the input.
 */
function computeTax(input) {
  if (!input || typeof input !== "object") throw new TypeError("input must be an object");
  const rules = getRules(input.fy);
  if (!AGE_BANDS.includes(input.ageBand)) throw new TypeError(`ageBand must be one of ${AGE_BANDS.join(", ")}`);
  if (!REGIME_INPUTS.includes(input.regime)) throw new TypeError(`regime must be one of ${REGIME_INPUTS.join(", ")}`);
  if (input.capitalGains !== undefined && !Array.isArray(input.capitalGains)) {
    throw new TypeError("capitalGains must be an array");
  }

  const ctx = { fy: input.fy, rules, notes: new Set(), verifyItems: new Set() };
  if (rules.unverified) ctx.notes.add(`Rules for FY ${input.fy} are flagged unverified; treat results as indicative.`);
  if (input.businessIncome && !input.hasBusinessIncome) {
    ctx.notes.add("businessIncome is ignored because hasBusinessIncome is false.");
  }
  if (input.presumptive44AD) {
    ctx.notes.add("presumptive44AD: businessIncome is used as the declared deemed income; no 44AD computation is performed.");
  }
  ctx.notes.add("Total income and tax are rounded to the nearest 10 (s.288A/288B).");

  const cg = buildCapitalGains(input.capitalGains || [], ctx);
  const requested = input.regime === "both" ? ["old", "new"] : [input.regime];
  const regimes = {};
  for (const regime of requested) {
    regimes[regime] = computeRegime(regime, input, ctx, cg);
  }

  let recommended = input.regime;
  let saving = 0;
  if (input.regime === "both") {
    const { old, new: fresh } = regimes;
    recommended = old.totalTax < fresh.totalTax ? "old" : "new";
    saving = Math.abs(old.totalTax - fresh.totalTax);
  }

  const notes = [...ctx.notes];
  if (ctx.verifyItems.size > 0) {
    notes.push(`Rule values flagged verify in the rules file were used: ${[...ctx.verifyItems].join("; ")}.`);
  }

  return { fy: input.fy, ageBand: input.ageBand, regimes, recommended, saving, notes };
}

module.exports = { computeTax };
