// Boot and shell: theme, routing, tab bar, wake lock, service worker.
import { h, fill, icon } from "./utils.js";
import { state, init, subscribe, flushWrites } from "./state.js";
import * as router from "./router.js";
import * as timer from "./timer.js";
import { closeAllSheets, toast } from "../components/controls.js";
import { mountGlobalRestBar } from "../components/rest-timer.js";
import { APP_VERSION } from "./app-info.js";

import * as todayScreen from "./screens/today.js";
import * as workoutsScreen from "./screens/workouts.js";
import * as workoutEditorScreen from "./screens/workout-editor.js";
import * as exerciseEditorScreen from "./screens/exercise-editor.js";
import * as historyScreen from "./screens/history.js";
import * as historyDetailScreen from "./screens/history-detail.js";
import * as exerciseHistoryScreen from "./screens/exercise-history.js";
import * as settingsScreen from "./screens/settings.js";
import * as backupScreen from "./screens/backup.js";
import * as sessionOverviewScreen from "./screens/session-overview.js";
import * as sessionItemScreen from "./screens/session-item.js";
import * as sessionFinishScreen from "./screens/session-finish.js";

const screens = {
  today: todayScreen,
  workouts: workoutsScreen,
  "workout-editor": workoutEditorScreen,
  "exercise-editor": exerciseEditorScreen,
  history: historyScreen,
  "history-detail": historyDetailScreen,
  "exercise-history": exerciseHistoryScreen,
  settings: settingsScreen,
  backup: backupScreen,
  "session-overview": sessionOverviewScreen,
  "session-item": sessionItemScreen,
  "session-finish": sessionFinishScreen,
};

// Routes that belong to a running workout: workout navigation takes over.
const SESSION_ROUTES = new Set(["session-overview", "session-item", "session-finish"]);

const TABS = [
  { name: "today", label: "Today", icon: "home", path: () => router.paths.today() },
  { name: "workouts", label: "Workouts", icon: "dumbbell", path: () => router.paths.workouts() },
  { name: "history", label: "History", icon: "history", path: () => router.paths.history() },
  { name: "settings", label: "Settings", icon: "settings", path: () => router.paths.settings() },
];

const TAB_FOR_ROUTE = {
  today: "today",
  workouts: "workouts",
  "workout-editor": "workouts",
  "exercise-editor": "workouts",
  history: "history",
  "history-detail": "history",
  "exercise-history": "history",
  settings: "settings",
  backup: "settings",
};

const screenRoot = document.getElementById("screen");
const tabbar = document.getElementById("tabbar");
let mounted = null;
let currentRoute = null;

/* ---------------------------------------------------------------------------
 * Theme
 * ------------------------------------------------------------------------- */
function applyTheme() {
  const choice = state.settings.appearance || "system";
  document.documentElement.dataset.theme = choice;
  // Keep the iOS status bar and Android chrome in step with the real palette.
  const dark =
    choice === "dark" ||
    (choice === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.getElementById("theme-color").setAttribute("content", dark ? "#0d0d0f" : "#ffffff");
}

window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyTheme);

/* ---------------------------------------------------------------------------
 * Tab bar
 * ------------------------------------------------------------------------- */
function renderTabs(route) {
  const active = TAB_FOR_ROUTE[route.name];
  const inSession = SESSION_ROUTES.has(route.name);
  tabbar.hidden = inSession;
  document.body.classList.toggle("has-tabbar", !inSession);
  if (inSession) return;

  fill(
    tabbar,
    TABS.map((tab) =>
      h(
        "a",
        {
          class: "tab",
          href: `#${tab.path()}`,
          "aria-current": tab.name === active ? "page" : null,
        },
        icon(tab.icon),
        h("span", { text: tab.label })
      )
    )
  );
}

/* ---------------------------------------------------------------------------
 * Screen mounting
 * ------------------------------------------------------------------------- */
