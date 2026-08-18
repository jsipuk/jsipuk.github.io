// Shapes of the things the app stores, plus the small rules that go with them.
import { uid } from "./utils.js";

export const SCHEMA_VERSION = 2;

export const DEFAULT_SETTINGS = {
  appearance: "system", // system | light | dark
  unit: "kg",           // kg | lb — a label, not a conversion (see README)
  restSound: true,
  vibration: true,
  keepAwake: true,
  selectedWorkoutId: null,
};

export const EXERCISE_DEFAULTS = {
  sets: 1,
  targetReps: 10,
  repRange: null,        // { min, max } or null
  defaultWeight: 20,
  weightIncrement: 2.5,
  restSeconds: 90,
  instructions: "",
  notes: "",
};

export const WEIGHT_INCREMENTS = [1, 2, 2.5, 5];
export const REST_PRESETS = [30, 45, 60, 90, 120, 180];

export function makeExercise(partial = {}) {
  return {
    id: uid(),
    name: "",
    image: null,
    ...EXERCISE_DEFAULTS,
    sortOrder: 0,
    ...partial,
  };
}

export function makeStage(type) {
  return {
    name: type === "warmup" ? "Warm Up" : "Cool Down",
    durationSeconds: 300,
    instructions: "",
    notes: "",
    image: null,
  };
}

export function makeWorkout(name = "New Workout") {
  const now = new Date().toISOString();
  return {
    id: uid(),
    name,
    description: "",
    warmup: makeStage("warmup"),
    exercises: [],
    cooldown: makeStage("cooldown"),
    archived: false,
    sortOrder: Date.now(),
    createdAt: now,
    updatedAt: now,
  };
}

/** A deep copy with fresh ids, used by Duplicate. */
export function duplicateWorkout(workout, name) {
  const copy = structuredClone(workout);
  copy.id = uid();
  copy.name = name || `${workout.name} copy`;
  copy.exercises = copy.exercises.map((exercise) => ({ ...exercise, id: uid() }));
  copy.createdAt = new Date().toISOString();
  copy.updatedAt = copy.createdAt;
  copy.sortOrder = Date.now();
  return copy;
}

/* ---------------------------------------------------------------------------
 * Sessions
 * ------------------------------------------------------------------------- */

/**
 * Turn a workout plan into an ordered list of session items. Warm-up and
 * cool-down sit in the same array as the exercises so that "next" and
 * "previous" are just index maths, and the quick menu is one list.
 */
export function buildSessionItems(workout) {
  const items = [];
  if (workout.warmup) {
    items.push({
      id: `${workout.id}-warmup`,
      type: "warmup",
      name: workout.warmup.name || "Warm Up",
      image: workout.warmup.image || null,
      durationSeconds: workout.warmup.durationSeconds ?? 300,
      instructions: workout.warmup.instructions || "",
      exerciseNotes: workout.warmup.notes || "",
      sessionNote: "",
      completedAt: null,
      skipped: false,
    });
  }
  const ordered = [...workout.exercises].sort((a, b) => a.sortOrder - b.sortOrder);
  for (const exercise of ordered) {
    items.push({
      id: exercise.id,
      type: "exercise",
      name: exercise.name || "Exercise",
      image: exercise.image || null,
      // Targets are copied into the session so "change target today" cannot
      // leak back into the saved plan.
      targetSets: Math.max(1, exercise.sets || 1),
      targetReps: exercise.targetReps ?? 10,
      repRange: exercise.repRange || null,
      weightIncrement: exercise.weightIncrement || 2.5,
      restSeconds: exercise.restSeconds ?? 90,
      instructions: exercise.instructions || "",
      exerciseNotes: exercise.notes || "",
      sets: [],
      draft: { weight: exercise.defaultWeight ?? 0, reps: exercise.targetReps ?? 10 },
      sessionNote: "",
      touched: false,
      skipped: false,
    });
  }
  if (workout.cooldown) {
    items.push({
      id: `${workout.id}-cooldown`,
      type: "cooldown",
      name: workout.cooldown.name || "Cool Down",
      image: workout.cooldown.image || null,
      durationSeconds: workout.cooldown.durationSeconds ?? 300,
      instructions: workout.cooldown.instructions || "",
      exerciseNotes: workout.cooldown.notes || "",
      sessionNote: "",
      completedAt: null,
      skipped: false,
    });
  }
  return items;
}

