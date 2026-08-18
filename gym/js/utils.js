// Small shared helpers: DOM building, icons, formatting, haptics.
// Deliberately tiny — there is no framework in this app.

/** RFC4122 id, with a fallback for older iOS WebViews. */
export function uid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Build a DOM element.
 *   h("button", { class: "btn", onclick: fn, "aria-label": "Close" }, "Text", child)
 * Attribute names are used as-is; `on*` keys become listeners; `text` sets
 * textContent; `dataset` merges into element.dataset.
 */
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value === null || value === undefined || value === false) continue;
      if (key === "class") el.className = value;
      else if (key === "text") el.textContent = value;
      else if (key === "dataset") Object.assign(el.dataset, value);
      else if (key === "style" && typeof value === "object") Object.assign(el.style, value);
      else if (key.startsWith("on") && typeof value === "function") el.addEventListener(key.slice(2), value);
      else if (value === true) el.setAttribute(key, "");
      else el.setAttribute(key, value);
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (Array.isArray(child)) append(el, child);
    else el.append(child.nodeType ? child : document.createTextNode(String(child)));
  }
}

/** Replace all children of `el` with `children`. */
export function fill(el, ...children) {
  el.textContent = "";
  append(el, children);
  return el;
}

/* ---------------------------------------------------------------------------
 * Icons. One 24x24 stroke set so nothing looks borrowed from three places.
 * `fill` icons opt out of the stroke defaults.
 * ------------------------------------------------------------------------- */
const PATHS = {
  menu: "M4 7h16M4 12h16M4 17h16",
  back: "M15 5l-7 7 7 7",
  forward: "M9 5l7 7-7 7",
  up: "M6 15l6-6 6 6",
  down: "M6 9l6 6 6-6",
  close: "M6 6l12 12M18 6L6 18",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  check: "M4 12.5l5 5L20 6.5",
  more: "M6 12h.01M12 12h.01M18 12h.01",
  edit: "M4 20h4l10-10-4-4L4 16v4zM14.5 5.5l4 4",
  trash: "M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13M10 11v6M14 11v6",
  copy: "M9 9h9a2 2 0 012 2v9a2 2 0 01-2 2H9a2 2 0 01-2-2v-9a2 2 0 012-2zM15 6a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2",
  timer: "M12 22a8 8 0 100-16 8 8 0 000 16zM12 10v4l2.5 2M9 2h6",
  history: "M3 12a9 9 0 109-9 9 9 0 00-7.6 4.2M3 4v4h4M12 7v5l4 2",
  settings: "M12 15.5a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-2.9 1.2v.2a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.6 1.7 1.7 0 00-1.9.4l-.1.1a2 2 0 11-2.8-2.8l.1-.1A1.7 1.7 0 004 15.5a1.7 1.7 0 00-1.6-1.1h-.2a2 2 0 110-4h.1A1.7 1.7 0 004 9.3a1.7 1.7 0 00-.4-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3h.1A1.7 1.7 0 009.5 3.4v-.2a2 2 0 114 0v.1a1.7 1.7 0 001 1.6 1.7 1.7 0 001.9-.4l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9v.1a1.7 1.7 0 001.6 1h.2a2 2 0 110 4h-.1a1.7 1.7 0 00-1.6 1z",
  home: "M4 10.5L12 4l8 6.5V20a1 1 0 01-1 1h-4v-6H9v6H5a1 1 0 01-1-1z",
  dumbbell: "M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10",
  play: "M8 5l11 7-11 7z",
  expand: "M4 9V4h5M20 15v5h-5M15 4h5v5M9 20H4v-5",
  info: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 11v5M12 7.5v.5",
  note: "M6 3h12a1 1 0 011 1v16a1 1 0 01-1 1H6a1 1 0 01-1-1V4a1 1 0 011-1zM9 8h6M9 12h6M9 16h3",
  download: "M12 3v12M7 11l5 5 5-5M4 20h16",
  upload: "M12 21V9M7 13l5-5 5 5M4 4h16",
  skip: "M6 5l9 7-9 7zM18 5v14",
  image: "M4 5h16v14H4zM8 11a1.6 1.6 0 100-3.2A1.6 1.6 0 008 11zM5 17l5-5 3.5 3.5L16 13l3 4",
  calendar: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4",
  chart: "M4 20V9M10 20V4M16 20v-7M22 20H2",
  add: "M12 8v8M8 12h8M12 21a9 9 0 100-18 9 9 0 000 18z",
  star: "M12 3.8 14.29 9.24 20.18 9.74 15.71 13.61 17.05 19.36 12 16.3 6.95 19.36 8.29 13.61 3.82 9.74 9.71 9.24Z",
};

// Filled glyphs, described as composed shapes so a recognisable silhouette
// can be built without hand-writing union paths.
const FILLED = {
  // Flexed arm for the effort rating: a rounded upper arm, the bicep bulge,
  // the wrist and the fist. Drawn as a vector so it matches the rest of the
  // interface instead of borrowing the platform emoji. Swap the shapes here
  // and every rating control updates.
  arm: [
    { tube: ["M4 21 v-4.5 C4 11.5 8.4 8.2 13 8.2", 3.6] },
    { circle: [8.2, 11.8, 4.1] },
    { rect: [13.6, 7, 4.6, 5, 2] },
    { rect: [11.8, 2.8, 8.6, 6.6, 2.8] },
  ],
  dot: [{ circle: [12, 12, 6] }],
  "star-filled": [
    { path: "M12 3.8 14.29 9.24 20.18 9.74 15.71 13.61 17.05 19.36 12 16.3 6.95 19.36 8.29 13.61 3.82 9.74 9.71 9.24Z" },
  ],
};

