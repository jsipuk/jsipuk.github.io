// Logging another activity — a swim, a class, a game of five-a-side.
//
// This is deliberately the smallest thing that works: what it was, how long,
// how hard, when, and an optional note. No tracking, no guidance, no analysis.
// The whole point is that it takes a few seconds and then gets out of the way.
import { h, fill, icon, toDateTimeLocal, fromDateTimeLocal } from "../js/utils.js";
import { ACTIVITY_TYPES, activityLabel, makeActivity } from "../js/models.js";
import { state, saveActivity, updateSettings } from "../js/state.js";
import { openSheet, openNumberPad, stepper, chipRow, toast } from "./controls.js";
import { createEffortRating } from "./rating.js";

const DURATION_STEP = 5;

/**
 * @param {object} options
 * @param {object|null} [options.activity] an existing record to edit
 * @param {(activity: object) => void} [options.onSaved]
 */
export function openActivitySheet({ activity = null, onSaved } = {}) {
  const editing = Boolean(activity);
  const draft = editing
    ? { ...activity }
    : makeActivity({
        // Repeat logging is quicker if the last choice is already selected.
        activityType: state.settings.lastActivityType || null,
        startedAt: new Date().toISOString(),
        durationMinutes: 30,
      });

  const typeSlot = h("div");
  const durationSlot = h("div");
  let saveButton;

  const whenInput = h("input", {
    class: "input",
    type: "datetime-local",
    "aria-label": "Date and time",
  });
  whenInput.value = toDateTimeLocal(draft.startedAt);
  whenInput.addEventListener("change", () => {
    const iso = fromDateTimeLocal(whenInput.value);
    if (iso) draft.startedAt = iso;
    else whenInput.value = toDateTimeLocal(draft.startedAt); // ignore a cleared field
  });

  const noteInput = h("input", {
    class: "input",
    type: "text",
    placeholder: "Optional note",
    "aria-label": "Note",
  });
  noteInput.value = draft.note || "";

  const rating = createEffortRating({
    value: draft.difficulty,
    onChange: (value) => {
      draft.difficulty = value;
    },
  });

  function paintTypes() {
    fill(
      typeSlot,
      h("div", { class: "field-label", text: "Activity" }),
      chipRow({
        label: "Activity type",
        options: ACTIVITY_TYPES,
        value: draft.activityType,
        onChange: (value) => {
          draft.activityType = value;
          paintTypes();
          if (saveButton) saveButton.disabled = false;
          hint.hidden = true;
        },
      })
    );
  }

  function paintDuration() {
    fill(
      durationSlot,
      stepper({
        label: "Duration (minutes)",
        value: draft.durationMinutes,
        onStep: (direction) => {
          draft.durationMinutes = Math.max(1, draft.durationMinutes + direction * DURATION_STEP);
          paintDuration();
        },
        onPick: () =>
          openNumberPad({
            title: "Duration (minutes)",
            value: draft.durationMinutes,
            max: 600,
            onSet: (value) => {
              draft.durationMinutes = Math.max(1, Math.round(value));
              paintDuration();
            },
          }),
      })
    );
  }

  const hint = h("p", {
    class: "field-hint",
    text: "Choose an activity above to save.",
    hidden: Boolean(draft.activityType),
  });

  openSheet({
    title: editing ? "Edit activity" : "Log other activity",
    build: () =>
      h(
        "div",
        {},
        typeSlot,
        durationSlot,
        h("div", { class: "field" }, h("div", { class: "field-label", text: "When" }), whenInput),
        h(
          "div",
          { class: "field" },
          h("div", { class: "field-label", text: "How hard did it feel?" }),
          rating.el
        ),
        h("div", { class: "field" }, h("div", { class: "field-label", text: "Note" }), noteInput)
      ),
    // Save stays visible however far the form is scrolled.
    buildFooter: (close) => {
      saveButton = h("button", {
        class: "btn btn-primary btn-block btn-lg",
        type: "button",
        text: editing ? "Save changes" : "Save activity",
        disabled: !draft.activityType,
        onclick: () => {
          draft.note = noteInput.value.trim();
          saveActivity(draft);
          if (!editing) updateSettings({ lastActivityType: draft.activityType });
          close();
          onSaved?.(draft);
          if (!editing) {
            toast(`${activityLabel(draft.activityType)} logged`, {
              actionLabel: "View",
              onAction: () => {
                location.hash = `#/activity/${draft.id}`;
              },
            });
          }
        },
      });
      return h("div", {}, saveButton, hint);
    },
  });

  paintTypes();
  paintDuration();
}

/** The button that opens it, used on Today. */
export function logActivityButton(onSaved) {
  return h(
    "button",
    {
      class: "btn btn-quiet btn-block log-activity",
      type: "button",
      onclick: () => openActivitySheet({ onSaved }),
    },
    icon("plus", 20),
    "Log other activity"
  );
}
