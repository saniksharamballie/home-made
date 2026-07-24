const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const app = fs.readFileSync(path.join(root, "src", "homemade-map-cleaned-1.html"), "utf8");
const directoryMigration = fs.readFileSync(
  path.join(root, "supabase", "migrations", "20260707134842_remove_public_whatsapp_fields_from_seller_directory.sql"),
  "utf8"
);
const {
  buildInactiveListingDraftPatch,
  normalizeListingDraft
} = require(path.join(root, "src", "helpers", "listing-draft-helpers.js"));

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

const existingData = {
  contactEmail: "preserved",
  contactName: "preserved",
  wa: "preserved",
  imagePath: "preserved",
  tier: "gold",
  campaign: { status: "private" },
  publication: { live: false },
  menu: [{ name: "published item remains untouched" }],
  nested: { preserved: true }
};
const form = {
  name: "Draft Kitchen",
  desc: "Text-only draft",
  cat: "african",
  dietary: ["halal", "halal", "vegan"],
  timeframe: "weekly",
  leadDays: 3,
  wa: "must not persist",
  legalAccepted: false,
  img: "must not persist"
};
const items = [
  { n: "Meal one", p: "85", svs: "1 person", hot: true, img: "must not persist" },
  { n: "Meal two", p: "", svs: "2 people", hot: false }
];
const now = "2026-07-22T00:00:00.000Z";

check("inactive text-only draft produces a narrow seller patch", () => {
  const patch = buildInactiveListingDraftPatch(existingData, form, items, now);
  assert.equal(patch.changed, true);
  assert.deepEqual(Object.keys(patch.sellerValues).sort(), ["data", "updated_at"]);
  assert.equal(patch.sellerValues.updated_at, now);
  assert.equal(patch.sellerValues.data.listingDraft.title, "Draft Kitchen");
  assert.equal(patch.sellerValues.data.listingDraft.description, "Text-only draft");
  assert.deepEqual(patch.sellerValues.data.listingDraft.dietaryTags, ["halal", "vegan"]);
});

check("draft contains approved text fields plus normalized private image slots and no contact, legal or publication data", () => {
  const draft = buildInactiveListingDraftPatch(existingData, form, items, now).draft;
  assert.deepEqual(Object.keys(draft).sort(), [
    "category", "description", "dietaryTags", "leadDays", "listingImage", "menuItems", "timeframe", "title", "updatedAt", "version"
  ]);
  assert.deepEqual(Object.keys(draft.menuItems[0]).sort(), ["image", "n", "p", "svs"]);
  assert.equal(draft.listingImage, null);
  assert.equal(draft.menuItems[0].image, null);
  for (const forbidden of ["active", "contact", "phone", "wa", "whatsapp", "legal", "campaign", "publication", "tier", "subscription"]) {
    assert.equal(JSON.stringify(draft).toLowerCase().includes(`\"${forbidden}`), false, `${forbidden} leaked into draft data`);
  }
});

check("unrelated seller JSON remains deep equal", () => {
  const patch = buildInactiveListingDraftPatch(existingData, form, items, now);
  const preserved = Object.assign({}, patch.sellerValues.data);
  delete preserved.listingDraft;
  assert.deepEqual(preserved, existingData);
  assert.notEqual(patch.sellerValues.data, existingData);
});

check("unchanged and duplicate draft saves perform no write or item duplication", () => {
  const first = buildInactiveListingDraftPatch(existingData, form, items, now);
  const second = buildInactiveListingDraftPatch(first.sellerValues.data, form, items, "2026-07-22T00:01:00.000Z");
  assert.equal(second.changed, false);
  assert.deepEqual(second.sellerValues, {});
  assert.equal(second.draft.menuItems.length, 2);
  assert.deepEqual(second.draft, normalizeListingDraft(first.draft));
});

const saveBody = functionBody(app, "saveInactiveListingDraft");
const resolverBody = functionBody(app, "hmPrivateOwnerSellerForDraft");
const hydrateBody = functionBody(app, "hydrateInactiveListingDraft");

check("draft save uses authenticated private seller state and fails closed", () => {
  assert.match(resolverBody, /profile\.ownerSeller\|\|normalizePrivateOwnerSeller\(profile\.raw\)/);
  assert.match(resolverBody, /seller\.auth_id/);
  assert.match(resolverBody, /profile\.authId/);
  assert.match(resolverBody, /seller\.active===false/);
  assert.equal(/\bSELLERS\b|seller_directory|displayName|email/.test(resolverBody), false);
  assert.match(hydrateBody, /data\.listingDraft/);
  assert.match(hydrateBody, /resetPostDraft\(\)/, "owner change must clear stale in-memory draft state before hydration");
  assert.equal(/\bSELLERS\b|seller_directory/.test(hydrateBody), false);
});

check("draft save is selective and cannot publish, upload, contact or create rows", () => {
  assert.match(saveBody, /buildInactiveListingDraftPatch/);
  assert.match(saveBody, /hmAuth\.select\('sellers',\{auth_id:profile\.authId\}/);
  assert.match(saveBody, /rows\.length!==1/);
  assert.match(saveBody, /hmAuth\.update\('sellers',\{id:freshSeller\.id,auth_id:profile\.authId\}/);
  assert.match(saveBody, /patch\.sellerValues/);
  assert.match(saveBody, /No draft changes to save\./);
  for (const forbidden of [
    "goLiveListing", "buildPublishedSeller", "persistPublishedSeller", "uploadListingImg", "uploadMenuItemImg",
    "seller-images", "listing-uploads", "getPublicUrl", "storage.from", "WhatsApp", "seller_directory", "SELLERS",
    "hmAuth.insert", "hmAuth.upsert", "profiles", "seller_access_requests"
  ]) {
    assert.equal(saveBody.includes(forbidden), false, `draft save references ${forbidden}`);
  }
  assert.equal(/\bactive\s*[:=]/.test(saveBody), false, "draft save must not alter active state");
});

check("Save Draft and publish remain explicit separate actions", () => {
  assert.equal(occurrenceCount(app, "function saveInactiveListingDraft()"), 1);
  assert.equal(occurrenceCount(app, "function goLiveListing()"), 1);
  assert.match(app, /onclick="saveInactiveListingDraft\(\)"[^>]*>[\s\S]*?Save Draft/);
  assert.match(app, /onclick="[^"]*goLiveListing\(\)[^"]*"/);
  assert.equal(saveBody.includes("ST.pdone"), false);
});

check("inactive draft cannot change public directory membership or WhatsApp privacy", () => {
  assert.match(directoryMigration, /where\s+s\.active\s*=\s*true/i);
  assert.equal(/listingDraft/i.test(directoryMigration), false);
  assert.match(directoryMigration, /as\s+"hasWhatsApp"/);
  assert.equal(/\bs\.wa\s+as\s+wa\b|\bphone\s+as\b|\bwhatsapp\s+as\b/i.test(directoryMigration), false);
});

check("existing storefront, hydration, storage-key and map guards remain wired", () => {
  assert.match(app, /buildSellerStorefrontSelectivePatch/);
  assert.match(app, /resolveOwnerSellerState/);
  assert.match(app, /HM_MAP_WELCOME_SEEN_KEY/);
  assert.match(app, /HM_PWA_DISMISSED_KEY/);
  assert.match(app, /function\s+destroyLeafMap\s*\(/);
});

console.log(`Listing draft guardrail tests passed (${checks} checks).`);
