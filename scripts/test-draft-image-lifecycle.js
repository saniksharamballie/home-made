const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const helpers = require(path.join(root, "src", "helpers", "listing-draft-image-helpers.js"));
const security = require(path.join(root, "api", "_lib", "draft-image-security.js"));
const cleanup = require(path.join(root, "scripts", "cleanup-draft-image-orphans.js"));
const draftHelpers = require(path.join(root, "src", "helpers", "listing-draft-helpers.js"));
const source = fs.readFileSync(path.join(root, "src", "homemade-map-cleaned-1.html"), "utf8");

const authA = "11111111-1111-4111-8111-111111111111";
const authB = "22222222-2222-4222-8222-222222222222";
const objectA = "33333333-3333-4333-8333-333333333333";
const objectB = "44444444-4444-4444-8444-444444444444";

function image(authId, sellerId, objectId) {
  return {
    bucket: helpers.HM_DRAFT_IMAGE_BUCKET,
    path: helpers.listingDraftImageBuildPath(authId, sellerId, objectId, "webp"),
    mimeType: "image/webp",
    size: 1000,
    width: 800,
    height: 600
  };
}

const imageA = image(authA, 42, objectA);
const imageB = image(authB, 99, objectB);
const request = { headers: { authorization: "Bearer test-only" } };
const config = { url: "https://local.invalid", anonKey: "test", serviceKey: "test" };

function response(status, data) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() { return JSON.stringify(data); }
  };
}

function extractFunction(input, name) {
  const match = new RegExp(`function\\s+${name}\\s*\\(`).exec(input);
  assert.ok(match, `${name} not found`);
  const start = match.index;
  const open = input.indexOf("{", start);
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
  throw new Error(`${name} did not close`);
}

const saveRuntimeSource = [
  "inactiveDraftImageUploadSlots",
  "uploadInactiveDraftImageSlots",
  "inactiveDraftImageSaveState",
  "rollbackInactiveDraftImages",
  "applyInactiveDraftImageSaveState",
  "cleanupPersistedInactiveDraftImages",
  "retryInactiveDraftImageCleanup",
  "saveInactiveListingDraft"
].map((name) => extractFunction(source, name)).join("\n\n");

function saveScenario({ updateFails = false, cleanupFails = false, removeOnly = false, twoUploads = false, noChange = false } = {}) {
  const oldImage = imageA;
  const newImage1 = image(authA, 42, "55555555-5555-4555-8555-555555555555");
  const newImage2 = image(authA, 42, "66666666-6666-4666-8666-666666666666");
  const persistedDraft = draftHelpers.listingDraftContent(
    { name: "Draft", desc: "Text", cat: "other", draftImage: oldImage },
    [{ n: "Item", p: 10, svs: "1" }]
  );
  const seller = { id: 42, auth_id: authA, active: false, data: { listingDraft: persistedDraft } };
  const order = [];
  const removed = [];
  const toasts = [];
  let uploadIndex = 0;
  const form = {
    name: "Draft", desc: "Text", cat: "other", dietary: [], timeframe: "", leadDays: "",
    draftImage: oldImage, stagedImage: null, removeImage: false, img: "", previewUrl: ""
  };
  const items = [{ n: "Item", p: 10, svs: "1", draftImage: null, stagedImage: null, removeImage: false, img: "", previewUrl: "" }];
  if (!noChange && removeOnly) form.removeImage = true;
  else if (!noChange) {
    form.stagedImage = { file: { size: 1000 }, width: 800, height: 600 };
    if (twoUploads) items[0].stagedImage = { file: { size: 1000 }, width: 600, height: 600 };
  }
  const profile = { role: "seller", authId: authA, sellerId: 42, sellerLookupStatus: "loaded", ownerSeller: seller, raw: seller };
  const context = vm.createContext(Object.assign({
    ST: { pf: form, pi: items },
    _inactiveDraftImageCleanupQueue: [],
    _inactiveListingDraftHydration: { hydrated: true, key: draftHelpers.listingDraftHydrationKey(42, persistedDraft), dirty: !noChange },
    hmAuth: {
      getProfile() { return profile; },
      select(table, match, cb) { cb([seller]); },
      uploadPrivateDraftImage(file, sellerId, dimensions, cb) {
        order.push("upload");
        cb({ image: uploadIndex++ === 0 ? newImage1 : newImage2 });
      },
      update(table, match, values, cb) {
        order.push("update");
        if (!updateFails) Object.assign(seller, values);
        cb(updateFails ? { error: "failed" } : { ok: true });
      },
      removePrivateDraftImages(images, sellerId, cb) {
        order.push("remove");
        removed.push(...images.map((entry) => entry.path));
        cb(cleanupFails ? { error: "cleanup" } : { ok: true });
      }
    },
    hmPrivateOwnerSellerForDraft() { return seller; },
    normalizePrivateOwnerSeller(raw) { return { ...raw, _data: raw.data }; },
    applyFreshPrivateSellerState() {},
    markInactiveListingDraftHydrated() {},
    revokeInactiveDraftPreview(field) { field.previewUrl = ""; field.img = ""; },
    refreshInactiveDraftSignedPreviews() {},
    showToast(message) { toasts.push(message); }
  }, draftHelpers, helpers));
  vm.runInContext(saveRuntimeSource, context);
  vm.runInContext("saveInactiveListingDraft()", context);
  return { order, removed, toasts, context, oldImage, newImage1, newImage2 };
}

