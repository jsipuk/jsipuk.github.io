/**
 * Verifies the production build works offline after one visit.
 *
 *   npm run build && npx serve out -l 4321 &
 *   node scripts/offline-check.mjs http://localhost:4321
 */
import { chromium } from 'playwright';

const baseUrl = process.argv[2] ?? 'http://localhost:4321';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
});
const context = await browser.newContext({ viewport: { width: 430, height: 932 } });
const page = await context.newPage();

const errors = [];
page.on('pageerror', (error) => errors.push(error.message));

await page.goto(baseUrl, { waitUntil: 'networkidle' });
await page.getByRole('heading', { name: 'My Life Workshop' }).waitFor();

// Give the service worker time to install and precache.
await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, null, {
  timeout: 15_000,
});
await page.waitForTimeout(2500);
console.log('✓ service worker active');

// Play a little so there is state to restore.
await page.getByRole('button', { name: 'Begin intentional session' }).click();
await page.waitForTimeout(400);
for (let i = 0; i < 4; i += 1) {
  await page.getByRole('button', { name: /Take a part from the Case Parts Bench/ }).click();
  await page.waitForTimeout(120);
}
const itemsBefore = await page.locator('[data-cell-index] svg').count();

await context.setOffline(true);
console.log('✓ network disabled');

await page.reload({ waitUntil: 'domcontentloaded' });
await page.getByRole('heading', { level: 1, name: 'Watch Workshop' }).waitFor({ timeout: 15_000 });
await page.waitForTimeout(1200);
const itemsAfter = await page.locator('[data-cell-index] svg').count();
console.log(`✓ workshop loaded offline (${itemsAfter} items restored, ${itemsBefore} before)`);

await page.goto(`${baseUrl}/collection/`, { waitUntil: 'domcontentloaded' });
await page.getByRole('heading', { name: 'Watch Collection' }).waitFor({ timeout: 15_000 });
console.log('✓ collection route loaded offline');

await browser.close();

if (itemsAfter !== itemsBefore) {
  console.error(`Board did not restore offline: ${itemsBefore} -> ${itemsAfter}`);
  process.exit(1);
}
if (errors.length > 0) {
  console.error('Page errors:', errors);
  process.exit(1);
}
console.log('\nOffline check passed.');
