const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const appPath = path.join(root, "src", "homemade-map-cleaned-1.html");
const migrationPath = path.join(root, "supabase", "migrations", "20260718120000_phase1_seller_test_guardrails.sql");
const latestDirectoryMigrationPath = path.join(root, "supabase", "migrations", "20260707134842_remove_public_whatsapp_fields_from_seller_directory.sql");
const selectiveSaveHelperPath = path.join(root, "src", "helpers", "seller-storefront-selective-save-helpers.js");
const { buildSellerStorefrontSelectivePatch } = require(selectiveSaveHelperPath);

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
const storefrontSaveBody = functionBody(app, "saveSellerStorefront");

const storefrontBaseline = {
  storeName: "Original Store",
  bio: "Original bio",
  contactName: "Original Owner",
  contactEmail: "prefilled@example.invalid",
  phone: "",
  address: "",
  paymentInfo: "",
  dob: "",
  storePic: "",
  avatar: ""
};
const existingStorefrontData = {
  storeName: storefrontBaseline.storeName,
  bio: storefrontBaseline.bio,
  contactName: storefrontBaseline.contactName,
  contactEmail: "",
  region: "Preserved Region",
  category: "Preserved Category",
  tier: "Preserved Tier",
  lat: -1,
  lng: 1,
  fulfilment: ["collection"],
  availability: { day: true },
  menu: [{ name: "Preserved Item" }],
  listingImages: ["preserved-image"]
};

function storefrontPatch(changes, dirty) {
  return buildSellerStorefrontSelectivePatch(
    existingStorefrontData,
    Object.assign({}, storefrontBaseline, changes || {}),
    storefrontBaseline,
    dirty || {},
    "2026-07-21T00:00:00.000Z"
  );
}

function assertNoStorefrontSensitiveWrites(patch) {
  for (const key of ["active", "region", "category", "tier", "lat", "lng", "fulfilment", "availability", "menu", "listingImages"]) {
    assert.equal(Object.prototype.hasOwnProperty.call(patch.sellerValues, key), false, `${key} must not be a seller column patch`);
    assert.equal(patch.changedDataKeys.includes(key), false, `${key} must not be a changed data key`);
  }
  for (const key of ["contactName", "contactEmail", "phone", "address", "paymentInfo", "sellerBirthMonth", "birthMonth", "birthdayLockedAt", "storePic", "avatar"]) {
    assert.equal(patch.changedDataKeys.includes(key), false, `${key} must be excluded unless deliberately changed`);
  }
}

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

check("name-only storefront edit writes only name and storeName", () => {
  const patch = storefrontPatch({ storeName: "Changed Store" }, { storeName: true });
  assert.deepEqual(Object.keys(patch.sellerValues).sort(), ["data", "name"]);
  assert.deepEqual(patch.changedDataKeys, ["storeName"]);
  assert.deepEqual(patch.profileValues, { display_name: "Changed Store" });
  assert.equal(patch.sellerValues.data.region, existingStorefrontData.region);
  assert.equal(patch.sellerValues.data.menu, existingStorefrontData.menu);
  assertNoStorefrontSensitiveWrites(patch);
});

check("bio-only storefront edit writes only bio", () => {
  const patch = storefrontPatch({ bio: "Changed bio" }, { bio: true });
  assert.deepEqual(Object.keys(patch.sellerValues), ["data"]);
  assert.deepEqual(patch.changedDataKeys, ["bio"]);
  assert.deepEqual(patch.profileValues, {});
  assertNoStorefrontSensitiveWrites(patch);
});

check("name-and-bio storefront edit contains only approved keys", () => {
  const patch = storefrontPatch({ storeName: "Changed Store", bio: "Changed bio" }, { storeName: true, bio: true });
  assert.deepEqual(Object.keys(patch.sellerValues).sort(), ["data", "name"]);
  assert.deepEqual(patch.changedDataKeys.sort(), ["bio", "storeName"]);
  assert.deepEqual(patch.profileValues, { display_name: "Changed Store" });
  assertNoStorefrontSensitiveWrites(patch);
});

check("unchanged prefilled and blank storefront fields are omitted", () => {
  const patch = storefrontPatch({}, {
    contactEmail: true,
    contactName: true,
    phone: true,
    address: true,
    paymentInfo: true,
    storePic: true,
    avatar: true
  });
  assert.equal(patch.hasSellerChanges, false);
  assert.equal(patch.hasProfileChanges, false);
  assert.deepEqual(patch.changedFields, []);
  assert.deepEqual(patch.sellerValues, {});
});

check("no-change and edit-then-revert storefront saves are database no-ops", () => {
  const noChange = storefrontPatch({}, {});
  const reverted = storefrontPatch({ bio: storefrontBaseline.bio }, { bio: true });
  assert.equal(noChange.hasSellerChanges, false);
  assert.equal(reverted.hasSellerChanges, false);
  assert.match(storefrontSaveBody, /if\(!patch\.hasSellerChanges\)\{ showToast\('No changes to save\.'\); return; \}/);
});

check("deliberately cleared optional storefront field remains representable", () => {
  const baseline = Object.assign({}, storefrontBaseline, { address: "Old pickup area" });
  const patch = buildSellerStorefrontSelectivePatch(existingStorefrontData, Object.assign({}, baseline, { address: "" }), baseline, { address: true });
  assert.deepEqual(patch.changedDataKeys, ["address"]);
  assert.equal(patch.sellerValues.data.address, "");
  assert.equal(patch.hasSellerChanges, true);
});

check("storefront save uses selective patch and avoids broad unconditional serialization", () => {
  assert.match(storefrontSaveBody, /buildSellerStorefrontSelectivePatch\(/);
  assert.equal(/Object\.assign\(\{\},\s*existingData,\s*\{storeName:hmField/.test(storefrontSaveBody), false);
  assert.equal(/\bactive\s*:|\bregion\s*:|\bcategory\s*:|\btier\s*:|\blat\s*:|\blng\s*:/.test(storefrontSaveBody), false);
});

console.log(`Seller guardrail tests passed: ${checks}`);
