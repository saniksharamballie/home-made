const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const crypto = require("node:crypto");

const BUCKET = "seller-draft-images";
const HOSTED_REFS = ["duekijsiofrmivnfulid", "yemdirpmtqzzduxtgfqh"];

function localTarget(urlValue) {
  let url;
  try { url = new URL(String(urlValue || "")); } catch { return null; }
  const hostname = url.hostname.toLowerCase();
  if (HOSTED_REFS.some((ref) => hostname.includes(ref))) return null;
  if (!["localhost", "127.0.0.1", "::1"].includes(hostname)) return null;
  return url.origin;
}

function blocked(message) {
  console.error(`BLOCKED: ${message}`);
  process.exitCode = 2;
}

async function request(base, path, options = {}) {
  const response = await fetch(`${base}${path}`, options);
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  return { status: response.status, ok: response.ok, data };
}

function serviceHeaders(serviceKey, extra = {}) {
  return { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", ...extra };
}

function userHeaders(anonKey, token, extra = {}) {
  return { apikey: anonKey, Authorization: `Bearer ${token}`, ...extra };
}

function objectPath(userId, sellerId, id = crypto.randomUUID()) {
  return `drafts/${userId}/${sellerId}/${id}.webp`;
}

function encoded(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

async function main() {
  if (process.env.HM_LOCAL_STORAGE_RLS_TEST !== "1") {
    blocked("set HM_LOCAL_STORAGE_RLS_TEST=1 to run the disposable local-only suite");
    return;
  }
  if (process.env.HM_LOCAL_STORAGE_RLS_RESET !== "1") {
    blocked("set HM_LOCAL_STORAGE_RLS_RESET=1 to permit a disposable local database reset");
    return;
  }
  const base = localTarget(process.env.SUPABASE_LOCAL_URL || process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (!base) {
    blocked("Supabase URL must be localhost or loopback; hosted projects are forbidden");
    return;
  }
  const anonKey = process.env.SUPABASE_LOCAL_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!anonKey || !serviceKey) {
    blocked("local anonymous and service credentials are required");
    return;
  }

  const cli = process.platform === "win32" ? "supabase.cmd" : "supabase";
  const reset = spawnSync(cli, ["db", "reset", "--local", "--yes"], { cwd: process.cwd(), stdio: "ignore" });
  if (reset.status !== 0) {
    blocked("disposable local Supabase reset is unavailable");
    return;
  }

  const bucket = await request(base, `/storage/v1/bucket/${BUCKET}`, { headers: serviceHeaders(serviceKey) });
  if (!bucket.ok || bucket.data && bucket.data.public !== false) {
    blocked("private draft image migration is not active in the disposable local stack");
    return;
  }
  const publicBefore = await request(base, "/storage/v1/bucket/seller-images", { headers: serviceHeaders(serviceKey) });
  const suffix = crypto.randomUUID().slice(0, 8);
  const password = `Local-${crypto.randomUUID()}-Aa1!`;
  const fixtures = [];
  const paths = [];

  async function createFixture(label, active) {
    const email = `rls-${label}-${suffix}@local.invalid`;
    const created = await request(base, "/auth/v1/admin/users", {
      method: "POST",
      headers: serviceHeaders(serviceKey),
      body: JSON.stringify({ email, password, email_confirm: true })
    });
    assert.equal(created.ok, true, "local auth fixture creation failed");
    const userId = created.data.id;
    const seller = await request(base, "/rest/v1/sellers?select=id", {
      method: "POST",
      headers: serviceHeaders(serviceKey, { Prefer: "return=representation" }),
      body: JSON.stringify({ auth_id: userId, name: `Local ${label}`, active, data: {} })
    });
    assert.equal(seller.ok, true, "local seller fixture creation failed");
    const session = await request(base, "/auth/v1/token?grant_type=password", {
      method: "POST",
      headers: { apikey: anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    assert.equal(session.ok, true, "local auth fixture sign-in failed");
    const fixture = { userId, sellerId: seller.data[0].id, token: session.data.access_token };
    fixtures.push(fixture);
    return fixture;
  }

  async function upload(fixture, path, upsert = false) {
    return request(base, `/storage/v1/object/${BUCKET}/${encoded(path)}`, {
      method: "POST",
      headers: userHeaders(anonKey, fixture.token, { "Content-Type": "image/webp", "x-upsert": String(upsert) }),
      body: Buffer.from("RIFF0000WEBPVP8 ")
    });
  }
  async function read(fixture, path) {
    return request(base, `/storage/v1/object/authenticated/${BUCKET}/${encoded(path)}`, {
      headers: userHeaders(anonKey, fixture.token)
    });
  }
  async function remove(fixture, path) {
    return request(base, `/storage/v1/object/${BUCKET}`, {
      method: "DELETE",
      headers: userHeaders(anonKey, fixture.token, { "Content-Type": "application/json" }),
      body: JSON.stringify({ prefixes: [path] })
    });
  }

  try {
    const sellerA = await createFixture("a", false);
    const sellerB = await createFixture("b", false);
    const activeSeller = await createFixture("active", false);
    const pathA = objectPath(sellerA.userId, sellerA.sellerId);
    const pathB = objectPath(sellerB.userId, sellerB.sellerId);
    const activePath = objectPath(activeSeller.userId, activeSeller.sellerId);
    paths.push(pathA, pathB, activePath);

    const anonRead = await request(base, `/storage/v1/object/authenticated/${BUCKET}/${encoded(pathA)}`, { headers: { apikey: anonKey } });
    assert.equal(anonRead.ok, false);
    const unauthInsert = await request(base, `/storage/v1/object/${BUCKET}/${encoded(pathA)}`, {
      method: "POST", headers: { apikey: anonKey, "Content-Type": "image/webp" }, body: Buffer.from("RIFF0000WEBPVP8 ")
    });
    assert.equal(unauthInsert.ok, false);

    assert.equal((await upload(sellerA, pathA)).ok, true);
    assert.equal((await read(sellerA, pathA)).ok, true);
    assert.equal((await upload(sellerA, pathA, true)).ok, false);
    assert.equal((await upload(sellerB, pathB)).ok, true);
    assert.equal((await read(sellerA, pathB)).ok, false);
    assert.equal((await upload(sellerA, pathB)).ok, false);
    assert.equal((await remove(sellerA, pathB)).ok, false);

    for (const invalidPath of [
      "malformed",
      `${pathA}/extra`,
      pathA.replace(/^drafts\//, "wrong/"),
      pathA.replace(/[0-9a-f-]{36}\.webp$/, "not-a-uuid.webp")
    ]) assert.equal((await upload(sellerA, invalidPath)).ok, false);

    assert.equal((await upload(activeSeller, activePath)).ok, true);
    const activated = await request(base, `/rest/v1/sellers?id=eq.${activeSeller.sellerId}`, {
      method: "PATCH",
      headers: serviceHeaders(serviceKey),
      body: JSON.stringify({ active: true })
    });
    assert.equal(activated.ok, true);
    assert.equal((await upload(activeSeller, objectPath(activeSeller.userId, activeSeller.sellerId))).ok, false);
    assert.equal((await read(activeSeller, activePath)).ok, true);
    assert.equal((await remove(activeSeller, activePath)).ok, true);
    assert.equal((await remove(sellerA, pathA)).ok, true);
  } finally {
    if (paths.length) {
      await request(base, `/storage/v1/object/${BUCKET}`, {
        method: "DELETE",
        headers: serviceHeaders(serviceKey),
        body: JSON.stringify({ prefixes: paths })
      });
    }
    for (const fixture of fixtures) {
      await request(base, `/rest/v1/sellers?auth_id=eq.${fixture.userId}`, { method: "DELETE", headers: serviceHeaders(serviceKey) });
      await request(base, `/auth/v1/admin/users/${fixture.userId}`, { method: "DELETE", headers: serviceHeaders(serviceKey) });
    }
  }

  const publicAfter = await request(base, "/storage/v1/bucket/seller-images", { headers: serviceHeaders(serviceKey) });
  assert.deepEqual(
    publicAfter.data && { id: publicAfter.data.id, public: publicAfter.data.public },
    publicBefore.data && { id: publicBefore.data.id, public: publicBefore.data.public }
  );
  console.log("Local Storage RLS integration tests passed.");
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Local Storage RLS integration failed: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = { localTarget, objectPath };
