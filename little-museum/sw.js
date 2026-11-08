// Little Museum offline support. The site's pages are refreshed online and kept for offline use.
const CACHE = 'little-museum-v2';
const PREFIX = 'little-museum-';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon.svg'];
const indexURL = new URL('./index.html', self.registration.scope).href;
const scopePath = new URL(self.registration.scope).pathname;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE)
    .then(cache => cache.addAll(ASSETS))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys()
    .then(names => Promise.all(names
      .filter(name => name.startsWith(PREFIX) && name !== CACHE)
      .map(name => caches.delete(name))))
    .then(() => self.clients.claim()));
});

async function fetchAndRemember(request) {
  const response = await fetch(request);
  if (response.ok) {
    try {
      const cache = await caches.open(CACHE);
      await cache.put(request.mode === 'navigate' ? indexURL : request, response.clone());
    } catch (_) { /* Cache full or unavailable: serve the network response anyway. */ }
  }
  return response;
}

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(scopePath)) return;

  event.respondWith((async () => {
    if (request.mode === 'navigate') {
      try { return await fetchAndRemember(request); }
      catch (_) { return await caches.match(indexURL) || Response.error(); }
    }
    return await caches.match(request) || await fetchAndRemember(request);
  })());
});
