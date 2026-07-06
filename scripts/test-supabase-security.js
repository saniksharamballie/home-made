const { spawn, spawnSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const CONFIG_PATH = path.join(ROOT, "supabase", "config.toml");
const DEFAULT_LOCAL_URL = "http://127.0.0.1:54321";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const FORBIDDEN_JSON_KEYS = [
  "auth_id",
  "email",
  "phone",
  "phoneNumber",
  "phone_number",
  "mobile",
  "mobileNumber",
  "whatsapp",
  "whatsappNumber",
  "whatsapp_number",
  "contact",
  "contactNumber",
  "contact_number",
  "telephone",
  "address",
  "street_address",
  "streetAddress",
  "exactAddress",
  "collectionAddress",
  "deliveryAddress",
  "sellerDob",
  "dateOfBirth",
  "dob",
  "birthDate",
  "birthMonth",
  "sellerBirthMonth",
  "idNumber",
  "bankAccount",
  "bank_account",
  "payfastMerchantId",
  "payfastPassphrase"
];

let failures = 0;

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

function localSupabaseUrl() {
  return process.env.LOCAL_SUPABASE_URL || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_LOCAL_URL;
}

function checkRemoteRefusal() {
  const url = localSupabaseUrl();
  assertLocalHost(url, "Supabase URL");

  for (const [label, value] of [
    ["LOCAL_SUPABASE_DB_HOST", process.env.LOCAL_SUPABASE_DB_HOST],
    ["SUPABASE_DB_HOST", process.env.SUPABASE_DB_HOST],
    ["PGHOST", process.env.PGHOST]
  ]) {
    assertLocalHost(value, label);
  }

  for (const [label, value] of [
    ["LOCAL_SUPABASE_DB_URL", process.env.LOCAL_SUPABASE_DB_URL],
    ["SUPABASE_DB_URL", process.env.SUPABASE_DB_URL],
    ["DATABASE_URL", process.env.DATABASE_URL]
  ]) {
    if (value) assertLocalHost(value, label);
  }

  return url;
}

function base64url(input) {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function signJwt(payload, secret) {
  const header = { alg: "HS256", typ: "JWT" };
  const body = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signature = crypto.createHmac("sha256", secret).update(body).digest("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
  return `${body}.${signature}`;
}

function generatedLocalAnonKey(projectId) {
  const now = Math.floor(Date.now() / 1000);
  return signJwt({
    iss: "supabase",
    ref: projectId,
    role: "anon",
    iat: now - 60,
    exp: now + 60 * 60
  }, "super-secret-jwt-token-with-at-least-32-characters-long");
}

function statusAnonKey() {
  const result = spawnSync("supabase", ["status", "-o", "env"], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 5000
  });
  if (result.status !== 0) return "";
  const text = result.stdout || "";
  const match = text.match(/(?:^|\n)(?:ANON_KEY|SUPABASE_ANON_KEY|NEXT_PUBLIC_SUPABASE_ANON_KEY)=("?)([^\r\n"]+)\1/);
  return match ? match[2].trim() : "";
}

function anonKey(projectId) {
  return process.env.LOCAL_SUPABASE_ANON_KEY || statusAnonKey() || generatedLocalAnonKey(projectId);
}

function runSql(sql, projectId) {
  const container = process.env.LOCAL_SUPABASE_CONTAINER || `supabase_db_${projectId}`;
  return new Promise((resolve, reject) => {
    const child = spawn("docker", [
      "exec",
      "-i",
      container,
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
      if (code === 0) {
        resolve(stdout.trim());
      } else {
        reject(new Error((stderr || stdout || `psql exited with ${code}`).trim()));
      }
    });
    child.stdin.end(sql);
  });
}

function sqlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) throw new Error(`${message}: expected ${expected}, got ${actual}`);
}

function assertTrue(value, message) {
  assertEqual(value, "t", message);
}

function assertFalse(value, message) {
  assertEqual(value, "f", message);
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

async function restGet(url, pathName, key) {
  const response = await fetch(`${url.replace(/\/$/, "")}${pathName}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`
    }
  });
  const text = await response.text();
  return { status: response.status, ok: response.ok, text };
}

