const { spawn, spawnSync } = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const CONFIG_PATH = path.join(ROOT, "supabase", "config.toml");
const DEFAULT_LOCAL_URL = "http://127.0.0.1:54321";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const LOCAL_JWT_SECRET = "super-secret-jwt-token-with-at-least-32-characters-long";
const TODAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const PUBLIC_URL = "https://example.test/home-made-public-food.jpg";
const PRIVATE_SELLER_KEYS = [
  "auth_id",
  "email",
  "phone",
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
const IMAGE_PRIVATE_KEYS = [
  "imgPath",
  "imgName",
  "storagePath",
  "storage_path",
  "storageKey",
  "storage_key",
  "bucket",
  "bucketName",
  "objectPath",
  "internalId",
  "auth_id"
];
const IMAGE_FIELDS = [
  "images",
  "gallery",
  "storeImages",
  "photos",
  "photoUrls",
  "menuImages",
  "itemImages",
  "listingImages",
  "items",
  "menu",
  "menuItems",
  "menu_items",
  "dailyMenus"
];

let failures = 0;
let cleanupNeeded = false;
let cleanupMessage = "No cleanup needed.";
const leakedImagePaths = [];

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

function statusEnvValue(namePattern) {
  const result = spawnSync("supabase", ["status", "-o", "env"], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 5000
  });
  if (result.status !== 0) return "";
  const match = (result.stdout || "").match(new RegExp(`(?:^|\\n)(?:${namePattern})=("?)([^\\r\\n"]+)\\1`));
  return match ? match[2].trim() : "";
}

