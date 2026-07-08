const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const helperPath = path.join(root, "src", "helpers", "text-escape-helpers.js");
const source = fs.readFileSync(helperPath, "utf8");
const forbiddenDependencies = [
  "document",
  "window",
  "localStorage",
  "sessionStorage",
  "navigator",
  "fetch",
  "supabase",
  "hmAuth",
  "SELLERS",
  "ST",
  "ADM",
  "CART"
];

let checks = 0;
function check(name, fn) {
  fn();
  checks += 1;
}

check("helper partial avoids browser and app state dependencies", () => {
  for (const dependency of forbiddenDependencies) {
    assert.equal(new RegExp(`\\b${dependency}\\b`).test(source), false, `Unexpected dependency: ${dependency}`);
  }
});

const context = vm.createContext({ String });
vm.runInContext(source, context, { filename: helperPath });

const result = vm.runInContext(`
({
  hmTextNull: hmText(null),
  hmTextUndefined: hmText(undefined),
  hmTextString: hmText('Home-Made'),
  hmTextNumber: hmText(42),
  hmTextAmp: hmText('A & B'),
  hmTextLt: hmText('<tag'),
  hmTextGt: hmText('tag>'),
  hmTextDoubleQuote: hmText('"quoted"'),
  hmTextSingleQuote: hmText("Bob's"),
  hmTextMixed: hmText('<div title="Bob\\'s & Co">'),
  hmJsNull: hmJs(null),
  hmJsUndefined: hmJs(undefined),
  hmJsString: hmJs('Home-Made'),
  hmJsNumber: hmJs(42),
  hmJsBackslash: hmJs('C:\\\\Temp'),
  hmJsSingleQuote: hmJs("Bob's"),
  hmJsCrLf: hmJs('Line 1\\r\\nLine 2\\nLine 3'),
  hmJsMixed: hmJs("Bob's \\\\ Kitchen\\r\\nLine 2")
})
`, context, { filename: "text-escape-helper-access-test.js" });

check("hmText handles null and undefined", () => assert.deepEqual([result.hmTextNull, result.hmTextUndefined], ["", ""]));
check("hmText coerces strings and numbers", () => assert.deepEqual([result.hmTextString, result.hmTextNumber], ["Home-Made", "42"]));
check("hmText escapes ampersand", () => assert.equal(result.hmTextAmp, "A &amp; B"));
check("hmText escapes less-than", () => assert.equal(result.hmTextLt, "&lt;tag"));
check("hmText escapes greater-than", () => assert.equal(result.hmTextGt, "tag&gt;"));
check("hmText escapes double quote", () => assert.equal(result.hmTextDoubleQuote, "&quot;quoted&quot;"));
check("hmText escapes single quote", () => assert.equal(result.hmTextSingleQuote, "Bob&#39;s"));
check("hmText escapes mixed HTML-sensitive strings", () => assert.equal(result.hmTextMixed, "&lt;div title=&quot;Bob&#39;s &amp; Co&quot;&gt;"));
check("hmJs handles null and undefined", () => assert.deepEqual([result.hmJsNull, result.hmJsUndefined], ["", ""]));
check("hmJs coerces strings and numbers", () => assert.deepEqual([result.hmJsString, result.hmJsNumber], ["Home-Made", "42"]));
check("hmJs escapes backslashes", () => assert.equal(result.hmJsBackslash, "C:\\\\Temp"));
check("hmJs escapes single quotes", () => assert.equal(result.hmJsSingleQuote, "Bob\\'s"));
check("hmJs normalizes CR/LF", () => assert.equal(result.hmJsCrLf, "Line 1 Line 2 Line 3"));
check("hmJs escapes mixed JavaScript-sensitive strings", () => assert.equal(result.hmJsMixed, "Bob\\'s \\\\ Kitchen Line 2"));

console.log(`Text escape helper tests passed: ${checks}`);
