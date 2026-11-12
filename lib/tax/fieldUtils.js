"use strict";

const { LIMIT_80C, LIMIT_80CCD1B, LIMIT_24B_SELF_OCCUPIED } = require("./limits");

const DEDUCTION_CAPS = {
    ded_80c: LIMIT_80C,
    ded_80ccd1b: LIMIT_80CCD1B,
    ded_24b: LIMIT_24B_SELF_OCCUPIED,
};

const INCOME_KEYS = ["salary", "house_property", "business_income", "tds_tcs"];
const DEDUCTION_KEYS = ["ded_80c", "ded_80d", "ded_80ccd1b", "ded_hra", "ded_24b", "ded_other"];

const indianNumber = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

// Accepts "1,50,000", "₹ 2000" or "" (empty is null). Negative and non-numeric input is invalid.
function parseAmount(text) {
    const cleaned = String(text ?? "").replace(/[\s,₹]/g, "");
    if (cleaned === "") return { value: null, valid: true };
    if (!/^\d+(\.\d+)?$/.test(cleaned)) return { value: NaN, valid: false };
    return { value: Number(cleaned), valid: true };
}

function formatIndian(value) {
    return Number.isFinite(value) ? indianNumber.format(value) : "";
}

// Re-groups typed digits as Indian grouping while keeping an empty field empty.
function formatAmountInput(text) {
    const raw = String(text ?? "");
    const { value, valid } = parseAmount(raw);
    if (!valid || value === null || raw.includes(".")) return raw;
    return formatIndian(value);
}

function capStatus(key, value) {
    const amount = Number(value) || 0;
    const cap = DEDUCTION_CAPS[key] ?? null;
    if (cap === null) return { cap: null, counted: amount, exceeded: false, ratio: 0 };
    return {
        cap,
        counted: Math.min(amount, cap),
        exceeded: amount > cap,
        ratio: Math.min(1, amount / cap),
    };
}

function countedDeductions(values) {
    return DEDUCTION_KEYS.reduce((sum, key) => sum + capStatus(key, values[key]).counted, 0);
}

function emptyForm() {
    return {
        age_band: "below60",
        regime_choice: "compare",
        has_business_income: false,
        presumptive_44ad: false,
        reminders_enabled: false,
        use_dividend_forecast: false,
        filing_months_delay: "1",
        notes: "",
        ...Object.fromEntries(INCOME_KEYS.map((key) => [key, ""])),
        ...Object.fromEntries(DEDUCTION_KEYS.map((key) => [key, ""])),
    };
}

// Maps a saved profile (DB shape) to form state. Keys are unchanged so saved profiles keep loading.
function profileToForm(profile) {
    if (!profile) return emptyForm();
    const text = (value) => (value == null ? "" : String(value));
    const form = {
        age_band: profile.age_band,
        regime_choice: profile.regime_choice,
        has_business_income: Boolean(profile.has_business_income),
        presumptive_44ad: Boolean(profile.presumptive_44ad),
        reminders_enabled: Boolean(profile.reminders_enabled),
        use_dividend_forecast: Boolean(profile.use_dividend_forecast),
        filing_months_delay: String(profile.filing_months_delay ?? "1"),
        notes: profile.notes || "",
    };
    for (const key of [...INCOME_KEYS, ...DEDUCTION_KEYS]) form[key] = text(profile[key]);
    return form;
}

// Validates form state and returns the save/draft payload. Errors are user-facing messages.
function formToPayload(form) {
    const payload = {
        age_band: form.age_band,
        regime_choice: form.regime_choice,
        has_business_income: form.has_business_income,
        presumptive_44ad: form.presumptive_44ad,
        reminders_enabled: form.reminders_enabled,
        use_dividend_forecast: form.use_dividend_forecast,
        notes: form.notes.trim() || null,
    };

    for (const key of INCOME_KEYS) {
        const { value, valid } = parseAmount(form[key]);
        if (!valid) return { error: "Income and TDS amounts must be zero or a positive number." };
        payload[key] = value ?? 0;
    }

    for (const key of DEDUCTION_KEYS) {
        const { value, valid } = parseAmount(form[key]);
        if (!valid) return { error: "Deductions must be zero or a positive number." };
        payload[key] = value ?? 0;
    }

    const months = String(form.filing_months_delay).trim();
    if (!/^\d+$/.test(months) || Number(months) > 12) {
        return { error: "Filing delay must be a whole number of months between 0 and 12." };
    }
    payload.filing_months_delay = Number(months);
    return { payload };
}

module.exports = {
    DEDUCTION_CAPS,
    INCOME_KEYS,
    DEDUCTION_KEYS,
    parseAmount,
    formatIndian,
    formatAmountInput,
    capStatus,
    countedDeductions,
    emptyForm,
    profileToForm,
    formToPayload,
};
