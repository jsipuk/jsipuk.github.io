// Backup: export everything to a JSON file, and import one back safely.
// Import validates the whole file before a single existing record is touched.
import { readEverything, replaceEverything } from "./state.js";
import { SCHEMA_VERSION } from "./models.js";

const FILE_PREFIX = "gym-by-john-backup";

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function dataURLToBlob(dataURL) {
  const [meta, base64] = String(dataURL).split(",");
  const match = /^data:([^;]+)/.exec(meta || "");
  const type = match ? match[1] : "application/octet-stream";
  const binary = atob(base64 || "");
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type });
}

/** Everything in one JSON object, images inlined as data URLs. */
export async function buildBackup() {
  const data = await readEverything();
  const images = await Promise.all(
    data.images.map(async (record) => ({
      id: record.id,
      type: record.type || record.blob?.type || "image/jpeg",
      createdAt: record.createdAt || null,
      dataURL: await blobToDataURL(record.blob),
    }))
  );
  return {
    app: "gym-by-john",
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    workouts: data.workouts,
    sessions: data.sessions,
    activities: data.activities,
    settings: data.settings,
    images,
  };
}

export function backupFilename() {
  const now = new Date();
  const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return `${FILE_PREFIX}-${stamp}.json`;
}

/**
 * Hands the file to the user. iOS gets the share sheet where available
 * (a plain download often just opens the JSON in a viewer), everything else
 * gets a normal download.
 */
export async function exportBackup() {
  const backup = await buildBackup();
  const json = JSON.stringify(backup, null, 2);
  const filename = backupFilename();
  const file = new File([json], filename, { type: "application/json" });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: "Gym by John backup" });
      return { method: "share", filename };
    } catch (error) {
      if (error && error.name === "AbortError") return { method: "cancelled", filename };
      // Fall through to the download path.
    }
  }

  const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return { method: "download", filename };
}

/**
 * Checks a parsed backup thoroughly and reports what it contains.
 * Returns { ok, errors, counts, data } — `data` is only usable when ok.
 */
export function validateBackup(raw) {
  const errors = [];
  const isObject = (v) => v && typeof v === "object" && !Array.isArray(v);

  if (!isObject(raw)) return { ok: false, errors: ["The file is not a backup object."] };
  if (raw.app && raw.app !== "gym-by-john") errors.push("This backup was made by a different app.");
  if (typeof raw.schemaVersion !== "number") errors.push("Missing schema version.");
  else if (raw.schemaVersion > SCHEMA_VERSION) {
    errors.push(`The backup is version ${raw.schemaVersion}; this app understands up to ${SCHEMA_VERSION}.`);
  }

  const arrays = ["workouts", "sessions", "activities", "settings", "images"];
  for (const key of arrays) {
    if (raw[key] !== undefined && !Array.isArray(raw[key])) errors.push(`"${key}" should be a list.`);
  }
  if (errors.length) return { ok: false, errors };

  const workouts = raw.workouts || [];
  const sessions = raw.sessions || [];
  // Absent in version 1 backups, which must still import cleanly.
  const activities = raw.activities || [];
  const settings = raw.settings || [];
  const images = raw.images || [];

  workouts.forEach((workout, index) => {
    if (!isObject(workout) || typeof workout.id !== "string") errors.push(`Workout ${index + 1} has no id.`);
    else if (typeof workout.name !== "string") errors.push(`Workout ${index + 1} has no name.`);
    else if (!Array.isArray(workout.exercises)) errors.push(`Workout "${workout.name}" has no exercise list.`);
  });
  sessions.forEach((session, index) => {
    if (!isObject(session) || typeof session.id !== "string") errors.push(`Session ${index + 1} has no id.`);
    else if (!Array.isArray(session.items)) errors.push(`Session ${index + 1} has no items.`);
    else if (typeof session.startedAt !== "string") errors.push(`Session ${index + 1} has no start time.`);
  });
  activities.forEach((activity, index) => {
    if (!isObject(activity) || typeof activity.id !== "string") errors.push(`Activity ${index + 1} has no id.`);
    else if (typeof activity.activityType !== "string") errors.push(`Activity ${index + 1} has no type.`);
    else if (typeof activity.startedAt !== "string" || Number.isNaN(Date.parse(activity.startedAt))) {
      errors.push(`Activity ${index + 1} has no usable date.`);
    } else if (typeof activity.durationMinutes !== "number" || !Number.isFinite(activity.durationMinutes)) {
      errors.push(`Activity ${index + 1} has no duration.`);
    }
  });
  settings.forEach((row, index) => {
    if (!isObject(row) || typeof row.key !== "string") errors.push(`Setting ${index + 1} is malformed.`);
  });
  images.forEach((image, index) => {
    if (!isObject(image) || typeof image.id !== "string") errors.push(`Image ${index + 1} has no id.`);
    else if (typeof image.dataURL !== "string" || !image.dataURL.startsWith("data:")) {
      errors.push(`Image ${index + 1} has no usable data.`);
    }
  });

  if (errors.length) return { ok: false, errors: errors.slice(0, 8) };

  return {
    ok: true,
    errors: [],
    counts: {
      workouts: workouts.length,
      sessions: sessions.length,
      activities: activities.length,
      images: images.length,
      settings: settings.length,
    },
    exportedAt: raw.exportedAt || null,
    data: { workouts, sessions, activities, settings, images },
  };
}

export async function readBackupFile(file) {
  let raw;
  try {
    raw = JSON.parse(await file.text());
  } catch {
    return { ok: false, errors: ["That file is not valid JSON."] };
  }
  return validateBackup(raw);
}

/** Only ever called with the output of a successful validation. */
export async function applyBackup(validated) {
  const images = validated.data.images.map((image) => ({
    id: image.id,
    blob: dataURLToBlob(image.dataURL),
    type: image.type || "image/jpeg",
    createdAt: image.createdAt || new Date().toISOString(),
  }));
  await replaceEverything({
    workouts: validated.data.workouts,
    sessions: validated.data.sessions,
    activities: validated.data.activities,
    settings: validated.data.settings,
    images,
  });
}
