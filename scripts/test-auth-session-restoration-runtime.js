const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { findEnvScriptElements, findScriptElements } = require("./env-script-utils");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "src", "homemade-map-cleaned-1.html"), "utf8");
const generated = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");

function extractAuthWrapper(input) {
  const start = input.indexOf("var hmAuth = (function(){");
  const end = input.indexOf("\nlet ST={", start);
  assert.notEqual(start, -1, "hmAuth wrapper start was not found");
  assert.notEqual(end, -1, "hmAuth wrapper end was not found");
  return input.slice(start, end);
}

function deferred() {
  let resolve;
  const promise = new Promise((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function makeHarness({ configured = true, session = null, delayedSession = false, sellerError = false } = {}) {
  const sessionResult = delayedSession ? deferred() : null;
  const state = {
    clients: 0,
    createClientArgCount: 0,
    listeners: 0,
    listener: null,
    profileRpc: 0,
    sellerReads: 0,
    buyerWrites: 0,
    privateSellerApplies: 0,
    draftAccountSyncs: 0,
    roleUpdates: [],
    routes: [],
    postView: "",
    toasts: []
  };
  const profileRow = { role: "seller", display_name: "Test Seller", email: "seller@example.invalid" };
  const sellerRow = {
    id: "seller-a",
    auth_id: "account-a",
    name: "Test Seller",
    email: "seller@example.invalid",
    active: false,
    data: {
      listingDraft: {
        title: "Draft title",
        description: "Draft description",
        category: "catering",
        items: [{ n: "Draft title", p: "42.5" }]
      }
    }
  };

  function query(table) {
    return {
      select() { return this; },
      eq() { return this; },
      limit() { return this; },
      maybeSingle() {
        if (table === "sellers") {
          state.sellerReads += 1;
          return Promise.resolve(sellerError ? { data: null, error: { message: "lookup failed" } } : { data: sellerRow, error: null });
        }
        if (table === "buyers") return Promise.resolve({ data: null, error: null });
        throw new Error(`Unexpected table read: ${table}`);
      },
      insert() {
        state.buyerWrites += 1;
        return Promise.resolve({ data: [] });
      }
    };
  }

  const client = {
    auth: {
      getSession() {
        if (sessionResult) return sessionResult.promise;
        return Promise.resolve({ data: { session }, error: null });
      },
      onAuthStateChange(callback) {
        state.listeners += 1;
        state.listener = callback;
        return { data: { subscription: { unsubscribe() {} } } };
      },
      exchangeCodeForSession() { return Promise.resolve({ data: { session } }); },
      signInWithPassword() { return Promise.resolve({ data: { session }, error: null }); },
      signOut() { return Promise.resolve({ error: null }); }
    },
    rpc(name) {
      assert.equal(name, "get_home_made_profile");
      state.profileRpc += 1;
      return Promise.resolve({ data: profileRow, error: null });
    },
    from: query
  };

  const context = vm.createContext({
    SUPABASE_URL: configured ? "https://project.example.supabase.co" : "YOUR_SUPABASE_URL",
    SUPABASE_ANON: configured ? "public-test-key" : "YOUR_SUPABASE_ANON_KEY",
    ADMIN_EMAIL: "",
    supabase: {
      createClient(url, key) {
        assert.equal(url, "https://project.example.supabase.co");
        assert.equal(key, "public-test-key");
        state.clients += 1;
        state.createClientArgCount = arguments.length;
        return client;
      }
    },
    URLSearchParams,
    Promise,
    console: {
      warn() {},
      info() {},
      log() {},
      error() {}
    },
    window: {
      HM_CONFIG: { SITE_URL: "https://staging.example" },
      location: { search: "", pathname: "/", hash: "#/post" },
      history: { replaceState() {} },
      ADM: null,
      _resetScrollBars() {}
    },
    document: {
      getElementById() { return null; },
      querySelectorAll() { return []; }
    },
    ST: { role: "guest", page: "post", bp: { displayName: "" }, scrollPos: {}, saved: [] },
    SELLERS: [],
    SELLER_OWN_ID: null,
    normalizePrivateOwnerSeller: (row) => row,
    applyFreshPrivateSellerState(profile, row) {
      state.privateSellerApplies += 1;
      profile.raw = row;
      profile.ownerSeller = row;
      return true;
    },
    syncInactiveListingDraftAccount() { state.draftAccountSyncs += 1; },
    applyStoredPreferences() {},
    updRole() { state.roleUpdates.push(context.ST.role); },
    onResize() {},
    updDietLockPill() {},
    updateMsgBadge() {},
    refreshMessagesFromCloud() {},
    loadBackendWantList() {},
    loadLiveSellers(callback) { callback(); },
    maybeShowSellerAdminNotice() {},
    hmRouteFromLocation() { return { page: "post", ctx: null }; },
    renderCurrentPage() {},
    nav(page) {
      state.routes.push(page);
      context.ST.page = page;
      context.window.location.hash = `#/${page}`;
      if (page === "post") state.postView = context.ST.role === "seller" ? "wizard" : "onboarding";
    },
    showToast(message) { state.toasts.push(message); },
    setTimeout(callback) { callback(); return 1; },
    clearTimeout() {},
    fetch() { throw new Error("Unexpected fetch"); },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    sessionStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    location: { hash: "#/post" }
  });

  vm.runInContext(extractAuthWrapper(source), context, { filename: "auth-session-restoration-source.js" });

  function bootAndApply() {
    return new Promise((resolve) => {
      context.hmAuth.boot((profile) => {
        context.hmAuth._applyProfile(profile || { role: "guest", displayName: "Guest", emoji: "guest" });
        resolve(profile);
      });
    });
  }

  return { context, state, client, sessionResult, bootAndApply, sellerRow };
}

async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));
}

