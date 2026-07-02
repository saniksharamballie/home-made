const crypto = require("node:crypto");

const PLAN_PRICES = {
  monthly: {
    gold: 149,
    platinum: 299
  },
  yearly: {
    gold: 119 * 12,
    platinum: 239 * 12
  }
};

function cleanPlan(value) {
  const plan = String(value || "").trim().toLowerCase();
  return ["gold", "platinum"].includes(plan) ? plan : "";
}

function cleanBilling(value) {
  const billing = String(value || "").trim().toLowerCase();
  return billing === "yearly" ? "yearly" : "monthly";
}

function amountFor(plan, billing) {
  return PLAN_PRICES[cleanBilling(billing)][cleanPlan(plan)] || 0;
}

function payfastHost() {
  return String(process.env.PAYFAST_SANDBOX || "").toLowerCase() === "true"
    ? "https://sandbox.payfast.co.za"
    : "https://www.payfast.co.za";
}

function siteUrl(req) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  const host = req.headers["x-forwarded-host"] || req.headers.host || "www.home-made.co.za";
  const proto = req.headers["x-forwarded-proto"] || "https";
  return `${proto}://${host}`.replace(/\/$/, "");
}

function configured() {
  return !!(process.env.PAYFAST_MERCHANT_ID && process.env.PAYFAST_MERCHANT_KEY);
}

function pfEncode(value) {
  return encodeURIComponent(String(value == null ? "" : value).trim()).replace(/%20/g, "+");
}

function fieldPairsFromObject(fields) {
  return Object.entries(fields).filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "");
}

function signatureBase(pairs, passphrase = process.env.PAYFAST_PASSPHRASE || "") {
  const withoutSignature = pairs.filter(([key]) => key !== "signature");
  let base = withoutSignature.map(([key, value]) => `${key}=${pfEncode(value)}`).join("&");
  if (passphrase) base += `${base ? "&" : ""}passphrase=${pfEncode(passphrase)}`;
  return base;
}

function signPairs(pairs) {
  return crypto.createHash("md5").update(signatureBase(pairs)).digest("hex");
}

function signFields(fields) {
  return signPairs(fieldPairsFromObject(fields));
}

function parseForm(raw) {
  const pairs = [];
  const data = {};
  for (const part of String(raw || "").split("&")) {
    if (!part) continue;
    const splitAt = part.indexOf("=");
    const key = decodeURIComponent((splitAt >= 0 ? part.slice(0, splitAt) : part).replace(/\+/g, " "));
    const value = decodeURIComponent((splitAt >= 0 ? part.slice(splitAt + 1) : "").replace(/\+/g, " "));
    pairs.push([key, value]);
    data[key] = value;
  }
  return { pairs, data };
}

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

async function validateWithPayFast(rawBody) {
  const response = await fetch(`${payfastHost()}/eng/query/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: rawBody
  });
  const text = (await response.text()).trim();
  return { ok: response.ok && text === "VALID", status: response.status, text };
}

module.exports = {
  amountFor,
  cleanBilling,
  cleanPlan,
  configured,
  fieldPairsFromObject,
  parseForm,
  payfastHost,
  readRawBody,
  signFields,
  signPairs,
  siteUrl,
  validateWithPayFast
};
