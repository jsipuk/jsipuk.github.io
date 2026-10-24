// Less Noise: keeps the app working offline.
const CACHE = "less-noise-v4";
const FILES = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/favicon-32.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES.map(f => new Request(f, { cache: "reload" })))).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      // jsip.uk hosts other apps on the same origin: only remove Less Noise's own old caches.
      .then(keys => Promise.all(keys.filter(k => k.startsWith("less-noise-") && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Cached copy first, so it opens instantly and offline. Refresh the cache quietly when online.
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  const isPage = req.mode === "navigate";
  const key = isPage ? "./index.html" : req;
  e.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(key, { ignoreSearch: true }).then(hit => {
        const net = fetch(req, { cache: "no-cache" }).then(res => {
          if (res && res.ok) cache.put(key, res.clone());
          return res;
        }).catch(() => hit);
        return hit || net;
      })
    )
  );
});

// If another app on this site cleared our cache, put back anything missing.
self.addEventListener("message", e => {
  if (e.data !== "refill") return;
  e.waitUntil(caches.open(CACHE).then(cache => Promise.all(FILES.map(f =>
    cache.match(f).then(hit => hit || cache.add(new Request(f, { cache: "reload" })).catch(() => {}))
  ))));
});
