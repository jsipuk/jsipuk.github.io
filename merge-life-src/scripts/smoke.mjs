/**
 * Manual smoke test: drives a real browser through a session and reports any
 * console errors. Run with the dev server up:
 *   node scripts/smoke.mjs [baseUrl]
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const baseUrl = process.argv[2] ?? 'http://localhost:3210';
const shotDir = process.env.SHOT_DIR ?? '/tmp/merge-life-shots';
mkdirSync(shotDir, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const context = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2 });
const page = await context.newPage();

const problems = [];
page.on('console', (message) => {
  if (message.type() === 'error' || message.type() === 'warning') {
    problems.push(`[${message.type()}] ${message.text()}`);
  }
});
page.on('pageerror', (error) => problems.push(`[pageerror] ${error.message}`));

const step = async (name, fn) => {
  await fn();
  await page.screenshot({ path: `${shotDir}/${name}.png`, fullPage: true });
  console.log(`✓ ${name}`);
};

await step('01-home', async () => {
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'My Life Workshop' }).waitFor();
});

await step('02-session-started', async () => {
  await page.getByRole('button', { name: 'Begin intentional session' }).click();
  await page.getByRole('heading', { level: 1, name: 'Watch Workshop' }).waitFor();
  await page.getByText('Session time left').waitFor();
});

await step('03-generators-used', async () => {
  for (let i = 0; i < 8; i += 1) {
    await page.getByRole('button', { name: /Take a part from the Movement Parts Tray/ }).click();
    await page.waitForTimeout(60);
  }
  for (let i = 0; i < 4; i += 1) {
    await page.getByRole('button', { name: /Take a part from the Design Desk/ }).click();
    await page.waitForTimeout(60);
  }
});

const labelsOf = async (page) => {
  const cells = page.locator('[data-cell-index]');
  const count = await cells.count();
  const labels = [];
  for (let i = 0; i < count; i += 1) labels.push(await cells.nth(i).getAttribute('aria-label'));
  return labels;
};

/** Finds two cells holding the same item, so a merge is guaranteed. */
const findPair = async (page) => {
  const labels = await labelsOf(page);
  const seen = new Map();
  for (let i = 0; i < labels.length; i += 1) {
    const name = (labels[i] ?? '').split(',')[0];
    if (name.startsWith('Empty space')) continue;
    if (seen.has(name)) return [seen.get(name), i, name];
    seen.set(name, i);
  }
  return null;
};

await step('04-tap-merge', async () => {
  const pair = await findPair(page);
  if (!pair) throw new Error('No matching pair on the board to merge');
  const [a, b, name] = pair;
  const cells = page.locator('[data-cell-index]');
  await cells.nth(a).click();
  await cells.nth(b).click();
  await page.waitForTimeout(300);
  const after = await cells.nth(b).getAttribute('aria-label');
  console.log(`   tap-merged two ${name} -> ${after}`);
  if (after.startsWith(name)) throw new Error('Tap merge did not produce a new item');
  if (!(await cells.nth(a).getAttribute('aria-label')).startsWith('Empty space')) {
    throw new Error('Source cell was not emptied by the merge');
  }
});

await step('05-drag-merge', async () => {
  const pair = await findPair(page);
  if (!pair) throw new Error('No matching pair on the board to merge');
  const [a, b, name] = pair;
  const cells = page.locator('[data-cell-index]');
  const from = await cells.nth(a).boundingBox();
  const to = await cells.nth(b).boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 14 });
  await page.mouse.up();
  await page.waitForTimeout(300);
  const after = await cells.nth(b).getAttribute('aria-label');
  console.log(`   drag-merged two ${name} -> ${after}`);
  if (after.startsWith(name)) throw new Error('Drag merge did not produce a new item');
});

await step('05b-undo', async () => {
  const cells = page.locator('[data-cell-index]');
  const before = await labelsOf(page);
  await page.getByRole('button', { name: 'Undo last move' }).click();
  await page.waitForTimeout(300);
  const after = await labelsOf(page);
  if (JSON.stringify(before) === JSON.stringify(after)) throw new Error('Undo changed nothing');
  console.log(`   undo restored ${after.filter((l) => !l.startsWith('Empty')).length} items`);
  await cells.nth(0).waitFor();
});

