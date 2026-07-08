const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const helperPath = path.join(root, "src", "helpers", "storage-key-constants.js");
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
  remember: REMEMBER_EMAIL_KEY,
  homeHeroLast: HM_HOME_HERO_LAST_KEY,
  mapWelcomeSeen: HM_MAP_WELCOME_SEEN_KEY,
  pwaDismissed: HM_PWA_DISMISSED_KEY
})
`, context, { filename: "storage-key-constants-access-test.js" });

const laterAccess = vm.runInContext(`
[
  REMEMBER_EMAIL_KEY,
  HM_HOME_HERO_LAST_KEY,
  HM_MAP_WELCOME_SEEN_KEY,
  HM_PWA_DISMISSED_KEY
].join('|')
`, context, { filename: "storage-key-constants-later-script-test.js" });

check("REMEMBER_EMAIL_KEY preserves the existing value", () => assert.equal(result.remember, "hm_remember_email"));
check("HM_HOME_HERO_LAST_KEY preserves the existing value", () => assert.equal(result.homeHeroLast, "hm_home_hero_last"));
check("HM_MAP_WELCOME_SEEN_KEY preserves the existing value", () => assert.equal(result.mapWelcomeSeen, "hm_map_welcome_seen"));
check("HM_PWA_DISMISSED_KEY preserves the existing value", () => assert.equal(result.pwaDismissed, "pwa-dismissed"));
check("later classic script can access all storage key constants by identifier", () => {
  assert.equal(laterAccess, "hm_remember_email|hm_home_hero_last|hm_map_welcome_seen|pwa-dismissed");
});

console.log(`Storage key constants tests passed: ${checks}`);
