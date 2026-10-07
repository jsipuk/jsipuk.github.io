import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
const base = "pokemon:international:base-set-1999:en";
const openBase = async (page) => {
  await page.locator('[data-nav="collection"]').click();
  if (await page.locator("#binders").isVisible())
    await page.locator("#binders").click();
  await page
    .locator("[data-binder]")
    .filter({ has: page.locator(".label", { hasText: /^Base Set$/ }) })
    .click();
  await expect(page.locator(".pockets")).toBeVisible();
};
const charizard = (page) =>
  page
    .locator(".pocket")
    .filter({ has: page.locator(".card-number", { hasText: /^004/ }) });
const add = async (page, text) => {
  await page.locator('[data-nav="add"]').click();
  await page.locator("#set").selectOption(base);
  await page.locator("#language").selectOption("en");
  await page.locator("#numbers").fill(text);
  await page.locator("#find").click();
};
test("real collection preserves binder UI, persists quantities and round-trips a lossless backup", async ({
  page,
}, testInfo) => {
  await page.goto("/tcg/");
  await expect(page.locator("[data-binder]")).toHaveCount(9);
  await page.screenshot({
    path: testInfo.outputPath("alpha-shelf.png"),
    fullPage: true,
  });
  await add(page, "004/102\n4/102\n4/102");
  await expect(page.locator(".summary")).toHaveText(
    "3 ready · 0 need checking",
  );
  await expect(page.locator(".review-row strong").first()).toContainText(
    "Charizard",
  );
  await page.locator("#commit").click();
  await page.locator("#undo").click();
  await expect(page.locator(".summary")).toHaveText(
    "3 ready · 0 need checking",
  );
  await page.locator("#commit").click();
  await openBase(page);
  await expect(page.locator(".pocket")).toHaveCount(9);
  await expect(charizard(page).locator(".count")).toHaveText("×3");
  await expect(page.locator("#completion")).toContainText("1 / 102 unique");
  await expect(page.locator("#completion")).not.toContainText("100%");
  await page.reload();
  await openBase(page);
  await expect(charizard(page).locator(".count")).toHaveText("×3");
  await charizard(page).click();
  await expect(page.locator("#detail-title")).toHaveText("Charizard");
  await expect(page.locator("#qty")).toHaveText("3");
  await page.screenshot({
    path: testInfo.outputPath("alpha-expanded.png"),
    fullPage: true,
  });
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#needed").click();
  await page.locator("#save").click();
  await expect(charizard(page)).toHaveAttribute("aria-label", /needed/);
  const undo = page.locator("#undo");
  await expect(undo).toHaveCSS("color", "rgb(16, 30, 73)");
  await expect(undo).toHaveCSS("background-color", "rgb(255, 218, 34)");
  await undo.hover();
  await expect(undo).toHaveCSS("color", "rgb(16, 30, 73)");
  await undo.focus();
  await expect(undo).toHaveCSS("color", "rgb(16, 30, 73)");
  await page.screenshot({
    path: testInfo.outputPath("alpha-undo.png"),
    fullPage: true,
  });
  await undo.click();
  await expect(charizard(page).locator(".count")).toHaveText("×3");
  // Separate printing quantities contribute to the card's total, but count only one card for completion.
  await charizard(page).click();
  await page.locator("#finish").selectOption({ index: 1 });
  await expect(page.locator("#qty")).toHaveText("0");
  await page.locator("#plus").click();
  await page.locator("#save").click();
  await expect(charizard(page).locator(".count")).toHaveText("×4");
  await expect(page.locator("#completion")).toContainText("1 / 102 unique");
  await page.locator('[data-filter="duplicates"]').click();
  await expect(page.locator(".pocket:not(.filtered-out)")).toHaveCount(1);
  await page.locator("#list").click();
  await expect(page.locator(".list-card")).toHaveCount(1);
  await expect(page.locator(".list-card button")).toHaveText("×4");
  await page.locator("#grid").click();
  await page.locator('[data-filter="all"]').click();
  // Regression: an already-needed pocket saved as zero must never become owned.
  await page.locator(".pocket").first().click();
  await page.locator("#needed").click();
  await page.locator("#save").click();
  await expect(page.locator(".pocket").first()).toHaveAttribute(
    "aria-label",
    /needed/,
  );
  await add(page, "999/102");
  await expect(page.locator(".summary")).toHaveText(
    "0 ready · 1 need checking",
  );
  await page.locator('[data-nav="catalogue"]').click();
  const downloadPromise = page.waitForEvent("download");
  await page.locator("#backup").click();
  const download = await downloadPromise;
  const backup = await readFile(await download.path(), "utf8");
  const parsed = JSON.parse(backup);
  expect(parsed.batch).toHaveLength(1);
  expect(Object.values(parsed.quantities).reduce((a, b) => a + b, 0)).toBe(4);
  expect(parsed.reference.cards).toHaveLength(889);
  await openBase(page);
  await charizard(page).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#needed").click();
  await page.locator("#save").click();
  await page.locator('[data-nav="catalogue"]').click();
  await page
    .locator("#import-backup")
    .setInputFiles({
      name: "collection.json",
      mimeType: "application/json",
      buffer: Buffer.from(backup),
    });
  await expect(page.locator("#backup-preview")).toContainText("4 copies");
  await page.locator("#restore-backup").click();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("cardledger-alpha-v1")),
  );
  expect(saved).toEqual(parsed);
  await page.reload();
  await openBase(page);
  await expect(charizard(page).locator(".count")).toHaveText("×4");
  await expect(page.locator(".pocket").first()).toHaveAttribute(
    "aria-label",
    /needed/,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  await page.screenshot({
    path: testInfo.outputPath("alpha-binder.png"),
    fullPage: true,
  });
});
test("matching cannot use number alone; invalid backup and failed storage preserve collection", async ({
  page,
}) => {
  await page.goto("/tcg/");
  await expect(page.locator("[data-binder]")).toHaveCount(9);
  await page.locator('[data-nav="add"]').click();
  await page.locator("#unknown-set").click();
  await page.locator("#numbers").fill("4/102");
  await page.locator("#find").click();
  await expect(page.locator("#toast")).toContainText(
    "Choose both release and language",
  );
  await expect(page.locator(".summary")).toHaveCount(0);
  await page.locator('[data-nav="catalogue"]').click();
  const before = await page.evaluate(() =>
    localStorage.getItem("cardledger-alpha-v1"),
  );
  await page
    .locator("#import-backup")
    .setInputFiles({
      name: "broken.json",
      mimeType: "application/json",
      buffer: Buffer.from("{broken"),
    });
  await expect(page.locator(".import-error")).toContainText("not valid JSON");
  expect(
    await page.evaluate(() => localStorage.getItem("cardledger-alpha-v1")),
  ).toEqual(before);
  await openBase(page);
  await page.locator(".pocket").first().click();
  await page.locator("#plus").click();
  await page.evaluate(() => {
    Storage.prototype.setItem = function () {
      throw Error("Quota exceeded");
    };
  });
  await page.locator("#save").click();
  await expect(page.locator("#toast")).toContainText("Could not save");
  await expect(page.locator("#detail")).toBeVisible();
  expect(
    await page.evaluate(() => localStorage.getItem("cardledger-alpha-v1")),
  ).toEqual(before);
});
test("corrupt storage is not silently overwritten and can be recovered by importing a backup", async ({
  page,
}) => {
  await page.goto("/tcg/");
  await expect(page.locator("[data-binder]")).toHaveCount(9);
  await page.locator('[data-nav="catalogue"]').click();
  const d = page.waitForEvent("download");
  await page.locator("#backup").click();
  const backup = await readFile(await (await d).path(), "utf8");
  await page.evaluate(() =>
    localStorage.setItem("cardledger-alpha-v1", "{damaged"),
  );
  await page.reload();
  await expect(page.locator("#storage-warning")).toContainText("preserved");
  expect(
    await page.evaluate(() => localStorage.getItem("cardledger-alpha-v1")),
  ).toBe("{damaged");
  await page
    .locator("#import-backup")
    .setInputFiles({
      name: "recover.json",
      mimeType: "application/json",
      buffer: Buffer.from(backup),
    });
  await page.locator("#restore-backup").click();
  await expect(page.locator("#storage-warning")).toBeEmpty();
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("cardledger-alpha-v1")),
    ),
  ).toEqual(JSON.parse(backup));
});
