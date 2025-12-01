const CACHE_NAME = 'space-game-v1';
const scopeUrl = new URL(self.registration.scope);
const rootPath = scopeUrl.pathname.endsWith('/static/')
  ? scopeUrl.pathname.replace(/static\/$/, '')
  : scopeUrl.pathname;
const toCache = [
  rootPath,
  `${rootPath}?utm_source=pwa`,
  `${rootPath}static/favicon-192.png`,
  `${rootPath}static/favicon-512.png`,
];

self.addEventListener('install', evt => {
  evt.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(toCache))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', evt => {
  evt.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME)
            .map(k => caches.delete(k))
      )
    )
  );
});

self.addEventListener('fetch', evt => {
  evt.respondWith(
    caches.match(evt.request)
      .then(resp => resp || fetch(evt.request))
  );
});
