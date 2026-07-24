const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "src", "homemade-map-cleaned-1.html"), "utf8");
const migration = fs.readFileSync(path.join(root, "supabase", "migrations", "20260724120000_private_draft_image_storage.sql"), "utf8");
const sw = fs.readFileSync(path.join(root, "public", "sw.js"), "utf8");
const imageHelpers = require(path.join(root, "src", "helpers", "listing-draft-image-helpers.js"));
const draftHelpers = require(path.join(root, "src", "helpers", "listing-draft-helpers.js"));

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

const authId = "11111111-1111-4111-8111-111111111111";
const otherAuthId = "22222222-2222-4222-8222-222222222222";
const objectId = "33333333-3333-4333-8333-333333333333";
const pathA = imageHelpers.listingDraftImageBuildPath(authId, 42, objectId, "webp");
const imageA = {
  bucket: imageHelpers.HM_DRAFT_IMAGE_BUCKET,
  path: pathA,
  mimeType: "image/webp",
  size: 1200,
  width: 900,
  height: 600
};

assert.equal(pathA, `drafts/${authId}/42/${objectId}.webp`);
assert.equal(imageHelpers.listingDraftImageOwnedBy(imageA, authId, 42), true);
assert.equal(imageHelpers.listingDraftImageOwnedBy(imageA, otherAuthId, 42), false);
assert.equal(imageHelpers.listingDraftImageBuildPath(authId, 42, "not-random", "webp"), "");
assert.equal(imageHelpers.listingDraftImageMetadata({ ...imageA, path: "https://example.test/image.webp" }), null);
assert.equal(imageHelpers.listingDraftImageMetadata({ ...imageA, bucket: "seller-images" }), null);
assert.equal(imageHelpers.listingDraftImageUnsafeReference("data:image/png;base64,x"), true);
assert.equal(imageHelpers.listingDraftImageUnsafeReference("blob:test"), true);
assert.equal(imageHelpers.listingDraftImageUnsafeReference("https://example.test/x"), true);

assert.match(migration, /'seller-draft-images'[\s\S]*false[\s\S]*5242880/);
assert.match(migration, /array\['image\/jpeg', 'image\/png', 'image\/webp'\]/);
assert.doesNotMatch(migration, /image\/gif|image\/svg/);
const insertPolicy = migration.slice(migration.indexOf("create policy seller_draft_images_owner_insert"), migration.indexOf("drop policy if exists seller_draft_images_owner_select"));
const selectPolicy = migration.slice(migration.indexOf("create policy seller_draft_images_owner_select"), migration.indexOf("drop policy if exists seller_draft_images_owner_delete"));
const deletePolicy = migration.slice(migration.indexOf("create policy seller_draft_images_owner_delete"));
assert.match(insertPolicy, /for insert[\s\S]*auth\.uid\(\)::text[\s\S]*s\.active = false/i);
assert.match(selectPolicy, /for select[\s\S]*to authenticated[\s\S]*s\.auth_id = auth\.uid\(\)/i);
assert.doesNotMatch(selectPolicy, /s\.active\s*=/i);
assert.match(deletePolicy, /for delete[\s\S]*to authenticated[\s\S]*s\.auth_id = auth\.uid\(\)/i);
assert.doesNotMatch(deletePolicy, /s\.active\s*=/i);
assert.doesNotMatch(migration, /for update/i);
assert.doesNotMatch(migration, /to anon|to public/i);
assert.match(migration, /array_length\(storage\.foldername\(name\), 1\) = 3/);
assert.match(migration, /storage\.filename\(name\)[\s\S]*jpg\|jpeg\|png\|webp/);

const ownerGateBody = extractFunction(source, "freshInactiveDraftOwner");
assert.match(ownerGateBody, /profile\.role!=='seller'/);
assert.match(ownerGateBody, /profile\.sellerLookupStatus!=='loaded'/);
assert.match(ownerGateBody, /\.select\('id,auth_id,active'\)\.eq\('auth_id',userId\)/);
assert.match(ownerGateBody, /rows\.length!==1/);
assert.match(ownerGateBody, /seller\.active!==false/);
assert.doesNotMatch(ownerGateBody, /\bSELLERS\b|seller_directory/);

