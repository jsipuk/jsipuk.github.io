import type { Activity, Input } from "./types"

const pounds = (n: number) => `£${n}`

/** Price range, capped at what the user said they'd spend. */
export function formatCost(a: Activity, budget?: number): string {
  const hi = budget === undefined ? a.cost.max : Math.max(a.cost.min, Math.min(a.cost.max, budget))
  if (hi === 0) return "Free"
  if (a.cost.min === 0) return `Free–${pounds(hi)}`
  if (a.cost.min === hi) return pounds(hi)
  return `${pounds(a.cost.min)}–${pounds(hi)}`
}

function mins(n: number): string {
  if (n < 60) return `${n}`
  const h = n / 60
  return Number.isInteger(h) ? `${h}` : h.toFixed(1).replace(/\.0$/, "")
}

export function formatTime(a: Activity): string {
  const lo = a.time.minMinutes
  const hi = a.time.typicalMinutes
  const unit = (n: number) => (n < 60 ? "mins" : n === 60 ? "hr" : "hrs")
  if (lo === hi) return `${mins(lo)} ${unit(lo)}`
  if (lo < 60 && hi >= 60) return `${lo} mins–${mins(hi)} ${unit(hi)}`
  return `${mins(lo)}–${mins(hi)} ${unit(hi)}`
}

const EFFORT = { "very-low": "barely any effort", low: "low effort", medium: "some effort", high: "proper effort" }

export function formatEffort(a: Activity): string {
  return EFFORT[a.energy[0]]
}

export function formatMeta(a: Activity, budget?: number): string {
  return [formatCost(a, budget), formatTime(a), formatEffort(a)].join(" · ")
}

const COMPANY = { solo: "just you", partner: "you and a partner", friends: "with friends", family: "with family" }
const ENERGY = { "very-low": "basically no energy", low: "not much energy", medium: "some energy", high: "need to move" }
const SETTING = { home: "staying in", out: "going out", either: "in or out" }

function formatBudget(n: number) {
  return n === 0 ? "nothing to spend" : `up to £${n}`
}

function formatAvailable(n: number) {
  if (n <= 15) return "15 mins"
  if (n <= 60) return "about an hour"
  if (n <= 120) return "a couple of hours"
  if (n <= 240) return "half a day"
  return "all day"
}

export function describeInput(i: Input): string {
  const s = [formatBudget(i.budget), formatAvailable(i.timeMinutes), COMPANY[i.company], ENERGY[i.energy], SETTING[i.setting]].join(" · ")
  return s[0].toUpperCase() + s.slice(1)
}
