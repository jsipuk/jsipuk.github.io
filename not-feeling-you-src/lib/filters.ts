import type { Activity, Energy, Input } from "./types"

export const ENERGY_ORDER: Energy[] = ["very-low", "low", "medium", "high"]

/** Steps between the user's energy and the nearest level the activity suits. */
export function energyDistance(activity: Activity, energy: Energy): number {
  const want = ENERGY_ORDER.indexOf(energy)
  return Math.min(...activity.energy.map((e) => Math.abs(ENERGY_ORDER.indexOf(e) - want)))
}

export const canBeHome = (a: Activity) => a.setting.includes("home")
export const canBeOut = (a: Activity) => a.setting.includes("local") || a.setting.includes("travel")

/** Reasons an activity is off the table. Empty means it passes. */
export function rejectReasons(a: Activity, input: Input): string[] {
  const reasons: string[] = []
  if (a.cost.min > input.budget) reasons.push("budget")
  if (a.time.minMinutes > input.timeMinutes) reasons.push("time")
  if (!a.company.includes(input.company)) reasons.push("company")
  if (input.setting === "home" && !canBeHome(a)) reasons.push("setting")
  if (input.setting === "out" && !canBeOut(a)) reasons.push("setting")
  // Only the obvious mismatch: "basically none" vs a high-energy-only thing, and vice versa.
  if (energyDistance(a, input.energy) >= 3) reasons.push("energy")
  return reasons
}

export function passesHardFilters(a: Activity, input: Input): boolean {
  return rejectReasons(a, input).length === 0
}