/** An inline SVG icon element. `size` is in px. */
export function icon(name, size = 24) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", size);
  svg.setAttribute("height", size);
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  if (FILLED[name]) {
    for (const shape of FILLED[name]) svg.append(filledShape(shape));
    return svg;
  }
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  {
    path.setAttribute("d", PATHS[name] || PATHS.info);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", "2");
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("stroke-linejoin", "round");
  }
  svg.append(path);
  return svg;
}

function filledShape(shape) {
  const ns = "http://www.w3.org/2000/svg";
  if (shape.path) {
    const node = document.createElementNS(ns, "path");
    node.setAttribute("d", shape.path);
    node.setAttribute("fill", "currentColor");
    return node;
  }
  if (shape.tube) {
    // A thick round-capped stroke, used for limb-like shapes.
    const [d, width] = shape.tube;
    const node = document.createElementNS(ns, "path");
    node.setAttribute("d", d);
    node.setAttribute("fill", "none");
    node.setAttribute("stroke", "currentColor");
    node.setAttribute("stroke-width", width);
    node.setAttribute("stroke-linecap", "round");
    node.setAttribute("stroke-linejoin", "round");
    return node;
  }
  if (shape.circle) {
    const [cx, cy, r] = shape.circle;
    const node = document.createElementNS(ns, "circle");
    node.setAttribute("cx", cx);
    node.setAttribute("cy", cy);
    node.setAttribute("r", r);
    node.setAttribute("fill", "currentColor");
    return node;
  }
  const [x, y, width, height, radius] = shape.rect;
  const node = document.createElementNS(ns, "rect");
  node.setAttribute("x", x);
  node.setAttribute("y", y);
  node.setAttribute("width", width);
  node.setAttribute("height", height);
  node.setAttribute("rx", radius);
  node.setAttribute("fill", "currentColor");
  return node;
}

/** Circle / part-filled circle / tick, matching the workout item states. */
export function statusIcon(status) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "24");
  svg.setAttribute("height", "24");
  svg.setAttribute("aria-hidden", "true");
  const ns = "http://www.w3.org/2000/svg";
  const ring = document.createElementNS(ns, "circle");
  ring.setAttribute("cx", "12");
  ring.setAttribute("cy", "12");
  ring.setAttribute("r", "9");
  ring.setAttribute("fill", "none");
  ring.setAttribute("stroke", "currentColor");
  ring.setAttribute("stroke-width", "2");
  svg.append(ring);
  if (status === "complete") {
    const tick = document.createElementNS(ns, "path");
    tick.setAttribute("d", "M7.5 12.5l3 3 6-6.5");
    tick.setAttribute("fill", "none");
    tick.setAttribute("stroke", "currentColor");
    tick.setAttribute("stroke-width", "2.4");
    tick.setAttribute("stroke-linecap", "round");
    tick.setAttribute("stroke-linejoin", "round");
    svg.append(tick);
  } else if (status === "in-progress") {
    const dot = document.createElementNS(ns, "circle");
    dot.setAttribute("cx", "12");
    dot.setAttribute("cy", "12");
    dot.setAttribute("r", "5");
    dot.setAttribute("fill", "currentColor");
    svg.append(dot);
  }
  return svg;
}

/* ---------------------------------------------------------------------------
 * Formatting
 * ------------------------------------------------------------------------- */

/** 90 -> "01:30". Always mm:ss, minutes are not padded past 99. */
export function formatClock(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

/** 2880 -> "48 min", 4500 -> "1 h 15 min". */
export function formatDuration(totalSeconds) {
  if (totalSeconds < 60) return "< 1 min";
  const mins = Math.round(Math.max(0, totalSeconds) / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Duration written for the warm-up / cool-down screens. */
export function formatMinutes(totalSeconds) {
  const mins = Math.round(totalSeconds / 60);
  if (totalSeconds < 60) return `${totalSeconds} seconds`;
  return `${mins} ${mins === 1 ? "minute" : "minutes"}`;
}

/** 22.5 -> "22.5", 25 -> "25". Never shows a trailing ".0". */
export function formatNumber(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return String(Math.round(n * 100) / 100);
}

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatDate(iso, { withYear = false } = {}) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const base = `${d.getDate()} ${MONTH[d.getMonth()]}`;
  return withYear ? `${base} ${d.getFullYear()}` : base;
}

export function formatLongDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${DAY[d.getDay()]} ${d.getDate()} ${MONTH[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** "Today", "Yesterday", "3 days ago", then the date. */
export function relativeDay(iso) {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "";
  const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(new Date()) - startOf(then)) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return formatDate(iso, { withYear: then.getFullYear() !== new Date().getFullYear() });
}

/* ---------------------------------------------------------------------------
 * Misc
 * ------------------------------------------------------------------------- */

export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

/** Avoids 0.1 + 0.2 style drift when stepping weights. */
export function roundStep(value, step) {
  const decimals = (String(step).split(".")[1] || "").length;
  return Number(value.toFixed(Math.max(decimals, 2))) * 1;
}

export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/** Short vibration for confirmations, when the setting allows it. */
export function haptic(pattern = 12) {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch {
    /* Vibration is unsupported on iOS Safari; ignore. */
  }
}

export function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * "Incline Dumbbell Press" -> "incline-dumbbell-press".
 * Used to match an exercise to a file in assets/exercises. Must stay in step
 * with the same function in tools/sync-assets.mjs.
 */
export function slugify(name) {
  return String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Escapes nothing — we never inject HTML — but keeps text tidy for display. */
export function titleCase(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
