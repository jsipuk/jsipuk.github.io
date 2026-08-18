// One logged activity. Everything it knows, which is not much on purpose.
import { h, fill, formatLongDate, formatTime } from "../utils.js";
import { activityLabel, DIFFICULTY_WORDS } from "../models.js";
import { getActivity, removeActivity, saveActivity } from "../state.js";
import * as router from "../router.js";
import { header, backButton } from "../../components/header.js";
import { toast } from "../../components/controls.js";
import { openActivitySheet } from "../../components/activity-sheet.js";

export function render({ activityId }) {
  const root = h("div", { class: "screen" });

  function update() {
    const activity = getActivity(activityId);
    if (!activity) {
      fill(
        root,
        header({ title: "Activity", left: backButton(() => router.back(router.paths.history())) }),
        h("div", { class: "screen-body" }, h("p", { text: "That activity is no longer here." }))
      );
      return;
    }

    const label = activityLabel(activity.activityType);
    fill(
      root,
      header({
        title: label,
        subtitle: "Other activity",
        left: backButton(() => router.back(router.paths.history())),
      }),
      h(
        "div",
        { class: "screen-body" },
        h(
          "div",
          { class: "summary-grid" },
          stat(`${activity.durationMinutes} min`, "Duration"),
          stat(activity.difficulty ? `${activity.difficulty}/5` : "—", "Difficulty")
        ),
        h("p", {
          class: "row-sub",
          text: [
            `${formatLongDate(activity.startedAt)} at ${formatTime(activity.startedAt)}`,
            activity.difficulty ? DIFFICULTY_WORDS[activity.difficulty] : null,
          ]
            .filter(Boolean)
            .join(" · "),
        }),
        activity.note
          ? h(
              "div",
              {},
              h("div", { class: "group-label", text: "Note" }),
              h("div", { class: "note-block", text: activity.note })
            )
          : null,
        h("div", { class: "divider" }),
        h("button", {
          class: "btn btn-outline btn-block btn-lg",
          type: "button",
          text: "Edit activity",
          onclick: () => openActivitySheet({ activity, onSaved: update }),
        }),
        h("button", {
          class: "btn btn-danger btn-block",
          type: "button",
          text: "Delete activity",
          onclick: () => {
            const removed = removeActivity(activity.id);
            router.go(router.paths.history(), { replace: true });
            toast(`${label} deleted`, {
              actionLabel: "Undo",
              onAction: () => saveActivity(removed),
            });
          },
        })
      )
    );
  }

  function stat(value, label) {
    return h(
      "div",
      { class: "stat" },
      h("div", { class: "stat-value", text: value }),
      h("div", { class: "stat-label", text: label })
    );
  }

  update();
  return { el: root };
}
