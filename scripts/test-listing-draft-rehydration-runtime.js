const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "src", "homemade-map-cleaned-1.html"), "utf8");
const draftHelpers = require(path.join(root, "src", "helpers", "listing-draft-helpers.js"));
const draftImageHelpers = require(path.join(root, "src", "helpers", "listing-draft-image-helpers.js"));

function extractFunction(input, name) {
  const marker = new RegExp(`function\\s+${name}\\s*\\(`).exec(input);
  assert.ok(marker, `${name} was not found`);
  const start = marker.index;
  const open = input.indexOf("{", start + marker[0].length);
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let i = open; i < input.length; i += 1) {
    const ch = input[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") { quote = ch; continue; }
    if (ch === "{") depth += 1;
    if (ch === "}" && --depth === 0) return input.slice(start, i + 1);
  }
  throw new Error(`${name} body did not close`);
}

const stateStart = source.indexOf("var _inactiveListingDraftHydration=");
const stateEnd = source.indexOf("\nfunction inactiveListingDraftButton()", stateStart);
assert.notEqual(stateStart, -1);
assert.notEqual(stateEnd, -1);
const stateSource = source.slice(stateStart, stateEnd);

function seller(data) {
  return { id: "seller-a", auth_id: "account-a", active: false, data: data || {} };
}

const draftA = {
  version: 1,
  title: "Draft title",
  description: "Draft description",
  category: "catering",
  dietaryTags: ["halal"],
  timeframe: "weekly",
  leadDays: "2",
  menuItems: [{ n: "Draft item", p: 42.5, svs: "1 serving" }],
  updatedAt: "version-a"
};
const draftB = Object.assign({}, draftA, { description: "Newer description", updatedAt: "version-b" });

const calls = { select: 0, update: 0, render: 0, toast: [] };
let profile = {
  role: "seller",
  authId: "account-a",
  sellerId: "seller-a",
  sellerLookupStatus: "loaded",
  raw: seller({ listingDraft: draftA }),
  ownerSeller: null
};

const context = vm.createContext(Object.assign({
  ST: { page: "post" },
  hmAuth: {
    getProfile() { return profile; },
    select(table, match, callback) {
      calls.select += 1;
      callback([profile.raw]);
    },
    update(table, match, values, callback) {
      calls.update += 1;
      callback({ ok: true });
    },
    removePrivateDraftImages(images, sellerId, callback) {
      callback({ ok: true });
    }
  },
  normalizePrivateOwnerSeller(raw) {
    if (!raw) return null;
    return Object.assign({}, raw, { _data: raw.data || {} });
  },
  sessionStorage: { removeItem() {} },
  localStorage: { removeItem() {} },
  showToast(message) { calls.toast.push(message); },
  rPS() { calls.render += 1; },
  discardInactiveDraftImageState() {},
  revokeInactiveDraftPreview(field) { if (field) { field.previewUrl = ""; field.img = ""; } },
  refreshInactiveDraftSignedPreviews() {},
  _inactiveDraftImageCleanupQueue: []
}, draftHelpers, draftImageHelpers));

vm.runInContext([
  extractFunction(source, "defaultPostForm"),
  extractFunction(source, "resetPostDraft"),
  stateSource,
  extractFunction(source, "clearSignedOutState")
].join("\n\n"), context, { filename: "listing-draft-rehydration-source.js" });

function run(code) {
  return vm.runInContext(code, context);
}

function setProfileData(data) {
  profile.raw = seller(data);
  profile.ownerSeller = context.normalizePrivateOwnerSeller(profile.raw);
  profile.sellerId = profile.raw.id;
  profile.sellerLookupStatus = "loaded";
}

run("resetPostDraft()");
setProfileData({ listingDraft: draftA });
const writesBeforeHydration = calls.update;
assert.equal(run("hydrateInactiveListingDraft()"), true);
assert.equal(context.ST.pf.name, "Draft title");
assert.equal(context.ST.pf.desc, "Draft description");
assert.equal(context.ST.pf.cat, "catering");
assert.equal(String(context.ST.pi[0].p), "42.5");
assert.equal(context.ST.pi.length, 1);
assert.equal(calls.update, writesBeforeHydration, "Hydration must not write");

const firstKey = run("_inactiveListingDraftHydration.key");
assert.ok(firstKey.includes(":"));
assert.equal(run("hydrateInactiveListingDraft()"), true);
assert.equal(context.ST.pi.length, 1, "Repeated render must not duplicate menu items");
assert.equal(run("_inactiveListingDraftHydration.key"), firstKey);

run("clearInactiveListingDraftHydrationState();resetPostDraft()");
assert.equal(run("hydrateInactiveListingDraft()"), true, "Full reload state must hydrate");
assert.equal(context.ST.pf.name, "Draft title");

