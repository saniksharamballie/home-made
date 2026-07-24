const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "src", "homemade-map-cleaned-1.html"), "utf8");
const draftHelpers = require(path.join(root, "src", "helpers", "listing-draft-helpers.js"));
const imageHelpers = require(path.join(root, "src", "helpers", "listing-draft-image-helpers.js"));
const authId = "11111111-1111-4111-8111-111111111111";

function extractFunction(input, name) {
  const match = new RegExp(`function\\s+${name}\\s*\\(`).exec(input);
  assert.ok(match, `${name} not found`);
  const start = match.index;
  const open = input.indexOf("{", start);
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = open; index < input.length; index += 1) {
    const char = input[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === "'" || char === '"' || char === "`") { quote = char; continue; }
    if (char === "{") depth += 1;
    if (char === "}" && --depth === 0) return input.slice(start, index + 1);
  }
  throw new Error(`${name} did not close`);
}

const runtime = [
  "inactiveDraftSaveBusy",
  "inactiveDraftMutationAllowed",
  "invalidateInactiveDraftSaveOperation",
  "snapshotInactiveDraftField",
  "beginInactiveDraftSaveOperation",
  "inactiveDraftSaveOperationCurrent",
  "finishInactiveDraftSaveOperation",
  "inactiveDraftImageUploadSlots",
  "uploadInactiveDraftImageSlots",
  "inactiveDraftImageSaveState",
  "rollbackInactiveDraftImages",
  "rollbackInactiveDraftSaveOperation",
  "applyInactiveDraftImageSaveState",
  "cleanupPersistedInactiveDraftImages",
  "retryInactiveDraftImageCleanup",
  "saveInactiveListingDraft",
  "inactiveListingDraftButton",
  "removeInactiveDraftListingImage",
  "goLiveListing"
].map((name) => extractFunction(source, name)).join("\n\n");

function image(id) {
  return {
    bucket: "seller-draft-images",
    path: `drafts/${authId}/42/${id}.webp`,
    mimeType: "image/webp",
    size: 100,
    width: 10,
    height: 10
  };
}

function scenario() {
  const oldImage = image("22222222-2222-4222-8222-222222222222");
  const uploadedImage = image("33333333-3333-4333-8333-333333333333");
  const persistedDraft = draftHelpers.listingDraftContent(
    { name: "Draft", desc: "Text", cat: "other", draftImage: oldImage },
    [{ n: "Item", p: 10, svs: "1" }]
  );
  const seller = { id: 42, auth_id: authId, active: false, data: { listingDraft: persistedDraft } };
  const profile = { role: "seller", authId, sellerId: 42, sellerLookupStatus: "loaded", ownerSeller: seller };
  const callbacks = { select: [], upload: [], update: [] };
  const calls = { select: 0, upload: 0, update: 0, removed: [], toasts: [] };
  const context = vm.createContext(Object.assign({
    ST: {
      page: "post",
      pf: { name: "Draft", desc: "Text", cat: "other", dietary: [], draftImage: oldImage, stagedImage: { file: {}, width: 10, height: 10 }, removeImage: false, img: "blob:old", previewUrl: "blob:old" },
      pi: [{ n: "Item", p: 10, svs: "1", draftImage: null, stagedImage: null, removeImage: false, img: "", previewUrl: "" }]
    },
    _inactiveDraftSaveSequence: 0,
    _inactiveDraftSaveGeneration: 0,
    _inactiveDraftSaveOperation: null,
    _inactiveDraftImageCleanupQueue: [],
    _inactiveListingDraftHydration: { hydrated: true, key: draftHelpers.listingDraftHydrationKey(42, persistedDraft), dirty: true },
    hmAuth: {
      getProfile() { return profile; },
      select(table, match, cb) { calls.select += 1; callbacks.select.push(cb); },
      uploadPrivateDraftImage(file, sellerId, dimensions, cb) { calls.upload += 1; callbacks.upload.push(cb); },
      update(table, match, values, cb) { calls.update += 1; callbacks.update.push(cb); },
      removePrivateDraftImages(images, sellerId, cb) {
        calls.removed.push(...images.map((entry) => entry.path));
        cb({ ok: true });
      }
    },
    hmPrivateOwnerSellerForDraft() { return seller; },
    normalizePrivateOwnerSeller(raw) { return { ...raw, _data: raw.data }; },
    applyFreshPrivateSellerState() {},
    markInactiveListingDraftHydrated() {},
    refreshInactiveDraftSignedPreviews() {},
    revokeInactiveDraftPreview(field) { field.previewUrl = ""; field.img = ""; },
    secureDraftImageId() { return "44444444-4444-4444-8444-444444444444"; },
    showToast(message) { calls.toasts.push(message); },
    rPS() {},
    ic() { return ""; },
    postMissingAll() { throw new Error("Go Live validation must not run while saving"); }
  }, draftHelpers, imageHelpers));
  vm.runInContext(runtime, context);
  return { context, callbacks, calls, seller, oldImage, uploadedImage };
}

