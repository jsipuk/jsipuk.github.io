import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SHOPS } from '../src/rules/content.ts';
import { NO_INPUT } from '../src/rules/controls.ts';
import { buildRiverside } from '../src/rules/map.ts';
import { addStats, acceptQ01, deliverBattery, initialProgress, isUnlocked, setStyle, unlockMet } from '../src/rules/progress.ts';
import type { Progress, Result } from '../src/rules/progress.ts';
import { JACKET_STYLES, HAT_STYLES } from '../src/rules/content.ts';
import { createAmbient, honk, stepAmbient } from '../src/rules/ambient.ts';
import { checkImport, freshEnvelope, validateEnvelope } from '../src/rules/save.ts';
import { availableAction, choose, horn, pause, resume, settled, shopChoose, shopClose, stepSession } from '../src/rules/session.ts';
import { STEP, act, harness, run, walkTo } from './helpers.ts';

const map = buildRiverside();
const ok = (r: Result): Progress => {
  assert.ok(r.ok, r.ok ? '' : r.reason);
  return r.progress;
};

test('pigeons scatter when you walk into them, count once, and come back later', async () => {
  const { s } = harness();
  await walkTo(s, { x: 92, y: 500 });
  await walkTo(s, { x: 92, y: 470 });
  const flock = s.ambient.flocks.find((f) => f.id === 'depot')!;
  assert.equal(flock.birds.filter((b) => b.state === 'ground').length, 0, 'all up and away');
  await walkTo(s, { x: 92, y: 610 }); // walk off
  run(s, NO_INPUT, 3);
  await settled(s);
  assert.equal(s.progress.stats.pigeons, 6);
  run(s, NO_INPUT, 30);
  assert.equal(flock.birds.filter((b) => b.state === 'ground').length, 6, 'back on the ground');
});

test('the horn scatters pigeons in earshot and makes someone grumble', () => {
  const a = createAmbient();
  const quay = a.flocks.find((f) => f.id === 'quay')!;
  const events = honk(a, { x: 200, y: 100 });
  assert.ok(events.some((e) => e.type === 'pigeons'));
  assert.equal(quay.birds.filter((b) => b.state === 'ground').length, 0);
  assert.ok(a.flocks.find((f) => f.id === 'ring')!.birds.every((b) => b.state === 'ground'), 'far flocks stay put');
});

test('people step aside from an approaching van, and a bump is a stumble and a shout', () => {
  const a = createAmbient();
  const dee = a.peds.find((p) => p.id === 'dee')!;
  Object.assign(dee, { x: 300, y: 440, state: 'walk' });
  // A van driving east along the pavement towards Dee.
  const van = { heading: 0, speed: 60, halfLength: 15, halfWidth: 8.5 };
  stepAmbient(a, map, { pos: { x: 250, y: 440 }, vehicle: van }, STEP);
  assert.equal(dee.state, 'dodge');
  const before = { x: dee.x, y: dee.y };
  for (let i = 0; i < 30; i++) stepAmbient(a, map, { pos: { x: 250, y: 440 }, vehicle: { ...van, speed: 0 } }, STEP);
  assert.ok(Math.hypot(dee.x - before.x, dee.y - before.y) > 5, 'moved out of the way');
  // Right on top of someone while moving: stumble and shout, never hurt.
  Object.assign(dee, { x: 400, y: 440, state: 'walk', quiet: 0 });
  const events = stepAmbient(a, map, { pos: { x: 400, y: 440 }, vehicle: van }, STEP);
  const bump = events.find((e) => e.type === 'ped_bump');
  assert.ok(bump && bump.type === 'ped_bump');
  assert.equal(dee.state, 'stumble');
});

test('named locals say their lines in order; chats count once per person', async () => {
  const { s } = harness();
  const arthur = s.ambient.peds.find((p) => p.id === 'arthur')!;
  s.player.x = arthur.x + 8;
  s.player.y = arthur.y + 4;
  assert.equal(availableAction(s).verb, 'Talk to Arthur');
  await act(s);
  const first = s.prompts[0].line!.text;
  await choose(s, 'ok');
  await act(s);
  const second = s.prompts[0].line!.text;
  await choose(s, 'ok');
  assert.notEqual(first, second);
  run(s, NO_INPUT, 2.5);
  await settled(s);
  assert.equal(s.progress.stats.chats, 2);
  assert.deepEqual(s.progress.chatted, ['arthur']);
});

