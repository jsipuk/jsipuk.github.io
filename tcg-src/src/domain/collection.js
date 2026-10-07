// Ownership keys are app identities, never provider IDs.
export function cardIdentity({
  game,
  region,
  releaseKey,
  language,
  collectorNumber,
}) {
  const parts = [game, region, releaseKey, language, collectorNumber];
  if (parts.some((p) => typeof p !== "string" || !p.trim()))
    throw Error("Incomplete card identity");
  return JSON.stringify(parts);
}
export function ownershipIdentity(cardId, variantId) {
  if (typeof cardId !== "string" || typeof variantId !== "string" || !variantId)
    throw Error("Incomplete variant identity");
  return JSON.stringify([cardId, variantId]);
}
export function createCollection(reference) {
  return validateCollection({
    format: "card-ledger",
    version: 1,
    reference: structuredClone(reference),
    quantities: {},
    draft: {
      releaseId: reference.releases[0]?.id || "",
      language: "en",
      text: "",
      variant: "unspecified",
    },
    batch: [],
  });
}
export function findCard(state, id) {
  const card = state.reference.cards.find((c) => c.id === id);
  if (!card) throw Error("Unknown reference card");
  return card;
}
export function variantQuantity(state, cardId, variantId) {
  return state.quantities[ownershipIdentity(cardId, variantId)] ?? 0;
}
export function quantity(state, cardId) {
  return findCard(state, cardId).variants.reduce(
    (sum, v) => sum + variantQuantity(state, cardId, v.id),
    0,
  );
}
export function status(state, cardId) {
  const n = quantity(state, cardId);
  return {
    owned: n > 0,
    needed: n === 0,
    duplicate: n > 1,
    copies: n,
    badge: n > 1 ? `×${n}` : "",
  };
}
export function setQuantity(state, cardId, variantId, value) {
  const card = findCard(state, cardId);
  if (!card.variants.some((v) => v.id === variantId))
    throw Error("Unknown card variant");
  if (!Number.isSafeInteger(value) || value < 0 || value > 999)
    throw Error("Quantity must be an integer from 0 to 999");
  const next = structuredClone(state);
  next.quantities[ownershipIdentity(cardId, variantId)] = value;
  return validateCollection(next);
}
export function addCopies(state, entries) {
  let next = state;
  for (const { cardId, variantId } of entries) {
    next = setQuantity(
      next,
      cardId,
      variantId,
      variantQuantity(next, cardId, variantId) + 1,
    );
  }
  return next;
}
export function completion(state, releaseId) {
  const release = state.reference.releases.find((r) => r.id === releaseId);
  if (!release) throw Error("Unknown release");
  const cards = state.reference.cards.filter((c) => c.releaseId === releaseId);
  const owned = cards.filter((c) => quantity(state, c.id) > 0).length;
  const completeReference =
    release.checklist.complete === true &&
    cards.length === release.checklist.expectedTotal &&
    cards.length > 0;
  return {
    owned,
    tracked: cards.length,
    completeReference,
    percent: completeReference
      ? Math.floor((100 * owned) / cards.length)
      : null,
    completed: completeReference && owned === cards.length,
  };
}
function numberToken(value) {
  const m = String(value)
    .normalize("NFKC")
    .trim()
    .match(/^([A-Za-z]*)(\d+)([A-Za-z]*)$/);
  return m
    ? `${m[1].toUpperCase()}${m[2].replace(/^0+(?=\d)/, "")}${m[3].toUpperCase()}`
    : null;
}
// Discovery lists possible identities; it never assigns ownership from a number alone.
export function searchCandidates(
  reference,
  { releaseId = "", language = "", raw },
) {
  const result = (status, candidates = []) => ({
    status,
    candidates,
    requiresConfirmation: !releaseId || !language || candidates.length !== 1,
  });
  const releases = reference.releases.filter(
    (r) =>
      (!releaseId || r.id === releaseId) &&
      (!language || r.language === language),
  );
  if (!releases.length) return result("context");
  const parts = String(raw).normalize("NFKC").trim().split("/");
  const token = numberToken(parts[0]);
  if (
    !token ||
    parts.length > 2 ||
    (parts.length === 2 && !numberToken(parts[1]))
  )
    return result("invalid");
  const eligible = new Set(
    releases
      .filter(
        (r) =>
          parts.length === 1 ||
          numberToken(parts[1]) === numberToken(r.printedTotal),
      )
      .map((r) => r.id),
  );
  const candidates = reference.cards
    .filter(
      (c) =>
        eligible.has(c.releaseId) && numberToken(c.collectorNumber) === token,
    )
    .map((c) => c.id);
  return result(candidates.length ? "candidate" : "missing", candidates);
}
export function matchCards(reference, { releaseId, language, raw }) {
  // Authoritative matching still requires the full release and language context.
  if (!releaseId || !language) return { status: "context", candidates: [] };
  const { status, candidates } = searchCandidates(reference, {
    releaseId,
    language,
    raw,
  });
  return { status, candidates };
}
export function resetCollection(state) {
  return validateCollection({ ...structuredClone(state), quantities: {} });
}
export function exportBackup(state) {
  validateCollection(state);
  return JSON.stringify(
    {
      format: "card-ledger-backup",
      schemaVersion: 1,
      applicationVersion: "0.2.0",
      exportedAt: new Date().toISOString(),
      collection: state,
    },
    null,
    2,
  );
}
export function importBackup(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw Error("Backup is not valid JSON");
  }
  if (parsed?.format === "card-ledger-backup") {
    if (
      parsed.schemaVersion !== 1 ||
      typeof parsed.exportedAt !== "string" ||
      !Number.isFinite(Date.parse(parsed.exportedAt)) ||
      typeof parsed.applicationVersion !== "string"
    )
      throw Error("Unsupported or invalid backup envelope");
    return validateCollection(parsed.collection);
  }
  // The first alpha exported the collection directly; keep those backups compatible.
  return validateCollection(parsed);
}
function record(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}
function text(value) {
  return typeof value === "string" && value.length > 0;
}
export function validateCollection(state) {
  if (!record(state) || state.format !== "card-ledger" || state.version !== 1)
    throw Error("Unsupported Card Ledger backup format or version");
  const ref = state.reference;
  if (
    !record(ref) ||
    !Array.isArray(ref.releases) ||
    !Array.isArray(ref.cards) ||
    ref.releases.length === 0 ||
    ref.cards.length === 0 ||
    !record(state.quantities) ||
    !record(state.draft) ||
    !Array.isArray(state.batch)
  )
    throw Error("Backup is missing collection data");
  const releases = new Map();
  for (const r of ref.releases) {
    if (
      !record(r) ||
      ![
        r.id,
        r.game,
        r.region,
        r.releaseKey,
        r.language,
        r.name,
        r.printedTotal,
      ].every(text) ||
      !record(r.checklist) ||
      typeof r.checklist.complete !== "boolean" ||
      (r.checklist.expectedTotal !== null &&
        (!Number.isSafeInteger(r.checklist.expectedTotal) ||
          r.checklist.expectedTotal < 1)) ||
      releases.has(r.id)
    )
      throw Error("Invalid or duplicate release metadata");
    releases.set(r.id, r);
  }
  const cards = new Set(),
    keys = new Set();
  for (const c of ref.cards) {
    if (!record(c)) throw Error("Invalid card metadata");
    const r = releases.get(c.releaseId);
    if (
      !record(c) ||
      !r ||
      !text(c.name) ||
      c.id !== cardIdentity(c) ||
      c.game !== r.game ||
      c.region !== r.region ||
      c.releaseKey !== r.releaseKey ||
      c.language !== r.language ||
      cards.has(c.id) ||
      !Array.isArray(c.variants) ||
      !c.variants.length
    )
      throw Error("Invalid or duplicate card metadata");
    cards.add(c.id);
    const variants = new Set();
    for (const v of c.variants) {
      if (!record(v) || !text(v.id) || !text(v.label) || variants.has(v.id))
        throw Error("Invalid or duplicate variant");
      variants.add(v.id);
      keys.add(ownershipIdentity(c.id, v.id));
    }
  }
  for (const [key, n] of Object.entries(state.quantities))
    if (!keys.has(key) || !Number.isSafeInteger(n) || n < 0 || n > 999)
      throw Error("Invalid quantity or missing reference metadata");
  for (const c of ref.cards)
    if (
      c.variants.reduce(
        (n, v) => n + (state.quantities[ownershipIdentity(c.id, v.id)] ?? 0),
        0,
      ) > 999
    )
      throw Error("Total card quantity exceeds 999");
  if (
    !["releaseId", "language", "text", "variant"].every(
      (k) => typeof state.draft[k] === "string",
    ) ||
    state.draft.text.length > 100000 ||
    state.batch.length > 500
  )
    throw Error("Invalid saved input");
  const rows = new Set();
  for (const row of state.batch) {
    if (
      !record(row) ||
      !text(row.raw) ||
      !Number.isInteger(row.i) ||
      rows.has(row.i) ||
      !Array.isArray(row.candidates) ||
      row.candidates.some((id) => !cards.has(id)) ||
      (row.chosen !== null &&
        (!row.candidates.includes(row.chosen) ||
          !keys.has(ownershipIdentity(row.chosen, row.variantId))))
    )
      throw Error("Invalid pending review");
    rows.add(row.i);
  }
  return structuredClone(state);
}
