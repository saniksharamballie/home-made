const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const helperPath = path.join(root, "src", "helpers", "filter-region-constants.js");
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

const expectedDietary = ["Vegan", "Vegetarian", "Halaal", "Kosher", "Gluten-Free", "Dairy-Free", "Nut-Free"];
const expectedHealthFilters = [
  { id: "Low Sugar", e: "\u{1F36C}", group: "Health" },
  { id: "Low Salt", e: "\u{1F9C2}", group: "Health" },
  { id: "High Protein", e: "\u{1F4AA}", group: "Health" },
  { id: "Weight Loss", e: "\u2696\uFE0F", group: "Health" },
  { id: "Mild Spice", e: "\u{1F60A}", group: "Health" },
  { id: "Soft Foods", e: "\u{1F963}", group: "Health" },
  { id: "Heart Healthy", e: "\u2764\uFE0F", group: "Health" },
  { id: "Kidney-Friendly", e: "\u{1FAD8}", group: "Health" },
  { id: "High Fibre", e: "\u{1F33E}", group: "Health" },
  { id: "Low GI", e: "\u{1F4C9}", group: "Health" },
  { id: "Keto", e: "\u{1F951}", group: "Health" },
  { id: "High Calorie", e: "\u{1F50B}", group: "Health" },
  { id: "Pregnancy-Friendly", e: "\u{1F930}", group: "Health" },
  { id: "Low Purine", e: "\u{1F4A7}", group: "Health" }
];
const expectedRegions = ["All Areas", "Umhlanga", "La Lucia", "Durban North", "Berea", "Musgrave", "Durban CBD", "Westville", "Pinetown", "Chatsworth", "Amanzimtoti"];

check("helper partial avoids browser and app state dependencies", () => {
  for (const dependency of forbiddenDependencies) {
    assert.equal(new RegExp(`\\b${dependency}\\b`).test(source), false, `Unexpected dependency: ${dependency}`);
  }
});

const context = vm.createContext({});
vm.runInContext(source, context, { filename: helperPath });

const result = JSON.parse(JSON.stringify(vm.runInContext(`
({
  dietary: DIETARY,
  healthFilters: HEALTH_FILTERS,
  allFilters: ALL_FILTERS,
  regions: REGIONS
})
`, context, { filename: "filter-region-constants-access-test.js" })));

const laterAccess = vm.runInContext(`
DIETARY.length + '|' + HEALTH_FILTERS.length + '|' + ALL_FILTERS.length + '|' + REGIONS.length
`, context, { filename: "filter-region-constants-later-script-test.js" });

check("DIETARY values and order are unchanged", () => assert.deepEqual(result.dietary, expectedDietary));
check("HEALTH_FILTERS values and order are unchanged", () => assert.deepEqual(result.healthFilters, expectedHealthFilters));
check("ALL_FILTERS derives dietary values plus health filter ids", () => {
  assert.deepEqual(result.allFilters, expectedDietary.concat(expectedHealthFilters.map((filter) => filter.id)));
});
check("REGIONS values and order are unchanged", () => assert.deepEqual(result.regions, expectedRegions));
check("later classic script can access all declarations by identifier", () => {
  assert.equal(laterAccess, "7|14|21|11");
});

console.log(`Filter/region constants tests passed: ${checks}`);
