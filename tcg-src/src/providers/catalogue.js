import {
  cardIdentity,
  createCollection,
  numberToken,
  validateCollection,
} from "../domain/collection.js";
const record = (value) =>
  value && typeof value === "object" && !Array.isArray(value);
const text = (value) => typeof value === "string" && value.trim().length > 0;
const statuses = ["planned", "researching", "partial", "verified"];
function assert(condition, message) {
  if (!condition) throw Error(message);
}
export function validateManifest(manifest) {
  assert(
    record(manifest) &&
      manifest.schemaVersion === 1 &&
      text(manifest.dataVersion) &&
      Array.isArray(manifest.releases),
    "Unsupported reference manifest",
  );
  const ids = new Set();
  for (const r of manifest.releases) {
    assert(
      record(r) &&
        [
          r.id,
          r.game,
          r.displayName,
          r.officialName,
          r.language,
          r.region,
          r.releaseDate,
          r.cardsFile,
        ].every(text),
      "Invalid release metadata",
    );
    assert(
      !ids.has(r.id) &&
        statuses.includes(r.checklistStatus) &&
        typeof r.readyForApp === "boolean",
      "Invalid or duplicate release",
    );
    assert(
      [r.printedDenominator, r.numberedCardCount].every(
        (n) => n === null || (Number.isSafeInteger(n) && n > 0),
      ),
      "Invalid release counts",
    );
    assert(
      Array.isArray(r.aliases) &&
        r.aliases.every(text) &&
        record(r.source) &&
        Array.isArray(r.source.secondary),
      "Missing release aliases or provenance",
    );
    assert(
      r.cardsFile.startsWith(`sets/${r.language}/`) &&
        /^[A-Za-z0-9/_-]+\.json$/.test(r.cardsFile) &&
        !r.cardsFile.includes(".."),
      "Unsafe release file path",
    );
    ids.add(r.id);
  }
  return structuredClone(manifest);
}
export function adaptRelease(wire) {
  return {
    ...structuredClone(wire),
    releaseKey: wire.id,
    name: wire.displayName,
    printedTotal: String(wire.printedDenominator ?? "?"),
    checklist: {
      complete: false,
      expectedTotal: wire.numberedCardCount,
      reason: "Reference cards have not been imported and validated.",
    },
  };
}
export function emptyReference() {
  return {
    schemaVersion: 1,
    releases: [],
    cards: [],
    source: { name: "Card Ledger curated catalogue" },
  };
}
export function mergeManifest(state, manifest) {
  manifest = validateManifest(manifest);
  const next = structuredClone(state);
  const releases = new Map(next.reference.releases.map((r) => [r.id, r]));
  for (const [id, r] of releases)
    if (
      !r.legacy &&
      r.importedVersion &&
      !manifest.releases.some((w) => w.id === id)
    )
      releases.set(id, {
        ...r,
        registryReady: false,
        checklist: { ...r.checklist, complete: false },
      });
  for (const wire of manifest.releases) {
    const cached = releases.get(wire.id);
    // Keep the last validated checklist until its replacement card file passes validation.
    releases.set(
      wire.id,
      cached?.importedVersion
        ? {
            ...cached,
            registryReady: wire.readyForApp,
            checklist: {
              ...cached.checklist,
              complete:
                cached.checklist.complete &&
                wire.checklistStatus === "verified" &&
                cached.importedVersion === manifest.dataVersion,
            },
          }
        : adaptRelease(wire),
    );
  }
  next.reference.releases = [...releases.values()];
  next.reference.manifest = manifest;
  return validateCollection(next);
}
export function adaptPack(manifest, releaseId, pack) {
  validateManifest(manifest);
  const wire = manifest.releases.find((r) => r.id === releaseId);
  assert(
    wire?.readyForApp === true,
    "Release is still being researched and is not app-ready",
  );
  const rows = Array.isArray(pack) ? pack : pack?.cards;
  assert(
    Array.isArray(rows) && rows.length > 0,
    "Release file has no card checklist",
  );
  if (!Array.isArray(pack)) {
    assert(
      pack.schemaVersion === undefined || pack.schemaVersion === 1,
      "Unsupported release file schema",
    );
    assert(
      pack.releaseId === undefined || pack.releaseId === wire.id,
      "Release file ID does not match the manifest",
    );
    assert(
      pack.language === undefined || pack.language === wire.language,
      "Release file language does not match the manifest",
    );
  }
  const release = {
    ...adaptRelease(wire),
    testFixture: manifest.testFixture === true,
    importedVersion: manifest.dataVersion,
  };
  const ids = new Set(),
    numbers = new Set();
  const cards = rows.map((row) => {
    assert(
      record(row) && [row.id, row.collectorNumber, row.name].every(text),
      "Invalid card metadata",
    );
    assert(
      row.releaseId === wire.id && row.language === wire.language,
      "Card release or language does not match the manifest",
    );
    assert(
      !ids.has(row.id) &&
        numberToken(row.collectorNumber) &&
        !numbers.has(row.collectorNumber),
      "Duplicate card ID or collector number",
    );
    assert(
      record(row.source) &&
        record(row.providerRefs) &&
        record(row.images) &&
        Array.isArray(row.variants),
      "Missing card provenance, images or variants",
    );
    const variants = [
      { id: "unspecified", label: "Finish not specified", finish: null },
    ];
    const seenVariants = new Set();
    for (const variant of row.variants) {
      const v =
        typeof variant === "string" ? { id: variant, label: variant } : variant;
      assert(
        record(v) && text(v.id) && !seenVariants.has(v.id),
        "Invalid canonical variant",
      );
      seenVariants.add(v.id);
      const label = text(v.label)
        ? v.label
        : text(v.name)
          ? v.name
          : [v.finish, v.printing].filter(text).join(" · ") || v.id;
      const item = { ...structuredClone(v), label };
      const existing = variants.findIndex((old) => old.id === v.id);
      if (existing >= 0) variants[existing] = item;
      else variants.push(item);
    }
    ids.add(row.id);
    numbers.add(row.collectorNumber);
    const c = {
      ...structuredClone(row),
      game: wire.game,
      region: wire.region,
      releaseKey: wire.id,
      variants,
      catalogueSchemaVersion: 1,
      retired: false,
    };
    c.referenceIdentity = cardIdentity(c); // Independent check of release/language/number fields.
    return c;
  });
  if (cards.every((c) => Number.isFinite(c.sortNumber)))
    cards.sort((a, b) => a.sortNumber - b.sortNumber);
  if (wire.checklistStatus === "verified")
    assert(
      wire.numberedCardCount === cards.length,
      "Verified checklist count does not match its card file",
    );
  release.checklist = {
    complete:
      wire.checklistStatus === "verified" &&
      wire.numberedCardCount === cards.length,
    expectedTotal: wire.numberedCardCount,
    reason: wire.checklistStatus,
    sourceEntries: cards.length,
  };
  createCollection({ releases: [release], cards });
  return { release, cards };
}
export function mergePack(state, imported) {
  imported = structuredClone(imported);
  // Fetches run outside the storage transaction. Recheck their contract against
  // the current registry before allowing a delayed response into the cache.
  const manifest = state.reference.manifest;
  const wire = manifest?.releases.find((r) => r.id === imported.release.id);
  const contractFields = [
    "id",
    "game",
    "region",
    "language",
    "cardsFile",
    "readyForApp",
    "checklistStatus",
    "printedDenominator",
    "numberedCardCount",
  ];
  assert(
    wire?.readyForApp === true &&
      imported.release.importedVersion === manifest.dataVersion &&
      contractFields.every((field) => wire[field] === imported.release[field]),
    "Reference changed while the card file was loading. Refresh the catalogue and try again",
  );
  const next = structuredClone(state),
    ids = new Set(imported.cards.map((c) => c.id));
  for (const c of imported.cards) {
    const old = next.reference.cards.find((existing) => existing.id === c.id);
    assert(
      !old || cardIdentity(old) === cardIdentity(c),
      "A reference update reused a card ID for a different identity",
    );
    // Keep previously tracked finish identities even if a provider drops their metadata.
    if (old)
      for (const v of old.variants)
        if (!c.variants.some((n) => n.id === v.id))
          c.variants.push({ ...v, retired: true });
  }
  next.reference.releases = next.reference.releases.map((r) =>
    r.id === imported.release.id ? imported.release : r,
  );
  next.reference.cards = next.reference.cards
    .filter((c) => c.releaseId !== imported.release.id)
    .concat(
      imported.cards,
      next.reference.cards
        .filter((c) => c.releaseId === imported.release.id && !ids.has(c.id))
        .map((c) => ({ ...c, retired: true })),
    );
  return validateCollection(next);
}
export function releaseMatches(release, query) {
  const tokens = query
    .normalize("NFKC")
    .toLocaleLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const haystack = [
    release.displayName || release.name,
    release.officialName,
    release.language,
    release.language === "zh-Hans" ? "Chinese Simplified Chinese" : "English",
    ...(release.aliases || []),
  ]
    .join(" ")
    .normalize("NFKC")
    .toLocaleLowerCase();
  return tokens.every((token) => haystack.includes(token));
}
export async function fetchManifest(fetcher = fetch) {
  const response = await fetcher("/tcg-data/manifest.json", {
    cache: "no-cache",
  });
  if (!response.ok)
    throw Error("Reference registry is temporarily unavailable");
  return validateManifest(await response.json());
}
export async function fetchPack(manifest, releaseId, fetcher = fetch) {
  const release = manifest.releases.find((r) => r.id === releaseId);
  if (!release?.readyForApp) throw Error("This release is not app-ready");
  const response = await fetcher(`/tcg-data/${release.cardsFile}`, {
    cache: "no-cache",
  });
  if (!response.ok)
    throw Error(
      "The release card file is unavailable; saved reference data was kept",
    );
  return adaptPack(manifest, releaseId, await response.json());
}
