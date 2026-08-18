// Workout complete — the reflection screen. Two things only: how hard it felt,
// and anything worth remembering (spec §25).
import { h, fill, icon, formatDuration, debounce } from "../utils.js";
import { sessionCounts, sessionDurationSeconds } from "../models.js";
import { subscribe } from "../state.js";
import * as session from "../session.js";
import * as router from "../router.js";
import { header, iconButton } from "../../components/header.js";
import { createEffortRating } from "../../components/rating.js";
import { toast, confirmSheet } from "../../components/controls.js";

export function render() {
  const live = session.getSession();
  if (!live) {
    router.go(router.paths.today(), { replace: true });
    return { el: h("div") };
  }

  const root = h("div", { class: "screen" });
  const noteField = h("textarea", {
    class: "textarea",
    placeholder: "Anything worth remembering?",
    "aria-label": "Workout note",
    rows: "3",
  });
  noteField.value = live.workoutNote || "";
  // Autosave the note as it is typed, so closing the app cannot lose it.
  noteField.addEventListener("input", debounce(() => session.setWorkoutNote(noteField.value), 300));

  const rating = createEffortRating({
    value: live.difficulty,
    onChange: (value) => session.setDifficulty(value),
  });
  // The session is the source of truth (Undo elsewhere can change it).
  const unsubscribe = subscribe(() => rating.setValue(session.getSession()?.difficulty ?? null));

  function save() {
    const current = session.getSession();
    const note = noteField.value.trim();
    const saved = session.finishSession({ difficulty: current.difficulty, note });
    router.go(router.paths.today(), { replace: true });
    toast("Workout saved to history", {
      actionLabel: "View",
      onAction: () => router.go(router.paths.historyDetail(saved.id)),
    });
  }

  const counts = sessionCounts(live);
  const unfinished = counts.itemTotal - counts.itemsDone;

  fill(
    root,
    header({
      title: "Workout complete",
      left: iconButton("back", "Back to the workout", () => router.go(router.paths.sessionOverview())),
    }),
    h(
      "div",
      { class: "screen-body" },
      h(
        "div",
        { class: "complete-hero" },
        h("span", { class: "complete-badge" }, icon("check", 40)),
        h("h1", { text: "Good work" }),
        h("p", { text: live.workoutName })
      ),
      h(
        "div",
        { class: "summary-grid" },
        stat(formatDuration(sessionDurationSeconds(live)), "Duration"),
        stat(`${counts.exerciseDone}/${counts.exerciseTotal}`, "Exercises"),
        stat(String(counts.setsDone), "Sets")
      ),
      unfinished
        ? h("p", {
            class: "field-hint",
            text: `${unfinished} item${unfinished === 1 ? "" : "s"} not finished. They will be saved exactly as they are.`,
          })
        : null,
      h(
        "div",
        {},
        h("div", { class: "field-label", text: "How hard did it feel?" }),
        rating.el
      ),
      h(
        "div",
        {},
        h("div", { class: "field-label", text: "Anything worth remembering?" }),
        noteField
      ),
      h("button", { class: "btn btn-quiet btn-block", type: "button", text: "Discard this workout", onclick: () =>
        confirmSheet({
          title: "Discard this workout?",
          message: "Nothing from today will be saved to history. This cannot be undone.",
          confirmLabel: "Discard workout",
          onConfirm: async () => {
            await session.discardSession();
            toast("Workout discarded");
            router.go(router.paths.today(), { replace: true });
          },
        }) })
    ),
    h(
      "div",
      { class: "ex-actions" },
      h("button", { class: "btn btn-primary btn-block btn-lg", type: "button", text: "Save workout", onclick: save })
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

  return { el: root, destroy: unsubscribe };
}
