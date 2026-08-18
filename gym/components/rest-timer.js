// Rest timer UI. Two presentations of the same timestamp-backed timer:
//  - a panel on the exercise screen you just finished a set on
//  - a floating bar everywhere else, so the timer never blocks navigation
import { h, icon, formatClock } from "../js/utils.js";
import * as timer from "../js/timer.js";
import * as router from "../js/router.js";

const RING_RADIUS = 24;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

/** Panel shown inline on the resting exercise's own screen. */
export function createRestPanel() {
  const time = h("div", { class: "rest-time", text: "00:00" });
  const ring = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  ring.setAttribute("viewBox", "0 0 54 54");
  ring.setAttribute("class", "rest-ring");
  ring.setAttribute("aria-hidden", "true");
  const track = circle("track");
  const value = circle("value");
  ring.append(track, value);

  const el = h(
    "section",
    { class: "rest-panel", "aria-label": "Rest timer" },
    ring,
    h(
      "div",
      {},
      h("div", { class: "rest-label", text: "Rest" }),
      time
    ),
    h(
      "div",
      { class: "rest-actions" },
      h("button", {
        class: "btn btn-outline",
        type: "button",
        text: "+30s",
        onclick: () => timer.addTime(30),
      }),
      h("button", {
        class: "btn btn-primary",
        type: "button",
        text: "Skip",
        onclick: () => timer.skip(),
      })
    )
  );

  function update() {
    const rest = timer.restInfo();
    if (!rest) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    time.textContent = formatClock(rest.remaining);
    const fraction = Math.max(0, Math.min(1, rest.remaining / rest.durationSeconds));
    value.setAttribute("stroke-dasharray", String(RING_LENGTH));
    value.setAttribute("stroke-dashoffset", String(RING_LENGTH * (1 - fraction)));
  }

  const unsubscribe = timer.subscribe(update);
  update();
  return { el, update, destroy: () => unsubscribe() };
}

function circle(className) {
  const node = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  node.setAttribute("cx", "27");
  node.setAttribute("cy", "27");
  node.setAttribute("r", String(RING_RADIUS));
  node.setAttribute("class", className);
  return node;
}

/**
 * One floating bar for the whole app, mounted once. It hides itself on the
 * screen that already shows the inline panel.
 */
export function mountGlobalRestBar(root) {
  const time = h("span", { class: "rest-bar-time", text: "00:00" });
  const label = h("span", { class: "rest-bar-label", text: "Rest" });
  const bar = h(
    "div",
    { class: "rest-bar", hidden: true },
    h("span", { class: "row-chev" }, icon("timer")),
    time,
    label,
    h("button", { type: "button", text: "Skip", onclick: () => timer.skip() })
  );
  // Tapping anywhere else on the bar returns to the exercise that is resting.
  bar.addEventListener("click", (event) => {
    if (event.target.closest("button")) return;
    const rest = timer.restInfo();
    if (rest) router.go(router.paths.sessionItem(rest.itemId));
  });

  function update() {
    const rest = timer.restInfo();
    if (!rest || rest.remaining <= 0) {
      bar.hidden = true;
      return;
    }
    const route = router.match();
    const onRestingScreen = route.name === "session-item" && route.params.itemId === rest.itemId;
    bar.hidden = onRestingScreen;
    time.textContent = formatClock(rest.remaining);
  }

  timer.subscribe(update);
  window.addEventListener("hashchange", update);
  root.append(bar);
  update();
  return { update };
}
