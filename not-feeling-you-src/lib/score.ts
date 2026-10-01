import { energyDistance } from "./filters"
import type { Activity, Feeling, Input } from "./types"

export const WEIGHTS = {
  feeling: 30,
  secondFeeling: 15,
  energy: 20,
  time: 15,
  company: 12,
  setting: 10,
  action: 8,
  budget: 5,
} as const

export function isSurprise(input: Input): boolean {
  const real = input.feelings.filter((f) => f !== "surprise")
  return real.length === 0
}

/**
 * Feelings the UI doesn't offer, counted as a partial match for one it does.
 * Without this, ideas tagged "calm" first could never earn full feeling points.
 */
const NEAR: Partial<Record<Feeling, Feeling>> = { comfort: "calm", outside: "perspective" }

/** True if the activity speaks to at least one feeling the person picked. */
export function matchesAFeeling(a: Activity, input: Input): boolean {
  if (isSurprise(input)) return true
  return input.feelings.some(
    (f) => f !== "surprise" && (a.feelings.includes(f) || (NEAR[f] !== undefined && a.feelings.includes(NEAR[f]!))),
  )
}

function feelingScore(a: Activity, feeling: Feeling, full: number): number {
  const i = a.feelings.indexOf(feeling)
  // Dominant feeling gets full marks; a supporting feeling still counts for most of it.
  if (i === 0) return full
  if (i > 0) return Math.round(full * 0.75)
  const near = NEAR[feeling]
  if (near && a.feelings.includes(near)) return Math.round(full * (a.feelings[0] === near ? 0.75 : 0.5))
  return 0
}

export type Breakdown = Record<keyof typeof WEIGHTS | "novelty" | "fit", number>

/**
 * Small tie-breakers (0-5). Without them dozens of ideas tie on the main
 * weights and the order is decided by chance, not by the answers.
 */
function fitBonus(a: Activity, input: Input): number {
  const share = a.time.typicalMinutes / input.timeMinutes
  // Uses a decent share of the time you said you've got.
  const time = share >= 0.3 && share <= 1 ? 3 : share >= 0.15 ? 1 : 0
  // You're at the energy level it's mainly made for, not one it merely tolerates.
  const energy = a.energy[0] === input.energy ? 2 : 0
  return time + energy
}

export function scoreBreakdown(a: Activity, input: Input): Breakdown {
  const [first, second] = input.feelings.filter((f): f is Feeling => f !== "surprise")
  const surprise = isSurprise(input)

  const dist = energyDistance(a, input.energy)
  const energy = dist === 0 ? 20 : dist === 1 ? 10 : dist === 2 ? 2 : 0

  const t = a.time.typicalMinutes
  const time = t <= input.timeMinutes * 0.75 ? 15 : t <= input.timeMinutes ? 10 : 4

  // Anything that works where you asked to be is a full match. (The spec scored
  // "also works elsewhere" lower, which quietly buried every shop-or-online idea.)
  // The hard filter has already removed anything that doesn't fit.
  const setting = input.setting === "either" ? 8 : 10

  let action = 0
  if (input.actionPreference) {
    if (a.actions[0] === input.actionPreference) action = WEIGHTS.action
    else if (a.actions.includes(input.actionPreference)) action = 5
  }

  return {
    feeling: surprise || !first ? 0 : feelingScore(a, first, WEIGHTS.feeling),
    secondFeeling: surprise || !second ? 0 : feelingScore(a, second, WEIGHTS.secondFeeling),
    energy,
    time,
    company: a.company.includes(input.company) ? WEIGHTS.company : 0,
    setting,
    action,
    // A ceiling, not a target: cheap things never lose points for being cheap.
    budget: a.cost.typical <= input.budget ? WEIGHTS.budget : 2,
    // "Surprise me" swaps the feeling bonus for novelty.
    novelty: surprise ? (a.novelty === "new" ? 15 : 0) + Math.round(a.wildcardScore * 0.2) : 0,
    fit: fitBonus(a, input),
  }
}

export function score(a: Activity, input: Input): number {
  const b = scoreBreakdown(a, input)
  return Object.values(b).reduce((sum, n) => sum + n, 0)
}
