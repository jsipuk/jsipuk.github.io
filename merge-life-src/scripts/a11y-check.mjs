/**
 * Accessibility spot-check: toggles high contrast and reduced motion, prints the
 * keyboard tab order, and lists any touch target under 44px.
 *
 *   node scripts/a11y-check.mjs [baseUrl]
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const baseUrl = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '');
const shots = process.env.SHOT_DIR ?? '/tmp/merge-life-shots';
mkdirSync(shots, { recursive: true });
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport: { width: 900, height: 1000 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
const problems = [];
p.on('pageerror', (e) => problems.push(e.message));

await p.goto(`${baseUrl}/settings/`, { waitUntil: 'networkidle' });
await p.getByRole('switch', { name: 'High contrast' }).click();
await p.getByRole('switch', { name: 'Reduced motion' }).click();
await p.waitForTimeout(500);
const root = await p.evaluate(() => ({
  contrast: document.documentElement.dataset.contrast,
  motion: document.documentElement.dataset.motion,
}));
console.log('root attributes:', JSON.stringify(root));

await p.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });
await p.waitForTimeout(600);
await p.screenshot({ path: `${shots}/a11y-high-contrast-home.png`, fullPage: false });

// Keyboard-only run through the home page.
const reachable = [];
for (let i = 0; i < 12; i += 1) {
  await p.keyboard.press('Tab');
  reachable.push(await p.evaluate(() => {
    const el = document.activeElement;
    return el ? `${el.tagName}:${(el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40)}` : 'none';
  }));
}
console.log('tab order:', reachable.join(' | '));

// Every board cell must be at least 44px on its shortest side.
await p.goto(`${baseUrl}/workshop/`, { waitUntil: 'networkidle' });
await p.waitForTimeout(600);
const small = await p.evaluate(() =>
  Array.from(document.querySelectorAll('button, [role="switch"], a.ml-button-primary, a.ml-button-secondary'))
    .map((el) => { const r = el.getBoundingClientRect(); return { name: (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 30), w: Math.round(r.width), h: Math.round(r.height) }; })
    .filter((x) => x.w > 0 && (x.w < 44 || x.h < 44)),
);
console.log('targets under 44px:', JSON.stringify(small));
await p.screenshot({ path: `${shots}/a11y-high-contrast-workshop.png`, fullPage: false });
await b.close();
if (problems.length) { console.error(problems); process.exit(1); }
