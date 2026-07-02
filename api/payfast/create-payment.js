const {
  getOwnedSellerIds,
  handleError,
  methodAllowed,
  readJson,
  requireUser,
  sendJson,
  supabaseFetch
} = require("../_lib/supabase");
const {
  amountFor,
  cleanBilling,
  cleanPlan,
  configured,
  payfastHost,
  signFields,
  siteUrl
} = require("../_lib/payfast");

function httpError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function randToken() {
  return Math.random().toString(36).slice(2, 8);
}

async function ownedSeller(userId, requestedSellerId) {
  const sellerIds = await getOwnedSellerIds(userId);
  const sellerId = Number(requestedSellerId || sellerIds[0] || 0);
  if (!sellerId || !sellerIds.includes(sellerId)) {
    throw httpError("Seller profile not found for this account", 403);
  }
  const rows = await supabaseFetch(
    `/rest/v1/sellers?id=eq.${encodeURIComponent(sellerId)}&auth_id=eq.${encodeURIComponent(userId)}&select=id,auth_id,email,name,seller,tier`,
    { headers: { Prefer: "" } }
  );
  if (!rows || !rows.length) throw httpError("Seller profile not found for this account", 403);
  return rows[0];
}

module.exports = async function handler(req, res) {
  if (!methodAllowed(req, res, ["POST"])) return;

  try {
    if (!configured()) {
      throw httpError("PayFast is not configured yet. Add PAYFAST_MERCHANT_ID and PAYFAST_MERCHANT_KEY in Vercel.", 503);
    }

    const user = await requireUser(req);
    const body = await readJson(req);
    const plan = cleanPlan(body.plan);
    const billing = cleanBilling(body.billing);
    if (!plan) throw httpError("Choose Gold or Platinum");

    const seller = await ownedSeller(user.id, body.sellerId);
    if (seller.tier === plan) throw httpError(`This seller is already on ${plan}`);

    const amount = amountFor(plan, billing);
    if (!amount) throw httpError("Invalid subscription amount");

    const baseUrl = siteUrl(req);
    const mPaymentId = `hm-${seller.id}-${plan}-${Date.now()}-${randToken()}`;
    const itemName = `Home-Made ${plan.charAt(0).toUpperCase() + plan.slice(1)} ${billing === "yearly" ? "Annual" : "Monthly"}`;
    const itemDescription = `${itemName} seller subscription`;

    const paymentRows = await supabaseFetch("/rest/v1/payments", {
      method: "POST",
      body: JSON.stringify({
        provider: "payfast",
        payment_type: "seller_subscription",
        user_id: user.id,
        seller_id: seller.id,
        m_payment_id: mPaymentId,
        amount,
        currency: "ZAR",
        status: "pending",
        plan,
        billing_interval: billing,
        item_name: itemName,
        raw_request: {
          sellerName: seller.name,
          sellerEmail: seller.email,
          requestedAt: new Date().toISOString()
        }
      })
    });

    const payment = paymentRows && paymentRows[0] ? paymentRows[0] : null;
    const fields = {
      merchant_id: process.env.PAYFAST_MERCHANT_ID,
      merchant_key: process.env.PAYFAST_MERCHANT_KEY,
      return_url: `${baseUrl}/?payment=payfast-success&ref=${encodeURIComponent(mPaymentId)}#pricing`,
      cancel_url: `${baseUrl}/?payment=payfast-cancelled&ref=${encodeURIComponent(mPaymentId)}#pricing`,
      notify_url: `${baseUrl}/api/payfast/notify`,
      name_first: (seller.name || user.email || "Home-Made seller").slice(0, 100),
      email_address: (seller.email || user.email || "").slice(0, 100),
      m_payment_id: mPaymentId,
      amount: amount.toFixed(2),
      item_name: itemName,
      item_description: itemDescription,
      custom_int1: String(seller.id),
      custom_str1: user.id,
      custom_str2: plan,
      custom_str3: billing,
      custom_str4: payment && payment.id ? payment.id : ""
    };
    fields.signature = signFields(fields);

    sendJson(res, 200, {
      ok: true,
      provider: "payfast",
      endpoint: `${payfastHost()}/eng/process`,
      fields,
      payment: {
        id: payment && payment.id,
        ref: mPaymentId,
        amount,
        plan,
        billing
      }
    });
  } catch (error) {
    handleError(res, error);
  }
};
