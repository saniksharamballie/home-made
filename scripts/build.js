const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const src = path.join(root, "src", "homemade-map-cleaned-1.html");
const outDir = path.join(root, "public");
const out = path.join(outDir, "index.html");
const envOut = path.join(outDir, "env.js");
const { buildSeoPages } = require("./build-seo-pages");
const { buildLegalPages } = require("./build-legal-pages");
const { ensureEnvScript } = require("./env-script-utils");
const sourcePartials = [
  {
    label: "formatting/tier helper",
    marker: "/* @include src/helpers/formatting-tier-helpers.js */",
    path: path.join(root, "src", "helpers", "formatting-tier-helpers.js")
  },
  {
    label: "text escape helper",
    marker: "/* @include src/helpers/text-escape-helpers.js */",
    path: path.join(root, "src", "helpers", "text-escape-helpers.js")
  },
  {
    label: "date/time helper",
    marker: "/* @include src/helpers/date-time-helpers.js */",
    path: path.join(root, "src", "helpers", "date-time-helpers.js")
  },
  {
    label: "currency format helper",
    marker: "/* @include src/helpers/currency-format-helpers.js */",
    path: path.join(root, "src", "helpers", "currency-format-helpers.js")
  },
  {
    label: "filter/region constants",
    marker: "/* @include src/helpers/filter-region-constants.js */",
    path: path.join(root, "src", "helpers", "filter-region-constants.js")
  },
  {
    label: "category catalog constants",
    marker: "/* @include src/helpers/category-catalog-constants.js */",
    path: path.join(root, "src", "helpers", "category-catalog-constants.js")
  },
  {
    label: "storage key constants",
    marker: "/* @include src/helpers/storage-key-constants.js */",
    path: path.join(root, "src", "helpers", "storage-key-constants.js")
  },
  {
    label: "seller owner hydration helper",
    marker: "/* @include src/helpers/seller-owner-hydration-helpers.js */",
    path: path.join(root, "src", "helpers", "seller-owner-hydration-helpers.js")
  },
  {
    label: "input normalization helper",
    marker: "/* @include src/helpers/input-normalization-helpers.js */",
    path: path.join(root, "src", "helpers", "input-normalization-helpers.js")
  },
  {
    label: "seller post item helper",
    marker: "/* @include src/helpers/seller-post-item-helpers.js */",
    path: path.join(root, "src", "helpers", "seller-post-item-helpers.js")
  },
  {
    label: "seller post validation helper",
    marker: "/* @include src/helpers/seller-post-validation-helpers.js */",
    path: path.join(root, "src", "helpers", "seller-post-validation-helpers.js")
  },
  {
    label: "listing draft image helper",
    marker: "/* @include src/helpers/listing-draft-image-helpers.js */",
    path: path.join(root, "src", "helpers", "listing-draft-image-helpers.js")
  },
  {
    label: "listing draft helper",
    marker: "/* @include src/helpers/listing-draft-helpers.js */",
    path: path.join(root, "src", "helpers", "listing-draft-helpers.js")
  },
  {
    label: "listing draft navigation helper",
    marker: "/* @include src/helpers/listing-draft-navigation-helpers.js */",
    path: path.join(root, "src", "helpers", "listing-draft-navigation-helpers.js")
  },
  {
    label: "seller storefront selective-save helper",
    marker: "/* @include src/helpers/seller-storefront-selective-save-helpers.js */",
    path: path.join(root, "src", "helpers", "seller-storefront-selective-save-helpers.js")
  }
];

function includeSourcePartials(html) {
  for (const partial of sourcePartials) {
    const markerCount = html.split(partial.marker).length - 1;
    if (markerCount !== 1) {
      throw new Error(`Expected exactly one ${partial.label} include marker, found ${markerCount}.`);
    }
    if (!fs.existsSync(partial.path)) {
      throw new Error(`Missing ${partial.label} source: ${path.relative(root, partial.path)}`);
    }
    const helpers = fs.readFileSync(partial.path, "utf8").trim();
    html = html.replace(partial.marker, helpers);
  }
  return html;
}

function jsString(value) {
  return JSON.stringify(value || "");
}

async function build() {
  fs.mkdirSync(outDir, { recursive: true });

  let html = fs.readFileSync(src, "utf8");
  html = html.replace(/^\s*\+''/, "");
  html = includeSourcePartials(html);

  html = ensureEnvScript(html).html;

  html = html
    .replace(
      /var SUPABASE_URL\s*=\s*'YOUR_SUPABASE_URL';\s*\/\/[^\n]*/g,
      "var SUPABASE_URL = (window.HM_CONFIG && window.HM_CONFIG.SUPABASE_URL) || 'YOUR_SUPABASE_URL';"
    )
    .replace(
      /var SUPABASE_ANON\s*=\s*'YOUR_SUPABASE_ANON_KEY';/g,
      "var SUPABASE_ANON = (window.HM_CONFIG && window.HM_CONFIG.SUPABASE_ANON_KEY) || 'YOUR_SUPABASE_ANON_KEY';"
    )
    .replace(
      /var ADMIN_EMAIL\s*=\s*'admin@yourdomain.com';\s*\/\/[^\n]*/g,
      "var ADMIN_EMAIL = (window.HM_CONFIG && window.HM_CONFIG.ADMIN_EMAIL) || 'saniksha@gmail.com,sycoticzn@gmail.com';"
    );

  const envJs = [
    "window.HM_CONFIG = {",
    `  SUPABASE_URL: ${jsString(process.env.NEXT_PUBLIC_SUPABASE_URL)},`,
    `  SUPABASE_ANON_KEY: ${jsString(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)},`,
    `  ADMIN_EMAIL: ${jsString(process.env.NEXT_PUBLIC_ADMIN_EMAIL || "saniksha@gmail.com,sycoticzn@gmail.com")},`,
    `  SITE_URL: ${jsString(process.env.NEXT_PUBLIC_SITE_URL || "https://www.home-made.co.za")}`,
    "};",
    ""
  ].join("\n");

  fs.writeFileSync(out, html, "utf8");
  fs.writeFileSync(envOut, envJs, "utf8");
  buildLegalPages();
  await buildSeoPages();
  console.log(`Built ${path.relative(root, out)}`);
}

build().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

if (process.argv.includes("--watch")) {
  fs.watchFile(src, { interval: 500 }, () => build().catch(console.error));
  for (const partial of sourcePartials) {
    fs.watchFile(partial.path, { interval: 500 }, () => build().catch(console.error));
  }
  console.log("Watching source HTML...");
}
