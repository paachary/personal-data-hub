"use strict";

const crypto = require("crypto");
const { computeTax } = require("./engine");
const { buildSchedule } = require("./schedule");
const { fdInterestForFy } = require("./fdInterest");
const { fyBounds, isDateInFy } = require("./dates");

const PROFILE_COLUMNS = [
  "age_band", "regime_choice", "has_business_income", "presumptive_44ad", "salary",
  "house_property", "business_income", "deductions_json", "tds_tcs", "filing_months_delay", "notes",
];

const DEFAULT_PROFILE = {
  age_band: "below60",
  regime_choice: "compare",
  has_business_income: 0,
  presumptive_44ad: 0,
  salary: 0,
  house_property: 0,
  business_income: 0,
  deductions_json: null,
  tds_tcs: 0,
  filing_months_delay: 4,
  notes: null,
};

const INCOME_SOURCE = {
  table: "tax_income_source",
  columns: ["kind", "label", "amount", "investment_id", "is_override", "meta_json"],
};
const DIVIDEND_HISTORY = {
  table: "tax_dividend_history",
  columns: ["source_label", "amount"],
};
const CAPITAL_GAIN = {
  table: "tax_capital_gain",
  columns: [
    "asset_class", "category", "description", "sale_date", "purchase_date",
    "sale_value", "cost", "gain", "source", "fingerprint", "needs_review",
  ],
};
const PAYMENT = {
  table: "tax_payment",
  columns: ["paid_on", "amount", "kind", "reference"],
};

const SOURCE_TO_ENGINE_FIELD = {
  interest_savings: "interestSavings",
  interest_deposit: "interestDeposits",
  interest_other: "interestOther",
  dividend: "dividends",
};

function toColumnValue(value) {
  if (typeof value === "boolean") return value ? 1 : 0;
  if (value !== null && typeof value === "object") return JSON.stringify(value);
  return value === undefined ? null : value;
}

function pickColumns(data, columns) {
  const out = {};
  for (const column of columns) {
    if (data[column] !== undefined) out[column] = toColumnValue(data[column]);
  }
  return out;
}

function parseJson(text) {
  return text ? JSON.parse(text) : {};
}

function crud(spec) {
  return {
    add(db, userId, fy, data) {
      const values = pickColumns(data, spec.columns);
      const columns = ["user_id", "fy", ...Object.keys(values)];
      const placeholders = columns.map(() => "?").join(", ");
      const info = db
        .prepare(`INSERT INTO ${spec.table} (${columns.join(", ")}) VALUES (${placeholders})`)
        .run(userId, fy, ...Object.values(values));
      return info.lastInsertRowid;
    },
    update(db, userId, id, data) {
      const values = pickColumns(data, spec.columns);
      const keys = Object.keys(values);
      if (keys.length === 0) return 0;
      const sets = [...keys.map((k) => `${k} = ?`), "updated_at = datetime('now')"].join(", ");
      return db
        .prepare(`UPDATE ${spec.table} SET ${sets} WHERE id = ? AND user_id = ?`)
        .run(...Object.values(values), id, userId).changes;
    },
    remove(db, userId, id) {
      return db.prepare(`DELETE FROM ${spec.table} WHERE id = ? AND user_id = ?`).run(id, userId).changes;
    },
    list(db, userId, fy) {
      return db
        .prepare(`SELECT * FROM ${spec.table} WHERE user_id = ? AND fy = ? ORDER BY id`)
        .all(userId, fy);
    },
  };
}

const incomeSources = crud(INCOME_SOURCE);
const dividendHistory = crud(DIVIDEND_HISTORY);
const payments = crud(PAYMENT);

const capitalGainsCrud = crud(CAPITAL_GAIN);

function gainFromInput(data) {
  if (data.gain !== undefined && data.gain !== null) return data.gain;
  if (data.sale_value == null || data.cost == null) {
    throw new TypeError("capital gain needs either gain or both sale_value and cost");
  }
  return data.sale_value - data.cost;
}

