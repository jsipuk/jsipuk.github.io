export type Energy = "very-low" | "low" | "medium" | "high"
export type Company = "solo" | "partner" | "friends" | "family"
export type Setting = "home" | "local" | "travel"
export type Environment = "indoor" | "outdoor" | "mixed"
export type Action = "buy" | "go" | "do" | "make" | "learn" | "give"
export type Feeling =
  | "comfort"
  | "distraction"
  | "laughter"
  | "novelty"
  | "achievement"
  | "connection"
  | "calm"
  | "perspective"
  | "play"
  | "outside"
export type Personality =
  | "sensible"
  | "wholesome"
  | "cosy"
  | "quirky"
  | "silly"
  | "active"
  | "crafty"
  | "hobbyist"
  | "adventurous"

export type Activity = {
  id: string
  title: string
  summary: string
  /** Not in the original spec schema; the diversity step needs it. */
  category: string
  cost: { min: number; typical: number; max: number }
  time: { minMinutes: number; typicalMinutes: number; maxMinutes: number }
  energy: Energy[]
  company: Company[]
  setting: Setting[]
  environment: Environment[]
  /** First entry is the main action. */
  actions: Action[]
  /** First entry is the dominant feeling. */
  feelings: Feeling[]
  planning: "now" | "same-day" | "booking"
  novelty: "familiar" | "new"
  personality: Personality[]
  wildcardScore: number
  whyItWorks: string
  makeItBetter?: string
  source?: { type: "reddit" | "original"; url?: string }
  /** Older IDs folded into this one, so saved items and links still resolve. */
  mergedFrom?: string[]
}

/** Where the user wants to be. "out" means local or a trip. */
export type SettingChoice = "home" | "out" | "either"

export type Input = {
  /** Pounds. A ceiling, not a target. */
  budget: number
  timeMinutes: number
  company: Company
  energy: Energy
  /** Up to two, in order of importance. Empty or ["surprise"] means surprise me. */
  feelings: Array<Feeling | "surprise">
  setting: SettingChoice
  actionPreference: Action | null
}

export type Slot = "best" | "different" | "wildcard"

export type Pick = { slot: Slot; activity: Activity; score: number }
