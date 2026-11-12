"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fieldUtils = require("../fieldUtils");

const {
    parseAmount,
    formatIndian,
    formatAmountInput,
    capStatus,
    countedDeductions,
    profileToForm,
    formToPayload,
    emptyForm,
} = fieldUtils;

test("parseAmount accepts Indian grouping and the rupee sign, treats empty as null", () => {
    assert.deepEqual(parseAmount("1,50,000"), { value: 150000, valid: true });
    assert.deepEqual(parseAmount("₹ 2,00,000"), { value: 200000, valid: true });
    assert.deepEqual(parseAmount(""), { value: null, valid: true });
});

test("parseAmount rejects negative and non-numeric input", () => {
    assert.equal(parseAmount("-5").valid, false);
    assert.equal(parseAmount("12abc").valid, false);
});

test("formatIndian groups digits in lakhs and crores", () => {
    assert.equal(formatIndian(150000), "1,50,000");
    assert.equal(formatIndian(12345678), "1,23,45,678");
    assert.equal(formatIndian(0), "0");
});

test("formatAmountInput regroups typed digits and keeps invalid text for the user to fix", () => {
    assert.equal(formatAmountInput("150000"), "1,50,000");
    assert.equal(formatAmountInput(""), "");
    assert.equal(formatAmountInput("-5"), "-5");
    assert.equal(formatAmountInput("12.5"), "12.5");
});

test("capStatus flags values over the cap without clamping the entered amount", () => {
    assert.deepEqual(capStatus("ded_80c", 200000), { cap: 150000, counted: 150000, exceeded: true, ratio: 1 });
    assert.equal(capStatus("ded_80ccd1b", 25000).ratio, 0.5);
    assert.equal(capStatus("ded_80d", 30000).cap, null);
});

test("countedDeductions applies the caps to the total", () => {
    const total = countedDeductions({ ded_80c: 200000, ded_80d: 25000, ded_80ccd1b: 60000, ded_24b: 0 });
    assert.equal(total, 150000 + 25000 + 50000);
});

test("profileToForm maps a saved profile and keeps the stored keys", () => {
    const form = profileToForm({ age_band: "senior", regime_choice: "new", salary: 500000, ded_80c: 0, notes: null });
    assert.equal(form.age_band, "senior");
    assert.equal(form.salary, "500000");
    assert.equal(form.ded_80c, "0");
    assert.equal(form.notes, "");
    assert.equal(profileToForm(null).regime_choice, emptyForm().regime_choice);
});

test("formToPayload rejects a filing delay outside 0 to 12 months", () => {
    const result = formToPayload({ ...emptyForm(), filing_months_delay: "13" });
    assert.match(result.error, /Filing delay/);
});

test("formToPayload builds the saved shape from grouped amounts", () => {
    const { payload } = formToPayload({ ...emptyForm(), salary: "12,00,000", ded_80c: "1,50,000", notes: " hi " });
    assert.equal(payload.salary, 1200000);
    assert.equal(payload.ded_80c, 150000);
    assert.equal(payload.house_property, 0);
    assert.equal(payload.filing_months_delay, 1);
    assert.equal(payload.notes, "hi");
});
