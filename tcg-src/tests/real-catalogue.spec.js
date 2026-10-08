import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { readSaved, track } from "./browser-helpers.js";
import { createCollection, setQuantity } from "../src/domain/collection.js";
import {
  emptyReference,
  mergeManifest,
  mergePack,
  adaptPack,
} from "../src/providers/catalogue.js";
const read = async (file) =>
  JSON.parse(
    await readFile(new URL(`../../tcg-data/${file}`, import.meta.url), "utf8"),
  );
const open = async (page, id) => {
  await page.locator('[data-nav="collection"]').click();
  if (await page.locator("#binders").isVisible())
    await page.locator("#binders").click();
  await page.locator(`[data-binder="${id}"]`).click();
  await expect(page.locator(".pocket")).toHaveCount(9);
};
const enter = async (page, raw) => {
  await page.locator("#rapid-number").fill(raw);
  await page.locator("#rapid-number").press("Enter");
  await expect(page.locator("#rapid-number")).toHaveValue("");
  await expect(page.locator("#rapid-number")).toBeFocused();
  await expect(page.locator("#detail")).not.toBeVisible();
};

test("the prior researching registry upgrades normally and preserves an existing English collection", async ({
  page,
}) => {
  const oldManifest = JSON.parse(
    await readFile(
      new URL("./fixtures/researching-manifest.json", import.meta.url),
      "utf8",
    ),
  );
  const reference = JSON.parse(
    await readFile(
      new URL("./fixtures/legacy-reference.json", import.meta.url),
      "utf8",
    ),
  );
  reference.releases = reference.releases.map((r) => ({ ...r, legacy: true }));
  let state = mergeManifest(createCollection(reference), oldManifest);
  const card = state.reference.cards.find(
    (c) => c.name === "Charizard" && c.collectorNumber === "4",
  );
  state = setQuantity(state, card.id, "unspecified", 2);
  state.trackedSets = [card.releaseId];
  state.notes = "收藏 · keep previous ownership";
  state.rapidContext = { releaseId: card.releaseId, language: "en" };
  await page.addInitScript(
    (value) => localStorage.setItem("cardledger-alpha-v1", value),
    JSON.stringify(state),
  );
  await page.goto("/tcg/");
  await page.locator("#manage-sets").click();
  await expect(page.locator('[data-track="perfect-order-en"]')).toBeEnabled();
  await expect(page.locator('[data-track="destined-rivals-en"]')).toBeEnabled();
  const saved = await readSaved(page);
  expect(saved.reference.manifest.dataVersion).toBe("2026-10-08.2");
  expect(saved.quantities).toEqual(state.quantities);
  expect(saved.trackedSets).toEqual(state.trackedSets);
  expect(saved.notes).toBe(state.notes);
  expect(saved.rapidContext).toEqual(state.rapidContext);
});

test("untracked cached real set refreshes version without clearing quantities or settings", async ({
  page,
}) => {
  const current = await read("manifest.json");
  const prior = { ...current, dataVersion: "2026-10-08.1" };
  let state = mergeManifest(createCollection(emptyReference()), prior);
  state = mergePack(
    state,
    adaptPack(
      prior,
      "perfect-order-en",
      await read("sets/en/perfect-order.json"),
    ),
  );
  const clefairy = state.reference.cards.find(
    (c) => c.collectorNumber === "94",
  );
  state = setQuantity(state, clefairy.id, "unspecified", 2);
  state.notes = "收藏 · keep these notes";
  state.rapidContext = { releaseId: "perfect-order-en", language: "en" };
  await page.addInitScript(
    (value) => localStorage.setItem("cardledger-alpha-v1", value),
    JSON.stringify(state),
  );
  await page.goto("/tcg/");
  await expect(
    page.getByRole("heading", { name: "My collection", exact: true }),
  ).toBeVisible();
  await expect
    .poll(async () => (await readSaved(page)).reference.manifest.dataVersion)
    .toBe("2026-10-08.2");
  await expect
    .poll(
      async () =>
        (await readSaved(page)).reference.releases.find(
          (r) => r.id === "perfect-order-en",
        ).importedVersion,
    )
    .toBe("2026-10-08.2");
  const saved = await readSaved(page);
  expect(saved.trackedSets).toEqual([]);
  expect(saved.quantities).toEqual(state.quantities);
  expect(saved.notes).toBe(state.notes);
  expect(saved.rapidContext).toEqual(state.rapidContext);
});

