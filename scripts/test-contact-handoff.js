const { Readable } = require("node:stream");
const handler = require("../api/contact-seller");

const SELLER_A = "1";
const SELLER_B = "2";
const SELLER_C = "3";
const MISSING_SELLER = "999";
const FICTIONAL_NUMBER = "27870000000";
const FICTIONAL_OVERRIDE = "27870000001";
const capturedOutput = [];
const originalLog = console.log.bind(console);
const originalError = console.error.bind(console);
console.log = (...args) => {
  capturedOutput.push(args.map(String).join(" "));
  originalLog(...args);
};
console.error = (...args) => {
  capturedOutput.push(args.map(String).join(" "));
  originalError(...args);
};

let failures = 0;

function restoreEnv(snapshot) {
  for (const key of Object.keys(process.env)) {
    if (!Object.prototype.hasOwnProperty.call(snapshot, key)) {
      delete process.env[key];
    }
  }
  Object.assign(process.env, snapshot);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) throw new Error(`${message}: expected ${expected}, got ${actual}`);
}

async function test(name, fn) {
  const envBefore = { ...process.env };
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${name}`);
    console.error(`  ${error.message}`);
  } finally {
    restoreEnv(envBefore);
  }
}

function assertLocalOnlyEnv() {
  const values = [
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_URL,
    process.env.DATABASE_URL
  ].filter(Boolean);
  for (const value of values) {
    if (/supabase\.co|postgres(?:ql)?:\/\/(?!localhost|127\.0\.0\.1)/i.test(value)) {
      throw new Error("Refusing contact handoff tests with a remote Supabase/database URL in the environment");
    }
  }
}

function makeReq({
  method = "POST",
  origin = "http://localhost:5173",
  ip = "203.0.113.10",
  body = {},
  type = "json",
  host,
  forwardedHost,
  deploymentUrl
} = {}) {
  const encoded = type === "form"
    ? new URLSearchParams(body).toString()
    : JSON.stringify(body);
  const req = Readable.from(encoded ? [encoded] : []);
  req.method = method;
  req.headers = {
    "x-forwarded-for": ip,
    "content-type": type === "form" ? "application/x-www-form-urlencoded" : "application/json"
  };
  if (origin !== undefined) req.headers.origin = origin;
  if (host !== undefined) req.headers.host = host;
  if (forwardedHost !== undefined) req.headers["x-forwarded-host"] = forwardedHost;
  if (deploymentUrl !== undefined) req.headers["x-vercel-deployment-url"] = deploymentUrl;
  req.socket = { remoteAddress: ip };
  return req;
}

function makeRes() {
  return {
    statusCode: 200,
    headers: {},
    body: "",
    setHeader(key, value) {
      this.headers[key.toLowerCase()] = value;
    },
    end(chunk = "") {
      this.body += Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk || "");
      this.finished = true;
    }
  };
}

async function call(options) {
  const req = makeReq(options);
  const res = makeRes();
  await handler(req, res);
  return res;
}

function installMockSupabase() {
  const sellers = new Map([
    [SELLER_A, { id: 1, active: true, wa: FICTIONAL_NUMBER }],
    [SELLER_B, { id: 2, active: false, wa: FICTIONAL_NUMBER }],
    [SELLER_C, { id: 3, active: true, wa: "" }]
  ]);
  const counters = new Map();
  handler._test.setSupabaseFetch(async (path, options = {}) => {
    if (path.includes("/rpc/home_made_contact_handoff_rate_limit")) {
      const body = JSON.parse(options.body || "{}");
      const key = `${body.input_client_hash}:${body.input_window_seconds}`;
      counters.set(key, (counters.get(key) || 0) + 1);
      return counters.get(key) <= Number(body.input_max_requests);
    }
    if (path.startsWith("/rest/v1/sellers?")) {
      const match = path.match(/id=eq\.([^&]+)/);
      const row = match ? sellers.get(decodeURIComponent(match[1])) : null;
      return row ? [row] : [];
    }
    throw new Error("Unexpected mock Supabase path");
  });
  const directoryRows = [
    { id: 1, hasWhatsApp: true, data: { hasWhatsApp: true } },
    { id: 2, hasWhatsApp: true, data: { hasWhatsApp: true } },
    { id: 3, hasWhatsApp: false, data: { hasWhatsApp: false } }
  ];
  return { counters, sellers, directoryRows };
}

function resetEnv() {
  delete process.env.VERCEL;
  process.env.NODE_ENV = "test";
  process.env.VERCEL_ENV = "development";
  process.env.CONTACT_RATE_LIMIT_SECRET = "local-contact-test-secret-000000";
  delete process.env.CONTACT_SELLER_WHATSAPP_OVERRIDE;
  process.env.CONTACT_RATE_LIMIT_SHORT_WINDOW_SECONDS = "600";
  process.env.CONTACT_RATE_LIMIT_DAILY_WINDOW_SECONDS = "86400";
  process.env.CONTACT_RATE_LIMIT_SHORT_MAX = "6";
  process.env.CONTACT_RATE_LIMIT_DAILY_MAX = "20";
}

function assertNoSensitiveBody(res) {
  assert(!res.body.includes(FICTIONAL_NUMBER), "response body must not include contact number");
  assert(!res.body.includes(FICTIONAL_OVERRIDE), "response body must not include override number");
  assert(!res.body.includes("wa"), "response body must not expose seller record fields");
  assert(!res.body.includes("local-contact-test-secret"), "response body must not include secrets");
}

function redirectUses(res, number) {
  const url = new URL(res.headers.location);
  return url.host === "wa.me" && url.pathname === `/${number}`;
}

function setProductionEnv() {
  process.env.VERCEL = "1";
  process.env.VERCEL_ENV = "production";
  process.env.NODE_ENV = "production";
}

function setPreviewEnv() {
  process.env.VERCEL = "1";
  process.env.VERCEL_ENV = "preview";
  process.env.NODE_ENV = "production";
}

function previewRequestOptions(overrides = {}) {
  const host = "home-made-preview-abc123-saniksha-s-projects.vercel.app";
  return {
    origin: `https://${host}`,
    host,
    forwardedHost: host,
    deploymentUrl: host,
    body: { sellerId: SELLER_A, message: "Hello from preview" },
    ...overrides
  };
}

