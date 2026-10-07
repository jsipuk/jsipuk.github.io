import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { catalogueFixture } from "./fixtures/catalogue.js";
import {
  validateManifest,
  emptyReference,
  mergeManifest,
  adaptPack,
  mergePack,
  fetchPack,
  releaseMatches,
} from "../src/providers/catalogue.js";
import {
  createCollection,
  trackRelease,
  setQuantity,
  quantity,
  searchCandidates,
  completion,
} from "../src/domain/collection.js";
const { manifest, packs } = catalogueFixture();
const imported = () =>
  mergePack(
    mergeManifest(createCollection(emptyReference()), manifest),
    adaptPack(manifest, "perfect-order-en", packs["perfect-order-en"]),
  );
test("actual curated manifest parses; every current release is researching and unavailable", async () => {
  const actual = validateManifest(
    JSON.parse(
      await readFile(
        new URL("../../tcg-data/manifest.json", import.meta.url),
        "utf8",
      ),
    ),
  );
  assert.equal(actual.releases.length, 6);
  assert.ok(
    actual.releases.every(
      (r) => !r.readyForApp && r.checklistStatus === "researching",
    ),
  );
  const state = mergeManifest(createCollection(emptyReference()), actual);
  assert.equal(state.reference.releases.length, 6);
  assert.equal(state.reference.cards.length, 0);
  assert.deepEqual(state.quantities, {});
  assert.throws(() => trackRelease(state, actual.releases[0].id), /not ready/);
  let called = false;
  await assert.rejects(
    fetchPack(actual, actual.releases[0].id, () => {
      called = true;
    }),
    /not app-ready/,
  );
  assert.equal(called, false);
});
test("ready file imports dynamically; canonical IDs retain language, release, number and provider independence", () => {
  const state = imported(),
    c = state.reference.cards.find((c) => c.collectorNumber === "94");
  assert.equal(c.id, "fixture:perfect-order-en:94");
  assert.equal(state.reference.releases[0].printedDenominator, 88);
  assert.equal(state.reference.releases[0].numberedCardCount, 100);
  const pack = structuredClone(packs["perfect-order-en"]);
  pack.cards[93].providerRefs.fixture = "changed";
  assert.equal(
    adaptPack(manifest, "perfect-order-en", pack).cards[93].id,
    c.id,
  );
  const cn = adaptPack(manifest, "fixture-cn", packs["fixture-cn"]);
  assert.notEqual(cn.cards[93].id, c.id);
});
test("local resolver uses active context, leading zeroes and denominator; global ambiguities need confirmation", () => {
  let state = imported();
  state = mergePack(
    state,
    adaptPack(manifest, "fixture-second-en", packs["fixture-second-en"]),
  );
  for (const raw of ["94", "094", "094/088", "94/88"]) {
    const match = searchCandidates(state.reference, {
      releaseId: "perfect-order-en",
      language: "en",
      raw,
    });
    assert.deepEqual(match.candidates, ["fixture:perfect-order-en:94"]);
    assert.equal(match.requiresConfirmation, false);
  }
  const ambiguous = searchCandidates(state.reference, { raw: "94/88" });
  assert.equal(ambiguous.candidates.length, 2);
  assert.equal(ambiguous.requiresConfirmation, true);
  const pack = structuredClone(packs["perfect-order-en"]);
  pack.cards[0].collectorNumber = "TG12";
  pack.cards[0].printedNumber = "TG12/TG30";
  pack.cards[1].collectorNumber = "30TH-P 004";
  pack.cards[1].printedNumber = "30TH-P 004";
  pack.cards[2].collectorNumber = "SWSH123";
  pack.cards[2].printedNumber = "SWSH123";
  state = mergePack(
    mergeManifest(createCollection(emptyReference()), manifest),
    adaptPack(manifest, "perfect-order-en", pack),
  );
  assert.equal(
    searchCandidates(state.reference, { raw: "TG12/TG30" }).candidates.length,
    1,
  );
  assert.equal(
    searchCandidates(state.reference, { raw: "30th-p 004" }).candidates.length,
    1,
  );
  assert.equal(
    searchCandidates(state.reference, { raw: "SWSH123" }).candidates.length,
    1,
  );
});
test("tracking only changes shelf membership; removing tracking preserves ownership", () => {
  let state = trackRelease(imported(), "perfect-order-en");
  state = setQuantity(state, state.reference.cards[93].id, "unspecified", 3);
  assert.deepEqual(state.trackedSets, ["perfect-order-en"]);
  const untracked = trackRelease(state, "perfect-order-en", false);
  assert.deepEqual(untracked.trackedSets, []);
  assert.deepEqual(untracked.quantities, state.quantities);
  assert.equal(completion(state, "perfect-order-en").owned, 1);
  assert.equal(releaseMatches(manifest.releases[0], "PO"), true);
});
test("reference metadata updates keep exact quantities; removed IDs and finishes are retained safely", () => {
  let state = imported(),
    c = state.reference.cards[93];
  state = setQuantity(state, c.id, "regular", 3);
  const next = catalogueFixture("fixture-2"),
    pack = next.packs["perfect-order-en"];
  pack.cards[93].name = "Corrected reference name";
  pack.cards[93].variants = [];
  const refreshed = mergePack(
    state,
    adaptPack(next.manifest, "perfect-order-en", pack),
  );
  assert.equal(refreshed.reference.cards[93].name, "Corrected reference name");
  assert.equal(quantity(refreshed, c.id), 3);
  assert.deepEqual(refreshed.quantities, state.quantities);
  const partial = structuredClone(next.manifest);
  partial.releases[0].checklistStatus = "partial";
  pack.cards.splice(93, 1);
  const removed = mergePack(
    refreshed,
    adaptPack(partial, "perfect-order-en", pack),
  );
  assert.equal(quantity(removed, c.id), 3);
  assert.equal(
    removed.reference.cards.find((card) => card.id === c.id).retired,
    true,
  );
  assert.equal(completion(removed, "perfect-order-en").completed, false);
  assert.equal(completion(removed, "perfect-order-en").percent, null);
  assert.equal(
    searchCandidates(removed.reference, {
      releaseId: "perfect-order-en",
      raw: "94",
    }).candidates.length,
    0,
  );
});
test("bad release updates are rejected before cache mutation", () => {
  const state = imported(),
    bad = structuredClone(packs["perfect-order-en"]);
  bad.cards[0].language = "zh-Hans";
  assert.throws(
    () => adaptPack(manifest, "perfect-order-en", bad),
    /does not match/,
  );
  assert.equal(state.reference.cards[0].language, "en");
  const duplicate = structuredClone(packs["perfect-order-en"]);
  duplicate.cards[1].id = duplicate.cards[0].id;
  assert.throws(
    () => adaptPack(manifest, "perfect-order-en", duplicate),
    /Duplicate/,
  );
  const count = structuredClone(packs["perfect-order-en"]);
  count.cards.pop();
  assert.throws(() => adaptPack(manifest, "perfect-order-en", count), /count/);
});

