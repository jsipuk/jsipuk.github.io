/* Build The MAGA Wall — every number worth arguing about lives here.
 *
 * Nothing in this file imports anything. Balancing is meant to be edited by a
 * human without reading sim.js, so the shape of the data is deliberately flat
 * and the comments say what a change will feel like, not what it does.
 */

/* ---- Virtual screen -------------------------------------------------------
 * The whole game is drawn into a fixed 208px-wide pixel buffer and blitted up
 * with nearest-neighbour. 208 = 13 cells of 16px: 3 cells of zombie approach,
 * 7 cells of wall, 3 cells of rally.
 */
export const VW = 208;
export const CELL = 16;

export const COLS = 7;
export const ROWS = 11;

export const HUD_H = 24;
export const SKY_H = 56;
export const GROUND_H = 16;

/** x pixel of grid column 0. */
export const GRID_X = 3 * CELL;              // 48
/** y pixel of the TOP of grid row ROWS-1. */
export const GRID_Y = HUD_H + SKY_H;         // 80
export const GRID_W = COLS * CELL;           // 112
export const GRID_H = ROWS * CELL;           // 176
/** y pixel of the ground line (top of the ground strip). */
export const GROUND_Y = GRID_Y + GRID_H;     // 256
export const SCENE_H = GROUND_Y + GROUND_H;  // 272

export const BAR_H = 98;
/** Total virtual height is clamped into this band; the slack goes to the bar. */
export const VH_MIN = SCENE_H + BAR_H - 10;
export const VH_MAX = SCENE_H + BAR_H + 34;

/** Grid column -> left pixel. Row 0 is the ground course. */
export const colX = (c) => GRID_X + c * CELL;
export const rowY = (r) => GROUND_Y - (r + 1) * CELL;
/** World x (float, in column units, negative on the zombie side) -> pixel. */
export const worldX = (x) => GRID_X + x * CELL;

/* ---- Wall materials -------------------------------------------------------
 * Tier 0 is what falls out of the sky. Sealing a complete course promotes
 * every block in it one tier, so a well-kept wall gets tougher over a run.
 */
export const MATERIALS = [
  { name: 'BRICK', hp: 3 },
  { name: 'STONE', hp: 6 },
  { name: 'STEEL', hp: 11 },
  { name: 'GOLD', hp: 18 },
];
export const MAX_TIER = MATERIALS.length - 1;

/* ---- Piece feel ---------------------------------------------------------- */
export const PIECE = {
  /** Seconds per row at wave 1, before the wave curve bends it. */
  baseFall: 0.85,
  /** Soft drop is a flat multiplier on fall speed while held. */
  softDropMul: 12,
  /** A beat between locking one piece and the next appearing. */
  entryDelay: 0.12,
  /** Grace after landing, so a last-moment slide still works. */
  lockDelay: 0.4,
  /** How many times a move may re-arm the lock delay before it stops caring. */
  lockResets: 8,
  /** Touch auto-repeat: first delay, then rate. */
  dasDelay: 0.17,
  dasRate: 0.055,
  /** Rotation kick attempts, in (dx, dy) grid steps, tried in order. */
  kicks: [[0, 0], [-1, 0], [1, 0], [0, 1], [-2, 0], [2, 0], [0, -1]],
};

/* ---- Overbuild ------------------------------------------------------------
 * Topping out is not death here — a tower is simply bad wall. It topples, you
 * lose the piece and the combo, and the crowd lets you know.
 */
export const OVERBUILD_ROW = ROWS - 1;
export const OVERBUILD_PENALTY = 150;

/* ---- Zombies -------------------------------------------------------------
 * speed is columns/second. bite is seconds between bites. climb is how many
 * blocks of sheer wall this type will haul itself up.
 */
export const ZOMBIES = {
  shambler: { hp: 3, speed: 0.30, bite: 0.9, dmg: 1, climb: 0, score: 100, w: 10, h: 14 },
  runner: { hp: 2, speed: 0.72, bite: 0.5, dmg: 1, climb: 0, score: 150, w: 9, h: 13 },
  climber: { hp: 3, speed: 0.40, bite: 0.8, dmg: 1, climb: 3, score: 200, w: 10, h: 13 },
  brute: { hp: 12, speed: 0.20, bite: 1.2, dmg: 4, climb: 0, score: 400, w: 14, h: 17 },
  balloon: { hp: 1, speed: 0.34, bite: 0, dmg: 0, climb: 0, score: 250, w: 11, h: 22 },
};

/** Which types are in the hat, and how heavily, from a given wave onward. */
export const SPAWN_TABLE = [
  { wave: 1, weights: { shambler: 10 } },
  { wave: 2, weights: { shambler: 10, runner: 4 } },
  { wave: 3, weights: { shambler: 9, runner: 5, climber: 4 } },
  { wave: 4, weights: { shambler: 7, runner: 6, climber: 5, brute: 2 } },
  { wave: 6, weights: { shambler: 6, runner: 6, climber: 6, brute: 4 } },
  { wave: 9, weights: { shambler: 4, runner: 7, climber: 7, brute: 6 } },
];