test('unlocks follow saved progress, and locked items are refused', () => {
  let p = initialProgress();
  const plum = JACKET_STYLES.find((j) => j.id === 'plum')!;
  assert.equal(isUnlocked(p, plum), false);
  assert.equal(setStyle(p, 'jacket', 'plum').ok, false);
  p = ok(deliverBattery(ok(acceptQ01(p)), 'nell_price'));
  assert.equal(unlockMet(p, 'market_friend'), true);
  p = ok(setStyle(p, 'jacket', 'plum'));
  assert.equal(p.style.jacket, 'plum');
  const r = addStats(p, { pigeons: 50 }, ['a', 'b', 'c', 'd', 'e']);
  assert.ok(r.ok);
  const names = r.ok ? r.events.flatMap((e) => (e.type === 'unlocked' ? e.items : [])) : [];
  assert.ok(names.includes('Pigeon grey') && names.includes('Flat cap'), names.join(', '));
  assert.ok(isUnlocked(r.ok ? r.progress : p, HAT_STYLES.find((h) => h.id === 'flat_cap')!));
});

test('Second Thread opens on foot; picks are saved; locked ones are refused', async () => {
  const { s, store } = harness();
  s.player.x = SHOPS.tailor.at.x;
  s.player.y = SHOPS.tailor.at.y + 10;
  assert.equal(availableAction(s).kind, 'tailor');
  await act(s);
  assert.equal(s.mode, 'shop');
  await shopChoose(s, 'hat', 'beanie');
  await shopChoose(s, 'jacket', 'plum'); // locked
  assert.equal(s.progress.style.hat, 'beanie');
  assert.equal(s.progress.style.jacket, 'amber');
  shopClose(s);
  assert.equal(s.mode, 'world');
  assert.equal((await store.load())!.progress.style.hat, 'beanie');
});

test('Body & Paint opens only with the van in its bay', async () => {
  const { s } = harness();
  s.locomotion = 'van';
  Object.assign(s.van, { x: SHOPS.paint.at.x, y: SHOPS.paint.at.y, heading: -Math.PI / 2, speed: 0 });
  assert.equal(availableAction(s).kind, 'paint');
  await act(s);
  assert.equal(s.mode, 'shop');
  assert.equal(s.shop, 'paint');
  await shopChoose(s, 'vanBody', 'teal');
  await shopChoose(s, 'vanStripe', 'amber');
  assert.equal(s.progress.style.vanBody, 'teal');
  assert.equal(s.progress.style.vanStripe, 'amber');
});

test('the depot payphone rings with wrong numbers in free roam; answering counts', async () => {
  const { s } = harness();
  s.progress = ok(acceptQ01(s.progress));
  s.player.x = 92;
  s.player.y = 566;
  run(s, NO_INPUT, 80);
  const a = availableAction(s);
  assert.equal(a.kind, 'wrong_call');
  await act(s);
  assert.equal(s.prompts[0].line!.role, 'Wrong number');
  await choose(s, 'ok');
  run(s, NO_INPUT, 2.5);
  await settled(s);
  assert.equal(s.progress.stats.calls, 1);
});

test('chips three times unlocks the chip-paper jacket', async () => {
  const { s } = harness();
  s.player.x = SHOPS.chips.at.x;
  s.player.y = SHOPS.chips.at.y + 8;
  for (let i = 0; i < 3; i++) {
    assert.equal(availableAction(s).kind, 'chips');
    await act(s);
    run(s, NO_INPUT, 2.2);
    await settled(s);
  }
  assert.equal(s.progress.stats.chips, 3);
  assert.ok(unlockMet(s.progress, 'chips_3'));
});

test('pause freezes the town too', () => {
  const { s } = harness();
  run(s, NO_INPUT, 1);
  const at = s.ambient.peds.map((p) => [p.x, p.y]);
  pause(s);
  run(s, NO_INPUT, 3);
  assert.deepEqual(s.ambient.peds.map((p) => [p.x, p.y]), at);
  resume(s);
  stepSession(s, NO_INPUT, STEP);
});

test('the horn only sounds from a vehicle and counts honks', async () => {
  const { s } = harness();
  horn(s);
  assert.equal(s.pendingStats.honks ?? 0, 0, 'no horn on foot');
  s.locomotion = 'van';
  horn(s);
  horn(s); // too soon: ignored
  run(s, NO_INPUT, 2.2);
  await settled(s);
  assert.equal(s.progress.stats.honks, 1);
});

test('schema 3: M1 and M2 saves migrate with a default look and zero counts', () => {
  const v1 = checkImport(readFileSync(new URL('./fixtures/save-v1-mo.json', import.meta.url), 'utf8'));
  assert.ok(v1.ok);
  assert.equal(v1.envelope.schemaVersion, 3);
  assert.equal(v1.envelope.progress.style.jacket, 'amber');
  assert.equal(v1.envelope.progress.stats.pigeons, 0);
  const v2 = structuredClone(freshEnvelope()) as unknown as { schemaVersion: number; progress: Record<string, unknown> };
  v2.schemaVersion = 2;
  delete v2.progress.style;
  delete v2.progress.stats;
  delete v2.progress.chatted;
  const r = validateEnvelope(v2);
  assert.ok(r.ok);
  assert.equal(r.migratedFrom, 2);
  const bad = structuredClone(freshEnvelope());
  bad.progress.style.jacket = 'gold-lamé';
  assert.equal(validateEnvelope(bad).ok, false);
});
