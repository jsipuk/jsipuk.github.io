/* Departures service worker.
 * The whole point of this app is that it still works at 38,000 feet, so every
 * file is precached on install and served cache-first afterwards.
 */
var CACHE = 'departures-v1';

var ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './data.js',
  './words.js',
  './boot.js',
  './games/cloud-hop.js',
  './games/baggage-match.js',
  './games/dots-and-boxes.js',
  './games/sky-quiz.js',
  './games/word-wings.js',
  './games/airport-bingo.js',
  './manifest.webmanifest',
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
      return fetch(request).then(function (response) {
        // Tuck away anything else we pick up while there is still a connection.
        if (response && response.status === 200 && response.type === 'basic') {
          var copy = response.clone();
          caches.open(CACHE).then(function (cache) { cache.put(request, copy); });
        }
        return response;
      }).catch(function () {
        // Offline and not in the cache: fall back to the app shell so a
        // bookmarked deep link still opens the game hub.
        if (request.mode === 'navigate') return caches.match('./index.html');
        return new Response('', { status: 504, statusText: 'Offline' });
      });
    })
  );
});
