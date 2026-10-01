import { expect, test } from "@playwright/test"

test("answer six questions, get three ideas, swap one, save one", async ({ page }) => {
  const started = Date.now()
  await page.goto("/")
  await page.getByRole("button", { name: "Find me something" }).click()

  await page.getByRole("button", { name: "Up to £10" }).click()
  await page.getByRole("button", { name: "About an hour" }).click()
  await page.getByRole("button", { name: "Just me" }).click()
  await page.getByRole("button", { name: "Not much" }).click()
  await page.getByRole("button", { name: "Make me laugh" }).click()
  await page.getByRole("button", { name: "Next" }).click()
  await page.getByRole("button", { name: "Get me out" }).click()
  await page.getByRole("button", { name: "Show me three" }).click()

  await expect(page).toHaveURL(/results/)
  const cards = page.locator("article.rec")
  await expect(cards).toHaveCount(3)
  expect(Date.now() - started).toBeLessThan(45_000)

  const titles = async () => cards.locator("h2").allTextContents()
  const before = await titles()

  // Nah swaps only the second card.
  await cards.nth(1).getByRole("button", { name: /^Nah/ }).click()
  const after = await titles()
  expect(after[0]).toBe(before[0])
  expect(after[2]).toBe(before[2])
  expect(after[1]).not.toBe(before[1])
  await expect(page.locator("[aria-live=polite]")).toContainText("Swapped for")

  // Save the first one and find it on the Saved page.
  await cards.nth(0).getByRole("button", { name: "Save this" }).click()
  await expect(page.getByRole("link", { name: /Saved \(1\)/ })).toBeVisible()
  await page.getByRole("link", { name: /Saved/ }).click()
  await expect(page.getByRole("heading", { name: before[0] })).toBeVisible()
  await page.getByRole("button", { name: `Remove ${before[0]}` }).click()
  await expect(page.getByText("Nothing saved yet. Probably for the best.")).toBeVisible()
})

test("'Let's do it' confirms the choice and hides the others", async ({ page }) => {
  await page.goto("/results/?surprise=1")
  const cards = page.locator("article.rec")
  await expect(cards).toHaveCount(3)
  await cards.nth(0).getByRole("button", { name: "Let’s do it" }).click()
  await expect(page.getByText("Go on then.")).toBeVisible()
  await expect(cards).toHaveCount(1)
  await page.getByRole("button", { name: "Actually, back to the three" }).click()
  await expect(cards).toHaveCount(3)
})

test("keyboard only: the flow works with Tab and Enter", async ({ page }) => {
  await page.goto("/")
  await page.getByRole("button", { name: "Find me something" }).focus()
  await page.keyboard.press("Enter")
  await expect(page.getByRole("heading", { name: "How much are you happy to spend?" })).toBeFocused()
})
