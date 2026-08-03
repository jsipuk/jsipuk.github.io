/* Ground service worker.
 *
 * Precache everything on install and serve cache-first, so a brief opens and a note gets captured on a
 * plane, in a lift, or in a customer car park with no signal. There is no runtime network
 * call of any kind, so nothing here needs a network-first strategy.
 *
 * Bump CACHE whenever any file in ASSETS changes, or returning visitors keep
 * the old version. Same rule as piano/ and departures/.
 */
var CACHE = 'ground-1.0.1';

var ASSETS = [
  './',
  './index.html',
  './style.css',
  './store.js',
  './deck.js',
  './model.js',
  './app.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE)
      .then(function (cache) { return cache.addAll(ASSETS); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;

  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        /* Cache same-origin successes so a cache-busting query string on a
           script does not permanently miss. */
        if (res && res.status === 200 && res.type === 'basic') {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () {
        /* Offline and not cached: fall back to the shell for navigations. */
        if (req.mode === 'navigate') return caches.match('./index.html');
        throw new Error('offline');
      });
    })
  );
});
