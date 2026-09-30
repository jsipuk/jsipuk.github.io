import type { Action, Company, Energy, Feeling, Input, SettingChoice } from "./types"

const COMPANIES: Company[] = ["solo", "partner", "friends", "family"]
const ENERGIES: Energy[] = ["very-low", "low", "medium", "high"]
const SETTINGS: SettingChoice[] = ["home", "out", "either"]
const ACTIONS: Action[] = ["buy", "go", "make", "do", "learn", "give"]
const FEELINGS: Array<Feeling | "surprise"> = [
  "comfort", "distraction", "laughter", "novelty", "achievement",
  "connection", "calm", "perspective", "play", "outside", "surprise",
]

/** What "Just surprise me" assumes. Shown on the results page so it can be changed. */
export const SURPRISE_DEFAULTS: Input = {
  budget: 10,
  timeMinutes: 60,
  company: "solo",
  energy: "low",
  feelings: ["surprise"],
  setting: "either",
  actionPreference: null,
}

export function toQuery(input: Input): string {
  const p = new URLSearchParams({
    b: String(input.budget),
    t: String(input.timeMinutes),
    c: input.company,
    e: input.energy,
    f: input.feelings.join(","),
    s: input.setting,
  })
  if (input.actionPreference) p.set("a", input.actionPreference)
  return p.toString()
}

const pick = <T extends string>(v: string | null, allowed: T[], fallback: T): T =>
  allowed.includes(v as T) ? (v as T) : fallback

export function fromQuery(p: URLSearchParams): Input {
  if (p.get("surprise")) return SURPRISE_DEFAULTS
  const d = SURPRISE_DEFAULTS
  const num = (k: string, fallback: number) => {
    const n = Number(p.get(k))
    return Number.isFinite(n) && n >= 0 && p.get(k) !== null ? Math.min(n, 10_000) : fallback
  }
  const feelings = (p.get("f") ?? "")
    .split(",")
    .filter((f): f is Feeling | "surprise" => FEELINGS.includes(f as Feeling))
    .slice(0, 2)
  const a = p.get("a")
  return {
    budget: num("b", d.budget),
    timeMinutes: num("t", d.timeMinutes),
    company: pick(p.get("c"), COMPANIES, d.company),
    energy: pick(p.get("e"), ENERGIES, d.energy),
    feelings: feelings.length ? feelings : ["surprise"],
    setting: pick(p.get("s"), SETTINGS, d.setting),
    actionPreference: a && ACTIONS.includes(a as Action) ? (a as Action) : null,
  }
}
