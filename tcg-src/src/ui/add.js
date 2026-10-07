import {
  searchCandidates,
  findCard,
  quantity,
  addCopies,
} from "../domain/collection.js";
import {
  $,
  escape,
  note,
  releaseOptions,
  langName,
  cardArt,
  bindImages,
} from "./helpers.js";
export function renderAdd(ctx) {
  const { state } = ctx;
  ctx.app.innerHTML = `<div class="form"><h1>Add cards</h1><p class="muted">Enter one card or a whole batch.</p>${note()}<div class="stack"><div><label for="set">Release</label><div class="field-row"><select id="set">${releaseOptions(state, state.draft.releaseId, true)}</select><button id="unknown-set">Don’t know</button></div></div><div><label for="language">Language</label><div class="field-row"><select id="language"><option value="" ${!state.draft.language ? "selected" : ""}>Don’t know</option><option value="en" ${state.draft.language === "en" ? "selected" : ""}>English</option><option value="zh-Hans" disabled>Simplified Chinese · not available yet</option></select><button id="unknown-lang">Don’t know</button></div></div><div><label for="numbers">Card numbers</label><textarea id="numbers" placeholder="4/102&#10;025/102, 026/102">${escape(state.draft.text)}</textarea><small>Separate numbers with commas or new lines. If you don’t know the release or language, confirm a verified match before adding.</small></div></div><div class="sample-actions"><button class="quiet" id="try">Try Charizard 4/102</button>${state.batch.length ? '<button id="resume">Resume review (' + state.batch.length + ")</button>" : ""}</div><button class="primary wide" id="find">Find cards</button></div>`;
  const saveDraft = () => {
    const next = structuredClone(ctx.state);
    next.draft = {
      releaseId: $("#set").value,
      language: $("#language").value,
      text: $("#numbers").value,
      variant: "unspecified",
    };
    return ctx.save(next);
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
  $("#try").onclick = () => {
    const r = ctx.state.reference.releases.find(
      (r) => r.releaseKey === "base-set-1999" && r.language === "en",
    );
    if (!r) return ctx.toast("Base Set is not in this backup’s reference.");
    const next = structuredClone(ctx.state);
    next.draft = {
      releaseId: r.id,
      language: "en",
      text: "4/102",
      variant: "unspecified",
    };
    if (ctx.save(next)) renderAdd(ctx);
  };
  if ($("#resume"))
    $("#resume").onclick = () => {
      ctx.review = true;
      ctx.render();
    };
  $("#find").onclick = () => {
    if (!saveDraft()) return;
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
    if (ctx.save(next)) {
      ctx.review = true;
      ctx.render();
    }
  };
}
export function renderReview(ctx) {
  const ready = ctx.state.batch.filter((r) => r.chosen),
    needs = ctx.state.batch.filter((r) => !r.chosen);
  ctx.app.innerHTML = `<div class="form"><button class="quiet" id="back">‹ Edit input</button><h1>Check your cards</h1><div class="summary">${ready.length} ready · ${needs.length} need checking</div><p class="muted">Nothing in this review has been added yet.</p>${note()}<div class="panel"><h2>Needs checking (${needs.length})</h2>${needs.length ? needs.map((r) => `<div class="review-row"><div><strong>${escape(r.raw)}</strong><div class="status">${r.status === "invalid" ? "Check the number" : r.candidates.length ? "Confirm a match" : "Not found in the available reference"}</div></div><button data-review="${r.i}">${r.candidates.length ? "Choose match" : "Edit number"}</button></div>`).join("") : "<p>All entries are ready.</p>"}</div><details class="panel" open><summary>Ready to add (${ready.length})</summary>${ready
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
    $("#commit").onclick = () => {
      try {
        let next = addCopies(
          ctx.state,
          ready.map((r) => ({ cardId: r.chosen, variantId: r.variantId })),
        );
        next.batch = next.batch.filter((r) => !r.chosen);
        if (!next.batch.length) next.draft.text = "";
        ctx.change(
          next,
          `${ready.length} copies added.`,
          () => {
            ctx.review = next.batch.length > 0;
            ctx.render();
          },
          () => {
            ctx.review = true;
            ctx.render();
          },
        );
      } catch (error) {
        ctx.toast(error.message);
      }
    };
}
function reviewRow(ctx, i) {
  const row = ctx.state.batch.find((r) => r.i === i);
  ctx.modal.innerHTML = `<div class="row between"><h2 id="detail-title">Check ${escape(row.raw)}</h2><button id="close" aria-label="Close">×</button></div><p class="muted">Confirm the card’s release, language and number. Nothing is added until you finish the review.</p>${
    row.candidates
      .map((id) => {
        const c = findCard(ctx.state, id),
          release = ctx.state.reference.releases.find(
            (r) => r.id === c.releaseId,
          );
        return `<div class="panel"><div class="candidate-heading"><div class="candidate-art">${cardArt(c)}</div><div><strong>${escape(c.name)} · ${escape(c.printedNumber || c.collectorNumber)}</strong><p>${escape(release.name)} · ${escape(langName(c.language))}<br><small>${escape(release.region)}</small></p></div></div><label for="variant-${escape(row.candidates.indexOf(id))}">Variant / finish</label><select id="variant-${row.candidates.indexOf(id)}">${c.variants.map((v) => `<option value="${escape(v.id)}" ${v.id === row.variantId ? "selected" : ""}>${escape(v.label)}</option>`).join("")}</select><button class="wide" data-choose="${escape(id)}" data-select="variant-${row.candidates.indexOf(id)}">Confirm this card</button></div>`;
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
      (b.onclick = () => {
        const next = structuredClone(ctx.state),
          updated = next.batch.find((r) => r.i === i);
        updated.chosen = b.dataset.choose;
        const card = findCard(next, updated.chosen);
        updated.releaseId = card.releaseId;
        updated.language = card.language;
        updated.variantId = $("#" + b.dataset.select).value;
        if (ctx.save(next)) {
          ctx.modal.close();
          ctx.render();
        }
      }),
  );
  $("#search-again").onclick = () => {
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
    if (ctx.save(next)) {
      ctx.modal.close();
      ctx.render();
      reviewRow(ctx, i);
    }
  };
}
