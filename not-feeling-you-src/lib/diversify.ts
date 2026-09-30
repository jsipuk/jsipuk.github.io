import type { Activity } from "./types"

/** How much `a` should lose for being too like `b`. */
export function similarityPenalty(a: Activity, b: Activity): number {
  let p = 0
  if (a.category === b.category) p += 20
  if (a.actions[0] === b.actions[0]) p += 8
  if (a.feelings[0] === b.feelings[0]) p += 5
  const sameSetting = a.setting.join() === b.setting.join()
  const sameEnv = a.environment.join() === b.environment.join()
  if (sameSetting && sameEnv) p += 5
  return p
}

export function penaltyAgainst(a: Activity, others: Activity[]): number {
  return others.reduce((sum, o) => sum + similarityPenalty(a, o), 0)
}

const WILD_PERSONALITIES = new Set(["quirky", "silly", "adventurous"])

/** Ranking value for the wildcard slot. Fit still counts; oddness counts more. */
export function wildcardValue(a: Activity, fit: number): number {
  const odd = a.personality.some((p) => WILD_PERSONALITIES.has(p)) ? 10 : 0
  const fresh = a.novelty === "new" ? 8 : 0
  return fit * 0.5 + a.wildcardScore * 0.5 + odd + fresh
}
