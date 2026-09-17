const CACHE_NAME = 'kayvin-v6';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './js/core.js',
  './js/router.js',
  './js/budget.js',
  './js/debt.js',
  './js/habits.js',
  './js/main.js',
  './manifest.json',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Network-first: always try the network so deploys show up immediately;
// fall back to cache only when offline. (Cache-first caused stale PWAs.)
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = e.request.url;
  if (url.includes('firestore') || url.includes('googleapis') || url.includes('gstatic')) return;

  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok) {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
      }
      return res;
    }).catch(() => caches.match(e.request))
  );
});
