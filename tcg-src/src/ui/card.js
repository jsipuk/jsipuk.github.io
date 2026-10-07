import {
  findCard,
  quantity,
  variantQuantity,
  setQuantity,
  addCopies,
} from "../domain/collection.js";
import { $, escape, langName, cardArt, bindImages } from "./helpers.js";
export function openCard(ctx, id) {
  const c = findCard(ctx.state, id),
    r = ctx.state.reference.releases.find((r) => r.id === c.releaseId);
  const staged = Object.fromEntries(
    c.variants.map((v) => [v.id, variantQuantity(ctx.state, id, v.id)]),
  );
  let variantId = c.variants.find((v) => staged[v.id] > 0)?.id || "unspecified";
  ctx.modal.innerHTML = `<div class="row between"><small>Back to binder</small><button id="close" aria-label="Close card">×</button></div>${cardArt(c, true)}<h2 id="detail-title">${escape(c.name)}</h2><p>${escape(c.printedNumber || c.collectorNumber)} · ${escape(r.name)}<br><small>${escape(langName(c.language))} · Reference artwork; finish may differ</small></p><label for="finish">Variant / finish</label><select id="finish">${c.variants.map((v) => `<option value="${escape(v.id)}" ${v.id === variantId ? "selected" : ""}>${escape(v.label)}</option>`).join("")}</select><div class="qty"><span>Owned</span><button id="minus" aria-label="Remove one copy">−</button><strong id="qty">${staged[variantId]}</strong><button id="plus" aria-label="Add one copy">＋</button></div><p class="muted" id="total">${quantity(ctx.state, id)} total copies across variants</p>${quantity(ctx.state, id) === 0 ? '<button id="add-missing" class="primary wide">Add to collection</button>' : ""}<button id="save" class="primary wide">Save changes</button><button id="needed" class="wide">Mark as needed</button><button id="cancel-card" class="quiet wide">Cancel</button>`;
  ctx.modal.querySelector(".detail-art").id = "zoom";
  const zoom = $("#zoom");
  zoom.setAttribute("role", "button");
  zoom.tabIndex = 0;
  zoom.setAttribute("aria-label", "Zoom reference card artwork");
  zoom.onclick = () => zoom.classList.toggle("zoom");
  zoom.onkeydown = (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      zoom.click();
    }
  };
  bindImages(ctx.modal);
  ctx.openModal();
  $("#close").onclick = ctx.closeModal;
  $("#cancel-card").onclick = ctx.closeModal;
  const update = () => {
    const total = Object.values(staged).reduce((a, b) => a + b, 0);
    $("#qty").textContent = staged[variantId];
    $("#total").textContent = `${total} total copies across variants`;
    if ($("#add-missing")) $("#add-missing").disabled = total !== 0;
    $("#minus").disabled = staged[variantId] === 0;
    $("#plus").disabled = total >= 999;
  };
  $("#finish").onchange = (e) => {
    variantId = e.target.value;
    update();
  };
  $("#minus").onclick = () => {
    staged[variantId] = Math.max(0, staged[variantId] - 1);
    update();
  };
  $("#plus").onclick = () => {
    staged[variantId]++;
    update();
  };
  $("#needed").onclick = () => {
    const total = Object.values(staged).reduce((a, b) => a + b, 0);
    if (
      total > 1 &&
      !confirm(
        `Set all ${total} copies across variants to zero? You can still cancel by closing.`,
      )
    )
      return;
    for (const key of Object.keys(staged)) staged[key] = 0;
    update();
  };
  if ($("#add-missing"))
    $("#add-missing").onclick = async () => {
      await ctx.change(
        (state) => addCopies(state, [{ cardId: id, variantId }]),
        "Card added to your collection.",
        () => {
          ctx.modal.close();
          ctx.render();
        },
      );
    };
  $("#save").onclick = async () => {
    const savedQuantities = { ...staged };
    await ctx.change(
      (state) => {
        let next = state;
        // Reductions first, so transferring quantities between variants never exceeds the limit temporarily.
        const ordered = [...c.variants].sort(
          (a, b) =>
            savedQuantities[a.id] -
            variantQuantity(state, id, a.id) -
            (savedQuantities[b.id] - variantQuantity(state, id, b.id)),
        );
        for (const v of ordered)
          next = setQuantity(next, id, v.id, savedQuantities[v.id]);
        return next;
      },
      "Quantity saved.",
      () => {
        ctx.modal.close();
        ctx.render();
      },
    );
  };
  update();
}
