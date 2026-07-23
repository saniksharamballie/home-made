const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const externalSource = fs.readFileSync(path.join(root, "public", "sw.js"), "utf8");
const appSource = fs.readFileSync(path.join(root, "src", "homemade-map-cleaned-1.html"), "utf8");

function inlineWorkerSource() {
  const marker = "var swCode = [";
  const start = appSource.indexOf(marker);
  assert.notEqual(start, -1, "Inline service-worker source was not found");
  const expressionStart = appSource.indexOf("[", start);
  const expressionEnd = appSource.indexOf("].join('\\n');", expressionStart);
  assert.notEqual(expressionEnd, -1, "Inline service-worker source did not close");
  return vm.runInNewContext(appSource.slice(expressionStart, expressionEnd + "].join('\\n')".length));
}

function workerHarness(source) {
  const listeners = {};
  const calls = { fetch: 0, match: 0, put: 0, deleted: [] };
  const response = { ok: true, status: 200, type: "basic", clone() { return this; } };
  const cache = {
    addAll() { return Promise.resolve(); },
    match() { calls.match += 1; return Promise.resolve(null); },
    put() { calls.put += 1; return Promise.resolve(); }
  };
  const context = vm.createContext({
    URL,
    Promise,
    console: { log() {}, info() {}, warn() {}, error() {} },
    fetch() { calls.fetch += 1; return Promise.resolve(response); },
    caches: {
      open() { return Promise.resolve(cache); },
      match() { calls.match += 1; return Promise.resolve(null); },
      keys() {
        return Promise.resolve([
          "hm-prod-v66-shell",
          "hm-prod-v66-runtime",
          "hm-v65-img",
          "hm-prod-v67-shell",
          "hm-prod-v67-runtime",
          "unrelated-cache"
        ]);
      },
      delete(name) { calls.deleted.push(name); return Promise.resolve(true); }
    },
    self: {
      location: { origin: "https://app.example" },
      clients: { claim() { return Promise.resolve(); } },
      skipWaiting() { return Promise.resolve(); },
      addEventListener(name, handler) { listeners[name] = handler; }
    }
  });
  vm.runInContext(source, context, { filename: "service-worker-under-test.js" });

  function request(url, options = {}) {
    const headers = new Set((options.headers || []).map((value) => value.toLowerCase()));
    return {
      url,
      method: options.method || "GET",
      mode: options.mode || "cors",
      destination: options.destination || "",
      credentials: options.credentials || "same-origin",
      headers: { has(name) { return headers.has(String(name).toLowerCase()); } }
    };
  }

  async function dispatch(req) {
    const before = { fetch: calls.fetch, match: calls.match, put: calls.put };
    let responsePromise = null;
    listeners.fetch({ request: req, respondWith(value) { responsePromise = Promise.resolve(value); } });
    assert.ok(responsePromise, "Fetch handler must provide a response");
    await responsePromise;
    await Promise.resolve();
    return {
      fetch: calls.fetch - before.fetch,
      match: calls.match - before.match,
      put: calls.put - before.put
    };
  }

  async function activate() {
    let work = null;
    listeners.activate({ waitUntil(value) { work = Promise.resolve(value); } });
    await work;
  }

  return { calls, request, dispatch, activate };
}

async function assertNetworkOnly(harness, request, label) {
  const delta = await harness.dispatch(request);
  assert.equal(delta.fetch, 1, `${label} must use the network`);
  assert.equal(delta.match, 0, `${label} must not read Cache Storage`);
  assert.equal(delta.put, 0, `${label} must not write Cache Storage`);
}

async function runPolicySuite(source, label) {
  const harness = workerHarness(source);
  await assertNetworkOnly(harness, harness.request("https://project.supabase.co/rest/v1/sellers"), `${label} Supabase REST`);
  await assertNetworkOnly(harness, harness.request("https://project.supabase.co/auth/v1/user"), `${label} Supabase Auth`);
  await assertNetworkOnly(harness, harness.request("https://project.supabase.co/storage/v1/object/listing"), `${label} Supabase Storage`);
  await assertNetworkOnly(harness, harness.request("https://app.example/private", { headers: ["Authorization"] }), `${label} Authorization`);
  await assertNetworkOnly(harness, harness.request("https://app.example/private", { headers: ["apikey"] }), `${label} apikey`);
  await assertNetworkOnly(harness, harness.request("https://app.example/api/account", { headers: ["Authorization"] }), `${label} authenticated API`);
  await assertNetworkOnly(harness, harness.request("https://app.example/api/contact-seller"), `${label} contact API`);
  await assertNetworkOnly(harness, harness.request("https://app.example/api/draft", { method: "PATCH" }), `${label} mutation`);
  await assertNetworkOnly(harness, harness.request("https://app.example/auth/callback?code=redacted"), `${label} auth callback`);
  await assertNetworkOnly(harness, harness.request("https://cdn.example/public.jpg", { destination: "image" }), `${label} cross-origin asset`);
  await assertNetworkOnly(harness, harness.request("https://app.example/account.json"), `${label} unclassified JSON`);

  const staticDelta = await harness.dispatch(harness.request("https://app.example/images/empty-plate.png", { destination: "image" }));
  assert.equal(staticDelta.match > 0, true, `${label} public static asset may read cache`);
  assert.equal(staticDelta.put > 0, true, `${label} public static asset may populate cache`);
}

(async () => {
  const inlineSource = inlineWorkerSource();
  const externalVersion = /const VERSION = "(hm-prod-v\d+)"/.exec(externalSource);
  const inlineVersion = /var SV="(hm-prod-v\d+)"/.exec(inlineSource);
  assert.ok(externalVersion && inlineVersion);
  assert.equal(externalVersion[1], "hm-prod-v67");
  assert.equal(inlineVersion[1], externalVersion[1], "Both service workers must share the cache version");

  await runPolicySuite(externalSource, "external");
  await runPolicySuite(inlineSource, "inline");

  const activation = workerHarness(externalSource);
  await activation.activate();
  assert.deepEqual(activation.calls.deleted.sort(), [
    "hm-prod-v66-runtime",
    "hm-prod-v66-shell",
    "hm-v65-img"
  ]);
  assert.equal(activation.calls.deleted.includes("unrelated-cache"), false);

  console.log("Service-worker private-cache tests passed.");
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