async function run() {
  const envScripts = findEnvScriptElements(generated);
  const supabaseScript = findScriptElements(generated).find((script) => /@supabase\/supabase-js/.test(script.src));
  assert.equal(envScripts.length, 1);
  assert.ok(supabaseScript);
  assert.ok(envScripts[0].start < supabaseScript.start);
  assert.ok(envScripts[0].start < generated.indexOf("window.HM_CONFIG"));

  const existingSession = {
    user: {
      id: "account-a",
      email: "seller@example.invalid",
      app_metadata: {},
      user_metadata: {}
    }
  };
  const restored = makeHarness({ session: existingSession, delayedSession: true });
  const restoredBoot = restored.bootAndApply();
  assert.equal(restored.state.clients, 1);
  assert.equal(restored.state.createClientArgCount, 2, "The browser client must retain Supabase's default auth persistence options");
  assert.equal(restored.context.hmAuth.isDemoMode(), false);
  assert.equal(restored.state.listeners, 1);
  assert.equal(restored.state.routes.length, 0, "Guest must not render while getSession is pending");

  restored.state.listener("INITIAL_SESSION", existingSession);
  assert.equal(restored.state.routes.length, 0, "INITIAL_SESSION must not cause a premature Guest render");
  restored.sessionResult.resolve({ data: { session: existingSession }, error: null });
  const restoredProfile = await restoredBoot;
  assert.equal(restoredProfile.role, "seller");
  assert.equal(restored.context.hmAuth.getProfile().role, "seller");
  assert.equal(restored.context.ST.role, "seller");
  assert.equal(restored.context.SELLER_OWN_ID, "seller-a");
  assert.equal(restored.state.profileRpc, 1);
  assert.equal(restored.state.sellerReads, 1);
  assert.equal(restored.state.privateSellerApplies, 1);
  assert.equal(restored.state.draftAccountSyncs, 1);
  assert.equal(restored.state.postView, "wizard");
  assert.deepEqual(restored.state.routes, ["post"]);
  assert.equal(restored.state.buyerWrites, 0);

  const callsBeforeRepeatedInitial = {
    clients: restored.state.clients,
    listeners: restored.state.listeners,
    profileRpc: restored.state.profileRpc,
    sellerReads: restored.state.sellerReads
  };
  restored.state.listener("INITIAL_SESSION", existingSession);
  restored.state.listener("INITIAL_SESSION", existingSession);
  await flush();
  assert.deepEqual({
    clients: restored.state.clients,
    listeners: restored.state.listeners,
    profileRpc: restored.state.profileRpc,
    sellerReads: restored.state.sellerReads
  }, callsBeforeRepeatedInitial);

  restored.state.listener("SIGNED_IN", existingSession);
  restored.state.listener("SIGNED_IN", existingSession);
  await flush();
  assert.equal(restored.state.clients, 1);
  assert.equal(restored.state.listeners, 1);
  assert.equal(restored.context.hmAuth.getProfile().role, "seller");
  assert.equal(restored.context.hmAuth.getProfile().sellerId, "seller-a");
  assert.equal(restored.state.buyerWrites, 0);

  restored.context.nav("home");
  restored.context.nav("post");
  assert.equal(restored.state.clients, 1, "Route navigation must not recreate the Supabase client");
  assert.equal(restored.state.listeners, 1, "Route navigation must not register another auth listener");

  const guest = makeHarness({ session: null, delayedSession: true });
  const guestBoot = guest.bootAndApply();
  guest.state.listener("INITIAL_SESSION", null);
  assert.equal(guest.state.routes.length, 0, "Guest must wait for getSession to resolve");
  guest.sessionResult.resolve({ data: { session: null }, error: null });
  assert.equal(await guestBoot, null);
  assert.equal(guest.context.ST.role, "guest");
  assert.equal(guest.state.postView, "onboarding");
  assert.equal(guest.state.profileRpc, 0);
  assert.equal(guest.state.sellerReads, 0);

  const missingConfig = makeHarness({ configured: false, session: null });
  assert.equal(missingConfig.context.hmAuth.isDemoMode(), true);
  assert.equal(await missingConfig.bootAndApply(), null);
  assert.equal(missingConfig.state.clients, 0);
  assert.equal(missingConfig.context.ST.role, "guest");

  const sellerLookupFailure = makeHarness({ session: existingSession, sellerError: true });
  const failureProfile = await sellerLookupFailure.bootAndApply();
  assert.equal(failureProfile.role, "seller");
  assert.equal(failureProfile.sellerLookupStatus, "error");
  assert.equal(failureProfile.ownerSeller, null);
  assert.equal(sellerLookupFailure.context.SELLER_OWN_ID, null);

  const originStorage = new Map();
  originStorage.set("https://stable.example", new Map([["session-present", true]]));
  originStorage.set("https://commit.example", new Map());
  assert.equal(originStorage.get("https://stable.example").has("session-present"), true);
  assert.equal(originStorage.get("https://commit.example").has("session-present"), false);
  assert.match(source, /window\.HM_CONFIG\s*&&\s*window\.HM_CONFIG\.SITE_URL/);
  assert.match(source, /_sb\.auth\.signOut\(\)/);
  assert.match(source, /clearInactiveListingDraftHydrationState/);

  console.log("Auth session restoration runtime guardrails passed.");
}

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
