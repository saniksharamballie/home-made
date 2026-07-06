const crypto = require("node:crypto");
const { handleError, methodAllowed, sendJson, supabaseFetch } = require("./_lib/supabase");
let fetchSupabase = supabaseFetch;

const PROD_ORIGINS = new Set([
  "https://home-made.co.za",
  "https://www.home-made.co.za"
]);
const LOCAL_ORIGIN_RE = /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/i;
const MAX_BODY_BYTES = 16 * 1024;
const MAX_MESSAGE_CHARS = 3000;
const SELLER_ID_RE = /^[1-9]\d{0,18}$/;

function httpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function isProduction() {
  return process.env.VERCEL_ENV === "production";
}

function isVercelRuntime() {
  return process.env.VERCEL === "1";
}

function singleHeaderValue(value) {
  if (Array.isArray(value)) return "";
  const raw = String(value || "").trim();
  if (!raw || raw.includes(",")) return "";
  return raw;
}

function normaliseHostname(value) {
  return String(value || "").trim().toLowerCase().replace(/\.$/, "");
}

function parseHttpsOrigin(value) {
  const raw = singleHeaderValue(value);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:") return null;
    if (url.username || url.password) return null;
    if (url.pathname !== "/" || url.search || url.hash) return null;
    if (url.port && url.port !== "443") return null;
    const hostname = normaliseHostname(url.hostname);
    if (!hostname) return null;
    return `https://${hostname}`;
  } catch {
    return null;
  }
}

function parseHeaderHost(value) {
  const raw = singleHeaderValue(value);
  if (!raw) return "";
  try {
    const url = new URL(`https://${raw}`);
    if (url.username || url.password) return "";
    if (url.pathname !== "/" || url.search || url.hash) return "";
    if (url.port && url.port !== "443") return "";
    return normaliseHostname(url.hostname);
  } catch {
    return "";
  }
}

function parseVercelDeploymentHost(value) {
  const raw = singleHeaderValue(value);
  if (!raw) return "";
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "https:") return "";
    if (url.username || url.password) return "";
    if (url.pathname !== "/" || url.search || url.hash) return "";
    if (url.port && url.port !== "443") return "";
    return normaliseHostname(url.hostname);
  } catch {
    return "";
  }
}

function isVercelAppHost(hostname) {
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.vercel\.app$/.test(hostname);
}

function requestHost(req) {
  if (Object.prototype.hasOwnProperty.call(req.headers, "x-forwarded-host")) {
    return parseHeaderHost(req.headers["x-forwarded-host"]);
  }
  return parseHeaderHost(req.headers.host);
}

function previewOriginAllowed(req, origin) {
  if (!isVercelRuntime() || process.env.VERCEL_ENV !== "preview") return false;
  const parsedOrigin = parseHttpsOrigin(origin);
  if (!parsedOrigin) return false;
  const currentHost = requestHost(req);
  if (!currentHost || !isVercelAppHost(currentHost)) return false;
  const deploymentHost = parseVercelDeploymentHost(req.headers["x-vercel-deployment-url"]);
  if (!deploymentHost || !isVercelAppHost(deploymentHost)) return false;
  if (deploymentHost !== currentHost) return false;
  return parsedOrigin === `https://${currentHost}`;
}

function validateOrigin(req) {
  const origin = singleHeaderValue(req.headers.origin);
  if (!origin) {
    if (isProduction() || isVercelRuntime()) throw httpError("Forbidden", 403);
    return true;
  }
  if (PROD_ORIGINS.has(origin)) return true;
  if (previewOriginAllowed(req, origin)) return true;
  if (!isProduction() && !isVercelRuntime() && LOCAL_ORIGIN_RE.test(origin)) return true;
  throw httpError("Forbidden", 403);
}

function trustedClientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || String(req.socket && req.socket.remoteAddress || "").trim() || "unknown";
}

function clientHash(req) {
  const secret = process.env.CONTACT_RATE_LIMIT_SECRET;
  if (!secret || secret.length < 24) throw httpError("Contact handoff temporarily unavailable", 503);
  const ip = trustedClientIp(req);
  return crypto.createHmac("sha256", secret).update(ip).digest("hex");
}

