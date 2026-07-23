const VERSION = "deriva-v6-final-2026-07-22";
const SHELL = `${VERSION}-shell`;
const DATA = `${VERSION}-data`;
const MEDIA = `${VERSION}-media`;
const CORE = [
  "/deriva/",
  "/deriva/index.html",
  "/deriva/offline.html",
  "/deriva/manifest.webmanifest",
  "/deriva/icons/mark.svg",
  "/deriva/icons/icon-192.png",
  "/deriva/icons/icon-512.png",
  "/deriva/icons/maskable-512.png",
  "/deriva/icons/apple-touch.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL);
      await cache.addAll(CORE);
      const html = await (await cache.match("/deriva/index.html")).text();
      const builtAssets = [
        ...html.matchAll(/(?:src|href)=["'](\/deriva\/assets\/[^"']+)["']/g),
      ].map((match) => match[1]);
      if (builtAssets.length) await cache.addAll([...new Set(builtAssets)]);
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter(
            (name) =>
              name.startsWith("deriva-") &&
              ![SHELL, DATA, MEDIA].includes(name),
          )
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
  if (event.data?.type === "CACHE_MEDIA" && Array.isArray(event.data.urls)) {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(MEDIA);
        for (const url of event.data.urls.slice(0, 8)) {
          try {
            const request = new Request(url, {
              mode: "cors",
              credentials: "omit",
              referrerPolicy: "no-referrer",
            });
            const response = await fetch(request);
            const type = response.headers.get("content-type") || "";
            const size = Number(response.headers.get("content-length") || 0);
            if (
              response.ok &&
              type.startsWith("image/") &&
              (!size || size < 5_000_000)
            )
              await cache.put(request, response);
          } catch {
            /* La ficha y el estado local no dependen del medio remoto. */
          }
        }
      })(),
    );
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
  } finally {
    clearTimeout(timeout);
  }
}

async function cacheFirstAsset(request) {
  const cache = await caches.open(SHELL);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) await cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (
    url.origin === self.location.origin &&
    url.pathname === "/deriva/config.js"
  ) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(DATA);
        try {
          const response = await fetch(request, { cache: "no-store" });
          if (!response.ok) throw new Error("config no disponible");
          await cache.put(request, response.clone());
          const headers = new Headers(response.headers);
          headers.set("Cache-Control", "no-store, max-age=0");
          return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers,
          });
        } catch {
          return (
            (await cache.match(request)) ||
            new Response(
              "window.__DERIVA_CONFIG__=Object.freeze({apiBaseUrl:'https://deriva-api.yes-6e1.workers.dev',build:'v6-offline'});",
              {
                headers: {
                  "Content-Type": "application/javascript; charset=utf-8",
                  "Cache-Control": "no-store, max-age=0",
                },
              },
            )
          );
        }
      })(),
    );
    return;
  }
  if (request.mode === "navigate") {
    event.respondWith(
      networkFirst(request, SHELL).catch(
        async () =>
          (await caches.match("/deriva/")) ||
          caches.match("/deriva/offline.html"),
      ),
    );
    return;
  }
  if (url.pathname.startsWith("/v1/") || url.pathname.includes("/v1/")) {
    event.respondWith(
      networkFirst(request, DATA, 6000).catch(
        () =>
          new Response(JSON.stringify({ offline: true }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    );
    return;
  }
  if (
    url.origin === self.location.origin &&
    url.pathname.startsWith("/deriva/")
  ) {
    event.respondWith(cacheFirstAsset(request));
    return;
  }
  if (request.destination === "image") {
    event.respondWith(
      caches
        .open(MEDIA)
        .then(
          async (cache) =>
            (await cache.match(request)) ||
            fetch(request).catch(() => new Response("", { status: 503 })),
        ),
    );
  }
});
