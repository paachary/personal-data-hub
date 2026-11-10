"use strict";

const RULES = {
  "2024-25": require("./fy2024-25.json"),
  "2025-26": require("./fy2025-26.json"),
  "2026-27": require("./fy2026-27.json"),
};

class RulesIncomplete extends Error {
  constructor(fy, paths) {
    super(`Tax rules for FY ${fy} have unset values at: ${paths.join(", ")}`);
    this.name = "RulesIncomplete";
    this.fy = fy;
    this.paths = paths;
  }
}

class UnknownFinancialYear extends Error {
  constructor(fy) {
    super(`Unknown financial year: ${fy}`);
    this.name = "UnknownFinancialYear";
    this.fy = fy;
  }
}

// Only `{ value, verify }` wrappers are checked. Structural nulls (open-ended slab `to`, "no cap") are not values.
function findUnsetValues(node, path, out) {
  if (Array.isArray(node)) {
    node.forEach((item, i) => findUnsetValues(item, `${path}[${i}]`, out));
  } else if (node && typeof node === "object") {
    if (Object.prototype.hasOwnProperty.call(node, "value") && node.value === null) {
      out.push(path);
    }
    for (const key of Object.keys(node)) {
      findUnsetValues(node[key], path ? `${path}.${key}` : key, out);
    }
  }
  return out;
}

function validateRules(fy, rules) {
  const unset = findUnsetValues(rules, "", []);
  if (unset.length > 0) {
    throw new RulesIncomplete(fy, unset);
  }
  return rules;
}

function getRules(fy) {
  const key = String(fy).trim();
  if (!Object.prototype.hasOwnProperty.call(RULES, key)) {
    throw new UnknownFinancialYear(fy);
  }
  return validateRules(key, structuredClone(RULES[key]));
}

function listFys() {
  return Object.keys(RULES).sort();
}

module.exports = {
  getRules,
  listFys,
  validateRules,
  RulesIncomplete,
  UnknownFinancialYear,
};
