const {
  HM_DRAFT_IMAGE_BUCKET,
  listingDraftImageCollect,
  listingDraftImageMetadata,
  listingDraftImagePathParts
} = require("../src/helpers/listing-draft-image-helpers.js");
const { requiredConfig } = require("../api/_lib/draft-image-security.js");

const DEFAULT_MINIMUM_AGE_MS = 72 * 60 * 60 * 1000;
const APPROVED_STAGING_REF = "duekijsiofrmivnfulid";
const FORBIDDEN_PRODUCTION_REF = "yemdirpmtqzzduxtgfqh";
const DEFAULT_DELETE_BATCH_SIZE = 25;
const MAX_DELETE_BATCH_SIZE = 100;
const DEFAULT_FAILURE_THRESHOLD = 3;

function supabaseTarget(urlValue) {
  let url;
  try { url = new URL(String(urlValue || "")); } catch { return { kind: "invalid", projectRef: "" }; }
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1") {
    return { kind: "local", projectRef: "" };
  }
  const match = /^([a-z0-9]{20})\.supabase\.co$/.exec(hostname);
  return match ? { kind: "hosted", projectRef: match[1] } : { kind: "unknown", projectRef: "" };
}

function redactedProjectRef(projectRef) {
  const value = String(projectRef || "");
  return value.length >= 8 ? `${value.slice(0, 4)}...${value.slice(-4)}` : "unavailable";
}

function assertCleanupExecutionTarget(config, options = {}) {
  if (!options.execute) return { allowed: false, mode: "dry-run", target: supabaseTarget(config && config.url) };
  const expectedRef = String(options.expectedRef || "");
  const target = supabaseTarget(config && config.url);
  if (options.confirm !== HM_DRAFT_IMAGE_BUCKET) throw new Error("Cleanup confirmation is missing");
  if (!expectedRef) throw new Error("Expected cleanup project ref is missing");
  if (expectedRef === FORBIDDEN_PRODUCTION_REF || target.projectRef === FORBIDDEN_PRODUCTION_REF) {
    throw new Error("Production cleanup target is forbidden");
  }
  if (expectedRef !== APPROVED_STAGING_REF) throw new Error("Cleanup project ref is not approved");
  if (target.kind !== "hosted" || target.projectRef !== APPROVED_STAGING_REF || target.projectRef !== expectedRef) {
    throw new Error("Configured cleanup target does not match approved staging");
  }
  return { allowed: true, mode: "execute", target };
}

function normalizeDeleteBatchSize(value) {
  if (value === undefined || value === null || value === "") return DEFAULT_DELETE_BATCH_SIZE;
  const size = Number(value);
  if (!Number.isInteger(size) || size < 1 || size > MAX_DELETE_BATCH_SIZE) {
    throw new Error(`Cleanup batch size must be between 1 and ${MAX_DELETE_BATCH_SIZE}`);
  }
  return size;
}

function normalizeFailureThreshold(value) {
  if (value === undefined || value === null || value === "") return DEFAULT_FAILURE_THRESHOLD;
  const threshold = Number(value);
  if (!Number.isInteger(threshold) || threshold < 1 || threshold > 10) {
    throw new Error("Cleanup failure threshold must be between 1 and 10");
  }
  return threshold;
}

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

async function deletePrivateDraftObjects(config, paths, options = {}) {
  const batchSize = normalizeDeleteBatchSize(options.batchSize);
  const failureThreshold = normalizeFailureThreshold(options.failureThreshold);
  const request = options.request || storageRequest;
  const approvedPaths = (Array.isArray(paths) ? paths : []).filter((path) => listingDraftImagePathParts(path));
  const result = { requested: approvedPaths.length, deleted: 0, failed: 0, batchesSucceeded: 0, batchesFailed: 0, stopped: false };
  for (let offset = 0; offset < approvedPaths.length; offset += batchSize) {
    const batch = approvedPaths.slice(offset, offset + batchSize);
    try {
      await request(config, `/storage/v1/object/${HM_DRAFT_IMAGE_BUCKET}`, {
        method: "DELETE",
        body: JSON.stringify({ prefixes: batch })
      });
      result.deleted += batch.length;
      result.batchesSucceeded += 1;
    } catch {
      result.failed += batch.length;
      result.batchesFailed += 1;
      if (result.batchesFailed >= failureThreshold) {
        result.stopped = true;
        break;
      }
    }
  }
  return result;
}

async function main() {
  const execute = process.argv.includes("--execute");
  const config = requiredConfig();
  const gate = assertCleanupExecutionTarget(config, {
    execute,
    expectedRef: process.env.HM_DRAFT_IMAGE_CLEANUP_PROJECT_REF,
    confirm: process.env.HM_DRAFT_IMAGE_CLEANUP_CONFIRM
  });
  const [objects, sellers] = await Promise.all([
    listPrivateDraftObjects(config),
    loadSellerImageReferences(config)
  ]);
  const plan = planDraftImageOrphanCleanup(objects, sellers);
  const deletion = execute ? await deletePrivateDraftObjects(config, plan.remove, {
    batchSize: process.env.HM_DRAFT_IMAGE_CLEANUP_BATCH_SIZE,
    failureThreshold: process.env.HM_DRAFT_IMAGE_CLEANUP_FAILURE_THRESHOLD
  }) : { deleted: 0, failed: 0, batchesSucceeded: 0, batchesFailed: 0, stopped: false };
  console.log(JSON.stringify({
    mode: execute ? "execute" : "dry-run",
    project: redactedProjectRef(gate.target.projectRef),
    scanned: objects.length,
    referenced: plan.referencedCount,
    eligible: plan.remove.length,
    deleted: deletion.deleted,
    failed: deletion.failed,
    batchesSucceeded: deletion.batchesSucceeded,
    batchesFailed: deletion.batchesFailed,
    stopped: deletion.stopped
  }));
  if (deletion.failed) throw new Error("Cleanup completed with failed batches");
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  DEFAULT_MINIMUM_AGE_MS,
  APPROVED_STAGING_REF,
  FORBIDDEN_PRODUCTION_REF,
  DEFAULT_DELETE_BATCH_SIZE,
  MAX_DELETE_BATCH_SIZE,
  supabaseTarget,
  redactedProjectRef,
  assertCleanupExecutionTarget,
  normalizeDeleteBatchSize,
  normalizeFailureThreshold,
  collectReferencedDraftImagePaths,
  planDraftImageOrphanCleanup,
  listPrivateDraftObjects,
  loadSellerImageReferences,
  deletePrivateDraftObjects
};