function anonKey(projectId) {
  return process.env.LOCAL_SUPABASE_ANON_KEY
    || statusEnvValue("ANON_KEY|SUPABASE_ANON_KEY|NEXT_PUBLIC_SUPABASE_ANON_KEY")
    || generatedLocalKey(projectId, "anon");
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
    apikey: key,
    Authorization: `Bearer ${key}`,
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

async function anonRequest(ctx, pathName, options = {}) {
  return request(ctx.url, ctx.anonKey, pathName, options);
}

async function sqlRows(ctx, selectSql) {
  const out = await runSql(`
    select coalesce(json_agg(row_to_json(t)), '[]'::json)::text
    from (${selectSql}) t;
  `, ctx.projectId);
  return JSON.parse(out || "[]");
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

function todayKey() {
  return TODAY_KEYS[new Date().getDay()];
}

function nonTodayKey() {
  return TODAY_KEYS.find((key) => key !== todayKey());
}

function futureMonthNumber() {
  return (new Date().getMonth() + 1) % 12 + 1;
}

function imageProbe(label) {
  return {
    url: `${PUBLIC_URL}?field=${label}`,
    image_url: `${PUBLIC_URL}?field=${label}-image`,
    img: `${PUBLIC_URL}?field=${label}-img`,
    name: `${label} public name`,
    title: `${label} public title`,
    alt: `${label} public alt`,
    caption: `${label} public caption`,
    width: 640,
    height: 480,
    order: 2,
    sortOrder: 3,
    imgPath: `private/${label}/img-path.jpg`,
    imgName: `${label}-private-name.jpg`,
    storagePath: `seller-private/${label}/storage-path.jpg`,
    storage_path: `seller-private/${label}/storage-path-snake.jpg`,
    storageKey: `storage-key-${label}`,
    storage_key: `storage-key-snake-${label}`,
    bucket: "seller-images-private",
    bucketName: "seller-images-private",
    objectPath: `objects/${label}.jpg`,
    internalId: `internal-${label}`,
    auth_id: "00000000-0000-0000-0000-000000000000"
  };
}

function publicItem(name, price, serves, label) {
  return {
    n: name,
    p: price,
    svs: serves,
    img: `${PUBLIC_URL}?item=${label}`,
    image: imageProbe(`item-${label}`),
    imgPath: `private/items/${label}.jpg`,
    storageKey: `private-item-key-${label}`,
    bucket: "seller-images-private",
    internalId: `private-item-${label}`
  };
}

function sellerData(ctx, suffix, options = {}) {
  const today = todayKey();
  const later = nonTodayKey();
  const imageStructures = {};
  for (const field of IMAGE_FIELDS) {
    if (field === "dailyMenus") continue;
    if (["items", "menu", "menuItems", "menu_items"].includes(field)) {
      imageStructures[field] = [publicItem(`${suffix} ${field} Meal`, 100, "1 person", `${suffix}-${field}`)];
    } else {
      imageStructures[field] = [`${PUBLIC_URL}?field=${suffix}-${field}-string`, imageProbe(`${suffix}-${field}`)];
    }
  }

  return {
    hmMarketplaceRun: ctx.runId,
    desc: `Marketplace regression seller ${suffix}`,
    dietary: ["Halaal"],
    healthTags: ["high-protein"],
    del: options.delivery,
    delivery: options.delivery,
    pu: options.pickup,
    pickup: options.pickup,
    fee: options.fee,
    discounts: options.discounts || [{ qty: 3, pct: 12 }, { qty: 6, pct: 18 }],
    campaign: { status: "active", timeframe: "weekly" },
    availability: { status: "open", items: {} },
    sellerBirthMonth: options.birthMonth ? String(options.birthMonth) : undefined,
    birthdayMonthBoost: "private-probe-should-not-drive-view",
    exactAddress: "PRIVATE EXACT ADDRESS",
    bankAccount: "PRIVATE BANK ACCOUNT",
    idNumber: "PRIVATE ID NUMBER",
    phone: "PRIVATE PHONE",
    ...imageStructures,
    items: [publicItem(`${suffix} Bunny Chow`, 85, "1 person", `${suffix}-current-1`)],
    dailyMenus: {
      [today]: {
        items: [publicItem(`${suffix} Today Curry`, 95, "2 people", `${suffix}-today`)],
        discounts: [{ qty: 2, pct: 10 }]
      },
      [later]: {
        items: [publicItem(`${suffix} Future Breyani`, 120, "4 people", `${suffix}-future`)],
        discounts: [{ qty: 4, pct: 15 }]
      }
    }
  };
}

function createSellerSql(ctx, fixture) {
  return `
    insert into public.sellers (email, name, seller, region, category, tier, wa, lat, lng, active, data)
    values (
      ${sqlString(`hm.marketplace.${fixture.slug}.${ctx.runId}@example.test`)},
      ${sqlString(fixture.name)},
      ${sqlString(fixture.seller)},
      ${sqlString(fixture.region)},
      ${sqlString(fixture.category)},
      ${sqlString(fixture.tier)},
      '27820005555',
      -29.8587000,
      31.0218000,
      ${fixture.active ? "true" : "false"},
      ${sqlString(JSON.stringify(fixture.data))}::jsonb
    )
    returning id;
  `;
}

async function insertFixtures(ctx) {
  const month = new Date().getMonth() + 1;
  const fixtures = [
    {
      slug: "birthday",
      name: `HM Marketplace Birthday ${ctx.runId}`,
      seller: "Marketplace Birthday Kitchen",
      region: "Westville",
      category: "indian",
      tier: "gold",
      active: true,
      data: sellerData(ctx, "Birthday", {
        delivery: true,
        pickup: false,
        fee: 35,
        birthMonth: month,
        discounts: [{ qty: 2, pct: 10 }, { qty: 5, pct: 20 }]
      })
    },
    {
      slug: "standard",
      name: `HM Marketplace Standard ${ctx.runId}`,
      seller: "Marketplace Standard Kitchen",
      region: "Umhlanga",
      category: "bbq",
      tier: "standard",
      active: true,
      data: sellerData(ctx, "Standard", {
        delivery: false,
        pickup: true,
        fee: 0,
        birthMonth: futureMonthNumber(),
        discounts: [{ qty: 3, pct: 12 }]
      })
    },
    {
      slug: "inactive",
      name: `HM Marketplace Inactive ${ctx.runId}`,
      seller: "Marketplace Inactive Kitchen",
      region: "Pinetown",
      category: "vegan",
      tier: "platinum",
      active: false,
      data: sellerData(ctx, "Inactive", {
        delivery: true,
        pickup: true,
        fee: 20,
        birthMonth: futureMonthNumber(),
        discounts: [{ qty: 4, pct: 8 }]
      })
    }
  ];

  for (const fixture of fixtures) {
    const out = await runSql(createSellerSql(ctx, fixture), ctx.projectId);
    const idMatch = String(out).match(/\d+/);
    assert(idMatch, `seller fixture ${fixture.slug} insert should return an id`);
    fixture.id = Number(idMatch[0]);
  }
  cleanupNeeded = true;
  return fixtures;
}

async function directoryRows(ctx) {
  const response = await anonRequest(ctx, `/rest/v1/seller_directory?select=*&name=like.*${encodeURIComponent(ctx.runId)}*&order=name.asc`);
  assertOk(response, "anon seller_directory fixture read");
  return response.data || [];
}

function rowBySlug(rows, fixtures, slug) {
  const fixture = fixtures.find((item) => item.slug === slug);
  return rows.find((row) => row.id === fixture.id);
}

function walkJson(value, visitor, pathParts = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkJson(item, visitor, pathParts.concat(`[${index}]`)));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    const nextPath = pathParts.concat(key);
    visitor(key, child, nextPath);
    walkJson(child, visitor, nextPath);
  }
}