/** Balloons are handled separately so they stay a rare joke, not a stream. */
export const BALLOON = { fromWave: 5, every: [34, 52], maxAlive: 1 };

/* Horde shaping.
 *
 * Zombies queue rather than stacking into one point, otherwise twenty of them
 * chew a single brick at twenty times the rate and the wall evaporates. Only
 * the front rank plus whoever can reach past it does damage, so the horde
 * looks huge and applies bounded pressure.
 */
export const HORDE = {
  /** Minimum gap between two zombies in the same row, in cells. */
  separation: 0.52,
  /** How far past its own nose a zombie can reach to bite, in cells. */
  biteReach: 1.15,
  /** Simultaneous attackers of one block: 2 early, widening with the waves.
   * This is the main lever on late-game pressure. Raise the slope and a good
   * wall starts losing ground sooner. */
  scrum0: 2,
  scrumPerWave: 0.7,
  scrumMax: 8,
  /** Hard cap on live zombies, for performance and for fairness. */
  maxAlive: 20,
};



/* ---- Waves --------------------------------------------------------------- */
export const WAVE = {
  length: 30,
  breakLength: 2.6,
  /** Seconds between zombie spawns, wave 1 -> floor. */
  spawn0: 3.4,
  spawnDecay: 0.9,
  spawnFloor: 0.85,
  /** Wave 1 spawns are throttled further so the first minute teaches. */
  openingGrace: 12,
  fallDecay: 0.915,
  fallFloor: 0.16,
  speedPerWave: 0.055,
  hpPerWave: 0.11,
  dmgPerWave: 0.20,
  /** Bites get quicker as well as harder; this is the sharpest curve. */
  biteDecay: 0.92,
  biteFloor: 0.42,
};

export const BREACH_LIMIT = 3;

/* ---- Scoring -------------------------------------------------------------- */
export const SCORE = {
  survivePerSec: 5,
  placeSolid: 50,      // piece locked without opening a gap beneath it
  placeGappy: 15,
  gapPenaltyEach: 5,
  repairCell: 40,      // per cell filled where a block died in the last 6s
  repairWindow: 6,
  sealBase: 220,       // x (tier reached) x combo multiplier
  hardDropPerRow: 3,
  squish: 120,         // on top of the zombie's own score value
  eagle: 750,
  balloonPop: 250,
  crate: 300,
  waveClear: 800,      // x wave
  /** Combo counts consecutive gapless placements. */
  comboPerStep: 4,
  comboMax: 6,
};

/* ---- Eagle ---------------------------------------------------------------- */
export const EAGLE = {
  cooldown: 22,
  /** First cooldown is shorter so a new player meets the joke early. */
  firstReadyAt: 8,
  swoopTime: 0.85,
  carryTime: 1.5,
  returnTime: 1.6,
  /** Generous tap box around the perched bird, in scene pixels. */
  tapPad: 13,
};

/* ---- Supply crate ---------------------------------------------------------- */
export const CRATE = {
  fromWave: 2,
  every: [50, 78],
  fallTime: 9,
  tapPad: 12,
};

/* ---- Branding ---------------------------------------------------------------
 * The name on the boot screen. Deliberately a fictional label rather than a
 * real person or handle: this game is a political parody aimed at an audience
 * that has nothing to do with whoever built it, and tying the two together in
 * the binary is not something you can undo later.
 */
export const PUBLISHER = 'EAGLE EYE SOFTWARE';

/* ---- Entitlement ----------------------------------------------------------- */
export const TRIAL_RUNS = 3;

/* ---- Derived wave curves ---------------------------------------------------
 * Pure functions of the wave number so the balance can be plotted in a test.
 */
export const fallInterval = (wave) =>
  Math.max(WAVE.fallFloor, PIECE.baseFall * Math.pow(WAVE.fallDecay, wave - 1));

export const spawnInterval = (wave) =>
  Math.max(WAVE.spawnFloor, WAVE.spawn0 * Math.pow(WAVE.spawnDecay, wave - 1));

export const zombieSpeedMul = (wave) => 1 + WAVE.speedPerWave * (wave - 1);
export const biteMul = (wave) =>
  Math.max(WAVE.biteFloor, Math.pow(WAVE.biteDecay, wave - 1));
export const scrumSize = (wave) =>
  Math.min(HORDE.scrumMax, HORDE.scrum0 + Math.floor((wave - 1) * HORDE.scrumPerWave));

/** Rough blocks-per-second the horde can remove at a given wave and material.
 * Only used by tests and tuning, but it is the number the curve is aimed at. */
export const hordeDps = (wave, tierHp) =>
  (scrumSize(wave) * zombieDmgMul(wave)) / (ZOMBIES.shambler.bite * biteMul(wave)) / tierHp;
export const zombieHpMul = (wave) => 1 + WAVE.hpPerWave * (wave - 1);
export const zombieDmgMul = (wave) => 1 + WAVE.dmgPerWave * (wave - 1);

export function spawnWeights(wave) {
  let row = SPAWN_TABLE[0];
  for (const r of SPAWN_TABLE) if (wave >= r.wave) row = r;
  return row.weights;
}
