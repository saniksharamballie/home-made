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

function httpError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function cleanRole(value) {
  const role = String(value || "").trim().toLowerCase();
  return ["admin", "buyer", "seller"].includes(role) ? role : "";
}

function cleanText(value, fallback = "") {
  return String(value || fallback).trim();
}

function looksUuid(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function firstOwnedSellerId(body, sellerIds) {
  const requested = Number(body.fromId || body.from_id || 0);
  if (requested && sellerIds.includes(requested)) return requested;
  return sellerIds[0] || null;
}

function deriveSender(body, user, profile, sellerIds) {
  const profileRole = cleanRole(profile && profile.role) || "buyer";
  const requestedRole = cleanRole(body.fromRole || body.from_role) || profileRole;
  const displayName = cleanText(profile && profile.display_name, user.email || "Home-Made member");

  if (profileRole === "admin" && requestedRole === "admin") {
    return { fromRole: "admin", fromId: user.id, fromLabel: "Home-Made Admin" };
  }

  if ((profileRole === "seller" || sellerIds.length) && requestedRole === "seller") {
    const sellerId = firstOwnedSellerId(body, sellerIds);
    if (!sellerId) throw httpError("Seller profile not found for this account", 403);
    return { fromRole: "seller", fromId: String(sellerId), fromLabel: `Seller #${sellerId}` };
  }

  return { fromRole: "buyer", fromId: user.id, fromLabel: displayName };
}

function deriveRecipient(body, sender) {
  const toRole = cleanRole(body.toRole || body.to_role);
  const rawToId = body.toId !== undefined ? body.toId : body.to_id;
  const toId = rawToId === undefined || rawToId === null || rawToId === "null" ? null : String(rawToId);
  const toLabel = cleanText(body.toLabel || body.to_label, toRole ? `${toRole} recipient` : "Home-Made member").slice(0, 120);

  if (!toRole) throw httpError("Message recipient role is required");

  if (sender.fromRole === "admin") {
    if (!["buyer", "seller", "admin"].includes(toRole)) throw httpError("Invalid admin recipient");
    return { toRole, toId, toLabel };
  }

  if (sender.fromRole === "buyer") {
    if (!["seller", "admin"].includes(toRole)) throw httpError("Buyers can only message sellers or admin", 403);
    if (toRole === "seller" && !toId) throw httpError("Choose a seller recipient", 400);
    return { toRole, toId, toLabel };
  }

  if (sender.fromRole === "seller") {
    if (!["buyer", "admin"].includes(toRole)) throw httpError("Sellers can only message buyers or admin", 403);
    if (toRole === "buyer" && !toId) throw httpError("Choose a buyer recipient", 400);
    return { toRole, toId, toLabel };
  }

  throw httpError("Invalid sender role", 403);
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
      const sender = deriveSender(body, user, profile, sellerIds);
      const recipient = deriveRecipient(body, sender);
      const recipientAuthId = recipient.toRole === "buyer" && looksUuid(recipient.toId) ? recipient.toId : null;
      const sellerId =
        sender.fromRole === "seller"
          ? Number(sender.fromId) || null
          : recipient.toRole === "seller"
            ? Number(recipient.toId) || null
            : null;
      const message = {
        app_id: body.appId || `api-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        sender_id: user.id,
        recipient_id: recipientAuthId,
        seller_id: sellerId,
        subject: String(body.subject || "Message").slice(0, 160),
        body: String(body.body || "").trim(),
        from_role: sender.fromRole,
        from_label: sender.fromLabel,
        from_id: sender.fromId,
        to_role: recipient.toRole,
        to_label: recipient.toLabel,
        to_id: recipient.toId,
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
