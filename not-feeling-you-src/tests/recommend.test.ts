import { describe, expect, it } from "vitest"
import { similarityPenalty } from "../lib/diversify"
import { energyDistance, rejectReasons } from "../lib/filters"
import { ACTIVITIES, rank, recommend, replace } from "../lib/recommend"
import { score, scoreBreakdown } from "../lib/score"
import type { Activity, Input } from "../lib/types"
import { SCENARIOS } from "./scenarios"

const byId = (id: string) => ACTIVITIES.find((a) => a.id === id) as Activity

const base: Input = {
  budget: 25,
  timeMinutes: 120,
  company: "solo",
  energy: "low",
  feelings: ["comfort"],
  setting: "either",
  actionPreference: null,
}

describe("activity data", () => {
  it("has 130 activities with unique IDs", () => {
    expect(ACTIVITIES).toHaveLength(130)
    expect(new Set(ACTIVITIES.map((a) => a.id)).size).toBe(130)
  })

  it("has sane ranges and copy on every activity", () => {
    for (const a of ACTIVITIES) {
      expect(a.cost.min, a.id).toBeLessThanOrEqual(a.cost.typical)
      expect(a.cost.typical, a.id).toBeLessThanOrEqual(a.cost.max)
      expect(a.time.minMinutes, a.id).toBeLessThanOrEqual(a.time.typicalMinutes)
      expect(a.time.typicalMinutes, a.id).toBeLessThanOrEqual(a.time.maxMinutes)
      expect(a.wildcardScore).toBeGreaterThanOrEqual(0)
      expect(a.wildcardScore).toBeLessThanOrEqual(100)
      expect(a.whyItWorks.length, a.id).toBeGreaterThan(20)
      expect(a.energy.length && a.company.length && a.setting.length && a.feelings.length, a.id).toBeTruthy()
    }
  })
})

describe("hard filters", () => {
  it("rejects anything whose minimum cost is over budget", () => {
    expect(rejectReasons(byId("WTY012"), { ...base, budget: 10 })).toContain("budget")
  })

  it("rejects anything whose minimum time is over the time available", () => {
    expect(rejectReasons(byId("WTY001"), { ...base, timeMinutes: 60 })).toContain("time")
  })

  it("rejects unsupported company", () => {
    expect(rejectReasons(byId("WTY008"), { ...base, company: "family" })).toContain("company")
  })

  it("keeps home-only things out of 'get me out', and out-only things out of 'stay home'", () => {
    expect(rejectReasons(byId("WTY069"), { ...base, setting: "out" })).toContain("setting")
    expect(rejectReasons(byId("WTY003"), { ...base, setting: "home" })).toContain("setting")
  })

  it("only hard-filters energy at the extremes", () => {
    const karting = byId("WTY012")
    expect(energyDistance(karting, "very-low")).toBe(3)
    expect(rejectReasons(karting, { ...base, energy: "very-low", budget: 50 })).toContain("energy")
    expect(rejectReasons(karting, { ...base, energy: "low", budget: 50 })).not.toContain("energy")
  })
})

