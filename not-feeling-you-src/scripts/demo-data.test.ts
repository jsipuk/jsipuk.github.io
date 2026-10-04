// Writes demo/data.json: the real results the welcome video shows.
// Run via: npm run demo
import { writeFileSync } from "node:fs"
import { test } from "vitest"
import { describeInput, formatMeta } from "../lib/format"
import { recommend, replace } from "../lib/recommend"
import type { Activity, Input } from "../lib/types"

export const DEMO_INPUT: Input = {
  budget: 10,
  timeMinutes: 60,
  company: "solo",
  energy: "low",
  feelings: ["laughter", "outside"],
  setting: "out",
  actionPreference: null,
}

const card = (a: Activity) => ({
  title: a.title,
  meta: formatMeta(a, DEMO_INPUT.budget),
  summary: a.summary,
  why: a.whyItWorks,
  better: a.makeItBetter ?? null,
})

test("demo data", () => {
  const picks = recommend(DEMO_INPUT)
  const nah = replace(DEMO_INPUT, picks, "different", picks.map((p) => p.activity.id))
  if (picks.length !== 3 || !nah) throw new Error("Demo input no longer gives three results and a Nah replacement")
  const data = { context: describeInput(DEMO_INPUT), cards: picks.map((p) => card(p.activity)), nah: card(nah.activity) }
  writeFileSync(new URL("../demo/data.json", import.meta.url), JSON.stringify(data, null, 2) + "\n")
  console.log("demo/data.json:", data.cards.map((c) => c.title).join(" | "), "-> nah:", data.nah.title)
})
