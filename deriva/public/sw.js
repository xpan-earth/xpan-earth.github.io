const VERSION = "deriva-v2.0.0";
const SHELL = `${VERSION}-shell`;
const DATA = `${VERSION}-data`;
const MEDIA = `${VERSION}-media`;
const CORE = ["/", "/offline.html", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(CORE)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const allowed = new Set([SHELL, DATA, MEDIA]);
    await Promise.all((await caches.keys()).filter((key) => !allowed.has(key)).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
  if (event.data?.type === "CACHE_ITEM" && Array.isArray(event.data.urls)) {
    event.waitUntil(caches.open(MEDIA).then(async (cache) => {
      for (const url of event.data.urls.slice(0, 2)) {
        try { await cache.add(new Request(url, { mode: "no-cors" })); } catch { /* Remote media may forbid caching. */ }
      }
    }));
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.pathname.startsWith("/@") || url.pathname.startsWith("/__vite")) return;
  if (url.origin === location.origin && url.pathname.startsWith("/api/editions")) {
    event.respondWith(networkFirst(request, DATA, 4200));
    return;
  }
  if (url.origin === location.origin && url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request, DATA, 5200));
    return;
  }
  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, SHELL, 3500, "/offline.html"));
    return;
  }
  if (url.origin === location.origin) event.respondWith(staleWhileRevalidate(request, SHELL));
  else if (request.destination === "image") event.respondWith(cacheFirst(request, MEDIA));
});

async function networkFirst(request, cacheName, timeout, fallback) {
  const cache = await caches.open(cacheName);
  try {
    const response = await Promise.race([fetch(request), new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), timeout))]);
    if (response?.ok) await cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) || (fallback ? await caches.match(fallback) : new Response(JSON.stringify({ offline: true }), { status: 503, headers: { "Content-Type": "application/json" } }));
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request).then((response) => { if (response.ok) cache.put(request, response.clone()); return response; }).catch(() => cached);
  return cached || network;
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try { const response = await fetch(request); if (response.ok || response.type === "opaque") await cache.put(request, response.clone()); return response; }
  catch { return new Response("", { status: 504 }); }
}
