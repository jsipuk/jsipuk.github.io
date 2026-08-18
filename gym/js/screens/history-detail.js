// One past session in full: what was done, with what, and how it felt.
import { h, fill, icon, statusIcon, formatDuration, formatLongDate, formatTime, formatNumber } from "../utils.js";
import { sessionCounts, itemStatus, DIFFICULTY_WORDS, STATUS_LABEL } from "../models.js";
import { state } from "../state.js";
import * as router from "../router.js";
import { header, backButton } from "../../components/header.js";

export function render({ sessionId }) {
  const item = state.sessions.find((s) => s.id === sessionId);
  const root = h("div", { class: "screen" });

  if (!item) {
    fill(
      root,
      header({ title: "Session", left: backButton(() => router.back(router.paths.history())) }),
      h("div", { class: "screen-body" }, h("p", { text: "That session is no longer here." }))
    );
    return { el: root };
  }

  const counts = item.summary || sessionCounts(item);

  fill(
    root,
    header({
      title: item.workoutName,
      subtitle: formatLongDate(item.startedAt),
      left: backButton(() => router.back(router.paths.history())),
    }),
    h(
      "div",
      { class: "screen-body" },
      h(
        "div",
        { class: "summary-grid" },
        stat(formatDuration(item.durationSeconds || 0), "Duration"),
        stat(`${counts.exerciseDone}/${counts.exerciseTotal}`, "Exercises"),
        stat(String(counts.setsDone), "Sets")
      ),
      h("p", {
        class: "row-sub",
        text: `${formatTime(item.startedAt)} – ${item.finishedAt ? formatTime(item.finishedAt) : "—"}${
          item.difficulty ? ` · Difficulty ${item.difficulty}/5 (${DIFFICULTY_WORDS[item.difficulty]})` : ""
        }`,
      }),
      item.workoutNote
        ? h(
            "div",
            {},
            h("div", { class: "group-label", text: "Workout note" }),
            h("div", { class: "note-block", text: item.workoutNote })
          )
        : null,
      h("div", { class: "group-label", text: "What you did" }),
      h(
        "ul",
        { class: "list detail-list", role: "list" },
        item.items.map((entry) => {
          const status = itemStatus(entry);
          const sets = entry.sets || [];
          return h(
            "li",
            {},
            h(
              entry.type === "exercise" ? "button" : "div",
              {
                class: "row",
                type: entry.type === "exercise" ? "button" : undefined,
                onclick:
                  entry.type === "exercise"
                    ? () => router.go(router.paths.exerciseHistory(entry.id))
                    : undefined,
              },
              h(
                "span",
                { class: `status status-${status === "complete" ? "complete" : status === "in-progress" ? "progress" : "todo"}` },
                statusIcon(status)
              ),
              h(
                "span",
                { class: "row-main" },
                h("span", { class: "row-title", text: entry.name }),
                h("span", {
                  class: "row-sub",
                  text: sets.length
                    ? sets
                        .map((set) => `${formatNumber(set.weight)} ${set.unit || item.unit} × ${set.reps}`)
                        .join("   ")
                    : STATUS_LABEL[status],
                }),
                entry.sessionNote ? h("span", { class: "detail-sets", text: `Note: ${entry.sessionNote}` }) : null
              ),
              entry.type === "exercise" ? h("span", { class: "row-chev" }, icon("history")) : null
            )
          );
        })
      )
    )
  );

  function stat(value, label) {
    return h(
      "div",
      { class: "stat" },
      h("div", { class: "stat-value", text: value }),
      h("div", { class: "stat-label", text: label })
    );
  }

  return { el: root };
}
