import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { installFixture, track, readSaved } from "./browser-helpers.js";
import { catalogueFixture } from "./fixtures/catalogue.js";

test("fresh entry explains unavailable reference and offers direct recovery routes", async ({
  page,
}) => {
  await page.goto("/tcg/");
  await page.locator('[data-nav="add"]').click();
  await expect(page.locator("#app")).toContainText("Card reference needed");
  await expect(page.locator("#find")).toHaveCount(0);
  await page.locator("#entry-manage-sets").click();
  await expect(page.locator("h1")).toHaveText("Manage sets");
  await expect(page.locator("[data-track]")).toHaveCount(6);
  await page.locator('[data-nav="add"]').click();
  await page.locator("#entry-backup").click();
  await expect(page.locator("#import-backup")).toBeVisible();
  await expect(page.locator("#export-set")).toBeDisabled();
  await expect(page.locator("#csv")).toBeDisabled();
  await expect(page.locator("#print")).toBeDisabled();
});

test("catalogue selected release, preview, CSV and print agree when only a later release is cached", async ({
  page,
}) => {
  await installFixture(page);
  await page.goto("/tcg/");
  await track(page, "fixture-second-en");
  await page.locator('[data-nav="catalogue"]').click();
  await expect(page.locator("#export-set")).toHaveValue("fixture-second-en");
  await expect(page.locator("tbody tr")).toHaveCount(100);
  const downloaded = page.waitForEvent("download");
  await page.locator("#csv").click();
  const csv = await readFile(await (await downloaded).path(), "utf8");
  expect(csv).toContain('"Second Fixture"');
  expect(csv).not.toContain('"Perfect Order"');
  await page.evaluate(() => {
    window.print = () => {};
  });
  await page.locator("#print").click();
  await expect(page.locator("#printout")).toContainText(
    "Complete verified reference checklist.",
  );
  await expect(page.locator("#printout")).not.toContainText(
    "incomplete reference",
  );
});

test("keyboard paging and selected collection controls retain focus and announce state", async ({
  page,
}) => {
  await installFixture(page);
  await page.goto("/tcg/");
  await track(page, "perfect-order-en");
  await page.locator('[data-binder="perfect-order-en"]').click();
  await page.locator("#next-page").focus();
  await page.locator("#next-page").press("Enter");
  await expect(page.locator(".pager")).toContainText("Page 2 of 12");
  await expect(page.locator("#next-page")).toBeFocused();
  await page.locator('[data-filter="need"]').focus();
  await page.locator('[data-filter="need"]').press("Enter");
  await expect(page.locator('[data-filter="need"]')).toBeFocused();
  await expect(page.locator('[data-filter="need"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator('[data-filter="all"]')).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await page.locator("#list").press("Enter");
  await expect(page.locator("#list")).toBeFocused();
  await expect(page.locator("#list")).toHaveAttribute("aria-pressed", "true");
  await page.locator('[data-nav="catalogue"]').click();
  await page.locator('[data-mode="duplicates"]').press("Enter");
  await expect(page.locator('[data-mode="duplicates"]')).toBeFocused();
  await expect(page.locator('[data-mode="duplicates"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const control = await page.locator('[data-mode="duplicates"]').boundingBox();
  const navigation = await page.locator("nav").boundingBox();
  expect(control.y).toBeGreaterThanOrEqual(0);
  expect(control.y + control.height).toBeLessThan(navigation.y);
});

test("cached retracted checklist stays exportable and print cannot claim verified completeness", async ({
  page,
}) => {
  let fixture = catalogueFixture();
  await installFixture(page, () => fixture);
  await page.goto("/tcg/");
  await track(page, "perfect-order-en");
  fixture = catalogueFixture("fixture-2");
  fixture.manifest.releases[0].readyForApp = false;
  fixture.manifest.releases[0].checklistStatus = "researching";
  await page.locator("#manage-sets").click();
  await page.locator("#refresh-reference").click();
  await expect
    .poll(async () => (await readSaved(page)).reference.manifest.dataVersion)
    .toBe("fixture-2");
  await page.locator('[data-nav="catalogue"]').click();
  await expect(page.locator("#export-set")).toHaveValue("perfect-order-en");
  await expect(page.locator("tbody tr")).toHaveCount(100);
  await page.evaluate(() => {
    window.print = () => {};
  });
  await page.locator("#print").click();
  await expect(page.locator("#printout")).toContainText(
    "Known entries; incomplete reference checklist.",
  );
});

test("pending retired finish requires a new choice and cannot masquerade as ready", async ({
  page,
}) => {
  let fixture = catalogueFixture();
  fixture.packs["perfect-order-en"].cards[0].variants.push({
    id: "foil",
    label: "Foil fixture finish",
  });
  await installFixture(page, () => fixture);
  await page.goto("/tcg/");
  await track(page, "perfect-order-en");
  await page.locator('[data-nav="add"]').click();
  await page.locator("#set").selectOption("perfect-order-en");
  await page.locator("#language").selectOption("en");
  await page.locator("#numbers").fill("1");
  await page.locator("#find").click();
  await page.locator("[data-review]").click();
  await page.locator("#variant-0").selectOption("foil");
  await page.locator("[data-choose]").click();
  await expect(page.locator("#commit")).toBeVisible();
  fixture = catalogueFixture("fixture-2");
  await page.locator('[data-nav="collection"]').click();
  await page.locator("#manage-sets").click();
  await page.locator("#refresh-reference").click();
  await expect
    .poll(async () => (await readSaved(page)).reference.manifest.dataVersion)
    .toBe("fixture-2");
  await page.locator('[data-nav="add"]').click();
  await page.locator("#resume").click();
  await expect(page.locator(".summary")).toHaveText(
    "0 ready · 1 need checking",
  );
  await expect(page.locator("#commit")).toHaveCount(0);
  await page.locator("[data-review]").click();
  await expect(page.locator('#variant-0 option[value="foil"]')).toHaveCount(0);
  await page.locator("[data-choose]").click();
  await page.locator("#commit").click();
  await expect
    .poll(async () =>
      Object.values((await readSaved(page)).quantities).reduce(
        (sum, n) => sum + n,
        0,
      ),
    )
    .toBe(1);
});

test("pending review remains reachable after the only cached release is retracted", async ({
  page,
}) => {
  let fixture = catalogueFixture();
  await installFixture(page, () => fixture);
  await page.goto("/tcg/");
  await track(page, "perfect-order-en");
  await page.locator('[data-nav="add"]').click();
  await page.locator("#set").selectOption("perfect-order-en");
  await page.locator("#language").selectOption("en");
  await page.locator("#numbers").fill("94");
  await page.locator("#find").click();
  await expect(page.locator("#commit")).toBeVisible();
  fixture = catalogueFixture("fixture-2");
  fixture.manifest.releases[0].readyForApp = false;
  fixture.manifest.releases[0].checklistStatus = "researching";
  await page.locator('[data-nav="collection"]').click();
  await page.locator("#manage-sets").click();
  await page.locator("#refresh-reference").click();
  await expect
    .poll(async () => (await readSaved(page)).reference.manifest.dataVersion)
    .toBe("fixture-2");
  await page.locator('[data-nav="add"]').click();
  await expect(page.locator("#app")).toContainText("Card reference needed");
  await page.locator("#resume").click();
  await expect(page.locator("h1")).toHaveText("Check your cards");
  await expect(page.locator(".summary")).toHaveText(
    "0 ready · 1 need checking",
  );
  await expect(page.locator("#commit")).toHaveCount(0);
  expect((await readSaved(page)).batch).toHaveLength(1);
});