describe("scoring", () => {
  it("never penalises cheap ideas for having a big budget", () => {
    const free = byId("WTY095")
    expect(scoreBreakdown(free, { ...base, budget: 50 }).budget).toBe(5)
    expect(score(free, { ...base, budget: 50 })).toBe(score(free, { ...base, budget: 25 }))
  })

  it("scores energy exact > one away > two away", () => {
    const hill = byId("WTY019") // medium, high
    expect(scoreBreakdown(hill, { ...base, energy: "medium" }).energy).toBe(20)
    expect(scoreBreakdown(hill, { ...base, energy: "low" }).energy).toBe(10)
    expect(scoreBreakdown(hill, { ...base, energy: "very-low" }).energy).toBe(2)
  })

  it("gives the first feeling more weight than the second", () => {
    const a = byId("WTY065") // comfort
    expect(scoreBreakdown(a, { ...base, feelings: ["comfort", "laughter"] }).feeling).toBe(30)
    expect(scoreBreakdown(a, { ...base, feelings: ["laughter", "comfort"] }).secondFeeling).toBe(15)
  })

  it("swaps the feeling bonus for novelty when surprised", () => {
    const b = scoreBreakdown(byId("WTY061"), { ...base, feelings: ["surprise"] })
    expect(b.feeling).toBe(0)
    expect(b.novelty).toBeGreaterThan(0)
  })

  it("rewards the requested action type", () => {
    const lego = byId("WTY039") // buy, make
    expect(scoreBreakdown(lego, { ...base, actionPreference: "buy" }).action).toBe(8)
    expect(scoreBreakdown(lego, { ...base, actionPreference: "make" }).action).toBe(5)
    expect(scoreBreakdown(lego, { ...base, actionPreference: null }).action).toBe(0)
  })

  it("is deterministic", () => {
    expect(recommend(base)).toEqual(recommend(base))
  })
})

describe("diversity", () => {
  it("penalises same-category pairs hardest", () => {
    expect(similarityPenalty(byId("WTY065"), byId("WTY066"))).toBeGreaterThanOrEqual(20)
    expect(similarityPenalty(byId("WTY065"), byId("WTY019"))).toBeLessThan(10)
  })

  it("doesn't just return the top three raw scores", () => {
    const input: Input = { ...base, energy: "very-low", setting: "home", feelings: ["comfort"], timeMinutes: 30 }
    const rawTop = rank(input).slice(0, 3).map((c) => c.activity.id)
    const picked = recommend(input).map((p) => p.activity.id)
    expect(picked).not.toEqual(rawTop)
  })
})

describe("nah", () => {
  const input: Input = { ...base, budget: 10, timeMinutes: 90, feelings: ["laughter"], setting: "out" }

  it("replaces one card and leaves the other two alone", () => {
    const picks = recommend(input)
    const seen = picks.map((p) => p.activity.id)
    const next = replace(input, picks, "different", seen)
    expect(next).not.toBeNull()
    expect(next!.slot).toBe("different")
    expect(seen).not.toContain(next!.activity.id)
  })

  it("never brings back something already seen", () => {
    let picks = recommend(input)
    const seen = new Set(picks.map((p) => p.activity.id))
    for (let i = 0; i < 20; i++) {
      const next = replace(input, picks, "best", [...seen])
      if (!next) break
      expect(seen.has(next.activity.id)).toBe(false)
      seen.add(next.activity.id)
      picks = picks.map((p) => (p.slot === "best" ? next : p))
    }
  })

  it("returns null once everything's been seen", () => {
    const tight: Input = { ...base, budget: 0, timeMinutes: 15, energy: "very-low", feelings: ["calm"], setting: "home" }
    const all = rank(tight).map((c) => c.activity.id)
    expect(replace(tight, recommend(tight), "best", all)).toBeNull()
  })
})

describe("25 seed scenarios", () => {
  for (const s of SCENARIOS) {
    describe(s.name, () => {
      const picks = recommend(s.input)
      const ids = picks.map((p) => p.activity.id)

      it("returns exactly three, one per slot", () => {
        expect(picks.map((p) => p.slot)).toEqual(["best", "different", "wildcard"])
        expect(new Set(ids).size).toBe(3)
      })

      it("respects budget, time, company and setting", () => {
        for (const { activity: a } of picks) expect(rejectReasons(a, s.input), a.id).toEqual([])
      })

      it("includes at least one expected idea", () => {
        expect(ids.some((id) => s.expectedAnyOf.includes(id)), `got ${ids.join(", ")}`).toBe(true)
      })

      it("includes nothing banned", () => {
        expect(ids.filter((id) => s.banned.includes(id))).toEqual([])
      })

      it("is varied", () => {
        const cats = new Set(picks.map((p) => p.activity.category))
        expect(cats.size, `categories: ${[...cats].join(", ")}`).toBeGreaterThanOrEqual(s.minCategories)
      })
    })
  }
})