function jsonPath(parts) {
  return parts.reduce((out, part) => {
    if (part.startsWith("[")) return `${out}${part}`;
    return out ? `${out}.${part}` : part;
  }, "$");
}

function findForbiddenKeys(value, forbiddenKeys) {
  const forbidden = new Set(forbiddenKeys.map((key) => key.toLowerCase()));
  const hits = [];
  walkJson(value, (key, child, pathParts) => {
    if (forbidden.has(String(key).toLowerCase())) {
      hits.push({ path: jsonPath(pathParts), key, value: child });
    }
  });
  return hits;
}

function assertNoForbiddenKeys(value, forbiddenKeys, label) {
  const hits = findForbiddenKeys(value, forbiddenKeys);
  assert(hits.length === 0, `${label} leaked forbidden keys: ${hits.map((hit) => hit.path).join(", ")}`);
}

function assertNoImagePrivateKeys(row) {
  const hits = findForbiddenKeys(row, IMAGE_PRIVATE_KEYS);
  if (hits.length) {
    for (const hit of hits) {
      leakedImagePaths.push(`${hit.path} (${hit.key})`);
    }
  }
  assert(hits.length === 0, `image metadata leaked at ${hits.map((hit) => hit.path).join(", ")}`);
}

async function cleanup(ctx) {
  try {
    await runSql(`
      delete from public.sellers
      where data->>'hmMarketplaceRun' = ${sqlString(ctx.runId)}
         or lower(coalesce(email, '')) like ${sqlString(`hm.marketplace.%${ctx.runId}%@example.test`)};
    `, ctx.projectId);
    cleanupNeeded = false;
    cleanupMessage = "Cleanup succeeded for fictional marketplace records.";
    console.log(cleanupMessage);
  } catch (error) {
    cleanupMessage = `Cleanup failed: ${error.message}. Run supabase db reset before rerunning the marketplace tests.`;
    console.log(cleanupMessage);
  }
}

