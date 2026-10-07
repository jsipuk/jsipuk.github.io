import { quantity, exportBackup, importBackup } from "../domain/collection.js";
import { passes } from "./binders.js";
import {
  $,
  escape,
  note,
  releaseOptions,
  langName,
  download,
} from "./helpers.js";
function table(state, rows) {
  return `<table><thead><tr><th>Card</th><th>Name</th><th>Owned</th><th>Spare</th></tr></thead><tbody>${rows.map((c) => `<tr><td>${escape(c.printedNumber || c.collectorNumber)}</td><td>${escape(c.name)}</td><td>${quantity(state, c.id)}</td><td>${Math.max(0, quantity(state, c.id) - 1)}</td></tr>`).join("")}</tbody></table>`;
}
export function renderCatalogue(ctx) {
  const { state } = ctx;
  let release =
    state.reference.releases.find((r) => r.id === ctx.exportRelease) ||
    state.reference.releases[0];
  ctx.exportRelease = release?.id;
  const rows = state.reference.cards.filter(
    (c) => c.releaseId === release?.id && passes(state, c, ctx.exportMode),
  );
  ctx.app.innerHTML = `<div class="form"><h1>Catalogue</h1>${note()}<div class="panel"><h2>Collection backup</h2><p>Save all quantities, variants, reference metadata and pending review. Import restores the whole collection on this device.</p><button class="primary wide" id="backup" ${ctx.hasStorageError() ? "disabled" : ""}>Download lossless backup</button><label for="import-backup">Import backup</label><input id="import-backup" type="file" accept="application/json,.json"><div id="backup-preview" aria-live="polite"></div></div><label for="export-set">Release and language</label><select id="export-set">${releaseOptions(state, ctx.exportRelease)}</select><p class="muted">${escape(langName(release?.language || ""))}</p><label>Include</label><div class="chips">${["all", "got", "need", "duplicates"].map((f) => `<button data-mode="${f}" class="${f === ctx.exportMode ? "selected" : ""}">${f[0].toUpperCase() + f.slice(1)}</button>`).join("")}</div><div class="panel"><h2>Preview</h2><div class="table-scroll">${rows.length ? table(state, rows) : "<p>No entries match this filter.</p>"}</div><p class="muted">${rows.length} unique entries${ctx.exportMode === "duplicates" ? " · " + rows.reduce((n, c) => n + Math.max(0, quantity(state, c.id) - 1), 0) + " spare copies" : ""}</p></div><button class="primary wide" id="csv">Download CSV</button><button class="wide" id="print">Print / Save as PDF</button><small>CSV and print show this filtered catalogue. Use the lossless JSON backup to restore your collection.</small><details class="panel"><summary>Reference data</summary><p>${escape(state.reference.source?.name || "Imported reference")} · ${state.reference.cards.length} known cards</p><p>Checklists and variant coverage have not been certified complete. Simplified Chinese reference data is not included in the English alpha.</p><p><a href="https://github.com/tcgdex/cards-database" target="_blank" rel="noreferrer">TCGdex source</a> · <a href="./data/TCGDEX-LICENSE.txt">Database license</a></p></details></div>`;
  $("#backup").onclick = () => {
    try {
      download(exportBackup(ctx.state), "card-ledger-backup.json");
      ctx.toast("Lossless collection backup prepared.");
    } catch (error) {
      ctx.toast(error.message);
    }
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
      $("#restore-backup").onclick = () => {
        if (ctx.save(imported, { recovery: true })) {
          ctx.currentRelease = null;
          ctx.exportRelease = imported.reference.releases[0]?.id;
          ctx.page = 0;
          ctx.shelf = 0;
          ctx.review = false;
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
    ctx.render();
  };
  document.querySelectorAll("[data-mode]").forEach(
    (b) =>
      (b.onclick = () => {
        ctx.exportMode = b.dataset.mode;
        ctx.render();
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
    $("#printout").innerHTML =
      `<h1>Card Ledger · ${escape(release.name)}</h1><p>${escape(langName(release.language))} · ${ctx.exportMode} · ${new Date().toLocaleDateString("en-GB")}</p><p>Known entries; incomplete reference checklist.</p>${table(state, rows)}`;
    window.print();
  };
}
