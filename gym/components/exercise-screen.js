// The active exercise screen — the one the user glances at between sets.
// Everything needed mid-set is on screen at once: name, picture, target,
// which set they are on, weight, reps, Complete Set, and Previous / Next.
import { h, fill, icon, formatNumber, formatDate, haptic } from "../js/utils.js";
import { itemStatus, targetText, currentSetNumber } from "../js/models.js";
import { state, subscribe } from "../js/state.js";
import * as session from "../js/session.js";
import * as router from "../js/router.js";
import { header, iconButton } from "./header.js";
import { imageEl, openImageViewer, PLACEHOLDERS } from "./image.js";
import { createRestPanel } from "./rest-timer.js";
import { openQuickMenu } from "./workout-menu.js";
import {
  openNumberPad,
  stepper,
  openSheet,
  menuSheet,
  textSheet,
  toast,
  confirmSheet,
} from "./controls.js";

export function createExerciseScreen(itemId) {
  const root = h("div", { class: "screen" });
  const body = h("div", { class: "ex-body" });
  const actions = h("div", { class: "ex-actions" });
  const rest = createRestPanel();

  const unsubscribe = subscribe(() => update());
  let touchStartX = 0;
  let touchStartY = 0;

  // Swipe is a convenience only; the buttons below remain authoritative.
  body.addEventListener("touchstart", (event) => {
    touchStartX = event.changedTouches[0].clientX;
    touchStartY = event.changedTouches[0].clientY;
  }, { passive: true });
  body.addEventListener("touchend", (event) => {
    const dx = event.changedTouches[0].clientX - touchStartX;
    const dy = event.changedTouches[0].clientY - touchStartY;
    if (Math.abs(dx) < 70 || Math.abs(dy) > 50) return;
    if (dx < 0) goNext();
    else goPrevious();
  }, { passive: true });

  function item() {
    return session.getItem(itemId);
  }

  function goNext() {
    const next = session.nextItemId(itemId);
    if (next) router.go(router.paths.sessionItem(next));
    else router.go(router.paths.sessionFinish());
  }

  function goPrevious() {
    const previous = session.prevItemId(itemId);
    if (previous) router.go(router.paths.sessionItem(previous));
    else router.go(router.paths.sessionOverview());
  }

  function update() {
    const current = item();
    if (!current) return;
    const status = itemStatus(current);
    const position = session.exercisePosition(itemId);
    const setNumber = currentSetNumber(current);
    const unit = state.session?.unit || state.settings.unit;

    fill(
      root,
      header({
        title: position ? `${position.index} of ${position.total}` : current.name,
        subtitle: position ? "Exercise" : "",
        left: iconButton("menu", "Workout menu", openQuickMenu),
        right: h(
          "div",
          { style: { display: "flex" } },
          iconButton("info", "Technique and notes", openInfo),
          iconButton("more", "More options", openMore)
        ),
      }),
      body,
      actions
    );

    fill(
      body,
      h("h1", { class: "ex-title", text: current.name }),
      h(
        "button",
        {
          class: "ex-figure",
          type: "button",
          "aria-label": "View the exercise image larger",
          onclick: openViewer,
        },
        imageEl(current.image, {
          alt: `${current.name} guide image`,
          placeholder: PLACEHOLDERS.exercise,
          name: current.name,
        }),
        h("span", { class: "expand-hint" }, icon("expand"))
      ),
      h(
        "div",
        { class: "ex-meta" },
        h(
          "div",
          { class: "ex-target" },
          "Target ",
          h("strong", { text: targetText(current) })
        ),
        lastTimeButton(current)
      ),
      h(
        "div",
        { class: "ex-meta" },
        h("div", {
          class: "set-line",
          text:
            status === "complete"
              ? `${current.sets.length} of ${current.targetSets} sets done`
              : `Set ${setNumber} of ${current.targetSets}`,
        }),
        status === "complete" ? h("span", { class: "pill pill-success", text: "✓ Complete" }) : null
      ),
      current.sets.length ? setHistory(current, unit) : null,
      stepper({
        label: "Weight",
        value: current.draft.weight,
        unit,
        onStep: (direction) => session.stepWeight(itemId, direction),
        onPick: () =>
          openNumberPad({
            title: "Weight",
            value: current.draft.weight,
            unit,
            allowDecimal: true,
            onSet: (value) => session.setDraft(itemId, { weight: value }),
          }),
      }),
      stepper({
        label: "Reps",
        value: current.draft.reps,
        onStep: (direction) => session.stepReps(itemId, direction),
        onPick: () =>
          openNumberPad({
            title: "Reps",
            value: current.draft.reps,
            max: 999,
            onSet: (value) => session.setDraft(itemId, { reps: Math.round(value) }),
          }),
      }),
      current.sessionNote
        ? h(
            "button",
            { class: "row", type: "button", onclick: openNote },
            h("span", { class: "row-chev" }, icon("note")),
            h(
              "span",
              { class: "row-main" },
              h("span", { class: "row-sub", text: "Today's note" }),
              h("span", { class: "row-title", text: current.sessionNote })
            )
          )
        : null
    );
    rest.update();

    const nextId = session.nextItemId(itemId);
    const nextItem = nextId ? session.getItem(nextId) : null;

    fill(
      actions,
      rest.el,
      status === "complete"
        ? h("button", {
            class: "btn btn-success btn-block btn-lg",
            type: "button",
            text: nextItem ? `Next: ${nextItem.name}` : "Finish workout",
            onclick: goNext,
          })
        : h("button", {
            class: "btn btn-primary btn-block btn-lg",
            type: "button",
            text: `Complete set ${setNumber}`,
            onclick: onCompleteSet,
          }),
      h(
        "div",
        { class: "nav-row" },
        h(
          "button",
          { class: "btn btn-outline", type: "button", onclick: goPrevious },
          icon("back"),
          "Previous"
        ),
        h(
          "button",
          { class: "btn btn-outline", type: "button", onclick: goNext },
          "Next",
          icon("forward")
        )
      )
    );
  }

  function onCompleteSet() {
    const current = item();
    if (!current) return;
    haptic([14, 40, 14]);
    const record = session.completeSet(itemId);
    const nowComplete = itemStatus(item()) === "complete";
    toast(
      nowComplete
        ? `${current.name} complete`
        : `Set ${record.setNumber} logged · ${formatNumber(record.weight)} ${record.unit} × ${record.reps}`,
      {
        actionLabel: "Undo",
        onAction: () => session.undoLastSet(itemId),
      }
    );
  }

  function setHistory(current, unit) {
    const wrap = h("div", { class: "set-history", role: "list" });
    for (const record of current.sets) {
      wrap.append(
        h(
          "button",
          {
            class: "set-chip",
            type: "button",
            role: "listitem",
            "aria-label": `Set ${record.setNumber}: ${formatNumber(record.weight)} ${record.unit} for ${record.reps} reps. Tap to correct.`,
            onclick: () => editSet(record),
          },
          icon("check", 15),
          `${formatNumber(record.weight)} ${record.unit} × ${record.reps}`
        )
      );
    }
    return wrap;
  }

  function editSet(record) {
    let weight = record.weight;
    let reps = record.reps;
    openSheet({
      title: `Set ${record.setNumber}`,
      build: (close) => {
        const wrap = h("div");
        const paint = () => {
          fill(
            wrap,
            stepper({
              label: "Weight",
              value: weight,
              unit: record.unit,
              onStep: (direction) => {
                const step = item().weightIncrement || 2.5;
                weight = Math.max(0, Number((weight + direction * step).toFixed(2)));
                paint();
              },
              onPick: () =>
                openNumberPad({
                  title: "Weight",
                  value: weight,
                  unit: record.unit,
                  allowDecimal: true,
                  onSet: (value) => {
                    weight = value;
                    paint();
                  },
                }),
            }),
            stepper({
              label: "Reps",
              value: reps,
              onStep: (direction) => {
                reps = Math.max(0, reps + direction);
                paint();
              },
              onPick: () =>
                openNumberPad({
                  title: "Reps",
                  value: reps,
                  max: 999,
                  onSet: (value) => {
                    reps = Math.round(value);
                    paint();
                  },
                }),
            }),
            h("button", {
              class: "btn btn-primary btn-block btn-lg",
              type: "button",
              text: "Save set",
              onclick: () => {
                session.updateSet(itemId, record.setNumber, { weight, reps });
                close();
              },
            }),
            h("button", {
              class: "btn btn-danger btn-block",
              type: "button",
              text: "Remove this set",
              onclick: () => {
                const index = record.setNumber - 1;
                const removed = session.removeSet(itemId, record.setNumber);
                close();
                toast("Set removed", {
                  actionLabel: "Undo",
                  onAction: () => session.restoreSet(itemId, removed, index),
                });
              },
            })
          );
        };
        paint();
        return wrap;
      },
    });
  }

  /* Rule 8: previous performance is one tap away, never in the way. */
  function lastTimeButton(current) {
    const previous = session.lastPerformance(current.id, { excludeSessionId: state.session?.id });
    return h(
      "button",
      {
        class: "pill pill-btn",
        type: "button",
        onclick: () => openLastTime(previous),
        "aria-label": previous ? "Show what you did last time" : "No previous record for this exercise",
      },
      icon("history", 15),
      "Last time"
    );
  }

  function openLastTime(previous) {
    openSheet({
      title: "Last time",
      build: () =>
        previous
          ? h(
              "div",
              {},
              h("p", {
                class: "row-sub",
                text: `${formatDate(previous.session.startedAt, { withYear: true })} · ${previous.session.workoutName}`,
              }),
              h(
                "div",
                { class: "set-history", style: { marginTop: "12px" } },
                previous.item.sets.map((record) =>
                  h(
                    "span",
                    { class: "set-chip" },
                    icon("check", 15),
                    `${formatNumber(record.weight)} ${record.unit || previous.session.unit} × ${record.reps}`
                  )
                )
              ),
              previous.item.sessionNote
                ? h(
                    "div",
                    { style: { marginTop: "16px" } },
                    h("div", { class: "field-label", text: "Note" }),
                    h("div", { class: "note-block", text: previous.item.sessionNote })
                  )
                : null,
              h("div", { style: { height: "16px" } }),
              h("button", {
                class: "btn btn-outline btn-block",
                type: "button",
                text: "All history for this exercise",
                onclick: () => router.go(router.paths.exerciseHistory(itemId)),
              })
            )
          : h("p", { text: "No record yet. Complete a set and it will show up here next time." }),
    });
  }

  function openViewer() {
    const current = item();
    openImageViewer({ ref: current.image, name: current.name, placeholder: PLACEHOLDERS.exercise });
  }

  function openInfo() {
    const current = item();
    openSheet({
      title: current.name,
      build: () =>
        h(
          "div",
          {},
          section("Technique", current.instructions, "No technique notes yet. Add them in the workout editor."),
          section("Exercise notes", current.exerciseNotes, "No saved notes for this exercise."),
          section("Today's note", current.sessionNote, "Nothing noted today."),
          h("div", { style: { height: "12px" } }),
          h("button", {
            class: "btn btn-outline btn-block",
            type: "button",
            text: current.sessionNote ? "Edit today's note" : "Add a note for today",
            onclick: openNote,
          })
        ),
    });
  }

  function section(title, text, fallback) {
    return h(
      "div",
      { style: { marginBottom: "16px" } },
      h("div", { class: "field-label", text: title }),
      text
        ? h("div", { class: "note-block", text })
        : h("p", { class: "row-sub", text: fallback })
    );
  }

  function openNote() {
    const current = item();
    textSheet({
      title: "Today's note",
      label: `Notes about ${current.name} today`,
      value: current.sessionNote,
      multiline: true,
      placeholder: "Last few reps were difficult…",
      onSave: (value) => session.setSessionNote(itemId, value.trim()),
    });
  }

  /* Session-only changes (spec §28). None of this edits the saved plan. */
  function openMore() {
    const current = item();
    menuSheet({
      title: "This exercise, today",
      items: [
        {
          label: "Add a set",
          hint: `Makes it ${current.targetSets + 1} sets today`,
          icon: "add",
          onSelect: () => {
            session.addSetToday(itemId);
            toast(`${current.name}: ${current.targetSets + 1} sets today`);
          },
        },
        {
          label: "Change target today",
          hint: targetText(current),
          icon: "edit",
          onSelect: openTargetSheet,
        },
        {
          label: current.sessionNote ? "Edit today's note" : "Add a note",
          icon: "note",
          onSelect: openNote,
        },
        {
          label: "Skip and return later",
          hint: "Jumps to the next item, keeps your place here",
          icon: "skip",
          onSelect: () => {
            const next = session.nextItemId(itemId);
            toast(`${current.name} left for later`);
            if (next) router.go(router.paths.sessionItem(next));
            else router.go(router.paths.sessionOverview());
          },
        },
        current.sets.length
          ? {
              label: "Clear the sets I logged here",
              icon: "trash",
              onSelect: () =>
                confirmSheet({
                  title: "Clear logged sets?",
                  message: `This removes the ${current.sets.length} set${current.sets.length === 1 ? "" : "s"} recorded for ${current.name} today.`,
                  confirmLabel: "Clear sets",
                  onConfirm: () => {
                    const removed = [...current.sets];
                    while (item().sets.length) session.removeSet(itemId, item().sets[0].setNumber);
                    toast("Sets cleared", {
                      actionLabel: "Undo",
                      onAction: () => removed.forEach((record, index) => session.restoreSet(itemId, record, index)),
                    });
                  },
                }),
            }
          : null,
        {
          label: "Exercise history",
          icon: "history",
          onSelect: () => router.go(router.paths.exerciseHistory(itemId)),
        },
      ],
    });
  }

  function openTargetSheet() {
    const current = item();
    let sets = current.targetSets;
    let reps = current.targetReps;
    openSheet({
      title: "Change target today",
      build: (close) => {
        const wrap = h("div");
        const paint = () => {
          fill(
            wrap,
            stepper({
              label: "Sets",
              value: sets,
              onStep: (direction) => {
                sets = Math.max(Math.max(1, current.sets.length), sets + direction);
                paint();
              },
              onPick: () =>
                openNumberPad({
                  title: "Sets",
                  value: sets,
                  max: 20,
                  onSet: (value) => {
                    sets = Math.max(1, Math.round(value));
                    paint();
                  },
                }),
            }),
            stepper({
              label: "Target reps",
              value: reps,
              onStep: (direction) => {
                reps = Math.max(1, reps + direction);
                paint();
              },
              onPick: () =>
                openNumberPad({
                  title: "Target reps",
                  value: reps,
                  max: 999,
                  onSet: (value) => {
                    reps = Math.max(1, Math.round(value));
                    paint();
                  },
                }),
            }),
            h("p", { class: "field-hint", text: "Only for today. The saved workout keeps its own targets." }),
            h("div", { style: { height: "12px" } }),
            h("button", {
              class: "btn btn-primary btn-block btn-lg",
              type: "button",
              text: "Use these today",
              onclick: () => {
                session.setTargetToday(itemId, { sets, reps });
                close();
              },
            })
          );
        };
        paint();
        return wrap;
      },
    });
  }

  update();
  return {
    el: root,
    destroy() {
      unsubscribe();
      rest.destroy();
    },
  };
}
