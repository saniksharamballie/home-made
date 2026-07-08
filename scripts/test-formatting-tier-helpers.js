const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const helperPath = path.join(root, "src", "helpers", "formatting-tier-helpers.js");
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

const context = vm.createContext({ Date, Number, String, Array, Object, RegExp, Math, isNaN });
vm.runInContext(source, context, { filename: helperPath });

const result = JSON.parse(JSON.stringify(vm.runInContext(`
({
  hmNumberCurrency: hmNumber('R1,234.50', 0),
  hmNumberFallback: hmNumber('not-a-number', 42),
  tierPrices: [TIER_PRICES.standard, TIER_PRICES.gold, TIER_PRICES.platinum],
  tierTrialDays: [TIER_TRIAL_DAYS.standard, TIER_TRIAL_DAYS.gold, TIER_TRIAL_DAYS.platinum],
  tierRankGold: tierRank('gold'),
  tierRankUnknown: tierRank('unknown'),
  tierDisplayPlatinum: tierDisplayLabel('platinum'),
  tierDisplayBlank: tierDisplayLabel(''),
  tierMonthlyPriceGold: tierMonthlyPrice('gold'),
  tierMonthlyPriceUnknown: tierMonthlyPrice('unknown'),
  tierTrialDaysPlatinum: tierTrialDays('platinum'),
  tierPriceLabelGold: tierPriceLabel('gold'),
  tierPriceLabelStandard: tierPriceLabel('standard'),
  nextSellerTierStandard: nextSellerTier('standard'),
  nextSellerTierGold: nextSellerTier('gold'),
  nextSellerTierPlatinum: nextSellerTier('platinum'),
  sellerTierClassPlatinum: sellerTierClass('platinum'),
  sellerTierClassGold: sellerTierClass('gold'),
  sellerTierClassUnknown: sellerTierClass('unknown'),
  sellerBirthdayValue: sellerBirthdayValue({_data:{sellerBirthMonth:'7'}}),
  sellerBirthdayFallback: sellerBirthdayValue({data:{dob:'2026-07-07'}}),
  isBirthdayMonthNumeric: isBirthdayMonth(String(new Date().getMonth()+1)),
  isBirthdayMonthInvalid: isBirthdayMonth('not-a-date'),
  sellerBaseTierPaid: sellerBaseTier({_data:{paidTier:'gold'}, tier:'standard'}),
  sellerEffectiveTierAdmin: sellerEffectiveTier({_data:{paidTier:'standard',adminTier:'platinum',adminTierPermanent:true}}),
  applySellerComputedAccessTier: applySellerComputedAccess({_data:{paidTier:'gold'}}).tier,
  hmBoolTrue: hmBool('yes', false),
  hmBoolFalseString: hmBool('false', true),
  hmBoolFallback: hmBool('', true),
  hmTagArrayList: hmTagArray('halal, vegan, , spicy'),
  hmTagArrayExisting: hmTagArray(['halal', '', 'vegan'])
})
`, context, { filename: "formatting-tier-helper-access-test.js" })));

check("hmNumber strips currency-like text", () => assert.equal(result.hmNumberCurrency, 1234.5));
check("hmNumber returns fallback for invalid numbers", () => assert.equal(result.hmNumberFallback, 42));
check("TIER_PRICES values match canonical pricing", () => assert.deepEqual(result.tierPrices, [0, 149, 299]));
check("TIER_TRIAL_DAYS values match original trials", () => assert.deepEqual(result.tierTrialDays, [0, 7, 3]));
check("tierRank returns expected ranks and fallback", () => assert.deepEqual([result.tierRankGold, result.tierRankUnknown], [1, 0]));
check("tierDisplayLabel returns seller labels", () => assert.deepEqual([result.tierDisplayPlatinum, result.tierDisplayBlank], ["Platinum Seller", "Standard Seller"]));
check("tierMonthlyPrice returns pricing and fallback", () => assert.deepEqual([result.tierMonthlyPriceGold, result.tierMonthlyPriceUnknown], [149, 0]));
check("tierTrialDays returns trial days", () => assert.equal(result.tierTrialDaysPlatinum, 3));
check("tierPriceLabel formats paid and free tiers", () => assert.deepEqual([result.tierPriceLabelGold, result.tierPriceLabelStandard], ["R149/mo", "Free"]));
check("nextSellerTier returns the next paid tier or empty string", () => assert.deepEqual([result.nextSellerTierStandard, result.nextSellerTierGold, result.nextSellerTierPlatinum], ["gold", "platinum", ""]));
check("sellerTierClass returns badge classes", () => assert.deepEqual([result.sellerTierClassPlatinum, result.sellerTierClassGold, result.sellerTierClassUnknown], ["bp", "bgold", "bstd"]));
check("sellerBirthdayValue reads supported fields", () => assert.deepEqual([result.sellerBirthdayValue, result.sellerBirthdayFallback], ["7", "2026-07-07"]));
check("isBirthdayMonth handles current month and invalid values", () => assert.deepEqual([result.isBirthdayMonthNumeric, result.isBirthdayMonthInvalid], [true, false]));
check("sellerBaseTier preserves original tier precedence", () => assert.equal(result.sellerBaseTierPaid, "gold"));
check("sellerEffectiveTier applies active admin boost", () => assert.equal(result.sellerEffectiveTierAdmin, "platinum"));
check("applySellerComputedAccess writes base and effective tier", () => assert.equal(result.applySellerComputedAccessTier, "gold"));
check("hmBool handles truthy strings, false strings and fallback", () => assert.deepEqual([result.hmBoolTrue, result.hmBoolFalseString, result.hmBoolFallback], [true, false, true]));
check("hmTagArray normalizes strings and arrays", () => assert.deepEqual([result.hmTagArrayList, result.hmTagArrayExisting], [["halal", "vegan", "spicy"], ["halal", "vegan"]]));

console.log(`Formatting/tier helper tests passed: ${checks}`);
