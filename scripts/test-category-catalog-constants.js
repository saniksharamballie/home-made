const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const helperPath = path.join(root, "src", "helpers", "category-catalog-constants.js");
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

const expectedCats = [
  { id: "all", l: "All", e: "\u{1F37D}\uFE0F" },
  { id: "african", l: "African", e: "\u{1F958}" },
  { id: "indian", l: "Indian", e: "\u{1F35B}" },
  { id: "baked", l: "Baked Goods", e: "\u{1F35E}" },
  { id: "bbq", l: "BBQ & Braai", e: "\u{1F356}" },
  { id: "vegan", l: "Vegan", e: "\u{1F957}" },
  { id: "italian", l: "Italian", e: "\u{1F35D}" },
  { id: "asian", l: "Asian", e: "\u{1F371}" },
  { id: "desserts", l: "Desserts", e: "\u{1F370}" },
  { id: "seafood", l: "Seafood", e: "\u{1F99E}" },
  { id: "street", l: "Street Food", e: "\u{1F32E}" },
  { id: "catering", l: "Home Caterer", e: "\u{1F37D}\uFE0F" }
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

const result = JSON.parse(JSON.stringify(vm.runInContext(`
({
  isArray: Array.isArray(CATS),
  cats: CATS,
  shapes: CATS.map(function(cat){ return Object.keys(cat); })
})
`, context, { filename: "category-catalog-constants-access-test.js" })));

const laterAccess = vm.runInContext(`CATS.map(function(cat){ return cat.id; }).join('|')`, context, { filename: "category-catalog-constants-later-script-test.js" });

check("CATS remains an array", () => assert.equal(result.isArray, true));
check("CATS ids, labels, icons and order are unchanged", () => assert.deepEqual(result.cats, expectedCats));
check("every CATS item retains the same object shape", () => {
  assert.deepEqual(result.shapes, expectedCats.map(() => ["id", "l", "e"]));
});
check("later classic script can access CATS by identifier", () => {
  assert.equal(laterAccess, expectedCats.map((cat) => cat.id).join("|"));
});

console.log(`Category catalog constants tests passed: ${checks}`);
