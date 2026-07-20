const VERSION = 'deriva-xpan-3.0.0';
const SHELL = [
  '/deriva/', '/deriva/index.html', '/deriva/styles.css', '/deriva/app.js',
  '/deriva/data/content.js', '/deriva/manifest.webmanifest', '/deriva/icons/icon.svg',
  '/deriva/icons/icon-180.png', '/deriva/icons/icon-192.png', '/deriva/icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key !== VERSION).map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) {
    event.respondWith(caches.match(event.request).then(hit => hit || fetch(event.request).catch(() => hit)));
    return;
  }
  event.respondWith(
    fetch(event.request).then(response => {
      const copy = response.clone();
      caches.open(VERSION).then(cache => cache.put(event.request, copy));
      return response;
    }).catch(() => caches.match(event.request).then(hit => hit || (
      event.request.mode === 'navigate' ? caches.match('/deriva/index.html') : Response.error()
    )))
  );
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
