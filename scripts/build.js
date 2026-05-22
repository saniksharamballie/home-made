const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const src = path.join(root, "src", "homemade-map-cleaned-1.html");
const outDir = path.join(root, "public");
const out = path.join(outDir, "index.html");
const envOut = path.join(outDir, "env.js");

function jsString(value) {
  return JSON.stringify(value || "");
}

function build() {
  fs.mkdirSync(outDir, { recursive: true });

  let html = fs.readFileSync(src, "utf8");
  html = html.replace(/^\s*\+''/, "");

  if (!html.includes("/env.js")) {
    html = html.replace(
      "</head>",
      '<script src="/env.js"></script>\n</head>'
    );
  }

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
      "var ADMIN_EMAIL = (window.HM_CONFIG && window.HM_CONFIG.ADMIN_EMAIL) || 'saniksha@gmail.com';"
    );

  const envJs = [
    "window.HM_CONFIG = {",
    `  SUPABASE_URL: ${jsString(process.env.NEXT_PUBLIC_SUPABASE_URL)},`,
    `  SUPABASE_ANON_KEY: ${jsString(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)},`,
    `  ADMIN_EMAIL: ${jsString(process.env.NEXT_PUBLIC_ADMIN_EMAIL || "saniksha@gmail.com")},`,
    `  SITE_URL: ${jsString(process.env.NEXT_PUBLIC_SITE_URL || "https://home-made.co.za")}`,
    "};",
    ""
  ].join("\n");

  fs.writeFileSync(out, html, "utf8");
  fs.writeFileSync(envOut, envJs, "utf8");
  console.log(`Built ${path.relative(root, out)}`);
}

build();

if (process.argv.includes("--watch")) {
  fs.watchFile(src, { interval: 500 }, build);
  console.log("Watching source HTML...");
}
