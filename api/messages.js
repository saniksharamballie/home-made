const {
  getOwnedSellerIds,
  getProfile,
  handleError,
  methodAllowed,
  readJson,
  requireUser,
  sendJson,
  supabaseFetch
} = require("./_lib/supabase");

function orFilterForUser(user, profile, sellerIds) {
  if (profile && profile.role === "admin") return "";
  const parts = [
    `sender_id.eq.${user.id}`,
    `recipient_id.eq.${user.id}`,
    `to_id.eq.${user.id}`,
    `from_id.eq.${user.id}`
  ];
  for (const id of sellerIds) {
    parts.push(`and(to_role.eq.seller,to_id.eq.${id})`);
    parts.push(`and(from_role.eq.seller,from_id.eq.${id})`);
  }
  return `&or=(${parts.join(",")})`;
}

module.exports = async function handler(req, res) {
  if (!methodAllowed(req, res, ["GET", "POST", "PATCH"])) return;

  try {
    const user = await requireUser(req);
    const profile = await getProfile(user.id);
    const sellerIds = await getOwnedSellerIds(user.id);

    if (req.method === "GET") {
      const roleFilter = orFilterForUser(user, profile, sellerIds);
      const rows = await supabaseFetch(
        `/rest/v1/messages?select=*&order=created_at.desc&limit=200${roleFilter}`,
        { headers: { Prefer: "" } }
      );
      sendJson(res, 200, { messages: rows || [] });
      return;
    }

    if (req.method === "POST") {
      const body = await readJson(req);
      const message = {
        app_id: body.appId || `api-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        sender_id: user.id,
        recipient_id: body.recipientId || null,
        seller_id: body.sellerId || null,
        subject: String(body.subject || "Message").slice(0, 160),
        body: String(body.body || "").trim(),
        from_role: body.fromRole || (profile && profile.role) || "buyer",
        from_label: body.fromLabel || (profile && profile.display_name) || user.email || "User",
        from_id: body.fromId || user.id,
        to_role: body.toRole || null,
        to_label: body.toLabel || null,
        to_id: body.toId || null,
        client_ts: body.clientTs || Date.now(),
        read: false
      };
      if (!message.body) {
        sendJson(res, 400, { error: "Message body is required" });
        return;
      }
      const rows = await supabaseFetch("/rest/v1/messages", {
        method: "POST",
        body: JSON.stringify(message)
      });
      sendJson(res, 201, { ok: true, message: rows && rows[0] ? rows[0] : null });
      return;
    }

    const body = await readJson(req);
    const id = String(body.id || "").trim();
    if (!id) {
      sendJson(res, 400, { error: "Message id is required" });
      return;
    }
    const roleFilter = orFilterForUser(user, profile, sellerIds);
    const existing = await supabaseFetch(
      `/rest/v1/messages?id=eq.${encodeURIComponent(id)}&select=id${roleFilter}`,
      { headers: { Prefer: "" } }
    );
    if (!existing || !existing.length) {
      sendJson(res, 404, { error: "Message not found" });
      return;
    }
    const rows = await supabaseFetch(`/rest/v1/messages?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ read: !!body.read, is_read: !!body.read })
    });
    sendJson(res, 200, { ok: true, message: rows && rows[0] ? rows[0] : null });
  } catch (error) {
    handleError(res, error);
  }
};
