// Export and import. Import is validated in full before anything is replaced,
// so a broken file can never destroy what is already here.
import { h, fill, icon, formatDate } from "../utils.js";
import { state } from "../state.js";
import * as router from "../router.js";
import { exportBackup, readBackupFile, applyBackup, backupFilename } from "../storage.js";
import { header, backButton } from "../../components/header.js";
import { openSheet, toast } from "../../components/controls.js";

export function render() {
  const root = h("div", { class: "screen" });
  const status = h("p", { class: "group-note" });

  const fileInput = h("input", {
    type: "file",
    accept: "application/json,.json",
    class: "visually-hidden",
    onchange: async (event) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      status.textContent = "Checking the file…";
      const result = await readBackupFile(file);
      status.textContent = "";
      if (!result.ok) {
        showProblems(result.errors);
        return;
      }
      confirmImport(result);
    },
  });

  function showProblems(errors) {
    openSheet({
      title: "That backup cannot be used",
      build: () =>
        h(
          "div",
          {},
          h("p", { text: "Nothing has been changed. The file has these problems:" }),
          h(
            "ul",
            { style: { margin: "12px 0 0 18px" } },
            errors.map((message) => h("li", { text: message, style: { marginBottom: "6px" } }))
          )
        ),
    });
  }

  function confirmImport(result) {
    openSheet({
      title: "Import this backup?",
      build: (close) =>
        h(
          "div",
          {},
          h("p", {
            text: result.exportedAt
              ? `Exported ${formatDate(result.exportedAt, { withYear: true })}.`
              : "Backup file checked and readable.",
          }),
          h(
            "ul",
            { class: "list", role: "list", style: { margin: "12px 0" } },
            [
              [`${result.counts.workouts}`, "workouts"],
              [`${result.counts.sessions}`, "sessions in history"],
              [`${result.counts.images}`, "images"],
            ].map(([value, label]) =>
              h(
                "li",
                { class: "row" },
                h("span", { class: "row-main" }, h("span", { class: "row-title", text: label })),
                h("span", { class: "stat-value", text: value })
              )
            )
          ),
          h("p", {
            class: "field-hint",
            text: "This replaces everything currently on this device, including any workout in progress.",
          }),
          h("div", { style: { height: "12px" } }),
          h("button", {
            class: "btn btn-primary btn-block btn-lg",
            type: "button",
            text: "Replace my data",
            onclick: async () => {
              close();
              await applyBackup(result);
              toast("Backup restored");
              router.go(router.paths.today());
            },
          }),
          h("button", { class: "btn btn-quiet btn-block", type: "button", text: "Cancel", onclick: close })
        ),
    });
  }

  fill(
    root,
    header({
      title: "Backup and restore",
      left: backButton(() => router.back(router.paths.settings())),
    }),
    h(
      "div",
      { class: "screen-body" },
      h("div", { class: "group-label", text: "Export" }),
      h("p", {
        class: "group-note",
        text: `Saves your workouts, history, settings and images to ${backupFilename()}. On iPhone this opens the Share sheet so you can put it in Files or iCloud Drive.`,
      }),
      h(
        "button",
        {
          class: "btn btn-primary btn-block btn-lg",
          type: "button",
          onclick: async () => {
            try {
              const result = await exportBackup();
              if (result.method !== "cancelled") toast("Backup created");
            } catch (error) {
              console.error(error);
              toast("Could not create the backup");
            }
          },
        },
        icon("download"),
        "Export backup"
      ),
      h("div", { class: "group-label", text: "Import" }),
      h("p", {
        class: "group-note",
        text: "The file is checked before anything is replaced. If it is not a valid Gym by John backup, your current data is left untouched.",
      }),
      h(
        "button",
        {
          class: "btn btn-outline btn-block btn-lg",
          type: "button",
          onclick: () => fileInput.click(),
        },
        icon("upload"),
        "Choose a backup file"
      ),
      status,
      fileInput,
      h("div", { class: "group-label", text: "On this device now" }),
      h(
        "div",
        { class: "group" },
        countRow("Workouts", state.workouts.length),
        countRow("Sessions in history", state.sessions.length),
        countRow("Workout in progress", state.session ? "Yes" : "No")
      )
    )
  );

  function countRow(label, value) {
    return h(
      "div",
      { class: "row" },
      h("span", { class: "row-main" }, h("span", { class: "row-title", text: label })),
      h("span", { class: "stat-value", text: String(value) })
    );
  }

  return { el: root };
}
