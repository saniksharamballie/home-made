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
const inputNormalizationIncludeMarker = "/* @include src/helpers/input-normalization-helpers.js */";
const sellerPostItemIncludeMarker = "/* @include src/helpers/seller-post-item-helpers.js */";
const sellerPostValidationIncludeMarker = "/* @include src/helpers/seller-post-validation-helpers.js */";
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
const inputNormalizationDeclaration = "function normalizePhoneNumber";
const sellerPostItemDeclaration = "function cleanPostItem";
const sellerPostValidationDeclaration = "function postMissingForStep";
const sourcePartials = [
  {
    label: "formatting/tier helper",
    marker: helperIncludeMarker,
    generatedMarkerPattern: /@include\s+src\/helpers\/formatting-tier-helpers\.js/,
    declarations: helperDeclarations,
    declarationLabel: "helper",
    declarationOrder: true,
    orderLabel: "Helper",
    classicScriptLabel: "helpers",
    classicMovedLabel: "Formatting/tier helpers",
    classicScriptDeclarations: ["function hmNumber"]
  },
  {
    label: "text escape helper",
    marker: textHelperIncludeMarker,
    generatedMarkerPattern: /@include\s+src\/helpers\/text-escape-helpers\.js/,
    declarations: textHelperDeclarations,
    declarationLabel: "text escape helper",
    declarationOrder: true,
    orderLabel: "Text escape helper",
    classicScriptLabel: "text escape helpers",
    classicMovedLabel: "Text escape helpers",
    classicScriptDeclarations: textHelperDeclarations,
    classicMatch: "any"
  },
  {
    label: "date/time helper",
    marker: dateTimeHelperIncludeMarker,
    generatedMarkerPattern: /@include\s+src\/helpers\/date-time-helpers\.js/,
    declarations: dateTimeHelperDeclarations,
    declarationLabel: "date/time helper",
    declarationOrder: true,
    orderLabel: "Date/time helper",
    classicScriptLabel: "date/time helpers",
    classicMovedLabel: "Date/time helpers",
    classicScriptDeclarations: dateTimeHelperDeclarations,
    classicMatch: "any"
  },
  {
    label: "currency format helper",
    marker: currencyHelperIncludeMarker,
    generatedMarkerPattern: /@include\s+src\/helpers\/currency-format-helpers\.js/,
    declarations: [currencyHelperDeclaration],
    declarationLabel: "currency format helper",
    classicScriptLabel: "the currency format helper",
    classicMovedLabel: "Currency format helper"
  },
  {
    label: "filter/region constants",
    marker: filterRegionIncludeMarker,
    generatedMarkerPattern: /@include\s+src\/helpers\/filter-region-constants\.js/,
    declarations: filterRegionDeclarations,
    declarationLabel: "filter/region declaration",
    declarationOrder: true,
    orderLabel: "Filter/region declaration",
    classicScriptLabel: "filter/region constants",
    classicMovedLabel: "Filter/region constants"
  },
  {
    label: "category catalog constants",
    marker: categoryCatalogIncludeMarker,
    generatedMarkerPattern: /@include\s+src\/helpers\/category-catalog-constants\.js/,
    declarations: [categoryCatalogDeclaration],
    declarationLabel: "category catalog declaration",
    classicScriptLabel: "category catalog constants",
    classicMovedLabel: "Category catalog constants"
  },
  {
    label: "storage key constants",
    marker: storageKeyIncludeMarker,
    generatedMarkerPattern: /@include\s+src\/helpers\/storage-key-constants\.js/,
    declarations: storageKeyDeclarations,
    declarationLabel: "storage key declaration",
    classicScriptLabel: "storage key constants",
    classicMovedLabel: "Storage key constants"
  },
  {
    label: "input normalization helper",
    marker: inputNormalizationIncludeMarker,
    generatedMarkerPattern: /@include\s+src\/helpers\/input-normalization-helpers\.js/,
    declarations: [inputNormalizationDeclaration],
    declarationLabel: "input normalization helper",
    classicScriptLabel: "the input normalization helper",
    classicMovedLabel: "Input normalization helper"
  },
  {
    label: "seller-post item helper",
    marker: sellerPostItemIncludeMarker,
    generatedMarkerPattern: /@include\s+src\/helpers\/seller-post-item-helpers\.js/,
    declarations: [sellerPostItemDeclaration],
    declarationLabel: "seller-post item helper",
    classicScriptLabel: "the seller-post item helper",
    classicMovedLabel: "Seller-post item helper"
  },
  {
    label: "seller-post validation helper",
    marker: sellerPostValidationIncludeMarker,
    generatedMarkerPattern: /@include\s+src\/helpers\/seller-post-validation-helpers\.js/,
    declarations: [sellerPostValidationDeclaration],
    declarationLabel: "seller-post validation helper",
    classicScriptLabel: "the seller-post validation helper",
    classicMovedLabel: "Seller-post validation helper"
  }
];

function occurrenceCount(text, needle) {
  return text.split(needle).length - 1;
}

function declarationMatches(script, declarations, matchMode) {
  if (matchMode === "any") return declarations.some((declaration) => script.includes(declaration));
  return declarations.every((declaration) => script.includes(declaration));
}

function checkSourcePartial(partial) {
  if (occurrenceCount(sourceHtml, partial.marker) !== 1) {
    throw new Error(`Build check failed. Source ${partial.label} include marker must exist exactly once.`);
  }
  if (html.includes(partial.marker) || partial.generatedMarkerPattern.test(html)) {
    throw new Error(`Build check failed. Generated app still contains the ${partial.label} include marker.`);
  }

  let previousDeclarationIndex = -1;
  for (const declaration of partial.declarations) {
    const count = occurrenceCount(html, declaration);
    if (count !== 1) {
      throw new Error(`Build check failed. Expected one generated ${partial.declarationLabel} declaration for ${declaration}, found ${count}.`);
    }
    if (partial.declarationOrder) {
      const index = html.indexOf(declaration);
      if (index <= previousDeclarationIndex) {
        throw new Error(`Build check failed. ${partial.orderLabel} ordering changed at ${declaration}.`);
      }
      previousDeclarationIndex = index;
    }
  }

  const classicDeclarations = partial.classicScriptDeclarations || partial.declarations;
  const scriptMatches = [...html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter((match) => declarationMatches(match[2], classicDeclarations, partial.classicMatch));
  if (scriptMatches.length !== 1) {
    throw new Error(`Build check failed. Expected one classic inline application script containing ${partial.classicScriptLabel}, found ${scriptMatches.length}.`);
  }
  if (/src\s*=|type\s*=\s*["']module["']/i.test(scriptMatches[0][1])) {
    throw new Error(`Build check failed. ${partial.classicMovedLabel} moved out of the classic inline application script.`);
  }
}

for (const needle of required) {
  if (!html.includes(needle) && !env.includes(needle)) {
    throw new Error(`Build check failed. Missing: ${needle}`);
  }
}
for (const partial of sourcePartials) {
  checkSourcePartial(partial);
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
