import { canBeHome, canBeOut, energyDistance } from "./filters"
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

function feelingScore(a: Activity, feeling: Feeling, full: number): number {
  const i = a.feelings.indexOf(feeling)
  if (i === -1) return 0
  // Dominant feeling gets full marks; a supporting feeling still counts for most of it.
  return i === 0 ? full : Math.round(full * 0.75)
}

export type Breakdown = Record<keyof typeof WEIGHTS | "novelty", number>

export function scoreBreakdown(a: Activity, input: Input): Breakdown {
  const [first, second] = input.feelings.filter((f): f is Feeling => f !== "surprise")
  const surprise = isSurprise(input)

  const dist = energyDistance(a, input.energy)
  const energy = dist === 0 ? 20 : dist === 1 ? 10 : dist === 2 ? 2 : 0

  const t = a.time.typicalMinutes
  const time = t <= input.timeMinutes * 0.75 ? 15 : t <= input.timeMinutes ? 10 : 4

  let setting: number
  if (input.setting === "either") setting = 8
  else {
    const both = canBeHome(a) && canBeOut(a)
    setting = both ? 6 : 10
  }

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
  }
}

export function score(a: Activity, input: Input): number {
  const b = scoreBreakdown(a, input)
  return Object.values(b).reduce((sum, n) => sum + n, 0)
}
