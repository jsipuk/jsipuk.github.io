// The single place the rest of the app reads from and writes to.
// Screens subscribe, mutate through these helpers, and never touch db.js.
import * as db from "./db.js";
import { DEFAULT_SETTINGS, SCHEMA_VERSION } from "./models.js";
import { uid } from "./utils.js";

export const state = {
  ready: false,
  settings: { ...DEFAULT_SETTINGS },
  workouts: [],
  sessions: [],      // finished sessions, newest first
  session: null,     // the active session, or null
  storagePersistent: true,
};

const listeners = new Set();

/** Subscribe to any state change. Returns an unsubscribe function. */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emit() {
  for (const fn of listeners) fn(state);
}

/* ---------------------------------------------------------------------------
 * Write queue. Every write is chained so two rapid taps cannot interleave
 * transactions, and so a caller can await "everything so far is on disk".
 * ------------------------------------------------------------------------- */
let queue = Promise.resolve();
function enqueue(work) {
  queue = queue.then(work).catch((error) => console.error("Write failed", error));
  return queue;
}
export function flushWrites() {
  return queue;
}

/* ---------------------------------------------------------------------------
 * Loading
 * ------------------------------------------------------------------------- */
export async function init() {
  await db.ready();
  const [settingRows, workouts, sessions, active] = await Promise.all([
    db.getAll("settings"),
    db.getAll("workouts"),
    db.getAll("sessions"),
    db.get("activeSession", "current"),
  ]);

  const stored = Object.fromEntries(settingRows.map((row) => [row.key, row.value]));
  state.settings = { ...DEFAULT_SETTINGS, ...stored };
  state.workouts = workouts.filter((w) => !w.archived).sort((a, b) => a.sortOrder - b.sortOrder);
  state.sessions = sessions.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
  state.session = active && active.data ? active.data : null;
  state.storagePersistent = db.db.persistent;
  state.ready = true;
  emit();
}

/* ---------------------------------------------------------------------------
 * Settings
 * ------------------------------------------------------------------------- */
export function updateSettings(patch) {
  Object.assign(state.settings, patch);
  emit();
  return enqueue(async () => {
    for (const [key, value] of Object.entries(patch)) {
      await db.put("settings", { key, value });
    }
  });
}

/* ---------------------------------------------------------------------------
 * Workouts
 * ------------------------------------------------------------------------- */
export function saveWorkout(workout) {
  workout.updatedAt = new Date().toISOString();
  const index = state.workouts.findIndex((w) => w.id === workout.id);
  if (index === -1) state.workouts.push(workout);
  else state.workouts[index] = workout;
  state.workouts.sort((a, b) => a.sortOrder - b.sortOrder);
  emit();
  return enqueue(() => db.put("workouts", workout));
}

export function getWorkout(id) {
  return state.workouts.find((w) => w.id === id) || null;
}

/** Archives rather than destroys, so an Undo can bring it straight back. */
export function archiveWorkout(id) {
  const workout = getWorkout(id);
  if (!workout) return Promise.resolve();
  workout.archived = true;
  state.workouts = state.workouts.filter((w) => w.id !== id);
  if (state.settings.selectedWorkoutId === id) {
    updateSettings({ selectedWorkoutId: state.workouts[0]?.id ?? null });
  }
  emit();
  return enqueue(() => db.put("workouts", workout));
}

export function restoreWorkout(workout) {
  workout.archived = false;
  state.workouts.push(workout);
  state.workouts.sort((a, b) => a.sortOrder - b.sortOrder);
  emit();
  return enqueue(() => db.put("workouts", workout));
}

export function reorderWorkouts(ids) {
  ids.forEach((id, index) => {
    const workout = getWorkout(id);
    if (workout) workout.sortOrder = index;
  });
  state.workouts.sort((a, b) => a.sortOrder - b.sortOrder);
  emit();
  return enqueue(() => db.putMany("workouts", state.workouts));
}

/* ---------------------------------------------------------------------------
 * Sessions
 * ------------------------------------------------------------------------- */

