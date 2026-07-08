const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const helperPath = path.join(root, "src", "helpers", "date-time-helpers.js");
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

function currentFormatSellerBackAt(value) {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleString("en-ZA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function currentToDatetimeLocalValue(value) {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value).slice(0, 16);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

check("helper partial avoids browser and app state dependencies", () => {
  for (const dependency of forbiddenDependencies) {
    assert.equal(new RegExp(`\\b${dependency}\\b`).test(source), false, `Unexpected dependency: ${dependency}`);
  }
});

const context = vm.createContext({ Date, String, isNaN });
vm.runInContext(source, context, { filename: helperPath });

const result = vm.runInContext(`
({
  backAtNull: formatSellerBackAt(null),
  backAtUndefined: formatSellerBackAt(undefined),
  backAtEmpty: formatSellerBackAt(''),
  backAtInvalid: formatSellerBackAt('not-a-date'),
  backAtIso: formatSellerBackAt('2026-07-08T09:30:00Z'),
  backAtDateOnly: formatSellerBackAt('2026-07-08'),
  localNull: toDatetimeLocalValue(null),
  localUndefined: toDatetimeLocalValue(undefined),
  localEmpty: toDatetimeLocalValue(''),
  localInvalid: toDatetimeLocalValue('not-a-date-value-that-is-long'),
  localIso: toDatetimeLocalValue('2026-07-08T09:30:00Z')
})
`, context, { filename: "date-time-helper-access-test.js" });

const laterAccess = vm.runInContext(`
formatSellerBackAt('2026-07-08T09:30:00Z') + '|' + toDatetimeLocalValue('2026-07-08T09:30:00Z')
`, context, { filename: "date-time-helper-later-script-test.js" });

check("formatSellerBackAt handles null, undefined and empty values", () => {
  assert.deepEqual([result.backAtNull, result.backAtUndefined, result.backAtEmpty], ["", "", ""]);
});
check("formatSellerBackAt returns String(value) for invalid input", () => assert.equal(result.backAtInvalid, "not-a-date"));
check("formatSellerBackAt matches current ISO timestamp formatting", () => {
  assert.equal(result.backAtIso, currentFormatSellerBackAt("2026-07-08T09:30:00Z"));
});
check("formatSellerBackAt accepts date-only input according to current Date parsing", () => {
  assert.equal(result.backAtDateOnly, currentFormatSellerBackAt("2026-07-08"));
});
check("toDatetimeLocalValue handles null, undefined and empty values", () => {
  assert.deepEqual([result.localNull, result.localUndefined, result.localEmpty], ["", "", ""]);
});
check("toDatetimeLocalValue returns sliced String(value) for invalid input", () => {
  assert.equal(result.localInvalid, "not-a-date-value");
});
check("toDatetimeLocalValue matches current timezone-offset adjustment formula", () => {
  assert.equal(result.localIso, currentToDatetimeLocalValue("2026-07-08T09:30:00Z"));
});
check("toDatetimeLocalValue returns datetime-local shape", () => {
  assert.match(result.localIso, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
});
check("later classic script can access both declarations by identifier", () => {
  assert.equal(laterAccess, `${currentFormatSellerBackAt("2026-07-08T09:30:00Z")}|${currentToDatetimeLocalValue("2026-07-08T09:30:00Z")}`);
});

console.log(`Date/time helper tests passed: ${checks}`);
