/* Caches the eight files this page is made of, so it opens without a
   connection once it has been visited. Nothing is sent anywhere. */

var CACHE = "invent-together-v2-1";

var FILES = [
  "./",
  "index.html",
  "styles.css",
  "app.js",
  "site.webmanifest",
  "inventor-icon.png",
  "inventor-share-card.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) { return cache.addAll(FILES); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (key) {
        return key === CACHE ? null : caches.delete(key);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then(function (hit) {
      return hit || fetch(event.request).catch(function () {
        return caches.match("index.html");
      });
    })
  );
});
