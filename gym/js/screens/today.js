// Today — the opening screen. One job: start training in as few taps as possible.
import { h, fill, icon, formatDuration, relativeDay, formatLongDate } from "../utils.js";
import { sessionCounts, DIFFICULTY_WORDS, makeWorkout } from "../models.js";
import { state, subscribe, saveWorkout, updateSettings } from "../state.js";
import * as session from "../session.js";
import * as router from "../router.js";
import { header } from "../../components/header.js";
import { menuSheet, emptyState, toast } from "../../components/controls.js";
import { logActivityButton } from "../../components/activity-sheet.js";
import { PLACEHOLDERS } from "../../components/image.js";

export function render() {
  const root = h("div", { class: "screen" });
  const unsubscribe = subscribe(() => update());

  function selectedWorkout() {
    const { selectedWorkoutId } = state.settings;
    return state.workouts.find((w) => w.id === selectedWorkoutId) || state.workouts[0] || null;
  }

  function start(workout) {
    session.startWorkout(workout.id);
    updateSettings({ selectedWorkoutId: workout.id });
    router.go(router.paths.sessionOverview());
  }

  function pickWorkout() {
    menuSheet({
      title: "Choose a workout",
      items: [
        ...state.workouts.map((workout) => ({
          label: workout.name,
          hint: planLine(workout),
          icon: "dumbbell",
          onSelect: () => updateSettings({ selectedWorkoutId: workout.id }),
        })),
        {
          label: "Manage workouts",
          icon: "edit",
          onSelect: () => router.go(router.paths.workouts()),
        },
      ],
    });
  }

  function createFirstWorkout() {
    const workout = makeWorkout("Workout A");
    saveWorkout(workout);
    updateSettings({ selectedWorkoutId: workout.id });
    router.go(router.paths.workoutEditor(workout.id));
  }

  function update() {
    const workout = selectedWorkout();
    const active = session.getSession();
    const lastSession = state.sessions[0] || null;

    fill(
      root,
      header({
        plain: true,
        left: h("span"),
        right: h("span"),
        title: "",
      }),
      h(
        "div",
        { class: "screen-body" },
        h(
          "div",
          { class: "today-hero" },
          h("img", { src: "assets/icons/icon-192.png", alt: "", width: "34", height: "34" }),
          h(
            "div",
            {},
            h("h1", { text: "Gym by John" }),
            h("div", { class: "today-date", text: formatLongDate(new Date().toISOString()) })
          )
        ),

        active ? resumeCard(active) : null,

        workout
          ? h(
              "section",
              { class: "card card-pad today-card" },
              h("div", { class: "field-label", text: active ? "Or start something else" : "Today's workout" }),
              h("h2", { text: workout.name }),
              h("div", { class: "plan-line", text: planLine(workout) }),
              workout.description ? h("p", { class: "row-sub", text: workout.description }) : null,
              h(
                "div",
                { class: "today-actions" },
                h("button", {
                  class: `btn btn-block btn-lg ${active ? "btn-outline" : "btn-primary"}`,
                  type: "button",
                  text: active ? `Start ${workout.name} instead` : "Start workout",
                  onclick: () => {
                    if (!workout.exercises.length) {
                      toast("Add an exercise to this workout first");
                      router.go(router.paths.workoutEditor(workout.id));
                      return;
                    }
                    if (!active) return start(workout);
                    toast("Finish or discard the workout in progress first", {
                      actionLabel: "Resume",
                      onAction: () => router.go(router.paths.sessionOverview()),
                    });
                  },
                }),
                h(
                  "div",
                  { class: "btn-row" },
                  h("button", { class: "btn btn-outline", type: "button", text: "Change", onclick: pickWorkout }),
                  h("button", {
                    class: "btn btn-outline",
                    type: "button",
                    text: "Edit",
                    onclick: () => router.go(router.paths.workoutEditor(workout.id)),
                  })
                )
              )
            )
          : emptyState({
              image: PLACEHOLDERS.empty,
              title: "No workouts yet",
              message: "Create your first workout, add your exercises, and you are ready to train.",
              action: h("button", {
                class: "btn btn-primary btn-lg",
                type: "button",
                text: "Create a workout",
                onclick: createFirstWorkout,
              }),
            }),

        // Secondary to Start Workout, and deliberately quiet: this app is a
        // gym companion first, and other activities are just record-keeping.
        logActivityButton(),

        lastSession ? lastSessionCard(lastSession) : null
      )
    );
  }

  function resumeCard(active) {
    const counts = sessionCounts(active);
    const currentItem = active.currentItemId ? session.getItem(active.currentItemId) : null;
    return h(
      "section",
      { class: "card card-pad today-card", style: { borderColor: "var(--primary)" } },
      h(
        "div",
        { class: "resume-note" },
        icon("timer", 18),
        `In progress · started ${new Date(active.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
      ),
      h("h2", { text: active.workoutName }),
      h("div", {
        class: "plan-line",
        text: `${counts.itemsDone} of ${counts.itemTotal} done${currentItem ? ` · you were on ${currentItem.name}` : ""}`,
      }),
      h(
        "div",
        { class: "today-actions" },
        h("button", {
          class: "btn btn-primary btn-block btn-lg",
          type: "button",
          text: "Resume workout",
          onclick: () =>
            router.go(
              active.currentItemId
                ? router.paths.sessionItem(active.currentItemId)
                : router.paths.sessionOverview()
            ),
        }),
        h("button", {
          class: "btn btn-outline btn-block",
          type: "button",
          text: "Workout overview",
          onclick: () => router.go(router.paths.sessionOverview()),
        })
      )
    );
  }

  function lastSessionCard(last) {
    const counts = last.summary || sessionCounts(last);
    return h(
      "section",
      {},
      h("div", { class: "group-label", text: "Last session" }),
      h(
        "button",
        {
          class: "row",
          type: "button",
          onclick: () => router.go(router.paths.historyDetail(last.id)),
        },
        h(
          "span",
          { class: "row-main" },
          h("span", { class: "row-title", text: last.workoutName }),
          h("span", {
            class: "row-sub",
            text: [
              relativeDay(last.startedAt),
              formatDuration(last.durationSeconds || 0),
              `${counts.setsDone} ${counts.setsDone === 1 ? "set" : "sets"}`,
              last.difficulty ? `${DIFFICULTY_WORDS[last.difficulty]} (${last.difficulty}/5)` : null,
            ]
              .filter(Boolean)
              .join(" · "),
          })
        ),
        h("span", { class: "row-chev" }, icon("forward"))
      )
    );
  }

  update();
  return { el: root, destroy: unsubscribe };
}

function planLine(workout) {
  const parts = [];
  if (workout.warmup) parts.push("1 warm-up");
  parts.push(`${workout.exercises.length} ${workout.exercises.length === 1 ? "exercise" : "exercises"}`);
  if (workout.cooldown) parts.push("1 cool-down");
  return parts.join(" · ");
}
