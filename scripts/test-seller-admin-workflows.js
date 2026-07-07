const { spawn, spawnSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const CONFIG_PATH = path.join(ROOT, "supabase", "config.toml");
const DEFAULT_LOCAL_URL = "http://127.0.0.1:54321";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const LOCAL_JWT_SECRET = "super-secret-jwt-token-with-at-least-32-characters-long";
const PASSWORD = "HomeMadeWorkflow!2026";
const PRIVATE_PROBE_KEYS = ["bankAccount", "exactAddress", "sellerDob", "idNumber", "payfastPassphrase"];

let failures = 0;
let cleanupNeeded = false;

function readProjectId() {
  const config = fs.readFileSync(CONFIG_PATH, "utf8");
  const match = config.match(/^\s*project_id\s*=\s*"([^"]+)"/m);
  if (!match) throw new Error(`Could not find project_id in ${CONFIG_PATH}`);
  return match[1];
}

function assertLocalHost(value, label) {
  if (!value) return;
  let host = value;
  try {
    host = new URL(value).hostname;
  } catch (_) {
    const dbUrlMatch = value.match(/^[a-z][a-z0-9+.-]*:\/\/[^@/]+@([^:/?]+)(?::\d+)?/i);
    if (dbUrlMatch) host = dbUrlMatch[1];
  }
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(`${label} must point to localhost or 127.0.0.1, got ${value}`);
  }
}

function checkRemoteRefusal() {
  for (const name of [
    "SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_DB_URL",
    "DATABASE_URL",
    "POSTGRES_URL"
  ]) {
    if (process.env[name]) assertLocalHost(process.env[name], name);
  }

  const url = process.env.LOCAL_SUPABASE_URL
    || process.env.SUPABASE_URL
    || process.env.NEXT_PUBLIC_SUPABASE_URL
    || DEFAULT_LOCAL_URL;
  assertLocalHost(url, "Supabase URL");
  return url.replace(/\/$/, "");
}