{
  const test = scenario();
  vm.runInContext("saveInactiveListingDraft();saveInactiveListingDraft()", test.context);
  assert.equal(test.calls.select, 1, "Double click must start one operation");
  assert.equal(vm.runInContext("inactiveDraftSaveBusy()", test.context), true);
  assert.match(vm.runInContext("inactiveListingDraftButton()", test.context), /disabled/);

  const before = test.context.ST.pf.draftImage.path;
  vm.runInContext("removeInactiveDraftListingImage()", test.context);
  assert.equal(test.context.ST.pf.draftImage.path, before, "Image mutation must be blocked");
  vm.runInContext("goLiveListing()", test.context);
  assert.match(test.calls.toasts.at(-1), /finish before going live/);

  test.callbacks.select.shift()([test.seller]);
  test.callbacks.upload.shift()({ image: test.uploadedImage });
  test.callbacks.update.shift()({ ok: true });
  assert.equal(vm.runInContext("inactiveDraftSaveBusy()", test.context), false, "Success must release lock");
}

{
  const test = scenario();
  vm.runInContext("saveInactiveListingDraft()", test.context);
  test.callbacks.select.shift()([test.seller]);
  test.callbacks.upload.shift()({ image: test.uploadedImage });
  test.callbacks.update.shift()({ error: "simulated" });
  assert.equal(vm.runInContext("inactiveDraftSaveBusy()", test.context), false, "Failure must release lock");
  assert.deepEqual(test.calls.removed, [test.uploadedImage.path]);
}

{
  const test = scenario();
  vm.runInContext("saveInactiveListingDraft()", test.context);
  test.callbacks.select.shift()([test.seller]);
  const newerStaged = { file: { newer: true }, width: 20, height: 20 };
  vm.runInContext("invalidateInactiveDraftSaveOperation()", test.context);
  test.context.ST.pf.stagedImage = newerStaged;
  test.context.ST.pf.previewUrl = "blob:newer";
  test.context.ST.pf.img = "blob:newer";
  test.callbacks.upload.shift()({ image: test.uploadedImage });
  assert.equal(test.calls.update, 0, "Stale upload must not persist");
  assert.equal(test.context.ST.pf.stagedImage, newerStaged, "Stale completion must not clear newer edits");
  assert.deepEqual(test.calls.removed, [test.uploadedImage.path], "Only stale operation object is rolled back");
}

{
  const test = scenario();
  vm.runInContext("saveInactiveListingDraft()", test.context);
  const firstOperation = test.context._inactiveDraftSaveOperation;
  vm.runInContext("invalidateInactiveDraftSaveOperation()", test.context);
  assert.equal(vm.runInContext("inactiveDraftSaveOperationCurrent(_inactiveDraftSaveOperation)", test.context), false);
  assert.equal(firstOperation.invalidated, true, "Sign-out/account/reset invalidation marks the operation stale");
}

assert.match(source, /function clearSignedOutState\(\)[\s\S]*discardInactiveDraftImageState\(\)/);
assert.match(source, /function syncInactiveListingDraftAccount\(profile\)[\s\S]*clearInactiveListingDraftHydrationState\(\)/);
assert.match(source, /function resetPostDraft\(\)[\s\S]*discardInactiveDraftImageState\(\)/);
assert.match(source, /<fieldset \$\{draftSaving\?'disabled':''\}/);

console.log("Draft image concurrency tests passed.");
