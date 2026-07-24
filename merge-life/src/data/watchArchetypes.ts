import type { WatchArchetype, WatchArchetypeId } from '@/types';

/**
 * Finished watch archetypes.
 *
 * A watch is built from one movement-chain item, one exterior-chain item and
 * one design-chain item. The archetype awarded is the highest-tier archetype
 * whose minimum levels are all satisfied, so better components reliably produce
 * rarer watches without any randomness or paid rolls.
 */
export const WATCH_ARCHETYPES: WatchArchetype[] = [
  {
    id: 'field',
    name: 'Field Watch',
    serialPrefix: 'FLD',
    caseStyle: 'Brushed steel, 38mm',
    dialStyle: 'Matte black, painted numerals',
    accentStyle: 'Cream luminous markers',
    description:
      'Plain, tough and easy to read in bad light. The watch you stop noticing, which is the highest compliment a tool watch can get.',
    requires: { movement: 4, exterior: 4, design: 4 },
    tier: 1,
    palette: { case: '#8f9296', dial: '#24262a', accent: '#e8dfc8', strap: '#6d6350' },
  },
  {
    id: 'pilot',
    name: 'Pilot Watch',
    serialPrefix: 'PLT',
    caseStyle: 'Bead-blasted steel, 41mm',
    dialStyle: 'Deep charcoal, oversized numerals',
    accentStyle: 'Triangle at twelve',
    description:
      'Built around legibility at a glance. Big numerals, long hands and nothing on the dial that does not need to be there.',
    requires: { movement: 4, exterior: 4, design: 5 },
    tier: 2,
    palette: { case: '#7d8288', dial: '#1c1f24', accent: '#d9d2c0', strap: '#4a4038' },
  },
  {
    id: 'diver',
    name: 'Diver',
    serialPrefix: 'DVR',
    caseStyle: 'Polished and brushed steel, 40mm',
    dialStyle: 'Gloss navy, applied markers',
    accentStyle: 'Rotating timing bezel',
    description:
      'Sealed, over-engineered and happiest in water. The bezel counts down the length of a swim, or a pot of pasta.',
    requires: { movement: 4, exterior: 5, design: 4 },
    tier: 3,
    palette: { case: '#9aa0a6', dial: '#1b2d4d', accent: '#e6e9ec', strap: '#2a3342' },
  },
  {
    id: 'gmt',
    name: 'GMT',
    serialPrefix: 'GMT',
    caseStyle: 'Brushed steel, 40mm',
    dialStyle: 'Slate grey, 24-hour track',
    accentStyle: 'Second time-zone hand',
    description:
      'A fourth hand that quietly tracks somewhere else. Useful for travel, and for keeping in touch with people far away.',
    requires: { movement: 5, exterior: 4, design: 4 },
    tier: 4,
    palette: { case: '#93989e', dial: '#3a4048', accent: '#c98b4b', strap: '#3c4048' },
  },
  {
    id: 'racing',
    name: 'Racing Watch',
    serialPrefix: 'RCG',
    caseStyle: 'Polished steel, 39mm',
    dialStyle: 'Off-white panda, contrast registers',
    accentStyle: 'Tachymeter scale',
    description:
      'Made for measuring short bursts of effort. Reads like a dashboard and looks best with the sleeves rolled up.',
    requires: { movement: 5, exterior: 5, design: 5 },
    tier: 5,
    palette: { case: '#a7acb2', dial: '#efe9dd', accent: '#b4402f', strap: '#5d4a3a' },
  },
  {
    id: 'dress',
    name: 'Dress Watch',
    serialPrefix: 'DRS',
    caseStyle: 'Polished, slim, 36mm',
    dialStyle: 'Silver sunburst, applied batons',
    accentStyle: 'Blued hands',
    description:
      'Thin enough to slip under a cuff. Nothing shouts, and the whole thing is over in one glance.',
    requires: { movement: 6, exterior: 6, design: 6 },
    tier: 6,
    palette: { case: '#c9b283', dial: '#e6e3dc', accent: '#2f4a7a', strap: '#3a2c24' },
  },
];

export const ARCHETYPES_BY_ID: Record<WatchArchetypeId, WatchArchetype> = WATCH_ARCHETYPES.reduce(
  (acc, archetype) => {
    acc[archetype.id] = archetype;
    return acc;
  },
  {} as Record<WatchArchetypeId, WatchArchetype>,
);

/** Minimum component level required to attempt a build at all. */
export const MIN_CRAFT_LEVEL = 4;

/** Original, non-branded name fragments used to name a finished watch. */
export const WATCH_NAME_PREFIXES: Record<WatchArchetypeId, string[]> = {
  field: ['Meadow', 'Ridge', 'Trailhead', 'Fenland', 'Orchard'],
  pilot: ['Skyline', 'Northwind', 'Beacon', 'Aerodrome', 'Cirrus'],
  diver: ['Tidewater', 'Deepwell', 'Harbour', 'Kelp', 'Saltmarsh'],
  gmt: ['Meridian', 'Longitude', 'Transit', 'Waypoint', 'Passage'],
  racing: ['Circuit', 'Chicane', 'Redline', 'Apex', 'Straightaway'],
  dress: ['Evening', 'Quiet Hour', 'Linen', 'Chapel', 'Candlelight'],
};

export const WATCH_NAME_SUFFIXES = ['Mark I', 'Mark II', 'Mark III', 'Edition', 'Reference'];
