const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  ENV_SCRIPT_TAG,
  ensureEnvScript,
  findEnvScriptElements,
  findScriptElements
} = require("./env-script-utils");

const root = path.resolve(__dirname, "..");
const generatedPath = path.join(root, "public", "index.html");

function fixture(extraHead = "") {
  return `<!doctype html>
<html>
<head>
${extraHead}
<script>const workerRule = "/env.js"; const documentation = '<script src="/env.js"><\\/script>';</script>
<!-- <script src="/env.js"></script> -->
<script defer src="https://cdn.example/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
</head>
<body>
<script>
var SUPABASE_URL = (window.HM_CONFIG && window.HM_CONFIG.SUPABASE_URL) || "placeholder";
var hmAuth = {};
</script>
</body>
</html>`;
}

const injected = ensureEnvScript(fixture());
assert.equal(injected.inserted, true);
assert.equal(findEnvScriptElements(injected.html).length, 1);

const scripts = findScriptElements(injected.html);
const envScript = findEnvScriptElements(injected.html)[0];
const supabaseScript = scripts.find((script) => /@supabase\/supabase-js/.test(script.src));
assert.ok(envScript.start < supabaseScript.start);
assert.ok(envScript.start < injected.html.indexOf("window.HM_CONFIG"));
assert.ok(envScript.start < injected.html.indexOf("var SUPABASE_URL"));
assert.ok(envScript.start < injected.html.indexOf("var hmAuth"));

const existing = ensureEnvScript(fixture(`${ENV_SCRIPT_TAG}\n`));
assert.equal(existing.inserted, false);
assert.equal(findEnvScriptElements(existing.html).length, 1);

const equivalentExisting = ensureEnvScript(fixture("<script data-config src='./env.js'></script>\n"));
assert.equal(equivalentExisting.inserted, false);
assert.equal(findEnvScriptElements(equivalentExisting.html).length, 1);

assert.throws(
  () => ensureEnvScript(fixture(`${ENV_SCRIPT_TAG}\n${ENV_SCRIPT_TAG}\n`)),
  /at most one env\.js script element/
);

assert.equal(findEnvScriptElements(fixture()).length, 0, "Strings and comments must not count as script elements");
assert.equal(findEnvScriptElements(fixture('<script src="/assets/env.js"></script>')).length, 0);

assert.ok(fs.existsSync(generatedPath), "Run npm run build before this test");
const generated = fs.readFileSync(generatedPath, "utf8");
const generatedEnvScripts = findEnvScriptElements(generated);
assert.equal(generatedEnvScripts.length, 1);
const generatedSupabase = findScriptElements(generated).find((script) => /@supabase\/supabase-js/.test(script.src));
assert.ok(generatedSupabase);
assert.ok(generatedEnvScripts[0].start < generatedSupabase.start);
assert.ok(generatedEnvScripts[0].start < generated.indexOf("window.HM_CONFIG"));
assert.ok(generatedEnvScripts[0].start < generated.indexOf("var hmAuth = (function()"));

console.log("Env script injection guardrails passed.");
