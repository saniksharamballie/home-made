const VERSION = "hm-prod-v67";
const SHELL = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;
const SHELL_ASSETS = [
  "/",
  "/index.html",
  "/env.js",
  "/manifest.json",
  "/images/empty-plate.png",
  "/images/home-coming-soon-cities.jpeg",
  "/images/home-passion-income.jpeg",
  "/icons/home-made-logo-clean.png",
  "/icons/home-made-desktop-logo.jpeg",
  "/icons/seller-flow/become-seller.png",
  "/icons/seller-flow/list-dishes.png",
  "/icons/seller-flow/receive-orders-whatsapp.png",
  "/icons/seller-flow/grow-gold-platinum.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => isHomeMadeCacheName(key) && ![SHELL, RUNTIME].includes(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function isHomeMadeCacheName(name) {
  return /^hm-(?:prod-)?v\d+-(?:shell|runtime|img|data)$/.test(String(name || ""));
}

function hasPrivateRequestHeaders(request) {
  return !!(request.headers && (
    request.headers.has("authorization") ||
    request.headers.has("apikey") ||
    request.headers.has("x-client-info")
  ));
}

function isSupabaseRequest(url) {
  const host = url.hostname.toLowerCase();
  return host.endsWith(".supabase.co") ||
    host.endsWith(".supabase.in") ||
    /^\/(?:auth|rest|storage|realtime|functions)\/v1(?:\/|$)/.test(url.pathname);
}

function isAuthRedirect(url) {
  if (/\/(?:auth|login|logout|callback|reset-password)(?:\/|$)/i.test(url.pathname)) return true;
  return ["code", "access_token", "refresh_token", "token", "token_hash"].some((key) => url.searchParams.has(key));
}

function isPrivateRequest(request, url) {
  if (request.method !== "GET") return true;
  if (hasPrivateRequestHeaders(request)) return true;
  if (request.credentials === "include") return true;
  if (url.origin !== self.location.origin) return true;
  if (isSupabaseRequest(url) || isAuthRedirect(url)) return true;
  if (url.pathname === "/api/contact-seller" || url.pathname.startsWith("/api/")) return true;
  return false;
}

function isPublicStaticRequest(request, url) {
  if (url.origin !== self.location.origin) return false;
  if (["style", "script", "font", "image", "manifest"].includes(request.destination)) return true;
  return /^\/(?:icons|images)\//.test(url.pathname) ||
    /\.(?:css|js|mjs|png|jpe?g|gif|webp|svg|ico|woff2?|webmanifest)$/i.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (url.protocol !== "http:" && url.protocol !== "https:") return;
  if (isPrivateRequest(request, url)) {
    event.respondWith(fetch(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/index.html")));
    return;
  }

  if (!isPublicStaticRequest(request, url)) {
    event.respondWith(fetch(request));
    return;
  }

  if (url.pathname === "/" || url.pathname === "/index.html" || url.pathname === "/env.js" || url.pathname.endsWith(".js")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(RUNTIME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) =>
      cached || fetch(request).then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(RUNTIME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
    )
  );
});
