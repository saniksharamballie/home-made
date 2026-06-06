const {
  handleError,
  methodAllowed,
  readJson,
  requireUser,
  sendJson,
  supabaseFetch
} = require("./_lib/supabase");

module.exports = async function handler(req, res) {
  if (!methodAllowed(req, res, ["GET", "POST", "DELETE"])) return;

  try {
    const user = await requireUser(req);

    if (req.method === "GET") {
      const rows = await supabaseFetch(
        `/rest/v1/want_list_items?user_id=eq.${encodeURIComponent(user.id)}&select=*&order=created_at.desc`,
        { headers: { Prefer: "" } }
      );
      sendJson(res, 200, { items: rows || [] });
      return;
    }

    if (req.method === "POST") {
      const body = await readJson(req);
      const item = String(body.item || "").trim();
      if (!item) {
        sendJson(res, 400, { error: "Item is required" });
        return;
      }
      const payload = {
        user_id: user.id,
        item,
        source: body.source || "api",
        seller_id: body.sellerId || null,
        metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {}
      };
      const rows = await supabaseFetch("/rest/v1/want_list_items?on_conflict=user_id,item", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=representation" },
        body: JSON.stringify(payload)
      });
      sendJson(res, 200, { ok: true, item: rows && rows[0] ? rows[0] : null });
      return;
    }

    const body = await readJson(req);
    const id = String(body.id || req.query.id || "").trim();
    const item = String(body.item || req.query.item || "").trim();
    if (!id && !item) {
      sendJson(res, 400, { error: "Provide id or item to delete" });
      return;
    }
    const filter = id
      ? `id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(user.id)}`
      : `item=eq.${encodeURIComponent(item)}&user_id=eq.${encodeURIComponent(user.id)}`;
    await supabaseFetch(`/rest/v1/want_list_items?${filter}`, { method: "DELETE" });
    sendJson(res, 200, { ok: true });
  } catch (error) {
    handleError(res, error);
  }
};
