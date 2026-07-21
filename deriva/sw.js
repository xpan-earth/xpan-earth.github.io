const VERSION = "deriva-v5-1784604774";
const SHELL = `${VERSION}-shell`;
const DATA = `${VERSION}-data`;
const MEDIA = `${VERSION}-media`;
const CORE = [
  "/deriva/", "/deriva/index.html", "/deriva/offline.html", "/deriva/config.js",
  "/deriva/manifest.webmanifest", "/deriva/icons/mark.svg", "/deriva/icons/icon-192.png",
  "/deriva/icons/icon-512.png", "/deriva/icons/maskable-512.png", "/deriva/icons/apple-touch.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    await cache.addAll(CORE);
    const html = await (await cache.match("/deriva/index.html")).text();
    const builtAssets = [...html.matchAll(/(?:src|href)=["'](\/deriva\/assets\/[^"']+)["']/g)].map((match) => match[1]);
    if (builtAssets.length) await cache.addAll([...new Set(builtAssets)]);
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => ![SHELL, DATA, MEDIA].includes(key)).map((key) => caches.delete(key)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
  if (event.data?.type === "CACHE_MEDIA" && Array.isArray(event.data.urls)) {
    event.waitUntil(caches.open(MEDIA).then(async (cache) => {
      for (const url of event.data.urls.slice(0, 12)) {
        try {
          const request = new Request(url, { mode: "cors", credentials: "omit", referrerPolicy: "no-referrer" });
          const response = await fetch(request);
          if (response.ok && Number(response.headers.get("content-length") || 0) < 5_000_000) await cache.put(request, response);
        } catch { /* El medio remoto puede prohibir caché/CORS; el guardado textual permanece. */ }
      }
    }));
  }
});

async function networkFirst(request, cacheName, timeoutMs = 4500) {
  const cache = await caches.open(cacheName);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(request, { signal: controller.signal });
    if (response.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw new Error("offline");
  } finally { clearTimeout(timeout); }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fresh = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => cached);
  return cached || fresh;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, SHELL).catch(async () => (await caches.match("/deriva/")) || caches.match("/deriva/offline.html")));
    return;
  }
  if (url.pathname.startsWith("/v1/") || url.pathname.includes("/v1/")) {
    event.respondWith(networkFirst(request, DATA, 6000).catch(() => new Response(JSON.stringify({ offline: true }), { status: 503, headers: { "Content-Type": "application/json" } })));
    return;
  }
  if (url.origin === self.location.origin && url.pathname.startsWith("/deriva/")) {
    event.respondWith(staleWhileRevalidate(request, SHELL));
    return;
  }
  if (request.destination === "image") {
    event.respondWith(caches.open(MEDIA).then(async (cache) => (await cache.match(request)) || fetch(request).catch(() => new Response("", { status: 503 }))));
  }
});
