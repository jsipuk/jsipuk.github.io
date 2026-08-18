// Everything that happens to a workout while it is being performed.
// Screens call these; they never edit the session object directly.
import { state, persistSession, emit, setActiveSession, commitSession, getWorkout } from "./state.js";
import { makeSession, itemStatus, sessionDurationSeconds, sessionCounts } from "./models.js";
import * as timer from "./timer.js";
import { roundStep } from "./utils.js";

export function hasActiveSession() {
  return Boolean(state.session);
}

export function getSession() {
  return state.session;
}

export function getItem(itemId) {
  if (!state.session) return null;
  return state.session.items.find((item) => item.id === itemId) || null;
}

export function itemIndex(itemId) {
  if (!state.session) return -1;
  return state.session.items.findIndex((item) => item.id === itemId);
}

/** Exercise n of m, ignoring warm-up and cool-down (they are not numbered). */
export function exercisePosition(itemId) {
  if (!state.session) return null;
  const exercises = state.session.items.filter((item) => item.type === "exercise");
  const index = exercises.findIndex((item) => item.id === itemId);
  if (index === -1) return null;
  return { index: index + 1, total: exercises.length };
}

export function startWorkout(workoutId) {
  const workout = getWorkout(workoutId);
  if (!workout) return null;
  const session = makeSession(workout, { unit: state.settings.unit });
  setActiveSession(session);
  return session;
}

/** Remembers where the user is, so Resume comes back to the right screen. */
export function setCurrentItem(itemId) {
  if (!state.session || state.session.currentItemId === itemId) return;
  state.session.currentItemId = itemId;
  persistSession();
}

export function nextItemId(fromId) {
  const index = itemIndex(fromId);
  if (index === -1) return null;
  const next = state.session.items[index + 1];
  return next ? next.id : null;
}

export function prevItemId(fromId) {
  const index = itemIndex(fromId);
  if (index <= 0) return null;
  return state.session.items[index - 1].id;
}

/** The first item that still needs work, used by Resume and by "what's next". */
export function firstUnfinishedItemId() {
  if (!state.session) return null;
  const pending = state.session.items.find((item) => itemStatus(item) !== "complete");
  return pending ? pending.id : null;
}

export function allItemsComplete() {
  if (!state.session) return false;
  return state.session.items.every((item) => itemStatus(item) === "complete");
}

/* ---------------------------------------------------------------------------
 * Working values (weight and reps for the set in progress)
 * ------------------------------------------------------------------------- */

export function setDraft(itemId, patch) {
  const item = getItem(itemId);
  if (!item || item.type !== "exercise") return;
  Object.assign(item.draft, patch);
  item.touched = true;
  persistSession();
  emit();
}

export function stepWeight(itemId, direction) {
  const item = getItem(itemId);
  if (!item) return;
  const step = item.weightIncrement || 2.5;
  const next = Math.max(0, roundStep((item.draft.weight || 0) + direction * step, step));
  setDraft(itemId, { weight: next });
}

export function stepReps(itemId, direction) {
  const item = getItem(itemId);
  if (!item) return;
  const next = Math.max(0, Math.round((item.draft.reps || 0) + direction));
  setDraft(itemId, { reps: next });
}

/* ---------------------------------------------------------------------------
 * Sets
 * ------------------------------------------------------------------------- */

/**
 * Rule 3: completing a set immediately starts the rest timer.
 * The next set inherits this set's weight and reps so the user can simply
 * lift again, or adjust with one tap.
 */
export function completeSet(itemId) {
  const item = getItem(itemId);
  if (!item || item.type !== "exercise") return null;
  const record = {
    setNumber: item.sets.length + 1,
    weight: item.draft.weight ?? 0,
    reps: item.draft.reps ?? 0,
    unit: state.session.unit,
    completedAt: new Date().toISOString(),
  };
  item.sets.push(record);
  item.touched = true;
  // Prepare the next set with the same numbers (spec §17).
  item.draft = { weight: record.weight, reps: record.reps };
  persistSession();
  timer.start(item.restSeconds, item.id);
  emit();
  return record;
}

export function undoLastSet(itemId) {
  const item = getItem(itemId);
  if (!item || !item.sets.length) return;
  const removed = item.sets.pop();
  item.draft = { weight: removed.weight, reps: removed.reps };
  if (state.session.rest && state.session.rest.itemId === itemId) timer.skip();
  persistSession();
  emit();
}

