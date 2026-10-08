import { trackRelease } from "../domain/collection.js";
import { releaseMatches } from "../providers/catalogue.js";
import { $, escape, langName, note } from "./helpers.js";
export function renderManageSets(ctx) {
  ctx.app.innerHTML = `<div class="form"><button id="sets-back" class="quiet">‹ My collection</button><h1>Manage sets</h1>${note()}<p>Add a ready release to your shelf. Removing a binder keeps its saved quantities.</p><label for="set-search">Find a release</label><input id="set-search" value="${escape(ctx.setQuery || "")}" placeholder="Name, alias or language"><button id="refresh-reference" class="wide">Refresh reference catalogue</button><div id="set-results"></div></div>`;
  const draw = () => {
    const rows = ctx.state.reference.releases.filter((r) =>
      releaseMatches(
        ctx.state.reference.manifest?.releases.find((w) => w.id === r.id) || r,
        ctx.setQuery || "",
      ),
    );
    $("#set-results").innerHTML =
      rows
        .map((r) => {
          const tracked = ctx.state.trackedSets.includes(r.id);
          const wire = ctx.state.reference.manifest?.releases.find(
            (w) => w.id === r.id,
          );
          const ready = wire?.readyForApp === true;
          const cached = ctx.state.reference.cards.some(
            (c) => c.releaseId === r.id && !c.retired,
          );
          const current =
            cached &&
            r.importedVersion === ctx.state.reference.manifest?.dataVersion;
          const label = r.legacy
            ? "Saved reference · outside current registry"
            : ready
              ? current
                ? "Ready · reference cached"
                : cached
                  ? "Ready · reference update available"
                  : "Ready to import"
              : `${wire?.checklistStatus || r.checklistStatus || "unavailable"} · not app-ready`;
          return `<div class="panel"><h2>${escape(wire?.displayName || r.name)}</h2><p>${escape(langName(r.language))} · ${escape(r.region)}<br><small>${escape(label)}</small></p>${tracked ? `<button class="wide" data-untrack="${escape(r.id)}">Remove binder · keep quantities</button>` : `<button class="wide" data-track="${escape(r.id)}" ${!ready && !r.legacy ? "disabled" : ""}>${r.legacy ? "Show saved binder" : "Add set"}</button>`}</div>`;
        })
        .join("") ||
      (ctx.setQuery
        ? "<p>No releases match your search.</p>"
        : "<p>No releases are available in the cached registry. Refresh the reference catalogue above to retry.</p>");
    document.querySelectorAll("[data-track]").forEach(
      (b) =>
        (b.onclick = async () => {
          b.disabled = true;
          b.textContent = "Loading set…";
          const saved = await ctx.track(b.dataset.track);
          if (!saved && b.isConnected) {
            b.disabled = false;
            b.textContent = "Retry adding set";
          }
          if (saved)
            ctx.app
              .querySelector(`[data-untrack="${CSS.escape(b.dataset.track)}"]`)
              ?.focus();
        }),
    );
    document.querySelectorAll("[data-untrack]").forEach(
      (b) =>
        (b.onclick = async () => {
          const saved = await ctx.change(
            (state) => trackRelease(state, b.dataset.untrack, false),
            "Binder removed. Its quantities are still saved.",
          );
          if (saved)
            ctx.app
              .querySelector(`[data-track="${CSS.escape(b.dataset.untrack)}"]`)
              ?.focus();
        }),
    );
  };
  $("#set-search").oninput = (e) => {
    ctx.setQuery = e.target.value;
    draw();
  };
  $("#sets-back").onclick = () => {
    ctx.manageSets = false;
    ctx.currentRelease = null;
    ctx.render();
  };
  $("#refresh-reference").onclick = async (e) => {
    e.target.disabled = true;
    await ctx.refreshReference({ interactive: true });
  };
  draw();
}
