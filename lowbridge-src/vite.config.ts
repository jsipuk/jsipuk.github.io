import { execSync } from 'node:child_process';
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
    return `m1-${day}-${hash}${dirty ? '-dirty' : ''}`;
  } catch {
    return `m1-${day}-local`;
  }
}

export default defineConfig({
  base: '/lowbridge/',
  define: {
    __BUILD_ID__: JSON.stringify(buildId()),
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