export function updateSet(itemId, setNumber, patch) {
  const item = getItem(itemId);
  const record = item && item.sets.find((s) => s.setNumber === setNumber);
  if (!record) return;
  Object.assign(record, patch);
  persistSession();
  emit();
}

export function removeSet(itemId, setNumber) {
  const item = getItem(itemId);
  if (!item) return null;
  const removed = item.sets.find((s) => s.setNumber === setNumber);
  item.sets = item.sets.filter((s) => s.setNumber !== setNumber);
  item.sets.forEach((s, index) => { s.setNumber = index + 1; });
  persistSession();
  emit();
  return removed;
}

export function restoreSet(itemId, record, atIndex) {
  const item = getItem(itemId);
  if (!item) return;
  item.sets.splice(atIndex, 0, record);
  item.sets.forEach((s, index) => { s.setNumber = index + 1; });
  persistSession();
  emit();
}

/* ---------------------------------------------------------------------------
 * Session-only adjustments (the More menu)
 * ------------------------------------------------------------------------- */

export function addSetToday(itemId) {
  const item = getItem(itemId);
  if (!item || item.type !== "exercise") return;
  item.targetSets += 1;
  item.touched = true;
  persistSession();
  emit();
}

export function setTargetToday(itemId, { sets, reps, repRange }) {
  const item = getItem(itemId);
  if (!item || item.type !== "exercise") return;
  if (sets !== undefined) item.targetSets = Math.max(item.sets.length || 1, sets);
  if (reps !== undefined) item.targetReps = reps;
  if (repRange !== undefined) item.repRange = repRange;
  item.touched = true;
  persistSession();
  emit();
}

export function setSessionNote(itemId, note) {
  const item = getItem(itemId);
  if (!item) return;
  item.sessionNote = note;
  if (note) item.touched = true;
  persistSession();
  emit();
}

export function setWorkoutNote(note) {
  if (!state.session) return;
  state.session.workoutNote = note;
  persistSession();
}

export function setDifficulty(value) {
  if (!state.session) return;
  state.session.difficulty = value;
  persistSession();
  emit();
}

/* ---------------------------------------------------------------------------
 * Warm-up and cool-down
 * ------------------------------------------------------------------------- */

export function completeStage(itemId) {
  const item = getItem(itemId);
  if (!item || item.type === "exercise") return;
  item.completedAt = new Date().toISOString();
  item.touched = true;
  persistSession();
  emit();
}

export function undoStage(itemId) {
  const item = getItem(itemId);
  if (!item || item.type === "exercise") return;
  item.completedAt = null;
  persistSession();
  emit();
}

/* ---------------------------------------------------------------------------
 * Finishing
 * ------------------------------------------------------------------------- */

export function finishSession({ difficulty, note }) {
  const session = state.session;
  if (!session) return null;
  session.finishedAt = new Date().toISOString();
  session.status = "complete";
  session.difficulty = difficulty ?? session.difficulty ?? null;
  session.workoutNote = note ?? session.workoutNote ?? "";
  session.durationSeconds = Math.round(sessionDurationSeconds(session));
  session.summary = sessionCounts(session);
  session.rest = null;
  timer.skip();
  const saved = structuredClone(session);
  commitSession(saved);
  return saved;
}

/** Throws the in-progress workout away without recording it. */
export function discardSession() {
  timer.skip();
  return setActiveSession(null);
}

/* ---------------------------------------------------------------------------
 * History lookups (used by "Last time" and the exercise history screen)
 * ------------------------------------------------------------------------- */

/** Most recent finished session that recorded at least one set of this exercise. */
export function lastPerformance(exerciseId, { excludeSessionId } = {}) {
  for (const session of state.sessions) {
    if (excludeSessionId && session.id === excludeSessionId) continue;
    const item = session.items.find((i) => i.id === exerciseId && i.type === "exercise");
    if (item && item.sets.length) {
      return { session, item };
    }
  }
  return null;
}

/** Every recorded performance of an exercise, newest first. */
export function exerciseHistory(exerciseId) {
  const rows = [];
  for (const session of state.sessions) {
    const item = session.items.find((i) => i.id === exerciseId && i.type === "exercise");
    if (item && item.sets.length) {
      rows.push({
        sessionId: session.id,
        date: session.startedAt,
        workoutName: session.workoutName,
        sets: item.sets,
        note: item.sessionNote || "",
        unit: session.unit || "kg",
      });
    }
  }
  return rows;
}
