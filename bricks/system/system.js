/* ===========================================================================
   Brick Lab — the system
   ---------------------------------------------------------------------------
   The shared studs-and-tubes core that all five concepts clip into. If two
   concepts ever merge, this is the reason it will be cheap: they already speak
   the same model format, use the same part catalogue and measure in the same
   units.

   GEOMETRY. Real brick dimensions, so anything measured off a brick on the
   carpet lines up with anything drawn on screen:

       stud pitch      8.0 mm    (centre to centre, X and Z)
       plate height    3.2 mm    (Y)
       brick height    9.6 mm    = 3 plates
       stud diameter   4.8 mm
       stud height     1.8 mm

   COORDINATES. A placement sits on an integer grid:

       x, z   in studs   (the footprint)
       y      in plates  (the height, so plates and bricks share one axis)
       r      quarter turns about Y, 0–3

   Everything the renderer needs is in stud-widths, hence the *_U constants:
   one plate is 0.4 of a stud width. Keeping one isotropic unit means face
   normals are true and the isometric projection stays honest.

   This file is deliberately free of browser globals so `test/run.js` can load
   it in node. Geometry lives in iso.js, build order lives in steps.js.
   =========================================================================== */

/* ── Units ───────────────────────────────────────────────────────────────── */

const STUD_MM = 8.0;
const PLATE_MM = 3.2;
const BRICK_PLATES = 3;

const PLATE_U = PLATE_MM / STUD_MM;   /* 0.400 — one plate, in stud widths   */
const STUD_R_U = 2.4 / STUD_MM;       /* 0.300 — stud radius                 */
const STUD_H_U = 1.8 / STUD_MM;       /* 0.225 — stud height                 */

/* ── Colours ─────────────────────────────────────────────────────────────── */
/* Names follow the LEGO Group's own colour names because they are the ones
   printed in instruction booklets and used by the fan community, so a child
   comparing screen to box has a fighting chance. The hex values are the
   community-standard approximations (LDraw / BrickLink); real ABS varies with
   the light, so treat them as close rather than exact. */

const COLOURS = [
  { id: 'white',   name: 'White',              hex: '#f2f3f2' },
  { id: 'lgrey',   name: 'Medium Stone Grey',  hex: '#a0a5a9' },
  { id: 'dgrey',   name: 'Dark Stone Grey',    hex: '#6c6e68' },
  { id: 'black',   name: 'Black',              hex: '#1b2a34' },
  { id: 'red',     name: 'Bright Red',         hex: '#c91a09' },
  { id: 'orange',  name: 'Bright Orange',      hex: '#fe8a18' },
  { id: 'yellow',  name: 'Bright Yellow',      hex: '#f2cd37' },
  { id: 'lime',    name: 'Bright Yellowgreen', hex: '#bbe90b' },
  { id: 'green',   name: 'Dark Green',         hex: '#237841' },
  { id: 'bgreen',  name: 'Bright Green',       hex: '#4b9f4a' },
  { id: 'sand',    name: 'Sand Green',         hex: '#a0bcac' },
  { id: 'azure',   name: 'Medium Azur',        hex: '#36aebf' },
  { id: 'blue',    name: 'Bright Blue',        hex: '#0055bf' },
  { id: 'dblue',   name: 'Earth Blue',         hex: '#0a3463' },
  { id: 'purple',  name: 'Medium Lilac',       hex: '#81007b' },
  { id: 'pink',    name: 'Bright Pink',        hex: '#fc97ac' },
  { id: 'tan',     name: 'Brick Yellow',       hex: '#e4cd9e' },
  { id: 'brown',   name: 'Reddish Brown',      hex: '#582a12' },
];

const COLOUR = {};
COLOURS.forEach(function (c) { COLOUR[c.id] = c; });

/* ── Parts ───────────────────────────────────────────────────────────────── */
/* `w` is the first number in the name and runs along X; `d` is the second and
   runs along Z. `h` is in plates. `kind` tells the renderer what shape to
   build and tells the rest of the system whether it has studs on top.

   Slopes descend along +X: `flat` is how many studs at the low-X end stay at
   full height and keep their studs. A 45-degree slope falls 9.6 mm over
   1.2 studs, which is why a 2x1 slope has roughly one flat stud left. */

