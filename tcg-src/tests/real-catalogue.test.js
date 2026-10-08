import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  adaptPack,
  validateManifest,
  emptyReference,
  mergeManifest,
  mergePack,
} from "../src/providers/catalogue.js";
import {
  createCollection,
  setQuantity,
  quantity,
  searchCandidates,
  completion,
  trackRelease,
  exportBackup,
  setNumberMismatch,
} from "../src/domain/collection.js";
const read = async (file) =>
  JSON.parse(
    await readFile(new URL(`../../tcg-data/${file}`, import.meta.url), "utf8"),
  );
const actual = await read("manifest.json");
const packs = Object.fromEntries(
  await Promise.all(
    actual.releases
      .filter((r) => r.readyForApp)
      .map(async (r) => [r.id, await read(r.cardsFile)]),
  ),
);

test("real ready checklists validate counts, order, independent IDs, images and provenance", () => {
  validateManifest(actual);
  for (const [id, expected, denominator] of [
    ["perfect-order-en", 124, 88],
    ["destined-rivals-en", 244, 182],
  ]) {
    const pack = packs[id],
      parsed = adaptPack(actual, id, pack);
    assert.equal(parsed.cards.length, expected);
    assert.equal(parsed.release.printedDenominator, denominator);
    assert.equal(parsed.release.checklist.complete, true);
    assert.deepEqual(parsed.release.cardSource, pack.source);
    assert.equal(new Set(parsed.cards.map((c) => c.id)).size, expected);
    assert.equal(
      new Set(parsed.cards.map((c) => c.collectorNumber)).size,
      expected,
    );
    assert.deepEqual(
      parsed.cards.map((c) => Number(c.collectorNumber)),
      Array.from({ length: expected }, (_, i) => i + 1),
    );
    for (let i = 0; i < expected; i++) {
      const c = parsed.cards[i],
        wire = pack.cards[i];
      assert.equal(c.id, wire.id);
      assert.notEqual(c.id, c.providerRefs.tcgdex);
      assert.deepEqual(c.source, wire.source);
      assert.deepEqual(c.images, wire.images);
      assert.match(c.images.small, /^https:\/\/assets\.tcgdex\.net\//);
    }
    const state = mergePack(
      mergeManifest(createCollection(emptyReference()), actual),
      parsed,
    );
    assert.equal(completion(state, id).owned, 0);
    assert.deepEqual(state.quantities, {});
  }
});

test("real lookup resolves padded numbers inside release and requires global choice", () => {
  let state = mergeManifest(createCollection(emptyReference()), actual);
  for (const id of Object.keys(packs))
    state = mergePack(state, adaptPack(actual, id, packs[id]));
  for (const [releaseId, raw, name, printed] of [
    ["perfect-order-en", "94", "Clefairy", "094/088"],
    ["perfect-order-en", "094", "Clefairy", "094/088"],
    ["perfect-order-en", "094/088", "Clefairy", "094/088"],
    ["destined-rivals-en", "49", "Misty's Gyarados", "049/182"],
    ["destined-rivals-en", "101", "Regirock ex", "101/182"],
  ]) {
    const match = searchCandidates(state.reference, {
      releaseId,
      language: "en",
      raw,
    });
    assert.equal(match.candidates.length, 1);
    assert.equal(match.requiresConfirmation, false);
    const c = state.reference.cards.find((c) => c.id === match.candidates[0]);
    assert.equal(c.name, name);
    assert.equal(c.printedNumber, printed);
  }
  const global = searchCandidates(state.reference, {
    language: "en",
    raw: "49",
  });
  assert.equal(global.candidates.length, 2);
  assert.equal(global.requiresConfirmation, true);
});

test("wrong-set printed totals offer ready releases without weakening exact matching", () => {
  let state = mergePack(
    mergeManifest(createCollection(emptyReference()), actual),
    adaptPack(actual, "perfect-order-en", packs["perfect-order-en"]),
  );
  const query = { releaseId: "perfect-order-en", language: "en", raw: "119/182" };
  const before = structuredClone(state);
  assert.deepEqual(searchCandidates(state.reference, query).candidates, []);
  assert.deepEqual(setNumberMismatch(state.reference, query), {
    releaseName: "Perfect Order",
    expectedTotals: ["088"],
    matchingReleaseIds: ["destined-rivals-en"],
  });
  assert.deepEqual(state, before);
  for (const raw of ["119", "119/088", "119/88", "999/88", "119/18?", "119/182/88"])
    assert.equal(setNumberMismatch(state.reference, { ...query, raw }), null);
  assert.equal(setNumberMismatch(state.reference, { ...query, releaseId: "" }), null);
  assert.deepEqual(setNumberMismatch(state.reference, { ...query, raw: "119/999" }).matchingReleaseIds, []);
  state = mergePack(state, adaptPack(actual, "destined-rivals-en", packs["destined-rivals-en"]));
  assert.deepEqual(searchCandidates(state.reference, query).candidates, []);
  const elsewhere = searchCandidates(state.reference, { ...query, releaseId: "" });
  assert.equal(elsewhere.requiresConfirmation, true);
  assert.deepEqual(elsewhere.candidates, ["pokemon:en:destined-rivals:119"]);
  const restricted = structuredClone(state.reference);
  restricted.releases.find((r) => r.id === "destined-rivals-en").readyForApp = false;
  assert.deepEqual(setNumberMismatch(restricted, query).matchingReleaseIds, []);
});

test("real catalogue upgrade preserves incompatible old controlled IDs without inventing ownership", async () => {
  const oldPack = JSON.parse(
    await readFile(
      new URL("./fixtures/perfect-order-2026-10-08.1.json", import.meta.url),
      "utf8",
    ),
  );
  const prior = { ...actual, dataVersion: "2026-10-08.1" };
  let state = mergePack(
    mergeManifest(createCollection(emptyReference()), prior),
    adaptPack(prior, "perfect-order-en", oldPack),
  );
  const old = state.reference.cards.find((c) => c.printedNumber === "094/088");
  assert.equal(old.id, "pokemon:en:perfect-order-en:094");
  state = setQuantity(state, old.id, "unspecified", 2);
  state = trackRelease(state, "perfect-order-en");
  state.notes = "保留 · previous collection";
  const before = structuredClone(state.quantities);
  const updated = mergePack(
    mergeManifest(state, actual),
    adaptPack(actual, "perfect-order-en", packs["perfect-order-en"]),
  );
  assert.deepEqual(updated.quantities, before);
  assert.equal(quantity(updated, old.id), 2);
  assert.equal(
    updated.reference.cards.find((c) => c.id === old.id).retired,
    true,
  );
  assert.equal(quantity(updated, "pokemon:en:perfect-order:094"), 0);
  assert.deepEqual(updated.trackedSets, state.trackedSets);
  assert.equal(updated.notes, state.notes);
  assert.equal(completion(updated, "perfect-order-en").tracked, 124);
  assert.equal(completion(updated, "perfect-order-en").owned, 0);
  assert.equal(
    searchCandidates(updated.reference, {
      releaseId: "perfect-order-en",
      language: "en",
      raw: "94",
    }).candidates.length,
    1,
  );
  assert.ok(exportBackup(updated).includes(old.id));
});

test("bad real pack validation cannot mutate the last valid ownership/cache", () => {
  const state = mergePack(
    mergeManifest(createCollection(emptyReference()), actual),
    adaptPack(actual, "perfect-order-en", packs["perfect-order-en"]),
  );
  for (const edit of [
    (p) => (p.releaseId = "destined-rivals-en"),
    (p) => p.cards.pop(),
    (p) => (p.cards[1].id = p.cards[0].id),
    (p) => (p.cards[0].language = "zh-Hans"),
    (p) => (p.source = []),
  ]) {
    const pack = structuredClone(packs["perfect-order-en"]),
      before = structuredClone(state);
    edit(pack);
    assert.throws(() => adaptPack(actual, "perfect-order-en", pack));
    assert.deepEqual(state, before);
  }
});
