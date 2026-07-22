const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "src", "homemade-map-cleaned-1.html"), "utf8");
const validationSource = fs.readFileSync(
  path.join(root, "src", "helpers", "seller-post-validation-helpers.js"),
  "utf8"
);
const directoryMigration = fs.readFileSync(
  path.join(root, "supabase", "migrations", "20260707134842_remove_public_whatsapp_fields_from_seller_directory.sql"),
  "utf8"
);
const {
  canNavigateInactiveListingDraft
} = require(path.join(root, "src", "helpers", "listing-draft-navigation-helpers.js"));

let checks = 0;
function check(name, fn) {
  fn();
  checks += 1;
}

function occurrenceCount(source, needle) {
  return source.split(needle).length - 1;
}

function functionBody(source, name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} was not found`);
  const open = source.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  throw new Error(`${name} body did not close`);
}

function publicationMissing(form, items, step) {
  const context = {
    ST: { pf: form, pi: items },
    normalizePhoneNumber: (value) => String(value || "").replace(/\D/g, "")
  };
  vm.runInNewContext(validationSource, context);
  return context.postMissingForStep(step);
}

const inactiveOwner = { id: "private-owner", active: false };
const completeStepOne = {
  name: "Draft",
  desc: "Draft description",
  wa: "0123456789",
  waConfirm: "0123456789",
  img: "listing-image",
  region: "region",
  cat: "other",
  del: false,
  pu: true,
  fee: "",
  timeframe: "weekly",
  legalAccepted: true
};
const completeItems = [{ n: "Item", p: 1, svs: "1 person", img: "item-image" }];

check("inactive linked seller can navigate Step 1 to Step 2 without phone", () => {
  assert.equal(canNavigateInactiveListingDraft(inactiveOwner, 1, 2), true);
});
check("draft navigation is independent of listing image", () => {
  assert.equal(canNavigateInactiveListingDraft(inactiveOwner, 1, 2), true);
});
check("draft navigation is independent of location", () => {
  assert.equal(canNavigateInactiveListingDraft(inactiveOwner, 1, 2), true);
});
check("draft navigation is independent of fulfilment", () => {
  assert.equal(canNavigateInactiveListingDraft(inactiveOwner, 1, 2), true);
});
check("draft navigation is independent of legal acceptance", () => {
  assert.equal(canNavigateInactiveListingDraft(inactiveOwner, 2, 3), true);
});
check("Step 2 can advance without a menu-item image", () => {
  assert.equal(canNavigateInactiveListingDraft(inactiveOwner, 2, 3), true);
});
check("draft navigation is adjacent and fail-closed", () => {
  assert.equal(canNavigateInactiveListingDraft(null, 1, 2), false);
  assert.equal(canNavigateInactiveListingDraft({ active: true }, 1, 2), false);
  assert.equal(canNavigateInactiveListingDraft(inactiveOwner, 1, 3), false);
  assert.equal(canNavigateInactiveListingDraft(inactiveOwner, 0, 1), false);
});

const navigationBody = functionBody(app, "postNext");
const navigationStateBody = functionBody(app, "postCanNavigateForward");
const resolverBody = functionBody(app, "hmPrivateOwnerSellerForDraft");
const goLiveBody = functionBody(app, "goLiveListing");
const saveDraftBody = functionBody(app, "saveInactiveListingDraft");

check("navigation is owner-scoped through private inactive seller state", () => {
  assert.match(navigationBody, /canNavigateInactiveListingDraft\(hmPrivateOwnerSellerForDraft\(\)/);
  assert.match(navigationStateBody, /hmPrivateOwnerSellerForDraft\(\)/);
  assert.match(resolverBody, /profile\.role!==['"]seller['"]/);
  assert.match(resolverBody, /seller\.auth_id/);
  assert.match(resolverBody, /seller\.active===false/);
  assert.equal(/\bSELLERS\b|seller_directory|displayName|email/.test(resolverBody), false);
});

for (const [label, forbidden] of [
  ["upload handlers", /uploadListingImg|uploadMenuItemImg|storage\.from|getPublicUrl/],
  ["draft save", /saveInactiveListingDraft/],
  ["Go Live", /goLiveListing/],
  ["publish persistence", /buildPublishedSeller|persistPublishedSeller|syncPublishedSeller/],
  ["active state", /\bactive\s*[:=]/],
  ["contact or WhatsApp", /contact|WhatsApp|whatsapp|\bwa\b/i],
  ["seller writes", /hmAuth\.(?:update|insert|upsert)|\.update\s*\(/],
  ["public directory state", /seller_directory|\bSELLERS\b/]
]) {
  check(`navigation does not invoke ${label}`, () => {
    assert.equal(forbidden.test(navigationBody), false);
  });
}

check("navigation falls back to publication completeness for non-draft flows", () => {
  assert.match(navigationBody, /postMissingForStep\(ST\.ps\|\|1\)/);
  assert.match(navigationBody, /markPostMissing/);
});
check("Go Live still uses complete publication validation", () => {
  assert.match(goLiveBody, /postMissingAll\(\)/);
  assert.match(goLiveBody, /postMissingForStep\(ST\.ps\)/);
  assert.match(goLiveBody, /buildPublishedSeller\(\)/);
  assert.match(goLiveBody, /persistPublishedSeller/);
});
check("Go Live still rejects missing phone and confirmation", () => {
  const missing = publicationMissing({ ...completeStepOne, wa: "", waConfirm: "" }, completeItems, 1);
  assert.ok(missing.includes("wa"));
  assert.ok(missing.includes("waConfirm"));
});
check("Go Live still rejects a missing listing image", () => {
  assert.ok(publicationMissing({ ...completeStepOne, img: "" }, completeItems, 1).includes("listingPhoto"));
});
check("Go Live still rejects a missing location", () => {
  assert.ok(publicationMissing({ ...completeStepOne, region: "" }, completeItems, 1).includes("region"));
});
check("Go Live still rejects missing fulfilment", () => {
  assert.ok(publicationMissing({ ...completeStepOne, pu: false, del: false }, completeItems, 1).includes("fulfilment"));
});
check("Go Live still rejects a missing menu-item image", () => {
  assert.ok(publicationMissing(completeStepOne, [{ ...completeItems[0], img: "" }], 2).includes("itemPhoto_0"));
});
check("Go Live still rejects missing legal acceptance", () => {
  assert.ok(publicationMissing({ ...completeStepOne, legalAccepted: false }, completeItems, 3).includes("legal"));
});
check("Save Draft remains text-only and image-free", () => {
  assert.equal(/uploadListingImg|uploadMenuItemImg|storage\.from|getPublicUrl|legalAccepted/.test(saveDraftBody), false);
});
check("Save Draft and Go Live remain distinct UI actions", () => {
  assert.match(app, /onclick="saveInactiveListingDraft\(\)"[^>]*>[\s\S]*?Save Draft/);
  assert.match(app, /onclick="[^"]*goLiveListing\(\)[^"]*"/);
  assert.match(app, /postCanNavigateForward\(2\)/);
  assert.match(app, /postCanNavigateForward\(3\)/);
});
check("public seller directory remains active-only", () => {
  assert.match(directoryMigration, /where\s+s\.active\s*=\s*true/i);
  assert.equal(/listingDraft/i.test(directoryMigration), false);
});
check("exactly one effective Go Live declaration remains", () => {
  assert.equal(occurrenceCount(app, "function goLiveListing()"), 1);
});

console.log(`Listing draft navigation guardrail tests passed (${checks} checks).`);
