import { describe, expect, it } from "vitest"
import { ACTIVITIES, recommend } from "../lib/recommend"
import type { Activity, Feeling, Input, SettingChoice } from "../lib/types"

/** The feelings someone can actually pick on screen. */
const SELECTABLE: Feeling[] = ["comfort", "distraction", "laughter", "outside", "play", "achievement", "connection", "novelty"]
const BUDGETS = [0, 10, 25, 50]
/** How someone would describe a feeling the UI doesn't offer. Mirrors NEAR in lib/score.ts. */
const SAID_AS: Partial<Record<Feeling, Feeling>> = { calm: "comfort", perspective: "outside" }
const TIMES = [15, 60, 120, 240, 480]

/**
 * Every answer set someone could plausibly give when this idea is what they
 * need: its own company, energy, feelings, setting and action, with the
 * smallest budget and time options that let it through.
 */
function inputsFor(a: Activity): Input[] {
  // Any budget option that covers the usual version, not the bare minimum.
  const budgets = BUDGETS.filter((b) => b >= a.cost.typical)
  if (!budgets.length) budgets.push(a.cost.typical)
  const times = TIMES.filter((t) => t >= a.time.minMinutes)
  const settings: SettingChoice[] = ["either", ...(a.setting.includes("home") ? ["home" as const] : []), ...(a.setting.some((s) => s !== "home") ? ["out" as const] : [])]
  const own = [...new Set(a.feelings.map((f) => SAID_AS[f] ?? f))].filter((f) => SELECTABLE.includes(f))
  const feelingSets: Input["feelings"][] = [["surprise"], ...own.map((f) => [f]), ...own.flatMap((x) => SELECTABLE.filter((y) => y !== x).map((y) => [x, y]))]
  const out: Input[] = []
  for (const company of a.company) for (const energy of a.energy) for (const timeMinutes of times) for (const budget of budgets)
    for (const setting of settings) for (const feelings of feelingSets) for (const actionPreference of [null, a.actions[0]])
      out.push({ budget, timeMinutes, company, energy, feelings, setting, actionPreference: actionPreference === "give" ? null : actionPreference })
  return out
}

describe("every idea can be a result", () => {
  for (const a of ACTIVITIES) {
    it(`${a.id} ${a.title}`, () => {
      const hit = inputsFor(a).some((input) => recommend(input).some((p) => p.activity.id === a.id))
      expect(hit, `${a.title} never makes the first three for any answers that suit it`).toBe(true)
    })
  }
})
