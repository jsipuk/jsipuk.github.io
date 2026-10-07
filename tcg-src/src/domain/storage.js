import {
  importBackup,
  migrateCollection,
  validateCollection,
} from "./collection.js";
export const STORAGE_KEY = "cardledger-alpha-v1";
export const DATABASE_NAME = "card-ledger";
export const STORES = [
  "referenceSets",
  "referenceCards",
  "referenceVersions",
  "collectionEntries",
  "settings",
];
const referenceCache = new WeakMap();
function writeReference(tx, reference) {
  const { releases, cards, ...metadata } = reference;
  const sets = tx.objectStore("referenceSets"),
    entries = tx.objectStore("referenceCards");
  sets.clear();
  entries.clear();
  for (const release of releases) {
    sets.put(release, release.id);
    tx.objectStore("referenceVersions").put(
      {
        dataVersion: release.importedVersion ?? null,
        source: release.source ?? release.provider ?? null,
      },
      `release:${release.id}`,
    );
  }
  for (const card of cards) entries.put(card, card.id);
  tx.objectStore("referenceVersions").put(
    {
      metadata,
      releaseOrder: releases.map((r) => r.id),
      cardOrder: cards.map((c) => c.id),
    },
    "ledger",
  );
  if (metadata.manifest)
    tx.objectStore("referenceVersions").put(metadata.manifest, "manifest");
}
function writeOwnership(tx, state, revision) {
  const { reference, quantities, ...metadata } = state;
  const entries = tx.objectStore("collectionEntries");
  entries.clear();
  for (const [key, value] of Object.entries(quantities))
    entries.put(value, key);
  tx.objectStore("settings").put({ revision, state: metadata }, "current");
  tx.objectStore("settings").delete("migrationError");
}
export function openDatabase(
  factory = globalThis.indexedDB,
  name = DATABASE_NAME,
) {
  return new Promise((resolve, reject) => {
    if (!factory) return reject(Error("IndexedDB is unavailable"));
    let blocked = false;
    const request = factory.open(name, 2);
    request.onupgradeneeded = () => {
      const db = request.result,
        tx = request.transaction;
      for (const name of STORES)
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
      tx.objectStore("referenceCards").createIndex("releaseId", "releaseId");
      if (!db.objectStoreNames.contains("collection")) return;
      const own = tx.objectStore("collection").get("current"),
        ref = tx.objectStore("reference").get("current");
      let count = 0;
      const migrate = () => {
        if (++count !== 2 || !own.result) return;
        try {
          const state = migrateCollection({
            ...own.result.state,
            reference: ref.result,
          });
          writeReference(tx, state.reference);
          writeOwnership(tx, state, own.result.revision);
        } catch (error) {
          // Keep both original v1 stores for recovery; never replace bad data with zeroes.
          tx.objectStore("settings").put(
            {
              error: error.message,
              raw: JSON.stringify({
                reference: ref.result,
                collection: own.result,
              }),
            },
            "migrationError",
          );
        }
      };
      own.onsuccess = migrate;
      ref.onsuccess = migrate;
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      blocked = true;
      reject(Error("Close other Card Ledger tabs to open the database"));
    };
    request.onsuccess = () => {
      const db = request.result;
      if (blocked) {
        db.close();
        return;
      }
      db.onversionchange = () => db.close();
      resolve(db);
    };
  });
}
export function readCollection(db) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES, "readonly");
    const settings = tx.objectStore("settings").get("current"),
      error = tx.objectStore("settings").get("migrationError");
    const metadata = tx.objectStore("referenceVersions").get("ledger");
    const releases = tx.objectStore("referenceSets").getAll(),
      cards = tx.objectStore("referenceCards").getAll();
    const keys = tx.objectStore("collectionEntries").getAllKeys(),
      values = tx.objectStore("collectionEntries").getAll();
    tx.onabort = () => reject(tx.error || Error("Database read aborted"));
    tx.oncomplete = () => {
      try {
        if (error.result) {
          const e = Error(error.result.error);
          e.raw = error.result.raw;
          throw e;
        }
        if (!settings.result) return resolve(null);
        const { revision, state } = settings.result;
        if (!Number.isSafeInteger(revision) || revision < 1)
          throw Error("Invalid database revision");
        const releaseOrder = new Map(
          metadata.result.releaseOrder.map((id, i) => [id, i]),
        );
        const cardOrder = new Map(
          metadata.result.cardOrder.map((id, i) => [id, i]),
        );
        const reference = {
          ...metadata.result.metadata,
          releases: releases.result.sort(
            (a, b) => releaseOrder.get(a.id) - releaseOrder.get(b.id),
          ),
          cards: cards.result.sort(
            (a, b) => cardOrder.get(a.id) - cardOrder.get(b.id),
          ),
        };
        const quantities = Object.fromEntries(
          keys.result.map((key, i) => [key, values.result[i]]),
        );
        const valid = validateCollection({ ...state, reference, quantities });
        referenceCache.set(db, JSON.stringify(valid.reference));
        resolve({ state: valid, revision });
      } catch (error) {
        error.raw ??= JSON.stringify({
          settings: settings.result,
          metadata: metadata.result,
          releases: releases.result,
          cards: cards.result,
          keys: keys.result,
          values: values.result,
        });
        reject(error);
      }
    };
  });
}
export function saveCollection(
  db,
  state,
  expectedRevision,
  { recovery = false } = {},
) {
  validateCollection(state);
  const referenceText = JSON.stringify(state.reference);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES, "readwrite"),
      settings = tx.objectStore("settings");
    let failure, savedRevision;
    const request = settings.get("current");
    request.onsuccess = () => {
      try {
        const revision = request.result?.revision ?? 0;
        if (revision !== expectedRevision && !recovery) {
          failure = Error(
            "Collection changed in another tab. Reload before editing",
          );
          failure.code = "STALE_REVISION";
          tx.abort();
          return;
        }
        savedRevision = Number.isSafeInteger(revision) ? revision + 1 : 1;
        writeOwnership(tx, state, savedRevision);
        if (recovery || referenceCache.get(db) !== referenceText)
          writeReference(tx, state.reference);
      } catch (error) {
        failure = error;
        tx.abort();
      }
    };
    tx.onabort = () =>
      reject(failure || tx.error || Error("Database write aborted"));
    tx.oncomplete = () => {
      referenceCache.set(db, referenceText);
      resolve(savedRevision);
    };
  });
}
export async function loadCollection(db, legacyStorage, initial) {
  let raw;
  try {
    const stored = await readCollection(db);
    if (stored) return { ...stored, error: null, raw: null };
    raw = legacyStorage.getItem(STORAGE_KEY);
    const state = raw === null ? initial : importBackup(raw);
    const revision = await saveCollection(db, state, 0);
    return { state, revision, error: null, raw, migrated: raw !== null };
  } catch (error) {
    if (error.code === "STALE_REVISION") {
      const stored = await readCollection(db);
      if (stored) return { ...stored, error: null, raw: null };
    }
    return {
      state: initial,
      revision: 0,
      error: error.message,
      raw: error.raw ?? raw,
    };
  }
}
