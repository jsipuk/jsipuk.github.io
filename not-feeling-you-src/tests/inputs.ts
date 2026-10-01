import type { Input } from "../lib/types"

const base = { actionPreference: null } as const
type I = Omit<Input, "actionPreference"> & { actionPreference?: Input["actionPreference"] }
const i = (x: I): Input => ({ ...base, ...x })

/**
 * The 25 seed scenarios from the spec. Where the spec names a feeling the UI
 * doesn't offer (nostalgia, creativity, curiosity), it's translated to the
 * nearest selectable feeling plus an action preference, exactly as a user
 * would express it on screen.
 */
export const INPUTS: Record<number, { name: string; input: Input }> = {
  1: { name: "£0, 1h, solo, very low, comfort, home", input: i({ budget: 0, timeMinutes: 60, company: "solo", energy: "very-low", feelings: ["comfort"], setting: "home" }) },
  2: { name: "£10, 90m, solo, low, laughter, local", input: i({ budget: 10, timeMinutes: 90, company: "solo", energy: "low", feelings: ["laughter"], setting: "out" }) },
  3: { name: "£30, 4h, family, medium, novelty, out", input: i({ budget: 30, timeMinutes: 240, company: "family", energy: "medium", feelings: ["novelty"], setting: "out" }) },
  4: { name: "£25, 2h, partner, very low, connection + comfort, either", input: i({ budget: 25, timeMinutes: 120, company: "partner", energy: "very-low", feelings: ["connection", "comfort"], setting: "either" }) },
  5: { name: "£0, 2h, solo, medium, outside, out", input: i({ budget: 0, timeMinutes: 120, company: "solo", energy: "medium", feelings: ["outside"], setting: "out" }) },
  6: { name: "£50, half day, friends, high, play, out", input: i({ budget: 50, timeMinutes: 240, company: "friends", energy: "high", feelings: ["play"], setting: "out" }) },
  7: { name: "£15, 30m, solo, very low, distraction, home", input: i({ budget: 15, timeMinutes: 30, company: "solo", energy: "very-low", feelings: ["distraction"], setting: "home" }) },
  8: { name: "£25, 2h, solo, medium, achievement, either", input: i({ budget: 25, timeMinutes: 120, company: "solo", energy: "medium", feelings: ["achievement"], setting: "either" }) },
  9: { name: "£10, 1h, family, low, play, either", input: i({ budget: 10, timeMinutes: 60, company: "family", energy: "low", feelings: ["play"], setting: "either" }) },
  10: { name: "£20, 3h, partner, medium, novelty, out", input: i({ budget: 20, timeMinutes: 180, company: "partner", energy: "medium", feelings: ["novelty"], setting: "out" }) },
  11: { name: "£0, 15m, solo, very low, calm, home", input: i({ budget: 0, timeMinutes: 15, company: "solo", energy: "very-low", feelings: ["calm"], setting: "home" }) },
  12: { name: "£25, 1h, solo, low, surprise me, either", input: i({ budget: 25, timeMinutes: 60, company: "solo", energy: "low", feelings: ["surprise"], setting: "either" }) },
  13: { name: "£10, 2h, friends, low, connection, out", input: i({ budget: 10, timeMinutes: 120, company: "friends", energy: "low", feelings: ["connection"], setting: "out" }) },
  14: { name: "£40, 4h, family, high, outside, out", input: i({ budget: 40, timeMinutes: 240, company: "family", energy: "high", feelings: ["outside"], setting: "out" }) },
  15: { name: "£5, 1h, solo, medium, novelty, out", input: i({ budget: 5, timeMinutes: 60, company: "solo", energy: "medium", feelings: ["novelty"], setting: "out" }) },
  16: { name: "£25, 2h, partner, low, creativity (make), home", input: i({ budget: 25, timeMinutes: 120, company: "partner", energy: "low", feelings: ["achievement"], setting: "home", actionPreference: "make" }) },
  17: { name: "£0, 1h, family, medium, outside, out", input: i({ budget: 0, timeMinutes: 60, company: "family", energy: "medium", feelings: ["outside"], setting: "out" }) },
  18: { name: "£15, 2h, solo, low, nostalgia (comfort), either", input: i({ budget: 15, timeMinutes: 120, company: "solo", energy: "low", feelings: ["comfort", "perspective"], setting: "either" }) },
  19: { name: "£20, 90m, friends, medium, laughter, out", input: i({ budget: 20, timeMinutes: 90, company: "friends", energy: "medium", feelings: ["laughter"], setting: "out" }) },
  20: { name: "£10, 1h, solo, low, achievement, home", input: i({ budget: 10, timeMinutes: 60, company: "solo", energy: "low", feelings: ["achievement"], setting: "home" }) },
  21: { name: "£30, 3h, partner, medium, calm, out", input: i({ budget: 30, timeMinutes: 180, company: "partner", energy: "medium", feelings: ["calm"], setting: "out" }) },
  22: { name: "£5, 30m, solo, very low, comfort, home", input: i({ budget: 5, timeMinutes: 30, company: "solo", energy: "very-low", feelings: ["comfort"], setting: "home" }) },
  23: { name: "£25, 4h, family, low, distraction, either", input: i({ budget: 25, timeMinutes: 240, company: "family", energy: "low", feelings: ["distraction"], setting: "either" }) },
  24: { name: "£15, 2h, solo, medium, curiosity (novelty + learn), out", input: i({ budget: 15, timeMinutes: 120, company: "solo", energy: "medium", feelings: ["novelty"], setting: "out", actionPreference: "go" }) },
  25: { name: "£25, 2h, solo, low, wildcard-heavy, either", input: i({ budget: 25, timeMinutes: 120, company: "solo", energy: "low", feelings: ["surprise"], setting: "either" }) },
}
