import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
const readSaved = (page) =>
  page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open("card-ledger", 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result,
            tx = db.transaction(["reference", "collection"]);
          const ref = tx.objectStore("reference").get("current"),
            own = tx.objectStore("collection").get("current");
          tx.oncomplete = () => {
            db.close();
            resolve({ ...own.result.state, reference: ref.result });
          };
          tx.onabort = () => reject(tx.error);
        };
      }),
  );
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
  await expect(charizard(page)).toBeFocused();
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
  const parsed = JSON.parse(backup).collection;
  expect(parsed.batch).toHaveLength(1);
  expect(Object.values(parsed.quantities).reduce((a, b) => a + b, 0)).toBe(4);
  expect(parsed.reference.cards).toHaveLength(889);
  await openBase(page);
  await charizard(page).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#needed").click();
  await page.locator("#save").click();
  await page.locator('[data-nav="catalogue"]').click();
  await page.locator("#import-backup").setInputFiles({
    name: "collection.json",
    mimeType: "application/json",
    buffer: Buffer.from(backup),
  });
  await expect(page.locator("#backup-preview")).toContainText("4 copies");
  await page.locator("#restore-backup").click();
  await expect(page.locator("#toast")).toContainText("Collection restored");
  const saved = await readSaved(page);
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
  await expect(page.locator(".summary")).toHaveText(
    "0 ready · 1 need checking",
  );
  await expect(page.locator("#commit")).toHaveCount(0);
  await page.locator('[data-nav="catalogue"]').click();
  const before = await readSaved(page);
  await page.locator("#import-backup").setInputFiles({
    name: "broken.json",
    mimeType: "application/json",
    buffer: Buffer.from("{broken"),
  });
  await expect(page.locator(".import-error")).toContainText("not valid JSON");
  expect(await readSaved(page)).toEqual(before);
  await openBase(page);
  await page.locator(".pocket").first().click();
  await page.locator("#plus").click();
  await page.evaluate(() => {
    const transaction = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (...args) {
      if (args[1] === "readwrite") throw Error("Quota exceeded");
      return transaction.apply(this, args);
    };
  });
  await page.locator("#save").click();
  await expect(page.locator("#modal-feedback")).toContainText("Could not save");
  await expect(page.locator("#modal-feedback")).toBeVisible();
  const feedbackIsExposed = await page
    .locator("#modal-feedback")
    .evaluate((el) => {
      const box = el.getBoundingClientRect();
      return el.contains(
        document.elementFromPoint(
          box.x + box.width / 2,
          box.y + box.height / 2,
        ),
      );
    });
  expect(feedbackIsExposed).toBe(true);
  await expect(page.locator("#detail")).toBeVisible();
  expect(await readSaved(page)).toEqual(before);
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
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        const request = indexedDB.open("card-ledger", 1);
        request.onsuccess = () => {
          const db = request.result,
            tx = db.transaction("collection", "readwrite"),
            store = tx.objectStore("collection"),
            get = store.get("current");
          get.onsuccess = () => {
            const record = get.result;
            record.state.version = 999;
            store.put(record, "current");
          };
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
        };
      }),
  );
  await page.reload();
  await expect(page.locator("#storage-warning")).toContainText("preserved");
  expect((await readSaved(page)).version).toBe(999);
  await page.locator("#import-backup").setInputFiles({
    name: "recover.json",
    mimeType: "application/json",
    buffer: Buffer.from(backup),
  });
  await page.locator("#restore-backup").click();
  await expect(page.locator("#storage-warning")).toBeEmpty();
  expect(await readSaved(page)).toEqual(JSON.parse(backup).collection);
});

test("Don't know discovers real cards and requires release/language confirmation", async ({
  page,
}, testInfo) => {
  await page.goto("/tcg/#add");
  await page.locator("#unknown-set").click();
  await page.locator("#unknown-lang").click();
  await expect(page.locator("#set")).toHaveValue("");
  await expect(page.locator("#set option:checked")).toHaveText("Don’t know");
  await expect(page.locator("#language option:checked")).toHaveText(
    "Don’t know",
  );
  await page.locator("#numbers").fill("4/102\n4");
  await page.locator("#find").click();
  await expect(page.locator(".summary")).toHaveText(
    "0 ready · 2 need checking",
  );
  await page.locator('[data-review="1"]').click();
  await expect(page.locator("#detail [data-choose]")).toHaveCount(9);
  await expect(page.locator("#detail")).toContainText("Base Set · English");
  await expect(page.locator("#detail")).toContainText("Jungle · English");
  await page.locator("#close").click();
  await expect(page.locator("#detail")).not.toBeVisible();
  await page.locator('[data-review="0"]').click();
  await expect(page.locator("#detail [data-choose]")).toHaveCount(1);
  await expect(page.locator("#detail")).toContainText("Charizard");
  await page.screenshot({
    path: testInfo.outputPath("unknown-confirmation.png"),
    fullPage: true,
  });
  await page.locator("[data-choose]").click();
  await expect(page.locator(".summary")).toHaveText(
    "1 ready · 1 need checking",
  );
  await page.locator("#commit").click();
  await expect(page.locator(".summary")).toHaveText(
    "0 ready · 1 need checking",
  );
  await page.reload();
  await page.locator("#resume").click();
  await expect(page.locator(".summary")).toHaveText(
    "0 ready · 1 need checking",
  );
  await openBase(page);
  await expect(charizard(page)).toHaveAttribute("aria-label", /owned.*1/);
  await expect(page.locator("#completion")).toContainText("1 / 102 unique");
});

