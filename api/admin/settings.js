const {
  handleError,
  methodAllowed,
  readJson,
  requireAdmin,
  sendJson,
  supabaseFetch
} = require("../_lib/supabase");

const PUBLIC_KEYS = new Set(["announcement_banner", "home_content"]);

module.exports = async function handler(req, res) {
  if (!methodAllowed(req, res, ["GET", "PATCH"])) return;

  try {
    if (req.method === "GET") {
      const key = typeof req.query.key === "string" ? req.query.key : "";
      const path = key
        ? `/rest/v1/app_settings?key=eq.${encodeURIComponent(key)}&select=key,value`
        : "/rest/v1/app_settings?select=key,value&order=key.asc";
      const rows = await supabaseFetch(path, { headers: { Prefer: "" } });
      const settings = {};
      for (const row of rows || []) {
        if (PUBLIC_KEYS.has(row.key)) settings[row.key] = row.value;
      }
      sendJson(res, 200, { settings });
      return;
    }

    await requireAdmin(req);
    const body = await readJson(req);
    const updates = body.settings && typeof body.settings === "object"
      ? body.settings
      : body.key && body.value !== undefined
        ? { [body.key]: body.value }
        : null;

    if (!updates) {
      sendJson(res, 400, { error: "Provide {key,value} or {settings:{...}}" });
      return;
    }

    const rows = Object.entries(updates)
      .filter(([key]) => PUBLIC_KEYS.has(key))
      .map(([key, value]) => ({ key, value }));

    if (!rows.length) {
      sendJson(res, 400, { error: "No supported setting keys supplied" });
      return;
    }

    const saved = await supabaseFetch("/rest/v1/app_settings?on_conflict=key", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=representation" },
      body: JSON.stringify(rows)
    });
    sendJson(res, 200, { ok: true, settings: saved });
  } catch (error) {
    handleError(res, error);
  }
};
