/* Retired. This app was merged into /ground/.
 *
 * A cache-first service worker would keep serving the old app shell forever, so
 * this replacement exists purely to clear its own caches, unregister itself and
 * reload any open tab onto the landing page. It has no fetch handler, so every
 * request goes to the network.
 */
self.addEventListener('install', function () { self.skipWaiting(); });

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys
          .filter(function (k) { return /^(dojo|account-brain|field-notes)-/.test(k); })
          .map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.registration.unregister(); })
      .then(function () { return self.clients.matchAll({ type: 'window' }); })
      .then(function (clients) { clients.forEach(function (c) { c.navigate(c.url); }); })
  );
});
