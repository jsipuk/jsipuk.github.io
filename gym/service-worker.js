// Offline support. Everything the app needs is precached on install, so after
// the first visit the whole thing works with no network at all.
//
// - Navigations: network first (so a new deploy is picked up), falling back to
//   the cached shell when offline.
// - Everything else: cache first, refreshed in the background.
//
// Bump CACHE when files change so old copies are cleared out.
const CACHE = "gym-by-john-v1.1.0";

const PRECACHE = [
  "./",
  "assets/exercises/cooldown-placeholder.svg",
  "assets/exercises/manifest.json",
  "assets/exercises/placeholder.svg",
  "assets/exercises/warmup-placeholder.svg",
  "assets/icons/apple-touch-icon.png",
  "assets/icons/empty-state.svg",
  "assets/icons/favicon-32.png",
  "assets/icons/icon-192.png",
  "assets/icons/icon-512.png",
  "assets/icons/icon-maskable-512.png",
  "assets/icons/no-image.svg",
  "components/activity-sheet.js",
  "components/controls.js",
  "components/exercise-screen.js",
  "components/header.js",
  "components/image.js",
  "components/rating.js",
  "components/rest-timer.js",
  "components/workout-menu.js",
  "css/app.css",
  "css/components.css",
  "css/reset.css",
  "css/variables.css",
  "index.html",
  "js/app-info.js",
  "js/app.js",
  "js/db.js",
  "js/models.js",
  "js/router.js",
  "js/screens/activity-detail.js",
  "js/screens/backup.js",
  "js/screens/exercise-editor.js",
  "js/screens/exercise-history.js",
  "js/screens/history-detail.js",
  "js/screens/history.js",
  "js/screens/session-finish.js",
  "js/screens/session-item.js",
  "js/screens/session-overview.js",
  "js/screens/settings.js",
  "js/screens/today.js",
  "js/screens/workout-editor.js",
  "js/screens/workouts.js",
  "js/session.js",
  "js/state.js",
  "js/storage.js",
  "js/timer.js",
  "js/utils.js",
  "manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // addAll fails the whole install if one file 404s, so add individually
      // and let the fetch handler pick up anything that was missed.
      await Promise.all(
        PRECACHE.map((url) =>
          cache.add(new Request(url, { cache: "reload" })).catch((error) => {
            console.warn("Could not precache", url, error);
          })
        )
      );
      self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        try {
          const fresh = await fetch(request);
          cache.put(request, fresh.clone());
          return fresh;
        } catch {
          return (await cache.match(request)) || (await cache.match("./")) || Response.error();
        }
      })()
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(request);
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok) cache.put(request, response.clone());
          return response;
        })
        .catch(() => null);
      return cached || (await network) || Response.error();
    })()
  );
});