test("legacy migration, safe reset, Undo and active binder context", async ({
  page,
}, testInfo) => {
  const reference = JSON.parse(
    await readFile(
      new URL("../public/data/reference.json", import.meta.url),
      "utf8",
    ),
  );
  const c = reference.cards.find(
    (c) => c.releaseId === base && c.collectorNumber === "4",
  );
  const legacy = {
    format: "card-ledger",
    version: 1,
    reference,
    quantities: { [JSON.stringify([c.id, "unspecified"])]: 3 },
    draft: {
      releaseId: base,
      language: "en",
      text: "",
      variant: "unspecified",
    },
    batch: [],
    notes: "收藏",
  };
  const original = JSON.stringify(legacy);
  await page.addInitScript((value) => {
    if (!localStorage.getItem("cardledger-alpha-v1"))
      localStorage.setItem("cardledger-alpha-v1", value);
  }, original);
  await page.goto("/tcg/");
  await openBase(page);
  await expect(charizard(page).locator(".count")).toHaveText("×3");
  expect(await readSaved(page)).toEqual(legacy);
  await page.locator('[data-nav="catalogue"]').click();
  await page.locator("#reset-collection").click();
  await page.locator("#cancel-reset").click();
  await expect(page.locator("#detail")).not.toBeVisible();
  expect((await readSaved(page)).quantities).toEqual(legacy.quantities);
  await page.locator("#reset-collection").click();
  const download = page.waitForEvent("download");
  await page.locator("#reset-backup").click();
  expect(
    JSON.parse(await readFile(await (await download).path(), "utf8"))
      .collection,
  ).toEqual(legacy);
  await page.screenshot({
    path: testInfo.outputPath("reset-confirmation.png"),
    fullPage: true,
  });
  await page.locator("#confirm-reset").click();
  await expect(page.locator("#detail")).not.toBeVisible();
  expect((await readSaved(page)).quantities).toEqual({});
  await page.locator("#undo").click();
  await expect
    .poll(async () => (await readSaved(page)).quantities)
    .toEqual(legacy.quantities);
  await page.locator("#reset-collection").click();
  await page.locator("#confirm-reset").click();
  await expect(page.locator("#detail")).not.toBeVisible();
  await page.reload();
  const reset = await readSaved(page);
  expect(reset.quantities).toEqual({});
  expect(reset.reference).toEqual(reference);
  expect(reset.notes).toBe("收藏");
  expect(
    await page.evaluate(() => localStorage.getItem("cardledger-alpha-v1")),
  ).toBe(original);
  await page.locator('[data-nav="collection"]').click();
  await page
    .locator("[data-binder]")
    .filter({ has: page.locator(".label", { hasText: /^Jungle$/ }) })
    .click();
  await expect(page.locator(".pockets")).toBeVisible();
  await page.locator('[data-nav="add"]').click();
  await expect(page.locator("#set option:checked")).toHaveText(
    "Jungle · English",
  );
});

test("IndexedDB updates synchronize across tabs and reference remains available offline", async ({
  page,
  context,
}) => {
  await page.goto("/tcg/");
  await expect(page.locator("[data-binder]")).toHaveCount(9);
  const other = await context.newPage();
  await other.goto("/tcg/");
  await openBase(other);
  await add(page, "4/102\n4/102");
  await page.locator("#commit").click();
  await expect(charizard(other).locator(".count")).toHaveText("×2");
  await expect(other.locator("#toast")).toContainText("another tab");
  await other.route("**/data/reference.json", (route) => route.abort());
  await other.reload();
  await openBase(other);
  await expect(charizard(other).locator(".count")).toHaveText("×2");
  await expect(other.locator("#storage-warning")).toBeEmpty();
});

test("200 percent zoom keeps header, candidate confirmation and Undo usable", async ({
  page,
}) => {
  await page.goto("/tcg/#add");
  await page.locator("#unknown-set").click();
  await page.locator("#unknown-lang").click();
  await page.locator("#numbers").fill("4/102");
  await page.locator("#find").click();
  await page.locator("[data-review]").click();
  await page.evaluate(() => (document.body.style.zoom = "2"));
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
  const candidate = await page.locator("[data-choose]").boundingBox();
  expect(candidate.width).toBeGreaterThanOrEqual(44);
  expect(candidate.height).toBeGreaterThanOrEqual(44);
  await page.locator("[data-choose]").click();
  await page.locator("#commit").click();
  const undo = page.locator("#undo");
  await expect(undo).toBeVisible();
  expect(
    await undo.evaluate((el) => parseFloat(getComputedStyle(el).minHeight)),
  ).toBeGreaterThanOrEqual(44);
  await undo.click();
  await expect(page.locator(".summary")).toHaveText(
    "1 ready · 0 need checking",
  );
  await page.evaluate(() => (document.body.style.zoom = "1"));
});
