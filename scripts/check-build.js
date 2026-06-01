const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const htmlPath = path.join(root, "public", "index.html");
const envPath = path.join(root, "public", "env.js");
const sitemapPath = path.join(root, "public", "sitemap.xml");
const sellerDir = path.join(root, "public", "seller");
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
if (!fs.existsSync(sitemapPath) || !fs.existsSync(sellerDir)) {
  throw new Error("Missing generated SEO pages. Run npm run build first.");
}

const html = fs.readFileSync(htmlPath, "utf8");
const env = fs.readFileSync(envPath, "utf8");

for (const needle of required) {
  if (!html.includes(needle) && !env.includes(needle)) {
    throw new Error(`Build check failed. Missing: ${needle}`);
  }
}

const sellerPages = fs.readdirSync(sellerDir).filter((file) => file.endsWith(".html"));
if (!sellerPages.length) throw new Error("Build check failed. Missing public seller pages.");
for (const page of sellerPages) {
  const sellerHtml = fs.readFileSync(path.join(sellerDir, page), "utf8");
  for (const forbidden of ["latitude", "longitude", "\"geo\"", "streetAddress"]) {
    if (sellerHtml.includes(forbidden)) {
      throw new Error(`Build check failed. Public seller page leaks private location data: ${page}`);
    }
  }
}
if (html.includes("/rest/v1/sellers?select=*")) {
  throw new Error("Build check failed. Public seller API request exposes private seller fields.");
}

console.log(`Build check passed with ${sellerPages.length} privacy-safe seller pages.`);
