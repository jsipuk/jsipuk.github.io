// Everything recorded for one exercise, newest first. Deliberately a list,
// not a chart — V1 has no analytics.
import { h, fill, icon, formatDate, formatNumber } from "../utils.js";
import { state } from "../state.js";
import * as session from "../session.js";
import * as router from "../router.js";
import { header, backButton } from "../../components/header.js";
import { emptyState } from "../../components/controls.js";
import { PLACEHOLDERS } from "../../components/image.js";

export function render({ exerciseId }) {
  const rows = session.exerciseHistory(exerciseId);
  const name = findName(exerciseId, rows);
  const root = h("div", { class: "screen" });

  fill(
    root,
    header({
      title: name,
      subtitle: "Exercise history",
      left: backButton(() => router.back(router.paths.history())),
    }),
    h(
      "div",
      { class: "screen-body" },
      rows.length
        ? h(
            "ul",
            { class: "list detail-list", role: "list" },
            rows.map((row) =>
              h(
                "li",
                { class: "row" },
                h(
                  "span",
                  { class: "row-main" },
                  h("span", { class: "row-title", text: formatDate(row.date, { withYear: true }) }),
                  h("span", {
                    class: "row-sub",
                    text: row.sets
                      .map((set) => `${formatNumber(set.weight)} ${set.unit || row.unit} × ${set.reps}`)
                      .join("   "),
                  }),
                  row.note ? h("span", { class: "detail-sets", text: `Note: ${row.note}` }) : null
                ),
                h(
                  "button",
                  {
                    class: "row-chev",
                    type: "button",
                    "aria-label": `Open the session from ${formatDate(row.date)}`,
                    onclick: () => router.go(router.paths.historyDetail(row.sessionId)),
                  },
                  icon("forward")
                )
              )
            )
          )
        : emptyState({
            image: PLACEHOLDERS.empty,
            title: "Nothing recorded yet",
            message: "Complete a set of this exercise and it will be listed here.",
          })
    )
  );

  return { el: root };
}

function findName(exerciseId, rows) {
  for (const workout of state.workouts) {
    const match = workout.exercises.find((exercise) => exercise.id === exerciseId);
    if (match) return match.name || "Exercise";
  }
  const live = session.getItem?.(exerciseId);
  if (live) return live.name;
  for (const past of state.sessions) {
    const match = past.items.find((entry) => entry.id === exerciseId);
    if (match) return match.name;
  }
  return "Exercise";
}