const privateUploadBody = extractFunction(source, "uploadPrivateDraftImage");
assert.match(privateUploadBody, /freshInactiveDraftOwner/);
assert.match(privateUploadBody, /HM_DRAFT_IMAGE_BUCKET/);
assert.match(privateUploadBody, /upsert:false/);
assert.match(privateUploadBody, /secureDraftImageId/);
assert.doesNotMatch(privateUploadBody, /Date\.now|Math\.random|file\.name|getPublicUrl|seller-images/);
const signedPreviewBody = extractFunction(source, "signPrivateDraftImage");
assert.match(signedPreviewBody, /listingDraftImageOwnedBy/);
assert.match(signedPreviewBody, /createSignedUrl/);
assert.doesNotMatch(signedPreviewBody, /hmAuth\.update|storage\.from\('seller-images'\)/);

const selectionBodies = [
  extractFunction(source, "uploadListingImg"),
  extractFunction(source, "uploadMenuItemImg"),
  extractFunction(source, "stageInactiveDraftImage")
].join("\n");
assert.doesNotMatch(selectionBodies, /storage\.from|uploadPublicImage|uploadPrivateDraftImage|hmAuth\.update|saveInactiveListingDraft|goLiveListing/);
assert.doesNotMatch(selectionBodies, /FileReader|readAsDataURL/);
assert.match(selectionBodies, /stagedImage/);
assert.match(selectionBodies, /markInactiveListingDraftDirty/);

let stageCalls = 0;
const selectionContext = vm.createContext({
  ST: {
    pf: { imgUploading: false, imgError: "" },
    pi: [{ imgUploading: false, imgError: "", draftImage: null, stagedImage: null }]
  },
  HM_DRAFT_IMAGE_MAX_MENU_IMAGES: 25,
  inactiveDraftMutationAllowed() { return true; },
  stageInactiveDraftImage() { stageCalls += 1; },
  showToast() {},
  rPS() {}
});
vm.runInContext([
  extractFunction(source, "uploadListingImg"),
  extractFunction(source, "uploadMenuItemImg")
].join("\n"), selectionContext);
selectionContext.uploadListingImg({ files: [], value: "unchanged" });
assert.equal(stageCalls, 0, "Cancelling selection must do nothing");
selectionContext.uploadListingImg({ files: [{ type: "image/png", size: 100 }], value: "selected" });
assert.equal(stageCalls, 1);
selectionContext.uploadMenuItemImg(0, { files: [{ type: "image/png", size: 100 }], value: "selected" });
assert.equal(stageCalls, 2);

for (const type of ["image/gif", "image/svg+xml", "text/plain"]) {
  assert.match(imageHelpers.listingDraftImageSourceError({ type, size: 100 }), /JPEG, PNG or WebP/);
}
assert.match(imageHelpers.listingDraftImageSourceError({ type: "image/png", size: 6 * 1024 * 1024 }), /under 5 MB/);
assert.match(imageHelpers.listingDraftImageSourceError({ type: "image/png", size: 100 }, 9000, 10), /dimensions/);
assert.match(imageHelpers.listingDraftImageSourceError({ type: "image/png", size: 100 }, 8000, 8000), /dimensions/);

