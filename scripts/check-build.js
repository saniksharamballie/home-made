const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const htmlPath = path.join(root, "public", "index.html");
const serviceWorkerPath = path.join(root, "public", "sw.js");
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
if (!fs.existsSync(serviceWorkerPath)) {
  throw new Error("Missing public/sw.js.");
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
const serviceWorker = fs.readFileSync(serviceWorkerPath, "utf8");
const removedContactFieldPattern = new RegExp(`contact(?:${"I"}d|_${"i"}d)`, "i");
const helperIncludeMarker = "/* @include src/helpers/formatting-tier-helpers.js */";
const textHelperIncludeMarker = "/* @include src/helpers/text-escape-helpers.js */";
const dateTimeHelperIncludeMarker = "/* @include src/helpers/date-time-helpers.js */";
const currencyHelperIncludeMarker = "/* @include src/helpers/currency-format-helpers.js */";
const filterRegionIncludeMarker = "/* @include src/helpers/filter-region-constants.js */";
const categoryCatalogIncludeMarker = "/* @include src/helpers/category-catalog-constants.js */";
const storageKeyIncludeMarker = "/* @include src/helpers/storage-key-constants.js */";
const sellerOwnerHydrationIncludeMarker = "/* @include src/helpers/seller-owner-hydration-helpers.js */";
const inputNormalizationIncludeMarker = "/* @include src/helpers/input-normalization-helpers.js */";
const sellerPostItemIncludeMarker = "/* @include src/helpers/seller-post-item-helpers.js */";
const sellerPostValidationIncludeMarker = "/* @include src/helpers/seller-post-validation-helpers.js */";
const listingDraftIncludeMarker = "/* @include src/helpers/listing-draft-helpers.js */";
const listingDraftNavigationIncludeMarker = "/* @include src/helpers/listing-draft-navigation-helpers.js */";
const sellerStorefrontSelectiveSaveIncludeMarker = "/* @include src/helpers/seller-storefront-selective-save-helpers.js */";
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
const listingDraftDeclaration = "function buildInactiveListingDraftPatch";
const listingDraftNavigationDeclaration = "function canNavigateInactiveListingDraft";
const sellerStorefrontSelectiveSaveDeclaration = "function buildSellerStorefrontSelectivePatch";
const sellerOwnerHydrationDeclarations = [
  "function normalizePrivateOwnerSeller",
  "function resolveOwnerSellerState"
];
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
    label: "seller owner hydration helper",
    marker: sellerOwnerHydrationIncludeMarker,
    generatedMarkerPattern: /@include\s+src\/helpers\/seller-owner-hydration-helpers\.js/,
    declarations: sellerOwnerHydrationDeclarations,
    declarationLabel: "seller owner hydration declaration",
    declarationOrder: true,
    orderLabel: "Seller owner hydration declaration",
    classicScriptLabel: "seller owner hydration helpers",
    classicMovedLabel: "Seller owner hydration helpers"
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
  },
  {
    label: "listing draft helper",
    marker: listingDraftIncludeMarker,
    generatedMarkerPattern: /@include\s+src\/helpers\/listing-draft-helpers\.js/,
    declarations: [listingDraftDeclaration],
    declarationLabel: "listing draft helper",
    classicScriptLabel: "the listing draft helper",
    classicMovedLabel: "Listing draft helper"
  },
  {
    label: "listing draft navigation helper",
    marker: listingDraftNavigationIncludeMarker,
    generatedMarkerPattern: /@include\s+src\/helpers\/listing-draft-navigation-helpers\.js/,
    declarations: [listingDraftNavigationDeclaration],
    declarationLabel: "listing draft navigation helper",
    classicScriptLabel: "the listing draft navigation helper",
    classicMovedLabel: "Listing draft navigation helper"
  },
  {
    label: "seller storefront selective-save helper",
    marker: sellerStorefrontSelectiveSaveIncludeMarker,
    generatedMarkerPattern: /@include\s+src\/helpers\/seller-storefront-selective-save-helpers\.js/,
    declarations: [sellerStorefrontSelectiveSaveDeclaration],
    declarationLabel: "seller storefront selective-save helper",
    classicScriptLabel: "the seller storefront selective-save helper",
    classicMovedLabel: "Seller storefront selective-save helper"
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
if (occurrenceCount(sourceHtml, "function saveInactiveListingDraft()") !== 1 || occurrenceCount(html, "function saveInactiveListingDraft()") !== 1) {
  throw new Error("Build check failed. Expected exactly one inactive listing draft save implementation.");
}
if (occurrenceCount(sourceHtml, "function goLiveListing()") !== 1 || occurrenceCount(html, "function goLiveListing()") !== 1) {
  throw new Error("Build check failed. Expected exactly one goLiveListing implementation.");
}
if (html.indexOf(listingDraftDeclaration) > html.indexOf("function saveInactiveListingDraft()")) {
  throw new Error("Build check failed. Listing draft helper must be declared before draft save usage.");
}
if (html.indexOf(listingDraftNavigationDeclaration) > html.indexOf("function postNext(")) {
  throw new Error("Build check failed. Listing draft navigation helper must be declared before navigation usage.");
}
if (!html.includes("Save Draft") || !html.includes("No draft changes to save.")) {
  throw new Error("Build check failed. Listing draft UI or no-op guard is missing.");
}
const draftSaveStart = sourceHtml.indexOf("function saveInactiveListingDraft()");
const draftSaveEnd = sourceHtml.indexOf("\nfunction inactiveListingDraftButton()", draftSaveStart);
const draftSaveBody = sourceHtml.slice(draftSaveStart, draftSaveEnd);
for (const forbidden of [
  "goLiveListing", "buildPublishedSeller", "persistPublishedSeller", "uploadListingImg", "uploadMenuItemImg",
  "seller-images", "listing-uploads", "getPublicUrl", "seller_directory", "SELLERS", "WhatsApp"
]) {
  if (draftSaveBody.includes(forbidden)) {
    throw new Error(`Build check failed. Draft save references forbidden publish, storage or public state: ${forbidden}.`);
  }
}
if (/\bactive\s*[:=]/.test(draftSaveBody) || !draftSaveBody.includes("patch.sellerValues")) {
  throw new Error("Build check failed. Draft save may alter active state or bypass the selective patch.");
}
const draftNavigationStart = sourceHtml.indexOf("function postNext(");
const draftNavigationEnd = sourceHtml.indexOf("\nfunction campaignEndForTimeframe(", draftNavigationStart);
const draftNavigationBody = sourceHtml.slice(draftNavigationStart, draftNavigationEnd);
if (!draftNavigationBody.includes("canNavigateInactiveListingDraft(hmPrivateOwnerSellerForDraft()") || !draftNavigationBody.includes("postMissingForStep(ST.ps||1)")) {
  throw new Error("Build check failed. Draft navigation and publication validation are not separated safely.");
}
for (const forbidden of [
  "saveInactiveListingDraft", "goLiveListing", "buildPublishedSeller", "persistPublishedSeller",
  "uploadListingImg", "uploadMenuItemImg", "seller_directory", "SELLERS", "WhatsApp", "hmAuth.update"
]) {
  if (draftNavigationBody.includes(forbidden)) {
    throw new Error(`Build check failed. Draft navigation references a write, upload, publish, contact or public path: ${forbidden}.`);
  }
}
if (/\bactive\s*[:=]/.test(draftNavigationBody)) {
  throw new Error("Build check failed. Draft navigation may mutate active state.");
}
const goLiveStart = sourceHtml.indexOf("function goLiveListing()");
const goLiveEnd = sourceHtml.indexOf("\nfunction openSellerRequestModal(", goLiveStart);
const goLiveBody = sourceHtml.slice(goLiveStart, goLiveEnd);
if (!goLiveBody.includes("postMissingAll()") || !goLiveBody.includes("buildPublishedSeller()") || !goLiveBody.includes("persistPublishedSeller(")) {
  throw new Error("Build check failed. Go Live no longer retains complete publication validation and persistence.");
}
if (!sourceHtml.includes("postCanNavigateForward(2)") || !sourceHtml.includes("postCanNavigateForward(3)")) {
  throw new Error("Build check failed. Draft step controls are not using the navigation-only guard.");
}
const nextMenuButtonPattern = /<button\s+type="button"[^>]*onclick="goPS\(2\)"[^>]*>[\s\S]*?Next: Menu[\s\S]*?<\/button>/;
if (!nextMenuButtonPattern.test(sourceHtml) || !nextMenuButtonPattern.test(html)) {
  throw new Error("Build check failed. Next: Menu must remain an explicit non-submit goPS(2) control.");
}
if (/nav\(['"]rate['"]\)/.test(draftNavigationBody)) {
  throw new Error("Build check failed. Listing wizard navigation must not depend on the rating route.");
}
const signOutControlPattern = /<button[^>]*onclick="hmAuth\.signOut\(\)"[^>]*>[\s\S]*?Sign Out[\s\S]*?<\/button>/;
if (!signOutControlPattern.test(sourceHtml) || !signOutControlPattern.test(html)) {
  throw new Error("Build check failed. The account Sign Out control must remain bound to hmAuth.signOut().");
}
const signOutStart = sourceHtml.indexOf("function signOut(");
const signOutEnd = sourceHtml.indexOf("\n  /* Insert a row", signOutStart);
const signOutBody = sourceHtml.slice(signOutStart, signOutEnd);
if (!signOutBody.includes("forceLanding:'home'") || !signOutBody.includes("role:'guest'") || /nav\(['"]wantlist['"]\)/.test(signOutBody)) {
  throw new Error("Build check failed. Sign out must apply Guest/Home state without routing to Want List.");
}
const externalCacheVersion = /const VERSION = "(hm-prod-v\d+)"/.exec(serviceWorker);
const inlineCacheVersion = /var SV="(hm-prod-v\d+)"/.exec(sourceHtml);
if (!externalCacheVersion || !inlineCacheVersion || externalCacheVersion[1] !== "hm-prod-v67" || inlineCacheVersion[1] !== externalCacheVersion[1]) {
  throw new Error("Build check failed. External and inline service workers must share hm-prod-v67.");
}
for (const needle of [
  "isPrivateRequest(request, url)",
  "request.headers.has(\"authorization\")",
  "request.headers.has(\"apikey\")",
  "host.endsWith(\".supabase.co\")",
  "url.pathname.startsWith(\"/api/\")",
  "url.origin !== self.location.origin",
  "isPublicStaticRequest(request, url)"
]) {
  if (!serviceWorker.includes(needle)) {
    throw new Error(`Build check failed. External service-worker private-cache guard is missing: ${needle}.`);
  }
}
for (const needle of [
  "isPrivate(req,url)",
  "r.headers.has(\"authorization\")",
  "r.headers.has(\"apikey\")",
  "h.endsWith(\".supabase.co\")",
  "u.pathname.indexOf(\"/api/\")===0",
  "u.origin!==self.location.origin",
  "isPublicStatic(req,url)"
]) {
  if (!sourceHtml.includes(needle)) {
    throw new Error(`Build check failed. Inline service-worker private-cache guard is missing: ${needle}.`);
  }
}
if (!serviceWorker.includes("isHomeMadeCacheName(key) && ![SHELL, RUNTIME].includes(key)") ||
    !sourceHtml.includes("isHmCache(k)&&!VALID.includes(k)")) {
  throw new Error("Build check failed. Cache activation must remove old Home-Made caches without deleting unrelated caches.");
}
if (occurrenceCount(sourceHtml, "function hydrateInactiveListingDraft()") !== 1 ||
    occurrenceCount(html, "function hydrateInactiveListingDraft()") !== 1) {
  throw new Error("Build check failed. Expected exactly one inactive listing draft hydration implementation.");
}
if (sourceHtml.includes("_inactiveListingDraftHydratedFor") || html.includes("_inactiveListingDraftHydratedFor")) {
  throw new Error("Build check failed. Seller-only draft hydration state remains.");
}
for (const needle of [
  "listingDraftHydrationKey(seller.id,stored)",
  "inactiveListingDraftFormDirty()",
  "applyFreshPrivateSellerState",
  "clearInactiveListingDraftHydrationState",
  "Your saved draft could not be loaded. Refresh and try again before saving."
]) {
  if (!sourceHtml.includes(needle) || !html.includes(needle)) {
    throw new Error(`Build check failed. Draft rehydration guard is missing: ${needle}.`);
  }
}
if (!sourceHtml.includes("if(typeof syncInactiveListingDraftAccount==='function') syncInactiveListingDraftAccount(p)") ||
    !sourceHtml.includes("if(typeof clearInactiveListingDraftHydrationState==='function') clearInactiveListingDraftHydrationState()")) {
  throw new Error("Build check failed. Account application and sign-out must clear seller-specific draft hydration state.");
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
const hmAuthWrapperIndex = html.indexOf("var hmAuth = (function(){");
if (hmAuthWrapperIndex < 0) {
  throw new Error("Build check failed. Could not locate hmAuth wrapper.");
}
for (const declaration of storageKeyDeclarations) {
  if (html.indexOf(declaration) > hmAuthWrapperIndex) {
    throw new Error(`Build check failed. Storage key declaration ${declaration} must stay in app-level scope before hmAuth.`);
  }
}
for (const declaration of sellerOwnerHydrationDeclarations) {
  if (html.indexOf(declaration) > hmAuthWrapperIndex) {
    throw new Error(`Build check failed. Seller owner hydration declaration ${declaration} must stay in app-level scope before hmAuth.`);
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