const PARTS = [
  /* Bricks — 3 plates tall */
  { id: 'b1x1', name: 'Brick 1×1', kind: 'brick', w: 1, d: 1, h: 3 },
  { id: 'b1x2', name: 'Brick 1×2', kind: 'brick', w: 1, d: 2, h: 3 },
  { id: 'b1x3', name: 'Brick 1×3', kind: 'brick', w: 1, d: 3, h: 3 },
  { id: 'b1x4', name: 'Brick 1×4', kind: 'brick', w: 1, d: 4, h: 3 },
  { id: 'b1x6', name: 'Brick 1×6', kind: 'brick', w: 1, d: 6, h: 3 },
  { id: 'b1x8', name: 'Brick 1×8', kind: 'brick', w: 1, d: 8, h: 3 },
  { id: 'b2x2', name: 'Brick 2×2', kind: 'brick', w: 2, d: 2, h: 3 },
  { id: 'b2x3', name: 'Brick 2×3', kind: 'brick', w: 2, d: 3, h: 3 },
  { id: 'b2x4', name: 'Brick 2×4', kind: 'brick', w: 2, d: 4, h: 3 },
  { id: 'b2x6', name: 'Brick 2×6', kind: 'brick', w: 2, d: 6, h: 3 },
  { id: 'b2x8', name: 'Brick 2×8', kind: 'brick', w: 2, d: 8, h: 3 },

  /* Plates — 1 plate tall */
  { id: 'p1x1', name: 'Plate 1×1', kind: 'plate', w: 1, d: 1, h: 1 },
  { id: 'p1x2', name: 'Plate 1×2', kind: 'plate', w: 1, d: 2, h: 1 },
  { id: 'p1x4', name: 'Plate 1×4', kind: 'plate', w: 1, d: 4, h: 1 },
  { id: 'p1x6', name: 'Plate 1×6', kind: 'plate', w: 1, d: 6, h: 1 },
  { id: 'p2x2', name: 'Plate 2×2', kind: 'plate', w: 2, d: 2, h: 1 },
  { id: 'p2x4', name: 'Plate 2×4', kind: 'plate', w: 2, d: 4, h: 1 },
  { id: 'p2x6', name: 'Plate 2×6', kind: 'plate', w: 2, d: 6, h: 1 },
  { id: 'p2x8', name: 'Plate 2×8', kind: 'plate', w: 2, d: 8, h: 1 },
  { id: 'p4x4', name: 'Plate 4×4', kind: 'plate', w: 4, d: 4, h: 1 },
  { id: 'p4x6', name: 'Plate 4×6', kind: 'plate', w: 4, d: 6, h: 1 },
  { id: 'p4x8', name: 'Plate 4×8', kind: 'plate', w: 4, d: 8, h: 1 },
  { id: 'p6x8', name: 'Plate 6×8', kind: 'plate', w: 6, d: 8, h: 1 },

  /* Tiles — a plate with a smooth top, so nothing clips on above it */
  { id: 't1x2', name: 'Tile 1×2', kind: 'tile', w: 1, d: 2, h: 1 },
  { id: 't1x4', name: 'Tile 1×4', kind: 'tile', w: 1, d: 4, h: 1 },
  { id: 't2x2', name: 'Tile 2×2', kind: 'tile', w: 2, d: 2, h: 1 },

  /* Slopes — roofs, bonnets and noses */
  { id: 's2x1', name: 'Slope 2×1', kind: 'slope', w: 2, d: 1, h: 3, flat: 1 },
  { id: 's2x2', name: 'Slope 2×2', kind: 'slope', w: 2, d: 2, h: 3, flat: 1 },
  { id: 's3x1', name: 'Slope 3×1', kind: 'slope', w: 3, d: 1, h: 3, flat: 1 },

  /* Round — wheels, chimneys, eyes */
  { id: 'r1x1', name: 'Round Brick 1×1', kind: 'round', w: 1, d: 1, h: 3 },
  { id: 'q1x1', name: 'Round Plate 1×1', kind: 'round', w: 1, d: 1, h: 1 },
];

