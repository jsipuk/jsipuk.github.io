// Training history: gym sessions and other activities in one chronological
// list. Gym sessions keep their full detail; activities are just a record that
// they happened.
import { h, fill, icon, formatDuration, formatDate } from "../utils.js";
import { sessionCounts, activityLabel } from "../models.js";
import { state, subscribe, removeSession, restoreSession, removeActivity, saveActivity } from "../state.js";
import * as router from "../router.js";
import { header, iconButton } from "../../components/header.js";
import { emptyState, menuSheet, toast } from "../../components/controls.js";
import { openActivitySheet } from "../../components/activity-sheet.js";
import { PLACEHOLDERS } from "../../components/image.js";

export function render() {
  const root = h("div", { class: "screen" });
  const unsubscribe = subscribe(() => update());

  /** Both kinds of record, newest first. */
  function entries() {
    return [
      ...state.sessions.map((record) => ({ kind: "session", date: record.startedAt, record })),
      ...state.activities.map((record) => ({ kind: "activity", date: record.startedAt, record })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  function sessionRow(session) {
    const counts = session.summary || sessionCounts(session);
    return row({
      glyph: "dumbbell",
      title: `${formatDate(session.startedAt)} · ${session.workoutName}`,
      sub: [
        formatDuration(session.durationSeconds || 0),
        `${counts.exerciseDone}/${counts.exerciseTotal} exercises`,
        `${counts.setsDone} ${counts.setsDone === 1 ? "set" : "sets"}`,
        session.difficulty ? `Difficulty ${session.difficulty}/5` : null,
      ],
      onOpen: () => router.go(router.paths.historyDetail(session.id)),
      onMenu: () =>
        menuSheet({
          title: `${formatDate(session.startedAt)} · ${session.workoutName}`,
          items: [
            { label: "Open", icon: "forward", onSelect: () => router.go(router.paths.historyDetail(session.id)) },
            {
              label: "Delete this session",
              icon: "trash",
              onSelect: () => {
                const removed = removeSession(session.id);
                toast("Session deleted", { actionLabel: "Undo", onAction: () => restoreSession(removed) });
              },
            },
          ],
        }),
    });
  }

  function activityRow(activity) {
    const label = activityLabel(activity.activityType);
    return row({
      glyph: "waves",
      title: `${formatDate(activity.startedAt)} · ${label}`,
      sub: [
        `${activity.durationMinutes} min`,
        activity.difficulty ? `Difficulty ${activity.difficulty}/5` : null,
        activity.note ? "Note" : null,
      ],
      onOpen: () => router.go(router.paths.activityDetail(activity.id)),
      onMenu: () =>
        menuSheet({
          title: `${formatDate(activity.startedAt)} · ${label}`,
          items: [
            { label: "Open", icon: "forward", onSelect: () => router.go(router.paths.activityDetail(activity.id)) },
            { label: "Edit", icon: "edit", onSelect: () => openActivitySheet({ activity }) },
            {
              label: "Delete this activity",
              icon: "trash",
              onSelect: () => {
                const removed = removeActivity(activity.id);
                toast(`${label} deleted`, { actionLabel: "Undo", onAction: () => saveActivity(removed) });
              },
            },
          ],
        }),
    });
  }

  function row({ glyph, title, sub, onOpen, onMenu }) {
    return h(
      "li",
      { class: "editor-item" },
      h(
        "button",
        { class: "row", type: "button", onclick: onOpen },
        h("span", { class: "row-glyph" }, icon(glyph)),
        h(
          "span",
          { class: "row-main" },
          h("span", { class: "row-title", text: title }),
          h("span", { class: "row-sub", text: sub.filter(Boolean).join(" · ") })
        ),
        h("span", { class: "row-chev" }, icon("forward"))
      ),
      iconButton("more", `Options for ${title}`, onMenu)
    );
  }

  function update() {
    const body = h("div", { class: "screen-body" });
    const all = entries();

    if (!all.length) {
      body.append(
        emptyState({
          image: PLACEHOLDERS.empty,
          title: "Nothing here yet",
          message: "Finish a workout, or log another activity from Today, and it will appear here.",
        })
      );
    } else {
      let currentMonth = "";
      const list = h("ul", { class: "list", role: "list" });
      for (const entry of all) {
        const date = new Date(entry.date);
        const month = `${date.toLocaleString(undefined, { month: "long" })} ${date.getFullYear()}`;
        if (month !== currentMonth) {
          currentMonth = month;
          list.append(h("li", { class: "history-day", text: month }));
        }
        list.append(entry.kind === "session" ? sessionRow(entry.record) : activityRow(entry.record));
      }
      body.append(list);
    }

    fill(root, header({ title: "History" }), body);
  }

  update();
  return { el: root, destroy: unsubscribe };
}
