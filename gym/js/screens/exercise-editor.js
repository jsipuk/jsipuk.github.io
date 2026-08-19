// Exercise editor, also used for the warm-up and cool-down stages.
// Fields save as they change; the dynamic controls repaint in place so that
// typing in a text box is never interrupted.
import { h, fill, icon, formatNumber, formatClock, debounce } from "../utils.js";
import { makeExercise, WEIGHT_INCREMENTS, REST_PRESETS } from "../models.js";
import { state, saveWorkout, getWorkout, saveImageFile, deleteImage } from "../state.js";
import * as router from "../router.js";
import { header, iconButton, backButton } from "../../components/header.js";
import { stepper, chipRow, openNumberPad, menuSheet, toast, confirmSheet } from "../../components/controls.js";
import { imageEl, forgetImage, bundledArtwork, expectedArtworkName, bundledArtworkList, PLACEHOLDERS } from "../../components/image.js";
import { openArtworkPicker } from "../../components/artwork-picker.js";

export function render({ workoutId, itemId }) {
  const workout = getWorkout(workoutId);
  if (!workout) {
    router.go(router.paths.workouts(), { replace: true });
    return { el: h("div") };
  }

  const isStage = itemId === "warmup" || itemId === "cooldown";
  const target = isStage ? workout[itemId] : workout.exercises.find((e) => e.id === itemId);
  if (!target) {
    router.go(router.paths.workoutEditor(workoutId), { replace: true });
    return { el: h("div") };
  }

  const save = debounce(() => saveWorkout(workout), 300);
  const saveNow = () => saveWorkout(workout);

  const root = h("div", { class: "screen" });
  const slots = {
    image: h("div"),
    sets: h("div"),
    reps: h("div"),
    weight: h("div"),
    increment: h("div"),
    rest: h("div"),
    duration: h("div"),
  };

  const fileInput = h("input", {
    type: "file",
    accept: "image/*",
    class: "visually-hidden",
    onchange: async (event) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      const previous = target.image;
      try {
        target.image = await saveImageFile(file);
        saveNow();
        if (previous) {
          forgetImage(previous);
          deleteImage(previous);
        }
        paintImage();
      } catch (error) {
        console.error(error);
        toast("Could not read that image");
      }
    },
  });

  const nameInput = textInput(target.name, "Name", (value) => {
    target.name = value;
    save();
    // The artwork is matched from the name, so the picker's advice changes
    // as it is typed. Only the image block repaints, so the caret stays put.
    paintImage();
  });
  const instructionsInput = textArea(target.instructions, "Technique or setup notes shown during the workout", (value) => {
    target.instructions = value;
    save();
  });
  const notesInput = textArea(target.notes, "Anything you want to remember every time", (value) => {
    target.notes = value;
    save();
  });

  function paintImage() {
    fill(
      slots.image,
      h("div", { class: "field-label", text: "Visual guide" }),
      h(
        "div",
        { class: "image-picker" },
        h(
          "div",
          { class: "image-preview" },
          imageEl(target.image, {
            alt: target.image ? `${target.name} image` : "",
            placeholder: isStage
              ? itemId === "warmup"
                ? PLACEHOLDERS.warmup
                : PLACEHOLDERS.cooldown
              : PLACEHOLDERS.exercise,
            name: target.name,
          })
        ),
        h(
          "div",
          { style: { display: "grid", gap: "8px", flex: "1" } },
          bundledArtworkList().length
            ? h("button", {
                class: "btn btn-outline",
                type: "button",
                text: "Choose artwork",
                onclick: () =>
                  openArtworkPicker({
                    title: "Choose artwork",
                    onSelect: (choice) => {
                      const previous = target.image;
                      target.image = choice.file;
                      // An unnamed exercise takes the picture's name too.
                      if (!target.name.trim()) {
                        target.name = choice.label;
                        nameInput.value = choice.label;
                      }
                      saveNow();
                      if (previous && previous.startsWith("idb:")) {
                        forgetImage(previous);
                        deleteImage(previous);
                      }
                      paintImage();
                    },
                  }),
              })
            : null,
          h("button", {
            class: "btn btn-outline",
            type: "button",
            text: target.image ? "Use my own photo" : "Upload a photo",
            onclick: () => fileInput.click(),
          }),
          target.image
            ? h("button", {
                class: "btn btn-danger",
                type: "button",
                text: "Remove image",
                onclick: () => {
                  const previous = target.image;
                  target.image = null;
                  saveNow();
                  forgetImage(previous);
                  deleteImage(previous);
                  paintImage();
                },
              })
            : null
        )
      ),
      h("p", { class: "field-hint", text: artworkHint() })
    );
  }

  /** Explains which picture is in use, and how to supply one. */
  function artworkHint() {
    if (target.image) {
      if (target.image.startsWith("idb:")) {
        return "Your own photo, stored on this device only. Remove it to fall back to the app's artwork.";
      }
      const known = bundledArtworkList().find((choice) => choice.file === target.image);
      return known ? `Using the ${known.label} artwork.` : `Using ${target.image}.`;
    }
    const matched = bundledArtwork(target.name);
    if (matched) return `Using ${matched}, matched to the name above.`;
    const expected = expectedArtworkName(target.name);
    return expected
      ? `No artwork yet. Add ${expected} to assets/exercises and it will be used automatically. Landscape, roughly 16:10, works best.`
      : "Name this first, then artwork can be matched to it automatically.";
  }

  function paintSets() {
    fill(
      slots.sets,
      stepper({
        label: "Sets",
        value: target.sets,
        onStep: (direction) => {
          target.sets = Math.max(1, target.sets + direction);
          saveNow();
          paintSets();
        },
        onPick: () =>
          openNumberPad({
            title: "Sets",
            value: target.sets,
            max: 20,
            onSet: (value) => {
              target.sets = Math.max(1, Math.round(value));
              saveNow();
              paintSets();
            },
          }),
      })
    );
  }

  function paintReps() {
    const usingRange = Boolean(target.repRange);
    fill(
      slots.reps,
      usingRange
        ? h(
            "div",
            {},
            h("div", { class: "field-label", text: "Target rep range" }),
            h(
              "div",
              { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" } },
              stepper({
                label: "Lowest",
                value: target.repRange.min,
                onStep: (direction) => {
                  target.repRange.min = Math.max(1, target.repRange.min + direction);
                  target.repRange.max = Math.max(target.repRange.min, target.repRange.max);
                  saveNow();
                  paintReps();
                },
                onPick: () =>
                  openNumberPad({
                    title: "Lowest reps",
                    value: target.repRange.min,
                    max: 999,
                    onSet: (value) => {
                      target.repRange.min = Math.max(1, Math.round(value));
                      target.repRange.max = Math.max(target.repRange.min, target.repRange.max);
                      saveNow();
                      paintReps();
                    },
                  }),
              }),
              stepper({
                label: "Highest",
                value: target.repRange.max,
                onStep: (direction) => {
                  target.repRange.max = Math.max(target.repRange.min, target.repRange.max + direction);
                  saveNow();
                  paintReps();
                },
                onPick: () =>
                  openNumberPad({
                    title: "Highest reps",
                    value: target.repRange.max,
                    max: 999,
                    onSet: (value) => {
                      target.repRange.max = Math.max(target.repRange.min, Math.round(value));
                      saveNow();
                      paintReps();
                    },
                  }),
              })
            ),
            h("button", {
              class: "btn btn-link btn-block",
              type: "button",
              text: "Use a single target instead",
              onclick: () => {
                target.targetReps = target.repRange.min;
                target.repRange = null;
                saveNow();
                paintReps();
              },
            })
          )
        : h(
            "div",
            {},
            stepper({
              label: "Target reps",
              value: target.targetReps,
              onStep: (direction) => {
                target.targetReps = Math.max(1, target.targetReps + direction);
                saveNow();
                paintReps();
              },
              onPick: () =>
                openNumberPad({
                  title: "Target reps",
                  value: target.targetReps,
                  max: 999,
                  onSet: (value) => {
                    target.targetReps = Math.max(1, Math.round(value));
                    saveNow();
                    paintReps();
                  },
                }),
            }),
            h("button", {
              class: "btn btn-link btn-block",
              type: "button",
              text: "Use a rep range (for example 8-12)",
              onclick: () => {
                target.repRange = { min: target.targetReps, max: target.targetReps + 2 };
                saveNow();
                paintReps();
              },
            })
          )
    );
  }

  function paintWeight() {
    fill(
      slots.weight,
      stepper({
        label: "Default weight",
        value: target.defaultWeight,
        unit: state.settings.unit,
        onStep: (direction) => {
          const step = target.weightIncrement || 2.5;
          target.defaultWeight = Math.max(0, Number((target.defaultWeight + direction * step).toFixed(2)));
          saveNow();
          paintWeight();
        },
        onPick: () =>
          openNumberPad({
            title: "Default weight",
            value: target.defaultWeight,
            unit: state.settings.unit,
            allowDecimal: true,
            onSet: (value) => {
              target.defaultWeight = value;
              saveNow();
              paintWeight();
            },
          }),
      })
    );
  }

  function paintIncrement() {
    fill(
      slots.increment,
      h("div", { class: "field-label", text: `Weight increment (${state.settings.unit})` }),
      chipRow({
        label: "Weight increment",
        options: WEIGHT_INCREMENTS.map((value) => ({ value, label: formatNumber(value) })),
        value: target.weightIncrement,
        onChange: (value) => {
          target.weightIncrement = value;
          saveNow();
          paintIncrement();
          paintWeight();
        },
        allowCustom: true,
        onCustom: () =>
          openNumberPad({
            title: "Weight increment",
            value: target.weightIncrement,
            unit: state.settings.unit,
            allowDecimal: true,
            max: 100,
            onSet: (value) => {
              target.weightIncrement = value || 1;
              saveNow();
              paintIncrement();
              paintWeight();
            },
          }),
      }),
      h("p", { class: "field-hint", text: "What one tap of + or − adds during the workout." })
    );
  }

  function paintRest() {
    fill(
      slots.rest,
      h("div", { class: "field-label", text: "Rest between sets" }),
      chipRow({
        label: "Rest between sets",
        options: REST_PRESETS.map((value) => ({ value, label: value < 60 ? `${value}s` : formatClock(value) })),
        value: target.restSeconds,
        onChange: (value) => {
          target.restSeconds = value;
          saveNow();
          paintRest();
        },
        allowCustom: true,
        onCustom: () =>
          openNumberPad({
            title: "Rest (seconds)",
            value: target.restSeconds,
            max: 900,
            onSet: (value) => {
              target.restSeconds = Math.max(0, Math.round(value));
              saveNow();
              paintRest();
            },
          }),
      }),
      h("p", { class: "field-hint", text: "Starts automatically when you complete a set." })
    );
  }

  function paintDuration() {
    const minutes = Math.round((target.durationSeconds || 0) / 60);
    fill(
      slots.duration,
      stepper({
        label: "Duration (minutes)",
        value: minutes,
        onStep: (direction) => {
          target.durationSeconds = Math.max(0, (minutes + direction) * 60);
          saveNow();
          paintDuration();
        },
        onPick: () =>
          openNumberPad({
            title: "Duration (minutes)",
            value: minutes,
            max: 180,
            onSet: (value) => {
              target.durationSeconds = Math.max(0, Math.round(value) * 60);
              saveNow();
              paintDuration();
            },
          }),
      })
    );
  }

  function openMore() {
    menuSheet({
      title: target.name || "Exercise",
      items: [
        !isStage
          ? {
              label: "Exercise history",
              icon: "history",
              onSelect: () => router.go(router.paths.exerciseHistory(target.id)),
            }
          : null,
        !isStage
          ? {
              label: "Duplicate",
              icon: "copy",
              onSelect: () => {
                const copy = makeExercise({ ...target, name: `${target.name} copy`, sortOrder: workout.exercises.length });
                workout.exercises.push(copy);
                saveWorkout(workout);
                toast("Exercise duplicated");
                router.go(router.paths.exerciseEditor(workout.id, copy.id));
              },
            }
          : null,
        {
          label: isStage ? `Remove the ${itemId === "warmup" ? "warm-up" : "cool-down"}` : "Delete exercise",
          icon: "trash",
          onSelect: () =>
            confirmSheet({
              title: isStage ? "Remove this stage?" : `Delete ${target.name || "this exercise"}?`,
              message: "Past sessions in History keep their own copy and are not affected.",
              confirmLabel: "Delete",
              onConfirm: () => {
                if (isStage) workout[itemId] = null;
                else workout.exercises = workout.exercises.filter((e) => e.id !== target.id);
                saveWorkout(workout);
                router.go(router.paths.workoutEditor(workout.id), { replace: true });
              },
            }),
        },
      ],
    });
  }

  fill(
    root,
    header({
      title: isStage ? (itemId === "warmup" ? "Warm-up" : "Cool-down") : "Exercise",
      left: backButton(() => router.back(router.paths.workoutEditor(workoutId))),
      right: iconButton("more", "Options", openMore),
    }),
    h(
      "div",
      { class: "screen-body" },
      h("div", { class: "field" }, h("div", { class: "field-label", text: "Name" }), nameInput),
      slots.image,
      isStage ? slots.duration : null,
      isStage ? null : slots.sets,
      isStage ? null : slots.reps,
      isStage ? null : slots.weight,
      isStage ? null : slots.increment,
      isStage ? null : slots.rest,
      h(
        "div",
        { class: "field" },
        h("div", { class: "field-label", text: "Instructions" }),
        instructionsInput,
        h("p", { class: "field-hint", text: "Technique and setup. Shown on the workout screen." })
      ),
      h(
        "div",
        { class: "field" },
        h("div", { class: "field-label", text: "Notes" }),
        notesInput,
        h("p", { class: "field-hint", text: "Permanent notes. Notes about a single session are added during the workout." })
      ),
      fileInput,
      h("button", {
        class: "btn btn-primary btn-block btn-lg",
        type: "button",
        text: "Done",
        onclick: () => {
          saveNow();
          router.go(router.paths.workoutEditor(workoutId));
        },
      })
    )
  );

  paintImage();
  if (isStage) paintDuration();
  else {
    paintSets();
    paintReps();
    paintWeight();
    paintIncrement();
    paintRest();
  }

  return { el: root };
}

function textInput(value, placeholder, onInput) {
  const input = h("input", { class: "input", type: "text", placeholder, "aria-label": placeholder });
  input.value = value || "";
  input.addEventListener("input", () => onInput(input.value));
  return input;
}

function textArea(value, placeholder, onInput) {
  const area = h("textarea", { class: "textarea", placeholder, "aria-label": placeholder, rows: "4" });
  area.value = value || "";
  area.addEventListener("input", () => onInput(area.value));
  return area;
}
