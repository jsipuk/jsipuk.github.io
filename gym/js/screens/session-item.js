// Router entry for one item in the workout: an exercise, or the warm-up /
// cool-down stage screens (which share the same chrome but log nothing).
import { h, fill, icon, formatMinutes } from "../utils.js";
import { itemStatus } from "../models.js";
import { subscribe } from "../state.js";
import * as session from "../session.js";
import * as router from "../router.js";
import { header, iconButton } from "../../components/header.js";
import { imageEl, PLACEHOLDERS } from "../../components/image.js";
import { createExerciseScreen } from "../../components/exercise-screen.js";
import { openQuickMenu } from "../../components/workout-menu.js";
import { createRestPanel } from "../../components/rest-timer.js";
import { textSheet, toast, menuSheet } from "../../components/controls.js";

export function render({ itemId }) {
  const current = session.getSession();
  if (!current) {
    router.go(router.paths.today(), { replace: true });
    return { el: h("div") };
  }
  const item = session.getItem(itemId);
  if (!item) {
    router.go(router.paths.sessionOverview(), { replace: true });
    return { el: h("div") };
  }

  // Remember where the user is so Resume returns to this exact screen.
  session.setCurrentItem(itemId);

  return item.type === "exercise" ? createExerciseScreen(itemId) : createStageScreen(itemId);
}

/** Warm-up and cool-down: read it, do it, tick it off. */
function createStageScreen(itemId) {
  const root = h("div", { class: "screen" });
  const rest = createRestPanel();
  const unsubscribe = subscribe(() => update());

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

  function complete() {
    const current = item();
    session.completeStage(itemId);
    toast(`${current.name} done`, {
      actionLabel: "Undo",
      onAction: () => session.undoStage(itemId),
    });
    goNext();
  }

  function openNote() {
    const current = item();
    textSheet({
      title: "Today's note",
      label: `Notes about the ${current.name.toLowerCase()} today`,
      value: current.sessionNote,
      multiline: true,
      onSave: (value) => session.setSessionNote(itemId, value.trim()),
    });
  }

  function update() {
    const current = item();
    if (!current) return;
    const done = itemStatus(current) === "complete";
    const label = current.type === "warmup" ? "Warm up" : "Cool down";

    fill(
      root,
      header({
        title: label,
        left: iconButton("menu", "Workout menu", openQuickMenu),
        right: iconButton("more", "More options", () =>
          menuSheet({
            title: current.name,
            items: [
              { label: current.sessionNote ? "Edit today's note" : "Add a note", icon: "note", onSelect: openNote },
              {
                label: "Skip and return later",
                icon: "skip",
                onSelect: () => {
                  toast(`${current.name} left for later`);
                  goNext();
                },
              },
              done
                ? {
                    label: "Mark as not done",
                    icon: "close",
                    onSelect: () => session.undoStage(itemId),
                  }
                : null,
            ],
          })
        ),
      }),
      h(
        "div",
        { class: "ex-body" },
        h("h1", { class: "ex-title", text: current.name }),
        h(
          "div",
          { class: "ex-figure" },
          imageEl(current.image, {
            alt: `${current.name} image`,
            placeholder: current.type === "warmup" ? PLACEHOLDERS.warmup : PLACEHOLDERS.cooldown,
          })
        ),
        h(
          "div",
          { class: "ex-meta" },
          h("div", { class: "stage-duration", text: formatMinutes(current.durationSeconds || 0) }),
          done ? h("span", { class: "pill pill-success", text: "✓ Complete" }) : null
        ),
        current.instructions
          ? h(
              "div",
              {},
              h("div", { class: "field-label", text: "Instructions" }),
              h("div", { class: "stage-instructions", text: current.instructions })
            )
          : null,
        current.exerciseNotes
          ? h(
              "div",
              {},
              h("div", { class: "field-label", text: "Notes" }),
              h("div", { class: "stage-instructions", text: current.exerciseNotes })
            )
          : null,
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
      ),
      h(
        "div",
        { class: "ex-actions" },
        rest.el,
        done
          ? h("button", {
              class: "btn btn-success btn-block btn-lg",
              type: "button",
              text: nextLabel(),
              onclick: goNext,
            })
          : h("button", {
              class: "btn btn-primary btn-block btn-lg",
              type: "button",
              text: `Complete ${current.name.toLowerCase()}`,
              onclick: complete,
            }),
        h(
          "div",
          { class: "nav-row" },
          h("button", { class: "btn btn-outline", type: "button", onclick: goPrevious }, icon("back"), "Previous"),
          h("button", { class: "btn btn-outline", type: "button", onclick: goNext }, "Next", icon("forward"))
        )
      )
    );
    rest.update();
  }

  function nextLabel() {
    const nextId = session.nextItemId(itemId);
    const next = nextId ? session.getItem(nextId) : null;
    return next ? `Next: ${next.name}` : "Finish workout";
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
