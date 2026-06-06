const crypto = require("node:crypto");
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

function canManageSeller(profile, sellerIds, sellerId) {
  return (profile && profile.role === "admin") || sellerIds.includes(Number(sellerId));
}

function trustScore({ tokenRow, stars, comment, dwellMs, deviceFingerprint }) {
  let score = 100;
  const flags = [];
  const ageMs = Date.now() - new Date(tokenRow.created_at).getTime();
  if (ageMs < 60_000) {
    score -= 30;
    flags.push("Used <1min after generation");
  } else if (ageMs < 300_000) {
    score -= 10;
    flags.push("Used <5min after generation");
  }
  if (dwellMs < 8000) {
    score -= 25;
    flags.push("Form completed in <8s");
  } else if (dwellMs < 20000) {
    score -= 10;
    flags.push("Form completed in <20s");
  }
  if (!comment || comment.trim().length === 0) {
    score -= 15;
    flags.push("No comment provided");
  } else if (comment.trim().length < 15) {
    score -= 8;
    flags.push("Very short comment");
  }
  if (stars <= 2 && (!comment || comment.trim().length < 10)) {
    score -= 20;
    flags.push("Low rating without explanation");
  }
  if (deviceFingerprint && tokenRow.gen_device_fingerprint && deviceFingerprint === tokenRow.gen_device_fingerprint) {
    score -= 35;
    flags.push("Rated from same device that generated the token");
  }
  if (tokenRow.order_code && tokenRow.order_code_verified) score += 20;
  else if (!tokenRow.order_code) {
    score -= 10;
    flags.push("No order code linked");
  }
  score = Math.max(0, Math.min(100, score));
  return { score, flags };
}

module.exports = async function handler(req, res) {
  if (!methodAllowed(req, res, ["GET", "POST"])) return;

  try {
    const user = await requireUser(req);
    const profile = await getProfile(user.id);
    const sellerIds = await getOwnedSellerIds(user.id);

    if (req.method === "GET") {
      const sellerId = req.query.sellerId ? Number(req.query.sellerId) : null;
      if (sellerId && !canManageSeller(profile, sellerIds, sellerId)) {
        sendJson(res, 403, { error: "Seller access required" });
        return;
      }
      if (!sellerId && (!profile || profile.role !== "admin")) {
        const own = sellerIds[0];
        if (!own) {
          const rows = await supabaseFetch(
            `/rest/v1/seller_ratings?buyer_id=eq.${encodeURIComponent(user.id)}&select=*&order=created_at.desc`,
            { headers: { Prefer: "" } }
          );
          sendJson(res, 200, { ratings: rows || [] });
          return;
        }
      }
      const filter = sellerId ? `seller_id=eq.${encodeURIComponent(sellerId)}&` : "";
      const rows = await supabaseFetch(
        `/rest/v1/seller_ratings?${filter}select=*&order=created_at.desc&limit=200`,
        { headers: { Prefer: "" } }
      );
      sendJson(res, 200, { ratings: rows || [] });
      return;
    }

    const body = await readJson(req);
    const action = String(body.action || "").trim();

    if (action === "generate-token") {
      const sellerId = Number(body.sellerId);
      if (!sellerId || !canManageSeller(profile, sellerIds, sellerId)) {
        sendJson(res, 403, { error: "Seller or admin access required" });
        return;
      }
      const token = `HMR-${crypto.randomBytes(16).toString("hex").toUpperCase()}`;
      const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
      const payload = {
        token,
        seller_id: sellerId,
        created_by: user.id,
        buyer_ref: String(body.buyerRef || "Anonymous").slice(0, 120),
        order_code: body.orderCode || null,
        order_code_verified: !!body.orderCodeVerified,
        gen_device_fingerprint: body.deviceFingerprint || null,
        expires_at: expiresAt,
        used: false
      };
      const rows = await supabaseFetch("/rest/v1/rating_tokens", {
        method: "POST",
        body: JSON.stringify(payload)
      });
      sendJson(res, 201, { ok: true, token, expiresAt, record: rows && rows[0] ? rows[0] : null });
      return;
    }

    if (action === "submit") {
      const token = String(body.token || "").trim();
      const stars = Number(body.stars);
      const comment = String(body.comment || "").trim();
      if (!token || !Number.isInteger(stars) || stars < 1 || stars > 5) {
        sendJson(res, 400, { error: "Valid token and stars are required" });
        return;
      }
      const tokenRows = await supabaseFetch(
        `/rest/v1/rating_tokens?token=eq.${encodeURIComponent(token)}&select=*`,
        { headers: { Prefer: "" } }
      );
      const tokenRow = tokenRows && tokenRows[0];
      if (!tokenRow) {
        sendJson(res, 404, { error: "Rating token not found" });
        return;
      }
      if (tokenRow.used) {
        sendJson(res, 409, { error: "Rating token has already been used" });
        return;
      }
      if (new Date(tokenRow.expires_at).getTime() < Date.now()) {
        sendJson(res, 410, { error: "Rating token has expired" });
        return;
      }

      const dwellMs = Number(body.dwellMs || 0);
      const deviceFingerprint = body.deviceFingerprint || null;
      const trust = trustScore({ tokenRow, stars, comment, dwellMs, deviceFingerprint });
      const ratingPayload = {
        token,
        seller_id: tokenRow.seller_id,
        buyer_id: user.id,
        buyer_ref: tokenRow.buyer_ref || "Anonymous",
        order_code: tokenRow.order_code || null,
        stars,
        comment,
        trust_score: trust.score,
        trust_flags: trust.flags,
        dwell_ms: dwellMs,
        device_fingerprint: deviceFingerprint,
        suspicious: trust.score < 50
      };
      const ratingRows = await supabaseFetch("/rest/v1/seller_ratings", {
        method: "POST",
        body: JSON.stringify(ratingPayload)
      });
      await supabaseFetch(`/rest/v1/rating_tokens?token=eq.${encodeURIComponent(token)}`, {
        method: "PATCH",
        body: JSON.stringify({
          used: true,
          used_at: new Date().toISOString(),
          used_device_fingerprint: deviceFingerprint
        })
      });
      sendJson(res, 201, { ok: true, trustScore: trust.score, rating: ratingRows && ratingRows[0] ? ratingRows[0] : null });
      return;
    }

    sendJson(res, 400, { error: "Unsupported ratings action" });
  } catch (error) {
    handleError(res, error);
  }
};
