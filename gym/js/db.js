// IndexedDB access. Everything the app owns lives here; nothing leaves the device.
//
// Stores:
//   workouts      { id, name, ... }            workout plans, exercises embedded
//   sessions      { id, workoutId, ... }       finished workouts (history)
//   activeSession { id: "current", ... }       the one in-progress workout
//   settings      { key, value }               one row per setting
//   images        { id, blob, type }           user-supplied exercise images
//
// If IndexedDB is unavailable (private browsing on some iOS builds), we fall
// back to an in-memory store so the app still runs. `db.persistent` is false in
// that case and app.js warns the user that nothing will be saved.

const DB_NAME = "gym-by-john";
const DB_VERSION = 1;
export const STORES = ["workouts", "sessions", "activeSession", "settings", "images"];

let dbPromise = null;
let memory = null; // Map<storeName, Map<key, value>> when IndexedDB is unusable.

export const db = { persistent: true };

const KEY_PATHS = {
  workouts: "id",
  sessions: "id",
  activeSession: "id",
  settings: "key",
  images: "id",
};

function useMemory(reason) {
  if (!memory) {
    console.warn("Falling back to in-memory storage:", reason);
    memory = new Map(STORES.map((name) => [name, new Map()]));
    db.persistent = false;
  }
  return memory;
}

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    let request;
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (error) {
      useMemory(error);
      resolve(null);
      return;
    }
    request.onupgradeneeded = () => {
      const idb = request.result;
      for (const name of STORES) {
        if (!idb.objectStoreNames.contains(name)) {
          const store = idb.createObjectStore(name, { keyPath: KEY_PATHS[name] });
          if (name === "sessions") store.createIndex("startedAt", "startedAt");
        }
      }
    };
    request.onsuccess = () => {
      const idb = request.result;
      // A second tab upgrading the schema would otherwise wedge this one.
      idb.onversionchange = () => idb.close();
      resolve(idb);
    };
    request.onerror = () => {
      useMemory(request.error);
      resolve(null);
    };
    request.onblocked = () => {
      useMemory("another tab is holding an older version open");
      resolve(null);
    };
  });
  return dbPromise;
}

function tx(idb, storeNames, mode) {
  const transaction = idb.transaction(storeNames, mode);
  return {
    transaction,
    done: new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    }),
  };
}

function request(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function get(storeName, key) {
  const idb = await open();
  if (!idb) return useMemory("get").get(storeName).get(key) ?? undefined;
  const { transaction } = tx(idb, storeName, "readonly");
  return request(transaction.objectStore(storeName).get(key));
}

export async function getAll(storeName) {
  const idb = await open();
  if (!idb) return [...useMemory("getAll").get(storeName).values()];
  const { transaction } = tx(idb, storeName, "readonly");
  return request(transaction.objectStore(storeName).getAll());
}

export async function put(storeName, value) {
  const idb = await open();
  if (!idb) {
    useMemory("put").get(storeName).set(value[KEY_PATHS[storeName]], value);
    return value;
  }
  const { transaction, done } = tx(idb, storeName, "readwrite");
  transaction.objectStore(storeName).put(value);
  await done;
  return value;
}

export async function putMany(storeName, values) {
  if (!values.length) return;
  const idb = await open();
  if (!idb) {
    const store = useMemory("putMany").get(storeName);
    for (const value of values) store.set(value[KEY_PATHS[storeName]], value);
    return;
  }
  const { transaction, done } = tx(idb, storeName, "readwrite");
  const store = transaction.objectStore(storeName);
  for (const value of values) store.put(value);
  await done;
}

export async function del(storeName, key) {
  const idb = await open();
  if (!idb) {
    useMemory("del").get(storeName).delete(key);
    return;
  }
  const { transaction, done } = tx(idb, storeName, "readwrite");
  transaction.objectStore(storeName).delete(key);
  await done;
}

export async function clear(storeNames = STORES) {
  const names = Array.isArray(storeNames) ? storeNames : [storeNames];
  const idb = await open();
  if (!idb) {
    for (const name of names) useMemory("clear").get(name).clear();
    return;
  }
  const { transaction, done } = tx(idb, names, "readwrite");
  for (const name of names) transaction.objectStore(name).clear();
  await done;
}

/** Replaces the contents of several stores in one transaction (used by import). */
export async function replaceAll(data) {
  const names = Object.keys(data);
  const idb = await open();
  if (!idb) {
    for (const name of names) {
      const store = useMemory("replaceAll").get(name);
      store.clear();
      for (const value of data[name]) store.set(value[KEY_PATHS[name]], value);
    }
    return;
  }
  const { transaction, done } = tx(idb, names, "readwrite");
  for (const name of names) {
    const store = transaction.objectStore(name);
    store.clear();
    for (const value of data[name]) store.put(value);
  }
  await done;
}

/** Warms the connection so the first screen does not wait on schema creation. */
export function ready() {
  return open();
}