function base64url(input) {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function signJwt(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const body = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signature = crypto.createHmac("sha256", secret).update(body).digest("base64")
    .replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${body}.${signature}`;
}

function generatedLocalKey(projectId, role) {
  const now = Math.floor(Date.now() / 1000);
  return signJwt({
    iss: "supabase",
    ref: projectId,
    role,
    iat: now - 60,
    exp: now + 60 * 60
  }, LOCAL_JWT_SECRET);
}

function statusEnvValue(name) {
  const result = spawnSync("supabase", ["status", "-o", "env"], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 5000
  });
  if (result.status !== 0) return "";
  const match = (result.stdout || "").match(new RegExp(`(?:^|\\n)(?:${name})=("?)([^\\r\\n"]+)\\1`));
  return match ? match[2].trim() : "";
}

function anonKey(projectId) {
  return process.env.LOCAL_SUPABASE_ANON_KEY
    || statusEnvValue("ANON_KEY|SUPABASE_ANON_KEY|NEXT_PUBLIC_SUPABASE_ANON_KEY")
    || generatedLocalKey(projectId, "anon");
}

function serviceRoleKey(projectId) {
  return process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY
    || statusEnvValue("SERVICE_ROLE_KEY|SUPABASE_SERVICE_ROLE_KEY")
    || generatedLocalKey(projectId, "service_role");
}

function dockerContainer(projectId) {
  return process.env.LOCAL_SUPABASE_CONTAINER || `supabase_db_${projectId}`;
}

function runSql(sql, projectId) {
  return new Promise((resolve, reject) => {
    const child = spawn("docker", [
      "exec",
      "-i",
      dockerContainer(projectId),
      "psql",
      "-X",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      "postgres",
      "-d",
      "postgres",
      "--tuples-only",
      "--no-align"
    ], { cwd: ROOT });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error((stderr || stdout || `psql exited with ${code}`).trim()));
    });
    child.stdin.end(sql);
  });
}

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function request(url, key, pathName, options = {}) {
  const headers = {
    apikey: options.apiKey || key,
    Authorization: `Bearer ${options.bearer || key}`,
    "Content-Type": "application/json",
    Prefer: options.prefer === undefined ? "return=representation" : options.prefer
  };
  const response = await fetch(`${url}${pathName}`, {
    method: options.method || "GET",
    headers: { ...headers, ...(options.headers || {}) },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (_) {
      data = text;
    }
  }
  return { status: response.status, ok: response.ok, data, text };
}

async function serviceRequest(ctx, pathName, options = {}) {
  return request(ctx.url, ctx.serviceKey, pathName, { ...options, apiKey: ctx.serviceKey, bearer: ctx.serviceKey });
}

async function userRequest(ctx, account, pathName, options = {}) {
  return request(ctx.url, ctx.anonKey, pathName, { ...options, apiKey: ctx.anonKey, bearer: account.accessToken });
}

async function anonRequest(ctx, pathName, options = {}) {
  return request(ctx.url, ctx.anonKey, pathName, { ...options, apiKey: ctx.anonKey, bearer: ctx.anonKey });
}

async function rpc(ctx, account, name, args) {
  return userRequest(ctx, account, `/rest/v1/rpc/${name}`, {
    method: "POST",
    body: args || {}
  });
}

async function sqlRows(ctx, selectSql) {
  const out = await runSql(`
    select coalesce(json_agg(row_to_json(t)), '[]'::json)::text
    from (${selectSql}) t;
  `, ctx.projectId);
  return JSON.parse(out || "[]");
}

async function sellerById(ctx, sellerId) {
  const rows = await sqlRows(ctx, `
    select id, auth_id, email, name, seller, region, category, tier, wa, active, data
    from public.sellers
    where id = ${Number(sellerId)}
  `);
  return rows[0] || null;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) throw new Error(`${message}: expected ${expected}, got ${actual}`);
}

function assertOk(response, message) {
  assert(response.ok, `${message}: HTTP ${response.status} ${String(response.text).slice(0, 300)}`);
}

function assertRejected(response, message) {
  assert(!response.ok, `${message}: expected rejection, got HTTP ${response.status}`);
}

async function test(name, fn) {
  try {
    await fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures += 1;
    console.log(`FAIL ${name}`);
    console.log(`  ${error.message}`);
  }
}

async function createAuthUser(ctx, email, displayName) {
  const response = await serviceRequest(ctx, "/auth/v1/admin/users", {
    method: "POST",
    body: {
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: displayName }
    }
  });
  assertOk(response, `create auth user ${email}`);
  return response.data;
}

async function signIn(ctx, email) {
  const response = await request(ctx.url, ctx.anonKey, "/auth/v1/token?grant_type=password", {
    method: "POST",
    apiKey: ctx.anonKey,
    bearer: ctx.anonKey,
    body: { email, password: PASSWORD }
  });
  assertOk(response, `sign in ${email}`);
  return response.data.access_token;
}

async function setProfileRole(ctx, user, role, displayName) {
  await runSql(`
    insert into public.profiles (id, email, display_name, role)
    values (${sqlString(user.id)}::uuid, ${sqlString(user.email)}, ${sqlString(displayName)}, ${sqlString(role)})
    on conflict (id) do update
    set email = excluded.email,
        display_name = excluded.display_name,
        role = excluded.role,
        updated_at = now();
  `, ctx.projectId);
}

async function createSeller(ctx, account, suffix, extra = {}) {
  const data = {
    hmWorkflowRun: ctx.runId,
    desc: `Workflow seller ${suffix}`,
    items: [{ n: `Workflow Meal ${suffix}`, p: 75, svs: "1 person" }],
    ...extra
  };
  const out = await runSql(`
    insert into public.sellers (auth_id, email, name, seller, region, category, tier, wa, lat, lng, active, data)
    values (
      ${sqlString(account.id)}::uuid,
      ${sqlString(account.email)},
      ${sqlString(`HM Workflow Seller ${suffix} ${ctx.runId}`)},
      ${sqlString(`Workflow ${suffix}`)},
      'Durban CBD',
      'african',
      'standard',
      '27820009999',
      -29.8587,
      31.0218,
      true,
      ${sqlString(JSON.stringify(data))}::jsonb
    )
    returning id;
  `, ctx.projectId);
  const idMatch = String(out).match(/\d+/);
  assert(idMatch, `seller ${suffix} insert should return an id`);
  return sellerById(ctx, idMatch[0]);
}

async function cleanup(ctx) {
  try {
    await runSql(`
      delete from public.sellers
      where data->>'hmWorkflowRun' = ${sqlString(ctx.runId)}
         or lower(coalesce(email, '')) like ${sqlString(`hm.workflow.%${ctx.runId}%@example.test`)};

      delete from public.seller_access_requests
      where notes like ${sqlString(`%${ctx.runId}%`)}
         or user_id in (
           select id from auth.users where lower(coalesce(email, '')) like ${sqlString(`hm.workflow.%${ctx.runId}%@example.test`)}
         );

      delete from public.buyers
      where lower(coalesce(email, '')) like ${sqlString(`hm.workflow.%${ctx.runId}%@example.test`)};

      delete from public.profiles
      where lower(coalesce(email, '')) like ${sqlString(`hm.workflow.%${ctx.runId}%@example.test`)};

      delete from auth.users
      where lower(coalesce(email, '')) like ${sqlString(`hm.workflow.%${ctx.runId}%@example.test`)};
    `, ctx.projectId);
    cleanupNeeded = false;
    console.log("Cleanup succeeded for fictional workflow records.");
  } catch (error) {
    console.log(`Cleanup failed: ${error.message}`);
    console.log("Run supabase db reset before rerunning the workflow tests.");
  }
}

async function setup(ctx) {
  const names = {
    normal: "Normal Workflow User",
    sellerA: "Workflow Seller Owner A",
    sellerB: "Workflow Seller Owner B",
    admin: "Workflow Admin User"
  };
  const accounts = {};
  for (const key of Object.keys(names)) {
    const email = `hm.workflow.${key.toLowerCase()}.${ctx.runId}@example.test`;
    const user = await createAuthUser(ctx, email, names[key]);
    await setProfileRole(ctx, user, key === "admin" ? "admin" : key.startsWith("seller") ? "seller" : "buyer", names[key]);
    user.accessToken = await signIn(ctx, email);
    accounts[key] = user;
  }

  const sellerA = await createSeller(ctx, accounts.sellerA, "A");
  const sellerB = await createSeller(ctx, accounts.sellerB, "B");
  return { accounts, sellerA, sellerB };
}

async function main() {
  const projectId = readProjectId();
  const url = checkRemoteRefusal();
  const ctx = {
    projectId,
    url,
    anonKey: anonKey(projectId),
    serviceKey: serviceRoleKey(projectId),
    runId: `${Date.now().toString(36)}${crypto.randomBytes(3).toString("hex")}`
  };

  console.log("Home-Made Supabase local seller/admin workflow tests");
  console.log(`Supabase URL: ${ctx.url}`);
  console.log(`Database container: ${dockerContainer(projectId)}`);
  console.log(`Run id: ${ctx.runId}`);
  console.log("");

  let state;
  try {
    state = await setup(ctx);
    cleanupNeeded = true;
  } catch (error) {
    console.error("FAIL test runner setup");
    console.error(`  ${error.message}`);
    process.exit(1);
  }

  const { accounts } = state;
  let approvedSellerId = null;
  let requestId = null;

  await test("seller owner A can read seller A raw row", async () => {
    const res = await userRequest(ctx, accounts.sellerA, `/rest/v1/sellers?select=*&id=eq.${state.sellerA.id}`);
    assertOk(res, "seller A select own row");
    assertEqual(res.data.length, 1, "seller A own row count");
  });

  await test("seller owner A cannot read seller B raw row", async () => {
    const res = await userRequest(ctx, accounts.sellerA, `/rest/v1/sellers?select=*&id=eq.${state.sellerB.id}`);
    assertOk(res, "seller A select seller B row");
    assertEqual(res.data.length, 0, "seller A visible seller B row count");
  });

  await test("seller owner B cannot read seller A raw row", async () => {
    const res = await userRequest(ctx, accounts.sellerB, `/rest/v1/sellers?select=*&id=eq.${state.sellerA.id}`);
    assertOk(res, "seller B select seller A row");
    assertEqual(res.data.length, 0, "seller B visible seller A row count");
  });

  await test("seller owner A can update seller A permitted data", async () => {
    const res = await userRequest(ctx, accounts.sellerA, `/rest/v1/sellers?id=eq.${state.sellerA.id}`, {
      method: "PATCH",
      body: {
        data: {
          hmWorkflowRun: ctx.runId,
          desc: "Seller A owner update with private probes",
          bankAccount: "FICTIONAL-BANK-ACCOUNT",
          exactAddress: "FICTIONAL-PRIVATE-ADDRESS",
          sellerDob: "1990-01-01",
          idNumber: "FICTIONAL-ID-NUMBER",
          payfastPassphrase: "FICTIONAL-PASSPHRASE",
          items: [{ n: "Updated Workflow Meal A", p: 88, svs: "1 person" }]
        }
      }
    });
    assertOk(res, "seller A update own row");
    assertEqual(res.data.length, 1, "updated seller A rows");
  });

  await test("seller owner A cannot update seller B row", async () => {
    const before = await sellerById(ctx, state.sellerB.id);
    const res = await userRequest(ctx, accounts.sellerA, `/rest/v1/sellers?id=eq.${state.sellerB.id}`, {
      method: "PATCH",
      body: { name: "Wrong Owner Update" }
    });
    assertOk(res, "seller A attempted update seller B row");
    assertEqual(res.data.length, 0, "seller A affected seller B rows");
    const after = await sellerById(ctx, state.sellerB.id);
    assertEqual(after.name, before.name, "seller B name unchanged");
  });

  await test("normal authenticated user cannot insert a seller row", async () => {
    const res = await userRequest(ctx, accounts.normal, "/rest/v1/sellers", {
      method: "POST",
      body: {
        auth_id: accounts.normal.id,
        email: accounts.normal.email,
        name: "Unauthorized Workflow Seller",
        data: { hmWorkflowRun: ctx.runId },
        active: true
      }
    });
    assertRejected(res, "normal user insert seller");
  });

  await test("normal authenticated user cannot successfully call admin RPCs", async () => {
    const list = await rpc(ctx, accounts.normal, "home_made_admin_accounts", {});
    const update = await rpc(ctx, accounts.normal, "home_made_admin_update_account", {
      target_user_id: accounts.sellerA.id,
      new_role: "seller",
      seller_tier: "gold"
    });
    assertRejected(list, "normal user admin accounts RPC");
    assertRejected(update, "normal user admin update RPC");
  });

  await test("seller owner cannot successfully call admin RPCs", async () => {
    const list = await rpc(ctx, accounts.sellerA, "home_made_admin_seller_access_requests", {});
    const update = await rpc(ctx, accounts.sellerA, "home_made_admin_update_account", {
      target_user_id: accounts.sellerA.id,
      new_role: "seller",
      seller_tier: "platinum"
    });
    assertRejected(list, "seller user admin request list RPC");
    assertRejected(update, "seller user admin update RPC");
  });

  await test("authenticated user can create own seller access request", async () => {
    const res = await userRequest(ctx, accounts.normal, "/rest/v1/seller_access_requests", {
      method: "POST",
      body: {
        user_id: accounts.normal.id,
        name: `Workflow Request ${ctx.runId}`,
        notes: `Workflow request notes ${ctx.runId}`,
        role: "buyer",
        display_name: "Normal Workflow User",
        status: "pending"
      }
    });
    assertOk(res, "normal user create own seller access request");
    requestId = res.data[0].id;
    assert(requestId, "request id should be returned");
  });

  await test("authenticated user cannot create request for another auth user", async () => {
    const res = await userRequest(ctx, accounts.normal, "/rest/v1/seller_access_requests", {
      method: "POST",
      body: {
        user_id: accounts.sellerA.id,
        name: `Wrong User Request ${ctx.runId}`,
        notes: `Wrong user request notes ${ctx.runId}`,
        role: "buyer",
        display_name: "Wrong User",
        status: "pending"
      }
    });
    assertRejected(res, "normal user create request for another user");
  });

  await test("admin can list seller access requests", async () => {
    const res = await rpc(ctx, accounts.admin, "home_made_admin_seller_access_requests", {});
    assertOk(res, "admin list seller access requests");
    assert((res.data || []).some((row) => row.id === requestId), "admin list should include workflow request");
  });

  await test("admin can approve intended request through RPC", async () => {
    const res = await rpc(ctx, accounts.admin, "home_made_approve_seller_access_request", {
      request_id: requestId,
      seller_name: `Approved Workflow Seller ${ctx.runId}`,
      seller_region: "Durban CBD",
      seller_category: "street",
      seller_whatsapp: "27820001111",
      existing_seller_id: null,
      admin_note: `Approved workflow request ${ctx.runId}`
    });
    assertOk(res, "admin approve seller access request");
    assert(res.data && res.data.ok === true, "approval should return ok true");
    approvedSellerId = res.data.seller_id;
    assert(approvedSellerId, "approval should return seller_id");
  });

  await test("approval creates or links correct seller row", async () => {
    const seller = await sellerById(ctx, approvedSellerId);
    assert(seller, "approved seller row should exist");
    assertEqual(seller.auth_id, accounts.normal.id, "approved seller auth_id");
    assertEqual(seller.active, true, "approved seller active");
  });

  await test("approval does not link seller row to wrong user", async () => {
    const seller = await sellerById(ctx, approvedSellerId);
    assert(seller, "approved seller row should exist");
    assert(seller.auth_id !== accounts.sellerA.id, "approved seller must not link to seller A");
    assert(seller.auth_id !== accounts.sellerB.id, "approved seller must not link to seller B");
  });

  await test("approved seller can read newly linked raw seller row", async () => {
    accounts.normal.accessToken = await signIn(ctx, accounts.normal.email);
    const res = await userRequest(ctx, accounts.normal, `/rest/v1/sellers?select=*&id=eq.${approvedSellerId}`);
    assertOk(res, "approved seller read linked row");
    assertEqual(res.data.length, 1, "approved seller visible linked rows");
  });

  await test("admin can update seller tier and promotion metadata through RPC", async () => {
    const promotionUntil = new Date(Date.now() + 7 * 86400000).toISOString();
    const res = await rpc(ctx, accounts.admin, "home_made_admin_update_account", {
      target_user_id: accounts.normal.id,
      new_role: "seller",
      seller_tier: "platinum",
      target_seller_id: approvedSellerId,
      seller_active: true,
      promotion_until: promotionUntil,
      promotion_permanent: false
    });
    assertOk(res, "admin update seller tier and promotion");
    const seller = await sellerById(ctx, approvedSellerId);
    assert(seller, "updated seller row should exist");
    assertEqual(seller.tier, "platinum", "updated seller tier");
    assertEqual(seller.data.adminTier, "platinum", "admin tier metadata");
    assertEqual(seller.data.adminTierPermanent, false, "admin promotion permanent metadata");
  });

  await test("non-admin cannot update tier or promotion metadata through admin RPC", async () => {
    const res = await rpc(ctx, accounts.sellerA, "home_made_admin_update_account", {
      target_user_id: accounts.normal.id,
      new_role: "seller",
      seller_tier: "gold",
      target_seller_id: approvedSellerId,
      seller_active: true,
      promotion_until: new Date(Date.now() + 3 * 86400000).toISOString(),
      promotion_permanent: false
    });
    assertRejected(res, "non-admin update tier promotion RPC");
  });

  await test("seller updates containing private probe keys remain private in seller_directory", async () => {
    const res = await anonRequest(ctx, `/rest/v1/seller_directory?select=id,data&id=eq.${state.sellerA.id}`);
    assertOk(res, "anon read seller directory private probe check");
    assertEqual(res.data.length, 1, "seller A directory row count");
    const json = JSON.stringify(res.data[0].data || {});
    for (const key of PRIVATE_PROBE_KEYS) {
      assert(!json.includes(key), `seller_directory should not include ${key}`);
    }
  });

  await test("public seller_directory includes active workflow sellers", async () => {
    const res = await anonRequest(ctx, `/rest/v1/seller_directory?select=id&id=eq.${state.sellerA.id}`);
    assertOk(res, "anon seller_directory active seller A");
    assertEqual(res.data.length, 1, "active seller A directory row count");
  });

  await test("seller owner can still read own wa through protected sellers access", async () => {
    const res = await userRequest(ctx, accounts.sellerA, `/rest/v1/sellers?select=id,wa&id=eq.${state.sellerA.id}`);
    assertOk(res, "seller owner protected wa read");
    assertEqual(res.data.length, 1, "seller owner wa row count");
    assertEqual(res.data[0].wa, "27820009999", "seller owner wa value");
  });

  await test("unrelated authenticated user cannot read another seller wa", async () => {
    const res = await userRequest(ctx, accounts.normal, `/rest/v1/sellers?select=id,wa&id=eq.${state.sellerA.id}`);
    assertOk(res, "unrelated user protected seller read");
    assertEqual(res.data.length, 0, "unrelated user seller row count");
  });

  await test("seller owner cannot read another seller wa", async () => {
    const res = await userRequest(ctx, accounts.sellerA, `/rest/v1/sellers?select=id,wa&id=eq.${state.sellerB.id}`);
    assertOk(res, "seller owner protected other-seller wa read");
    assertEqual(res.data.length, 0, "other seller wa row count");
  });

  await test("admin can still read seller wa through protected sellers access", async () => {
    const res = await userRequest(ctx, accounts.admin, `/rest/v1/sellers?select=id,wa&id=eq.${state.sellerA.id}`);
    assertOk(res, "admin protected wa read");
    assertEqual(res.data.length, 1, "admin wa row count");
    assertEqual(res.data[0].wa, "27820009999", "admin wa value");
  });

  await test("public seller_directory excludes inactive workflow sellers", async () => {
    await runSql(`update public.sellers set active = false, updated_at = now() where id = ${Number(state.sellerB.id)};`, ctx.projectId);
    const res = await anonRequest(ctx, `/rest/v1/seller_directory?select=id&id=eq.${state.sellerB.id}`);
    assertOk(res, "anon seller_directory inactive seller B");
    assertEqual(res.data.length, 0, "inactive seller B directory row count");
  });

  await test("no workflow requires authenticated forbidden sellers-table privileges", async () => {
    const out = await runSql(`
      select not (
        has_table_privilege('authenticated', 'public.sellers', 'delete')
        or has_table_privilege('authenticated', 'public.sellers', 'truncate')
        or has_table_privilege('authenticated', 'public.sellers', 'references')
        or has_table_privilege('authenticated', 'public.sellers', 'trigger')
        or has_table_privilege('authenticated', 'public.sellers', 'maintain')
      );
    `, projectId);
    assertEqual(out, "t", "authenticated forbidden seller privileges");
  });

  await test("admin delete preserves and deactivates seller row", async () => {
    const confirm = `DELETE ${accounts.normal.email}`;
    const res = await rpc(ctx, accounts.admin, "home_made_admin_delete_account", {
      target_user_id: accounts.normal.id,
      delete_confirm: confirm
    });
    assertOk(res, "admin delete account RPC");

    const seller = await sellerById(ctx, approvedSellerId);
    assert(seller, "seller row still physically exists");
    assertEqual(seller.auth_id, null, "seller auth_id after admin delete");
    assertEqual(seller.active, false, "seller active after admin delete");

    const directory = await anonRequest(ctx, `/rest/v1/seller_directory?select=id&id=eq.${approvedSellerId}`);
    assertOk(directory, "anon seller_directory after admin delete");
    assertEqual(directory.data.length, 0, "deleted account seller absent from seller_directory");
  });

  await test("admin delete removes related account records as currently implemented", async () => {
    const profile = await sqlRows(ctx, `select id from public.profiles where id = ${sqlString(accounts.normal.id)}::uuid`);
    const buyer = await sqlRows(ctx, `select id from public.buyers where auth_id = ${sqlString(accounts.normal.id)}::uuid`);
    const requests = await sqlRows(ctx, `select id from public.seller_access_requests where user_id = ${sqlString(accounts.normal.id)}::uuid`);
    const authUser = await serviceRequest(ctx, `/auth/v1/admin/users/${accounts.normal.id}`);
    assertEqual(profile.length, 0, "profile deleted");
    assertEqual(buyer.length, 0, "buyer records deleted");
    assertEqual(requests.length, 0, "seller access request records deleted");
    assertEqual(authUser.status, 404, "local Auth user deleted");
  });

  if (cleanupNeeded) await cleanup(ctx);

  console.log("");
  if (failures > 0) {
    console.log(`${failures} seller/admin workflow test(s) failed.`);
    process.exit(1);
  }
  console.log("All seller/admin workflow tests passed.");
}

main().catch(async (error) => {
  console.error("FAIL test runner setup");
  console.error(`  ${error.message}`);
  process.exit(1);
});
