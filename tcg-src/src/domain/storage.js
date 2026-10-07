import { importBackup, validateCollection } from "./collection.js";
export const STORAGE_KEY = "cardledger-alpha-v1"; // Read-only migration source.
export const DATABASE_NAME = "card-ledger";
const referenceCache = new WeakMap();
export function openDatabase(
  factory = globalThis.indexedDB,
  name = DATABASE_NAME,
) {
  return new Promise((resolve, reject) => {
    if (!factory) return reject(Error("IndexedDB is unavailable"));
    let blocked = false;
    const request = factory.open(name, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("reference");
      request.result.createObjectStore("collection");
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
    const tx = db.transaction(["reference", "collection"], "readonly");
    const reference = tx.objectStore("reference").get("current");
    const collection = tx.objectStore("collection").get("current");
    tx.onabort = () => reject(tx.error || Error("Database read aborted"));
    tx.oncomplete = () => {
      if (!collection.result && !reference.result) return resolve(null);
      try {
        const { revision, state } = collection.result || {};
        if (!Number.isSafeInteger(revision) || revision < 1)
          throw Error("Invalid database revision");
        const valid = validateCollection({
          ...state,
          reference: reference.result,
        });
        referenceCache.set(db, JSON.stringify(valid.reference));
        resolve({ state: valid, revision });
      } catch (error) {
        error.raw = JSON.stringify({
          reference: reference.result,
          collection: collection.result,
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
  const { reference, ...ownership } = state;
  const referenceText = JSON.stringify(reference);
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["reference", "collection"], "readwrite");
    let failure, savedRevision;
    const store = tx.objectStore("collection");
    const request = store.get("current");
    request.onsuccess = () => {
      try {
        const actualRevision = request.result?.revision ?? 0;
        if (actualRevision !== expectedRevision && !recovery) {
          failure = Error(
            "Collection changed in another tab. Reload before editing",
          );
          failure.code = "STALE_REVISION";
          tx.abort();
          return;
        }
        const revision = Number.isSafeInteger(actualRevision)
          ? actualRevision + 1
          : 1;
        store.put({ revision, state: ownership }, "current");
        savedRevision = revision;
        if (recovery || referenceCache.get(db) !== referenceText)
          tx.objectStore("reference").put(reference, "current");
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
    // Keep the previous alpha's original data untouched as a migration safety copy.
    return { state, revision, error: null, raw, migrated: raw !== null };
  } catch (error) {
    if (error.code === "STALE_REVISION") {
      // Another tab may have finished first-time migration while this tab loaded.
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
