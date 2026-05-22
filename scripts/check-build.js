const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const htmlPath = path.join(root, "public", "index.html");
const envPath = path.join(root, "public", "env.js");
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

const html = fs.readFileSync(htmlPath, "utf8");
const env = fs.readFileSync(envPath, "utf8");

for (const needle of required) {
  if (!html.includes(needle) && !env.includes(needle)) {
    throw new Error(`Build check failed. Missing: ${needle}`);
  }
}

console.log("Build check passed.");
