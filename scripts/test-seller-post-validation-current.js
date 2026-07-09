const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const sourcePath = path.join(root, "src", "homemade-map-cleaned-1.html");
const normalizePath = path.join(root, "src", "helpers", "input-normalization-helpers.js");
const validationHelperPath = path.join(root, "src", "helpers", "seller-post-validation-helpers.js");
const sourceHtml = fs.readFileSync(sourcePath, "utf8");
const normalizeSource = fs.readFileSync(normalizePath, "utf8");
const validationHelperSource = fs.readFileSync(validationHelperPath, "utf8");
const functionNames = [
  "postMissingAll",
  "postFirstMissingStep",
  "postCanContinue"
];
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
  "ADM",
  "CART"
];

let checks = 0;
function check(name, fn) {
  fn();
  checks += 1;
}

function extractFunction(source, name) {
  const pattern = new RegExp(`function\\s+${name}\\s*\\(`);
  const match = pattern.exec(source);
  if (!match) throw new Error(`Could not find function ${name}`);
  const start = match.index;
  const open = source.indexOf("{", match.index + match[0].length);
  if (open < 0) throw new Error(`Could not find opening brace for ${name}`);

  let depth = 0;
  let quote = "";
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let i = open; i < source.length; i += 1) {
    const ch = source[i];
    const next = source[i + 1];

    if (lineComment) {
      if (ch === "\n" || ch === "\r") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (ch === "*" && next === "/") {
        blockComment = false;
        i += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === quote) {
        quote = "";
      }
      continue;
    }

    if (ch === "/" && next === "/") {
      lineComment = true;
      i += 1;
      continue;
    }
    if (ch === "/" && next === "*") {
      blockComment = true;
      i += 1;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`Could not find closing brace for ${name}`);
}

const validationSource = functionNames.map((name) => extractFunction(sourceHtml, name)).join("\n\n");
const evaluatedSource = `${normalizeSource}\n\n${validationHelperSource}\n\n${validationSource}`;

check("evaluated validation functions avoid forbidden browser/backend dependencies", () => {
  for (const dependency of forbiddenDependencies) {
    assert.equal(new RegExp(`\\b${dependency}\\b`).test(evaluatedSource), false, `Unexpected dependency: ${dependency}`);
  }
});

const context = vm.createContext({ ST: {} });
vm.runInContext(evaluatedSource, context, { filename: "seller-post-validation-current.js" });

function validPostForm(overrides = {}) {
  return Object.assign({
    name: "Rose's Kitchen",
    desc: "Fresh homemade food.",
    wa: "+27 (82) 123-4567",
    waConfirm: "27821234567",
    img: "data:image/jpeg;base64,listing",
    region: "Westville",
    cat: "indian",
    del: false,
    fee: "",
    pu: true,
    timeframe: "weekly",
    legalAccepted: true
  }, overrides);
}

function validItem(overrides = {}) {
  return Object.assign({
    n: "Biryani",
    p: "89.95",
    svs: "1 person",
    img: "data:image/jpeg;base64,item"
  }, overrides);
}

function setState({ pf = validPostForm(), items = [validItem()], ps = 1 } = {}) {
  context.ST.pf = pf;
  context.ST.pi = items;
  context.ST.ps = ps;
}

function missingForStep(step) {
  return JSON.parse(JSON.stringify(vm.runInContext(`postMissingForStep(${step})`, context)));
}

function missingAll() {
  return JSON.parse(JSON.stringify(vm.runInContext("postMissingAll()", context)));
}

function firstMissingStep() {
  return vm.runInContext("postFirstMissingStep()", context);
}

function canContinue(stepExpression) {
  return vm.runInContext(`postCanContinue(${stepExpression})`, context);
}

function expectMissing(step, expected, setup) {
  setState(setup);
  assert.deepEqual(missingForStep(step), expected);
}