test("real cards add, persist, duplicate and reset inside canonical binders", async ({
  page,
}) => {
  const referenceRequests = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/tcg-data/"))
      referenceRequests.push(request.url());
  });
  await page.goto("/tcg/");
  await track(page, "perfect-order-en");
  await open(page, "perfect-order-en");
  await expect(page.locator("#completion")).toContainText("0 / 124");
  await expect(page.locator(".pager")).toContainText("Page 1 of 14");
  await page.locator("#rapid-entry").click();
  const before = referenceRequests.length;
  await enter(page, "94");
  await expect(page.locator("#rapid-recent")).toContainText(
    "Clefairy · 094/088",
  );
  await page.reload();
  await open(page, "perfect-order-en");
  await expect(page.locator("#completion")).toContainText("1 / 124");
  await expect(page.locator("#physical-count")).toContainText(
    "Physical cards: 1",
  );
  await page.locator("#rapid-entry").click();
  const lookupStart = referenceRequests.length;
  await enter(page, "094");
  await expect(page.locator("#rapid-recent")).toContainText("Own 2 · ×2");
  await enter(page, "094/088");
  await expect(page.locator("#rapid-recent")).toContainText("Own 3 · ×3");
  expect(referenceRequests.length).toBe(lookupStart);
  expect(before).toBeGreaterThan(0);
  expect(
    (await readSaved(page)).reference.cards.filter(
      (c) => c.id === "pokemon:en:perfect-order:094",
    ),
  ).toHaveLength(1);
  await page.locator('[data-nav="catalogue"]').click();
  await page.locator("#reset-collection").click();
  await page.locator("#confirm-reset").click();
  let saved = await readSaved(page);
  expect(saved.quantities).toEqual({});
  expect(saved.reference.cards).toHaveLength(124);
  expect(saved.trackedSets).toContain("perfect-order-en");
  await track(page, "destined-rivals-en");
  await open(page, "destined-rivals-en");
  await expect(page.locator("#completion")).toContainText("0 / 244");
  await expect(page.locator(".pager")).toContainText("Page 1 of 28");
  await page.locator("#rapid-entry").click();
  await enter(page, "49");
  await expect(page.locator("#rapid-recent")).toContainText(
    "Misty's Gyarados · 049/182",
  );
  await enter(page, "101");
  await expect(page.locator("#rapid-recent")).toContainText(
    "Regirock ex · 101/182",
  );
  saved = await readSaved(page);
  expect(saved.reference.cards).toHaveLength(368);
  for (const [release, count] of [
    ["perfect-order-en", 124],
    ["destined-rivals-en", 244],
  ]) {
    const cards = saved.reference.cards.filter(
      (c) => c.releaseId === release && !c.retired,
    );
    expect(cards).toHaveLength(count);
    expect(cards.map((c) => Number(c.collectorNumber))).toEqual(
      Array.from({ length: count }, (_, i) => i + 1),
    );
  }
  await page.locator("#rapid-set").selectOption("");
  await page.locator("#rapid-language").selectOption("");
  await page.locator("#rapid-number").fill("49");
  await page.locator("#rapid-number").press("Enter");
  await expect(page.locator("[data-rapid-choose]")).toHaveCount(2);
  await expect(page.locator("#detail")).toContainText("Haunter");
  await expect(page.locator("#detail")).toContainText("Misty's Gyarados");
  await expect(page.locator("#detail .candidate-art img")).toHaveCount(2);
  expect((await readSaved(page)).quantities).toEqual(saved.quantities);
  await page.locator("#close").click();
});