function normaliseWhatsapp(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 9 || digits.length > 15) return "";
  return digits;
}

function configuredOverrideNumber() {
  if (!Object.prototype.hasOwnProperty.call(process.env, "CONTACT_SELLER_WHATSAPP_OVERRIDE")) return "";
  const raw = String(process.env.CONTACT_SELLER_WHATSAPP_OVERRIDE || "").trim();
  const number = normaliseWhatsapp(raw);
  if (!number) throw httpError("Contact handoff temporarily unavailable", 503);
  return number;
}

function encodeWaUrl(number, message) {
  const url = new URL(`https://wa.me/${number}`);
  if (message) url.searchParams.set("text", message);
  return url.toString();
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = Buffer.from(chunk);
    size += buf.length;
    if (size > MAX_BODY_BYTES) throw httpError("Request body too large", 413);
    chunks.push(buf);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  const type = String(req.headers["content-type"] || "").toLowerCase();
  if (type.includes("application/x-www-form-urlencoded")) {
    return Object.fromEntries(new URLSearchParams(raw));
  }
  if (!raw.trim()) return {};
  if (type.includes("application/json") || !type) {
    try {
      return JSON.parse(raw);
    } catch {
      throw httpError("Invalid request", 400);
    }
  }
  throw httpError("Unsupported content type", 415);
}

function cleanMessage(value) {
  const message = String(value || "").trim();
  return message.slice(0, MAX_MESSAGE_CHARS);
}

async function checkRateLimit(hash, windowSeconds, maxRequests) {
  const rows = await fetchSupabase("/rest/v1/rpc/home_made_contact_handoff_rate_limit", {
    method: "POST",
    body: JSON.stringify({
      input_client_hash: hash,
      input_window_seconds: windowSeconds,
      input_max_requests: maxRequests,
      input_now: new Date().toISOString()
    })
  });
  return rows === true;
}

async function applyRateLimits(hash) {
  const shortWindowSeconds = Number(process.env.CONTACT_RATE_LIMIT_SHORT_WINDOW_SECONDS || 600);
  const shortMax = Number(process.env.CONTACT_RATE_LIMIT_SHORT_MAX || 6);
  const dailyWindowSeconds = Number(process.env.CONTACT_RATE_LIMIT_DAILY_WINDOW_SECONDS || 86400);
  const dailyMax = Number(process.env.CONTACT_RATE_LIMIT_DAILY_MAX || 20);
  const shortOk = await checkRateLimit(hash, shortWindowSeconds, shortMax);
  if (!shortOk) return false;
  return checkRateLimit(hash, dailyWindowSeconds, dailyMax);
}

async function contactSellerHandler(req, res) {
  if (!methodAllowed(req, res, ["POST"])) return;
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");

  try {
    validateOrigin(req);
    const body = await readBody(req);
    const sellerId = String(body.sellerId || "").trim();
    if (!SELLER_ID_RE.test(sellerId)) throw httpError("Invalid request", 400);

    const message = cleanMessage(body.message);
    const overrideNumber = configuredOverrideNumber();
    const hash = clientHash(req);
    const allowed = await applyRateLimits(hash);
    if (!allowed) throw httpError("Too many contact attempts", 429);

    const rows = await fetchSupabase(
      `/rest/v1/sellers?id=eq.${encodeURIComponent(sellerId)}&select=id,active,wa&limit=1`,
      { headers: { Prefer: "" } }
    );
    const seller = rows && rows[0];
    const storedNumber = seller && seller.active ? normaliseWhatsapp(seller.wa) : "";
    if (!seller || !seller.active || !storedNumber) throw httpError("Seller not found", 404);
    const number = overrideNumber || storedNumber;

    res.statusCode = 303;
    res.setHeader("Location", encodeWaUrl(number, message));
    res.end();
  } catch (error) {
    handleError(res, error);
  }
}

contactSellerHandler._test = {
  cleanMessage,
  encodeWaUrl,
  configuredOverrideNumber,
  normaliseWhatsapp,
  previewOriginAllowed,
  trustedClientIp,
  validateOrigin,
  setSupabaseFetch(fn) {
    fetchSupabase = fn || supabaseFetch;
  }
};

module.exports = contactSellerHandler;