const PART = {};
PARTS.forEach(function (p) { PART[p.id] = p; });

/* Parts with studs on top. A tile is the only thing here you cannot build on,
   which matters to the stability check and to the instruction compiler. */
function hasStuds(partId) {
  const p = PART[partId];
  return !!p && p.kind !== 'tile';
}

/* Compact name for tight spaces — parts callouts, tray labels, captions.
   Follows how people actually talk about bricks: a plain brick is just its
   size, and anything that is not a brick says so. */
function shortName(partId) {
  const p = PART[partId];
  if (!p) return partId;
  const size = p.w + '×' + p.d;
  return p.kind === 'brick' ? size : size + ' ' + p.kind;
}

/* ── Placements ──────────────────────────────────────────────────────────── */
/* A placement is { part, c, x, y, z, r }. Small keys because models travel in
   URLs, and a ten-brick model should fit in a text message. */

function place(partId, colourId, x, y, z, r) {
  return { part: partId, c: colourId, x: x | 0, y: y | 0, z: z | 0, r: ((r | 0) % 4 + 4) % 4 };
}

/* Footprint after rotation. Odd quarter turns swap width and depth. */
function footprint(partId, r) {
  const p = PART[partId];
  if (!p) return { w: 1, d: 1 };
  return (((r | 0) % 2) === 0) ? { w: p.w, d: p.d } : { w: p.d, d: p.w };
}

/* Height of the surface a placement offers, in plates. */
function topOf(pl) {
  const p = PART[pl.part];
  return pl.y + (p ? p.h : 1);
}

/* Every grid cell a placement fills. Slopes are treated as their full box:
   that is stricter than reality (you can tuck a plate under a slope's
   overhang) but it never lets a child build something that will not hold. */
function cellsOf(pl) {
  const p = PART[pl.part];
  if (!p) return [];
  const f = footprint(pl.part, pl.r);
  const out = [];
  for (let dx = 0; dx < f.w; dx++) {
    for (let dz = 0; dz < f.d; dz++) {
      for (let dy = 0; dy < p.h; dy++) {
        out.push((pl.x + dx) + ',' + (pl.y + dy) + ',' + (pl.z + dz));
      }
    }
  }
  return out;
}

/* Map of cell -> index of the placement filling it. */
function occupancy(parts) {
  const map = new Map();
  parts.forEach(function (pl, i) {
    cellsOf(pl).forEach(function (k) { map.set(k, i); });
  });
  return map;
}

/* Would this placement pass through something already there? */
function collides(parts, pl, ignoreIndex) {
  const map = occupancy(parts.filter(function (_, i) { return i !== ignoreIndex; }));
  return cellsOf(pl).some(function (k) { return map.has(k); });
}

/* Do two placements overlap when seen from above? */
function overlapsXZ(a, b) {
  const fa = footprint(a.part, a.r), fb = footprint(b.part, b.r);
  return a.x < b.x + fb.w && b.x < a.x + fa.w &&
         a.z < b.z + fb.d && b.z < a.z + fa.d;
}

/* Indices of the placements a given placement is resting on. */
function supportersOf(parts, i) {
  const me = parts[i];
  const out = [];
  parts.forEach(function (other, j) {
    if (j === i) return;
    if (topOf(other) !== me.y) return;
    if (!hasStuds(other.part)) return;      /* a tile offers nothing to clip to */
    if (overlapsXZ(me, other)) out.push(j);
  });
  return out;
}

/* Indices of anything that is not held up, directly or through a chain, by the
   ground. A model with none of these will survive being picked up. Hanging
   parts — held only from above — are reported as floating; that is a known
   simplification, noted in the README. */
function floatingParts(parts) {
  const held = new Set();
  parts.forEach(function (pl, i) { if (pl.y === 0) held.add(i); });

  let grew = true;
  while (grew) {
    grew = false;
    parts.forEach(function (pl, i) {
      if (held.has(i)) return;
      const sup = supportersOf(parts, i);
      if (sup.some(function (j) { return held.has(j); })) { held.add(i); grew = true; }
    });
  }

  const out = [];
  parts.forEach(function (_, i) { if (!held.has(i)) out.push(i); });
  return out;
}

