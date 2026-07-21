const VERSION='deriva-xpan-4.0.0';
const CORE=[
  '/deriva/','/deriva/index.html','/deriva/styles.css','/deriva/app.js',
  '/deriva/data/content.js','/deriva/manifest.webmanifest','/deriva/icons/deriva.svg',
  '/deriva/icons/apple-touch.png','/deriva/icons/icon-192.png','/deriva/icons/icon-512.png',
  '/deriva/icons/maskable-512.png','/deriva/assets/atlas.webp','/deriva/assets/atlas-field-02.webp',
  '/deriva/assets/instrument-serif.ttf','/deriva/assets/instrument-serif-italic.ttf',
  '/deriva/assets/unifraktur.ttf','/deriva/assets/plex-mono.ttf'
];
self.addEventListener('install',event=>event.waitUntil(caches.open(VERSION).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const u=new URL(event.request.url);
  if(u.origin!==location.origin){event.respondWith(fetch(event.request).catch(()=>new Response('',{status:503})));return}
  event.respondWith(caches.match(event.request).then(hit=>hit||fetch(event.request).then(response=>{if(response.ok)caches.open(VERSION).then(c=>c.put(event.request,response.clone()));return response}).catch(()=>event.request.mode==='navigate'?caches.match('/deriva/index.html'):new Response('',{status:503}))));
});
self.addEventListener('message',event=>{if(event.data==='SKIP_WAITING')self.skipWaiting()});
