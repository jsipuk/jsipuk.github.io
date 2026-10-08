import {
  quantity,
  exportBackup,
  importBackup,
  resetCollection,
  completion,
} from "../domain/collection.js";
import { passes } from "./binders.js";
import {
  $,
  escape,
  note,
  releaseOptions,
  langName,
  download,
  cachedReleases,
  renderAndFocus,
} from "./helpers.js";
function table(state, rows) {
  return `<table><thead><tr><th>Card</th><th>Name</th><th>Owned</th><th>Spare</th></tr></thead><tbody>${rows.map((c) => `<tr><td>${escape(c.printedNumber || c.collectorNumber)}</td><td>${escape(c.name)}</td><td>${quantity(state, c.id)}</td><td>${Math.max(0, quantity(state, c.id) - 1)}</td></tr>`).join("")}</tbody></table>`;
}
export function renderCatalogue(ctx) {
  const { state } = ctx;
  const releases = cachedReleases(state, { forEntry: false });
  let release = releases.find((r) => r.id === ctx.exportRelease) || releases[0];
  ctx.exportRelease = release?.id;
  const rows = state.reference.cards.filter(
    (c) =>
      c.releaseId === release?.id &&
      !c.retired &&
      passes(state, c, ctx.exportMode),
  );
  ctx.app.innerHTML = `<div class="form"><h1>Catalogue</h1>${note()}<div class="panel"><h2>Collection backup</h2><p>Save all quantities, variants, reference metadata and pending review. Import restores the whole collection on this device.</p><button class="primary wide" id="backup" ${ctx.hasStorageError() ? "disabled" : ""}>Download lossless backup</button><label for="import-backup">Import backup</label><input id="import-backup" type="file" accept="application/json,.json"><div id="backup-preview" aria-live="polite"></div><button class="wide" id="reset-collection" ${ctx.hasStorageError() ? "disabled" : ""}>Reset Collection</button></div><label for="export-set">Release and language</label><select id="export-set" ${!release ? "disabled" : ""}>${release ? releaseOptions(state, ctx.exportRelease, false, { forEntry: false }) : "<option>No cached checklist yet</option>"}</select><p class="muted">${escape(langName(release?.language || ""))}</p><label>Include</label><div class="chips" role="group" aria-label="Catalogue filter">${["all", "got", "need", "duplicates"].map((f) => `<button data-mode="${f}" aria-pressed="${f === ctx.exportMode}" class="${f === ctx.exportMode ? "selected" : ""}">${f[0].toUpperCase() + f.slice(1)}</button>`).join("")}</div><div class="panel"><h2>Preview</h2><div class="table-scroll">${rows.length ? table(state, rows) : "<p>No entries match this filter.</p>"}</div><p class="muted">${rows.length} unique entries${ctx.exportMode === "duplicates" ? " · " + rows.reduce((n, c) => n + Math.max(0, quantity(state, c.id) - 1), 0) + " spare copies" : ""}</p></div><button class="primary wide" id="csv" ${!release ? "disabled" : ""}>Download CSV</button><button class="wide" id="print" ${!release ? "disabled" : ""}>Print / Save as PDF</button><small>CSV and print show this filtered catalogue. Use the lossless JSON backup to restore your collection.</small><details class="panel"><summary>Reference data</summary><p>${escape(state.reference.source?.name || "Imported reference")} · ${state.reference.cards.length} known cards</p><p>Completion follows each release’s checklist status. Researching releases remain unavailable for entry. Saved references outside the current registry are retained.</p><p><a href="https://github.com/jsipuk/jsipuk.github.io/tree/main/tcg-data" target="_blank" rel="noreferrer">Curated reference catalogue</a> · ${escape(state.reference.manifest?.dataVersion || "Saved reference")}</p></details>${
    state.reference.cards.some((c) => c.retired)
      ? '<div class="panel"><h2>Saved entries outside the current checklist</h2><p>These IDs were removed from a reference update. Quantities are kept without guessing a replacement.</p>' +
        state.reference.cards
          .filter((c) => c.retired)
          .map(
            (c) =>
              `<div class="review-row"><span>${escape(c.name)} · ${escape(c.printedNumber || c.collectorNumber)} · ${escape(langName(c.language))}</span><button data-retained="${escape(c.id)}">Own ${quantity(state, c.id)}</button></div>`,
          )
          .join("") +
        "</div>"
      : ""
  }</div>`;
  document
    .querySelectorAll("[data-retained]")
    .forEach((b) => (b.onclick = () => ctx.openCard(b.dataset.retained)));
  $("#backup").onclick = async () => {
    await ctx.flush();
    try {
      download(exportBackup(ctx.state), "card-ledger-backup.json");
      ctx.toast("Lossless collection backup prepared.");
    } catch (error) {
      ctx.toast(error.message);
    }
  };
  $("#reset-collection").onclick = () => {
    ctx.modal.innerHTML = `<div class="row between"><h2 id="detail-title">Reset your collection?</h2><button id="close" aria-label="Cancel reset">×</button></div><p>This will remove all recorded ownership quantities and return your collection to zero. Card and set reference data will remain.</p><p>Download a backup first if you want to keep your current collection. Pending review entries are kept; they will not be added automatically.</p><button id="reset-backup" class="wide">Download backup before reset</button><button id="confirm-reset" class="primary wide">Reset all ownership quantities</button><button id="cancel-reset" class="wide">Cancel</button>`;
    ctx.openModal();
    $("#close").onclick = ctx.closeModal;
    $("#cancel-reset").onclick = ctx.closeModal;
    $("#reset-backup").onclick = async () => {
      await ctx.flush();
      download(exportBackup(ctx.state), "card-ledger-before-reset.json");
      ctx.toast("Backup prepared. Reset has not happened yet.");
    };
    $("#confirm-reset").onclick = async () => {
      await ctx.change(
        resetCollection,
        "Collection reset. Reference cards were kept.",
        () => {
          ctx.modal.close();
          ctx.render();
        },
      );
    };
  };
  $("#import-backup").onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const preview = $("#backup-preview");
    try {
      if (file.size > 20 * 1024 * 1024)
        throw Error("Backup is larger than 20 MB.");
      const imported = importBackup(await file.text());
      const copies = Object.values(imported.quantities).reduce(
          (a, b) => a + b,
          0,
        ),
        owned = imported.reference.cards.filter(
          (c) => quantity(imported, c.id) > 0,
        ).length;
      if (!preview.isConnected) return;
      preview.innerHTML = `<p>${copies} copies · ${owned} unique cards owned · ${imported.reference.releases.length} releases · ${imported.batch.length} pending entries</p><p>Replace this device’s collection with this backup? Download your current backup first if you want to keep it.</p><button class="primary wide" id="restore-backup">Replace collection with this backup</button><button class="wide" id="cancel-import">Cancel import</button>`;
      $("#cancel-import").onclick = () => {
        preview.innerHTML = "";
        $("#import-backup").value = "";
      };
      $("#restore-backup").onclick = async () => {
        if (await ctx.save(imported, { recovery: true })) {
          ctx.collectionReplaced();
          ctx.render();
          ctx.toast("Collection restored from backup.");
        }
      };
    } catch (error) {
      if (preview.isConnected)
        preview.innerHTML = `<p class="import-error" role="alert">${escape(error.message)}. Your collection has not changed.</p>`;
    }
  };
  $("#export-set").onchange = (e) => {
    ctx.exportRelease = e.target.value;
    renderAndFocus(ctx, "#export-set");
  };
  document.querySelectorAll("[data-mode]").forEach(
    (b) =>
      (b.onclick = () => {
        ctx.exportMode = b.dataset.mode;
        renderAndFocus(ctx, `[data-mode="${b.dataset.mode}"]`);
      }),
  );
  $("#csv").onclick = () => {
    const lines = [
      [
        "Release",
        "Region",
        "Language",
        "Card number",
        "Name",
        "Owned",
        "Spare",
        "Variant quantities",
      ],
      ...rows.map((c) => [
        release.name,
        release.region,
        c.language,
        c.printedNumber || c.collectorNumber,
        c.name,
        quantity(state, c.id),
        Math.max(0, quantity(state, c.id) - 1),
        JSON.stringify(
          c.variants.map((v) => ({
            variant: v.label,
            quantity: state.quantities[JSON.stringify([c.id, v.id])] || 0,
          })),
        ),
      ]),
    ];
    const csv =
      "\ufeff" +
      lines
        .map((r) =>
          r
            .map(
              (value) =>
                '"' +
                String(value)
                  .replace(/^[=+@-]/, "' $&")
                  .replaceAll('"', '""') +
                '"',
            )
            .join(","),
        )
        .join("\r\n");
    download(
      csv,
      "card-ledger-" + ctx.exportMode + ".csv",
      "text/csv;charset=utf-8",
    );
    ctx.toast("CSV prepared.");
  };
  $("#print").onclick = () => {
    if (!release)
      return ctx.toast("Track a ready release before printing a checklist.");
    $("#printout").innerHTML =
      `<h1>Card Ledger · ${escape(release.name)}</h1><p>${escape(langName(release.language))} · ${ctx.exportMode} · ${new Date().toLocaleDateString("en-GB")}</p><p>${completion(state, release.id).completeReference ? "Complete verified reference checklist." : "Known entries; incomplete reference checklist."}</p>${table(state, rows)}`;
    window.print();
  };
}
