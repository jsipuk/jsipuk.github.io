/* Pulls the exact Google Fonts the site already uses from Fontsource (which
   ships Google's own woff2 files on npm), copies the latin subsets into
   /fonts/, and generates /fonts/fonts.css.

   This is a generator, not a build step: it is run by hand when a family is
   added, and its output is committed. Nothing here runs at page load.

     npm install @fontsource/<each family listed below>
     node fonts/build.js
*/
const fs = require('fs');
const path = require('path');

const OUT = __dirname;
const NM = process.env.FONT_MODULES || path.join(__dirname, '..', 'node_modules');

// family -> { pkg, css family name, weights, italics }
const FAMILIES = [
  { pkg: 'dm-serif-display', name: 'DM Serif Display', weights: [400], italics: [400] },
  { pkg: 'jetbrains-mono', name: 'JetBrains Mono', weights: [400, 700], italics: [] },
  { pkg: 'figtree', name: 'Figtree', weights: [300, 400, 500, 600], italics: [] },
  { pkg: 'dm-sans', name: 'DM Sans', weights: [300, 400, 500, 600], italics: [300] },
  { pkg: 'dm-mono', name: 'DM Mono', weights: [400, 500], italics: [] },
  { pkg: 'baloo-2', name: 'Baloo 2', weights: [500, 600, 700, 800], italics: [] },
  { pkg: 'nunito', name: 'Nunito', weights: [400, 600, 700, 800], italics: [400] },
  { pkg: 'cinzel', name: 'Cinzel', weights: [500, 600, 700], italics: [] },
  { pkg: 'eb-garamond', name: 'EB Garamond', weights: [400, 500, 600], italics: [400] },
  { pkg: 'inter', name: 'Inter', weights: [400, 500, 600], italics: [] },
  { pkg: 'atkinson-hyperlegible', name: 'Atkinson Hyperlegible', weights: [400, 700], italics: [] },
  { pkg: 'fraunces', name: 'Fraunces', weights: [400, 600, 700], italics: [] },
  { pkg: 'karla', name: 'Karla', weights: [400, 500, 700], italics: [] },
  { pkg: 'patrick-hand', name: 'Patrick Hand', weights: [400], italics: [] },
  { pkg: 'permanent-marker', name: 'Permanent Marker', weights: [400], italics: [] },
  { pkg: 'orbitron', name: 'Orbitron', weights: [700, 900], italics: [] },
  { pkg: 'share-tech-mono', name: 'Share Tech Mono', weights: [400], italics: [] },
];

fs.mkdirSync(OUT, { recursive: true });

const blocks = [];
const missing = [];
let copied = 0;
let bytes = 0;

function emit(fam, weight, style) {
  const src = path.join(NM, '@fontsource', fam.pkg, 'files', `${fam.pkg}-latin-${weight}-${style}.woff2`);
  const file = `${fam.pkg}-${weight}-${style}.woff2`;
  if (!fs.existsSync(src)) {
    missing.push(src.replace(NM, ''));
    return;
  }
  fs.copyFileSync(src, path.join(OUT, file));
  copied++;
  bytes += fs.statSync(src).size;
  blocks.push(
    `@font-face {\n` +
      `  font-family: '${fam.name}';\n` +
      `  font-style: ${style};\n` +
      `  font-weight: ${weight};\n` +
      `  font-display: swap;\n` +
      `  src: url('${file}') format('woff2');\n` +
      `}`
  );
}

FAMILIES.forEach((fam) => {
  fam.weights.forEach((w) => emit(fam, w, 'normal'));
  fam.italics.forEach((w) => emit(fam, w, 'italic'));
});

const header = `/* Self-hosted copies of the fonts this site uses, so no page makes a
 * request to Google (or anyone else) at runtime. The files are Google's
 * own woff2 latin subsets, taken from the Fontsource packages on npm.
 *
 * Declaring every face here is deliberate and costs nothing: a browser only
 * downloads a face a page actually uses, so one shared stylesheet is cheaper
 * than a per-app one and is cached across the whole site.
 *
 * Regenerate with scratchpad/build-fonts.js if a family is added.
 */\n\n`;

fs.writeFileSync(path.join(OUT, 'fonts.css'), header + blocks.join('\n\n') + '\n');

console.log(`copied ${copied} woff2 files, ${(bytes / 1024).toFixed(0)}KB total`);
if (missing.length) {
  console.error(`\nMISSING ${missing.length}:`);
  missing.forEach((m) => console.error('  ' + m));
  process.exit(1);
}
