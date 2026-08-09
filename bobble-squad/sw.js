/* Bobble Squad service worker.
 *
 * Everything the game needs is precached on install and served cache-first
 * afterwards, so once it has been opened once it runs with the wi-fi off.
 * There is nothing to fetch from anywhere else: no CDN, no fonts service, no
 * analytics, no API. The fonts and icons in this list are the only binary
 * assets in the whole game — every model, texture and sound is generated in
 * code at runtime.
 *
 * Bump CACHE whenever a shipped file changes, or returning devices keep the
 * old build.
 */
var CACHE = 'bobble-squad-1.1.0';

var ASSETS = [
  './',
  './index.html',
  './style.css',
  './engine.js',
  './audio.js',
  './input.js',
  './world.js',
  './missions.js',
  './game.js',
  './probe.js',
  './manifest.webmanifest',
  './fonts/baloo-2-700-normal.woff2',
  './fonts/baloo-2-800-normal.woff2',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(ASSETS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        return key === CACHE ? null : caches.delete(key);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then(function (hit) {
      if (hit) return hit;
      return fetch(request).then(function (res) {
        if (res && res.status === 200 && res.type === 'basic') {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(request, copy); });
        }
        return res;
      }).catch(function () {
        return caches.match('./index.html');
      });
    })
  );
});
