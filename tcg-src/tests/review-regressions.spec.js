import { test, expect } from "@playwright/test";
import { createCollection, exportBackup } from "../src/domain/collection.js";
import { emptyReference } from "../src/providers/catalogue.js";
import { catalogueFixture } from "./fixtures/catalogue.js";
import { installFixture, track, readSaved } from "./browser-helpers.js";

const copies = (state) =>
  Object.values(state.quantities).reduce((sum, n) => sum + n, 0);
const restoreEmpty = async (page) => {
  await page.locator('[data-nav="catalogue"]').click();
  await page.locator("#import-backup").setInputFiles({
    name: "empty-collection.json",
    mimeType: "application/json",
    buffer: Buffer.from(exportBackup(createCollection(emptyReference()))),
  });
  await page.locator("#restore-backup").click();
  await expect
    .poll(async () => (await readSaved(page)).reference.cards.length)
    .toBe(0);
};
const openRapid = async (page) => {
  await track(page, "perfect-order-en");
  await page.locator('[data-binder="perfect-order-en"]').click();
  await page.locator("#rapid-entry").click();
};

test("restoring a different collection clears Rapid Entry identities and keeps Add usable", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await installFixture(page);
  await page.goto("/tcg/");
  await openRapid(page);
  await page.locator("#rapid-number").fill("94");
  await page.locator("#rapid-number").press("Enter");
  await expect.poll(async () => copies(await readSaved(page))).toBe(1);
  await restoreEmpty(page);
  await page.locator('[data-nav="add"]').click();
  await expect(
    page.getByRole("heading", { name: "Add cards", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  expect(copies(await readSaved(page))).toBe(0);
});

test("Undo an addition preserves a new batch draft typed after the addition", async ({
  page,
}) => {
  await installFixture(page);
  await page.goto("/tcg/");
  await track(page, "perfect-order-en");
  await page.locator('[data-nav="add"]').click();
  await page.locator("#set").selectOption("perfect-order-en");
  await page.locator("#numbers").fill("94");
  await page.locator("#find").click();
  await page.locator("#commit").click();
  await page.locator("#numbers").fill("98\n100");
  await expect
    .poll(async () => (await readSaved(page)).draft.text)
    .toBe("98\n100");
  await page.locator("#undo").click();
  await expect.poll(async () => copies(await readSaved(page))).toBe(0);
  expect((await readSaved(page)).draft.text).toBe("98\n100");
});

test("retired finish keeps saved copies editable without offering new additions", async ({
  page,
}) => {
  let fixture = catalogueFixture();
  await installFixture(page, () => fixture);
  await page.goto("/tcg/");
  await track(page, "perfect-order-en");
  await page.locator('[data-binder="perfect-order-en"]').click();
  await page.locator(".pocket").first().click();
  await page.locator("#finish").selectOption("regular");
  await page.locator("#plus").click();
  await page.locator("#save").click();
  await expect.poll(async () => copies(await readSaved(page))).toBe(1);
  fixture = catalogueFixture("fixture-2");
  fixture.packs["perfect-order-en"].cards[0].variants = [];
  await page.locator("#binders").click();
  await page.locator("#manage-sets").click();
  await page.locator("#refresh-reference").click();
  await expect
    .poll(
      async () =>
        (await readSaved(page)).reference.cards[0].variants.find(
          (v) => v.id === "regular",
        )?.retired,
    )
    .toBe(true);
  await page.locator("#sets-back").click();
  await page.locator('[data-binder="perfect-order-en"]').click();
  await page.locator(".pocket").first().click();
  await expect(page.locator("#finish")).toHaveValue("regular");
  await expect(page.locator("#plus")).toBeDisabled();
  await expect(page.locator("#entry-unavailable")).toContainText(
    "Saved copies can still be reduced",
  );
  await page.locator("#minus").click();
  await page.locator("#save").click();
  await expect.poll(async () => copies(await readSaved(page))).toBe(0);
  expect(
    (await readSaved(page)).reference.cards[0].variants.some(
      (v) => v.id === "regular",
    ),
  ).toBe(true);
});

test("a startup registry request arriving after backup restore cannot rewrite the restored reference", async ({
  page,
}) => {
  let release;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  let started;
  const began = new Promise((resolve) => {
    started = resolve;
  });
  await page.route("**/tcg-data/manifest.json", async (route) => {
    started();
    await held;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(catalogueFixture().manifest),
    });
  });
  await page.goto("/tcg/");
  await began;
  await restoreEmpty(page);
  const response = page.waitForResponse("**/tcg-data/manifest.json");
  release();
  await response;
  await page.locator('[data-nav="collection"]').click();
  expect((await readSaved(page)).reference.releases).toEqual([]);
  expect((await readSaved(page)).reference.manifest).toBeUndefined();
});

test("an older delayed registry response cannot roll back a newer explicit refresh", async ({
  page,
}) => {
  let release;
  const held = new Promise((resolve) => {
    release = resolve;
  });
  let count = 0;
  await page.route("**/tcg-data/manifest.json", async (route) => {
    const first = ++count === 1;
    if (first) await held;
    const fixture = catalogueFixture(
      first ? "outdated-fixture" : "current-fixture",
    );
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify(fixture.manifest),
    });
  });
  await page.goto("/tcg/");
  await page.locator("#manage-sets").click();
  await page.locator("#refresh-reference").click();
  await expect
    .poll(async () => (await readSaved(page)).reference.manifest?.dataVersion)
    .toBe("current-fixture");
  const response = page.waitForResponse("**/tcg-data/manifest.json");
  release();
  await response;
  await page.locator("#sets-back").click();
  expect((await readSaved(page)).reference.manifest.dataVersion).toBe(
    "current-fixture",
  );
});
