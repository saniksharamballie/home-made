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

function fakeElement() {
  return {
    className: "rpill bgold",
    textContent: "Standard Seller",
    innerHTML: "",
    style: {},
    lastChild: null,
    setAttribute(name, value) { this[name] = value; }
  };
}

const elements = Object.fromEntries([
  "sb-emo", "sb-rname", "sb-rsub", "sb-rbadge", "tb-rbadge", "sb-admin-btn", "sb-signin-btn", "tb-profile-btn"
].map((id) => [id, fakeElement()]));
const sellerOnly = [fakeElement()];
const memberOnly = [fakeElement()];
const calls = {
  clear: 0, auth: 0, update: 0, insert: 0, upsert: 0,
  routes: [], history: [], stateAtLoad: [], stateAtRoute: []
};

const context = vm.createContext({
  calls,
  ST: {
    role: "seller", page: "profile", bp: { displayName: "Seller" }, scrollPos: {}, saved: [1],
    userDietary: ["x"], healthFilters: ["x"], mealProfiles: [{ name: "x" }],
    pf: {}, pi: [{}], pd: [{}]
  },
  SELLER_OWN_ID: "linked-seller",
  SELLERS: [],
  _profile: { role: "seller", authId: "test-user", sellerId: "linked-seller" },
  _session: { present: true },
  _demoMode: false,
  _sb: { auth: { signOut() { calls.auth += 1; return Promise.resolve({}); } }, from() { throw new Error("Database access is forbidden during sign out"); } },
  hmAuth: {
    getProfile: () => context._profile,
    update: () => { calls.update += 1; },
    insert: () => { calls.insert += 1; },
    upsert: () => { calls.upsert += 1; }
  },
  window: { _resetScrollBars: () => {}, ADM: null },
  document: {
    getElementById: (id) => elements[id] || null,
    querySelectorAll: (selector) => selector === ".si-seller-only" ? sellerOnly : selector === ".si-member-only" ? memberOnly : [],
    querySelector: () => null
  },
  sessionStorage: { removeItem() {} },
  localStorage: { removeItem() {} },
  CART: { items: [1], sellerId: "linked-seller", sellerRef: {}, buyerName: "Seller", fulfil: "pickup" },
  defaultPostForm: () => ({}),
  clearCart: () => {},
  prefStorageKey: () => "test-preference-key",
  applyStoredPreferences: () => {},
  sellerEffectiveTier: () => "standard",
  tierDisplayLabel: (tier) => tier === "standard" ? "Standard Seller" : tier,
  sellerTierClass: () => "bstd",
  onResize: () => {},
  updDietLockPill: () => {},
  updateMsgBadge: () => {},
  refreshMessagesFromCloud: () => {},
  loadBackendWantList: () => {},
  loadLiveSellers: (cb) => {
    calls.stateAtLoad.push({
      role: context.ST.role,
      profile: context._profile,
      session: context._session,
      sidebarBadge: elements["sb-rbadge"].textContent,
      topbarBadge: elements["tb-rbadge"].textContent
    });
    cb();
  },
  maybeShowSellerAdminNotice: () => {},
  hmRouteFromLocation: () => ({ page: "profile", ctx: null }),
  renderCurrentPage: () => {},
  setTimeout: (fn) => { fn(); return 1; },
  nav: (page, routeContext, opts) => {
    calls.routes.push(page);
    calls.stateAtRoute.push({ role: context.ST.role, sidebarBadge: elements["sb-rbadge"].textContent });
    context.ST.page = page;
    context.location.hash = `#/${page}`;
    if (opts && opts.replace) calls.history.push("replace");
    else calls.history.push("push");
  },
  location: { hash: "#/profile" }
});

const clearSource = extractFunction(source, "clearSignedOutState")
  .replace("function clearSignedOutState(){", "function clearSignedOutState(){ calls.clear += 1;");
vm.runInContext([
  clearSource,
  extractFunction(source, "updRole"),
  extractFunction(source, "_applyProfile"),
  extractFunction(source, "signOut")
].join("\n\n"), context, { filename: "signout-runtime-source.js" });

const profileSource = extractFunction(source, "rProfile");
const signOutControls = [...profileSource.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)]
  .filter((match) => /Sign Out/.test(match[2]));
assert.equal(signOutControls.length, 2, "rProfile renders one production and one demo-mode Sign Out variant");
assert.ok(signOutControls.every((match) => /onclick="hmAuth\.signOut\(\)"/.test(match[1])));
assert.equal(signOutControls.some((match) => /onclick="[^"]*(?:nav|wantlist)/.test(match[1])), false);

context.hmAuth.signOut = context.signOut;
vm.runInContext("hmAuth.signOut()", context);

async function finish() {
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(context._profile, null);
  assert.equal(context._session, null);
  assert.equal(context.ST.role, "guest");
  assert.equal(context.SELLER_OWN_ID, null);
  assert.equal(elements["sb-rbadge"].textContent, "Guest");
  assert.equal(elements["tb-rbadge"].textContent, "Guest");
  assert.equal(/Seller/.test(elements["sb-rbadge"].textContent), false);
  assert.equal(/Seller/.test(elements["tb-rbadge"].textContent), false);
  assert.equal(context.location.hash, "#/home");
  assert.equal(context.ST.page, "home");
  assert.equal(calls.routes.includes("wantlist"), false);
  assert.ok(calls.routes.length >= 2 && calls.routes.every((route) => route === "home"));
  assert.ok(calls.history.length >= 2 && calls.history.every((method) => method === "replace"));
  assert.ok(calls.stateAtLoad.length >= 2);
  assert.ok(calls.stateAtLoad.every((state) => state.role === "guest"
    && state.profile === null && state.session === null
    && state.sidebarBadge === "Guest" && state.topbarBadge === "Guest"));
  assert.ok(calls.stateAtRoute.every((state) => state.role === "guest" && state.sidebarBadge === "Guest"));
  assert.equal(sellerOnly[0].style.display, "none");
  assert.equal(memberOnly[0].style.display, "none");
  assert.equal(calls.auth, 1);
  assert.ok(calls.clear >= 2);
  assert.deepEqual({ update: calls.update, insert: calls.insert, upsert: calls.upsert }, { update: 0, insert: 0, upsert: 0 });
  const generatedProfile = extractFunction(generated, "rProfile");
  assert.match(generatedProfile, /onclick="hmAuth\.signOut\(\)"[^>]*>[\s\S]*?Sign Out/);
  assert.equal(/nav\(['"]wantlist['"]\)/.test(extractFunction(source, "signOut")), false);
  console.log("Sign-out runtime characterization passed.");
}

finish().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
