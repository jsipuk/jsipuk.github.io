import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  createCollection,
  matchCards,
  setQuantity,
  quantity,
  completion,
  cardIdentity,
} from "../src/domain/collection.js";
import { adaptTCGdexSet, PINNED_REVISION } from "../scripts/legacy/tcgdex.js";
const reference = JSON.parse(
  await readFile(
    new URL("./fixtures/legacy-reference.json", import.meta.url),
    "utf8",
  ),
);
test("pinned real reference contains nine English releases and 889 distinct cards", () => {
  const state = createCollection(reference);
  assert.equal(state.reference.releases.length, 9);
  assert.equal(reference.cards.length, 889);
  assert.equal(new Set(reference.cards.map((c) => c.id)).size, 889);
  assert.equal(reference.source.revision, PINNED_REVISION);
  assert.ok(
    reference.cards.every(
      (c) => c.language === "en" && c.region === "international",
    ),
  );
});
test("real Charizard 4/102 and Evelyn 175/181 match only in their supplied release", () => {
  const base = reference.releases.find((r) => r.releaseKey === "base-set-1999");
  const team = reference.releases.find((r) => r.releaseKey === "team-up-2019");
  const charizard = matchCards(reference, {
    releaseId: base.id,
    language: "en",
    raw: "004/102",
  }).candidates;
  assert.equal(charizard.length, 1);
  assert.equal(
    reference.cards.find((c) => c.id === charizard[0]).name,
    "Charizard",
  );
  const evelyn = matchCards(reference, {
    releaseId: team.id,
    language: "en",
    raw: "175/181",
  }).candidates;
  assert.equal(evelyn.length, 1);
  assert.equal(reference.cards.find((c) => c.id === evelyn[0]).name, "Evelyn");
  const s = setQuantity(
    createCollection(reference),
    charizard[0],
    "unspecified",
    3,
  );
  assert.equal(quantity(s, charizard[0]), 3);
  assert.equal(completion(s, base.id).owned, 1);
  assert.equal(completion(s, base.id).percent, null);
  assert.equal(
    matchCards(reference, {
      releaseId: team.id,
      language: "en",
      raw: "004/102",
    }).status,
    "missing",
  );
});
test("adapter keeps provider IDs out of ownership and does not guess absent variants", () => {
  const source = {
    id: "external",
    name: { en: "Release" },
    releaseDate: "2000-01-01",
    cardCount: { official: 1 },
    serie: { id: "series" },
  };
  const registration = { providerId: "external", releaseKey: "app-release" };
  const result = adaptTCGdexSet(source, registration, [
    {
      localId: "A001",
      card: { name: { en: "Real card" }, set: source, rarity: "Rare Holo" },
    },
  ]);
  const c = result.cards[0];
  assert.equal(c.id, cardIdentity(c));
  assert.equal(c.variants.length, 1);
  assert.equal(c.image.availability, "unverified");
  assert.equal(result.release.checklist.complete, false);
  assert.throws(() =>
    adaptTCGdexSet(source, registration, [
      { localId: "1", card: { name: { fr: "French only" }, set: source } },
    ]),
  );
});
