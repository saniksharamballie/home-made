const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const helperPath = path.join(root, "src", "helpers", "input-normalization-helpers.js");
const source = fs.readFileSync(helperPath, "utf8");
const forbiddenDependencies = [
  "document",
  "window",
  "localStorage",
  "sessionStorage",
  "navigator",
  "fetch",
  "supabase",
  "hmAuth",
  "SELLERS",
  "ST",
  "ADM",
  "CART"
];

let checks = 0;
function check(name, fn) {
  fn();
  checks += 1;
}

check("helper partial avoids browser and app state dependencies", () => {
  for (const dependency of forbiddenDependencies) {
    assert.equal(new RegExp(`\\b${dependency}\\b`).test(source), false, `Unexpected dependency: ${dependency}`);
  }
});

const context = vm.createContext({});
vm.runInContext(source, context, { filename: helperPath });

const result = vm.runInContext(`
({
  nullValue: normalizePhoneNumber(null),
  undefinedValue: normalizePhoneNumber(undefined),
  empty: normalizePhoneNumber(''),
  digitsOnly: normalizePhoneNumber('27821234567'),
  spaces: normalizePhoneNumber('278 212 345 67'),
  dashes: normalizePhoneNumber('278-212-345-67'),
  brackets: normalizePhoneNumber('(278) (212) (34567)'),
  mixedSeparators: normalizePhoneNumber('+27 (82)-123 4567'),
  oneLeadingPlus: normalizePhoneNumber('+27821234567'),
  embeddedPlus: normalizePhoneNumber('27+821234567'),
  multiplePlus: normalizePhoneNumber('++2782+123+4567'),
  alphabetic: normalizePhoneNumber('tel:+27abc82HOME1234567'),
  shortValue: normalizePhoneNumber('082'),
  alreadyNormalized: normalizePhoneNumber('27821234567')
})
`, context, { filename: "input-normalization-access-test.js" });

const laterAccess = vm.runInContext(`
normalizePhoneNumber('+27 (82) 123-4567')
`, context, { filename: "input-normalization-later-script-test.js" });

check("null normalizes through current falsy coercion", () => assert.equal(result.nullValue, ""));
check("undefined normalizes through current falsy coercion", () => assert.equal(result.undefinedValue, ""));
check("empty string remains empty", () => assert.equal(result.empty, ""));
check("digits only remains unchanged", () => assert.equal(result.digitsOnly, "27821234567"));
check("spaces are stripped", () => assert.equal(result.spaces, "27821234567"));
check("dashes are stripped", () => assert.equal(result.dashes, "27821234567"));
check("brackets are stripped", () => assert.equal(result.brackets, "27821234567"));
check("mixed separators are stripped and one leading plus is removed", () => assert.equal(result.mixedSeparators, "27821234567"));
check("one leading plus is stripped", () => assert.equal(result.oneLeadingPlus, "27821234567"));
check("embedded plus is preserved", () => assert.equal(result.embeddedPlus, "27+821234567"));
check("multiple plus signs preserve non-leading plus signs", () => assert.equal(result.multiplePlus, "+2782+123+4567"));
check("alphabetic characters are stripped", () => assert.equal(result.alphabetic, "27821234567"));
check("short phone values remain short after normalization", () => assert.equal(result.shortValue, "082"));
check("already-normalized value remains unchanged", () => assert.equal(result.alreadyNormalized, "27821234567"));
check("later classic script can access normalizePhoneNumber by identifier", () => {
  assert.equal(laterAccess, "27821234567");
});

console.log(`Input normalization helper tests passed: ${checks}`);
