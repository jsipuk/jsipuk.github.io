// 30 deliberately awkward answer sets, printed for a human to read and rate.
// Not part of `npm test`. Run with: npm run awkward
import { test } from "vitest"
import { formatMeta } from "../lib/format"
import { rank, recommend } from "../lib/recommend"
import type { Input } from "../lib/types"
type C = [string, number, number, Input["company"], Input["energy"], Input["feelings"], Input["setting"], Input["actionPreference"]]
const C: C[] = [
  ["Family, 15m, no money, wired, wants connection, home", 0, 15, "family", "high", ["connection"], "home", null],
  ["Friends, 15m, no money, flat, wants a laugh, out", 0, 15, "friends", "very-low", ["laughter"], "out", null],
  ["Solo, all day, £50, flat, wants new, home", 50, 480, "solo", "very-low", ["novelty"], "home", null],
  ["Family, all day, no money, high, outside", 0, 480, "family", "high", ["outside"], "out", null],
  ["Partner, 15m, £5, flat, wants a win, out", 5, 15, "partner", "very-low", ["achievement"], "out", null],
  ["Friends, 15m, £50, high, comfort, home", 50, 15, "friends", "high", ["comfort"], "home", null],
  ["Family, 15m, £10, flat, novelty, out", 10, 15, "family", "very-low", ["novelty"], "out", null],
  ["Solo, 2h, no money, flat, wants people, out", 0, 120, "solo", "very-low", ["connection"], "out", null],
  ["Partner, 1h, £25, high, comfort + laugh, home", 25, 60, "partner", "high", ["comfort", "laughter"], "home", null],
  ["Partner, half day, no money, flat, outside + connection", 0, 240, "partner", "very-low", ["outside", "connection"], "out", null],
  ["Solo, 15m, £100, medium, achievement, home", 100, 15, "solo", "medium", ["achievement"], "home", null],
  ["Friends, 1h, no money, flat, achievement, home", 0, 60, "friends", "very-low", ["achievement"], "home", null],
  ["Family, all day, £50, flat, outside, either", 50, 480, "family", "very-low", ["outside"], "either", null],
  ["Solo, 15m, £10, need to move, comfort, home", 10, 15, "solo", "high", ["comfort"], "home", null],
  ["Solo, 15m, nothing, flat, surprise me", 0, 15, "solo", "very-low", ["surprise"], "either", null],
  ["Family, 1h, £1, medium, novelty, out", 1, 60, "family", "medium", ["novelty"], "out", null],
  ["Friends, 2h, £25, flat, outside, out", 25, 120, "friends", "very-low", ["outside"], "out", null],
  ["Partner, 1h, no money, high, comfort, home", 0, 60, "partner", "high", ["comfort"], "home", null],
  ["Solo, half day, £50, high, connection, out", 50, 240, "solo", "high", ["connection"], "out", null],
  ["Solo, all day, £10, low, distraction, home", 10, 480, "solo", "low", ["distraction"], "home", null],
  ["Family, 15m, nothing, low, achievement + laugh, home", 0, 15, "family", "low", ["achievement", "laughter"], "home", null],
  ["Friends, 2h, £5, high, comfort, either", 5, 120, "friends", "high", ["comfort"], "either", null],
  ["Family, 1h, £25, flat, laughter, out, lean learn", 25, 60, "family", "very-low", ["laughter"], "out", "learn"],
  ["Solo, half day, nothing, medium, comfort, out, lean BUY", 0, 240, "solo", "medium", ["comfort"], "out", "buy"],
  ["Partner, 1h, £10, medium, novelty, HOME, lean GO", 10, 60, "partner", "medium", ["novelty"], "home", "go"],
  ["Family, 2h, £50, high, play, home", 50, 120, "family", "high", ["play"], "home", null],
  ["Friends, all day, nothing, low, novelty, out", 0, 480, "friends", "low", ["novelty"], "out", null],
  ["Friends, 15m, £15, medium, connection, either, lean make", 15, 15, "friends", "medium", ["connection"], "either", "make"],
  ["Solo, 1h, £50, flat, surprise, out", 50, 60, "solo", "very-low", ["surprise"], "out", null],
  ["Solo, 2h, nothing, high, achievement, home, lean learn", 0, 120, "solo", "high", ["achievement"], "home", "learn"],
]
test("awkward", () => {
  C.forEach(([name, budget, timeMinutes, company, energy, feelings, setting, actionPreference], i) => {
    const input: Input = { budget, timeMinutes, company, energy, feelings, setting, actionPreference }
    console.log(`\n## ${i + 1}. ${name}  [${rank(input).length} pass filters]`)
    for (const p of recommend(input)) console.log(`- ${p.slot}: ${p.activity.title} (${formatMeta(p.activity, budget)}) :: ${p.activity.summary}`)
  })
})
