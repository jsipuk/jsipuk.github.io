/* Cache-first shell so the game runs with no signal once it has been opened.
 * Bump VERSION whenever any file in SHELL changes, or clients keep the old one. */

const VERSION = 'maga-wall-v2';
const SHELL = [
  './',
  './index.html',
  './style.css',
  './manifest.webmanifest',
  './icons/icon.svg',
  './src/main.js',
  './src/config.js',
  './src/palette.js',
  './src/rng.js',
  './src/font.js',
  './src/pieces.js',
  './src/sim.js',
  './src/sprites.js',
  './src/render.js',
  './src/input.js',
  './src/audio.js',
  './src/storage.js',
  './src/entitlement.js',
  './src/prompt.js',
  './src/ui.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => c.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  // Never cache the payment API. A stale "you have not paid" or a cached
  // licence check would be worse than no service worker at all, and falling
  // back to index.html for an API call would hand the client HTML to parse
  // as JSON.
  if (url.pathname.startsWith('/api/')) return;
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      if (res && res.status === 200 && res.type === 'basic') {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(e.request, copy)).catch(() => {});
      }
      return res;
    }).catch(() => caches.match('./index.html'))),
  );
});
