/* The falling pieces.
 *
 * These are wall parts, not tetrominoes: the early bag is all fat, friendly,
 * flat-bottomed shapes so a first-time player cannot really build badly. The
 * awkward ones (ARCH, ZIG, TOWER) are held back until wave 4 and up.
 *
 * Cell coordinates are y-up: (0,0) is the bottom-left of the shape.
 */

const DEFS = {
  DOMINO: [[0, 0], [1, 0]],
  BLOCK: [[0, 0], [1, 0], [0, 1], [1, 1]],
  PLANK: [[0, 0], [1, 0], [2, 0]],
  POST: [[0, 0], [0, 1], [0, 2]],
  STEP: [[0, 0], [1, 0], [0, 1]],
  CORNER: [[0, 0], [1, 0], [2, 0], [0, 1]],
  ELL: [[0, 0], [1, 0], [2, 0], [2, 1]],
  TEE: [[0, 0], [1, 0], [2, 0], [1, 1]],
  ZIG: [[0, 0], [1, 0], [1, 1], [2, 1]],
  ZAG: [[1, 0], [2, 0], [0, 1], [1, 1]],
  ARCH: [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1]],
  TOWER: [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2]],
  SINGLE: [[0, 0]],
};

/** Which shapes are in the hat from a given wave onward, and how often. */
const BAG_TABLE = [
  { wave: 1, weights: { DOMINO: 6, BLOCK: 5, PLANK: 5, POST: 3, STEP: 3 } },
  { wave: 2, weights: { DOMINO: 5, BLOCK: 5, PLANK: 5, POST: 3, STEP: 4, CORNER: 3, ELL: 3 } },
  { wave: 4, weights: { DOMINO: 4, BLOCK: 4, PLANK: 4, POST: 3, STEP: 4, CORNER: 4, ELL: 4, TEE: 3, SINGLE: 2, ZIG: 2, ZAG: 2 } },
  { wave: 6, weights: { DOMINO: 3, BLOCK: 3, PLANK: 4, POST: 3, STEP: 4, CORNER: 4, ELL: 4, TEE: 4, SINGLE: 2, ZIG: 3, ZAG: 3, ARCH: 3, TOWER: 2 } },
  { wave: 9, weights: { DOMINO: 2, BLOCK: 2, PLANK: 3, POST: 3, STEP: 4, CORNER: 4, ELL: 4, TEE: 4, SINGLE: 3, ZIG: 4, ZAG: 4, ARCH: 4, TOWER: 3 } },
];

function normalise(cells) {
  let minX = Infinity;
  let minY = Infinity;
  for (const [x, y] of cells) { if (x < minX) minX = x; if (y < minY) minY = y; }
  return cells.map(([x, y]) => [x - minX, y - minY]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}

const key = (cells) => cells.map((c) => c.join(',')).join(' ');

/** Clockwise on screen, in a y-up grid: (x, y) -> (y, -x). */
const rotCW = (cells) => normalise(cells.map(([x, y]) => [y, -x]));

function buildShape(name, base) {
  const states = [];
  const seen = new Set();
  let cur = normalise(base);
  for (let i = 0; i < 4; i++) {
    const k = key(cur);
    if (!seen.has(k)) {
      seen.add(k);
      let w = 0;
      let h = 0;
      for (const [x, y] of cur) { if (x + 1 > w) w = x + 1; if (y + 1 > h) h = y + 1; }
      states.push({ cells: cur, w, h });
    }
    cur = rotCW(cur);
  }
  return { name, states, size: base.length };
}

export const SHAPES = Object.fromEntries(
  Object.entries(DEFS).map(([name, base]) => [name, buildShape(name, base)]),
);

export const SHAPE_NAMES = Object.keys(SHAPES);

export function bagWeights(wave) {
  let row = BAG_TABLE[0];
  for (const r of BAG_TABLE) if (wave >= r.wave) row = r;
  return row.weights;
}

/**
 * A shuffled-bag dealer. Weighted random alone produces runs of five POSTs,
 * which reads as the game being unfair rather than hard.
 */
export function makeDealer(rng) {
  let bag = [];
  let bagWave = -1;

  function refill(wave) {
    const weights = bagWeights(wave);
    bag = [];
    for (const [name, w] of Object.entries(weights)) {
      for (let i = 0; i < w; i++) bag.push(name);
    }
    for (let i = bag.length - 1; i > 0; i--) {
      const j = rng.int(i + 1);
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    bagWave = wave;
  }

  let last = null;
  let repeat = 0;

  return {
    next(wave) {
      if (!bag.length || wave !== bagWave) refill(wave);
      let shape = bag.pop();
      // A weighted bag will happily deal four TOWERs in a row. That is fair and
      // it feels rigged, so swap a third repeat for anything else still in the bag.
      if (shape === last && repeat >= 2) {
        const alt = bag.findIndex((s) => s !== shape);
        if (alt >= 0) { const swap = bag[alt]; bag[alt] = shape; shape = swap; }
      }
      repeat = shape === last ? repeat + 1 : 1;
      last = shape;
      return shape;
    },
    reset() { bag = []; bagWave = -1; last = null; repeat = 0; },
  };
}
