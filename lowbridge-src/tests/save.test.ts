import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import { acceptQ01, initialProgress } from '../src/rules/progress.ts';
import type { SaveEnvelope } from '../src/rules/save.ts';
import { SaveController, createIdbStore, createMemoryStore, freshEnvelope, validateEnvelope } from '../src/rules/save.ts';

const env = (revision: number): SaveEnvelope => ({ ...freshEnvelope(), revision });

for (const [name, make] of [
  ['memory', () => createMemoryStore()],
  ['IndexedDB', () => createIdbStore(new IDBFactory())],
] as const) {
  test(`${name}: commits only on the expected revision and keeps the previous snapshot`, async () => {
    const store = make();
    assert.equal(await store.load(), null);
    assert.equal((await store.commit(0, env(1))).ok, true);
    assert.equal((await store.commit(1, env(2))).ok, true);
    const stale = await store.commit(1, env(2));
    assert.equal(stale.ok, false);
    assert.equal(!stale.ok && stale.reason, 'conflict');
    assert.equal((await store.load())!.revision, 2);
    assert.equal((await store.loadPrevious())!.revision, 1);
    await store.clear();
    assert.equal(await store.load(), null);
  });
}

test('two tabs: the stale one is refused and adopts the newer save', async () => {
  const store = createIdbStore(new IDBFactory());
  const a = new SaveController(store);
  const b = new SaveController(store);
  let adopted: SaveEnvelope | null = null;
  b.onAdopt = (e) => (adopted = e);
  const carrying = acceptQ01(initialProgress());
  assert.ok(carrying.ok);
  assert.equal(await a.write(carrying.progress, null), true);
  assert.equal(await b.write(initialProgress(), null), false);
  assert.equal(adopted!.progress.story.stage, 'carrying');
  assert.equal(b.revision, 1);
});

test('a storage failure is reported, not hidden', async () => {
  const store = createMemoryStore({ failWrites: true });
  const c = new SaveController(store);
  assert.equal(await c.write(initialProgress(), null), false);
  assert.equal(c.status, 'failed');
  store.failWrites = false;
  assert.equal(await c.write(initialProgress(), null), true);
  assert.equal(c.status, 'saved');
});

test('validation: newer schemas are reported untouched; bad data is rejected', () => {
  assert.equal(validateEnvelope(env(3)).ok, true);
  const newer = validateEnvelope({ ...env(1), schemaVersion: 99 });
  assert.equal(!newer.ok && newer.reason, 'newer');
  const bad = structuredClone(env(1));
  bad.progress.crews.ferry = 9;
  assert.equal(validateEnvelope(bad).ok, false);
  assert.equal(validateEnvelope({ nonsense: true }).ok, false);
});

test('a checkpoint save queued beside a story change never writes the older progress back', async () => {
  const store = createMemoryStore();
  const c = new SaveController(store);
  const start = initialProgress();
  await c.write(start, null);
  const accepted = acceptQ01(start);
  assert.ok(accepted.ok);
  const cp = () => ({
    locomotion: 'foot' as const,
    player: { x: 1, y: 2, facing: 0 },
    van: { x: 0, y: 0, heading: 0 },
    express: { x: 0, y: 0, heading: 0, borrowed: false },
    pursuit: false,
  });
  await Promise.all([c.write(accepted.progress, null), c.writeCheckpoint(cp)]);
  const saved = await store.load();
  assert.equal(saved!.progress.story.stage, 'carrying');
  assert.equal(saved!.checkpoint!.player.x, 1);
});
