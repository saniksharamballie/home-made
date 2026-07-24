const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "src", "homemade-map-cleaned-1.html"), "utf8");
const api = fs.readFileSync(path.join(root, "api", "draft-images.js"), "utf8");
const server = fs.readFileSync(path.join(root, "api", "_lib", "draft-image-security.js"), "utf8");

function body(name, nextName) {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf(`\nfunction ${nextName}(`, start);
  assert.notEqual(start, -1, `${name} missing`);
  assert.notEqual(end, -1, `${nextName} boundary missing`);
  return source.slice(start, end);
}

const selection = body("uploadListingImg", "uploadMenuItemImg") + body("uploadMenuItemImg", "buildPostTierGuide");
assert.doesNotMatch(selection, /storage\.from|uploadPrivateDraftImage|uploadPublicImage/);

const save = body("saveInactiveListingDraft", "inactiveListingDraftButton");
for (const required of [
  "inactiveDraftImageUploadSlots",
  "uploadInactiveDraftImageSlots",
  "buildInactiveListingDraftPatch",
  "rollbackInactiveDraftImages",
  "listingDraftImageRemoved",
  "cleanupPersistedInactiveDraftImages"
]) assert.match(save, new RegExp(required));
assert.ok(save.indexOf("hmAuth.update(") < save.indexOf("cleanupPersistedInactiveDraftImages("), "Persist before old-image cleanup");
assert.match(save, /if\(res&&res\.error\)[\s\S]*rollbackInactiveDraftImages/);

const goLive = body("goLiveListing", "openSellerRequestModal");
assert.match(goLive, /postMissingAll\(\)/);
assert.match(goLive, /blockUnfinalizedListingImagePublication\(\)/);
assert.ok(goLive.indexOf("blockUnfinalizedListingImagePublication()") < goLive.indexOf("buildPublishedSeller()"));
assert.match(source, /listingDraftImagePublicationBlocked\(ST\.pf,ST\.pi\)/);
assert.match(source, /validate-publication/);
assert.match(source, /finalization before publication/);

assert.match(api, /validateDraftImagesForPublication/);
assert.match(server, /loadInactiveOwnedSeller/);
assert.match(server, /listingDraftImageOwnedBy/);
assert.match(server, /storage\/v1\/object\/info/);
assert.match(server, /finalizationRequired: true/);
assert.doesNotMatch(server, /createSignedUrl|getPublicUrl|upload\(/);

for (const unsafe of ["data:", "blob:", "https://"]) {
  const helpers = require(path.join(root, "src", "helpers", "listing-draft-image-helpers.js"));
  assert.equal(helpers.listingDraftImagePublicationBlocked({ img: `${unsafe}unsafe` }, []), true);
}
assert.equal(/active\s*:\s*true/.test(body("blockUnfinalizedListingImagePublication", "goLiveListing")), false);
assert.equal(/seller_directory|contactSeller|WhatsApp/.test(body("blockUnfinalizedListingImagePublication", "goLiveListing")), false);

console.log("Draft image publication guardrail tests passed.");
