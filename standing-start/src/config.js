/* Standing Start — Phase 1 tunables.
 *
 * Every value that shapes how the car feels lives here, with the metadata the
 * tuning panel needs to build itself. Nothing else in the codebase should
 * contain a driving constant: if you find yourself typing a number into
 * simulation.js, it belongs in this file instead.
 *
 * Units are stated because the spec left several of them open. "u" is a world
 * unit; the road is 40u wide and the car is 8u long, so a unit is roughly a
 * third of a car length.
 */

export const GROUPS = [
  {
    id: 'drive',
    label: 'Base driving',
    params: {
      topSpeed:       { v: 100,  min: 40,  max: 200, step: 1,    label: 'Top speed', unit: 'u/s' },
      timeToTop:      { v: 1.6,  min: 0.4, max: 5,   step: 0.05, label: '0 to top speed', unit: 's' },
      steerRate:      { v: 90,   min: 20,  max: 220, step: 1,    label: 'Steering rate', unit: '°/s at full lock' },
      steerFalloff:   { v: 0.25, min: 0,   max: 0.8, step: 0.01, label: 'Steering falloff at speed', unit: 'fraction lost' },
      steerAssist:    { v: 0.18, min: 0,   max: 1,   step: 0.01, label: 'Steering assist', unit: '0-1, scaled to 3/s' },
      grip:           { v: 12,   min: 2,   max: 30,  step: 0.5,  label: 'Grip', unit: '1/s alignment rate' },
      wallLoss:       { v: 0.20, min: 0,   max: 0.9, step: 0.01, label: 'Wall impact speed loss', unit: 'fraction' },
      offTrackSpeed:  { v: 0.70, min: 0.2, max: 1,   step: 0.01, label: 'Off-track speed', unit: 'fraction of top' },
      speedDecay:     { v: 60,   min: 10,  max: 300, step: 5,    label: 'Over-cap speed decay', unit: 'u/s²' },
    },
  },
  {
    id: 'drift',
    label: 'Drift',
    params: {
      driftMinSpeed:  { v: 0.40, min: 0,   max: 1,   step: 0.01, label: 'Minimum drift speed', unit: 'fraction of top' },
      driftGrip:      { v: 2.2,  min: 0.2, max: 12,  step: 0.1,  label: 'Drift grip', unit: '1/s alignment rate' },
      driftSteerMul:  { v: 1.35, min: 0.8, max: 2.5, step: 0.01, label: 'Drift steering authority', unit: 'multiplier' },
      driftBase:      { v: 0.45, min: 0,   max: 1,   step: 0.01, label: 'Drift committed turn', unit: 'lock held automatically' },
      driftSlide:     { v: 26,   min: 0,   max: 90,  step: 1,    label: 'Outward slide', unit: 'u/s² pushed wide' },
      driftSpeedLoss: { v: 0.08, min: 0,   max: 0.4, step: 0.01, label: 'Drift speed loss', unit: 'fraction' },
      maxSlip:        { v: 38,   min: 10,  max: 75,  step: 1,    label: 'Maximum slip angle', unit: '°' },
      overcookStart:  { v: 1.8,  min: 0.5, max: 5,   step: 0.05, label: 'Overcook begins', unit: 's' },
      overcookRate:   { v: 0.55, min: 0,   max: 1.5, step: 0.01, label: 'Overcook steering penalty', unit: 'fraction lost per s' },
    },
  },
  {
    id: 'boost',
    label: 'Boost',
    params: {
      tier1Charge:  { v: 0.65, min: 0.1, max: 3,   step: 0.05, label: 'Tier 1 charge', unit: 's' },
      tier1Speed:   { v: 0.12, min: 0,   max: 1,   step: 0.01, label: 'Tier 1 speed', unit: '+fraction' },
      tier1Dur:     { v: 0.55, min: 0.1, max: 3,   step: 0.05, label: 'Tier 1 duration', unit: 's' },
      tier2Charge:  { v: 1.25, min: 0.1, max: 4,   step: 0.05, label: 'Tier 2 charge', unit: 's' },
      tier2Speed:   { v: 0.20, min: 0,   max: 1,   step: 0.01, label: 'Tier 2 speed', unit: '+fraction' },
      tier2Dur:     { v: 0.85, min: 0.1, max: 3,   step: 0.05, label: 'Tier 2 duration', unit: 's' },
      tier3Charge:  { v: 2.00, min: 0.1, max: 5,   step: 0.05, label: 'Tier 3 charge', unit: 's' },
      tier3Speed:   { v: 0.30, min: 0,   max: 1,   step: 0.01, label: 'Tier 3 speed', unit: '+fraction' },
      tier3Dur:     { v: 1.15, min: 0.1, max: 3,   step: 0.05, label: 'Tier 3 duration', unit: 's' },
      boostImpulse: { v: 0.65, min: 0,   max: 1,   step: 0.01, label: 'Instant share of boost', unit: 'fraction of gain' },
      boostAccelMul:{ v: 3,    min: 1,   max: 10,  step: 0.5,  label: 'Boost acceleration', unit: '× normal' },
      boostDecay:   { v: 45,   min: 5,   max: 200, step: 5,    label: 'Post-boost decay', unit: 'u/s²' },
    },
  },
  {
    id: 'input',
    label: 'Touch',
    params: {
      driftModel:      { v: 1, min: 0, max: 2, step: 1, label: 'Drift entry model',
                         choices: ['A — flick', 'B — beyond lock', 'C — absolute zone'] },
      steerRange:      { v: 110, min: 40, max: 260, step: 5, label: 'Steering range', unit: 'px to full lock' },
      steerDeadzone:   { v: 10,  min: 0,  max: 40,  step: 1, label: 'Steering deadzone', unit: 'px' },
      driftOvertravel: { v: 32,  min: 5,  max: 120, step: 1, label: 'Drift overtravel (B)', unit: 'px past full lock' },
      driftFlickDist:  { v: 35,  min: 10, max: 120, step: 1, label: 'Drift flick distance (A)', unit: 'px' },
      driftWindow:     { v: 180, min: 60, max: 500, step: 10, label: 'Drift gesture window', unit: 'ms' },
      driftMinLock:    { v: 0.35, min: 0, max: 1,   step: 0.01, label: 'Lock needed to drift', unit: '0-1' },
      tapMaxMs:        { v: 160, min: 60, max: 400, step: 10, label: 'Tap maximum', unit: 'ms' },
      tapMaxPx:        { v: 10,  min: 2,  max: 40,  step: 1, label: 'Tap movement tolerance', unit: 'px' },
      zoneRange:       { v: 0.30, min: 0.1, max: 0.5, step: 0.01, label: 'Absolute zone half-width (C)', unit: 'fraction of screen' },
      zoneTop:         { v: 0.35, min: 0, max: 0.8, step: 0.01, label: 'Play area starts at', unit: 'fraction of height' },
    },
  },
  {
    id: 'camera',
    label: 'Camera',
    params: {
      followDist:   { v: 34,  min: 6,  max: 90,  step: 0.5, label: 'Follow distance', unit: 'u' },
      camHeight:    { v: 11,  min: 2,  max: 30,  step: 0.5, label: 'Camera height', unit: 'u' },
      followLag:    { v: 100, min: 0,  max: 600, step: 10,  label: 'Follow lag', unit: 'ms' },
      lookAhead:    { v: 14,  min: 0,  max: 45,  step: 1,   label: 'Steering look-ahead', unit: '° at full lock' },
      boostPullback:{ v: 0.06, min: 0, max: 0.5, step: 0.01, label: 'Boost pull-back', unit: 'fraction' },
      pullbackIn:   { v: 120, min: 20, max: 800, step: 10,  label: 'Pull-back transition', unit: 'ms' },
      pullbackOut:  { v: 250, min: 20, max: 1200, step: 10, label: 'Pull-back recovery', unit: 'ms' },
      fov:          { v: 62,  min: 30, max: 110, step: 1,   label: 'Field of view', unit: '°' },
    },
  },
  {
    id: 'recovery',
    label: 'Recovery',
    params: {
      stuckSpeed:    { v: 0.15, min: 0, max: 0.6, step: 0.01, label: 'Stuck below', unit: 'fraction of top' },
      stuckTime:     { v: 0.7,  min: 0.1, max: 3, step: 0.05, label: 'Stuck for', unit: 's' },
      stuckAngle:    { v: 100,  min: 30, max: 175, step: 5,  label: 'Or facing more than', unit: '° off track' },
      recoverAssist: { v: 3.5,  min: 0.5, max: 12, step: 0.1, label: 'Recovery assist', unit: '1/s' },
      recoverAim:    { v: 35,   min: 0,   max: 80, step: 1,   label: 'Recovery aim across track', unit: '°' },
      recoverTime:   { v: 1.0,  min: 0.2, max: 4,  step: 0.05, label: 'Recovery duration', unit: 's' },
    },
  },
  {
    id: 'perf',
    label: 'Performance',
    params: {
      dprCap:       { v: 1.5, min: 0.5, max: 3,   step: 0.05, label: 'Pixel ratio cap', unit: '×' },
      drawDistance: { v: 340, min: 80,  max: 900, step: 10,   label: 'Draw distance', unit: 'u' },
    },
  },
];

/** Flat { name: value } object built from the group definitions. */
export function defaults() {
  const out = {};
  for (const g of GROUPS) {
    for (const [k, p] of Object.entries(g.params)) out[k] = p.v;
  }
  return out;
}

/** Look up a parameter's definition by name. */
export function paramDef(name) {
  for (const g of GROUPS) {
    if (g.params[name]) return g.params[name];
  }
  return null;
}

export const DRIFT_MODELS = ['flick', 'beyond', 'zone'];