function fingerprintOf(row) {
  const parts = [
    row.asset_class, row.category, row.description, row.sale_date, row.purchase_date,
    row.sale_value, row.cost, row.gain, row.source,
  ];
  return crypto.createHash("sha256").update(parts.map((p) => p ?? "").join("|")).digest("hex");
}

const capitalGains = {
  /** Returns { inserted, id }. A duplicate fingerprint for the same user is skipped. */
  add(db, userId, fy, data) {
    if (!isDateInFy(data.sale_date, fy)) {
      throw new RangeError(`sale_date ${data.sale_date} is outside FY ${fy}`);
    }
    const row = { source: "manual", needs_review: false, ...data, gain: gainFromInput(data) };
    row.fingerprint = data.fingerprint || fingerprintOf({ ...row, gain: row.gain });
    const values = pickColumns(row, CAPITAL_GAIN.columns);
    const columns = ["user_id", "fy", ...Object.keys(values)];
    const info = db
      .prepare(
        `INSERT INTO tax_capital_gain (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})
         ON CONFLICT(user_id, fingerprint) DO NOTHING`,
      )
      .run(userId, fy, ...Object.values(values));
    return { inserted: info.changes === 1, id: info.lastInsertRowid };
  },
  remove: capitalGainsCrud.remove,
  list: capitalGainsCrud.list,
};

function getTaxProfile(db, userId, fy) {
  return db.prepare("SELECT * FROM tax_profile WHERE user_id = ? AND fy = ?").get(userId, fy) || null;
}

function saveTaxProfile(db, userId, fy, data) {
  const values = pickColumns(data, PROFILE_COLUMNS);
  const keys = Object.keys(values);
  const columns = ["user_id", "fy", ...keys];
  const updates = [...keys.map((k) => `${k} = excluded.${k}`), "updated_at = datetime('now')"].join(", ");
  db.prepare(
    `INSERT INTO tax_profile (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})
     ON CONFLICT(user_id, fy) DO UPDATE SET ${updates}`,
  ).run(userId, fy, ...Object.values(values));
  return getTaxProfile(db, userId, fy);
}

function setInvestmentInterest(db, userId, investmentId, { rate = null, compounding = null } = {}) {
  if (rate !== null && (!Number.isFinite(rate) || rate < 0)) {
    throw new TypeError("rate must be a non-negative number or null");
  }
  if (compounding !== null && compounding !== "cumulative" && compounding !== "payout") {
    throw new TypeError("compounding must be 'cumulative' or 'payout'");
  }
  return db
    .prepare(
      `UPDATE investments SET interest_rate = ?, compounding = ?, updated_at = datetime('now')
       WHERE id = ? AND user_id = ?`,
    )
    .run(rate, compounding, investmentId, userId).changes;
}

function toEngineGain(row) {
  return { category: row.category, transferDate: row.sale_date, gain: row.gain };
}

/**
 * Assembles the engine input for one user and FY, runs computeTax and buildSchedule,
 * and returns one overview object. Every query is filtered by userId.
 *
 * Income mapping: manual sources add to their engine field. A source with is_override=1
 * and an investment_id replaces the automatic FD interest for that investment.
 * Automatic FD interest comes from FDs (instrument code FD) with interest_rate set;
 * FDs without a rate are listed in fdMissingRate.
 * Kind "other" is not used by the engine and is reported in notes.
 */
