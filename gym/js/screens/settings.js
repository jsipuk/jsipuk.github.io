// Settings — kept small on purpose.
import { h, fill, icon } from "../utils.js";
import { state, subscribe, updateSettings, resetEverything } from "../state.js";
import { db } from "../db.js";
import * as router from "../router.js";
import * as timer from "../timer.js";
import { header } from "../../components/header.js";
import { segmented, switchRow, confirmSheet, toast } from "../../components/controls.js";
import { APP_VERSION, supportsWakeLock } from "../app-info.js";

export function render() {
  const root = h("div", { class: "screen" });
  const unsubscribe = subscribe(() => update());

  function update() {
    const { settings } = state;

    fill(
      root,
      header({ title: "Settings" }),
      h(
        "div",
        { class: "screen-body" },
        h("div", { class: "group-label", text: "Appearance" }),
        segmented({
          label: "Appearance",
          value: settings.appearance,
          options: [
            { value: "system", label: "System" },
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
          ],
          onChange: (value) => updateSettings({ appearance: value }),
        }),

        h("div", { class: "group-label", text: "Units" }),
        segmented({
          label: "Weight unit",
          value: settings.unit,
          options: [
            { value: "kg", label: "kg" },
            { value: "lb", label: "lb" },
          ],
          onChange: (value) => updateSettings({ unit: value }),
        }),
        h("p", {
          class: "group-note",
          text: "This changes the label on new entries. Numbers you have already recorded are left exactly as they were.",
        }),

        h("div", { class: "group-label", text: "During a workout" }),
        h(
          "div",
          { class: "group" },
          switchRow({
            label: "Rest timer sound",
            hint: "A short chime when rest is over",
            checked: settings.restSound,
            onChange: (value) => {
              updateSettings({ restSound: value });
              if (value) timer.previewSound();
            },
          }),
          switchRow({
            label: "Vibration",
            hint: navigator.vibrate ? "Buzz on set completion and rest" : "Not supported by this browser",
            checked: settings.vibration,
            onChange: (value) => updateSettings({ vibration: value }),
          }),
          switchRow({
            label: "Keep the screen awake",
            hint: supportsWakeLock() ? "While a workout is running" : "Not supported by this browser",
            checked: settings.keepAwake,
            onChange: (value) => updateSettings({ keepAwake: value }),
          })
        ),

        h("div", { class: "group-label", text: "Your data" }),
        h(
          "div",
          { class: "group" },
          h(
            "button",
            { class: "row", type: "button", onclick: () => router.go(router.paths.backup()) },
            h("span", { class: "row-chev" }, icon("download")),
            h(
              "span",
              { class: "row-main" },
              h("span", { class: "row-title", text: "Backup and restore" }),
              h("span", { class: "row-sub", text: "Export or import everything as a JSON file" })
            ),
            h("span", { class: "row-chev" }, icon("forward"))
          ),
          h(
            "button",
            {
              class: "row",
              type: "button",
              onclick: () =>
                confirmSheet({
                  title: "Reset the app?",
                  message: "Every workout, session and setting on this device is deleted. Export a backup first if you might want any of it.",
                  confirmLabel: "Delete everything",
                  onConfirm: async () => {
                    await resetEverything();
                    toast("Everything deleted");
                    router.go(router.paths.today());
                  },
                }),
            },
            h("span", { class: "row-chev", style: { color: "var(--primary)" } }, icon("trash")),
            h(
              "span",
              { class: "row-main" },
              h("span", { class: "row-title", text: "Reset application", style: { color: "var(--primary)" } }),
              h("span", { class: "row-sub", text: "Delete all data on this device" })
            )
          )
        ),

        h("div", { class: "group-label", text: "About" }),
        h(
          "div",
          { class: "group" },
          infoRow("Version", APP_VERSION),
          infoRow("Storage", db.persistent ? "On this device (IndexedDB)" : "Temporary — this browser is blocking storage"),
          infoRow("Account", "None. Nothing leaves your phone.")
        ),
        h("p", {
          class: "group-note",
          text: "Gym by John works offline once installed. Add it to your Home Screen from the Share menu in Safari.",
        })
      )
    );
  }

  function infoRow(label, value) {
    return h(
      "div",
      { class: "row" },
      h("span", { class: "row-main" }, h("span", { class: "row-title", text: label })),
      h("span", { class: "row-sub", text: value })
    );
  }

  update();
  return { el: root, destroy: unsubscribe };
}
