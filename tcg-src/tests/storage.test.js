import test from "node:test";
import assert from "node:assert/strict";
import { IDBFactory, IDBObjectStore } from "fake-indexeddb";
import { readFile } from "node:fs/promises";
import {
  createCollection,
  setQuantity,
  resetCollection,
  quantity,
} from "../src/domain/collection.js";
import {
  openDatabase,
  loadCollection,
  readCollection,
  saveCollection,
  STORAGE_KEY,
} from "../src/domain/storage.js";
const reference = JSON.parse(
  await readFile(
    new URL("./fixtures/legacy-reference.json", import.meta.url),
    "utf8",
  ),
);
const fresh = () => createCollection(reference);
const card = reference.cards[0];
const legacy = (value = null) => ({
  getItem(key) {
    assert.equal(key, STORAGE_KEY);
    return value;
  },
  setItem() {
    throw Error("Legacy data must stay untouched");
  },
});

test("IndexedDB migrates legacy quantities, variants, pending review and notes without changing old data", async () => {
  const factory = new IDBFactory(),
    db = await openDatabase(factory);
  let state = setQuantity(fresh(), card.id, "unspecified", 3);
  state.notes = { text: "收藏 · keep me" };
  state.draft.text = "999/102";
  const raw = JSON.stringify(state),
    old = legacy(raw);
  const loaded = await loadCollection(db, old, fresh());
  assert.equal(loaded.migrated, true);
  assert.equal(loaded.revision, 1);
  assert.equal(old.getItem(STORAGE_KEY), raw);
  const stored = await readCollection(db);
  assert.deepEqual(stored.state, state);
  const tx = db.transaction("settings");
  const request = tx.objectStore("settings").get("current");
  await new Promise((resolve) => {
    tx.oncomplete = resolve;
  });
  assert.equal("reference" in request.result.state, false);
  db.close();
  const reopened = await openDatabase(factory);
  assert.deepEqual(
    (await loadCollection(reopened, legacy("{bad"), fresh())).state,
    state,
  );
  reopened.close();
});

test("corrupt legacy data is preserved and never replaced with an empty collection", async () => {
  const db = await openDatabase(new IDBFactory());
  const loaded = await loadCollection(db, legacy("{broken"), fresh());
  assert.ok(loaded.error);
  assert.equal(loaded.raw, "{broken");
  assert.equal(await readCollection(db), null);
  await saveCollection(db, fresh(), 0, { recovery: true });
  assert.equal((await readCollection(db)).revision, 1);
  db.close();
});

test("transaction failure after ownership write rolls back ownership and reference together", async () => {
  const db = await openDatabase(new IDBFactory());
  const initial = await loadCollection(db, legacy(), fresh());
  const next = setQuantity(initial.state, card.id, "unspecified", 3);
  next.reference.source.extra = "new reference";
  const put = IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put = function (...args) {
    if (this.name === "referenceSets") throw Error("Quota exceeded");
    return put.apply(this, args);
  };
  try {
    await assert.rejects(
      saveCollection(db, next, initial.revision),
      /Quota exceeded/,
    );
  } finally {
    IDBObjectStore.prototype.put = put;
  }
  assert.deepEqual(await readCollection(db), {
    state: initial.state,
    revision: initial.revision,
  });
  db.close();
});

test("stale revisions cannot overwrite another tab; reset persists without losing reference", async () => {
  const factory = new IDBFactory(),
    db = await openDatabase(factory),
    other = await openDatabase(factory);
  const initial = await loadCollection(db, legacy(), fresh());
  const next = setQuantity(initial.state, card.id, "unspecified", 3);
  const revision = await saveCollection(other, next, initial.revision);
  await assert.rejects(
    saveCollection(db, initial.state, initial.revision),
    /another tab/,
  );
  const current = await readCollection(db);
  assert.equal(quantity(current.state, card.id), 3);
  assert.equal(current.revision, revision);
  await saveCollection(db, resetCollection(current.state), revision);
  const reset = await readCollection(other);
  assert.equal(quantity(reset.state, card.id), 0);
  assert.deepEqual(reset.state.reference, reference);
  db.close();
  other.close();
});

test("simultaneous first-time migration keeps the first committed collection", async () => {
  const factory = new IDBFactory(),
    db = await openDatabase(factory),
    other = await openDatabase(factory);
  const initial = setQuantity(fresh(), card.id, "unspecified", 2);
  const [a, b] = await Promise.all([
    loadCollection(db, legacy(JSON.stringify(initial)), fresh()),
    loadCollection(other, legacy(JSON.stringify(initial)), fresh()),
  ]);
  assert.equal(a.error, null);
  assert.equal(b.error, null);
  assert.deepEqual(a.state, initial);
  assert.deepEqual(b.state, initial);
  assert.equal(a.revision, 1);
  assert.equal(b.revision, 1);
  db.close();
  other.close();
});

test("database v1 upgrade splits the stored ledger without resetting copies or losing legacy reference", async () => {
  const factory = new IDBFactory();
  const state = { ...fresh(), version: 1, notes: "迁移测试" };
  delete state.trackedSets;
  state.quantities = setQuantity(state, card.id, "unspecified", 3).quantities;
  const old = await new Promise((resolve, reject) => {
    const request = factory.open("card-ledger", 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("reference");
      request.result.createObjectStore("collection");
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
  const tx = old.transaction(["reference", "collection"], "readwrite");
  const { reference: ref, ...ownership } = state;
  tx.objectStore("reference").put(ref, "current");
  tx.objectStore("collection").put(
    { revision: 7, state: ownership },
    "current",
  );
  await new Promise((resolve) => (tx.oncomplete = resolve));
  old.close();
  const db = await openDatabase(factory),
    stored = await readCollection(db);
  assert.equal(db.version, 2);
  for (const name of [
    "referenceSets",
    "referenceCards",
    "referenceVersions",
    "collectionEntries",
    "settings",
  ])
    assert.ok(db.objectStoreNames.contains(name));
  assert.equal(stored.revision, 7);
  assert.equal(stored.state.version, 2);
  assert.deepEqual(stored.state.quantities, state.quantities);
  assert.deepEqual(stored.state.reference.cards, state.reference.cards);
  assert.deepEqual(
    stored.state.trackedSets,
    state.reference.releases.map((r) => r.id),
  );
  assert.equal(stored.state.notes, state.notes);
  assert.ok(stored.state.reference.releases.every((r) => r.legacy));
  db.close();
});
