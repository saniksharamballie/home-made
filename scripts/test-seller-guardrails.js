const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const appPath = path.join(root, "src", "homemade-map-cleaned-1.html");
const migrationPath = path.join(root, "supabase", "migrations", "20260718120000_phase1_seller_test_guardrails.sql");
const latestDirectoryMigrationPath = path.join(root, "supabase", "migrations", "20260707134842_remove_public_whatsapp_fields_from_seller_directory.sql");

const app = fs.readFileSync(appPath, "utf8");
const migration = fs.readFileSync(migrationPath, "utf8");
const latestDirectoryMigration = fs.readFileSync(latestDirectoryMigrationPath, "utf8");

let checks = 0;
function check(name, fn) {
  fn();
  checks += 1;
}

function functionBody(source, name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} was not found`);
  const open = source.indexOf("{", start);
  assert.notEqual(open, -1, `${name} body was not found`);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    const char = source[i];
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, i);
    }
  }
  throw new Error(`${name} body did not close`);
}

function normaliseSql(source) {
  return source.toLowerCase().replace(/\s+/g, " ");
}

const sellerRequestBody = functionBody(app, "submitSellerRequest");
const migrationSql = normaliseSql(migration);
const directorySql = normaliseSql(latestDirectoryMigration);

check("seller access request does not create a local/admin message", () => {
  assert.equal(/\bsendMessage\s*\(/.test(sellerRequestBody), false, "submitSellerRequest must not call sendMessage");
});

check("seller access request inserts only the seller_access_requests cloud row", () => {
  assert.match(sellerRequestBody, /hmAuth\.insert\('seller_access_requests'/, "seller access request insert missing");
  assert.equal(/hmAuth\.insert\('messages'/.test(sellerRequestBody), false, "submitSellerRequest must not insert messages");
  assert.equal(/\bmessages\b/.test(sellerRequestBody), false, "submitSellerRequest must not reference messages");
});

check("admin seller RPC migration revokes public and anon execute", () => {
  const functions = [
    "public.home_made_admin_seller_access_requests()",
    "public.home_made_approve_seller_access_request(uuid, text, text, text, text, bigint, text)",
    "public.home_made_reject_seller_access_request(uuid, text)"
  ];
  for (const fn of functions) {
    assert.ok(migrationSql.includes(`revoke execute on function ${fn} from public;`), `${fn} public revoke missing`);
    assert.ok(migrationSql.includes(`revoke execute on function ${fn} from anon;`), `${fn} anon revoke missing`);
    assert.ok(migrationSql.includes(`grant execute on function ${fn} to authenticated;`), `${fn} authenticated grant missing`);
  }
});

check("seller approval keeps new sellers inactive until explicit publication", () => {
  assert.equal(/active\s*=\s*true/i.test(migration), false, "approval migration must not force active=true");
  assert.match(migration, /insert into public\.sellers[\s\S]*false,[\s\S]*request_payload/i, "new seller insert should use active=false");
  assert.match(migration, /active\s*=\s*public\.sellers\.active/i, "existing seller active state should be preserved");
});

check("seller_directory remains active-only and contact-sanitized", () => {
  assert.ok(directorySql.includes("where s.active = true"), "seller_directory should stay active-only");
  assert.equal(/\bs\.wa\s+as\s+wa\b|\bwa\s+as\b|\bphone\s+as\b|\bwhatsapp\s+as\b/i.test(latestDirectoryMigration), false, "seller_directory should not expose direct contact columns");
  assert.match(latestDirectoryMigration, /as\s+"hasWhatsApp"/, "seller_directory should expose only a boolean WhatsApp availability flag");
});

check("storage key constants remain wired into the app build source", () => {
  for (const key of [
    "REMEMBER_EMAIL_KEY",
    "HM_HOME_HERO_LAST_KEY",
    "HM_MAP_WELCOME_SEEN_KEY",
    "HM_PWA_DISMISSED_KEY"
  ]) {
    assert.match(app, new RegExp(`\\b${key}\\b`), `${key} missing from source`);
  }
});

check("map lifecycle guard remains present", () => {
  assert.match(app, /\bfunction\s+destroyLeafMap\s*\(/, "destroyLeafMap missing");
  assert.match(app, /\b_leafMapRenderId\b/, "stale map render guard missing");
});

console.log(`Seller guardrail tests passed: ${checks}`);