async function validate(body, overrides = {}) {
  const calls = [];
  const fetch = async (url) => {
    calls.push(url.includes("/auth/") ? "auth" : url.includes("/rest/") ? "seller" : "storage");
    if (url.includes("/auth/")) return response(200, { id: authA });
    if (url.includes("/rest/")) return response(200, overrides.sellerRows || [{ id: 42, auth_id: authA, active: false }]);
    return response(overrides.storageStatus || 200, { contentType: "image/webp", size: 1000 });
  };
  const result = await security.validateDraftImagesForPublication(request, body, { config, fetch });
  return { result, calls };
}

(async () => {
  const valid = await validate({ action: "validate-publication", sellerId: 42, images: [imageA] });
  assert.deepEqual(valid.result, { ok: true, count: 1, finalizationRequired: true });
  assert.deepEqual(valid.calls, ["auth", "seller", "storage"]);

  await assert.rejects(
    security.validateDraftImagesForPublication({ headers: {} }, { action: "validate-publication", sellerId: 42, images: [imageA] }, { config, fetch: async () => response(401, {}) }),
    /Authentication required/
  );
  await assert.rejects(validate({ action: "validate-publication", sellerId: 42, images: [imageA] }, { sellerRows: [] }), /ownership/);
  await assert.rejects(validate({ action: "validate-publication", sellerId: 42, images: [imageA] }, { sellerRows: [{ id: 42, auth_id: authA, active: true }] }), /ownership/);
  await assert.rejects(
    security.validateDraftImagesForPublication(request, { action: "validate-publication", sellerId: 42, images: [imageB] }, { config, fetch: async (url) => {
      if (url.includes("/auth/")) return response(200, { id: authA });
      if (url.includes("/rest/")) return response(200, [{ id: 42, auth_id: authA, active: false }]);
      throw new Error("Other seller object must not be requested");
    } }),
    /ownership/
  );
  await assert.rejects(validate({ action: "validate-publication", sellerId: 42, images: [imageA] }, { storageStatus: 404 }), /verification request failed/);

  const now = Date.parse("2026-07-24T12:00:00Z");
  const old = "2026-07-20T12:00:00Z";
  const recent = "2026-07-24T11:00:00Z";
  const referencedSeller = { active: false, data: { listingDraft: { listingImage: imageA, menuItems: [] } } };
  const plan = cleanup.planDraftImageOrphanCleanup([
    { bucket_id: helpers.HM_DRAFT_IMAGE_BUCKET, path: imageA.path, created_at: old },
    { bucket_id: helpers.HM_DRAFT_IMAGE_BUCKET, path: imageB.path, created_at: old },
    { bucket_id: helpers.HM_DRAFT_IMAGE_BUCKET, path: image(authA, 42, "55555555-5555-4555-8555-555555555555").path, created_at: recent },
    { bucket_id: "seller-images", path: imageB.path, created_at: old }
  ], [referencedSeller], now);
  assert.deepEqual(plan.remove, [imageB.path], "Only old unreferenced private objects are removable");
  assert.equal(plan.retain.includes(imageA.path), true, "Referenced private image must remain");
  assert.equal(plan.retain.length, 3, "Recent and unrelated-bucket objects must remain");

  const publishedReference = {
    active: true,
    data: { items: [{ image: imageB }] }
  };
  const publishedPlan = cleanup.planDraftImageOrphanCleanup([
    { bucket_id: helpers.HM_DRAFT_IMAGE_BUCKET, path: imageB.path, created_at: old }
  ], [publishedReference], now);
  assert.deepEqual(publishedPlan.remove, [], "Published references must be retained");

  const failedSave = saveScenario({ updateFails: true, twoUploads: true });
  assert.deepEqual(failedSave.order, ["upload", "upload", "update", "remove"]);
  assert.deepEqual(failedSave.removed.sort(), [failedSave.newImage1.path, failedSave.newImage2.path].sort(), "All new objects must roll back");
  assert.equal(failedSave.context.ST.pf.draftImage.path, failedSave.oldImage.path, "Failed persistence retains old image");

  const replacement = saveScenario();
  assert.deepEqual(replacement.order, ["upload", "update", "remove"], "Replacement persists before deleting old object");
  assert.deepEqual(replacement.removed, [replacement.oldImage.path]);
  assert.equal(replacement.context.ST.pf.draftImage.path, replacement.newImage1.path);

  const removal = saveScenario({ removeOnly: true });
  assert.deepEqual(removal.order, ["update", "remove"], "Removal persists reference deletion before object deletion");
  assert.deepEqual(removal.removed, [removal.oldImage.path]);
  assert.equal(removal.context.ST.pf.draftImage, null);
  vm.runInContext("saveInactiveListingDraft()", removal.context);
  assert.deepEqual(removal.order, ["update", "remove"], "Repeated removal must not issue another write or delete");

  const cleanupFailure = saveScenario({ cleanupFails: true });
  assert.match(cleanupFailure.toasts.at(-1), /cleanup still needs attention/);
  assert.equal(cleanupFailure.context._inactiveDraftImageCleanupQueue.length, 1);

  const noOp = saveScenario({ noChange: true });
  assert.deepEqual(noOp.order, [], "Unchanged path-based draft must remain a true no-op");
  assert.equal(noOp.toasts.at(-1), "No draft changes to save.");

  console.log("Draft image lifecycle tests passed.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