await step('06-collection', async () => {
  await page.goto(`${baseUrl}/collection/`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Watch Collection' }).waitFor();
});

await step('07-wellbeing', async () => {
  await page.goto(`${baseUrl}/wellbeing/`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Wellbeing' }).waitFor();
});

await step('08-settings', async () => {
  await page.goto(`${baseUrl}/settings/`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: 'Settings' }).waitFor();
});

await step('09-persistence-after-reload', async () => {
  await page.goto(`${baseUrl}/workshop/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const before = await page.locator('[data-cell-index] svg').count();
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const after = await page.locator('[data-cell-index] svg').count();
  console.log(`   items on board before reload: ${before}, after: ${after}`);
  if (after !== before) throw new Error(`Board did not restore: ${before} -> ${after}`);
});

await step('10-end-session', async () => {
  await page.getByRole('button', { name: 'End session' }).click();
  await page.getByRole('button', { name: 'Yes, end the session' }).click();
  await page.getByRole('heading', { name: /Good session/ }).waitFor();
});

await step('11-desktop-home', async () => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
});


// Steps 12-14 need the development-only seeded save, which production builds
// deliberately do not ship.
await page.goto(`${baseUrl}/settings/`, { waitUntil: 'networkidle' });
const hasSeed = (await page.getByRole('button', { name: 'Load seeded demo save' }).count()) > 0;
if (!hasSeed) console.log('· production build: skipping the seeded-save steps');

const devStep = async (name, fn) => {
  if (!hasSeed) return;
  await step(name, fn);
};

await devStep('12-craft-a-watch', async () => {
  // Load the deterministic demo save, which has level 5 parts ready to case up.
  await page.goto(`${baseUrl}/settings/`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Load seeded demo save' }).click();
  await page.waitForTimeout(600);

  await page.goto(`${baseUrl}/workshop/`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'Begin intentional session' }).click();
  await page.waitForTimeout(400);

  await page.getByRole('button', { name: /Choose Mechanical Movement.*as the movement/ }).first().click();
  await page.getByRole('button', { name: /Choose Watch Case Assembly.*as the case/ }).first().click();
  await page.getByRole('button', { name: /Choose Dial and Hands Set.*as the dial/ }).first().click();
  await page.getByRole('button', { name: 'Build this watch' }).click();
  await page.waitForTimeout(500);
  const heading = await page.getByText('Added to your collection, permanently').isVisible();
  if (!heading) throw new Error('Watch was not built');
});

await devStep('13-collection-after-craft', async () => {
  await page.goto(`${baseUrl}/collection/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  const built = await page.getByText('Watches built').isVisible();
  if (!built) throw new Error('Collection did not render');
});

await devStep('14-daily-limit-viewing-mode', async () => {
  await page.goto(`${baseUrl}/workshop/`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: 'End session' }).click();
  await page.getByRole('button', { name: 'Yes, end the session' }).click();
  await page.getByRole('button', { name: 'Close workshop' }).click();
  await page.waitForTimeout(400);

  // Second session of the day, then the limit should be reached.
  await page.getByRole('button', { name: /Begin intentional session|Continue where you left off/ }).click();
  await page.waitForTimeout(400);
  await page.getByRole('button', { name: 'End session' }).click();
  await page.getByRole('button', { name: 'Yes, end the session' }).click();
  await page.getByRole('button', { name: 'Close workshop' }).click();
  await page.waitForTimeout(500);

  const viewing = await page.getByText('You have used both of today').isVisible();
  if (!viewing) throw new Error('Daily limit did not switch to viewing mode');
});

await step('15-no-dark-patterns-anywhere', async () => {
  const banned = /play again|watch an ad|watch advert|buy more time|extend session|streak|energy refill|loot box|come back in/i;
  for (const path of ['', 'workshop', 'collection', 'wellbeing', 'settings']) {
    await page.goto(`${baseUrl}/${path ? `${path}/` : ''}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(200);
    let text = await page.locator('body').innerText();

    // The settings page lists the patterns this game promises never to use;
    // that card is the one legitimate place these words appear.
    const promiseCard = page.locator('section', { hasText: 'What this game will never do' }).last();
    if (await promiseCard.count()) {
      const promiseText = await promiseCard.innerText();
      text = text.replace(promiseText, '');
    }

    // A line that denies a pattern ("No streaks, no adverts") is the point.
    const offending = text
      .split('\n')
      .filter((line) => banned.test(line) && !/\bno\b|\bnever\b|does not/i.test(line));
    if (offending.length > 0) {
      throw new Error(`Dark-pattern wording on /${path}: ${offending.join(' | ')}`);
    }
  }
});

await browser.close();

const noise = problems.filter(
  (problem) => !problem.includes('Download the React DevTools') && !problem.includes('[Fast Refresh]'),
);
if (noise.length > 0) {
  console.log(`\n${noise.length} console problems:`);
  for (const problem of noise) console.log(`  ${problem}`);
  process.exit(1);
}
console.log('\nNo console errors or warnings.');
