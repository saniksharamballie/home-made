const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://yemdirpmtqzzduxtgfqh.supabase.co";
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function methodAllowed(req, res, methods) {
  if (methods.includes(req.method)) return true;
  res.setHeader("Allow", methods.join(", "));
  sendJson(res, 405, { error: "Method not allowed" });
  return false;
}

async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (error) {
    const err = new Error("Invalid JSON body");
    err.status = 400;
    throw err;
  }
}

function getBearerToken(req) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : "";
}

async function supabaseFetch(path, options = {}) {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    const err = new Error("Server Supabase service role key is not configured");
    err.status = 500;
    throw err;
  }
  const headers = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
    ...(options.headers || {})
  };
  const response = await fetch(`${SUPABASE_URL}${path}`, { ...options, headers });
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!response.ok) {
    const err = new Error(data && data.message ? data.message : `Supabase request failed: ${response.status}`);
    err.status = response.status;
    err.details = data;
    throw err;
  }
  return data;
}

async function getUserFromRequest(req) {
  const token = getBearerToken(req);
  if (!token) return null;
  const apiKey = SUPABASE_ANON_KEY || SUPABASE_SERVICE_ROLE_KEY;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: apiKey,
      Authorization: `Bearer ${token}`
    }
  });
  if (!response.ok) return null;
  return response.json();
}

async function requireUser(req) {
  const user = await getUserFromRequest(req);
  if (!user || !user.id) {
    const err = new Error("Authentication required");
    err.status = 401;
    throw err;
  }
  return user;
}

async function getProfile(userId) {
  const rows = await supabaseFetch(`/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=*`);
  return rows && rows[0] ? rows[0] : null;
}

async function requireAdmin(req) {
  const user = await requireUser(req);
  const profile = await getProfile(user.id);
  if (!profile || profile.role !== "admin") {
    const err = new Error("Admin access required");
    err.status = 403;
    throw err;
  }
  return { user, profile };
}

async function getOwnedSellerIds(userId) {
  const rows = await supabaseFetch(`/rest/v1/sellers?auth_id=eq.${encodeURIComponent(userId)}&select=id`);
  return (rows || []).map((row) => Number(row.id)).filter(Boolean);
}

function handleError(res, error) {
  const status = error.status && Number.isInteger(error.status) ? error.status : 500;
  sendJson(res, status, {
    error: error.message || "Server error",
    details: status >= 500 ? undefined : error.details
  });
}

module.exports = {
  methodAllowed,
  readJson,
  sendJson,
  supabaseFetch,
  requireUser,
  requireAdmin,
  getProfile,
  getOwnedSellerIds,
  handleError
};