async function main() {
  assertLocalOnlyEnv();
  resetEnv();
  const mock = installMockSupabase();

  await test("GET is rejected with 405", async () => {
    const res = await call({ method: "GET", body: {} });
    assertEqual(res.statusCode, 405, "GET status");
  });

  await test("Invalid origin is rejected", async () => {
    const res = await call({ origin: "https://evil.example", body: { sellerId: SELLER_A } });
    assertEqual(res.statusCode, 403, "invalid origin status");
  });

  await test("Production accepts the canonical approved Production origin", async () => {
    setProductionEnv();
    const res = await call({
      origin: "https://www.home-made.co.za",
      host: "www.home-made.co.za",
      body: { sellerId: SELLER_A }
    });
    assertEqual(res.statusCode, 303, "production origin status");
  });

  await test("Production rejects a Vercel Preview origin", async () => {
    setProductionEnv();
    const res = await call(previewRequestOptions({ body: { sellerId: SELLER_A } }));
    assertEqual(res.statusCode, 403, "production preview-origin status");
  });

  await test("Preview accepts an exact HTTPS Origin matching the request host", async () => {
    setPreviewEnv();
    const res = await call(previewRequestOptions({ ip: "203.0.113.32" }));
    assertEqual(res.statusCode, 303, "preview exact origin status");
  });

  await test("Preview accepts the exact current deployment domain with Vercel metadata", async () => {
    setPreviewEnv();
    const host = "home-made-git-codex-whatsapp-saniksha-s-projects.vercel.app";
    const res = await call(previewRequestOptions({
      ip: "203.0.113.33",
      origin: `https://${host}`,
      host,
      forwardedHost: host,
      deploymentUrl: `https://${host}`
    }));
    assertEqual(res.statusCode, 303, "preview deployment-domain status");
  });

  await test("Preview rejects a different Vercel Preview Origin", async () => {
    setPreviewEnv();
    const host = "home-made-preview-abc123-saniksha-s-projects.vercel.app";
    const res = await call(previewRequestOptions({
      origin: "https://home-made-other-preview-saniksha-s-projects.vercel.app",
      host,
      forwardedHost: host,
      deploymentUrl: host,
      body: { sellerId: SELLER_A }
    }));
    assertEqual(res.statusCode, 403, "different preview origin status");
  });

  await test("Preview rejects a broad arbitrary Vercel app Origin", async () => {
    setPreviewEnv();
    const res = await call(previewRequestOptions({
      origin: "https://anything.vercel.app",
      body: { sellerId: SELLER_A }
    }));
    assertEqual(res.statusCode, 403, "arbitrary vercel app origin status");
  });

  await test("Preview rejects when Origin and Host differ", async () => {
    setPreviewEnv();
    const res = await call(previewRequestOptions({
      host: "home-made-preview-abc123-saniksha-s-projects.vercel.app",
      forwardedHost: "home-made-preview-abc123-saniksha-s-projects.vercel.app",
      deploymentUrl: "home-made-preview-abc123-saniksha-s-projects.vercel.app",
      origin: "https://home-made-preview-other-saniksha-s-projects.vercel.app",
      body: { sellerId: SELLER_A }
    }));
    assertEqual(res.statusCode, 403, "origin host mismatch status");
  });

  await test("Preview rejects when Vercel deployment metadata is absent", async () => {
    setPreviewEnv();
    const res = await call(previewRequestOptions({
      deploymentUrl: undefined,
      body: { sellerId: SELLER_A }
    }));
    assertEqual(res.statusCode, 403, "missing deployment metadata status");
  });

  await test("Preview rejects malformed or comma-injected Host headers", async () => {
    setPreviewEnv();
    const res = await call(previewRequestOptions({
      forwardedHost: "home-made-preview-abc123-saniksha-s-projects.vercel.app, evil.example",
      body: { sellerId: SELLER_A }
    }));
    assertEqual(res.statusCode, 403, "comma injected host status");
  });

  await test("Preview rejects HTTP origins", async () => {
    setPreviewEnv();
    const host = "home-made-preview-abc123-saniksha-s-projects.vercel.app";
    const res = await call(previewRequestOptions({
      origin: `http://${host}`,
      host,
      forwardedHost: host,
      deploymentUrl: host,
      body: { sellerId: SELLER_A }
    }));
    assertEqual(res.statusCode, 403, "http preview origin status");
  });

  await test("Preview rejects malformed Origin values", async () => {
    setPreviewEnv();
    const res = await call(previewRequestOptions({
      origin: "https://good.example, https://evil.example",
      body: { sellerId: SELLER_A }
    }));
    assertEqual(res.statusCode, 403, "malformed origin status");
  });

  await test("Local development origin behaviour remains intact", async () => {
    const res = await call({
      origin: "http://127.0.0.1:5173",
      body: { sellerId: SELLER_A }
    });
    assertEqual(res.statusCode, 303, "local origin status");
  });

  await test("Successful Preview-shaped request reaches 303 handoff logic safely", async () => {
    setPreviewEnv();
    const res = await call(previewRequestOptions({ ip: "203.0.113.34" }));
    assertEqual(res.statusCode, 303, "preview handoff status");
    assertEqual(new URL(res.headers.location).host, "wa.me", "preview redirect host");
    assertNoSensitiveBody(res);
  });

  await test("Invalid sellerId is rejected", async () => {
    const res = await call({ body: { sellerId: "not-a-seller-id" } });
    assertEqual(res.statusCode, 400, "invalid sellerId status");
  });

  await test("Missing seller returns generic 404", async () => {
    const res = await call({ body: { sellerId: MISSING_SELLER } });
    assertEqual(res.statusCode, 404, "missing seller status");
    assertNoSensitiveBody(res);
  });

  await test("Inactive seller returns generic 404", async () => {
    const res = await call({ body: { sellerId: SELLER_B } });
    assertEqual(res.statusCode, 404, "inactive seller status");
    assertNoSensitiveBody(res);
  });

  await test("Seller without WhatsApp returns generic 404", async () => {
    const res = await call({ body: { sellerId: SELLER_C } });
    assertEqual(res.statusCode, 404, "no WhatsApp seller status");
    assertNoSensitiveBody(res);
  });

  await test("Active contactable seller returns 303", async () => {
    const res = await call({ body: { sellerId: SELLER_A, message: "Hello there" } });
    assertEqual(res.statusCode, 303, "contactable seller status");
  });

  await test("No override uses the fixture seller stored number", async () => {
    const res = await call({ ip: "203.0.113.21", body: { sellerId: SELLER_A } });
    assertEqual(res.statusCode, 303, "no override status");
    assert(redirectUses(res, FICTIONAL_NUMBER), "redirect should use stored fixture number");
  });

  await test("A valid override changes only the 303 redirect destination", async () => {
    process.env.CONTACT_SELLER_WHATSAPP_OVERRIDE = FICTIONAL_OVERRIDE;
    const before = JSON.stringify(mock.sellers.get(SELLER_A));
    const res = await call({ ip: "203.0.113.22", body: { sellerId: SELLER_A } });
    const after = JSON.stringify(mock.sellers.get(SELLER_A));
    assertEqual(res.statusCode, 303, "override status");
    assert(redirectUses(res, FICTIONAL_OVERRIDE), "redirect should use override number");
    assertEqual(after, before, "override should not modify seller row");
    resetEnv();
  });

  await test("Removing the override restores the fixture seller stored number", async () => {
    process.env.CONTACT_SELLER_WHATSAPP_OVERRIDE = FICTIONAL_OVERRIDE;
    await call({ ip: "203.0.113.23", body: { sellerId: SELLER_A } });
    resetEnv();
    const res = await call({ ip: "203.0.113.24", body: { sellerId: SELLER_A } });
    assert(redirectUses(res, FICTIONAL_NUMBER), "redirect should return to stored number");
  });

  await test("The override does not affect seller_directory output or hasWhatsApp", async () => {
    const before = JSON.stringify(mock.directoryRows);
    process.env.CONTACT_SELLER_WHATSAPP_OVERRIDE = FICTIONAL_OVERRIDE;
    await call({ ip: "203.0.113.25", body: { sellerId: SELLER_A } });
    const after = JSON.stringify(mock.directoryRows);
    assertEqual(after, before, "override should not modify directory rows");
    assertEqual(mock.directoryRows[0].hasWhatsApp, true, "contactable directory flag");
    assertEqual(mock.directoryRows[2].hasWhatsApp, false, "non-contactable directory flag");
    resetEnv();
  });

  await test("An invalid override fails closed", async () => {
    process.env.CONTACT_SELLER_WHATSAPP_OVERRIDE = "12345";
    const res = await call({ ip: "203.0.113.26", body: { sellerId: SELLER_A } });
    assertEqual(res.statusCode, 503, "invalid override status");
    assertNoSensitiveBody(res);
    resetEnv();
  });

  await test("Override does not make seller without WhatsApp contactable", async () => {
    process.env.CONTACT_SELLER_WHATSAPP_OVERRIDE = FICTIONAL_OVERRIDE;
    const res = await call({ ip: "203.0.113.27", body: { sellerId: SELLER_C } });
    assertEqual(res.statusCode, 404, "override without stored WhatsApp status");
    resetEnv();
  });

  await test("Redirect host is wa.me", async () => {
    const res = await call({ ip: "203.0.113.11", body: { sellerId: SELLER_A } });
    assertEqual(new URL(res.headers.location).host, "wa.me", "redirect host");
  });

  await test("Message is encoded correctly", async () => {
    const res = await call({ ip: "203.0.113.12", type: "form", body: { sellerId: SELLER_A, message: "2x curry & roti" } });
    assertEqual(new URL(res.headers.location).searchParams.get("text"), "2x curry & roti", "redirect message");
  });

  await test("Response body does not contain the number", async () => {
    const res = await call({ ip: "203.0.113.13", body: { sellerId: SELLER_A } });
    assertEqual(res.body, "", "redirect body");
  });

  await test("No unrestricted seller record is returned", async () => {
    const res = await call({ ip: "203.0.113.14", body: { sellerId: SELLER_A } });
    assert(!res.body.includes("active"), "body should not include seller active field");
  });

  await test("Missing CONTACT_RATE_LIMIT_SECRET fails closed", async () => {
    delete process.env.CONTACT_RATE_LIMIT_SECRET;
    const res = await call({ ip: "203.0.113.15", body: { sellerId: SELLER_A } });
    assertEqual(res.statusCode, 503, "missing secret status");
    resetEnv();
  });

  await test("Short-window rate limiting returns 429", async () => {
    process.env.CONTACT_RATE_LIMIT_SHORT_MAX = "1";
    await call({ ip: "203.0.113.16", body: { sellerId: SELLER_A } });
    const res = await call({ ip: "203.0.113.16", body: { sellerId: SELLER_A } });
    assertEqual(res.statusCode, 429, "short limit status");
    resetEnv();
  });

  await test("Daily rate limiting returns 429", async () => {
    process.env.CONTACT_RATE_LIMIT_DAILY_MAX = "1";
    await call({ ip: "203.0.113.17", body: { sellerId: SELLER_A } });
    const res = await call({ ip: "203.0.113.17", body: { sellerId: SELLER_A } });
    assertEqual(res.statusCode, 429, "daily limit status");
    resetEnv();
  });

  await test("Different fictional client hashes are counted separately", async () => {
    process.env.CONTACT_RATE_LIMIT_SHORT_MAX = "1";
    const a = await call({ ip: "203.0.113.18", body: { sellerId: SELLER_A } });
    const b = await call({ ip: "203.0.113.19", body: { sellerId: SELLER_A } });
    assertEqual(a.statusCode, 303, "first client status");
    assertEqual(b.statusCode, 303, "second client status");
    resetEnv();
  });

  await test("Rate-limit storage contains no raw private values", async () => {
    for (const key of mock.counters.keys()) {
      assert(!key.includes("203.0.113"), "counter key must not include raw IP");
      assert(!key.includes(FICTIONAL_NUMBER), "counter key must not include number");
      assert(!key.includes(FICTIONAL_OVERRIDE), "counter key must not include override number");
      assert(!key.includes("curry"), "counter key must not include message");
      assert(!key.includes("seller"), "counter key must not include seller data");
    }
  });

  await test("Nonexistent seller IDs consume rate-limit counts", async () => {
    process.env.CONTACT_RATE_LIMIT_SHORT_MAX = "1";
    const first = await call({ ip: "203.0.113.28", body: { sellerId: MISSING_SELLER } });
    const second = await call({ ip: "203.0.113.28", body: { sellerId: MISSING_SELLER } });
    assertEqual(first.statusCode, 404, "first nonexistent status");
    assertEqual(second.statusCode, 429, "second nonexistent status");
    resetEnv();
  });

  await test("Inactive sellers consume rate-limit counts", async () => {
    process.env.CONTACT_RATE_LIMIT_SHORT_MAX = "1";
    const first = await call({ ip: "203.0.113.29", body: { sellerId: SELLER_B } });
    const second = await call({ ip: "203.0.113.29", body: { sellerId: SELLER_B } });
    assertEqual(first.statusCode, 404, "first inactive status");
    assertEqual(second.statusCode, 429, "second inactive status");
    resetEnv();
  });

  await test("Sellers without WhatsApp consume rate-limit counts", async () => {
    process.env.CONTACT_RATE_LIMIT_SHORT_MAX = "1";
    const first = await call({ ip: "203.0.113.30", body: { sellerId: SELLER_C } });
    const second = await call({ ip: "203.0.113.30", body: { sellerId: SELLER_C } });
    assertEqual(first.statusCode, 404, "first no WhatsApp status");
    assertEqual(second.statusCode, 429, "second no WhatsApp status");
    resetEnv();
  });

  await test("Malformed but valid-length messages consume rate-limit counts", async () => {
    process.env.CONTACT_RATE_LIMIT_SHORT_MAX = "1";
    const message = "\u0000".repeat(20);
    const first = await call({ ip: "203.0.113.31", body: { sellerId: SELLER_A, message } });
    const second = await call({ ip: "203.0.113.31", body: { sellerId: SELLER_A, message } });
    assertEqual(first.statusCode, 303, "first malformed-message status");
    assertEqual(second.statusCode, 429, "second malformed-message status");
    resetEnv();
  });

  await test("Safe error responses contain no secrets", async () => {
    delete process.env.CONTACT_RATE_LIMIT_SECRET;
    const res = await call({ ip: "203.0.113.20", body: { sellerId: SELLER_A } });
    assertNoSensitiveBody(res);
    resetEnv();
  });

  await test("Service-role credentials are absent from frontend/generated files", async () => {
    const fs = require("node:fs");
    const path = require("node:path");
    const files = [
      "src/homemade-map-cleaned-1.html",
      "scripts/build-seo-pages.js",
      "public/index.html",
      "public/browse-sellers.html"
    ];
    for (const file of files) {
      if (!fs.existsSync(path.join(__dirname, "..", file))) continue;
      const text = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
      assert(!/SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY/.test(text), `${file} should not include service-role key names`);
    }
  });

  await test("Test output does not print destination numbers", async () => {
    const output = capturedOutput.join("\n");
    assert(!output.includes(FICTIONAL_NUMBER), "test output should not include stored destination");
    assert(!output.includes(FICTIONAL_OVERRIDE), "test output should not include override destination");
  });

  handler._test.setSupabaseFetch(null);
  console.log("");
  if (failures) {
    console.log(`${failures} contact handoff test(s) failed.`);
    process.exit(1);
  }
  console.log("All contact handoff tests passed.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
