import { execSync } from 'node:child_process';
import type { Plugin } from 'vite';
import { defineConfig } from 'vite';

// The game is served from https://jsip.uk/lowbridge/ in production, so dev,
// build and preview all use the same base path.
function buildId(): string {
  const day = new Date().toISOString().slice(0, 10);
  try {
    const hash = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    const dirty = execSync('git status --porcelain -- .', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    return `m2-${day}-${hash}${dirty ? '-dirty' : ''}`;
  } catch {
    return `m2-${day}-local`;
  }
}

const BUILD_ID = buildId();

/** Public files the service worker caches alongside the bundle. */
const PUBLIC_FILES = ['./index.html', './icon.svg', './icon-192.png', './icon-512.png', './manifest.webmanifest'];

/**
 * Writes sw.js with this build's exact file list. Caches are named
 * lowbridge-<build>, and housekeeping only ever deletes lowbridge- caches,
 * because every app on jsip.uk shares one origin.
 */
function serviceWorker(): Plugin {
  return {
    name: 'lowbridge-service-worker',
    apply: 'build',
    generateBundle(_options, bundle) {
      const files = ['./', ...Object.keys(bundle).filter((f) => !f.endsWith('.map')).map((f) => `./${f}`), ...PUBLIC_FILES];
      const source = `// Generated at build time. Do not edit.
const CACHE = ${JSON.stringify(`lowbridge-${BUILD_ID}`)};
const ASSETS = ${JSON.stringify([...new Set(files)], null, 2)};

self.addEventListener('install', (event) => {
  // No skipWaiting here: a new build waits until the player restarts into it.
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('lowbridge-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'skipWaiting') self.skipWaiting();
  if (event.data && event.data.type === 'status') {
    caches.open(CACHE).then(async (c) => {
      let missing = 0;
      for (const a of ASSETS) if (!(await c.match(a))) missing++;
      event.source && event.source.postMessage({ type: 'status', cache: CACHE, ready: missing === 0, missing });
    });
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const scope = new URL(self.registration.scope);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  event.respondWith(
    caches.open(CACHE).then(async (c) => {
      const hit = await c.match(req, { ignoreSearch: true, ignoreVary: true });
      if (hit) return hit;
      if (req.mode === 'navigate') {
        const shell = await c.match('./index.html', { ignoreVary: true });
        if (shell) return shell;
      }
      return fetch(req);
    }),
  );
});
`;
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  base: '/lowbridge/',
  plugins: [serviceWorker()],
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2022',
    chunkSizeWarningLimit: 1600,
  },
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
});
