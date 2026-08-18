// Hash routing. Hashes keep the app working from any static path (including
// GitHub Pages) with no server rewrites, and the back gesture behaves.

const routes = [
  { pattern: /^\/?$/, name: "today", keys: [] },
  { pattern: /^\/today$/, name: "today", keys: [] },
  { pattern: /^\/workouts$/, name: "workouts", keys: [] },
  { pattern: /^\/workout\/([^/]+)$/, name: "workout-editor", keys: ["workoutId"] },
  { pattern: /^\/workout\/([^/]+)\/item\/([^/]+)$/, name: "exercise-editor", keys: ["workoutId", "itemId"] },
  { pattern: /^\/history$/, name: "history", keys: [] },
  { pattern: /^\/history\/([^/]+)$/, name: "history-detail", keys: ["sessionId"] },
  { pattern: /^\/exercise\/([^/]+)\/history$/, name: "exercise-history", keys: ["exerciseId"] },
  { pattern: /^\/settings$/, name: "settings", keys: [] },
  { pattern: /^\/backup$/, name: "backup", keys: [] },
  { pattern: /^\/session$/, name: "session-overview", keys: [] },
  { pattern: /^\/session\/item\/([^/]+)$/, name: "session-item", keys: ["itemId"] },
  { pattern: /^\/session\/finish$/, name: "session-finish", keys: [] },
];

let onChange = () => {};

export function currentPath() {
  const hash = location.hash.replace(/^#/, "");
  return hash || "/today";
}

export function match(path = currentPath()) {
  for (const route of routes) {
    const found = route.pattern.exec(path);
    if (!found) continue;
    const params = {};
    route.keys.forEach((key, index) => {
      params[key] = decodeURIComponent(found[index + 1]);
    });
    return { name: route.name, params, path };
  }
  return { name: "not-found", params: {}, path };
}

export function go(path, { replace = false } = {}) {
  const target = `#${path}`;
  if (location.hash === target) {
    onChange(match(path));
    return;
  }
  if (replace) location.replace(target);
  else location.hash = target;
}

export function back(fallback = "/today") {
  // history.length is 1 when the app was opened straight onto this URL.
  if (history.length > 1) history.back();
  else go(fallback, { replace: true });
}

export function start(handler) {
  onChange = handler;
  window.addEventListener("hashchange", () => onChange(match()));
  if (!location.hash) location.replace("#/today");
  onChange(match());
}

/** Convenience builders so screens do not hand-write route strings. */
export const paths = {
  today: () => "/today",
  workouts: () => "/workouts",
  workoutEditor: (id) => `/workout/${id}`,
  exerciseEditor: (workoutId, itemId) => `/workout/${workoutId}/item/${itemId}`,
  history: () => "/history",
  historyDetail: (id) => `/history/${id}`,
  exerciseHistory: (id) => `/exercise/${id}/history`,
  settings: () => "/settings",
  backup: () => "/backup",
  sessionOverview: () => "/session",
  sessionItem: (id) => `/session/item/${id}`,
  sessionFinish: () => "/session/finish",
};
