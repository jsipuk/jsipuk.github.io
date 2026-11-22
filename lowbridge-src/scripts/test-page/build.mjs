// Assemble the claude.ai test page from a production build:
//   npm run build && node scripts/test-page/build.mjs <out-dir>
// Writes <out-dir>/lowbridge.html (CSS inlined, capture.js first, the game bundle as a
// module) and copies the bundle to <out-dir>/assets/. Publish lowbridge.html with the
// bundle as a supporting file, declaring capabilities {db: {}, user: {}}.

import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const dist = join(here, '..', '..', 'dist');
const out = process.argv[2];
if (!out) {
  console.error('usage: node scripts/test-page/build.mjs <out-dir>');
  process.exit(2);
}

const html = readFileSync(join(dist, 'index.html'), 'utf8');
const js = html.match(/src="\/lowbridge\/assets\/(index-[^"]+\.js)"/)?.[1];
const css = html.match(/href="\/lowbridge\/assets\/(index-[^"]+\.css)"/)?.[1];
if (!js || !css) throw new Error('dist/index.html has no bundle; run npm run build first');
const body = html.split('<body>')[1].split('</body>')[0].trim();
const capture = readFileSync(join(here, 'capture.js'), 'utf8');

const page = [
  '<title>Lowbridge After Dark</title>',
  '<meta name="theme-color" content="#0b1417" />',
  '<style>',
  readFileSync(join(dist, 'assets', css), 'utf8'),
  '</style>',
  '<script>',
  capture,
  '</script>',
  `<script type="module" src="./assets/${js}"></script>`,
  body,
  '',
].join('\n');

mkdirSync(join(out, 'assets'), { recursive: true });
writeFileSync(join(out, 'lowbridge.html'), page);
copyFileSync(join(dist, 'assets', js), join(out, 'assets', js));
console.log(`assets/${js}`);
