import { cardIdentity } from '../domain/collection.js';
export const PINNED_REVISION = '4199850a6af49665db0080fa2bb9ef751750a406';
export function adaptTCGdexSet(source, registration, sourceCards) {
  if (source.id !== registration.providerId || !source.name.en) throw Error('Release mapping mismatch');
  const language = 'en', region = 'international', game = 'pokemon';
  const release = {
    id: `${game}:${region}:${registration.releaseKey}:${language}`,
    game, region, releaseKey: registration.releaseKey, language,
    name: source.name.en, releaseDate: source.releaseDate,
    printedTotal: String(source.cardCount.official),
    checklist: { complete: false, expectedTotal: null, reason: 'Community reference; full checklist and printings have not been independently verified.' },
    provider: { name: 'tcgdex-snapshot', id: source.id, revision: PINNED_REVISION },
  };
  const cards = sourceCards.map(({ localId, card }) => {
    if (!card.name.en || card.set.id !== source.id) throw Error(`Missing English reference or incorrect release: ${localId}`);
    const identity = { game, region, releaseKey: registration.releaseKey, language, collectorNumber: String(localId) };
    return {
      ...identity, id: cardIdentity(identity), releaseId: release.id,
      name: card.name.en, printedNumber: `${localId}/${release.printedTotal}`,
      rarity: card.rarity || null,
      variants: adaptVariants(card.variants),
      // The documented address is a candidate, not a claim that every scan exists.
      image: { url: `https://assets.tcgdex.net/en/${source.serie.id}/${source.id}/${localId}/high.webp`, availability: 'unverified', variantSpecific: false },
      provider: { name: 'tcgdex-snapshot', id: `${source.id}-${localId}`, revision: PINNED_REVISION },
    };
  });
  release.checklist.sourceEntries = cards.length;
  return { release, cards };
}
function adaptVariants(source) {
  const result = [{ id: 'unspecified', label: 'Finish not specified', finish: null }];
  if (Array.isArray(source)) {
    for (const v of source) {
      const attributes = { finish: v.type ?? null, printing: v.subtype ?? null, size: v.size ?? 'standard', stamps: [...(v.stamp ?? [])].sort(), foil: v.foil ?? null };
      const id = JSON.stringify(attributes);
      if (result.some(existing => existing.id === id)) continue;
      const label = [v.type, v.subtype, ...(v.stamp || []), v.foil, v.size && v.size !== 'standard' ? v.size : ''].filter(Boolean).join(' · ');
      if (label) result.push({ id, label, ...attributes });
    }
  } else if (source && typeof source === 'object') {
    // Only explicit flags; never assume a normal or holo printing from rarity.
    for (const [flag, finish] of [['normal','normal'],['holo','holo'],['reverse','reverse']]) {
      if (source[flag] !== true) continue;
      const attributes = { finish, printing: null, size: 'standard', stamps: [], foil: null };
      result.push({ id: JSON.stringify(attributes), label: finish === 'reverse' ? 'Reverse holo' : finish === 'holo' ? 'Holo' : 'Regular', ...attributes });
    }
  }
  return result;
}
