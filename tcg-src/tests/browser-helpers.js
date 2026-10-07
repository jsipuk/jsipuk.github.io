import { readFile } from "node:fs/promises";
import { catalogueFixture } from "./fixtures/catalogue.js";
export const readSaved = (page) =>
  page.evaluate(
    () =>
      new Promise((resolve, reject) => {
        const request = indexedDB.open("card-ledger", 2);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result,
            tx = db.transaction([
              "referenceSets",
              "referenceCards",
              "referenceVersions",
              "collectionEntries",
              "settings",
            ]);
          const meta = tx.objectStore("referenceVersions").get("ledger"),
            sets = tx.objectStore("referenceSets").getAll(),
            cards = tx.objectStore("referenceCards").getAll();
          const own = tx.objectStore("settings").get("current"),
            keys = tx.objectStore("collectionEntries").getAllKeys(),
            values = tx.objectStore("collectionEntries").getAll();
          tx.onabort = () => reject(tx.error);
          tx.oncomplete = () => {
            const order = meta.result;
            const setOrder = new Map(
                order.releaseOrder.map((id, i) => [id, i]),
              ),
              cardOrder = new Map(order.cardOrder.map((id, i) => [id, i]));
            db.close();
            resolve({
              ...own.result.state,
              quantities: Object.fromEntries(
                keys.result.map((key, i) => [key, values.result[i]]),
              ),
              reference: {
                ...order.metadata,
                releases: sets.result.sort(
                  (a, b) => setOrder.get(a.id) - setOrder.get(b.id),
                ),
                cards: cards.result.sort(
                  (a, b) => cardOrder.get(a.id) - cardOrder.get(b.id),
                ),
              },
            });
          };
        };
      }),
  );
export async function seedLegacyEmpty(page) {
  const reference = JSON.parse(
    await readFile(
      new URL("./fixtures/legacy-reference.json", import.meta.url),
      "utf8",
    ),
  );
  const state = {
    format: "card-ledger",
    version: 1,
    reference,
    quantities: {},
    draft: {
      releaseId: reference.releases[0].id,
      language: "en",
      text: "",
      variant: "unspecified",
    },
    batch: [],
  };
  await page.addInitScript((value) => {
    if (!localStorage.getItem("cardledger-alpha-v1"))
      localStorage.setItem("cardledger-alpha-v1", value);
  }, JSON.stringify(state));
}
export async function installFixture(
  page,
  getFixture = () => catalogueFixture(),
) {
  await page.route("**/tcg-data/**", (route) => {
    const fixture = getFixture(),
      relative = new URL(route.request().url()).pathname.slice(
        "/tcg-data/".length,
      );
    const release = fixture.manifest.releases.find(
      (r) => r.cardsFile === relative,
    );
    const payload =
      relative === "manifest.json"
        ? fixture.manifest
        : release
          ? fixture.packs[release.id]
          : null;
    return route.fulfill({
      status: payload ? 200 : 404,
      contentType: "application/json",
      body: JSON.stringify(payload),
    });
  });
}
export async function track(page, id) {
  await page.locator('[data-nav="collection"]').click();
  if (await page.locator("#binders").isVisible())
    await page.locator("#binders").click();
  await page.locator("#manage-sets").click();
  await page.locator(`[data-track="${id}"]`).click();
  await page.locator(`[data-untrack="${id}"]`).waitFor();
  await page.locator("#sets-back").click();
}
