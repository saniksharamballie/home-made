const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "src", "homemade-map-cleaned-1.html"), "utf8");
const generated = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");

function extractFunction(input, name) {
  const marker = new RegExp(`function\\s+${name}\\s*\\(`).exec(input);
  assert.ok(marker, `${name} was not found`);
  const start = marker.index;
  const open = input.indexOf("{", start + marker[0].length);
  let depth = 0;
  let quote = "";
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let i = open; i < input.length; i += 1) {
    const ch = input[i];
    const next = input[i + 1];
    if (lineComment) { if (ch === "\n" || ch === "\r") lineComment = false; continue; }
    if (blockComment) { if (ch === "*" && next === "/") { blockComment = false; i += 1; } continue; }
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === "/" && next === "/") { lineComment = true; i += 1; continue; }
    if (ch === "/" && next === "*") { blockComment = true; i += 1; continue; }
    if (ch === "'" || ch === '"' || ch === "`") { quote = ch; continue; }
    if (ch === "{") depth += 1;
    if (ch === "}" && --depth === 0) return input.slice(start, i + 1);
  }
  throw new Error(`${name} body did not close`);
}

function renderedButton(html, label) {
  const buttons = [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)]
    .filter((match) => match[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").includes(label));
  assert.equal(buttons.length, 1, `Expected one rendered ${label} button`);
  const attrs = buttons[0][1];
  const attr = (name) => (new RegExp(`${name}="([^"]*)"`).exec(attrs) || [])[1] || null;
  return { tagName: "BUTTON", type: attr("type"), onclick: attr("onclick") };
}

const pagePost = { innerHTML: "" };
const ownerSeller = { id: "owner-seller", active: false, public: false };
const calls = { nav: [], save: 0, live: 0, listingUpload: 0, itemUpload: 0, contact: 0 };
const context = vm.createContext({
  ST: {
    ps: 1,
    pt: "standard",
    pf: {
      name: "", desc: "", region: "", cat: "other", dietary: [], healthTags: [],
      del: false, fee: "", pu: true, timeframe: "weekly", wa: "", waConfirm: "",
      img: "", imgPath: "", imgName: "", imgUploading: false, imgError: "",
      legalAccepted: false
    },
    pi: [{ n: "", p: "", svs: "", hot: false, img: "" }],
    pd: [{ qty: 2, pct: 10 }],
    postMissing: [], postError: "", postNudge: 0
  },
  SELLERS: [],
  SELLER_OWN_ID: null,
  REGIONS: [""],
  CATS: [{ id: "other", e: "", l: "Other" }],
  PICKUP_TYPES: { gate: { id: "gate", label: "Gate" } },
  DIETARY: [],
  HEALTH_FILTERS: [],
  document: {
    getElementById(id) { return id === "page-post" ? pagePost : null; },
    elementFromPoint() { return context.__clickTarget; }
  },
  location: { hash: "#/post" },
  hmPrivateOwnerSellerForDraft: () => ownerSeller,
  canNavigateInactiveListingDraft: (seller, current, target) => !!seller && seller.active === false && Math.abs(target - current) === 1,
  postMissingForStep: () => [],
  markPostMissing: () => { throw new Error("Draft navigation unexpectedly invoked publication errors"); },
  sellerEffectiveTier: () => "standard",
  buildPostTierGuide: () => "",
  inactiveListingDraftButton: () => '<button type="button" onclick="saveInactiveListingDraft()">Save Draft</button>',
  postFieldStyle: () => "",
  postFieldError: () => "",
  postFormAlert: () => "",
  postCanContinue: () => false,
  menuItemUploadControl: () => "",
  ic: () => "",
  nav: (page) => { calls.nav.push(page); context.location.hash = `#/${page}`; },
  saveInactiveListingDraft: () => { calls.save += 1; },
  goLiveListing: () => { calls.live += 1; },
  uploadListingImg: () => { calls.listingUpload += 1; },
  uploadMenuItemImg: () => { calls.itemUpload += 1; },
  contactSeller: () => { calls.contact += 1; }
});

vm.runInContext([
  extractFunction(source, "postCanNavigateForward"),
  extractFunction(source, "postNext"),
  extractFunction(source, "rPS"),
  extractFunction(source, "goPS")
].join("\n\n"), context, { filename: "listing-wizard-runtime-source.js" });

vm.runInContext("rPS()", context);
const next = renderedButton(pagePost.innerHTML, "Next: Menu");
assert.equal(next.tagName, "BUTTON");
assert.equal(next.type, "button");
assert.equal(next.onclick, "goPS(2)");
context.__clickTarget = next;
assert.equal(context.document.elementFromPoint(), next, "The rendered test click target must not be obscured");

vm.runInContext(next.onclick, context);
assert.equal(context.location.hash, "#/post");
assert.equal(context.ST.ps, 2);
assert.match(pagePost.innerHTML, /Menu & Pricing/);
assert.match(pagePost.innerHTML, /Menu Items/);
assert.equal(calls.nav.includes("rate"), false);
assert.deepEqual(calls, { nav: [], save: 0, live: 0, listingUpload: 0, itemUpload: 0, contact: 0 });
assert.deepEqual(ownerSeller, { id: "owner-seller", active: false, public: false });

const generatedNext = renderedButton(generated, "Next: Menu");
assert.equal(generatedNext.type, "button");
assert.equal(generatedNext.onclick, "goPS(2)");
assert.equal(extractFunction(source, "postNext").includes("nav('rate')"), false);

console.log("Listing wizard runtime characterization passed.");