const prepareBody = extractFunction(source, "prepareDraftImageFile");
assert.match(prepareBody, /canvas\.toBlob/);
assert.match(prepareBody, /new File\(\[blob\],'draft\.webp'/);
assert.doesNotMatch(prepareBody, /cb\(file\)|finish\(\{file:file/);

function runPrepare({ width = 1200, height = 800, decodeFails = false, blob = { size: 500 } } = {}) {
  const revoked = [];
  let result;
  class FakeImage {
    set src(value) {
      this.naturalWidth = width;
      this.naturalHeight = height;
      if (decodeFails) this.onerror();
      else this.onload();
    }
  }
  class FakeFile {
    constructor(parts, name, options) {
      this.size = parts[0].size;
      this.name = name;
      this.type = options.type;
    }
  }
  const context = vm.createContext(Object.assign({
    Image: FakeImage,
    File: FakeFile,
    URL: {
      createObjectURL() { return "blob:source"; },
      revokeObjectURL(value) { revoked.push(value); }
    },
    document: {
      createElement() {
        return {
          getContext() { return { drawImage() {} }; },
          toBlob(callback) { callback(blob); }
        };
      }
    }
  }, imageHelpers));
  vm.runInContext(prepareBody, context);
  context.prepareDraftImageFile({ type: "image/png", size: 1000 }, (value) => { result = value; }, {});
  return { result, revoked };
}

const prepared = runPrepare();
assert.equal(prepared.result.file.type, "image/webp");
assert.equal(prepared.result.file.name, "draft.webp");
assert.deepEqual(prepared.revoked, ["blob:source"]);
assert.match(runPrepare({ decodeFails: true }).result.error, /decoded/);
assert.match(runPrepare({ width: 9000, height: 100 }).result.error, /dimensions/);
assert.match(runPrepare({ blob: null }).result.error, /re-encoded safely/);

const revokeCalls = [];
const revokeContext = vm.createContext({
  URL: { revokeObjectURL(value) { revokeCalls.push(value); } }
});
vm.runInContext(extractFunction(source, "revokeInactiveDraftPreview"), revokeContext);
const previewField = { previewUrl: "blob:preview", img: "blob:preview" };
revokeContext.revokeInactiveDraftPreview(previewField);
assert.deepEqual(revokeCalls, ["blob:preview"]);
assert.equal(previewField.previewUrl, "");
assert.equal(previewField.img, "");

const textDraft = draftHelpers.listingDraftContent({ name: "Text", desc: "Only", cat: "other" }, [{ n: "Item", p: 10, svs: "1" }]);
assert.equal(textDraft.listingImage, null);
assert.equal(textDraft.menuItems[0].image, null);
const legacyTextDraft = {
  ...textDraft,
  version: 1,
  menuItems: textDraft.menuItems.map(({ image, ...item }) => item)
};
delete legacyTextDraft.listingImage;
assert.equal(
  draftHelpers.buildInactiveListingDraftPatch(
    { listingDraft: legacyTextDraft },
    { name: "Text", desc: "Only", cat: "other" },
    [{ n: "Item", p: 10, svs: "1" }],
    "later"
  ).changed,
  false,
  "The existing version-1 text-only Gate 4A draft must remain a no-op"
);
const imageForm = { name: "Image", desc: "Private", cat: "other", draftImage: imageA, img: "blob:never-persist" };
const imageItems = [{ n: "Item", p: 10, svs: "1", draftImage: imageA, img: "https://never-persist.test/x" }];
const imageDraft = draftHelpers.listingDraftContent(imageForm, imageItems);
assert.deepEqual(imageDraft.listingImage, imageA);
assert.deepEqual(imageDraft.menuItems[0].image, imageA);
assert.doesNotMatch(JSON.stringify(imageDraft), /blob:|https?:|signed/i);
const first = draftHelpers.buildInactiveListingDraftPatch({}, imageForm, imageItems, "now");
assert.equal(first.changed, true);
const unchanged = draftHelpers.buildInactiveListingDraftPatch(first.sellerValues.data, imageForm, imageItems, "later");
assert.equal(unchanged.changed, false);

assert.match(sw, /const VERSION = "hm-prod-v67"/);
assert.match(sw, /url\.origin !== self\.location\.origin/);
assert.match(sw, /isSupabaseRequest\(url\)/);
assert.match(sw, /url\.pathname\.startsWith\("\/api\/"\)/);

console.log("Draft image isolation tests passed.");
