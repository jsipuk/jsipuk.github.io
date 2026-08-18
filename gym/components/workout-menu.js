// The workout item list: the same component powers the overview screen and
// the quick menu sheet, so the two can never drift apart.
import { h, statusIcon, icon } from "../js/utils.js";
import { itemStatus, STATUS_LABEL, targetText } from "../js/models.js";
import { openSheet } from "./controls.js";
import * as session from "../js/session.js";
import * as router from "../js/router.js";

const TYPE_LABEL = { warmup: "Warm up", cooldown: "Cool down", exercise: "Exercise" };

/**
 * @param {object} options
 * @param {(itemId: string) => void} options.onSelect
 * @param {boolean} [options.numbered] show 1..n against the exercises
 */
export function workoutItemList({ onSelect, numbered = true }) {
  const current = session.getSession();
  const list = h("ul", { class: "list", role: "list" });
  if (!current) return list;

  let exerciseNumber = 0;
  for (const item of current.items) {
    const status = itemStatus(item);
    if (item.type === "exercise") exerciseNumber += 1;
    const isCurrent = current.currentItemId === item.id;

    const sub =
      item.type === "exercise"
        ? item.sets.length
          ? `${item.sets.length} of ${item.targetSets} sets done`
          : targetText(item)
        : `${Math.round((item.durationSeconds || 0) / 60)} min`;

    list.append(
      h(
        "li",
        {},
        h(
          "button",
          {
            class: `row item-row ${isCurrent ? "is-current" : ""} ${status === "complete" ? "is-complete" : ""}`,
            type: "button",
            onclick: () => onSelect(item.id),
            "aria-label": `${item.name}. ${STATUS_LABEL[status]}. ${sub}`,
          },
          h("span", { class: `status status-${statusClass(status)}` }, statusIcon(status)),
          numbered
            ? h("span", {
                class: "item-index",
                text: item.type === "exercise" ? String(exerciseNumber) : "",
                "aria-hidden": "true",
              })
            : null,
          h(
            "span",
            { class: "row-main" },
            h("span", { class: "row-title", text: item.name }),
            h("span", { class: "row-sub", text: `${TYPE_LABEL[item.type]} · ${sub}` })
          ),
          isCurrent ? h("span", { class: "pill pill-primary", text: "Here" }) : null,
          h("span", { class: "row-chev" }, icon("forward"))
        )
      )
    );
  }
  return list;
}

function statusClass(status) {
  if (status === "complete") return "complete";
  if (status === "in-progress") return "progress";
  return "todo";
}

/** Rule 4: the whole workout list, one tap from anywhere in the workout. */
export function openQuickMenu() {
  const current = session.getSession();
  if (!current) return;
  openSheet({
    title: current.workoutName,
    full: true,
    build: (close) =>
      h(
        "div",
        {},
        h("p", { class: "overview-head", text: "Today's workout", style: { marginBottom: "10px" } }),
        workoutItemList({
          onSelect: (itemId) => {
            close();
            router.go(router.paths.sessionItem(itemId));
          },
        }),
        h("div", { style: { height: "16px" } }),
        h("button", {
          class: "btn btn-outline btn-block",
          type: "button",
          text: "Workout overview",
          onclick: () => {
            close();
            router.go(router.paths.sessionOverview());
          },
        }),
        h("div", { style: { height: "8px" } }),
        h("button", {
          class: "btn btn-primary btn-block",
          type: "button",
          text: "Finish workout",
          onclick: () => {
            close();
            router.go(router.paths.sessionFinish());
          },
        })
      ),
  });
}
