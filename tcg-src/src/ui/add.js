import { renderRapid } from "./rapid.js";
import {
  searchCandidates,
  findCard,
  quantity,
  addCopies,
  canAddCopies,
} from "../domain/collection.js";
import {
  $,
  escape,
  note,
  releaseOptions,
  langName,
  cardArt,
  bindImages,
  languageOptions,
  renderEmptyEntry,
} from "./helpers.js";
export function renderAdd(ctx) {
  if (ctx.rapid) return renderRapid(ctx);
  const { state } = ctx;
  const available = new Set(
    state.reference.releases
      .filter((r) => r.legacy || (r.registryReady !== false && r.readyForApp))
      .map((r) => r.id),
  );
  const samples = state.reference.cards.filter(
    (c) => !c.retired && available.has(c.releaseId),
  );
  if (!samples.length) {
    renderEmptyEntry(ctx, "Add cards");
    return;
  }
  const sample =
    samples.find((c) => c.releaseId === state.draft.releaseId) || samples[0];
  ctx.app.innerHTML = `<div class="form"><div class="row between"><h1>Add cards</h1><button class="quiet" id="rapid-mode">Rapid Entry</button></div><p class="muted">Enter one card or a whole batch.</p>${note()}<div class="stack"><div><label for="set">Release</label><div class="field-row"><select id="set">${releaseOptions(state, state.draft.releaseId, true)}</select><button id="unknown-set">Don’t know</button></div></div><div><label for="language">Language</label><div class="field-row"><select id="language">${languageOptions(state, state.draft.language)}</select><button id="unknown-lang">Don’t know</button></div></div><div><label for="numbers">Card numbers</label><textarea id="numbers" placeholder="4/102&#10;025/102, 026/102">${escape(state.draft.text)}</textarea><small>Separate numbers with commas or new lines. If you don’t know the release or language, confirm a verified match before adding.</small></div></div><div class="sample-actions">${sample ? '<button class="quiet" id="try">Use a reference example</button>' : ""}${state.batch.length ? '<button id="resume">Resume review (' + state.batch.length + ")</button>" : ""}</div><button class="primary wide" id="find">Find cards</button></div>`;
  $("#rapid-mode").onclick = () => {
    ctx.rapid = true;
    ctx.render();
  };
  const saveDraft = () => {
    const draft = {
      releaseId: $("#set").value,
      language: $("#language").value,
      text: $("#numbers").value,
      variant: "unspecified",
    };
    return ctx.save((state) => ({ ...state, draft }));
  };
  for (const id of ["set", "language", "numbers"])
    $("#" + id).addEventListener(
      id === "numbers" ? "input" : "change",
      saveDraft,
    );
  $("#unknown-set").onclick = () => {
    $("#set").value = "";
    saveDraft();
  };
  $("#unknown-lang").onclick = () => {
    $("#language").value = "";
    saveDraft();
  };
  if ($("#try"))
    $("#try").onclick = async () => {
      if (
        await ctx.save((state) => ({
          ...state,
          draft: {
            releaseId: sample.releaseId,
            language: sample.language,
            text: sample.printedNumber || sample.collectorNumber,
            variant: "unspecified",
          },
        }))
      )
        renderAdd(ctx);
    };
  if ($("#resume"))
    $("#resume").onclick = async () => {
      await ctx.flush();
      ctx.review = true;
      ctx.render();
    };
  $("#find").onclick = async () => {
    if (!(await saveDraft())) return;
    const draft = ctx.state.draft;
    const tokens = draft.text
      .normalize("NFKC")
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!tokens.length) return ctx.toast("Enter at least one card number.");
    if (tokens.length > 500)
      return ctx.toast("Please split this into batches of 500 or fewer.");
    if (
      ctx.state.batch.length &&
      !confirm(
        "Replace the pending review? Your collection will stay unchanged.",
      )
    )
      return;
    const next = structuredClone(ctx.state);
    next.batch = tokens.map((raw, i) => {
      const match = searchCandidates(next.reference, {
        releaseId: draft.releaseId,
        language: draft.language,
        raw,
      });
      return {
        raw,
        i,
        ...match,
        chosen: !match.requiresConfirmation ? match.candidates[0] : null,
        variantId: "unspecified",
        releaseId: draft.releaseId,
        language: draft.language,
      };
    });
    if (await ctx.save((state) => ({ ...state, batch: next.batch }))) {
      ctx.review = true;
      ctx.render();
    }
  };
}
function isReady(state, row) {
  return Boolean(row.chosen && canAddCopies(state, row.chosen, row.variantId));
}
function currentCandidates(state, row) {
  return row.candidates.filter((id) => {
    const card = state.reference.cards.find((c) => c.id === id);
    return card?.variants.some((v) => canAddCopies(state, id, v.id));
  });
}
export function renderReview(ctx) {
  const ready = ctx.state.batch.filter((r) => isReady(ctx.state, r)),
    needs = ctx.state.batch.filter((r) => !isReady(ctx.state, r));
  ctx.app.innerHTML = `<div class="form"><button class="quiet" id="back">‹ Edit input</button><h1>Check your cards</h1><div class="summary">${ready.length} ready · ${needs.length} need checking</div><p class="muted">Nothing in this review has been added yet.</p>${note()}<div class="panel"><h2>Needs checking (${needs.length})</h2>${needs.length ? needs.map((r) => `<div class="review-row"><div><strong>${escape(r.raw)}</strong><div class="status">${r.status === "invalid" ? "Check the number" : currentCandidates(ctx.state, r).length ? "Confirm a current match" : "Not found in the available reference"}</div></div><button data-review="${r.i}">${currentCandidates(ctx.state, r).length ? "Choose match" : "Edit number"}</button></div>`).join("") : "<p>All entries are ready.</p>"}</div><details class="panel" open><summary>Ready to add (${ready.length})</summary>${ready
    .map((r) => {
      const c = findCard(ctx.state, r.chosen),
        release = ctx.state.reference.releases.find(
          (s) => s.id === c.releaseId,
        );
      return `<div class="review-row"><span><strong>${escape(c.name)} · ${escape(c.printedNumber || c.collectorNumber)}</strong><br><small>${escape(release.name)} · ${escape(langName(c.language))}<br>${escape(c.variants.find((v) => v.id === r.variantId)?.label)}</small></span><div><span class="pill">Own ${quantity(ctx.state, c.id)} · +1</span><button data-review="${r.i}">Variant</button></div></div>`;
    })
    .join(
      "",
    )}</details>${ready.length ? '<button class="primary wide" id="commit">Add ' + ready.length + " ready cards</button>" : ""}${needs.length ? '<p class="muted">Unresolved entries stay saved for later.</p>' : ""}</div>`;
  $("#back").onclick = () => {
    ctx.review = false;
    ctx.render();
  };
  document
    .querySelectorAll("[data-review]")
    .forEach(
      (b) => (b.onclick = () => reviewRow(ctx, Number(b.dataset.review))),
    );
  if ($("#commit"))
    $("#commit").onclick = async () => {
      await ctx.change(
        (state) => {
          const ready = state.batch.filter((r) => isReady(state, r));
          const next = addCopies(
            state,
            ready.map((r) => ({ cardId: r.chosen, variantId: r.variantId })),
          );
          const committed = new Set(ready.map((r) => r.i));
          next.batch = next.batch.filter((r) => !committed.has(r.i));
          if (!next.batch.length) next.draft.text = "";
          return next;
        },
        `${ready.length} copies added.`,
        () => {
          ctx.review = ctx.state.batch.length > 0;
          ctx.render();
        },
        () => {
          ctx.review = true;
          ctx.render();
        },
      );
    };
}
function reviewRow(ctx, i) {
  const row = ctx.state.batch.find((r) => r.i === i),
    candidates = currentCandidates(ctx.state, row);
  ctx.modal.innerHTML = `<div class="row between"><h2 id="detail-title">Check ${escape(row.raw)}</h2><button id="close" aria-label="Close">×</button></div><p class="muted">Confirm the card’s release, language and number. Nothing is added until you finish the review.</p>${
    candidates
      .map((id) => {
        const c = findCard(ctx.state, id),
          release = ctx.state.reference.releases.find(
            (r) => r.id === c.releaseId,
          );
        return `<div class="panel"><div class="candidate-heading"><div class="candidate-art">${cardArt(c)}</div><div><strong>${escape(c.name)} · ${escape(c.printedNumber || c.collectorNumber)}</strong><p>${escape(release.name)} · ${escape(langName(c.language))}<br><small>${escape(release.region)}</small></p></div></div><label for="variant-${escape(candidates.indexOf(id))}">Variant / finish</label><select id="variant-${candidates.indexOf(id)}">${c.variants
          .filter((v) => !v.retired)
          .map(
            (v) =>
              `<option value="${escape(v.id)}" ${v.id === row.variantId ? "selected" : ""}>${escape(v.label)}</option>`,
          )
          .join(
            "",
          )}</select><button class="wide" data-choose="${escape(id)}" data-select="variant-${candidates.indexOf(id)}">Confirm this card</button></div>`;
      })
      .join("") ||
    "<p>No match. Correct the number or return to input to choose another release.</p>"
  }<label for="correct">Correct number</label><input id="correct" value="${escape(row.raw)}"><button id="search-again" class="wide">Search again</button><button class="quiet" id="later">Keep for later</button>`;
  bindImages(ctx.modal);
  ctx.openModal();
  $("#close").onclick = ctx.closeModal;
  $("#later").onclick = ctx.closeModal;
  ctx.modal.querySelectorAll("[data-choose]").forEach(
    (b) =>
      (b.onclick = async () => {
        const variantId = $("#" + b.dataset.select).value;
        if (
          await ctx.save((state) => {
            const next = structuredClone(state),
              updated = next.batch.find((r) => r.i === i);
            updated.chosen = b.dataset.choose;
            const card = findCard(next, updated.chosen);
            updated.releaseId = card.releaseId;
            updated.language = card.language;
            updated.variantId = variantId;
            return next;
          })
        ) {
          ctx.modal.close();
          ctx.render();
        }
      }),
  );
  $("#search-again").onclick = async () => {
    const next = structuredClone(ctx.state),
      updated = next.batch.find((r) => r.i === i),
      raw = $("#correct").value.trim();
    if (!raw) return ctx.toast("Enter a number.");
    Object.assign(
      updated,
      searchCandidates(next.reference, {
        releaseId: row.releaseId,
        language: row.language,
        raw,
      }),
      { raw, chosen: null, variantId: "unspecified" },
    );
    if (await ctx.save((state) => ({ ...state, batch: next.batch }))) {
      ctx.modal.close();
      ctx.render();
      reviewRow(ctx, i);
    }
  };
}