async function main() {
  const projectId = readProjectId();
  const url = checkRemoteRefusal();
  const ctx = {
    projectId,
    url,
    anonKey: anonKey(projectId),
    runId: `${Date.now().toString(36)}${crypto.randomBytes(3).toString("hex")}`
  };

  console.log("Home-Made Supabase local marketplace regression tests");
  console.log(`Supabase URL: ${ctx.url}`);
  console.log(`Database container: ${dockerContainer(projectId)}`);
  console.log(`Run id: ${ctx.runId}`);
  console.log("");

  let fixtures = [];
  try {
    fixtures = await insertFixtures(ctx);
  } catch (error) {
    console.error("FAIL test runner setup");
    console.error(`  ${error.message}`);
    process.exit(1);
  }

  let rows = [];

  await test("active sellers appear in seller_directory", async () => {
    rows = await directoryRows(ctx);
    assert(rowBySlug(rows, fixtures, "birthday"), "active birthday fixture should be public");
    assert(rowBySlug(rows, fixtures, "standard"), "active standard fixture should be public");
  });

  await test("inactive sellers do not appear in seller_directory", async () => {
    rows = rows.length ? rows : await directoryRows(ctx);
    assert(!rowBySlug(rows, fixtures, "inactive"), "inactive fixture should be absent");
  });

  await test("public directory returns expected active fixture count", async () => {
    rows = await directoryRows(ctx);
    assertEqual(rows.length, 2, "active fixture row count");
  });

  await test("category values are projected correctly", async () => {
    const birthday = rowBySlug(rows, fixtures, "birthday");
    const standard = rowBySlug(rows, fixtures, "standard");
    assertEqual(birthday.category, "indian", "birthday category");
    assertEqual(birthday.data.category, "indian", "birthday data.category");
    assertEqual(standard.category, "bbq", "standard category");
    assertEqual(standard.data.category, "bbq", "standard data.category");
  });

  await test("region/suburb values are projected correctly", async () => {
    const birthday = rowBySlug(rows, fixtures, "birthday");
    const standard = rowBySlug(rows, fixtures, "standard");
    assertEqual(birthday.region, "Westville", "birthday region");
    assertEqual(birthday.data.region, "Westville", "birthday data.region");
    assertEqual(standard.region, "Umhlanga", "standard region");
    assertEqual(standard.data.region, "Umhlanga", "standard data.region");
  });

  await test("REST category filtering returns only matching sellers", async () => {
    const response = await anonRequest(ctx, `/rest/v1/seller_directory?select=id,category&name=like.*${encodeURIComponent(ctx.runId)}*&category=eq.indian`);
    assertOk(response, "category filter");
    assertEqual(response.data.length, 1, "indian category row count");
    assertEqual(response.data[0].id, fixtures.find((item) => item.slug === "birthday").id, "indian category fixture");
    assert(response.data.every((row) => row.category === "indian"), "all category-filter rows should be indian");
  });

  await test("REST region filtering returns only matching sellers", async () => {
    const response = await anonRequest(ctx, `/rest/v1/seller_directory?select=id,region&name=like.*${encodeURIComponent(ctx.runId)}*&region=eq.Umhlanga`);
    assertOk(response, "region filter");
    assertEqual(response.data.length, 1, "Umhlanga region row count");
    assertEqual(response.data[0].id, fixtures.find((item) => item.slug === "standard").id, "Umhlanga region fixture");
    assert(response.data.every((row) => row.region === "Umhlanga"), "all region-filter rows should be Umhlanga");
  });

  await test("delivery flags retain expected boolean/value semantics", async () => {
    const birthday = rowBySlug(rows, fixtures, "birthday");
    const standard = rowBySlug(rows, fixtures, "standard");
    assertEqual(birthday.data.del, true, "birthday data.del");
    assertEqual(birthday.data.delivery, true, "birthday data.delivery");
    assertEqual(birthday.data.fee, 35, "birthday delivery fee");
    assertEqual(standard.data.del, false, "standard data.del");
    assertEqual(standard.data.delivery, false, "standard data.delivery");
  });

  await test("pickup flags retain expected boolean/value semantics", async () => {
    const birthday = rowBySlug(rows, fixtures, "birthday");
    const standard = rowBySlug(rows, fixtures, "standard");
    assertEqual(birthday.data.pu, false, "birthday data.pu");
    assertEqual(birthday.data.pickup, false, "birthday data.pickup");
    assertEqual(standard.data.pu, true, "standard data.pu");
    assertEqual(standard.data.pickup, true, "standard data.pickup");
  });

  await test("discounts retain intended JSON type and numeric values", async () => {
    const birthday = rowBySlug(rows, fixtures, "birthday");
    assert(Array.isArray(birthday.data.discounts), "discounts should be an array");
    assertEqual(birthday.data.discounts[0].qty, 2, "first discount qty");
    assertEqual(birthday.data.discounts[0].pct, 10, "first discount pct");
    assertEqual(birthday.data.discounts[1].qty, 5, "second discount qty");
    assertEqual(birthday.data.discounts[1].pct, 20, "second discount pct");
  });

  await test("menu item names, prices and serving values are preserved", async () => {
    const birthday = rowBySlug(rows, fixtures, "birthday");
    assert(Array.isArray(birthday.data.items), "items should be an array");
    assertEqual(birthday.data.items[0].n, "Birthday Bunny Chow", "item name");
    assertEqual(birthday.data.items[0].p, 85, "item price");
    assertEqual(birthday.data.items[0].svs, "1 person", "item serving");
  });

  await test("safe public image URL and display fields remain usable", async () => {
    const birthday = rowBySlug(rows, fixtures, "birthday");
    for (const field of ["images", "photos", "gallery", "photoUrls", "itemImages", "menuImages", "storeImages", "listingImages"]) {
      const value = birthday.data[field];
      assert(Array.isArray(value), `${field} should be an array`);
      assertEqual(value[0], `${PUBLIC_URL}?field=Birthday-${field}-string`, `${field} string URL`);
      assertEqual(value[1].url, `${PUBLIC_URL}?field=Birthday-${field}`, `${field} object url`);
      assertEqual(value[1].image_url, `${PUBLIC_URL}?field=Birthday-${field}-image`, `${field} object image_url`);
      assertEqual(value[1].img, `${PUBLIC_URL}?field=Birthday-${field}-img`, `${field} object img`);
      assertEqual(value[1].name, `Birthday-${field} public name`, `${field} public name`);
      assertEqual(value[1].title, `Birthday-${field} public title`, `${field} public title`);
      assertEqual(value[1].alt, `Birthday-${field} public alt`, `${field} public alt`);
      assertEqual(value[1].caption, `Birthday-${field} public caption`, `${field} public caption`);
      assertEqual(value[1].width, 640, `${field} public width`);
      assertEqual(value[1].height, 480, `${field} public height`);
      assertEqual(value[1].order, 2, `${field} public order`);
      assertEqual(value[1].sortOrder, 3, `${field} public sortOrder`);
    }
    assertEqual(birthday.data.items[0].image.url, `${PUBLIC_URL}?field=item-Birthday-current-1`, "nested item image url");
  });

  await test("today dailyMenus key is exposed", async () => {
    const birthday = rowBySlug(rows, fixtures, "birthday");
    assert(birthday.data.dailyMenus && birthday.data.dailyMenus[todayKey()], "today daily menu should be present");
    assertEqual(birthday.data.dailyMenus[todayKey()].items[0].n, "Birthday Today Curry", "today daily menu item");
  });

  await test("non-today dailyMenus keys are not exposed", async () => {
    const birthday = rowBySlug(rows, fixtures, "birthday");
    assert(!birthday.data.dailyMenus[nonTodayKey()], "non-today daily menu should be absent");
  });

  await test("current menu items are deeply sanitized", async () => {
    const birthday = rowBySlug(rows, fixtures, "birthday");
    assertNoForbiddenKeys(birthday.data.items, IMAGE_PRIVATE_KEYS, "current menu items");
  });

  await test("daily-menu items are deeply sanitized", async () => {
    const birthday = rowBySlug(rows, fixtures, "birthday");
    assertNoForbiddenKeys(birthday.data.dailyMenus, IMAGE_PRIVATE_KEYS, "daily menu items");
  });

  await test("forbidden seller-level private keys remain absent", async () => {
    for (const row of rows) {
      assertNoForbiddenKeys(row, PRIVATE_SELLER_KEYS, `seller_directory row ${row.id}`);
    }
  });

  await test("private data remains absent after advert/data updates", async () => {
    const birthdayId = fixtures.find((item) => item.slug === "birthday").id;
    await runSql(`
      update public.sellers
      set data = data || ${sqlString(JSON.stringify({
        exactAddress: "UPDATED PRIVATE ADDRESS",
        bankAccount: "UPDATED PRIVATE BANK",
        items: [publicItem("Updated Public Meal", 110, "3 people", "updated-current")],
        dailyMenus: {
          [todayKey()]: {
            items: [publicItem("Updated Today Meal", 125, "4 people", "updated-today")]
          },
          [nonTodayKey()]: {
            items: [publicItem("Updated Future Meal", 130, "5 people", "updated-future")]
          }
        }
      }))}::jsonb,
          updated_at = now()
      where id = ${Number(birthdayId)};
    `, ctx.projectId);
    rows = await directoryRows(ctx);
    const birthday = rowBySlug(rows, fixtures, "birthday");
    assertNoForbiddenKeys(birthday, PRIVATE_SELLER_KEYS, "updated seller row");
    assertNoForbiddenKeys(birthday.data.items, IMAGE_PRIVATE_KEYS, "updated current menu items");
    assertNoForbiddenKeys(birthday.data.dailyMenus, IMAGE_PRIVATE_KEYS, "updated daily menu items");
    assertEqual(birthday.data.items[0].n, "Updated Public Meal", "updated item name");
  });

  await test("base tier remains unchanged in data.baseTier", async () => {
    const birthday = rowBySlug(rows, fixtures, "birthday");
    assertEqual(birthday.data.baseTier, "gold", "birthday base tier");
  });

  await test("birthday-month boost changes only effective projected tier", async () => {
    const birthday = rowBySlug(rows, fixtures, "birthday");
    assertEqual(birthday.tier, "platinum", "birthday effective tier");
    assertEqual(birthday.data.baseTier, "gold", "birthday base tier after boost");
  });

  await test("birthdayMonthBoost is true only for applicable fixture", async () => {
    const birthday = rowBySlug(rows, fixtures, "birthday");
    const standard = rowBySlug(rows, fixtures, "standard");
    assertEqual(birthday.data.birthdayMonthBoost, true, "birthday boost flag");
    assertEqual(standard.data.birthdayMonthBoost, false, "standard boost flag");
  });

  await test("non-birthday seller retains base and effective tier", async () => {
    const standard = rowBySlug(rows, fixtures, "standard");
    assertEqual(standard.tier, "standard", "standard effective tier");
    assertEqual(standard.data.baseTier, "standard", "standard base tier");
  });

  await test("seller_directory remains security_barrier=true", async () => {
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
    `, ctx.projectId);
    assertEqual(out, "t", "security_barrier option");
  });

  await test("seller_directory remains security_invoker=false", async () => {
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
    `, ctx.projectId);
    assertEqual(out, "t", "security_invoker option");
  });

  await test("recursive image privacy diagnostic has no internal metadata leaks", async () => {
    rows = await directoryRows(ctx);
    for (const row of rows) {
      assertNoImagePrivateKeys(row);
    }
  });

  if (cleanupNeeded) await cleanup(ctx);

  console.log("");
  if (leakedImagePaths.length) {
    console.log("Image privacy leaked JSON paths:");
    for (const item of leakedImagePaths) console.log(`  ${item}`);
    console.log("Recommendation: stop here and create a separate corrective seller_directory migration task.");
  } else {
    console.log("Recursive image privacy diagnostic passed.");
  }
  console.log(cleanupMessage);

  if (failures > 0) {
    console.log(`${failures} marketplace regression test(s) failed.`);
    process.exit(1);
  }
  console.log("All marketplace regression tests passed.");
}

main().catch(async (error) => {
  console.error("FAIL test runner setup");
  console.error(`  ${error.message}`);
  process.exit(1);
});
