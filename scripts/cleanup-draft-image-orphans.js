const {
  HM_DRAFT_IMAGE_BUCKET,
  listingDraftImageCollect,
  listingDraftImageMetadata,
  listingDraftImagePathParts
} = require("../src/helpers/listing-draft-image-helpers.js");
const { requiredConfig } = require("../api/_lib/draft-image-security.js");

const DEFAULT_MINIMUM_AGE_MS = 72 * 60 * 60 * 1000;

function addPrivateImagePath(set, value) {
  const image = listingDraftImageMetadata(value);
  if (image) set.add(image.path);
  const path = value && typeof value === "object" ? value.path : value;
  if (listingDraftImagePathParts(path)) set.add(String(path));
}

function collectReferencedDraftImagePaths(sellers) {
  const paths = new Set();
  for (const seller of Array.isArray(sellers) ? sellers : []) {
    const data = seller && seller.data && typeof seller.data === "object" ? seller.data : {};
    for (const image of listingDraftImageCollect(data.listingDraft)) paths.add(image.path);
    addPrivateImagePath(paths, data.listingImage);
    addPrivateImagePath(paths, data.image);
    addPrivateImagePath(paths, data.imgPath);
    for (const item of Array.isArray(data.items) ? data.items : []) {
      addPrivateImagePath(paths, item && (item.image || item.draftImage));
      addPrivateImagePath(paths, item && item.imgPath);
    }
  }
  return paths;
}

function planDraftImageOrphanCleanup(objects, sellers, now = Date.now(), minimumAgeMs = DEFAULT_MINIMUM_AGE_MS) {
  const referenced = collectReferencedDraftImagePaths(sellers);
  const remove = [];
  const retain = [];
  for (const object of Array.isArray(objects) ? objects : []) {
    const path = String(object && (object.path || object.name) || "");
    const createdAt = Date.parse(object && (object.created_at || object.createdAt) || "");
    const eligible = object && object.bucket_id === HM_DRAFT_IMAGE_BUCKET &&
      listingDraftImagePathParts(path) &&
      Number.isFinite(createdAt) &&
      now - createdAt >= minimumAgeMs &&
      !referenced.has(path);
    (eligible ? remove : retain).push(path);
  }
  return { remove, retain, referencedCount: referenced.size };
}

async function storageRequest(config, path, options = {}) {
  const response = await fetch(`${config.url}${path}`, {
    ...options,
    headers: {
      apikey: config.serviceKey,
      Authorization: `Bearer ${config.serviceKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!response.ok) throw new Error(`Maintenance request failed with status ${response.status}`);
  return data;
}

async function listPrivateDraftObjects(config) {
  const queue = ["drafts"];
  const objects = [];
  while (queue.length) {
    const prefix = queue.shift();
    let offset = 0;
    let entries = [];
    do {
      entries = await storageRequest(config, `/storage/v1/object/list/${HM_DRAFT_IMAGE_BUCKET}`, {
        method: "POST",
        body: JSON.stringify({ prefix, limit: 1000, offset, sortBy: { column: "created_at", order: "asc" } })
      });
      for (const entry of Array.isArray(entries) ? entries : []) {
        const path = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (!entry.id && !entry.metadata) queue.push(path);
        else objects.push({ ...entry, path, bucket_id: HM_DRAFT_IMAGE_BUCKET });
      }
      offset += Array.isArray(entries) ? entries.length : 0;
    } while (Array.isArray(entries) && entries.length === 1000);
  }
  return objects;
}

async function loadSellerImageReferences(config) {
  return storageRequest(config, "/rest/v1/sellers?select=data,active", { method: "GET" });
}

async function deletePrivateDraftObjects(config, paths) {
  if (!paths.length) return;
  await storageRequest(config, `/storage/v1/object/${HM_DRAFT_IMAGE_BUCKET}`, {
    method: "DELETE",
    body: JSON.stringify({ prefixes: paths })
  });
}

async function main() {
  const execute = process.argv.includes("--execute");
  if (execute && process.env.HM_DRAFT_IMAGE_CLEANUP_CONFIRM !== HM_DRAFT_IMAGE_BUCKET) {
    throw new Error("Cleanup confirmation is missing");
  }
  const config = requiredConfig();
  const [objects, sellers] = await Promise.all([
    listPrivateDraftObjects(config),
    loadSellerImageReferences(config)
  ]);
  const plan = planDraftImageOrphanCleanup(objects, sellers);
  if (execute) await deletePrivateDraftObjects(config, plan.remove);
  console.log(JSON.stringify({
    mode: execute ? "execute" : "dry-run",
    scanned: objects.length,
    referenced: plan.referencedCount,
    eligible: plan.remove.length,
    deleted: execute ? plan.remove.length : 0
  }));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  DEFAULT_MINIMUM_AGE_MS,
  collectReferencedDraftImagePaths,
  planDraftImageOrphanCleanup,
  listPrivateDraftObjects,
  loadSellerImageReferences,
  deletePrivateDraftObjects
};
