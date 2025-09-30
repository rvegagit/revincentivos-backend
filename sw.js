// Service worker (cache-first para assets)
const CACHE = 'reviderm-pwa-v7-4-1';
const ASSETS = ['./','./index.html','./manifest.webmanifest','./assets/icon-192.png','./assets/icon-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS))); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(keys => Promise.all(keys.map(k => k!==CACHE && caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(caches.match(e.request).then(cached => cached || fetch(e.request).then(resp => {
    const url = new URL(e.request.url);
    if (resp.ok && (url.origin === location.origin)) caches.open(CACHE).then(c => c.put(e.request, resp.clone()));
    return resp;
  }).catch(()=>cached)));
});
