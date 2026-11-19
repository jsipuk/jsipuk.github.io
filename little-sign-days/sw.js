'use strict';
const VERSION = '503e05de26bcf49f';
const CACHE_PREFIX = 'little-sign-days:'+self.registration.scope+':';
const CORE_CACHE = CACHE_PREFIX+'core:'+VERSION;
const IMAGE_CACHE = CACHE_PREFIX+'diagrams:v1';
const CORE_FILES = [
 './', './index.html', './style.css', './app.js', './content.js',
 './snack.webp', './meal.png', './play.png', './bath.png', './bed.png',
 './dm-sans-400-normal.woff2', './dm-sans-500-normal.woff2',
 './dm-sans-600-normal.woff2', './fraunces-600-normal.woff2',
 './manifest.webmanifest', './icon-192.png', './icon-512.png'
];
const IMAGE_HOSTS = new Set([
 'www.ascleader.co.uk', 'www.mencap.org.uk', 'www.ypo.co.uk',
 'newfield.org.uk', 'makaton.org', 'www.portesbery.surrey.sch.uk',
 'springwellschool.net'
]);

self.addEventListener('install', event => {
 event.waitUntil((async () => {
  const cache = await caches.open(CORE_CACHE);
  await cache.addAll(CORE_FILES);
  // A new version takes over on the next visit, after existing tabs close.
 })());
});
self.addEventListener('activate', event => {
 event.waitUntil((async () => {
  const names = await caches.keys();
  await Promise.all(names.filter(name =>
   name.startsWith(CACHE_PREFIX+'core:') && name !== CORE_CACHE
  ).map(name => caches.delete(name)));
  await self.clients.claim();
 })());
});
async function coreResponse(request) {
 const cache = await caches.open(CORE_CACHE);
 const cached = await cache.match(request, {ignoreSearch: true});
 if (cached) return cached;
 return fetch(request);
}
async function diagramResponse(request) {
 const cache = await caches.open(IMAGE_CACHE);
 const url = new URL(request.url);
 const retry = url.searchParams.has('_lsd_retry');
 url.searchParams.delete('_lsd_retry');
 const cached = await cache.match(url.href);
 if (cached && !retry) return cached;
 try {
  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') {
   try { await cache.put(url.href, response.clone()); } catch {}
  }
  return response;
 } catch {
  return Response.error();
 }
}
self.addEventListener('fetch', event => {
 const request = event.request;
 if (request.method !== 'GET') return;
 const url = new URL(request.url);
 const scope = new URL(self.registration.scope);
 if (url.origin === scope.origin && url.pathname.startsWith(scope.pathname)) {
  if (request.mode === 'navigate') {
   event.respondWith(caches.open(CORE_CACHE).then(cache =>
    cache.match(new URL('index.html', scope).href).then(cached => cached || fetch(request))
   ));
  } else if (CORE_FILES.some(path => new URL(path, scope).pathname === url.pathname)) {
   event.respondWith(coreResponse(request));
  }
 } else if (request.destination === 'image' && IMAGE_HOSTS.has(url.hostname)) {
  event.respondWith(diagramResponse(request));
 }
});
self.addEventListener('message', event => {
 const message = event.data;
 if (message?.type !== 'REMOVE_FAILED_IMAGE' || typeof message.url !== 'string') return;
 let url;
 try { url = new URL(message.url); } catch { return; }
 if (!IMAGE_HOSTS.has(url.hostname)) return;
 event.waitUntil(caches.open(IMAGE_CACHE).then(cache => cache.delete(url.href)));
});
