import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { catalogueFixture } from "./fixtures/catalogue.js";
import { readSaved, installFixture, track } from "./browser-helpers.js";
const owned = (state) =>
  Object.values(state.quantities).reduce((n, value) => n + value, 0);
const openPO = async (page) => {
  await page.locator('[data-nav="collection"]').click();
  if (await page.locator("#binders").isVisible())
    await page.locator("#binders").click();
  await page.locator('[data-binder="perfect-order-en"]').click();
  await expect(page.locator(".pockets")).toBeVisible();
};
const enter = async (page, raw) => {
  await page.locator("#rapid-number").fill(raw);
  await page.locator("#rapid-number").press("Enter");
  await expect(page.locator("#rapid-number")).toHaveValue("");
  await expect(page.locator("#rapid-number")).toBeFocused();
};
test("real registry is cached, researching releases stay unavailable and production starts empty", async ({
  page,
}, testInfo) => {
  await page.goto("/tcg/");
  await page.locator("#manage-sets").click();
  await expect(page.locator("[data-track]")).toHaveCount(7);
  for (const id of ["perfect-order-en", "destined-rivals-en"])
    await expect(page.locator(`[data-track="${id}"]`)).toBeEnabled();
  for (const button of await page.locator("[data-track]:disabled").all())
    await expect(button).toBeDisabled();
  await expect(page.locator("[data-track]:disabled")).toHaveCount(5);
  const saved = await readSaved(page);
  expect(saved.reference.manifest.schemaVersion).toBe(1);
  expect(saved.reference.releases).toHaveLength(7);
  expect(saved.reference.cards).toHaveLength(0);
  expect(saved.quantities).toEqual({});
  expect(saved.trackedSets).toEqual([]);
  await page.locator("#set-search").fill("PO");
  await expect(page.locator("[data-track]")).toHaveCount(1);
  await page.locator("#set-search").fill("Chinese 30th");
  await expect(page.locator("[data-track]")).toHaveCount(2);
  await page.screenshot({
    path: testInfo.outputPath("registry-researching.png"),
    fullPage: true,
  });
  await page.locator("#sets-back").click();
  await expect(page.locator("[data-binder]")).toHaveCount(0);
  await page.locator('[data-nav="catalogue"]').click();
  const download = page.waitForEvent("download");
  await page.locator("#backup").click();
  expect(
    JSON.parse(await readFile(await (await download).path(), "utf8")).collection
      .quantities,
  ).toEqual({});
});
test("dynamic tracked set drives binder, Rapid Entry increments copies and missing slot adds directly", async ({
  page,
}, testInfo) => {
  await installFixture(page);
  await page.goto("/tcg/");
  await expect(page.locator("#reference-warning")).toContainText(
    "Development fixture",
  );
  await track(page, "perfect-order-en");
  await expect(page.locator("[data-binder]")).toHaveCount(1);
  expect((await readSaved(page)).reference.cards).toHaveLength(100);
  await openPO(page);
  await expect(page.locator(".pocket")).toHaveCount(9);
  await page.locator("#rapid-entry").click();
  await expect(page.locator("#rapid-set")).toHaveValue("perfect-order-en");
  await enter(page, "94");
  await enter(page, "094/088");
  await enter(page, "98");
  await enter(page, "100");
  await expect(page.locator("#rapid-recent")).toContainText("Own 2 · ×2");
  let state = await readSaved(page);
  expect(owned(state)).toBe(4);
  expect(Object.keys(state.quantities)).toHaveLength(3);
  await page.screenshot({
    path: testInfo.outputPath("rapid-entry.png"),
    fullPage: true,
  });
  await page.reload();
  await openPO(page);
  await expect(page.locator("#completion")).toContainText("3 / 100 tracked");
  await expect(page.locator("#physical-count")).toHaveText(
    "Physical cards: 4 · Spare copies: 1",
  );
  const missing = page.locator(".pocket").first();
  await missing.click();
  await page.locator("#add-missing").click();
  await expect(missing).toHaveAttribute("aria-label", /owned 1$/);
  await expect(missing).toBeFocused();
  expect(owned(await readSaved(page))).toBe(5);
  await page.locator("#undo").click();
  await expect(missing).toHaveAttribute("aria-label", /needed/);
  await page.locator("#binders").click();
  await page.locator("#manage-sets").click();
  await page.locator('[data-untrack="perfect-order-en"]').click();
  await page.locator("#sets-back").click();
  await expect(page.locator("[data-binder]")).toHaveCount(0);
  expect(owned(await readSaved(page))).toBe(4);
  await track(page, "perfect-order-en");
  await expect(page.locator("[data-binder]")).toHaveCount(1);
  expect(owned(await readSaved(page))).toBe(4);
});
test("ambiguous Rapid Entry requires confirmation and language identities survive backup/reset/import", async ({
  page,
}) => {
  await installFixture(page);
  await page.goto("/tcg/");
  for (const id of ["perfect-order-en", "fixture-second-en", "fixture-cn"])
    await track(page, id);
  await openPO(page);
  await page.locator("#rapid-entry").click();
  await page.locator("#rapid-set").selectOption("");
  await page.locator("#rapid-language").selectOption("");
  await page.locator("#rapid-number").fill("94/88");
  await page.locator("#rapid-number").press("Enter");
  await expect(page.locator("[data-rapid-choose]")).toHaveCount(3);
  expect(owned(await readSaved(page))).toBe(0);
  await page.locator("#close").click();
  await expect(page.locator("#detail")).not.toBeVisible();
  await expect(page.locator("#rapid-number")).toBeFocused();
  await expect(page.locator("#rapid-number")).toHaveValue("94/88");
  await page.locator("#rapid-number").press("Enter");
  await page.locator('[data-rapid-choose="fixture:fixture-cn:94"]').click();
  await expect(page.locator("#rapid-number")).toHaveValue("");
  await expect(page.locator("#rapid-number")).toBeFocused();
  const before = await readSaved(page);
  expect(owned(before)).toBe(1);
  expect(Object.keys(before.quantities)[0]).toContain("fixture-cn");
  await page.locator('[data-nav="catalogue"]').click();
  const download = page.waitForEvent("download");
  await page.locator("#backup").click();
  const backup = await readFile(await (await download).path(), "utf8");
  expect(backup).toContain("测试卡");
  await page.locator("#reset-collection").click();
  await page.locator("#confirm-reset").click();
  await expect(page.locator("#detail")).not.toBeVisible();
  const reset = await readSaved(page);
  expect(owned(reset)).toBe(0);
  expect(reset.reference).toEqual(before.reference);
  expect(reset.trackedSets).toEqual(before.trackedSets);
  await page.locator("#import-backup").setInputFiles({
    name: "collection.json",
    mimeType: "application/json",
    buffer: Buffer.from(backup),
  });
  await page.locator("#restore-backup").click();
  await expect.poll(async () => owned(await readSaved(page))).toBe(1);
});
test("reference refresh preserves ownership, rejects bad updates and reload uses valid cache during outage", async ({
  page,
}) => {
  let fixture = catalogueFixture();
  await installFixture(page, () => fixture);
  await page.goto("/tcg/");
  await track(page, "perfect-order-en");
  await openPO(page);
  await page.locator("#rapid-entry").click();
  await enter(page, "94");
  await enter(page, "94");
  const quantities = (await readSaved(page)).quantities;
  fixture = catalogueFixture("fixture-2");
  fixture.packs["perfect-order-en"].cards[93].name = "Corrected fixture card";
  await page.locator('[data-nav="collection"]').click();
  await page.locator("#binders").click();
  await page.locator("#manage-sets").click();
  await page.locator("#refresh-reference").click();
  await expect
    .poll(async () => (await readSaved(page)).reference.cards[93].name)
    .toBe("Corrected fixture card");
  expect((await readSaved(page)).quantities).toEqual(quantities);
  fixture = catalogueFixture("fixture-3");
  fixture.packs["perfect-order-en"].cards[93].language = "zh-Hans";
  await page.locator("#refresh-reference").click();
  await expect(page.locator("#reference-warning")).toContainText(
    "Last valid reference was kept",
  );
  const cached = await readSaved(page);
  expect(cached.reference.cards[93].name).toBe("Corrected fixture card");
  expect(cached.quantities).toEqual(quantities);
  await page.route("**/tcg-data/manifest.json", (route) => route.abort());
  await page.reload();
  await expect(page.locator("#reference-warning")).toContainText(
    "cached cards are still usable",
  );
  await openPO(page);
  await page.locator("#rapid-entry").click();
  await enter(page, "94");
  expect(owned(await readSaved(page))).toBe(3);
});

