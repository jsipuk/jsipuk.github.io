import {
  searchCandidates,
  addCopies,
  findCard,
  quantity,
} from "../domain/collection.js";
import {
  $,
  escape,
  releaseOptions,
  langName,
  cardArt,
  bindImages,
} from "./helpers.js";
export function renderRapid(ctx) {
  const state = ctx.state,
    saved = state.rapidContext;
  const releaseId =
    ctx.rapidReleaseId ??
    saved?.releaseId ??
    ctx.currentRelease ??
    state.trackedSets[0] ??
    "";
  const release = state.reference.releases.find((r) => r.id === releaseId);
  const language =
    ctx.rapidLanguage ?? saved?.language ?? release?.language ?? "en";
  ctx.rapidReleaseId = releaseId;
  ctx.rapidLanguage = language;
  ctx.app.innerHTML = `<div class="form"><div class="row between"><h1>Rapid Entry</h1><button id="batch-mode" class="quiet">Batch entry</button></div><p class="muted">Keep the release pinned. Enter a number and press Enter to add one copy.</p><label for="rapid-set">Release</label><select id="rapid-set">${releaseOptions(state, releaseId, true)}</select><label for="rapid-language">Language</label><select id="rapid-language"><option value="">Don’t know</option>${[...new Set(["en", ...state.reference.releases.filter((r) => r.legacy || r.readyForApp).map((r) => r.language)])].map((lang) => `<option value="${escape(lang)}" ${lang === language ? "selected" : ""}>${escape(langName(lang))}</option>`).join("")}</select><form id="rapid-form"><label for="rapid-number">Card number</label><input id="rapid-number" class="rapid-number" autocomplete="off" autocapitalize="characters" placeholder="94 or 094/088"><details><summary>Optional card name</summary><label for="rapid-name">Name to narrow candidates</label><input id="rapid-name" autocomplete="off"></details><button id="rapid-add" class="primary wide" type="submit">Add one copy</button></form><div id="rapid-recent" aria-live="polite">${(
    ctx.rapidHistory || []
  )
    .map((id) => {
      const c = findCard(state, id);
      return `<div class="review-row"><span>${escape(c.name)} · ${escape(c.printedNumber || c.collectorNumber)}</span><strong>Own ${quantity(state, id)}${quantity(state, id) > 1 ? " · ×" + quantity(state, id) : ""}</strong></div>`;
    })
    .join("")}</div></div>`;
  const saveContext = () => {
    ctx.rapidReleaseId = $("#rapid-set").value;
    ctx.rapidLanguage = $("#rapid-language").value;
    return ctx.save((state) => ({
      ...state,
      rapidContext: {
        releaseId: ctx.rapidReleaseId,
        language: ctx.rapidLanguage,
      },
    }));
  };
  $("#rapid-set").onchange = async () => {
    const r = ctx.state.reference.releases.find(
      (r) => r.id === $("#rapid-set").value,
    );
    if (r) $("#rapid-language").value = r.language;
    await saveContext();
    $("#rapid-number").focus();
  };
  $("#rapid-language").onchange = saveContext;
  $("#batch-mode").onclick = () => {
    ctx.rapid = false;
    ctx.render();
  };
  $("#rapid-form").onsubmit = async (e) => {
    e.preventDefault();
    const input = $("#rapid-number"),
      button = $("#rapid-add"),
      raw = input.value.trim(),
      name = $("#rapid-name").value.trim();
    if (!raw) return ctx.toast("Enter a card number.");
    input.disabled = true;
    button.disabled = true;
    try {
      if (!(await saveContext())) return;
      const match = searchCandidates(ctx.state.reference, {
        releaseId: ctx.rapidReleaseId,
        language: ctx.rapidLanguage,
        raw,
        name,
      });
      if (!match.candidates.length) {
        ctx.toast(
          match.status === "invalid"
            ? "Check the collector number."
            : "No match in the cached reference. Add a ready set in Manage sets or check the input.",
        );
        return;
      }
      if (!match.requiresConfirmation)
        await addRapid(ctx, match.candidates[0], "unspecified");
      else chooseRapid(ctx, match.candidates, raw);
    } finally {
      if (input.isConnected) {
        input.disabled = false;
        button.disabled = false;
        if (!ctx.modal.open) input.focus();
      }
    }
  };
  $("#rapid-number").focus();
}
async function addRapid(ctx, id, variantId) {
  const card = findCard(ctx.state, id);
  return ctx.change(
    (state) => addCopies(state, [{ cardId: id, variantId }]),
    `${card.name} added.`,
    () => {
      ctx.rapidHistory = [
        id,
        ...(ctx.rapidHistory || []).filter((previous) => previous !== id),
      ].slice(0, 5);
      if (ctx.modal.open) ctx.modal.close();
      ctx.render();
      $("#rapid-number")?.focus();
    },
  );
}
function chooseRapid(ctx, ids, raw) {
  ctx.modal.innerHTML = `<div class="row between"><h2 id="detail-title">Choose ${escape(raw)}</h2><button id="close" aria-label="Cancel choice">×</button></div><p>Confirm the card, release and language before adding one copy.</p>${ids
    .map((id, index) => {
      const c = findCard(ctx.state, id),
        r = ctx.state.reference.releases.find((r) => r.id === c.releaseId);
      return `<div class="panel"><div class="candidate-heading"><div class="candidate-art">${cardArt(c)}</div><div><strong>${escape(c.name)} · ${escape(c.printedNumber || c.collectorNumber)}</strong><p>${escape(r.name)} · ${escape(langName(c.language))}</p></div></div><label for="rapid-variant-${index}">Variant / finish</label><select id="rapid-variant-${index}">${c.variants
        .filter((v) => !v.retired)
        .map(
          (v) => `<option value="${escape(v.id)}">${escape(v.label)}</option>`,
        )
        .join(
          "",
        )}</select><button class="primary wide" data-rapid-choose="${escape(id)}" data-index="${index}">Add this card</button></div>`;
    })
    .join("")}`;
  bindImages(ctx.modal);
  $("#rapid-number").disabled = false;
  $("#rapid-number").focus();
  ctx.openModal();
  $("#close").onclick = ctx.closeModal;
  ctx.modal.querySelectorAll("[data-rapid-choose]").forEach(
    (b) =>
      (b.onclick = async () => {
        b.disabled = true;
        const saved = await addRapid(
          ctx,
          b.dataset.rapidChoose,
          $(`#rapid-variant-${b.dataset.index}`).value,
        );
        if (!saved && b.isConnected) b.disabled = false;
      }),
  );
}