check("valid step 1 returns no missing keys", () => expectMissing(1, []));
check("missing business/store name returns current key", () => expectMissing(1, ["name"], { pf: validPostForm({ name: "" }) }));
check("missing description returns current key", () => expectMissing(1, ["desc"], { pf: validPostForm({ desc: "" }) }));
check("missing phone returns current key", () => expectMissing(1, ["wa", "waConfirm"], { pf: validPostForm({ wa: "", waConfirm: "27821234567" }) }));
check("phone shorter than current normalized threshold returns current key", () => expectMissing(1, ["wa"], { pf: validPostForm({ wa: "12345678", waConfirm: "12345678" }) }));
check("formatted phone that normalizes to a valid value passes", () => expectMissing(1, [], { pf: validPostForm({ wa: "+27 (82) 123-4567", waConfirm: "27821234567" }) }));
check("confirm phone missing returns current key", () => expectMissing(1, ["waConfirm"], { pf: validPostForm({ waConfirm: "" }) }));
check("confirm phone mismatch after normalization returns current key", () => expectMissing(1, ["waConfirm"], { pf: validPostForm({ waConfirm: "27820000000" }) }));
check("confirm phone match after normalization passes", () => expectMissing(1, [], { pf: validPostForm({ wa: "+27 82 123 4567", waConfirm: "27821234567" }) }));
check("missing main listing image returns current key", () => expectMissing(1, ["listingPhoto"], { pf: validPostForm({ img: "" }) }));
check("missing region returns current key", () => expectMissing(1, ["region"], { pf: validPostForm({ region: "" }) }));
check("missing category returns current key", () => expectMissing(1, ["cat"], { pf: validPostForm({ cat: "" }) }));
check("delivery false and pickup false returns fulfilment key", () => expectMissing(1, ["fulfilment"], { pf: validPostForm({ del: false, pu: false }) }));
check("delivery true with empty fee returns current fee key", () => expectMissing(1, ["fee"], { pf: validPostForm({ del: true, fee: "" }) }));
check("delivery true with non-empty fee passes current fee check", () => expectMissing(1, [], { pf: validPostForm({ del: true, fee: "0" }) }));
check("pickup true with delivery false passes fulfilment", () => expectMissing(1, [], { pf: validPostForm({ del: false, pu: true }) }));

check("empty item list returns current item-list key", () => expectMissing(2, ["items"], { items: [] }));
check("one valid item returns no step-2 missing keys", () => expectMissing(2, []));
check("missing item name returns exact indexed key", () => expectMissing(2, ["itemName_0"], { items: [validItem({ n: "" })] }));
check("item price 0 returns exact indexed key", () => expectMissing(2, ["itemPrice_0"], { items: [validItem({ p: 0 })] }));
check("item price empty returns exact indexed key", () => expectMissing(2, ["itemPrice_0"], { items: [validItem({ p: "" })] }));
check("item price invalid returns exact indexed key", () => expectMissing(2, ["itemPrice_0"], { items: [validItem({ p: "not-a-price" })] }));
check("item price negative follows current implementation", () => expectMissing(2, ["itemPrice_0"], { items: [validItem({ p: -5 })] }));
check("item price positive numeric string passes", () => expectMissing(2, [], { items: [validItem({ p: "12" })] }));
check("item price positive decimal passes", () => expectMissing(2, [], { items: [validItem({ p: "12.75" })] }));
check("missing serving/value returns exact indexed key", () => expectMissing(2, ["itemServing_0"], { items: [validItem({ svs: "" })] }));
check("missing item image returns exact indexed key", () => expectMissing(2, ["itemPhoto_0"], { items: [validItem({ img: "" })] }));
check("multiple items return exact indexed keys for the failing item", () => {
  expectMissing(2, ["itemName_1", "itemPrice_1", "itemServing_1", "itemPhoto_1"], {
    items: [validItem(), validItem({ n: "", p: "", svs: "", img: "" })]
  });
});

check("valid step 3 returns no missing keys", () => expectMissing(3, []));
check("missing timeframe returns current key", () => expectMissing(3, ["timeframe"], { pf: validPostForm({ timeframe: "" }) }));
check("missing legal acceptance returns current key", () => expectMissing(3, ["legal"], { pf: validPostForm({ legalAccepted: false }) }));
check("both publish fields missing return keys in current order", () => expectMissing(3, ["timeframe", "legal"], { pf: validPostForm({ timeframe: "", legalAccepted: false }) }));

check("postMissingAll returns the combined current missing list", () => {
  setState({
    pf: validPostForm({ name: "", timeframe: "", legalAccepted: false }),
    items: [validItem({ p: "" })]
  });
  assert.deepEqual(missingAll(), ["name", "itemPrice_0", "timeframe", "legal"]);
});
check("postFirstMissingStep returns the current first failing step", () => {
  setState({ pf: validPostForm(), items: [validItem({ p: "" })], ps: 3 });
  assert.equal(firstMissingStep(), 2);
});
check("postFirstMissingStep falls back to ST.ps when all steps pass", () => {
  setState({ ps: 3 });
  assert.equal(firstMissingStep(), 3);
});
check("postCanContinue returns true for a valid current step", () => {
  setState();
  assert.equal(canContinue("1"), true);
});
check("postCanContinue returns false for an invalid current step", () => {
  setState({ pf: validPostForm({ name: "" }) });
  assert.equal(canContinue("1"), false);
});
check("ST.ps affects postCanContinue only when passed as the step argument", () => {
  setState({ pf: validPostForm(), items: [validItem({ p: "" })], ps: 2 });
  assert.equal(canContinue("1"), true);
  assert.equal(canContinue("ST.ps"), false);
});

console.log(`Seller-post validation characterization tests passed: ${checks}`);