/* Bounding box on the grid. x1/y1/z1 are exclusive. */
function boundsOf(parts) {
  if (!parts.length) return { x0: 0, x1: 0, y0: 0, y1: 0, z0: 0, z1: 0 };
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  parts.forEach(function (pl) {
    const f = footprint(pl.part, pl.r);
    const p = PART[pl.part];
    x0 = Math.min(x0, pl.x); x1 = Math.max(x1, pl.x + f.w);
    z0 = Math.min(z0, pl.z); z1 = Math.max(z1, pl.z + f.d);
    y0 = Math.min(y0, pl.y); y1 = Math.max(y1, pl.y + (p ? p.h : 1));
  });
  return { x0: x0, x1: x1, y0: y0, y1: y1, z0: z0, z1: z1 };
}

/* Bill of materials: what you need to pull out of the tub. */
function bom(parts) {
  const counts = new Map();
  parts.forEach(function (pl) {
    const k = pl.part + '|' + pl.c;
    counts.set(k, (counts.get(k) || 0) + 1);
  });
  return Array.from(counts.entries()).map(function (e) {
    const bits = e[0].split('|');
    return { part: bits[0], c: bits[1], n: e[1] };
  }).sort(function (a, b) {
    return b.n - a.n || a.part.localeCompare(b.part);
  });
}

/* Everything wrong with a model, in the order worth fixing it. */
function validate(parts) {
  const issues = [];
  if (!parts.length) issues.push({ kind: 'empty', msg: 'Nothing built yet.' });

  const seen = new Map();
  parts.forEach(function (pl, i) {
    cellsOf(pl).forEach(function (k) {
      if (seen.has(k) && seen.get(k) !== i) {
        issues.push({ kind: 'collision', at: i, with: seen.get(k), msg: 'Two parts share the same space.' });
      }
      seen.set(k, i);
    });
    if (pl.y < 0) issues.push({ kind: 'underground', at: i, msg: 'A part sits below the ground.' });
  });

  floatingParts(parts).forEach(function (i) {
    issues.push({ kind: 'floating', at: i, msg: 'A part is not resting on anything.' });
  });

  /* De-duplicate collision pairs, which are reported from both sides. */
  const keyed = new Set();
  return issues.filter(function (it) {
    const k = it.kind + ':' + [it.at, it.with].sort().join('-');
    if (keyed.has(k)) return false;
    keyed.add(k); return true;
  });
}

/* ── Model container ─────────────────────────────────────────────────────── */

function newModel(name) {
  return { v: 1, name: name || 'Untitled', parts: [] };
}

/* Rotate a whole model a quarter turn at a time about Y, keeping it in the
   positive quadrant. Used for turning the view: rotating the data rather than
   the camera means placement maths never needs an inverse transform. */
function rotateParts(parts, k) {
  k = ((k | 0) % 4 + 4) % 4;
  if (!parts.length) return [];
  const src = parts.map(function (p) { return Object.assign({}, p); });
  if (k === 0) return src;

  const b = boundsOf(src);
  const W = b.x1 - b.x0, D = b.z1 - b.z0;

  return src.map(function (p) {
    const f = footprint(p.part, p.r);
    const x = p.x - b.x0, z = p.z - b.z0;
    let nx, nz;
    if (k === 1)      { nx = D - z - f.d; nz = x; }
    else if (k === 2) { nx = W - x - f.w; nz = D - z - f.d; }
    else              { nx = z;           nz = W - x - f.w; }
    return Object.assign({}, p, { x: nx, z: nz, r: (p.r + k) % 4 });
  });
}

/* ── Share format ────────────────────────────────────────────────────────── */
/* Small enough to live in a URL hash. One line, one part:
   1|Cottage|b2x4,red,0,0,0,0;p1x2,white,1,3,0,1                             */

function encode(model) {
  const rows = model.parts.map(function (p) {
    return [p.part, p.c, p.x, p.y, p.z, p.r].join(',');
  });
  return [1, (model.name || 'Untitled').replace(/[|;]/g, ' '), rows.join(';')].join('|');
}

