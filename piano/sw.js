/* Cache-first service worker so the app works offline once visited.
 * Bump VERSION whenever any app-shell file changes. */

const VERSION = 'aria-v5';
const SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './songs.js',
  './musicxml.js',
  './manifest.webmanifest',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './samples/C2.mp3',
  './samples/C3.mp3',
  './samples/C4.mp3',
  './samples/C5.mp3',
  './samples/C6.mp3',
  './samples/C7.mp3',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached =>
      cached ||
      fetch(e.request).then(res => {
        if (res.ok && new URL(e.request.url).origin === location.origin) {
          const copy = res.clone();
          caches.open(VERSION).then(c => c.put(e.request, copy));
        }
        return res;
      })
    )
  );
});