async function main() {
  const projectId = readProjectId();
  const url = checkRemoteRefusal();
  const key = anonKey(projectId);

  console.log("Home-Made Supabase local security tests");
  console.log(`Supabase URL: ${url}`);
  console.log(`Database container: ${process.env.LOCAL_SUPABASE_CONTAINER || `supabase_db_${projectId}`}`);
  console.log("");

  await test("anon can SELECT public.seller_directory", async () => {
    const out = await runSql("select has_table_privilege('anon', 'public.seller_directory', 'select');", projectId);
    assertTrue(out, "anon SELECT grant on public.seller_directory");
  });

  await test("anon cannot SELECT public.sellers", async () => {
    const out = await runSql("select has_table_privilege('anon', 'public.sellers', 'select');", projectId);
    assertFalse(out, "anon SELECT grant on public.sellers");
  });

  await test("authenticated has SELECT, INSERT and UPDATE on public.sellers", async () => {
    const out = await runSql("select has_table_privilege('authenticated', 'public.sellers', 'select, insert, update');", projectId);
    assertTrue(out, "authenticated SELECT, INSERT and UPDATE grants on public.sellers");
  });

  await test("authenticated lacks DELETE, TRUNCATE, REFERENCES, TRIGGER and MAINTAIN", async () => {
    const out = await runSql(`
      select not (
        has_table_privilege('authenticated', 'public.sellers', 'delete')
        or has_table_privilege('authenticated', 'public.sellers', 'truncate')
        or has_table_privilege('authenticated', 'public.sellers', 'references')
        or has_table_privilege('authenticated', 'public.sellers', 'trigger')
        or has_table_privilege('authenticated', 'public.sellers', 'maintain')
      );
    `, projectId);
    assertTrue(out, "authenticated forbidden grants on public.sellers");
  });

  await test("seller_directory contains no forbidden private JSON keys", async () => {
    const keys = FORBIDDEN_JSON_KEYS.map((keyName) => sqlString(keyName.toLowerCase())).join(",");
    const out = await runSql(`
      with recursive walk(value) as (
        select data from public.seller_directory
        union all
        select child.value
        from walk
        cross join lateral (
          select array_item.value
          from jsonb_array_elements(
            case when jsonb_typeof(walk.value) = 'array' then walk.value else '[]'::jsonb end
          ) array_item
          union all
          select object_item.value
          from jsonb_each(
            case when jsonb_typeof(walk.value) = 'object' then walk.value else '{}'::jsonb end
          ) object_item
        ) child
      ),
      keys as (
        select lower(object_key.key) as key
        from walk
        cross join lateral jsonb_each(
          case when jsonb_typeof(walk.value) = 'object' then walk.value else '{}'::jsonb end
        ) object_key
      )
      select count(*) from keys where key in (${keys});
    `, projectId);
    assertEqual(out, "0", "forbidden private JSON key count");
  });

  await test("Phase 1 temporary compatibility: seller_directory still exposes top-level wa", async () => {
    const out = await runSql(`
      select exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'seller_directory'
          and column_name = 'wa'
      );
    `, projectId);
    assertTrue(out, "temporary top-level wa column for old clients");
  });

  await test("Phase 1 temporary compatibility: seller_directory.data still exposes wa", async () => {
    const out = await runSql(`
      select coalesce(bool_or(data ? 'wa'), false)
      from public.seller_directory;
    `, projectId);
    assertTrue(out, "temporary data.wa for old clients");
  });

  await test("seller_directory exposes no removed contact identifier column or JSON field", async () => {
    const out = await runSql(`
      with columns as (
        select count(*)::int as found
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'seller_directory'
          and lower(column_name) in ('contact' || 'id', 'contact' || '_id')
      ),
      json_fields as (
        select count(*)::int as found
        from public.seller_directory
        where data ? ('contact' || 'Id') or data ? ('contact' || '_id')
      )
      select (columns.found + json_fields.found)::text
      from columns, json_fields;
    `, projectId);
    assertEqual(out, "0", "removed contact identifier exposure count");
  });

  await test("seller_directory has boolean hasWhatsApp", async () => {
    const out = await runSql(`
      select coalesce(bool_and(
        jsonb_typeof(to_jsonb("hasWhatsApp")) = 'boolean'
      ), false)
      from public.seller_directory;
    `, projectId);
    assertTrue(out, "hasWhatsApp projection");
  });

  await test("seller_directory returns active sellers", async () => {
    const out = await runSql("select (count(*) > 0 and bool_and(active)) from public.seller_directory;", projectId);
    assertTrue(out, "active seller_directory rows");
  });

  await test("REST anon seller_directory returns HTTP 200", async () => {
    const response = await restGet(url, "/rest/v1/seller_directory?select=id&limit=1", key);
    assertEqual(String(response.status), "200", `REST status body: ${response.text.slice(0, 200)}`);
  });

  await test("REST anon sellers is rejected", async () => {
    const response = await restGet(url, "/rest/v1/sellers?select=id&limit=1", key);
    if (response.ok) throw new Error(`expected rejection, got HTTP ${response.status}`);
    if (![401, 403].includes(response.status)) {
      throw new Error(`expected HTTP 401 or 403, got ${response.status}: ${response.text.slice(0, 200)}`);
    }
  });

  await test("seller_directory has security_barrier=true", async () => {
    const out = await runSql(`
      select coalesce(
        exists (
          select 1
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public'
            and c.relname = 'seller_directory'
            and c.reloptions @> array['security_barrier=true']
        ),
        false
      );
    `, projectId);
    assertTrue(out, "security_barrier option");
  });

  await test("seller_directory has security_invoker=false", async () => {
    const out = await runSql(`
      select coalesce(
        exists (
          select 1
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public'
            and c.relname = 'seller_directory'
            and c.reloptions @> array['security_invoker=false']
        ),
        false
      );
    `, projectId);
    assertTrue(out, "security_invoker option");
  });

  await test("view definition does not expose unrestricted sellers.data", async () => {
    const out = await runSql(`
      select not (
        pg_get_viewdef('public.seller_directory'::regclass, true) ~* 's\\.data\\s+as\\s+data'
        or pg_get_viewdef('public.seller_directory'::regclass, true) ~* 'sellers\\.data\\s+as\\s+data'
        or pg_get_viewdef('public.seller_directory'::regclass, true) ~* 'data\\s*=>\\s*s\\.data'
      );
    `, projectId);
    assertTrue(out, "unrestricted sellers.data projection");
  });

  await test("view definition does not use SELECT *", async () => {
    const out = await runSql(`
      select not (
        pg_get_viewdef('public.seller_directory'::regclass, true) ~* 'select\\s+\\*'
        or pg_get_viewdef('public.seller_directory'::regclass, true) ~* 'select\\s+s\\.\\*'
      );
    `, projectId);
    assertTrue(out, "SELECT * in view definition");
  });

  console.log("");
  if (failures > 0) {
    console.log(`${failures} security test(s) failed.`);
    process.exit(1);
  }
  console.log("All Supabase local security tests passed.");
}

main().catch((error) => {
  console.error("FAIL test runner setup");
  console.error(`  ${error.message}`);
  process.exit(1);
});
