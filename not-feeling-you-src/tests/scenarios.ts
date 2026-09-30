import type { Input } from "../lib/types"
import { INPUTS } from "./inputs"

export type Scenario = {
  name: string
  input: Input
  /** At least one of these should be among the three results. */
  expectedAnyOf: string[]
  /** None of these may appear. */
  banned: string[]
  /** Distinct categories across the three results. */
  minCategories: number
}

// IDs are the inventory IDs. Titles in comments so humans can read them.
const S = (n: number, expectedAnyOf: string[], banned: string[], minCategories = 3): Scenario => ({
  ...INPUTS[n],
  expectedAnyOf,
  banned,
  minCategories,
})

export const SCENARIOS: Scenario[] = [
  // Free, an hour, flat: box-set night, pamper evening, journal. No shopping, no karting.
  S(1, ["WTY115", "WTY076", "WTY095", "WTY096"], ["WTY012", "WTY013", "WTY001", "WTY065"]),
  // Charity-shop challenge, weird ornament, ducks, mini golf.
  S(2, ["WTY025", "WTY059", "WTY023", "WTY011", "WTY118"], ["WTY012", "WTY013"]),
  // Family day out that's new: tourist in town, castle, caves, amateur show, micro-adventure.
  S(3, ["WTY002", "WTY110", "WTY111", "WTY006", "WTY119", "WTY105"], ["WTY008", "WTY097", "WTY065"]),
  // Very tired couple: box set, film night, blanket, scrapbook, spend it on someone.
  S(4, ["WTY115", "WTY035", "WTY068", "WTY047", "WTY101", "WTY036"], ["WTY013", "WTY015", "WTY012", "WTY024"]),
  // Free and outside: walk, hill, photo walk, nostalgia trip.
  S(5, ["WTY020", "WTY019", "WTY105", "WTY103", "WTY119"], ["WTY001", "WTY003", "WTY115"]),
  // Friends with energy to burn and £50.
  S(6, ["WTY010", "WTY011", "WTY012", "WTY013", "WTY015", "WTY093"], ["WTY065", "WTY031", "WTY115", "WTY008"]),
  // Thirty flat minutes at home: something to read, play or poke at.
  S(7, ["WTY031", "WTY038", "WTY044", "WTY054", "WTY046", "WTY033", "WTY053"], ["WTY001", "WTY013", "WTY010"]),
  // Wants a win, two hours, some energy.
  S(8, ["WTY013", "WTY082", "WTY081", "WTY091", "WTY039", "WTY049", "WTY019"], ["WTY065", "WTY115", "WTY031"]),
  // Family, a tenner, an hour, low energy.
  S(9, ["WTY023", "WTY011", "WTY061", "WTY102", "WTY025"], ["WTY012", "WTY001", "WTY008"]),
  // Couple, three hours out, something new.
  S(10, ["WTY003", "WTY105", "WTY006", "WTY024", "WTY108", "WTY111", "WTY029"], ["WTY115", "WTY065", "WTY012"]),
  // Fifteen minutes, nothing to spend, needs calm.
  S(11, ["WTY095", "WTY096", "WTY054"], ["WTY115", "WTY017", "WTY020"], 2),
  // Surprise me: something with character, still sane.
  S(12, ["WTY051", "WTY061", "WTY025", "WTY059", "WTY105", "WTY080", "WTY119", "WTY120"], ["WTY001", "WTY018"]),
  // Friends, cheap, low energy, connection.
  S(13, ["WTY100", "WTY014", "WTY101", "WTY005", "WTY006", "WTY029"], ["WTY012", "WTY015", "WTY008"]),
  // Family, high energy, outside.
  S(14, ["WTY019", "WTY110", "WTY112", "WTY119", "WTY011", "WTY018"], ["WTY003", "WTY115", "WTY068"]),
  // A fiver, an hour, something new outside the house.
  S(15, ["WTY105", "WTY025", "WTY003", "WTY004", "WTY119"], ["WTY001", "WTY012", "WTY024"]),
  // Couple making something at home.
  S(16, ["WTY039", "WTY040", "WTY047", "WTY091", "WTY043"], ["WTY010", "WTY013", "WTY001"]),
  // Free hour outdoors with the family.
  S(17, ["WTY019", "WTY105", "WTY119", "WTY103", "WTY100"], ["WTY002", "WTY017", "WTY010"]),
  // Nostalgia.
  S(18, ["WTY103", "WTY104", "WTY058", "WTY047", "WTY035"], ["WTY012", "WTY013", "WTY097"]),
  // Friends who want to laugh.
  S(19, ["WTY025", "WTY005", "WTY011", "WTY010", "WTY014", "WTY006", "WTY093"], ["WTY115", "WTY068", "WTY003"]),
  // A small win at home for a tenner.
  S(20, ["WTY117", "WTY082", "WTY083", "WTY039", "WTY044", "WTY048", "WTY053"], ["WTY013", "WTY001", "WTY010"]),
  // Couple, calm, out.
  S(21, ["WTY004", "WTY020", "WTY017", "WTY024", "WTY027", "WTY112", "WTY023"], ["WTY012", "WTY007", "WTY115"]),
  // A fiver, half an hour, needs comfort.
  S(22, ["WTY065", "WTY062", "WTY060", "WTY074", "WTY078", "WTY058", "WTY031"], ["WTY067", "WTY069", "WTY001"]),
  // Family afternoon, low energy, distraction.
  S(23, ["WTY002", "WTY003", "WTY035", "WTY043", "WTY010", "WTY099", "WTY022"], ["WTY012", "WTY013", "WTY001"]),
  // Curiosity, out.
  S(24, ["WTY003", "WTY004", "WTY002", "WTY110", "WTY111", "WTY105", "WTY029"], ["WTY065", "WTY115"]),
  // Wildcard-heavy: expect oddities, not the sensible stuff.
  S(25, ["WTY051", "WTY061", "WTY059", "WTY025", "WTY114", "WTY119", "WTY080", "WTY105"], ["WTY071", "WTY072", "WTY087", "WTY063"]),
]
