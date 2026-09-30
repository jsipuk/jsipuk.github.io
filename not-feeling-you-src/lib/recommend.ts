import activitiesJson from "../data/activities.json"
import { penaltyAgainst, wildcardValue } from "./diversify"
import { energyDistance, passesHardFilters } from "./filters"
import { score } from "./score"
import type { Activity, Input, Pick, Slot } from "./types"

export const ACTIVITIES = activitiesJson as Activity[]

export type Scored = { activity: Activity; score: number }

/** Every activity that passes the hard filters, best first. Ties break on ID so results never wobble. */
export function rank(input: Input, activities: Activity[] = ACTIVITIES): Scored[] {
  return activities
    .filter((a) => passesHardFilters(a, input))
    .map((activity) => ({ activity, score: score(activity, input) }))
    .sort((x, y) => y.score - x.score || x.activity.id.localeCompare(y.activity.id))
}

/** A wildcard still has to be a reasonable fit. */
const WILDCARD_FIT_FLOOR = 0.7

function pickFor(
  slot: Slot,
  pool: Scored[],
  others: Activity[],
  topScore: number,
  input: Input,
): Scored | undefined {
  let best: Scored | undefined
  let bestValue = -Infinity
  const floor = topScore * WILDCARD_FIT_FLOOR
  // Odd is fine. Physically unrealistic for how you feel today is not.
  let candidates =
    slot === "wildcard"
      ? pool.filter((c) => c.score >= floor && energyDistance(c.activity, input.energy) <= 1)
      : pool
  if (!candidates.length) candidates = pool
  // Repeating a category is a last resort, not just a penalty.
  const takenCategories = new Set(others.map((o) => o.category))
  const fresh = candidates.filter((c) => !takenCategories.has(c.activity.category))
  if (fresh.length) candidates = fresh
  for (const c of candidates) {
    const base = slot === "wildcard" ? wildcardValue(c.activity, c.score) : c.score
    const value = base - penaltyAgainst(c.activity, others)
    if (value > bestValue) {
      best = c
      bestValue = value
    }
  }
  return best
}

export function recommend(
  input: Input,
  opts: { exclude?: string[]; activities?: Activity[] } = {},
): Pick[] {
  const exclude = new Set(opts.exclude ?? [])
  const ranked = rank(input, opts.activities).filter((c) => !exclude.has(c.activity.id))
  if (!ranked.length) return []
  const top = ranked[0].score

  const picks: Pick[] = [{ slot: "best", activity: ranked[0].activity, score: ranked[0].score }]
  for (const slot of ["different", "wildcard"] as const) {
    const taken = new Set(picks.map((p) => p.activity.id))
    const pool = ranked.filter((c) => !taken.has(c.activity.id))
    const chosen = pickFor(slot, pool, picks.map((p) => p.activity), top, input)
    if (chosen) picks.push({ slot, activity: chosen.activity, score: chosen.score })
  }
  return picks
}

/**
 * "Nah": swap one card. The other cards stay exactly as they are, and nothing
 * already seen comes back.
 */
export function replace(
  input: Input,
  current: Pick[],
  slot: Slot,
  seen: string[],
  activities: Activity[] = ACTIVITIES,
): Pick | null {
  const ranked = rank(input, activities)
  if (!ranked.length) return null
  const blocked = new Set([...seen, ...current.map((p) => p.activity.id)])
  const pool = ranked.filter((c) => !blocked.has(c.activity.id))
  const others = current.filter((p) => p.slot !== slot).map((p) => p.activity)
  const chosen = pickFor(slot, pool, others, ranked[0].score, input)
  return chosen ? { slot, activity: chosen.activity, score: chosen.score } : null
}
