// Past sessions, newest first.
import { h, fill, icon, formatDuration, formatDate } from "../utils.js";
import { sessionCounts } from "../models.js";
import { state, subscribe, removeSession, restoreSession } from "../state.js";
import * as router from "../router.js";
import { header, iconButton } from "../../components/header.js";
import { emptyState, menuSheet, toast } from "../../components/controls.js";
import { PLACEHOLDERS } from "../../components/image.js";

export function render() {
  const root = h("div", { class: "screen" });
  const unsubscribe = subscribe(() => update());

  function update() {
    const body = h("div", { class: "screen-body" });

    if (!state.sessions.length) {
      body.append(
        emptyState({
          image: PLACEHOLDERS.empty,
          title: "No workouts yet",
          message: "Finish a workout and it will appear here with every set you logged.",
        })
      );
    } else {
      let currentMonth = "";
      const list = h("ul", { class: "list", role: "list" });
      for (const item of state.sessions) {
        const date = new Date(item.startedAt);
        const month = `${date.toLocaleString(undefined, { month: "long" })} ${date.getFullYear()}`;
        if (month !== currentMonth) {
          currentMonth = month;
          list.append(h("li", { class: "history-day", text: month }));
        }
        const counts = item.summary || sessionCounts(item);
        list.append(
          h(
            "li",
            { class: "editor-item" },
            h(
              "button",
              {
                class: "row",
                type: "button",
                onclick: () => router.go(router.paths.historyDetail(item.id)),
              },
              h(
                "span",
                { class: "row-main" },
                h("span", { class: "row-title", text: `${formatDate(item.startedAt)} · ${item.workoutName}` }),
                h("span", {
                  class: "row-sub",
                  text: [
                    formatDuration(item.durationSeconds || 0),
                    `${counts.exerciseDone}/${counts.exerciseTotal} exercises`,
                    `${counts.setsDone} ${counts.setsDone === 1 ? "set" : "sets"}`,
                    item.difficulty ? `Difficulty ${item.difficulty}/5` : null,
                  ]
                    .filter(Boolean)
                    .join(" · "),
                })
              ),
              h("span", { class: "row-chev" }, icon("forward"))
            ),
            iconButton("more", `Options for ${item.workoutName}`, () =>
              menuSheet({
                title: `${formatDate(item.startedAt)} · ${item.workoutName}`,
                items: [
                  { label: "Open", icon: "forward", onSelect: () => router.go(router.paths.historyDetail(item.id)) },
                  {
                    label: "Delete this session",
                    icon: "trash",
                    onSelect: () => {
                      const removed = removeSession(item.id);
                      toast("Session deleted", {
                        actionLabel: "Undo",
                        onAction: () => restoreSession(removed),
                      });
                    },
                  },
                ],
              })
            )
          )
        );
      }
      body.append(list);
    }

    fill(root, header({ title: "History" }), body);
  }

  update();
  return { el: root, destroy: unsubscribe };
}
