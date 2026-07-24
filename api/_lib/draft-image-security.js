const {
  HM_DRAFT_IMAGE_BUCKET,
  HM_DRAFT_IMAGE_MIME_TYPES,
  listingDraftImageMetadata,
  listingDraftImageOwnedBy
} = require("../../src/helpers/listing-draft-image-helpers.js");

function requiredConfig(env = process.env) {
  const url = env.NEXT_PUBLIC_SUPABASE_URL || "";
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || "";
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || "";
  if (!url || !anonKey || !serviceKey) {
    const error = new Error("Draft image service configuration is unavailable");
    error.status = 503;
    throw error;
  }
  return { url: url.replace(/\/+$/, ""), anonKey, serviceKey };
}

function bearerToken(req) {
  const header = req && req.headers && req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : "";
}

async function jsonResponse(response) {
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!response.ok) {
    const error = new Error("Draft image verification request failed");
    error.status = response.status;
    throw error;
  }
  return data;
}

async function authenticateRequest(req, deps = {}) {
  const config = deps.config || requiredConfig();
  const token = bearerToken(req);
  if (!token) {
    const error = new Error("Authentication required");
    error.status = 401;
    throw error;
  }
  const fetchImpl = deps.fetch || fetch;
  const response = await fetchImpl(`${config.url}/auth/v1/user`, {
    headers: { apikey: config.anonKey, Authorization: `Bearer ${token}` }
  });
  const user = await jsonResponse(response);
  if (!user || !user.id) {
    const error = new Error("Authentication required");
    error.status = 401;
    throw error;
  }
  return { user, config };
}

async function loadInactiveOwnedSeller(userId, sellerId, config, deps = {}) {
  const fetchImpl = deps.fetch || fetch;
  const query = `/rest/v1/sellers?select=id,auth_id,active&id=eq.${encodeURIComponent(sellerId)}&auth_id=eq.${encodeURIComponent(userId)}`;
  const response = await fetchImpl(`${config.url}${query}`, {
    headers: {
      apikey: config.serviceKey,
      Authorization: `Bearer ${config.serviceKey}`
    }
  });
  const rows = await jsonResponse(response);
  if (!Array.isArray(rows) || rows.length !== 1 || rows[0].active !== false) {
    const error = new Error("Inactive seller ownership could not be verified");
    error.status = 403;
    throw error;
  }
  return rows[0];
}

async function loadPrivateObjectInfo(image, config, deps = {}) {
  const fetchImpl = deps.fetch || fetch;
  const encodedPath = image.path.split("/").map(encodeURIComponent).join("/");
  const response = await fetchImpl(`${config.url}/storage/v1/object/info/${HM_DRAFT_IMAGE_BUCKET}/${encodedPath}`, {
    headers: {
      apikey: config.serviceKey,
      Authorization: `Bearer ${config.serviceKey}`
    }
  });
  const info = await jsonResponse(response);
  const mimeType = String(info && (info.contentType || info.mimetype || info.metadata && info.metadata.mimetype) || "").toLowerCase();
  const size = Number(info && (info.size || info.metadata && info.metadata.size) || 0);
  if (!info || !HM_DRAFT_IMAGE_MIME_TYPES.includes(mimeType) || !size || size !== image.size) {
    const error = new Error("Private draft image metadata could not be verified");
    error.status = 409;
    throw error;
  }
  return { mimeType, size };
}

async function validateDraftImagesForPublication(req, body, deps = {}) {
  if (!body || body.action !== "validate-publication") {
    const error = new Error("Unsupported draft image action");
    error.status = 400;
    throw error;
  }
  const sellerId = String(body.sellerId || "");
  const images = (Array.isArray(body.images) ? body.images : []).map(listingDraftImageMetadata);
  if (!/^[0-9]+$/.test(sellerId) || !images.length || images.some((image) => !image)) {
    const error = new Error("Invalid draft image request");
    error.status = 400;
    throw error;
  }
  const { user, config } = await authenticateRequest(req, deps);
  await loadInactiveOwnedSeller(user.id, sellerId, config, deps);
  if (images.some((image) => !listingDraftImageOwnedBy(image, user.id, sellerId))) {
    const error = new Error("Draft image ownership could not be verified");
    error.status = 403;
    throw error;
  }
  await Promise.all(images.map((image) => loadPrivateObjectInfo(image, config, deps)));
  return { ok: true, count: images.length, finalizationRequired: true };
}

module.exports = {
  requiredConfig,
  bearerToken,
  authenticateRequest,
  loadInactiveOwnedSeller,
  loadPrivateObjectInfo,
  validateDraftImagesForPublication
};
