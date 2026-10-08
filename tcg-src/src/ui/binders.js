import { renderManageSets } from "./sets.js";
import { quantity, status, completion } from "../domain/collection.js";
import {
  $,
  escape,
  note,
  pos,
  langName,
  swipe,
  cardArt,
  bindImages,
  renderAndFocus,
} from "./helpers.js";
export function passes(state, card, filter) {
  const s = status(state, card.id);
  return (
    filter === "all" ||
    (filter === "got" && s.owned) ||
    (filter === "need" && s.needed) ||
    (filter === "duplicates" && s.duplicate)
  );
}
export function checklistLabel(state, releaseId) {
  const c = completion(state, releaseId);
  return c.completeReference
    ? `${c.owned} / ${c.tracked} tracked cards · ${c.percent}%`
    : `Known checklist · ${c.owned} / ${c.tracked} unique cards owned · incomplete reference`;
}
export function renderCollection(ctx) {
  if (ctx.manageSets) return renderManageSets(ctx);
  if (
    ctx.currentRelease &&
    ctx.state.reference.releases.some((r) => r.id === ctx.currentRelease)
  )
    return renderBinder(ctx);
  ctx.currentRelease = null;
  const releases = ctx.state.reference.releases.filter((r) =>
      ctx.state.trackedSets.includes(r.id),
    ),
    totalShelves = Math.max(1, Math.ceil(releases.length / 9));
  ctx.shelf = Math.min(ctx.shelf, totalShelves - 1);
  ctx.app.innerHTML = `<h1>My collection</h1>${note()}<div class="row between"><p class="muted">Choose a binder</p><div><button id="manage-sets">＋ Add / manage sets</button><button class="quiet" id="backup-link">Collection backup</button></div></div><div class="shelf" id="shelf">${releases
    .slice(ctx.shelf * 9, ctx.shelf * 9 + 9)
    .map(
      (r, i) =>
        `<button class="binder-tile" data-binder="${escape(r.id)}" aria-label="Open ${escape(r.name)} ${escape(langName(r.language))}"><div class="cover"><div class="cover-art" style="--pos:${pos(i)}"></div><span class="cover-title">${escape(r.name)}</span></div><span class="label">${escape(r.name)}</span><span class="badge">${escape(r.language === "en" ? "EN" : r.language)}</span> <small>${completion(ctx.state, r.id).owned} unique cards owned</small></button>`,
    )
    .join(
      "",
    )}</div>${!releases.length ? '<div class="panel"><h2>Your collection starts here</h2><p>Add a ready release to create your first binder. Researching releases stay unavailable until their card data is validated.</p></div>' : ""}<div class="pager"><button id="prev" aria-label="Previous shelf" ${ctx.shelf === 0 ? "disabled" : ""}>‹</button><span>Shelf ${ctx.shelf + 1} of ${totalShelves}</span><button id="next" aria-label="Next shelf" ${ctx.shelf >= totalShelves - 1 ? "disabled" : ""}>›</button></div><p class="muted" style="text-align:center">Swipe left or right to browse binders.</p>`;
  document
    .querySelectorAll("[data-binder]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          ctx.animateBinder(b.dataset.binder, b.querySelector(".cover"))),
    );
  const change = (dir) => {
    ctx.shelf = Math.max(0, Math.min(totalShelves - 1, ctx.shelf + dir));
    renderAndFocus(ctx, dir < 0 ? "#prev" : "#next");
  };
  $("#manage-sets").onclick = () => {
    ctx.manageSets = true;
    ctx.render();
  };
  $("#prev").onclick = () => change(-1);
  $("#next").onclick = () => change(1);
  swipe($("#shelf"), change);
  $("#backup-link").onclick = () => ctx.navigate("catalogue");
}
function renderBinder(ctx) {
  const { state } = ctx,
    r = state.reference.releases.find((r) => r.id === ctx.currentRelease),
    all = state.reference.cards.filter(
      (c) => c.releaseId === r.id && !c.retired,
    ),
    pages = Math.max(1, Math.ceil(all.length / 9));
  ctx.page = Math.min(ctx.page, pages - 1);
  const visible = all.slice(ctx.page * 9, ctx.page * 9 + 9);
  ctx.app.innerHTML = `<div class="row between"><button class="quiet" id="binders">‹ Binders</button><button id="rapid-entry">Rapid Entry</button></div><div class="row between"><div><h1>${escape(r.name)}</h1><p class="muted">${escape(langName(r.language))}${r.legacy ? " · saved reference" : ""}</p></div><div class="chips" role="group" aria-label="Collection view"><button id="grid" aria-pressed="${!ctx.list}" class="${!ctx.list ? "selected" : ""}">Binder</button><button id="list" aria-pressed="${ctx.list}" class="${ctx.list ? "selected" : ""}">List</button></div></div><div class="row between"><span class="badge" id="completion">${checklistLabel(state, r.id)}</span><p id="physical-count" class="muted">Physical cards: ${all.reduce((n, c) => n + quantity(state, c.id), 0)} · Spare copies: ${all.reduce((n, c) => n + Math.max(0, quantity(state, c.id) - 1), 0)}</p><div class="chips" role="group" aria-label="Collection filter">${["all", "got", "need", "duplicates"].map((f) => `<button data-filter="${f}" aria-pressed="${ctx.filter === f}" class="${ctx.filter === f ? "selected" : ""}">${f[0].toUpperCase() + f.slice(1)}</button>`).join("")}</div></div>${
    ctx.list
      ? `<div class="panel">${
          all
            .filter((c) => passes(state, c, ctx.filter))
            .map(
              (c) =>
                `<div class="list-card"><span><strong>${escape(c.printedNumber || c.collectorNumber)}</strong><br><small>${escape(c.name)}</small></span><button data-card="${escape(c.id)}">${quantity(state, c.id) > 1 ? status(state, c.id).badge : quantity(state, c.id) ? "Got" : "Need"}</button></div>`,
            )
            .join("") || "<p>No entries match this filter.</p>"
        }</div>`
      : `<div class="binder-page" id="page"><div class="pockets">${visible
          .map((c) => {
            const s = status(state, c.id);
            return `<button class="pocket ${passes(state, c, ctx.filter) ? "" : "filtered-out"}" data-card="${escape(c.id)}" aria-label="${escape(c.name)}, ${escape(c.printedNumber || c.collectorNumber)}, ${s.owned ? "owned " + s.copies : "needed"}">${s.owned ? `${cardArt(c)}${s.duplicate ? '<span class="count">' + s.badge + "</span>" : ""}` : '<span class="ball" aria-hidden="true"></span>'}<span class="card-number">${escape(c.collectorNumber.padStart(3, "0"))}${s.needed ? " · Need" : ""}</span></button>`;
          })
          .join(
            "",
          )}${Array.from({ length: 9 - visible.length }, () => '<div class="pocket empty-pocket" aria-hidden="true"></div>').join("")}</div></div><p class="muted" style="text-align:center">${ctx.filter === "all" ? "Tap a pocket to view or update." : "Non-matching pockets are dimmed to preserve page order."}</p><div class="pager"><button id="prev-page" ${ctx.page === 0 ? "disabled" : ""} aria-label="Previous page">‹</button><span>Page ${ctx.page + 1} of ${pages}</span><button id="next-page" ${ctx.page >= pages - 1 ? "disabled" : ""} aria-label="Next page">›</button></div>`
  }`;
  $("#rapid-entry").onclick = async () => {
    ctx.rapid = true;
    ctx.rapidReleaseId = r.id;
    ctx.rapidLanguage = r.language;
    await ctx.navigate("add");
  };
  $("#binders").onclick = () => {
    ctx.currentRelease = null;
    ctx.render();
  };
  $("#grid").onclick = () => {
    ctx.list = false;
    renderAndFocus(ctx, "#grid");
  };
  $("#list").onclick = () => {
    ctx.list = true;
    renderAndFocus(ctx, "#list");
  };
  document.querySelectorAll("[data-filter]").forEach(
    (b) =>
      (b.onclick = () => {
        ctx.filter = b.dataset.filter;
        renderAndFocus(ctx, `[data-filter="${b.dataset.filter}"]`);
      }),
  );
  document
    .querySelectorAll("[data-card]")
    .forEach((b) => (b.onclick = () => ctx.openCard(b.dataset.card)));
  bindImages(ctx.app);
  if (!ctx.list) {
    const change = (dir) => {
      ctx.page = Math.max(0, Math.min(pages - 1, ctx.page + dir));
      renderAndFocus(ctx, dir < 0 ? "#prev-page" : "#next-page");
    };
    $("#prev-page").onclick = () => change(-1);
    $("#next-page").onclick = () => change(1);
    swipe($("#page"), change);
  }
}
