const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const htmlPath = path.join(root, "public", "index.html");
const envPath = path.join(root, "public", "env.js");
const sitemapPath = path.join(root, "public", "sitemap.xml");
const robotsPath = path.join(root, "public", "robots.txt");
const sellerDir = path.join(root, "public", "seller");
const durbanDir = path.join(root, "public", "durban");
const cuisineDir = path.join(root, "public", "cuisine");
const legalPages = ["terms", "privacy", "legal"].map((slug) => path.join(root, "public", `${slug}.html`));
const publicBrandLogo = "/icons/home-made-desktop-logo.jpeg";

function htmlFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return htmlFiles(full);
    return entry.name.endsWith(".html") ? [full] : [];
  });
}
const required = [
  "/env.js",
  "window.HM_CONFIG",
  "SUPABASE_URL",
  "SUPABASE_ANON",
  "hmAuth",
  "Home-Made"
];

if (!fs.existsSync(htmlPath)) {
  throw new Error("Missing public/index.html. Run npm run build first.");
}
if (!fs.existsSync(envPath)) {
  throw new Error("Missing public/env.js. Run npm run build first.");
}
if (!fs.existsSync(sitemapPath) || !fs.existsSync(robotsPath) || !fs.existsSync(sellerDir) || !fs.existsSync(durbanDir) || !fs.existsSync(cuisineDir)) {
  throw new Error("Missing generated SEO pages. Run npm run build first.");
}
for (const page of legalPages) {
  if (!fs.existsSync(page)) throw new Error(`Missing generated legal page: ${path.basename(page)}`);
  if (!fs.readFileSync(page, "utf8").includes(publicBrandLogo)) {
    throw new Error(`Build check failed. Legal page missing rectangular brand logo: ${path.basename(page)}`);
  }
}

const html = fs.readFileSync(htmlPath, "utf8");
const env = fs.readFileSync(envPath, "utf8");
const sourceHtml = fs.readFileSync(path.join(root, "src", "homemade-map-cleaned-1.html"), "utf8");
const removedContactFieldPattern = new RegExp(`contact(?:${"I"}d|_${"i"}d)`, "i");
const helperIncludeMarker = "/* @include src/helpers/formatting-tier-helpers.js */";
const textHelperIncludeMarker = "/* @include src/helpers/text-escape-helpers.js */";
const dateTimeHelperIncludeMarker = "/* @include src/helpers/date-time-helpers.js */";
const currencyHelperIncludeMarker = "/* @include src/helpers/currency-format-helpers.js */";
const filterRegionIncludeMarker = "/* @include src/helpers/filter-region-constants.js */";
const categoryCatalogIncludeMarker = "/* @include src/helpers/category-catalog-constants.js */";
const storageKeyIncludeMarker = "/* @include src/helpers/storage-key-constants.js */";
const helperDeclarations = [
  "function hmNumber",
  "function tierRank",
  "function tierDisplayLabel",
  "var TIER_PRICES",
  "var TIER_TRIAL_DAYS",
  "function tierMonthlyPrice",
  "function tierTrialDays",
  "function tierPriceLabel",
  "function nextSellerTier",
  "function sellerTierClass",
  "function sellerBirthdayValue",
  "function isBirthdayMonth",
  "function sellerBaseTier",
  "function sellerEffectiveTier",
  "function applySellerComputedAccess",
  "function hmBool",
  "function hmTagArray"
];
const textHelperDeclarations = [
  "function hmText",
  "function hmJs"
];
const dateTimeHelperDeclarations = [
  "function formatSellerBackAt",
  "function toDatetimeLocalValue"
];
const currencyHelperDeclaration = "function zar";
const filterRegionDeclarations = [
  "const DIETARY",
  "const HEALTH_FILTERS",
  "const ALL_FILTERS",
  "const REGIONS"
];
const categoryCatalogDeclaration = "const CATS";
const storageKeyDeclarations = [
  "var REMEMBER_EMAIL_KEY",
  "var HM_HOME_HERO_LAST_KEY",
  "var HM_MAP_WELCOME_SEEN_KEY",
  "var HM_PWA_DISMISSED_KEY"
];
const storageKeyRawValues = [
  "hm_remember_email",
  "hm_home_hero_last",
  "hm_map_welcome_seen",
  "pwa-dismissed"
];

function occurrenceCount(text, needle) {
  return text.split(needle).length - 1;
}

