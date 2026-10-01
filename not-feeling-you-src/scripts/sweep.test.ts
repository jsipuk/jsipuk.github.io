// Full sweep of every answer combination (~560k inputs, about 2 minutes).
// Not part of `npm test`. Run with: npm run sweep
import { test } from "vitest"
import { ACTIVITIES, recommend } from "../lib/recommend"
import type { Action, Feeling, Input } from "../lib/types"

test("sweep", () => {
  const F: Feeling[] = ["comfort", "distraction", "laughter", "outside", "play", "achievement", "connection", "novelty"]
  const feelingSets: Input["feelings"][] = [["surprise"], ...F.map((f) => [f]), ...F.flatMap((a) => F.filter((b) => b !== a).map((b) => [a, b]))]
  const actions: Array<Action | null> = [null, "buy", "go", "make", "do", "learn"]
  const seen = new Map<string, string>()
  const count = new Map<string, number>()
  let shown = 0
  let n = 0
  for (const budget of [0, 5, 10, 25, 50]) for (const timeMinutes of [15, 30, 60, 120, 240, 480])
    for (const company of ["solo", "partner", "friends", "family"] as const) for (const energy of ["very-low", "low", "medium", "high"] as const)
      for (const feelings of feelingSets) for (const setting of ["home", "out", "either"] as const) for (const actionPreference of actions) {
        const input: Input = { budget, timeMinutes, company, energy, feelings, setting, actionPreference }
        n++
        for (const p of recommend(input)) {
          if (!seen.has(p.activity.id)) seen.set(p.activity.id, JSON.stringify(input))
          count.set(p.activity.id, (count.get(p.activity.id) ?? 0) + 1)
          shown++
        }
      }
  const never = ACTIVITIES.filter((a) => !seen.has(a.id))
  console.log(`inputs ${n}; reachable ${seen.size}/${ACTIVITIES.length}`)
  const title = (id: string) => ACTIVITIES.find((a) => a.id === id)!.title
  const sorted = [...count].sort((a, b) => b[1] - a[1])
  const pct = ([id, c]: [string, number]) => `${title(id)} ${((c / shown) * 100).toFixed(1)}%`
  console.log("MOST " + sorted.slice(0, 8).map(pct).join(" | "))
  console.log("LEAST " + sorted.slice(-8).map(pct).join(" | "))
  for (const a of never) console.log(`NEVER ${a.id} ${a.title} [${a.category}] ${a.feelings.join("/")} ${a.energy.join("/")} ${a.setting.join("/")} £${a.cost.min}-${a.cost.max}`)
}, 600_000)
