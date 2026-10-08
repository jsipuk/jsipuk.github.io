import { test, expect } from "@playwright/test";
import { readSaved, track } from "./browser-helpers.js";

const nidoking = 'pokemon:en:destined-rivals:119';
const owned = (saved, id) => saved.quantities[JSON.stringify([id, 'unspecified'])] || 0;
async function openRapid(page) {
  await page.goto('/tcg/');
  await track(page, 'perfect-order-en');
  await page.locator('[data-binder="perfect-order-en"]').click();
  await page.locator('#rapid-entry').click();
}
async function submit(page, raw) {
  await page.locator('#rapid-number').fill(raw);
  await page.locator('#rapid-number').press('Enter');
}

test('wrong-set Rapid Entry loads the matching release, requires choice, supports Undo and persists the explicit switch', async ({ page }) => {
  const requests=[];
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/tcg-data/sets/en/destined-rivals.json') requests.push(request.url());
  });
  await openRapid(page);
  await submit(page, '119/182');
  await expect(page.locator('#detail')).toBeVisible();
  await expect(page.locator('#detail')).toContainText('119/182 does not match Perfect Order. Its cards use /088.');
  await expect(page.locator('#detail')).toContainText("Team Rocket's Nidoking ex · 119/182");
  await expect(page.locator('[data-rapid-choose]')).toHaveCount(1);
  expect((await readSaved(page)).quantities).toEqual({});
  expect((await readSaved(page)).trackedSets).toEqual(['perfect-order-en']);
  await page.locator('#close').click();
  await expect(page.locator('#rapid-number')).toHaveValue('119/182');
  await expect(page.locator('#rapid-number')).toBeFocused();
  await expect(page.locator('#rapid-set')).toHaveValue('perfect-order-en');
  await page.locator('#rapid-number').press('Enter');
  await page.getByRole('button', { name: 'Switch to Destined Rivals and add', exact: true }).click();
  await expect(page.locator('#rapid-set')).toHaveValue('destined-rivals-en');
  await expect(page.locator('#rapid-number')).toHaveValue('');
  await expect(page.locator('#rapid-recent')).toContainText('Own 1');
  expect(owned(await readSaved(page), nidoking)).toBe(1);
  await page.locator('#undo').click();
  await expect(page.locator('#rapid-set')).toHaveValue('perfect-order-en');
  expect((await readSaved(page)).quantities).toEqual({});
  expect((await readSaved(page)).trackedSets).toEqual(['perfect-order-en']);
  await submit(page, '119/182');
  await page.getByRole('button', { name: 'Switch to Destined Rivals and add', exact: true }).click();
  await expect(page.locator('#rapid-number')).toHaveValue('');
  await submit(page, '119/182');
  await expect(page.locator('#rapid-recent')).toContainText('Own 2 · ×2');
  expect(requests).toHaveLength(1);
  await page.reload();
  await page.locator('#rapid-mode').click();
  await expect(page.locator('#rapid-set')).toHaveValue('destined-rivals-en');
  const saved=await readSaved(page);
  expect(owned(saved,nidoking)).toBe(2);
  expect(saved.trackedSets).toEqual(['perfect-order-en','destined-rivals-en']);
  expect(saved.reference.cards).toHaveLength(368);
});

test('a mismatch without another match stays unresolved and valid Perfect Order entry remains exact', async ({ page }) => {
  await openRapid(page);
  await submit(page, '119/999');
  await expect(page.locator('#detail')).toContainText('Its cards use /088');
  await expect(page.locator('[data-rapid-choose]')).toHaveCount(0);
  expect((await readSaved(page)).quantities).toEqual({});
  await page.locator('#close').click();
  await expect(page.locator('#detail')).not.toBeVisible();
  await submit(page, '119/18?');
  await expect(page.locator('#toast')).toContainText('Check the collector number');
  await expect(page.locator('#detail')).not.toBeVisible();
  await submit(page, '999/088');
  await expect(page.locator('#toast')).toContainText('No match');
  await expect(page.locator('#detail')).not.toBeVisible();
  await submit(page, '119/088');
  await expect(page.locator('#rapid-recent')).toContainText('Mega Clefable ex · 119/088');
  expect(owned(await readSaved(page),'pokemon:en:perfect-order:119')).toBe(1);
  expect(owned(await readSaved(page),nidoking)).toBe(0);
});

test('mixed batch review explains the mismatch and adds the other-set card only after confirmation and commit', async ({ page }) => {
  await page.goto('/tcg/');
  await track(page,'perfect-order-en');
  await page.locator('[data-nav="add"]').click();
  await page.locator('#set').selectOption('perfect-order-en');
  await page.locator('#numbers').fill('94/088\n119/182');
  await page.locator('#find').click();
  await expect(page.locator('.summary')).toHaveText('1 ready · 1 need checking');
  await expect(page.locator('.status')).toContainText('119/182 does not match Perfect Order. Its cards use /088.');
  await page.getByRole('button',{name:'Check set',exact:true}).click();
  await expect(page.locator('#detail')).toContainText("Team Rocket's Nidoking ex · 119/182");
  expect((await readSaved(page)).quantities).toEqual({});
  await page.locator('#close').click();
  await expect(page.locator('.summary')).toHaveText('1 ready · 1 need checking');
  await page.getByRole('button',{name:'Check set',exact:true}).click();
  await page.locator(`[data-choose="${nidoking}"]`).click();
  await expect(page.locator('.summary')).toHaveText('2 ready · 0 need checking');
  expect((await readSaved(page)).quantities).toEqual({});
  await page.reload();
  await page.locator('#resume').click();
  await expect(page.locator('.summary')).toHaveText('2 ready · 0 need checking');
  await page.locator('#commit').click();
  await expect(page.locator('#toast')).toContainText('2 copies added');
  const saved=await readSaved(page);
  expect(owned(saved,'pokemon:en:perfect-order:094')).toBe(1);
  expect(owned(saved,nidoking)).toBe(1);
  expect(saved.trackedSets).toEqual(['perfect-order-en','destined-rivals-en']);
  expect(saved.batch).toEqual([]);
});

test('unavailable other-set data preserves input and ownership and can be retried', async ({ page }) => {
  const pack='**/tcg-data/sets/en/destined-rivals.json';
  await page.route(pack,route=>route.abort());
  await openRapid(page);
  await submit(page,'119/182');
  await expect(page.locator('#detail')).toContainText('119/182 does not match Perfect Order');
  await expect(page.locator('[data-rapid-choose]')).toHaveCount(0);
  const saved=await readSaved(page);
  expect(saved.quantities).toEqual({});
  expect(saved.reference.cards).toHaveLength(124);
  expect(saved.trackedSets).toEqual(['perfect-order-en']);
  await page.locator('#close').click();
  await expect(page.locator('#detail')).not.toBeVisible();
  await expect(page.locator('#rapid-number')).toHaveValue('119/182');
  await expect(page.locator('#rapid-set')).toHaveValue('perfect-order-en');
  await page.unroute(pack);
  await page.locator('#rapid-number').press('Enter');
  await expect(page.locator(`[data-rapid-choose="${nidoking}"]`)).toBeVisible();
  expect((await readSaved(page)).quantities).toEqual({});
});