run("clearInactiveListingDraftHydrationState();resetPostDraft()");
setProfileData({});
assert.equal(run("hydrateInactiveListingDraft()"), true);
assert.equal(run("_inactiveListingDraftHydration.hydrated"), false);
assert.equal(run("_inactiveListingDraftHydration.key"), "", "No-draft payload must not mark hydration complete");

calls.render = 0;
const freshA = seller({ listingDraft: draftA });
assert.equal(context.applyFreshPrivateSellerState(profile, freshA, { rerender: true }), true);
assert.equal(context.ST.pf.name, "Draft title", "Async fresh seller must hydrate a clean form");
assert.equal(calls.render, 1);

run("clearInactiveListingDraftHydrationState();resetPostDraft()");
setProfileData({});
run("hydrateInactiveListingDraft();markInactiveListingDraftDirty();ST.pf.name='Unsaved local edit'");
calls.render = 0;
assert.equal(context.applyFreshPrivateSellerState(profile, freshA, { rerender: true }), true);
assert.equal(context.ST.pf.name, "Unsaved local edit", "Fresh data must not overwrite dirty state");
assert.equal(calls.render, 0);

run("clearInactiveListingDraftHydrationState();resetPostDraft()");
setProfileData({ listingDraft: draftA });
run("hydrateInactiveListingDraft()");
const keyA = run("_inactiveListingDraftHydration.key");
calls.render = 0;
assert.equal(context.applyFreshPrivateSellerState(profile, seller({ listingDraft: draftB }), { rerender: true }), true);
assert.notEqual(run("_inactiveListingDraftHydration.key"), keyA);
assert.equal(context.ST.pf.desc, "Newer description");
assert.equal(calls.render, 1);

run("clearInactiveListingDraftHydrationState();resetPostDraft()");
setProfileData({ listingDraft: draftA });
calls.select = 0;
calls.update = 0;
calls.toast = [];
run("saveInactiveListingDraft()");
assert.equal(calls.select, 1);
assert.equal(calls.update, 0, "Blank unhydrated form must not overwrite a persisted draft");
assert.equal(calls.toast.at(-1), "Your saved draft could not be loaded. Refresh and try again before saving.");

run("clearInactiveListingDraftHydrationState();resetPostDraft()");
setProfileData({});
run("markInactiveListingDraftDirty();ST.pf.name='New draft';ST.pf.desc='New description';ST.pi[0].n='New item';ST.pi[0].p='10'");
calls.update = 0;
run("saveInactiveListingDraft()");
assert.equal(calls.update, 1, "A genuinely new edited draft must save");

run("clearInactiveListingDraftHydrationState();resetPostDraft()");
setProfileData({ listingDraft: draftA });
run("markInactiveListingDraftDirty();ST.pf.name='Intentional replacement';ST.pi[0].n='Replacement item';ST.pi[0].p='12'");
calls.update = 0;
run("saveInactiveListingDraft()");
assert.equal(calls.update, 1, "Explicit edits may replace a persisted draft");

setProfileData({ listingDraft: draftA });
run("clearInactiveListingDraftHydrationState();resetPostDraft();hydrateInactiveListingDraft()");
calls.update = 0;
calls.toast = [];
run("saveInactiveListingDraft()");
assert.equal(calls.update, 0, "An unchanged hydrated draft must remain a no-op");
assert.equal(calls.toast.at(-1), "No draft changes to save.");

run("clearInactiveListingDraftHydrationState();resetPostDraft();hydrateInactiveListingDraft()");
assert.equal(run("_inactiveListingDraftHydration.hydrated"), true);
run("clearSignedOutState()");
assert.equal(run("_inactiveListingDraftHydration.hydrated"), false);
assert.equal(run("_inactiveListingDraftHydration.accountId"), "");

setProfileData({ listingDraft: draftA });
run("hydrateInactiveListingDraft()");
context.ST.pf.name = "Seller A";
run("syncInactiveListingDraftAccount({role:'seller',authId:'account-b'})");
assert.equal(run("_inactiveListingDraftHydration.accountId"), "account-b");
assert.equal(context.ST.pf.name, "", "Account switch must clear prior seller draft state");

const hydrateBody = extractFunction(source, "hydrateInactiveListingDraft");
for (const forbidden of ["SELLERS", "hmAuth.update", "uploadListingImg", "uploadMenuItemImg", "goLiveListing", "contactSeller"]) {
  assert.equal(hydrateBody.includes(forbidden), false, `Hydration references forbidden path: ${forbidden}`);
}

console.log("Listing draft rehydration runtime tests passed.");
