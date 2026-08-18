// Workout plans: create, edit, duplicate, rename, reorder, archive.
import { h, fill, icon } from "../utils.js";
import { makeWorkout, duplicateWorkout } from "../models.js";
import {
  state,
  subscribe,
  saveWorkout,
  archiveWorkout,
  restoreWorkout,
  reorderWorkouts,
  updateSettings,
} from "../state.js";
import * as router from "../router.js";
import { header, iconButton } from "../../components/header.js";
import { menuSheet, textSheet, toast, emptyState, confirmSheet } from "../../components/controls.js";
import { PLACEHOLDERS } from "../../components/image.js";

export function render() {
  const root = h("div", { class: "screen" });
  const unsubscribe = subscribe(() => update());

  function create() {
    const workout = makeWorkout(`Workout ${String.fromCharCode(65 + state.workouts.length)}`);
    saveWorkout(workout);
    router.go(router.paths.workoutEditor(workout.id));
  }

  function rowMenu(workout, index) {
    menuSheet({
      title: workout.name,
      items: [
        { label: "Edit", icon: "edit", onSelect: () => router.go(router.paths.workoutEditor(workout.id)) },
        {
          label: "Use for today",
          icon: "check",
          onSelect: () => {
            updateSettings({ selectedWorkoutId: workout.id });
            toast(`${workout.name} is today's workout`);
            router.go(router.paths.today());
          },
        },
        {
          label: "Rename",
          icon: "note",
          onSelect: () =>
            textSheet({
              title: "Rename workout",
              label: "Name",
              value: workout.name,
              onSave: (value) => {
                if (!value.trim()) return;
                workout.name = value.trim();
                saveWorkout(workout);
              },
            }),
        },
        {
          label: "Duplicate",
          icon: "copy",
          onSelect: () => {
            const copy = duplicateWorkout(workout);
            saveWorkout(copy);
            toast(`Created "${copy.name}"`);
          },
        },
        index > 0
          ? {
              label: "Move up",
              icon: "up",
              onSelect: () => move(index, -1),
            }
          : null,
        index < state.workouts.length - 1
          ? {
              label: "Move down",
              icon: "down",
              onSelect: () => move(index, 1),
            }
          : null,
        {
          label: "Delete",
          icon: "trash",
          onSelect: () => remove(workout),
        },
      ],
    });
  }

  function move(index, direction) {
    const ids = state.workouts.map((w) => w.id);
    const target = index + direction;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorderWorkouts(ids);
  }

  function remove(workout) {
    const hasHistory = state.sessions.some((s) => s.workoutId === workout.id);
    const doDelete = () => {
      archiveWorkout(workout.id);
      toast(`${workout.name} deleted`, {
        actionLabel: "Undo",
        onAction: () => restoreWorkout(workout),
      });
    };
    // History keeps its own copy of everything, so deleting is safe — but say so.
    if (hasHistory) {
      confirmSheet({
        title: `Delete ${workout.name}?`,
        message: "Past sessions stay in History. You can undo this straight afterwards.",
        confirmLabel: "Delete workout",
        onConfirm: doDelete,
      });
    } else {
      doDelete();
    }
  }

  function update() {
    fill(
      root,
      header({
        title: "Workouts",
        right: iconButton("plus", "New workout", create),
      }),
      h(
        "div",
        { class: "screen-body" },
        state.workouts.length
          ? h(
              "ul",
              { class: "list", role: "list" },
              state.workouts.map((workout, index) =>
                h(
                  "li",
                  { class: "editor-item" },
                  h(
                    "button",
                    {
                      class: "row",
                      type: "button",
                      onclick: () => router.go(router.paths.workoutEditor(workout.id)),
                    },
                    h(
                      "span",
                      { class: "row-main" },
                      h("span", { class: "row-title", text: workout.name }),
                      h("span", { class: "row-sub", text: planLine(workout) })
                    ),
                    state.settings.selectedWorkoutId === workout.id
                      ? h("span", { class: "pill pill-primary", text: "Today" })
                      : null,
                    h("span", { class: "row-chev" }, icon("forward"))
                  ),
                  iconButton("more", `Options for ${workout.name}`, () => rowMenu(workout, index))
                )
              )
            )
          : emptyState({
              image: PLACEHOLDERS.empty,
              title: "No workouts yet",
              message: "A workout is a warm-up, your exercises, and a cool-down.",
              action: h("button", { class: "btn btn-primary btn-lg", type: "button", text: "Create a workout", onclick: create }),
            }),
        state.workouts.length
          ? h("button", { class: "btn btn-outline btn-block", type: "button", text: "New workout", onclick: create })
          : null
      )
    );
  }

  update();
  return { el: root, destroy: unsubscribe };
}

function planLine(workout) {
  const sets = workout.exercises.reduce((total, exercise) => total + (exercise.sets || 1), 0);
  return `${workout.exercises.length} ${workout.exercises.length === 1 ? "exercise" : "exercises"} · ${sets} ${sets === 1 ? "set" : "sets"}`;
}
