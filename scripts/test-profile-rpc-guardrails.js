const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const migrationPath = path.join(root, "supabase", "migrations", "20260721140000_avoid_profile_write_on_read.sql");
const profileMigrationPath = path.join(root, "supabase", "migrations", "20260522153000_profiles_auth_roles.sql");
const latestSignupTriggerPath = path.join(root, "supabase", "migrations", "20260630153000_seller_signup_request_trigger.sql");
const appPath = path.join(root, "src", "homemade-map-cleaned-1.html");

const migration = fs.readFileSync(migrationPath, "utf8");
const profileMigration = fs.readFileSync(profileMigrationPath, "utf8");
const latestSignupTrigger = fs.readFileSync(latestSignupTriggerPath, "utf8");
const app = fs.readFileSync(appPath, "utf8");
const sql = normalizeSql(migration);

let checks = 0;
function check(name, fn) {
  fn();
  checks += 1;
}

function normalizeSql(source) {
  return source.toLowerCase().replace(/\s+/g, " ").trim();
}

function intendedRole(existingRole, isAdminEmail) {
  return isAdminEmail ? "admin" : existingRole;
}

function shouldSynchronize(existing, proposedEmail, isAdminEmail) {
  const role = intendedRole(existing.role, isAdminEmail);
  return existing.email !== proposedEmail || existing.role !== role;
}

check("migration replaces the existing zero-argument profile RPC contract", () => {
  assert.match(migration, /create or replace function public\.get_home_made_profile\(\)/i);
  assert.match(migration, /returns public\.profiles/i);
  assert.match(migration, /language plpgsql[\s\S]*security definer[\s\S]*set search_path = public/i);
});

check("unauthenticated invocation is rejected before profile access", () => {
  assert.match(migration, /current_user_id := auth\.uid\(\)/i);
  assert.match(migration, /if current_user_id is null then[\s\S]*raise exception[\s\S]*errcode = '28000'/i);
});

check("missing profiles retain insert-on-missing recovery", () => {
  assert.match(migration, /insert into public\.profiles as existing_profile \(id, email, display_name, role\)/i);
  assert.ok(sql.includes("values ( current_user_id, user_email, split_part(user_email, '@', 1), public.home_made_profile_role(user_email) )"));
  assert.match(migration, /on conflict \(id\) do update/i);
});

check("the profile primary key and conflict target prevent duplicates", () => {
  assert.match(profileMigration, /id uuid primary key references auth\.users\(id\)/i);
  assert.match(migration, /on conflict \(id\) do update/i);
});

check("email synchronization uses a null-safe changed-value predicate", () => {
  assert.ok(sql.includes("email = excluded.email"));
  assert.ok(sql.includes("existing_profile.email is distinct from excluded.email"));
  assert.equal(shouldSynchronize({ email: null, role: "buyer" }, null, false), false);
  assert.equal(shouldSynchronize({ email: null, role: "buyer" }, "new@example.invalid", false), true);
});

check("timestamp changes only inside the conditional conflict update", () => {
  assert.equal((migration.match(/updated_at\s*=\s*now\(\)/gi) || []).length, 1);
  assert.match(migration, /updated_at = now\(\)[\s\S]*where[\s\S]*is distinct from/i);
});

check("unchanged repeated reads are idempotent", () => {
  const existing = { email: "same@example.invalid", role: "seller" };
  assert.equal(shouldSynchronize(existing, existing.email, false), false);
  assert.equal(shouldSynchronize(existing, existing.email, false), false);
});

check("changed email requires synchronization and a timestamp update", () => {
  assert.equal(shouldSynchronize({ email: "old@example.invalid", role: "buyer" }, "new@example.invalid", false), true);
  assert.ok(sql.includes("updated_at = now()"));
});

check("existing seller and admin roles are preserved for non-admin email", () => {
  assert.equal(intendedRole("seller", false), "seller");
  assert.equal(intendedRole("admin", false), "admin");
  assert.match(migration, /else existing_profile\.role/i);
});

check("buyers elevate only through the existing exact admin helper", () => {
  assert.equal(intendedRole("buyer", false), "buyer");
  assert.equal(intendedRole("buyer", true), "admin");
  assert.equal((migration.match(/public\.home_made_is_admin_email\(excluded\.email\)/gi) || []).length, 2);
  assert.equal(/raw_user_meta_data|user_metadata|app_metadata/i.test(migration), false);
});

check("admin elevation participates in the conditional update predicate", () => {
  assert.equal(shouldSynchronize({ email: "same@example.invalid", role: "buyer" }, "same@example.invalid", true), true);
  assert.match(migration, /existing_profile\.role is distinct from case[\s\S]*home_made_is_admin_email\(excluded\.email\)[\s\S]*then 'admin'/i);
});

check("the RPC returns only the authenticated caller profile", () => {
  assert.match(migration, /select \* into result[\s\S]*from public\.profiles[\s\S]*where id = current_user_id/i);
  assert.match(migration, /return result/i);
});

check("execute privilege is removed from PUBLIC and anon", () => {
  assert.ok(sql.includes("revoke all privileges on function public.get_home_made_profile() from public;"));
  assert.ok(sql.includes("revoke execute on function public.get_home_made_profile() from anon;"));
});

check("authenticated and service roles retain intended execute access", () => {
  assert.ok(sql.includes("grant execute on function public.get_home_made_profile() to authenticated;"));
  assert.ok(sql.includes("grant execute on function public.get_home_made_profile() to service_role;"));
});

check("migration does not change RLS, triggers, seller linkage, or profile schema", () => {
  assert.equal(/create\s+(?:or replace\s+)?trigger|drop\s+trigger|alter\s+table|create\s+policy|drop\s+policy/i.test(migration), false);
  assert.equal(/public\.sellers|seller_access_requests|auth_id/i.test(migration), false);
});

check("latest signup trigger remains the profile creation path", () => {
  assert.match(latestSignupTrigger, /create or replace function public\.handle_home_made_new_user\(\)/i);
  assert.match(latestSignupTrigger, /insert into public\.profiles/i);
  assert.match(latestSignupTrigger, /create trigger on_home_made_auth_user_created[\s\S]*after insert on auth\.users/i);
  assert.equal(/handle_home_made_new_user|on_home_made_auth_user_created/i.test(migration), false);
});

check("existing client remains compatible with the unchanged RPC signature", () => {
  assert.equal((app.match(/\.rpc\('get_home_made_profile'\)/g) || []).length, 1);
  assert.equal(/\.rpc\('get_home_made_profile',\s*\{/g.test(app), false);
});

check("migration contains no client-side or secret configuration", () => {
  assert.equal(/supabase_service_role_key|supabase_secret_key|service_role\s*=|anon_key|next_public_/i.test(migration), false);
});

console.log(`Profile RPC guardrail tests passed: ${checks}`);
