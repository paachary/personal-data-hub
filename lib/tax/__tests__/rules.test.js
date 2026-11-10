"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const rulesDir = path.join(__dirname, "..", "rules");
const { getRules, listFys, validateRules, RulesIncomplete, UnknownFinancialYear } = require(rulesDir);

const FILES = ["fy2024-25.json", "fy2025-26.json", "fy2026-27.json"];

function slabSets(rules) {
  const sets = [];
  for (const [regime, data] of Object.entries(rules.regimes)) {
    for (const [band, slabs] of Object.entries(data.slabs)) {
      sets.push({ name: `${regime}.${band}`, slabs });
    }
  }
  return sets;
}

test("each rules file loads through its FY", () => {
  for (const file of FILES) {
    const raw = require(path.join(rulesDir, file));
    const rules = getRules(raw.fy);
    assert.equal(rules.fy, raw.fy);
  }
});

test("listFys returns all FYs in ascending order", () => {
  assert.deepEqual(listFys(), ["2024-25", "2025-26", "2026-27"]);
});

test("slab bands are contiguous, ascending and open-ended", () => {
  for (const fy of listFys()) {
    for (const { name, slabs } of slabSets(getRules(fy))) {
      assert.equal(slabs[0].from, 0, `${fy} ${name} must start at 0`);
      for (let i = 0; i < slabs.length; i++) {
        const band = slabs[i];
        const last = i === slabs.length - 1;
        if (last) {
          assert.equal(band.to, null, `${fy} ${name} last band must be open-ended`);
        } else {
          assert.ok(band.from < band.to, `${fy} ${name} band ${i} must be ascending`);
          assert.equal(band.to, slabs[i + 1].from, `${fy} ${name} band ${i} must be contiguous`);
        }
      }
    }
  }
});

test("surcharge thresholds are ascending", () => {
  for (const fy of listFys()) {
    const bands = getRules(fy).surcharge.bands;
    for (let i = 1; i < bands.length; i++) {
      assert.ok(bands[i].above > bands[i - 1].above, `${fy} surcharge band ${i} must ascend`);
    }
  }
});

test("FY2026-27 is flagged unverified", () => {
  assert.equal(getRules("2026-27").unverified, true);
});

test("getRules returns a copy that cannot change the stored rules", () => {
  const first = getRules("2025-26");
  first.cess.value = 999;
  assert.equal(getRules("2025-26").cess.value, 0.04);
});

test("unknown FY throws UnknownFinancialYear", () => {
  assert.throws(() => getRules("2030-31"), UnknownFinancialYear);
  assert.throws(() => getRules("__proto__"), UnknownFinancialYear);
});

test("a null wrapped value makes validation throw RulesIncomplete", () => {
  const broken = { cess: { value: null, verify: true }, regimes: {} };
  assert.throws(() => validateRules("test", broken), (err) => {
    assert.ok(err instanceof RulesIncomplete);
    assert.deepEqual(err.paths, ["cess"]);
    return true;
  });
});

test("structural nulls do not trigger RulesIncomplete", () => {
  const ok = { slabs: [{ from: 0, to: null, rate: { value: 0.3, verify: false } }], cap: { old: null } };
  assert.doesNotThrow(() => validateRules("test", ok));
});