for (const needle of required) {
  if (!html.includes(needle) && !env.includes(needle)) {
    throw new Error(`Build check failed. Missing: ${needle}`);
  }
}
if (occurrenceCount(sourceHtml, helperIncludeMarker) !== 1) {
  throw new Error("Build check failed. Source formatting/tier helper include marker must exist exactly once.");
}
if (occurrenceCount(sourceHtml, textHelperIncludeMarker) !== 1) {
  throw new Error("Build check failed. Source text escape helper include marker must exist exactly once.");
}
if (occurrenceCount(sourceHtml, dateTimeHelperIncludeMarker) !== 1) {
  throw new Error("Build check failed. Source date/time helper include marker must exist exactly once.");
}
if (occurrenceCount(sourceHtml, currencyHelperIncludeMarker) !== 1) {
  throw new Error("Build check failed. Source currency format helper include marker must exist exactly once.");
}
if (occurrenceCount(sourceHtml, filterRegionIncludeMarker) !== 1) {
  throw new Error("Build check failed. Source filter/region constants include marker must exist exactly once.");
}
if (occurrenceCount(sourceHtml, categoryCatalogIncludeMarker) !== 1) {
  throw new Error("Build check failed. Source category catalog constants include marker must exist exactly once.");
}
if (occurrenceCount(sourceHtml, storageKeyIncludeMarker) !== 1) {
  throw new Error("Build check failed. Source storage key constants include marker must exist exactly once.");
}
if (html.includes(helperIncludeMarker) || /@include\s+src\/helpers\/formatting-tier-helpers\.js/.test(html)) {
  throw new Error("Build check failed. Generated app still contains the formatting/tier helper include marker.");
}
if (html.includes(textHelperIncludeMarker) || /@include\s+src\/helpers\/text-escape-helpers\.js/.test(html)) {
  throw new Error("Build check failed. Generated app still contains the text escape helper include marker.");
}
if (html.includes(dateTimeHelperIncludeMarker) || /@include\s+src\/helpers\/date-time-helpers\.js/.test(html)) {
  throw new Error("Build check failed. Generated app still contains the date/time helper include marker.");
}
if (html.includes(currencyHelperIncludeMarker) || /@include\s+src\/helpers\/currency-format-helpers\.js/.test(html)) {
  throw new Error("Build check failed. Generated app still contains the currency format helper include marker.");
}
if (html.includes(filterRegionIncludeMarker) || /@include\s+src\/helpers\/filter-region-constants\.js/.test(html)) {
  throw new Error("Build check failed. Generated app still contains the filter/region constants include marker.");
}
if (html.includes(categoryCatalogIncludeMarker) || /@include\s+src\/helpers\/category-catalog-constants\.js/.test(html)) {
  throw new Error("Build check failed. Generated app still contains the category catalog constants include marker.");
}
if (html.includes(storageKeyIncludeMarker) || /@include\s+src\/helpers\/storage-key-constants\.js/.test(html)) {
  throw new Error("Build check failed. Generated app still contains the storage key constants include marker.");
}
let previousHelperIndex = -1;
for (const declaration of helperDeclarations) {
  const count = occurrenceCount(html, declaration);
  if (count !== 1) {
    throw new Error(`Build check failed. Expected one generated helper declaration for ${declaration}, found ${count}.`);
  }
  const index = html.indexOf(declaration);
  if (index <= previousHelperIndex) {
    throw new Error(`Build check failed. Helper declaration ordering changed at ${declaration}.`);
  }
  previousHelperIndex = index;
}
let previousTextHelperIndex = -1;
for (const declaration of textHelperDeclarations) {
  const count = occurrenceCount(html, declaration);
  if (count !== 1) {
    throw new Error(`Build check failed. Expected one generated text escape helper declaration for ${declaration}, found ${count}.`);
  }
  const index = html.indexOf(declaration);
  if (index <= previousTextHelperIndex) {
    throw new Error(`Build check failed. Text escape helper declaration ordering changed at ${declaration}.`);
  }
  previousTextHelperIndex = index;
}
let previousDateTimeHelperIndex = -1;
for (const declaration of dateTimeHelperDeclarations) {
  const count = occurrenceCount(html, declaration);
  if (count !== 1) {
    throw new Error(`Build check failed. Expected one generated date/time helper declaration for ${declaration}, found ${count}.`);
  }
  const index = html.indexOf(declaration);
  if (index <= previousDateTimeHelperIndex) {
    throw new Error(`Build check failed. Date/time helper declaration ordering changed at ${declaration}.`);
  }
  previousDateTimeHelperIndex = index;
}
const currencyHelperCount = occurrenceCount(html, currencyHelperDeclaration);
if (currencyHelperCount !== 1) {
  throw new Error(`Build check failed. Expected one generated currency format helper declaration for ${currencyHelperDeclaration}, found ${currencyHelperCount}.`);
}
let previousFilterRegionIndex = -1;
for (const declaration of filterRegionDeclarations) {
  const count = occurrenceCount(html, declaration);
  if (count !== 1) {
    throw new Error(`Build check failed. Expected one generated filter/region declaration for ${declaration}, found ${count}.`);
  }
  const index = html.indexOf(declaration);
  if (index <= previousFilterRegionIndex) {
    throw new Error(`Build check failed. Filter/region declaration ordering changed at ${declaration}.`);
  }
  previousFilterRegionIndex = index;
}
const categoryCatalogCount = occurrenceCount(html, categoryCatalogDeclaration);
if (categoryCatalogCount !== 1) {
  throw new Error(`Build check failed. Expected one generated category catalog declaration for ${categoryCatalogDeclaration}, found ${categoryCatalogCount}.`);
}
for (const declaration of storageKeyDeclarations) {
  const count = occurrenceCount(html, declaration);
  if (count !== 1) {
    throw new Error(`Build check failed. Expected one generated storage key declaration for ${declaration}, found ${count}.`);
  }
}
for (const value of storageKeyRawValues) {
  const count = occurrenceCount(html, value);
  if (count !== 1) {
    throw new Error(`Build check failed. Expected storage key literal ${value} only in its generated constant declaration, found ${count}.`);
  }
}
for (const [declaration, firstUse] of [
  ["var REMEMBER_EMAIL_KEY", "localStorage.getItem(REMEMBER_EMAIL_KEY)"],
  ["var HM_HOME_HERO_LAST_KEY", "localStorage.getItem(HM_HOME_HERO_LAST_KEY)"],
  ["var HM_MAP_WELCOME_SEEN_KEY", "sessionStorage.getItem(HM_MAP_WELCOME_SEEN_KEY)"],
  ["var HM_PWA_DISMISSED_KEY", "sessionStorage.getItem(HM_PWA_DISMISSED_KEY)"]
]) {
  if (html.indexOf(declaration) < 0 || html.indexOf(firstUse) < 0 || html.indexOf(declaration) > html.indexOf(firstUse)) {
    throw new Error(`Build check failed. Storage key declaration ${declaration} must appear before first use ${firstUse}.`);
  }
}
const helperScriptMatches = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)].filter((match) => match[2].includes("function hmNumber"));
if (helperScriptMatches.length !== 1) {
  throw new Error(`Build check failed. Expected one classic inline application script containing helpers, found ${helperScriptMatches.length}.`);
}
if (/src\s*=|type\s*=\s*["']module["']/i.test(helperScriptMatches[0][1])) {
  throw new Error("Build check failed. Formatting/tier helpers moved out of the classic inline application script.");
}
const textHelperScriptMatches = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)].filter((match) => match[2].includes("function hmText") || match[2].includes("function hmJs"));
if (textHelperScriptMatches.length !== 1) {
  throw new Error(`Build check failed. Expected one classic inline application script containing text escape helpers, found ${textHelperScriptMatches.length}.`);
}
if (/src\s*=|type\s*=\s*["']module["']/i.test(textHelperScriptMatches[0][1])) {
  throw new Error("Build check failed. Text escape helpers moved out of the classic inline application script.");
}
const dateTimeHelperScriptMatches = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)].filter((match) => match[2].includes("function formatSellerBackAt") || match[2].includes("function toDatetimeLocalValue"));
if (dateTimeHelperScriptMatches.length !== 1) {
  throw new Error(`Build check failed. Expected one classic inline application script containing date/time helpers, found ${dateTimeHelperScriptMatches.length}.`);
}
if (/src\s*=|type\s*=\s*["']module["']/i.test(dateTimeHelperScriptMatches[0][1])) {
  throw new Error("Build check failed. Date/time helpers moved out of the classic inline application script.");
}
const currencyHelperScriptMatches = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)].filter((match) => match[2].includes("function zar"));
if (currencyHelperScriptMatches.length !== 1) {
  throw new Error(`Build check failed. Expected one classic inline application script containing the currency format helper, found ${currencyHelperScriptMatches.length}.`);
}
if (/src\s*=|type\s*=\s*["']module["']/i.test(currencyHelperScriptMatches[0][1])) {
  throw new Error("Build check failed. Currency format helper moved out of the classic inline application script.");
}
const filterRegionScriptMatches = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)].filter((match) => filterRegionDeclarations.every((declaration) => match[2].includes(declaration)));
if (filterRegionScriptMatches.length !== 1) {
  throw new Error(`Build check failed. Expected one classic inline application script containing filter/region constants, found ${filterRegionScriptMatches.length}.`);
}
if (/src\s*=|type\s*=\s*["']module["']/i.test(filterRegionScriptMatches[0][1])) {
  throw new Error("Build check failed. Filter/region constants moved out of the classic inline application script.");
}
const categoryCatalogScriptMatches = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)].filter((match) => match[2].includes(categoryCatalogDeclaration));
if (categoryCatalogScriptMatches.length !== 1) {
  throw new Error(`Build check failed. Expected one classic inline application script containing category catalog constants, found ${categoryCatalogScriptMatches.length}.`);
}
if (/src\s*=|type\s*=\s*["']module["']/i.test(categoryCatalogScriptMatches[0][1])) {
  throw new Error("Build check failed. Category catalog constants moved out of the classic inline application script.");
}
const storageKeyScriptMatches = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)].filter((match) => storageKeyDeclarations.every((declaration) => match[2].includes(declaration)));
if (storageKeyScriptMatches.length !== 1) {
  throw new Error(`Build check failed. Expected one classic inline application script containing storage key constants, found ${storageKeyScriptMatches.length}.`);
}
if (/src\s*=|type\s*=\s*["']module["']/i.test(storageKeyScriptMatches[0][1])) {
  throw new Error("Build check failed. Storage key constants moved out of the classic inline application script.");
}
if (!html.includes('src="/icons/icon-192.png"')) {
  throw new Error("Build check failed. PWA install prompt missing square app icon.");
}
for (const page of ["browse-sellers.html", "markets-events.html"]) {
  const publicPage = path.join(root, "public", page);
  if (!fs.existsSync(publicPage) || !fs.readFileSync(publicPage, "utf8").includes(publicBrandLogo)) {
    throw new Error(`Build check failed. Public page missing rectangular brand logo: ${page}`);
  }
}

const sellerPages = htmlFiles(sellerDir);
const durbanPages = htmlFiles(durbanDir);
const cuisinePages = htmlFiles(cuisineDir);
if (!sellerPages.length) throw new Error("Build check failed. Missing public seller pages.");
if (!durbanPages.length) throw new Error("Build check failed. Missing Durban suburb pages.");
if (!cuisinePages.length) throw new Error("Build check failed. Missing cuisine pages.");
let aggregateRatingPages = 0;
for (const page of sellerPages) {
  const sellerHtml = fs.readFileSync(page, "utf8");
  for (const forbidden of ["latitude", "longitude", "\"geo\"", "streetAddress"]) {
    if (sellerHtml.includes(forbidden)) {
      throw new Error(`Build check failed. Public seller page leaks private location data: ${path.basename(page)}`);
    }
  }
  if (!sellerHtml.includes('"@type":"BreadcrumbList"')) {
    throw new Error(`Build check failed. Seller page missing breadcrumb schema: ${path.basename(page)}`);
  }
  if (!sellerHtml.includes('"@type":"FAQPage"')) {
    throw new Error(`Build check failed. Seller page missing FAQ schema: ${path.basename(page)}`);
  }
  if (!sellerHtml.includes("100% of the food payment goes to the seller")) {
    throw new Error(`Build check failed. Seller page missing seller payment wording: ${path.basename(page)}`);
  }
  if (/https:\/\/wa\.me\/\d/i.test(sellerHtml)) {
    throw new Error(`Build check failed. Public seller page contains direct WhatsApp number: ${path.basename(page)}`);
  }
  if (/"telephone"\s*:/i.test(sellerHtml)) {
    throw new Error(`Build check failed. Public seller page contains schema telephone: ${path.basename(page)}`);
  }
  if (removedContactFieldPattern.test(sellerHtml)) {
    throw new Error(`Build check failed. Public seller page contains removed contact identifier field: ${path.basename(page)}`);
  }
  if (sellerHtml.includes('"@type":"AggregateRating"')) aggregateRatingPages += 1;
}
if (!aggregateRatingPages) {
  throw new Error("Build check failed. No seller page includes aggregate rating schema.");
}
const comboPage = path.join(durbanDir, "chatsworth", "indian.html");
if (!fs.existsSync(comboPage)) {
  throw new Error("Build check failed. Missing generated suburb-cuisine page: /durban/chatsworth/indian");
}
const comboHtml = fs.readFileSync(comboPage, "utf8");
if (!comboHtml.includes("Indian Cuisine Food Delivery in Chatsworth, Durban | Home-Made")) {
  throw new Error("Build check failed. Suburb-cuisine page missing tailored SEO title.");
}
for (const needle of ['"@type":"FAQPage"', "How ordering works", "100% of the food payment goes to the seller", "Exact collection or delivery details are shared privately"]) {
  if (!comboHtml.includes(needle)) throw new Error(`Build check failed. Suburb-cuisine page missing GEO content: ${needle}`);
}
const sitemap = fs.readFileSync(sitemapPath, "utf8");
for (const needle of ["/durban</loc>", "/cuisine</loc>", "/durban/westville</loc>", "/cuisine/indian</loc>", "/durban/chatsworth/indian</loc>", "/durban/westville/street</loc>", "/terms</loc>", "/privacy</loc>", "/legal</loc>"]) {
  if (!sitemap.includes(needle)) throw new Error(`Build check failed. Sitemap missing: ${needle}`);
}
for (const stale of ["/browse/westville</loc>", "/categories/indian</loc>"]) {
  if (sitemap.includes(stale)) throw new Error(`Build check failed. Sitemap contains old canonical path: ${stale}`);
}
for (const needle of ["/browse-sellers", "/durban", "/cuisine", "/markets-events"]) {
  if (!html.includes(`href="${needle}"`)) throw new Error(`Build check failed. Homepage missing crawlable link: ${needle}`);
}
for (const needle of ["/durban/chatsworth/indian", "/durban/westville/street", "Popular local searches"]) {
  if (!html.includes(needle)) throw new Error(`Build check failed. Homepage missing high-intent local SEO link: ${needle}`);
}
for (const needle of ['href="/terms"', 'href="/privacy"', 'href="/legal"', "&copy; 2026 Home-Made"]) {
  if (!html.includes(needle)) throw new Error(`Build check failed. Homepage missing legal notice: ${needle}`);
}
const robots = fs.readFileSync(robotsPath, "utf8");
for (const needle of ["Disallow: /dashboard/", "Disallow: /auth/", "Disallow: /checkout/", "Sitemap: https://www.home-made.co.za/sitemap.xml"]) {
  if (!robots.includes(needle)) throw new Error(`Build check failed. Robots.txt missing: ${needle}`);
}
const vercel = fs.readFileSync(path.join(root, "vercel.json"), "utf8");
for (const needle of ["Strict-Transport-Security", "home-made.co.za", "/durban/:suburb/:category"]) {
  if (!vercel.includes(needle)) throw new Error(`Build check failed. Vercel routing missing: ${needle}`);
}
if (html.includes("/rest/v1/sellers?select=*")) {
  throw new Error("Build check failed. Public seller API request exposes private seller fields.");
}
if (removedContactFieldPattern.test(sourceHtml) || removedContactFieldPattern.test(html)) {
  throw new Error("Build check failed. Frontend contains removed contact identifier field.");
}
if (/wa\s*:\s*row\.wa/i.test(sourceHtml) || /wa\s*:\s*d\.wa/i.test(sourceHtml)) {
  throw new Error("Build check failed. Public frontend seller state retains directory wa.");
}
for (const [label, text] of [
  ["public/index.html", html],
  ["public/browse-sellers.html", fs.readFileSync(path.join(root, "public", "browse-sellers.html"), "utf8")],
  ["scripts/build-seo-pages.js", fs.readFileSync(path.join(root, "scripts", "build-seo-pages.js"), "utf8")]
]) {
  if (/SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY/.test(text)) {
    throw new Error(`Build check failed. ${label} contains service-role key names.`);
  }
  if (/https:\/\/wa\.me\/\d/i.test(text)) {
    throw new Error(`Build check failed. ${label} contains a direct WhatsApp number.`);
  }
  if (/"telephone"\s*:/i.test(text)) {
    throw new Error(`Build check failed. ${label} contains schema telephone.`);
  }
  if (removedContactFieldPattern.test(text)) {
    throw new Error(`Build check failed. ${label} contains removed contact identifier field.`);
  }
}

console.log(`Build check passed with ${sellerPages.length} privacy-safe seller pages, ${durbanPages.length} Durban pages and ${cuisinePages.length} cuisine pages.`);
