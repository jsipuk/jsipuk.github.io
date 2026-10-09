import { searchCandidates, canAddCopies } from "../domain/collection.js";

export function mismatchMessage(raw, mismatch) {
  return `${raw} does not match ${mismatch.releaseName}. Its cards use ${mismatch.expectedTotals.map((total) => "/" + total).join(" or ")}. Check the selected set.`;
}

export async function otherSetCandidates(ctx, query, mismatch) {
  for (const id of mismatch.matchingReleaseIds) {
    if (ctx.state.reference.cards.some((c) => c.releaseId === id && !c.retired))
      continue;
    const release = ctx.state.reference.releases.find((r) => r.id === id);
    ctx.toast(`Checking ${release.name}…`);
    try {
      if (!(await ctx.importRelease(id))) continue;
    } catch (error) {
      ctx.toast(`Could not check ${release.name}: ${error.message}`);
    }
  }
  return searchCandidates(ctx.state.reference, { ...query, releaseId: "" })
    .candidates.filter((id) => {
      const card = ctx.state.reference.cards.find((c) => c.id === id);
      return card.releaseId !== query.releaseId &&
        card.variants.some((variant) => canAddCopies(ctx.state, id, variant.id));
    });
}
