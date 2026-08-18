// Workout overview — shown straight after Start Workout, and reachable from
// the menu button at any time. Nothing here starts an exercise by accident.
import { h, fill, icon, formatDuration } from "../utils.js";
import { sessionCounts, sessionDurationSeconds } from "../models.js";
import { subscribe } from "../state.js";
import * as session from "../session.js";
import * as router from "../router.js";
import { header, iconButton } from "../../components/header.js";
import { workoutItemList } from "../../components/workout-menu.js";
import { menuSheet, confirmSheet, toast } from "../../components/controls.js";

export function render() {
  const current = session.getSession();
  if (!current) {
    router.go(router.paths.today(), { replace: true });
    return { el: h("div") };
  }

  const root = h("div", { class: "screen" });
  const unsubscribe = subscribe(() => update());

  function update() {
    const live = session.getSession();
    if (!live) return;
    const counts = sessionCounts(live);
    const nextId = session.firstUnfinishedItemId();
    const nextItem = nextId ? session.getItem(nextId) : null;
    const started = counts.itemsDone > 0;

    fill(
      root,
      header({
        title: live.workoutName,
        subtitle: "Today's workout",
        left: iconButton("close", "Leave workout (it keeps running)", () => router.go(router.paths.today())),
        right: iconButton("more", "Workout options", openMore),
      }),
      h(
        "div",
        { class: "screen-body" },
        h(
          "div",
          { class: "last-session" },
          stat(formatDuration(sessionDurationSeconds(live)), "Elapsed"),
          stat(`${counts.exerciseDone}/${counts.exerciseTotal}`, "Exercises"),
          stat(String(counts.setsDone), "Sets")
        ),
        workoutItemList({
          onSelect: (itemId) => router.go(router.paths.sessionItem(itemId)),
        })
      ),
      h(
        "div",
        { class: "ex-actions" },
        nextItem
          ? h("button", {
              class: "btn btn-primary btn-block btn-lg",
              type: "button",
              text: started ? `Continue: ${nextItem.name}` : startLabel(nextItem),
              onclick: () => router.go(router.paths.sessionItem(nextItem.id)),
            })
          : h("button", {
              class: "btn btn-success btn-block btn-lg",
              type: "button",
              text: "Finish workout",
              onclick: () => router.go(router.paths.sessionFinish()),
            }),
        counts.itemsDone > 0 && nextItem
          ? h("button", {
              class: "btn btn-outline btn-block",
              type: "button",
              text: "Finish workout now",
              onclick: () => router.go(router.paths.sessionFinish()),
            })
          : null
      )
    );
  }

  function startLabel(item) {
    if (item.type === "warmup") return "Start warm-up";
    if (item.type === "cooldown") return "Start cool-down";
    return `Start: ${item.name}`;
  }

  function openMore() {
    menuSheet({
      title: "Workout options",
      items: [
        {
          label: "Finish and save",
          icon: "check",
          onSelect: () => router.go(router.paths.sessionFinish()),
        },
        {
          label: "Leave it running",
          hint: "Come back with Resume Workout",
          icon: "home",
          onSelect: () => router.go(router.paths.today()),
        },
        {
          label: "Discard this workout",
          hint: "Nothing is saved to history",
          icon: "trash",
          onSelect: () =>
            confirmSheet({
              title: "Discard this workout?",
              message: "Everything logged today will be thrown away. This cannot be undone.",
              confirmLabel: "Discard workout",
              onConfirm: async () => {
                await session.discardSession();
                toast("Workout discarded");
                router.go(router.paths.today());
              },
            }),
        },
      ],
    });
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
  return { el: root, destroy: unsubscribe };
}