test("curated image metadata renders a local scan and falls back from an unavailable large image", async ({
  page,
}) => {
  const fixture = catalogueFixture();
  const c = fixture.packs["perfect-order-en"].cards[0];
  c.images = {
    small: "images/test-card.svg",
    large: "/tcg-data/images/missing.webp",
    source: "Development fixture",
  };
  await installFixture(page, () => fixture);
  await page.route("**/tcg-data/images/test-card.svg", (route) =>
    route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="140"><rect width="100" height="140" fill="#0951dc"/><text x="8" y="70" fill="white">Fixture image</text></svg>',
    }),
  );
  await page.goto("/tcg/");
  await track(page, "perfect-order-en");
  await openPO(page);
  const pocket = page.locator(".pocket").first();
  await pocket.click();
  await expect(page.locator(".detail-art img")).toHaveAttribute(
    "src",
    /test-card.svg$/,
  );
  await expect
    .poll(() =>
      page.locator(".detail-art img").evaluate((img) => img.naturalWidth),
    )
    .toBe(100);
  await expect(page.locator(".detail-art img")).toBeVisible();
  await page.locator("#add-missing").click();
  await expect
    .poll(() => pocket.locator("img").evaluate((img) => img.naturalWidth))
    .toBe(100);
});

test("batch reference example comes from the selected dynamic file without seeding ownership", async ({
  page,
}) => {
  const fixture = catalogueFixture(),
    first = fixture.packs["perfect-order-en"].cards[0];
  first.collectorNumber = "XY99";
  first.printedNumber = "XY99";
  first.name = "Source supplied example";
  await installFixture(page, () => fixture);
  await page.goto("/tcg/");
  await track(page, "perfect-order-en");
  await openPO(page);
  await page.locator('[data-nav="add"]').click();
  await page.locator("#try").click();
  await expect(page.locator("#numbers")).toHaveValue("XY99");
  expect(owned(await readSaved(page))).toBe(0);
  await page.locator("#find").click();
  await expect(page.locator(".summary")).toHaveText(
    "1 ready · 0 need checking",
  );
  await expect(page.locator(".review-row")).toContainText(
    "Source supplied example",
  );
  await page.locator("#commit").click();
  await expect.poll(async () => owned(await readSaved(page))).toBe(1);
});
