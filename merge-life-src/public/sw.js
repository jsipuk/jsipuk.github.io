/*
 * Merge Life service worker.
 *
 * The game has no backend, so offline support is simple: cache the shell and
 * every asset the player has already loaded, then serve from cache first for
 * static files and fall back to the cached page for navigations.
 *
 * Save data lives in IndexedDB and is never touched here.
 */

const CACHE_NAME = 'merge-life-v1';
const SCOPE_PATH = new URL(self.registration.scope).pathname;
const PRECACHE = [
  SCOPE_PATH,
  `${SCOPE_PATH}workshop/`,
  `${SCOPE_PATH}collection/`,
  `${SCOPE_PATH}wellbeing/`,
  `${SCOPE_PATH}settings/`,
  `${SCOPE_PATH}manifest.webmanifest`,
  `${SCOPE_PATH}icons/icon.svg`,
  `${SCOPE_PATH}icons/icon-192.png`,
  `${SCOPE_PATH}icons/icon-512.png`,
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        Promise.allSettled(PRECACHE.map((url) => cache.add(new Request(url, { cache: 'reload' })))),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: try the network, fall back to the cached page, then the shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached ?? (await caches.match(SCOPE_PATH)) ?? Response.error();
        }),
    );
    return;
  }

  // Static assets: cache first, and quietly fill the cache as they are used.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});