/** Autosave: called after every meaningful interaction during a workout. */
export function persistSession() {
  const snapshot = state.session ? structuredClone(state.session) : null;
  return enqueue(async () => {
    if (snapshot) await db.put("activeSession", { id: "current", data: snapshot });
    else await db.del("activeSession", "current");
  });
}

export function setActiveSession(session) {
  state.session = session;
  emit();
  return persistSession();
}

export function clearActiveSession() {
  state.session = null;
  emit();
  return enqueue(() => db.del("activeSession", "current"));
}

/** Moves a finished session into history. */
export function commitSession(session) {
  state.sessions.unshift(session);
  state.session = null;
  emit();
  return enqueue(async () => {
    await db.put("sessions", session);
    await db.del("activeSession", "current");
  });
}

export function removeSession(id) {
  const removed = state.sessions.find((s) => s.id === id);
  state.sessions = state.sessions.filter((s) => s.id !== id);
  emit();
  enqueue(() => db.del("sessions", id));
  return removed;
}

export function restoreSession(session) {
  state.sessions.push(session);
  state.sessions.sort((a, b) => new Date(b.startedAt) - new Date(a.startedAt));
  emit();
  return enqueue(() => db.put("sessions", session));
}

/* ---------------------------------------------------------------------------
 * Images
 *
 * Exercise images are stored as blobs in IndexedDB and referenced by the
 * string "idb:<id>". A plain path (e.g. "assets/exercises/placeholder.svg")
 * is also a valid reference, so bundled artwork can be dropped in later
 * without touching any workout logic.
 * ------------------------------------------------------------------------- */
const urlCache = new Map();
const MAX_IMAGE_EDGE = 1600;

export async function saveImageFile(file) {
  const blob = await downscale(file);
  const id = uid();
  await db.put("images", { id, blob, type: blob.type, createdAt: new Date().toISOString() });
  return `idb:${id}`;
}

/** Stores an already-decoded blob (used by backup import). */
export async function putImageRecord(record) {
  await db.put("images", record);
}

export async function imageURL(ref) {
  if (!ref) return null;
  if (!ref.startsWith("idb:")) return ref;
  if (urlCache.has(ref)) return urlCache.get(ref);
  const record = await db.get("images", ref.slice(4));
  if (!record) return null;
  const url = URL.createObjectURL(record.blob);
  urlCache.set(ref, url);
  return url;
}

export async function deleteImage(ref) {
  if (!ref || !ref.startsWith("idb:")) return;
  const url = urlCache.get(ref);
  if (url) {
    URL.revokeObjectURL(url);
    urlCache.delete(ref);
  }
  await db.del("images", ref.slice(4));
}

/** Phone photos are far larger than we need; shrink before storing. */
async function downscale(file) {
  if (file.type === "image/svg+xml" || !("createImageBitmap" in window)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 400_000) {
      bitmap.close?.();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const type = file.type === "image/png" ? "image/png" : "image/jpeg";
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, type, 0.85));
    return blob || file;
  } catch (error) {
    console.warn("Could not resize image, storing the original", error);
    return file;
  }
}

/* ---------------------------------------------------------------------------
 * Whole-app operations (backup and reset live in storage.js and use these)
 * ------------------------------------------------------------------------- */
export async function readEverything() {
  const [workouts, sessions, settings, images] = await Promise.all([
    db.getAll("workouts"),
    db.getAll("sessions"),
    db.getAll("settings"),
    db.getAll("images"),
  ]);
  return { schemaVersion: SCHEMA_VERSION, workouts, sessions, settings, images };
}

export async function replaceEverything({ workouts, sessions, settings, images }) {
  await db.replaceAll({ workouts, sessions, settings, images });
  await db.del("activeSession", "current");
  for (const url of urlCache.values()) URL.revokeObjectURL(url);
  urlCache.clear();
  await init();
}

export async function resetEverything() {
  await db.clear();
  for (const url of urlCache.values()) URL.revokeObjectURL(url);
  urlCache.clear();
  state.settings = { ...DEFAULT_SETTINGS };
  state.workouts = [];
  state.sessions = [];
  state.session = null;
  emit();
}