test("retracted readiness blocks new entry/tracking while keeping saved ownership and metadata", () => {
  let state = trackRelease(imported(), "perfect-order-en");
  state = setQuantity(state, state.reference.cards[93].id, "unspecified", 3);
  const changed = structuredClone(manifest);
  changed.releases[0].readyForApp = false;
  const kept = mergeManifest(state, changed);
  assert.deepEqual(kept.quantities, state.quantities);
  assert.deepEqual(kept.trackedSets, state.trackedSets);
  assert.throws(() => trackRelease(kept, "perfect-order-en"), /not ready/);
  assert.equal(
    searchCandidates(kept.reference, {
      raw: "94",
      releaseId: "perfect-order-en",
      language: "en",
    }).candidates.length,
    0,
  );
  assert.equal(quantity(kept, "fixture:perfect-order-en:94"), 3);
});
test("opaque printed numbers can be ambiguous even inside a known release", () => {
  const pack = structuredClone(packs["perfect-order-en"]);
  pack.cards[0].id = "fixture:opaque:094";
  pack.cards[0].collectorNumber = "094";
  pack.cards[0].variants = ["regular", { id: "holo", finish: "Holo" }];
  const state = mergePack(
    mergeManifest(createCollection(emptyReference()), manifest),
    adaptPack(manifest, "perfect-order-en", pack),
  );
  const match = searchCandidates(state.reference, {
    raw: "94",
    releaseId: "perfect-order-en",
    language: "en",
  });
  assert.equal(match.candidates.length, 2);
  assert.equal(match.requiresConfirmation, true);
  assert.equal(state.reference.cards[0].collectorNumber, "094");
  assert.equal(state.reference.cards[0].variants[2].label, "Holo");
});