function getOverview(db, userId, fy) {
  const { start, end } = fyBounds(fy);
  const savedProfile = getTaxProfile(db, userId, fy);
  const profile = savedProfile || DEFAULT_PROFILE;
  const sources = incomeSources.list(db, userId, fy);
  const paymentRows = payments.list(db, userId, fy);
  const gainRows = capitalGains.list(db, userId, fy);
  const notes = [];

  const overrides = new Map();
  const totals = {
    interestSavings: 0,
    interestDeposits: 0,
    interestOther: 0,
    dividends: 0,
    houseProperty: Number(profile.house_property) || 0,
  };
  for (const source of sources) {
    if (source.is_override && source.investment_id != null) {
      overrides.set(source.investment_id, source);
      continue;
    }
    if (source.kind === "rental") {
      totals.houseProperty += source.amount;
    } else if (SOURCE_TO_ENGINE_FIELD[source.kind]) {
      totals[SOURCE_TO_ENGINE_FIELD[source.kind]] += source.amount;
    } else {
      notes.push(`Income kind "${source.kind}" (${source.label || "unlabelled"}) is not used in the tax computation.`);
    }
  }

  const fds = db
    .prepare(
      `SELECT i.id, i.investment_name AS name, i.amount, i.investment_date, i.maturity_date,
              i.interest_rate, i.compounding
       FROM investments i
       JOIN instrument_types t ON t.id = i.instrument_type_id
       WHERE i.user_id = ? AND t.code = 'FD'
         AND i.investment_date <= ? AND (i.maturity_date IS NULL OR i.maturity_date >= ?)
       ORDER BY i.id`,
    )
    .all(userId, end, start);

  const fdInterest = [];
  const fdMissingRate = [];
  const fdNames = new Map(fds.map((fd) => [fd.id, fd.name]));
  for (const fd of fds) {
    if (overrides.has(fd.id)) continue;
    if (fd.interest_rate == null) {
      fdMissingRate.push({ investmentId: fd.id, name: fd.name });
      continue;
    }
    const result = fdInterestForFy({
      fy,
      principal: fd.amount,
      ratePct: fd.interest_rate,
      startDate: fd.investment_date,
      maturityDate: fd.maturity_date,
      type: fd.compounding || "cumulative",
    });
    totals.interestDeposits += result.interest;
    fdInterest.push({ investmentId: fd.id, name: fd.name, interest: result.interest, source: "auto" });
  }

  // Applies every override, including those whose investment is not in this FY's FD list.
  for (const source of overrides.values()) {
    const field = SOURCE_TO_ENGINE_FIELD[source.kind];
    const name = fdNames.get(source.investment_id) || source.label;
    if (field) {
      totals[field] += source.amount;
    } else {
      notes.push(`Override for "${name || source.investment_id}" uses kind "${source.kind}", which is not used in the tax computation.`);
    }
    fdInterest.push({ investmentId: source.investment_id, name, interest: source.amount, source: "override" });
  }

  const engineInput = {
    fy,
    ageBand: profile.age_band,
    regime: profile.regime_choice === "compare" ? "both" : profile.regime_choice,
    salary: profile.salary,
    houseProperty: totals.houseProperty,
    businessIncome: profile.business_income,
    hasBusinessIncome: Boolean(profile.has_business_income),
    presumptive44AD: Boolean(profile.presumptive_44ad),
    interestSavings: totals.interestSavings,
    interestDeposits: totals.interestDeposits,
    interestOther: totals.interestOther,
    dividends: totals.dividends,
    deductions: parseJson(profile.deductions_json),
    capitalGains: gainRows.map(toEngineGain),
  };
  const tax = computeTax(engineInput);
  const chosen = tax.regimes[tax.recommended];

  const schedule = buildSchedule({
    fy,
    netTax: chosen.totalTax,
    tdsTcs: profile.tds_tcs,
    payments: paymentRows.map((p) => ({ paidOn: p.paid_on, amount: p.amount })),
    ageBand: profile.age_band,
    hasBusinessIncome: Boolean(profile.has_business_income),
    presumptive44AD: Boolean(profile.presumptive_44ad),
    gainsAndDividendsByDate: gainRows
      .filter((g) => g.gain > 0)
      .map((g) => ({ date: g.sale_date, amount: g.gain })),
    filingMonthsDelay: profile.filing_months_delay,
  });

  if (totals.dividends > 0) {
    notes.push("Dividend income has no date, so it is not included in the advance-tax schedule.");
  }

  return {
    fy,
    profileSaved: savedProfile !== null,
    profile,
    incomeTotals: totals,
    fdInterest,
    fdMissingRate,
    payments: paymentRows,
    capitalGains: gainRows,
    tax,
    recommendedRegime: tax.recommended,
    netTax: chosen.totalTax,
    schedule,
    notes: [...tax.notes, ...notes],
  };
}

module.exports = {
  incomeSources,
  dividendHistory,
  capitalGains,
  payments,
  getTaxProfile,
  saveTaxProfile,
  setInvestmentInterest,
  getOverview,
};
