// Workout editor. Changes save as you make them — there is no Save button to
// forget about, and no dialog between you and a small correction.
import { h, fill, icon, formatNumber, debounce } from "../utils.js";
import { makeExercise, duplicateExercise, duplicateWorkout } from "../models.js";
import { state, saveWorkout, archiveWorkout, restoreWorkout, updateSettings, getWorkout } from "../state.js";
import * as session from "../session.js";
import * as router from "../router.js";
import { header, iconButton, backButton } from "../../components/header.js";
import { menuSheet, toast, confirmSheet, textSheet } from "../../components/controls.js";
import { openArtworkPicker } from "../../components/artwork-picker.js";

export function render({ workoutId }) {
  const root = h("div", { class: "screen" });
  // No global subscription here: this screen owns text inputs, and a re-render
  // triggered by its own autosave would steal focus mid-word. Structural
  // changes (add, move, delete, rename) call update() explicitly instead.
  const saveSoon = debounce((workout) => saveWorkout(workout), 350);

  function update() {
    const workout = getWorkout(workoutId);
    if (!workout) {
      router.go(router.paths.workouts(), { replace: true });
      return;
    }

    const nameInput = h("input", { class: "input", type: "text", "aria-label": "Workout name" });
    nameInput.value = workout.name;
    nameInput.addEventListener("input", () => {
      workout.name = nameInput.value;
      saveSoon(workout);
      // Keep the start button's label honest without a full re-render, which
      // would take the caret out of this field.
      if (startButton && !session.hasActiveSession()) startButton.textContent = `Start ${workout.name}`;
    });
    let startButton = null;

    const descriptionInput = h("input", {
      class: "input",
      type: "text",
      placeholder: "Optional description",
      "aria-label": "Description",
    });
    descriptionInput.value = workout.description || "";
    descriptionInput.addEventListener("input", () => {
      workout.description = descriptionInput.value;
      saveSoon(workout);
    });

    fill(
      root,
      header({
        title: "Edit workout",
        left: backButton(() => router.back(router.paths.workouts())),
        right: iconButton("more", "Workout options", () => openMore(workout)),
      }),
      h(
        "div",
        { class: "screen-body" },
        h("div", { class: "field" }, h("div", { class: "field-label", text: "Name" }), nameInput),
        h("div", { class: "field" }, h("div", { class: "field-label", text: "Description" }), descriptionInput),

        h("div", { class: "group-label", text: "Warm-up" }),
        stageRow(workout, "warmup"),

        h("div", { class: "group-label", text: `Exercises (${workout.exercises.length})` }),
        workout.exercises.length
          ? h(
              "ul",
              { class: "list", role: "list" },
              [...workout.exercises]
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((exercise, index, all) => exerciseRow(workout, exercise, index, all.length))
            )
          : h("p", { class: "field-hint", text: "No exercises yet. Add the first one below." }),
        h("button", {
          class: "btn btn-outline btn-block",
          type: "button",
          text: "Add exercise",
          onclick: () => addExercise(workout),
        }),

        h("div", { class: "group-label", text: "Cool-down" }),
        stageRow(workout, "cooldown"),

        h("div", { style: { height: "8px" } }),
        (startButton = h("button", {
          class: "btn btn-primary btn-block btn-lg",
          type: "button",
          text: session.hasActiveSession() ? "A workout is already running" : `Start ${workout.name}`,
          disabled: session.hasActiveSession() || !workout.exercises.length,
          onclick: () => {
            session.startWorkout(workout.id);
            updateSettings({ selectedWorkoutId: workout.id });
            router.go(router.paths.sessionOverview());
          },
        })),
        !workout.exercises.length
          ? h("p", { class: "field-hint", text: "Add at least one exercise before starting." })
          : null
      )
    );
  }

  function stageRow(workout, type) {
    const stage = workout[type];
    if (!stage) {
      return h(
        "button",
        {
          class: "row",
          type: "button",
          onclick: () => {
            workout[type] = { name: type === "warmup" ? "Warm Up" : "Cool Down", durationSeconds: 300, instructions: "", notes: "", image: null };
            saveWorkout(workout);
            update();
          },
        },
        h("span", { class: "row-chev" }, icon("plus")),
        h("span", { class: "row-main" }, h("span", { class: "row-title", text: `Add a ${type === "warmup" ? "warm-up" : "cool-down"}` }))
      );
    }
    return h(
      "button",
      {
        class: "row",
        type: "button",
        onclick: () => router.go(router.paths.exerciseEditor(workout.id, type)),
      },
      h(
        "span",
        { class: "row-main" },
        h("span", { class: "row-title", text: stage.name }),
        h("span", { class: "row-sub", text: `${Math.round((stage.durationSeconds || 0) / 60)} min` })
      ),
      h("span", { class: "row-chev" }, icon("forward"))
    );
  }

  function exerciseRow(workout, exercise, index, total) {
    const reps = exercise.repRange ? `${exercise.repRange.min}-${exercise.repRange.max}` : exercise.targetReps;
    return h(
      "li",
      { class: "editor-item" },
      h(
        "div",
        { class: "reorder" },
        h(
          "button",
          {
            type: "button",
            "aria-label": `Move ${exercise.name || "exercise"} up`,
            disabled: index === 0,
            onclick: () => moveExercise(workout, index, -1),
          },
          icon("up")
        ),
        h(
          "button",
          {
            type: "button",
            "aria-label": `Move ${exercise.name || "exercise"} down`,
            disabled: index === total - 1,
            onclick: () => moveExercise(workout, index, 1),
          },
          icon("down")
        )
      ),
      h(
        "button",
        {
          class: "row",
          type: "button",
          onclick: () => router.go(router.paths.exerciseEditor(workout.id, exercise.id)),
        },
        h(
          "span",
          { class: "row-main" },
          h("span", { class: "row-title", text: exercise.name || "Untitled exercise" }),
          h("span", {
            class: "row-sub",
            text: `${exercise.sets} × ${reps} reps · ${formatNumber(exercise.defaultWeight)} ${state.settings.unit} · ${exercise.restSeconds}s rest`,
          })
        ),
        h("span", { class: "row-chev" }, icon("forward"))
      ),
      iconButton("more", `Options for ${exercise.name || "exercise"}`, () => exerciseMenu(workout, exercise, index))
    );
  }

  function moveExercise(workout, index, direction) {
    const ordered = [...workout.exercises].sort((a, b) => a.sortOrder - b.sortOrder);
    const target = index + direction;
    if (target < 0 || target >= ordered.length) return;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    ordered.forEach((exercise, position) => { exercise.sortOrder = position; });
    workout.exercises = ordered;
    saveWorkout(workout);
    update();
  }

  /**
   * Start from the artwork rather than a blank name: choosing the picture sets
   * the name and pins the image, so there is nothing to spell correctly.
   */
  function addExercise(workout) {
    const create = (partial) => {
      const exercise = makeExercise({ sortOrder: workout.exercises.length, ...partial });
      workout.exercises.push(exercise);
      saveWorkout(workout);
      router.go(router.paths.exerciseEditor(workout.id, exercise.id));
    };
    openArtworkPicker({
      title: "Add an exercise",
      onSelect: (choice) => create({ name: choice.label, image: choice.file }),
      blank: { label: "Something else", onSelect: () => create({}) },
    });
  }

  function exerciseMenu(workout, exercise, index) {
    menuSheet({
      title: exercise.name || "Exercise",
      items: [
        { label: "Edit", icon: "edit", onSelect: () => router.go(router.paths.exerciseEditor(workout.id, exercise.id)) },
        {
          label: "Duplicate",
          icon: "copy",
          onSelect: () => {
            const copy = duplicateExercise(exercise, { name: `${exercise.name} copy`, sortOrder: exercise.sortOrder + 0.5 });
            workout.exercises.push(copy);
            workout.exercises.sort((a, b) => a.sortOrder - b.sortOrder).forEach((item, position) => { item.sortOrder = position; });
            saveWorkout(workout);
            update();
            toast("Exercise duplicated");
          },
        },
        index > 0 ? { label: "Move up", icon: "up", onSelect: () => moveExercise(workout, index, -1) } : null,
        index < workout.exercises.length - 1
          ? { label: "Move down", icon: "down", onSelect: () => moveExercise(workout, index, 1) }
          : null,
        {
          label: "Delete",
          icon: "trash",
          onSelect: () => {
            const removed = exercise;
            const position = workout.exercises.findIndex((e) => e.id === exercise.id);
            workout.exercises = workout.exercises.filter((e) => e.id !== exercise.id);
            saveWorkout(workout);
            update();
            toast(`${removed.name || "Exercise"} deleted`, {
              actionLabel: "Undo",
              onAction: () => {
                workout.exercises.splice(position, 0, removed);
                saveWorkout(workout);
                update();
              },
            });
          },
        },
      ],
    });
  }

  function openMore(workout) {
    menuSheet({
      title: workout.name,
      items: [
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
                update();
              },
            }),
        },
        {
          label: "Duplicate workout",
          icon: "copy",
          onSelect: () => {
            const copy = duplicateWorkout(workout);
            saveWorkout(copy);
            toast(`Created "${copy.name}"`);
            router.go(router.paths.workoutEditor(copy.id));
          },
        },
        {
          label: "Delete workout",
          icon: "trash",
          onSelect: () =>
            confirmSheet({
              title: `Delete ${workout.name}?`,
              message: "Past sessions stay in History. You can undo this straight afterwards.",
              confirmLabel: "Delete workout",
              onConfirm: () => {
                archiveWorkout(workout.id);
                router.go(router.paths.workouts());
                toast(`${workout.name} deleted`, {
                  actionLabel: "Undo",
                  onAction: () => restoreWorkout(workout),
                });
              },
            }),
        },
      ],
    });
  }

  update();
  return { el: root };
}