function decode(str) {
  const model = newModel('Untitled');
  if (typeof str !== 'string' || !str) return model;

  const head = str.split('|');
  if (head.length < 3) return model;
  model.name = head[1] || 'Untitled';

  head.slice(2).join('|').split(';').forEach(function (row) {
    if (!row) return;
    const f = row.split(',');
    if (f.length < 6) return;
    if (!PART[f[0]]) return;                                  /* unknown part  */
    const c = COLOUR[f[1]] ? f[1] : 'lgrey';                  /* unknown colour */
    const nums = [f[2], f[3], f[4], f[5]].map(Number);
    if (nums.some(function (n) { return !isFinite(n); })) return;
    model.parts.push(place(f[0], c, nums[0], nums[1], nums[2], nums[3]));
  });
  return model;
}

/* ── Seeded randomness ───────────────────────────────────────────────────── */
/* mulberry32. A seed has to reproduce a model exactly, or "round 7 of seed
   4821" means nothing when two families compare scores. */

function rngFrom(seed) {
  let a = (seed >>> 0) || 1;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── Generator ───────────────────────────────────────────────────────────── */
/* Grows a small, legal, connected model. Used by Blind Build for its rounds
   and by Bench for "surprise me". Every part is checked for collisions and
   support as it goes, so the result is always something you could actually
   build on a table. */

function generate(opts) {
  opts = opts || {};
  const pool = (opts.parts && opts.parts.length ? opts.parts : ['b1x1', 'b1x2', 'b2x2', 'b2x4', 'b1x4'])
    .filter(function (id) { return !!PART[id]; });
  const cols = (opts.colours && opts.colours.length ? opts.colours : ['red', 'blue', 'yellow', 'white'])
    .filter(function (id) { return !!COLOUR[id]; });
  const count = Math.max(1, Math.min(40, opts.count || 7));
  const rand = rngFrom(opts.seed === undefined ? (Date.now() & 0xffffffff) : opts.seed);

  if (!pool.length || !cols.length) return newModel(opts.name);

  const pick = function (arr) { return arr[Math.floor(rand() * arr.length) % arr.length]; };
  const parts = [];

  parts.push(place(pick(pool), pick(cols), 0, 0, 0, Math.floor(rand() * 4)));

  let guard = count * 80;
  while (parts.length < count && guard-- > 0) {
    const anchor = parts[Math.floor(rand() * parts.length) % parts.length];
    const af = footprint(anchor.part, anchor.r);
    const partId = pick(pool);
    const r = Math.floor(rand() * 4);
    const f = footprint(partId, r);

    let x, y, z;
    if (rand() < 0.62) {
      /* Stack it: somewhere on top of the anchor, allowed to overhang. */
      if (!hasStuds(anchor.part)) continue;
      y = topOf(anchor);
      x = anchor.x + Math.floor(rand() * (af.w + f.w - 1)) - (f.w - 1);
      z = anchor.z + Math.floor(rand() * (af.d + f.d - 1)) - (f.d - 1);
    } else {
      /* Sit it alongside, on the same level. */
      y = anchor.y;
      if (rand() < 0.5) {
        x = rand() < 0.5 ? anchor.x - f.w : anchor.x + af.w;
        z = anchor.z + Math.floor(rand() * af.d);
      } else {
        z = rand() < 0.5 ? anchor.z - f.d : anchor.z + af.d;
        x = anchor.x + Math.floor(rand() * af.w);
      }
    }

    const cand = place(partId, pick(cols), x, y, z, r);
    if (cand.y < 0) continue;
    if (collides(parts, cand, -1)) continue;

    /* Must land on the ground or on something that already exists. */
    const trial = parts.concat([cand]);
    if (floatingParts(trial).length) continue;

    parts.push(cand);
  }

  /* Shift into the positive quadrant so shared models all start from a corner. */
  const b = boundsOf(parts);
  parts.forEach(function (p) { p.x -= b.x0; p.z -= b.z0; });

  const m = newModel(opts.name || 'Round');
  m.parts = parts;
  return m;
}
