const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const helperPath = path.join(root, "src", "helpers", "currency-format-helpers.js");
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

const context = vm.createContext({ Number });
vm.runInContext(source, context, { filename: helperPath });

const result = vm.runInContext(`
({
  zero: zar(0),
  whole: zar(149),
  decimal: zar(149.5),
  numericString: zar('12.3'),
  invalid: zar('not-a-number'),
  negative: zar(-12.3),
  hasNarrowNoBreakSpace: zar(1).includes('\\u202F')
})
`, context, { filename: "currency-format-helper-access-test.js" });

const laterAccess = vm.runInContext(`zar(5)`, context, { filename: "currency-format-helper-later-script-test.js" });

check("zar formats zero", () => assert.equal(result.zero, "R\u202F0.00"));
check("zar formats whole numbers", () => assert.equal(result.whole, "R\u202F149.00"));
check("zar formats decimals", () => assert.equal(result.decimal, "R\u202F149.50"));
check("zar preserves numeric-string coercion", () => assert.equal(result.numericString, "R\u202F12.30"));
check("zar preserves invalid input behavior", () => assert.equal(result.invalid, "R\u202FNaN"));
check("zar preserves negative value behavior", () => assert.equal(result.negative, "R\u202F-12.30"));
check("zar output contains narrow no-break space", () => assert.equal(result.hasNarrowNoBreakSpace, true));
check("later classic script can access zar by identifier", () => assert.equal(laterAccess, "R\u202F5.00"));

console.log(`Currency format helper tests passed: ${checks}`);
