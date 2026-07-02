const { handleError, methodAllowed, sendJson, supabaseFetch } = require("../_lib/supabase");
const { parseForm, readRawBody, signPairs, validateWithPayFast } = require("../_lib/payfast");

function httpError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function cents(value) {
  return Math.round(Number(value || 0) * 100);
}

function addMonths(date, months) {
  const next = new Date(date.getTime());
  next.setMonth(next.getMonth() + months);
  return next;
}

function cleanPaymentStatus(value) {
  const status = String(value || "").trim().toUpperCase();
  if (status === "COMPLETE") return "complete";
  if (status === "FAILED") return "failed";
  if (status === "CANCELLED" || status === "CANCELED") return "cancelled";
  return status ? status.toLowerCase() : "unknown";
}

async function updatePayment(payment, data, status, validation) {
  const confirmedAt = status === "complete" ? new Date().toISOString() : null;
  const rows = await supabaseFetch(`/rest/v1/payments?id=eq.${encodeURIComponent(payment.id)}`, {
    method: "PATCH",
    body: JSON.stringify({
      status,
      provider_payment_id: data.pf_payment_id || payment.provider_payment_id || null,
      raw_notify: { data, validation },
      confirmed_at: confirmedAt || payment.confirmed_at || null
    })
  });
  return rows && rows[0] ? rows[0] : payment;
}

async function activateSubscription(payment, data) {
  const now = new Date();
  const months = payment.billing_interval === "yearly" ? 12 : 1;
  const periodEnd = addMonths(now, months).toISOString();
  const tier = payment.plan;
  const sellerRows = await supabaseFetch(
    `/rest/v1/sellers?id=eq.${encodeURIComponent(payment.seller_id)}&select=data`,
    { headers: { Prefer: "" } }
  );
  const sellerData = sellerRows && sellerRows[0] && sellerRows[0].data && typeof sellerRows[0].data === "object"
    ? sellerRows[0].data
    : {};
  await supabaseFetch(`/rest/v1/sellers?id=eq.${encodeURIComponent(payment.seller_id)}`, {
    method: "PATCH",
    body: JSON.stringify({
      tier,
      data: {
        ...sellerData,
        payfastLastPayment: payment.m_payment_id,
        paidTier: tier,
        paidTierBilling: payment.billing_interval,
        paidTierUntil: periodEnd
      }
    })
  });
  const rows = await supabaseFetch("/rest/v1/seller_subscriptions?on_conflict=seller_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      seller_id: payment.seller_id,
      user_id: payment.user_id,
      tier,
      billing_interval: payment.billing_interval,
      status: "active",
      provider: "payfast",
      provider_payment_id: data.pf_payment_id || null,
      current_period_start: now.toISOString(),
      current_period_end: periodEnd,
      metadata: {
        m_payment_id: payment.m_payment_id,
        amount_gross: data.amount_gross || null
      }
    })
  });
  return rows && rows[0] ? rows[0] : null;
}

module.exports = async function handler(req, res) {
  if (!methodAllowed(req, res, ["POST"])) return;

  try {
    const raw = await readRawBody(req);
    const { pairs, data } = parseForm(raw);
    if (!data.m_payment_id) throw httpError("Missing m_payment_id");
    if (!data.signature) throw httpError("Missing signature");
    if (String(data.merchant_id || "") !== String(process.env.PAYFAST_MERCHANT_ID || "")) {
      throw httpError("Merchant mismatch", 403);
    }

    const expectedSignature = signPairs(pairs);
    if (expectedSignature !== data.signature) throw httpError("Invalid PayFast signature", 403);

    const validation = String(process.env.PAYFAST_SKIP_REMOTE_VALIDATION || "").toLowerCase() === "true"
      ? { ok: true, skipped: true }
      : await validateWithPayFast(raw);
    if (!validation.ok) throw httpError("PayFast validation failed", 403);

    const rows = await supabaseFetch(
      `/rest/v1/payments?m_payment_id=eq.${encodeURIComponent(data.m_payment_id)}&select=*`,
      { headers: { Prefer: "" } }
    );
    const payment = rows && rows[0] ? rows[0] : null;
    if (!payment) throw httpError("Payment reference not found", 404);
    if (cents(payment.amount) !== cents(data.amount_gross)) throw httpError("Payment amount mismatch", 403);

    const status = cleanPaymentStatus(data.payment_status);
    const updatedPayment = await updatePayment(payment, data, status, validation);
    let subscription = null;
    if (status === "complete" && payment.payment_type === "seller_subscription") {
      subscription = await activateSubscription(updatedPayment, data);
    }

    sendJson(res, 200, { ok: true, status, subscriptionId: subscription && subscription.id });
  } catch (error) {
    handleError(res, error);
  }
};
