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

for (const needle of required) {
  if (!html.includes(needle) && !env.includes(needle)) {
    throw new Error(`Build check failed. Missing: ${needle}`);
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

console.log(`Build check passed with ${sellerPages.length} privacy-safe seller pages, ${durbanPages.length} Durban pages and ${cuisinePages.length} cuisine pages.`);