function mount(route) {
  if (route.name === "not-found") {
    router.go(router.paths.today(), { replace: true });
    return;
  }
  currentRoute = route;
  closeAllSheets();
  mounted?.destroy?.();
  const view = screens[route.name].render(route.params);
  mounted = view;
  fill(screenRoot, view.el);
  screenRoot.scrollTop = 0;
  renderTabs(route);
  syncBottomInset();
}

/**
 * Floating layers (rest bar, toasts) must clear the current screen's sticky
 * footer and the tab bar. Measure rather than guess: footer height changes
 * when the rest panel appears.
 */
function syncBottomInset() {
  requestAnimationFrame(() => {
    const footer = screenRoot.querySelector(".ex-actions");
    const extra = (footer ? footer.offsetHeight : 0) + (tabbar.hidden ? 0 : tabbar.offsetHeight);
    document.body.style.setProperty("--bottom-inset", extra ? `${extra}px` : "var(--safe-bottom)");
  });
}

/* ---------------------------------------------------------------------------
 * Keep the screen on during a workout, where the browser allows it.
 * ------------------------------------------------------------------------- */
let wakeLock = null;
async function syncWakeLock() {
  const wanted = Boolean(state.session) && state.settings.keepAwake && document.visibilityState === "visible";
  try {
    if (wanted && !wakeLock && "wakeLock" in navigator) {
      wakeLock = await navigator.wakeLock.request("screen");
      wakeLock.addEventListener("release", () => {
        wakeLock = null;
      });
    } else if (!wanted && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch {
    // Denied or unsupported (iOS before 16.4). Nothing to do.
    wakeLock = null;
  }
}

/* ---------------------------------------------------------------------------
 * Service worker
 * ------------------------------------------------------------------------- */
async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.register("service-worker.js");
    registration.addEventListener("updatefound", () => {
      const installing = registration.installing;
      if (!installing) return;
      installing.addEventListener("statechange", () => {
        if (installing.state === "installed" && navigator.serviceWorker.controller) {
          toast("A new version is ready", {
            actionLabel: "Reload",
            onAction: () => {
              installing.postMessage({ type: "SKIP_WAITING" });
              location.reload();
            },
          });
        }
      });
    });
  } catch (error) {
    console.warn("Service worker registration failed", error);
  }
}

/* ---------------------------------------------------------------------------
 * Boot
 * ------------------------------------------------------------------------- */
async function boot() {
  await init();
  applyTheme();

  // Ask the browser not to evict our data when storage runs low.
  try {
    await navigator.storage?.persist?.();
  } catch {
    /* Not supported; carry on. */
  }

  timer.resume();
  mountGlobalRestBar(document.getElementById("overlays"));
  router.start(mount);
  syncWakeLock();

  subscribe(() => {
    applyTheme();
    syncWakeLock();
    syncBottomInset();
  });

  // The rest panel changes the footer height as it appears and disappears.
  timer.subscribe(syncBottomInset);
  window.addEventListener("resize", syncBottomInset);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      // Recompute the rest timer from its end timestamp, then repaint.
      timer.resume();
      if (currentRoute) renderTabs(currentRoute);
    } else {
      flushWrites();
    }
    syncWakeLock();
  });

  // Belt and braces: make sure the last change is written before we go away.
  window.addEventListener("pagehide", () => flushWrites());

  const splash = document.getElementById("splash");
  splash.classList.add("is-hidden");
  setTimeout(() => splash.remove(), 300);

  if (!state.storagePersistent) {
    toast("This browser is blocking storage, so nothing will be saved.", { duration: 8000 });
  }

  registerServiceWorker();
  console.info(`Gym by John ${APP_VERSION}`);
}

boot().catch((error) => {
  console.error(error);
  document.getElementById("splash")?.remove();
  fill(
    screenRoot,
    h(
      "div",
      { class: "screen-body" },
      h("h1", { text: "Something went wrong starting the app" }),
      h("p", { text: String(error && error.message ? error.message : error) }),
      h("button", { class: "btn btn-primary btn-lg", type: "button", text: "Try again", onclick: () => location.reload() })
    )
  );
});