export function makeSession(workout, { unit = "kg" } = {}) {
  const items = buildSessionItems(workout);
  return {
    id: uid(),
    workoutId: workout.id,
    workoutName: workout.name,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    status: "active",
    unit,
    currentItemId: items[0] ? items[0].id : null,
    items,
    rest: null, // { itemId, endsAt, durationSeconds }
    difficulty: null,
    workoutNote: "",
  };
}

/**
 * Rule 1: an exercise is only complete when every required set is recorded.
 * Anything touched but unfinished is "in-progress" and never shows a tick.
 */
export function itemStatus(item) {
  if (item.type === "exercise") {
    const done = item.sets.length;
    if (done >= item.targetSets && done > 0) return "complete";
    if (done > 0 || item.touched) return "in-progress";
    return "not-started";
  }
  return item.completedAt ? "complete" : item.touched ? "in-progress" : "not-started";
}

export const STATUS_LABEL = {
  "not-started": "Not started",
  "in-progress": "In progress",
  complete: "Complete",
};

/** 1-based number of the set the user is working on right now. */
export function currentSetNumber(item) {
  return Math.min(item.sets.length + 1, Math.max(item.targetSets, item.sets.length + 1));
}

export function sessionCounts(session) {
  const exercises = session.items.filter((i) => i.type === "exercise");
  return {
    exerciseTotal: exercises.length,
    exerciseDone: exercises.filter((i) => itemStatus(i) === "complete").length,
    setsDone: exercises.reduce((sum, i) => sum + i.sets.length, 0),
    itemsDone: session.items.filter((i) => itemStatus(i) === "complete").length,
    itemTotal: session.items.length,
  };
}

export function sessionDurationSeconds(session) {
  const end = session.finishedAt ? new Date(session.finishedAt) : new Date();
  return Math.max(0, (end - new Date(session.startedAt)) / 1000);
}

export const DIFFICULTY_WORDS = {
  1: "Very easy",
  2: "Easy",
  3: "Moderate",
  4: "Hard",
  5: "Very hard",
};

/* ---------------------------------------------------------------------------
 * Other activities
 *
 * A swim or a fitness class is not a guided workout, so it gets its own small
 * record rather than being bent into the session model. All it records is that
 * the activity happened: type, when, how long, how hard, and an optional note.
 * ------------------------------------------------------------------------- */

export const ACTIVITY_TYPES = [
  { value: "swim", label: "Swim" },
  { value: "fitness-class", label: "Fitness Class" },
  { value: "circuits", label: "Circuits" },
  { value: "cardio", label: "Cardio" },
  { value: "sport", label: "Sport" },
  { value: "other", label: "Other" },
];

export function activityLabel(type) {
  const match = ACTIVITY_TYPES.find((option) => option.value === type);
  return match ? match.label : "Activity";
}

export function makeActivity({
  activityType = "other",
  startedAt = new Date().toISOString(),
  durationMinutes = 30,
  difficulty = null,
  note = "",
} = {}) {
  const now = new Date().toISOString();
  return {
    id: uid(),
    recordType: "activity",
    activityType,
    startedAt,
    durationMinutes,
    difficulty,
    note,
    createdAt: now,
    updatedAt: now,
  };
}

/** Human summary of a target, e.g. "3 sets x 8-12 reps". */
export function targetText(item) {
  const sets = `${item.targetSets} ${item.targetSets === 1 ? "set" : "sets"}`;
  const reps = item.repRange
    ? `${item.repRange.min}-${item.repRange.max} reps`
    : `${item.targetReps} reps`;
  return `${sets} × ${reps}`;
}
