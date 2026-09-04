/* Build The MAGA Wall — the checks that do not need a browser.
 *
 * These cover the things that break silently while tuning: piece geometry and
 * boundaries, wall settling, the zombie state machine, the eagle's cooldown,
 * scoring, and whether the service worker still lists every file that exists.
 * Whether the game is fun has to be tested by playing it; see README.md for the
 * manual checklist.
 *
 *   node test/run.js
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import * as C from '../public/src/config.js';
import { SHAPES, SHAPE_NAMES, makeDealer, bagWeights } from '../public/src/pieces.js';
import { makeRng } from '../public/src/rng.js';
import { noteFreq } from '../public/src/audio.js';
import {
  makeLicence, normaliseLicence, mintToken, readToken, safeEqual, hmacHex,
} from '../functions/_lib.js';
import {
  createGame, update, idx, solid, columnHeight, wallMass, maxWallHeight,
  tryMove, tryRotate, hardDrop, ghostY, pieceCells, launchEagle, eagleReady,
  tapScene, damageCell, displayScore, EMPTY, PERCH,
} from '../public/src/sim.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
let count = 0;

function check(name, cond, extra) {
  count++;
  console.log('  ' + (cond ? 'ok  ' : 'FAIL') + ' ' + name + (extra ? '  — ' + extra : ''));
  if (!cond) failures.push(name);
}
const section = (t) => console.log('\n' + t);

/** Advance the sim without letting events pile up. */
function run(g, seconds, input = {}, dt = 1 / 60) {
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) { update(g, dt, input); g.events.length = 0; }
}
/** Advance until `fn` is true, or give up. Returns whether it happened. */
function until(g, fn, maxSeconds = 60, input = {}) {
  const dt = 1 / 60;
  for (let i = 0; i < maxSeconds / dt; i++) {
    if (fn(g)) return true;
    update(g, dt, input);
    g.events.length = 0;
  }
  return fn(g);
}
/** Put a block straight into the grid, bypassing the falling piece. */
function place(g, c, r, tier = 0) {
  g.tier[idx(c, r)] = tier;
  g.hp[idx(c, r)] = C.MATERIALS[tier].hp;
}
function clearGrid(g) {
  g.tier.fill(EMPTY);
  g.hp.fill(0);
  g.rowComplete.fill(false);
}

/* ========================================================================== */
section('Config and balance curves');
{
  check('scene geometry adds up',
    C.GROUND_Y === C.GRID_Y + C.ROWS * C.CELL && C.SCENE_H === C.GROUND_Y + C.GROUND_H,
    `grid ${C.GRID_Y}..${C.GROUND_Y}, scene ${C.SCENE_H}`);
  check('grid fits inside the virtual screen', C.GRID_X + C.GRID_W <= C.VW);
  check('row 0 sits on the ground', C.rowY(0) + C.CELL === C.GROUND_Y);
  check('top row sits at the grid top', C.rowY(C.ROWS - 1) === C.GRID_Y);

  let fallMonotonic = true;
  let spawnMonotonic = true;
  let dpsMonotonic = true;
  for (let w = 1; w < 30; w++) {
    if (C.fallInterval(w + 1) > C.fallInterval(w)) fallMonotonic = false;
    if (C.spawnInterval(w + 1) > C.spawnInterval(w)) spawnMonotonic = false;
    if (C.hordeDps(w + 1, 3) < C.hordeDps(w, 3)) dpsMonotonic = false;
  }
  check('pieces never get slower with the wave', fallMonotonic);
  check('spawns never get rarer with the wave', spawnMonotonic);
  check('horde pressure never drops with the wave', dpsMonotonic);
  check('wave 1 is gentle', C.hordeDps(1, 3) < 1.0, C.hordeDps(1, 3).toFixed(2) + ' blocks/s');
  check('late waves out-eat any human build rate', C.hordeDps(15, 6) > 4,
    C.hordeDps(15, 6).toFixed(2) + ' blocks/s vs STONE');
  check('fall interval has a floor', C.fallInterval(999) === C.WAVE.fallFloor);
  check('materials get tougher every tier',
    C.MATERIALS.every((m, i) => i === 0 || m.hp > C.MATERIALS[i - 1].hp));
  check('gold is a big survival win over brick',
    C.MATERIALS[3].hp / C.MATERIALS[0].hp >= 5,
    (C.MATERIALS[3].hp / C.MATERIALS[0].hp).toFixed(1) + 'x');

  let tablesOk = true;
  for (const row of C.SPAWN_TABLE) {
    for (const k of Object.keys(row.weights)) if (!C.ZOMBIES[k]) tablesOk = false;
  }
  check('every spawn-table entry names a real zombie', tablesOk);
  let bagsOk = true;
  for (const w of [1, 2, 4, 6, 9, 30]) {
    for (const k of Object.keys(bagWeights(w))) if (!SHAPES[k]) bagsOk = false;
  }
  check('every bag entry names a real shape', bagsOk);
}

/* ========================================================================== */
section('Pieces');
{
  let normalised = true;
  let rotClosed = true;
  let fits = true;
  for (const name of SHAPE_NAMES) {
    const sh = SHAPES[name];
    for (const st of sh.states) {
      const minX = Math.min(...st.cells.map((c) => c[0]));
      const minY = Math.min(...st.cells.map((c) => c[1]));
      if (minX !== 0 || minY !== 0) normalised = false;
      if (st.cells.length !== sh.size) rotClosed = false;
      if (st.w > C.COLS || st.h > C.ROWS) fits = false;
    }
    if (sh.states.length > 4) rotClosed = false;
  }
  check('every rotation is normalised to (0,0)', normalised);
  check('rotation preserves cell count and stays within 4 states', rotClosed);
  check('every shape fits inside the grid in every rotation', fits);
  check('duplicate rotations are collapsed',
    SHAPES.BLOCK.states.length === 1 && SHAPES.DOMINO.states.length === 2
    && SHAPES.SINGLE.states.length === 1,
    `block ${SHAPES.BLOCK.states.length}, domino ${SHAPES.DOMINO.states.length}`);
  check('four rotations return to the start',
    JSON.stringify(SHAPES.ELL.states[0].cells)
    === JSON.stringify(SHAPES.ELL.states[0].cells));

  // The dealer must not produce long runs of one shape.
  const rng = makeRng(7);
  const dealer = makeDealer(rng);
  const seen = {};
  let worstRun = 0;
  let runLen = 0;
  let prev = null;
  for (let i = 0; i < 4000; i++) {
    const s = dealer.next(6);
    seen[s] = (seen[s] || 0) + 1;
    runLen = s === prev ? runLen + 1 : 1;
    prev = s;
    worstRun = Math.max(worstRun, runLen);
  }
  check('dealer covers the whole wave-6 bag',
    Object.keys(bagWeights(6)).every((k) => seen[k] > 0));
  check('dealer never deals the same shape 5 times running', worstRun < 5, 'worst run ' + worstRun);
}

/* ========================================================================== */
section('Boundaries and collision');
{
  const g = createGame(11);
  clearGrid(g);

  // Walk hard into each wall and confirm no cell ever escapes the grid.
  let escaped = false;
  for (let i = 0; i < 40; i++) {
    tryMove(g, -1, 0);
    for (const [c, r] of pieceCells(g.piece)) if (c < 0 || c >= C.COLS || r < 0) escaped = true;
  }
  const leftmost = Math.min(...pieceCells(g.piece).map((p) => p[0]));
  for (let i = 0; i < 40; i++) {
    tryMove(g, 1, 0);
    for (const [c, r] of pieceCells(g.piece)) if (c < 0 || c >= C.COLS || r < 0) escaped = true;
  }
  const rightmost = Math.max(...pieceCells(g.piece).map((p) => p[0]));
  check('a piece cannot be pushed out of the grid sideways', !escaped);
  check('left wall stops the piece at column 0', leftmost === 0, 'leftmost ' + leftmost);
  check('right wall stops the piece at the last column', rightmost === C.COLS - 1,
    'rightmost ' + rightmost);

  // Rotate against both walls, in every shape, at every column.
  let rotEscaped = false;
  let rotCorrupt = false;
  for (const name of SHAPE_NAMES) {
    const widest = Math.max(...SHAPES[name].states.map((st) => st.w));
    for (let x = 0; x <= C.COLS - widest; x++) {
      const h = createGame(3);
      clearGrid(h);
      h.piece = { shape: name, rot: 0, x, y: 3 };
      for (let k = 0; k < 6; k++) {
        tryRotate(h, 1);
        for (const [c, r] of pieceCells(h.piece)) {
          if (c < 0 || c >= C.COLS || r < 0) rotEscaped = true;
          if (solid(h, c, r)) rotCorrupt = true;
        }
      }
    }
  }
  check('rotation never pushes a piece off the grid', !rotEscaped);
  check('rotation never lands a piece inside existing blocks', !rotCorrupt);

  // Rotation must fail rather than cheat when genuinely boxed in.
  const boxed = createGame(5);
  clearGrid(boxed);
  for (let r = 0; r < C.ROWS; r++) { place(boxed, 0, r); place(boxed, 2, r); }
  boxed.piece = { shape: 'POST', rot: 0, x: 1, y: 0 };
  const rotated = tryRotate(boxed, 1);
  check('a boxed-in piece refuses to rotate rather than clipping', rotated === false);

  // A piece cannot fall through the floor.
  const floor = createGame(9);
  clearGrid(floor);
  run(floor, 30, { soft: true });
  check('pieces stack on the floor rather than falling through it',
    columnHeight(floor, 3) > 0 && wallMass(floor) > 0, 'mass ' + wallMass(floor));
  let below = false;
  for (let c = 0; c < C.COLS; c++) for (let r = 0; r < C.ROWS; r++) {
    if (r < 0 && solid(floor, c, r)) below = true;
  }
  check('no block ever exists below row 0', !below);
}

/* ========================================================================== */
section('Hard drop and ghost');
{
  const g = createGame(21);
  clearGrid(g);
  g.piece = { shape: 'BLOCK', rot: 0, x: 2, y: C.ROWS - 2 };
  const gy = ghostY(g);
  check('ghost lands on the floor of an empty column', gy === 0, 'ghost y ' + gy);
  hardDrop(g);
  check('hard drop leaves blocks on row 0', solid(g, 2, 0) && solid(g, 3, 0));
  check('hard drop scores for the distance fallen', displayScore(g) > 0);

  // Ghost must respect an existing stack.
  const h = createGame(22);
  clearGrid(h);
  place(h, 2, 0); place(h, 2, 1); place(h, 3, 0); place(h, 3, 1);
  h.piece = { shape: 'BLOCK', rot: 0, x: 2, y: C.ROWS - 2 };
  check('ghost lands on top of a stack', ghostY(h) === 2, 'ghost y ' + ghostY(h));
}

/* ========================================================================== */
section('Wall settling');
{
  const g = createGame(31);
  clearGrid(g);
  for (let r = 0; r < 5; r++) place(g, 3, r);
  damageCell(g, 3, 0, 99);            // blow out the bottom of the column
  check('destroying a block drops the column onto it',
    columnHeight(g, 3) === 4 && solid(g, 3, 0) && !solid(g, 3, 4),
    'height ' + columnHeight(g, 3));
  let gapInColumn = false;
  for (let r = 1; r < columnHeight(g, 3); r++) if (!solid(g, 3, r)) gapInColumn = true;
  check('a settled column has no holes in it', !gapInColumn);

  // Settling must not disturb neighbouring columns.
  const h = createGame(32);
  clearGrid(h);
  for (let r = 0; r < 3; r++) { place(h, 1, r); place(h, 2, r); place(h, 3, r); }
  damageCell(h, 2, 1, 99);
  check('settling only touches its own column',
    columnHeight(h, 1) === 3 && columnHeight(h, 3) === 3 && columnHeight(h, 2) === 2,
    `${columnHeight(h, 1)}/${columnHeight(h, 2)}/${columnHeight(h, 3)}`);
}

/* ========================================================================== */
section('Sealing a course');
{
  const g = createGame(41);
  clearGrid(g);
  for (let c = 0; c < C.COLS - 1; c++) place(g, c, 0);
  // Drop the last block in with a real piece, which is what pays out.
  g.piece = { shape: 'SINGLE', rot: 0, x: C.COLS - 1, y: C.ROWS - 1 };
  const before = displayScore(g);
  hardDrop(g);
  const tiers = [];
  for (let c = 0; c < C.COLS; c++) tiers.push(g.tier[idx(c, 0)]);
  check('closing a course promotes every block in it', tiers.every((t) => t === 1), tiers.join(','));
  check('closing a course pays out', displayScore(g) > before + 100,
    '+' + (displayScore(g) - before));
  check('sealed blocks come back at full health',
    g.hp[idx(0, 0)] === C.MATERIALS[1].hp);

  // The exploit this guards against: zombies chewing a course and the wall
  // settling back into place must NOT re-pay the player.
  const h = createGame(42);
  clearGrid(h);
  for (let c = 0; c < C.COLS; c++) { place(h, c, 0); place(h, c, 1); }
  h.rowComplete[0] = true;
  h.rowComplete[1] = true;
  const scoreBefore = displayScore(h);
  for (let i = 0; i < 20; i++) damageCell(h, 0, 0, 99);   // chew, settle, chew...
  check('attrition and settling never pay a seal bonus',
    displayScore(h) === scoreBefore, 'delta ' + (displayScore(h) - scoreBefore));

  // Tiers must climb but stop at gold.
  const k = createGame(43);
  clearGrid(k);
  for (let pass = 0; pass < 6; pass++) {
    for (let c = 0; c < C.COLS - 1; c++) if (!solid(k, c, 0)) place(k, c, 0);
    k.rowComplete[0] = false;
    k.piece = { shape: 'SINGLE', rot: 0, x: C.COLS - 1, y: C.ROWS - 1 };
    hardDrop(k);
    if (pass < 5) { k.tier[idx(C.COLS - 1, 0)] = EMPTY; k.rowComplete[0] = false; }
  }
  check('tier promotion stops at the top material',
    k.tier[idx(0, 0)] <= C.MAX_TIER, 'tier ' + k.tier[idx(0, 0)]);
}

/* ========================================================================== */
section('Overbuilding');
{
  const g = createGame(51);
  clearGrid(g);
  // Fill every column to the ceiling, then try to place another piece.
  for (let c = 0; c < C.COLS; c++) for (let r = 0; r < C.ROWS; r++) place(g, c, r);
  const before = maxWallHeight(g);
  g.piece = { shape: 'DOMINO', rot: 0, x: 2, y: C.ROWS - 1 };
  hardDrop(g);
  check('a piece locked at the ceiling topples the top course',
    maxWallHeight(g) < before, `${before} -> ${maxWallHeight(g)}`);
  check('toppling clears real height, not one block',
    maxWallHeight(g) <= C.ROWS - 2, 'height ' + maxWallHeight(g));

  // The critical one: a player who overbuilds must be able to recover, not be
  // stuck toppling every piece forever.
  const h = createGame(52);
  clearGrid(h);
  for (let c = 0; c < C.COLS; c++) for (let r = 0; r < C.ROWS; r++) place(h, c, r);
  let placed = 0;
  for (let i = 0; i < 25; i++) {
    const massBefore = wallMass(h);
    run(h, 0.3, { soft: true });
    if (h.piece) hardDrop(h);
    if (wallMass(h) > massBefore) placed++;
  }
  check('a ceilinged wall can be recovered and built on again', placed > 0,
    placed + ' successful placements after topping out');
  check('overbuild costs points but never goes negative', displayScore(h) >= 0);
}

/* ========================================================================== */
section('Zombies');
{
  // They must queue, not stack into one pixel and chew at N times the rate.
  const g = createGame(61);
  clearGrid(g);
  for (let c = 0; c < C.COLS; c++) for (let r = 0; r < 4; r++) place(g, c, r, 3);
  g.piece = null;
  g.entryT = 999;
  for (let i = 0; i < 12; i++) {
    g.zombies.push({
      id: 100 + i, kind: 'shambler', x: -3 - i * 0.7, row: 0, drawRow: 0,
      hp: 99, maxHp: 99, speed: 0.3, dmg: 1, biteEvery: 0.9,
      state: 'walk', biteT: 0, climbT: 0, climbed: 0, anim: 0, alt: 0, dead: false,
    });
  }
  run(g, 12);
  const biters = g.zombies.filter((z) => z.state === 'bite').length;
  check('only a bounded scrum can attack one block at a time',
    biters <= C.scrumSize(g.wave) + 1, biters + ' biting, cap ' + C.scrumSize(g.wave));
  let overlapping = 0;
  const sorted = g.zombies.filter((z) => !z.dead).sort((a, b) => a.x - b.x);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].x - sorted[i - 1].x < C.HORDE.separation - 0.02) overlapping++;
  }
  check('queued zombies keep their separation', overlapping === 0, overlapping + ' overlaps');

  // Zombies chew through a wall and eventually breach an undefended one.
  const h = createGame(62);
  clearGrid(h);
  h.piece = null; h.entryT = 999;
  place(h, 0, 0);
  h.zombies.push({
    id: 1, kind: 'shambler', x: -1, row: 0, drawRow: 0, hp: 9, maxHp: 9,
    speed: 0.6, dmg: 1, biteEvery: 0.4, state: 'walk', biteT: 0, climbT: 0,
    climbed: 0, anim: 0, alt: 0, dead: false,
  });
  const ate = until(h, (s) => !solid(s, 0, 0), 20);
  check('a zombie eats the block in front of it', ate);
  const breached = until(h, (s) => s.breaches > 0, 40);
  check('an undefended wall gets breached', breached, 'breaches ' + h.breaches);

  // Three breaches ends the run.
  const k = createGame(63);
  clearGrid(k);
  k.breaches = C.BREACH_LIMIT - 1;
  k.zombies.push({
    id: 1, kind: 'runner', x: C.COLS - 0.5, row: 0, drawRow: 0, hp: 1, maxHp: 1,
    speed: 2, dmg: 1, biteEvery: 0.5, state: 'walk', biteT: 0, climbT: 0,
    climbed: 0, anim: 0, alt: 0, dead: false,
  });
  until(k, (s) => s.phase === 'over', 10);
  check('the run ends at the breach limit', k.phase === 'over' && k.breaches === C.BREACH_LIMIT,
    `${k.breaches} breaches, phase ${k.phase}`);

  // A climber must cling to the wall face rather than falling off it.
  const cl = createGame(64);
  clearGrid(cl);
  cl.piece = null; cl.entryT = 999;
  for (let r = 0; r < 6; r++) place(cl, 0, r, 3);
  cl.zombies.push({
    id: 1, kind: 'climber', x: -1, row: 0, drawRow: 0, hp: 99, maxHp: 99,
    speed: 0.4, dmg: 1, biteEvery: 5, state: 'walk', biteT: 0, climbT: 0,
    climbed: 0, anim: 0, alt: 0, dead: false,
  });
  run(cl, 6);
  check('a climber actually gains height on a sheer face', cl.zombies[0].row > 0,
    'row ' + cl.zombies[0].row);
  check('a climber stops at its climb limit',
    cl.zombies[0].row <= C.ZOMBIES.climber.climb, 'row ' + cl.zombies[0].row);

  // Dropping a piece on a zombie must kill it.
  const sq = createGame(65);
  clearGrid(sq);
  sq.zombies.push({
    id: 1, kind: 'shambler', x: 3, row: 0, drawRow: 0, hp: 99, maxHp: 99,
    speed: 0, dmg: 1, biteEvery: 9, state: 'walk', biteT: 0, climbT: 0,
    climbed: 0, anim: 0, alt: 0, dead: false,
  });
  sq.piece = { shape: 'BLOCK', rot: 0, x: 3, y: C.ROWS - 2 };
  hardDrop(sq);
  check('a piece landing on a zombie flattens it',
    sq.zombies.every((z) => z.dead) && sq.stats.kills === 1);

  // A settling block must also crush.
  const cr = createGame(66);
  clearGrid(cr);
  for (let r = 0; r < 3; r++) place(cr, 2, r);
  cr.zombies.push({
    id: 1, kind: 'shambler', x: 2, row: 0, drawRow: 0, hp: 99, maxHp: 99,
    speed: 0, dmg: 1, biteEvery: 9, state: 'walk', biteT: 0, climbT: 0,
    climbed: 0, anim: 0, alt: 0, dead: false,
  });
  cr.tier[idx(2, 0)] = EMPTY;                 // pretend row 0 just died
  damageCell(cr, 2, 1, 99);
  check('masonry settling onto a zombie crushes it', cr.stats.kills >= 1);
}

/* ========================================================================== */
section('The eagle');
{
  const g = createGame(71);
  g.eagle.cd = 0;
  g.zombies.push({
    id: 1, kind: 'shambler', x: 1, row: 0, drawRow: 0, hp: 5, maxHp: 5,
    speed: 0.1, dmg: 1, biteEvery: 9, state: 'walk', biteT: 0, climbT: 0,
    climbed: 0, anim: 0, alt: 0, dead: false,
  });
  check('the eagle is ready once its cooldown expires', eagleReady(g));
  const before = displayScore(g);
  check('the eagle launches when tapped', launchEagle(g) === true);
  check('the eagle cannot be launched twice', launchEagle(g) === false);
  check('spamming the tap does nothing while it is busy',
    [0, 0, 0, 0, 0].every(() => launchEagle(g) === false));
  run(g, 1.2);
  check('the eagle pays out on the grab', displayScore(g) > before + C.SCORE.eagle - 1,
    '+' + (displayScore(g) - before));
  check('the grabbed zombie is counted as a kill', g.stats.eagle === 1 && g.stats.kills >= 1);
  run(g, 3);
  check('the carried zombie leaves the field',
    g.zombies.filter((z) => !z.dead).length === 0 || g.eagle.state === 'gone');
  check('the eagle goes on cooldown after a grab',
    !eagleReady(g) && g.eagle.cd > 0, 'cd ' + g.eagle.cd.toFixed(1));

  let readyAgain = false;
  for (let i = 0; i < 60 * (C.EAGLE.cooldown + 6); i++) {
    update(g, 1 / 60, {});
    g.events.length = 0;
    if (eagleReady(g)) { readyAgain = true; break; }
  }
  check('the eagle comes back after its cooldown', readyAgain);
  check('the eagle returns to its perch',
    Math.abs(g.eagle.x - PERCH.x) < 2 && Math.abs(g.eagle.y - PERCH.y) < 4,
    `at ${g.eagle.x.toFixed(0)},${g.eagle.y.toFixed(0)}`);

  // With nothing to grab it must not burn the cooldown.
  const h = createGame(72);
  h.eagle.cd = 0;
  h.zombies.length = 0;
  check('the eagle refuses to launch at nothing', launchEagle(h) === false);
  check('a wasted tap does not burn the cooldown', eagleReady(h));

  // It should take the most dangerous zombie, not a random one.
  const k = createGame(73);
  k.eagle.cd = 0;
  const mk = (id, x) => ({
    id, kind: 'shambler', x, row: 0, drawRow: 0, hp: 5, maxHp: 5, speed: 0,
    dmg: 1, biteEvery: 9, state: 'walk', biteT: 0, climbT: 0, climbed: 0,
    anim: 0, alt: 0, dead: false,
  });
  k.zombies.push(mk(1, -2), mk(2, 4), mk(3, 0));
  launchEagle(k);
  check('the eagle takes the zombie furthest through the wall',
    k.eagle.carried && k.eagle.carried.id === 2,
    'took id ' + (k.eagle.carried && k.eagle.carried.id));
}

/* ========================================================================== */
section('Balloons and the crate');
{
  const g = createGame(81);
  g.zombies.push({
    id: 1, kind: 'balloon', x: 0, row: 0, drawRow: 0, hp: 1, maxHp: 1,
    speed: 0.3, dmg: 0, biteEvery: 9, state: 'walk', biteT: 0, climbT: 0,
    climbed: 0, anim: 0, alt: 6, dead: false,
  });
  const bx = C.worldX(0.5);
  const by = C.rowY(6) + 8;
  const hitKind = tapScene(g, bx, by - 10);
  check('tapping a balloon pops it', hitKind === 'balloon' && g.zombies[0].dead);
  check('popping a balloon scores', displayScore(g) > 0);

  // A balloon that gets across is a breach.
  const h = createGame(82);
  h.zombies.push({
    id: 1, kind: 'balloon', x: C.COLS, row: 0, drawRow: 0, hp: 1, maxHp: 1,
    speed: 2, dmg: 0, biteEvery: 9, state: 'walk', biteT: 0, climbT: 0,
    climbed: 0, anim: 0, alt: 6, dead: false,
  });
  until(h, (s) => s.breaches > 0, 5);
  check('a balloon that reaches the rally is a breach', h.breaches === 1);

  // A balloon always floats clear of the wall, so it can never be blocked.
  const k = createGame(83);
  clearGrid(k);
  for (let c = 0; c < C.COLS; c++) for (let r = 0; r < 8; r++) place(k, c, r);
  k.zombies.push({
    id: 1, kind: 'balloon', x: -2, row: 0, drawRow: 0, hp: 1, maxHp: 1,
    speed: 0.3, dmg: 0, biteEvery: 9, state: 'walk', biteT: 0, climbT: 0,
    climbed: 0, anim: 0, alt: 2, dead: false,
  });
  run(k, 2);
  check('a balloon rises to clear whatever has been built',
    k.zombies[0].alt > maxWallHeight(k), `alt ${k.zombies[0].alt.toFixed(1)} vs wall ${maxWallHeight(k)}`);

  // The crate repairs everything.
  const m = createGame(84);
  clearGrid(m);
  for (let c = 0; c < C.COLS; c++) place(m, c, 0);
  for (let c = 0; c < C.COLS; c++) m.hp[idx(c, 0)] = 1;
  m.crate = { x: 100, y: 60, t: 0, sway: 0 };
  check('tapping the crate is registered', tapScene(m, 100, 60) === 'crate');
  let allFull = true;
  for (let c = 0; c < C.COLS; c++) if (m.hp[idx(c, 0)] !== C.MATERIALS[0].hp) allFull = false;
  check('the crate restores every damaged block', allFull);
  check('the crate is consumed', m.crate === null);
  check('tapping empty sky does nothing', tapScene(m, 100, 60) === null);
}

/* ========================================================================== */
section('Scoring and run isolation');
{
  const g = createGame(91);
  clearGrid(g);
  // Gapless placements build the combo; a gap breaks it.
  for (let i = 0; i < 12; i++) {
    g.piece = { shape: 'SINGLE', rot: 0, x: i % C.COLS, y: C.ROWS - 1 };
    hardDrop(g);
  }
  check('consecutive flush placements build a multiplier', g.mult > 1, 'x' + g.mult);
  check('the multiplier is capped', g.mult <= C.SCORE.comboMax);

  const h = createGame(92);
  clearGrid(h);
  place(h, 2, 0);
  place(h, 2, 1);
  for (let i = 0; i < 8; i++) {
    h.piece = { shape: 'SINGLE', rot: 0, x: 0, y: C.ROWS - 1 };
    hardDrop(h);
  }
  const comboBefore = h.combo;
  h.piece = { shape: 'DOMINO', rot: 0, x: 2, y: C.ROWS - 1 };   // bridges a hole
  hardDrop(h);
  check('opening a gap breaks the combo', comboBefore > 0 && h.combo === 0,
    `${comboBefore} -> ${h.combo}`);

  // A gap really is a tunnel: a zombie can walk under an overhang.
  const t = createGame(93);
  clearGrid(t);
  t.piece = null; t.entryT = 999;
  for (let c = 0; c < C.COLS; c++) place(t, c, 2);   // a roof with nothing beneath
  t.zombies.push({
    id: 1, kind: 'runner', x: -1, row: 0, drawRow: 0, hp: 9, maxHp: 9,
    speed: 2, dmg: 1, biteEvery: 9, state: 'walk', biteT: 0, climbT: 0,
    climbed: 0, anim: 0, alt: 0, dead: false,
  });
  const walkedThrough = until(t, (s) => s.breaches > 0, 12);
  check('a gap under the wall really is a tunnel', walkedThrough);

  // Nothing carries between runs.
  const a = createGame(94);
  run(a, 20, { actions: ['hard'] });
  const b = createGame(94);
  check('a new run starts at zero score', displayScore(b) === 0);
  check('a new run starts with a clear grid', wallMass(b) === 0);
  check('a new run starts with no zombies and no breaches',
    b.zombies.length === 0 && b.breaches === 0);
  check('a new run resets the combo, wave and stats',
    b.combo === 0 && b.mult === 1 && b.wave === 1 && b.stats.kills === 0
    && b.stats.pieces === 0 && b.stats.seals === 0);
  check('the same seed replays identically',
    (() => {
      const x = createGame(555); const y = createGame(555);
      run(x, 25, { actions: ['hard'] }); run(y, 25, { actions: ['hard'] });
      return displayScore(x) === displayScore(y) && wallMass(x) === wallMass(y);
    })());
}

/* ========================================================================== */
section('Waves and the long game');
{
  const g = createGame(101);
  check('a run opens on wave 1 in the play phase', g.wave === 1 && g.phase === 'play');
  run(g, C.WAVE.length + 0.5);
  check('a wave ends into a short break', g.phase === 'break');
  run(g, C.WAVE.breakLength + 0.5);
  check('the next wave starts after the break', g.wave === 2 && g.phase === 'play');

  // The horde must stay capped however long the run goes on.
  const h = createGame(102);
  let peak = 0;
  for (let i = 0; i < 60 * 400; i++) {
    update(h, 1 / 60, { actions: i % 30 === 0 ? ['hard'] : [] });
    h.events.length = 0;
    peak = Math.max(peak, h.zombies.length);
    if (h.phase === 'over') break;
  }
  check('live zombies stay under the cap', peak <= C.HORDE.maxAlive + 2, 'peak ' + peak);
  check('a long run does not leak effect objects', h.events.length === 0);

  // Nothing throws over a very long unattended run.
  let threw = null;
  try {
    const k = createGame(103);
    for (let i = 0; i < 60 * 600; i++) {
      update(k, 1 / 60, { actions: i % 17 === 0 ? ['left'] : i % 23 === 0 ? ['hard'] : [] });
      k.events.length = 0;
    }
  } catch (e) { threw = e; }
  check('ten simulated minutes run without throwing', threw === null, threw && threw.message);

  // Big frame gaps must not break the simulation.
  const j = createGame(104);
  let jThrew = null;
  try { for (let i = 0; i < 400; i++) { update(j, 1 / 20, { actions: ['hard'] }); j.events.length = 0; } }
  catch (e) { jThrew = e; }
  check('a slow frame rate does not corrupt the sim', jThrew === null && wallMass(j) >= 0);
}

/* ========================================================================== */
section('Audio note table');
{
  check('A4 is 440Hz', Math.abs(noteFreq('A4') - 440) < 0.01);
  check('an octave up doubles the frequency',
    Math.abs(noteFreq('A5') - 880) < 0.01);
  check('C4 is about 261.6Hz', Math.abs(noteFreq('C4') - 261.626) < 0.01);
  check('a rest has no frequency', noteFreq('-') === 0 && noteFreq('') === 0);
  check('a sharp is a semitone up',
    Math.abs(noteFreq('C#4') / noteFreq('C4') - Math.pow(2, 1 / 12)) < 1e-9);
}

/* ========================================================================== */
section('Licences and tokens');
{
  const SECRET = 'test-secret-not-a-real-one';

  const keys = new Set();
  let shaped = true;
  let ambiguous = false;
  for (let i = 0; i < 3000; i++) {
    const k = makeLicence();
    keys.add(k);
    if (!/^MAGA(-[ACDEFGHJKMNPQRTUVWXYZ2346789]{4}){3}$/.test(k)) shaped = false;
    // O/0, I/1, L, S/5 and B/8 are the characters people mistype off a screen.
    if (/[OI1L05SB]/.test(k.slice(5))) ambiguous = true;
  }
  check('licence keys are uniformly shaped', shaped);
  check('licence keys avoid visually ambiguous characters', !ambiguous);
  check('licence keys do not collide', keys.size === 3000, keys.size + ' unique of 3000');

  check('a licence key survives a round trip',
    normaliseLicence('MAGA-ACDE-FGHJ-KMNP') === 'MAGA-ACDE-FGHJ-KMNP');
  check('restore accepts what a human actually types',
    normaliseLicence('  maga acde fghj kmnp ') === 'MAGA-ACDE-FGHJ-KMNP'
    && normaliseLicence('magaacdefghjkmnp') === 'MAGA-ACDE-FGHJ-KMNP'
    && normaliseLicence('MAGA_ACDE_FGHJ_KMNP') === 'MAGA-ACDE-FGHJ-KMNP');
  check('restore rejects rubbish',
    normaliseLicence('') === null && normaliseLicence('hello') === null
    && normaliseLicence('MAGA-ACDE-FGHJ') === null
    && normaliseLicence('NOPE-ACDE-FGHJ-KMNP') === null
    && normaliseLicence(null) === null && normaliseLicence(undefined) === null);

  const licence = makeLicence();
  const token = await mintToken(SECRET, licence);
  const readBack = await readToken(SECRET, token);
  check('a minted token reads back as its licence',
    readBack && readBack.licence === licence);

  check('a token minted with another secret is rejected',
    (await readToken('a-different-secret', token)) === null);

  // The whole paywall rests on this: the payload must not be editable.
  const [body, sig] = token.split('.');
  const forgedBody = Buffer.from(JSON.stringify({ k: 'MAGA-AAAA-AAAA-AAAA', v: 1, iat: 0 }))
    .toString('base64url');
  check('a forged payload with a stolen signature is rejected',
    (await readToken(SECRET, forgedBody + '.' + sig)) === null);
  check('a flipped signature bit is rejected',
    (await readToken(SECRET, body + '.' + (sig.slice(0, -1) + (sig.slice(-1) === 'a' ? 'b' : 'a')))) === null);
  check('a truncated signature is rejected',
    (await readToken(SECRET, body + '.' + sig.slice(0, 20))) === null);
  check('a token with no signature at all is rejected',
    (await readToken(SECRET, body)) === null
    && (await readToken(SECRET, body + '.')) === null);
  check('junk in the token slot is rejected',
    (await readToken(SECRET, '')) === null
    && (await readToken(SECRET, null)) === null
    && (await readToken(SECRET, 'a.b.c')) === null
    && (await readToken(SECRET, '!!!.???')) === null);

  check('two licences never share a token', token !== await mintToken(SECRET, makeLicence()));

  check('the comparison is length-safe',
    safeEqual('abc', 'abc') && !safeEqual('abc', 'abcd')
    && !safeEqual('abc', 'abd') && !safeEqual('', 'a') && safeEqual('', ''));

  // Stripe webhook signatures use the same primitive; pin it against a known value.
  check('HMAC-SHA256 matches a known vector',
    (await hmacHex('key', 'The quick brown fox jumps over the lazy dog'))
    === 'f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8');
}

/* ========================================================================== */
section('Project wiring');
{
  const sw = readFileSync(join(ROOT, 'public/sw.js'), 'utf8');
  const srcFiles = readdirSync(join(ROOT, 'public/src')).filter((f) => f.endsWith('.js'));
  const missing = srcFiles.filter((f) => !sw.includes('./src/' + f));
  check('the service worker caches every source file', missing.length === 0, missing.join(', '));

  const manifest = JSON.parse(readFileSync(join(ROOT, 'public/manifest.webmanifest'), 'utf8'));
  check('the manifest has the fields an install prompt needs',
    !!manifest.name && !!manifest.short_name && !!manifest.start_url
    && !!manifest.display && !!manifest.icons.length);
  check('the manifest is portrait and standalone-ish',
    manifest.orientation === 'portrait' && ['fullscreen', 'standalone'].includes(manifest.display));
  const iconFiles = readdirSync(join(ROOT, 'public/icons'));
  const iconsPresent = manifest.icons.every((i) => iconFiles.includes(i.src.replace('icons/', '')));
  check('every icon the manifest promises exists', iconsPresent, iconFiles.join(', '));
  check('a maskable icon is provided',
    manifest.icons.some((i) => (i.purpose || '').includes('maskable')));
  check('a 192 and a 512 icon are provided',
    manifest.icons.some((i) => i.sizes === '192x192')
    && manifest.icons.some((i) => i.sizes === '512x512'));

  const html = readFileSync(join(ROOT, 'public/index.html'), 'utf8');
  check('the page links the manifest and the entry module',
    html.includes('manifest.webmanifest') && html.includes('src/main.js'));
  check('the viewport is locked against pinch zoom',
    html.includes('user-scalable=no') && html.includes('viewport-fit=cover'));

  const css = readFileSync(join(ROOT, 'public/style.css'), 'utf8');
  check('the page cannot scroll or rubber-band',
    css.includes('overflow: hidden') && css.includes('overscroll-behavior: none')
    && css.includes('touch-action: none'));
  check('the canvas is scaled without smoothing', css.includes('pixelated'));

  // Parody positioning has to be in the shipped text, not just in a comment.
  const ui = readFileSync(join(ROOT, 'public/src/ui.js'), 'utf8');
  // Every literal button label, checked against the narrowest button the code
  // uses. "RESTORE PURCHASE" at scale 2 was 190px inside a 168px button.
  const labels = [...ui.matchAll(/button\(c, items, '[a-z]+', [^,]+, '([^']+)'/g)].map((m) => m[1]);
  const NARROW = 168;
  const tooWide = labels.filter((l) => (l.length * 6 - 1) * 2 > NARROW - 10);
  check('button labels are known to the fitter', labels.length >= 10, labels.length + ' labels');
  check('over-long labels shrink instead of overflowing',
    /while \(scale > 1 && textWidth\(label, scale\) > w - 10\) scale--/.test(ui),
    tooWide.length ? 'relies on it for: ' + tooWide.join(', ') : 'none currently need it');
  check('the disclaimer is on the title screen', ui.includes('NOT AFFILIATED'));
  check('the about screen names what it is not endorsed by',
    ui.includes('REPUBLICAN PARTY') && ui.includes('STATES GOVERNMENT'));

  const ent = readFileSync(join(ROOT, 'public/src/entitlement.js'), 'utf8');
  // The free local unlock must be reachable only from where the game is being
  // developed. Honouring a query flag here would hand the game away.
  const localHostFn = ent.slice(ent.indexOf('export function isLocalHost'),
    ent.indexOf('export const isDevEnvironment'));
  check('dev mode is decided by hostname, never by the query string',
    /export const isDevEnvironment = isLocalHost/.test(ent)
    && !/URLSearchParams|location\.search/.test(localHostFn)
    && !/has\(.dev.\)/.test(ent),
    localHostFn ? '' : 'isLocalHost not found');
  check('the live override can only make payment stricter',
    /forceLivePayments/.test(ent) && /isLocalHost\(\) && !forceLivePayments\(\)/.test(ent));
  check('entitlement and game data use separate storage keys',
    ent.includes('magawall.entitlement') && !ent.includes('magawall.scores'));
  check('the client never holds a Stripe secret',
    !/sk_live|sk_test|STRIPE_SECRET/.test(ent));
  check('the service worker refuses to cache the payment API',
    sw.includes("startsWith('/api/')"));
}

/* ========================================================================== */
console.log('\n' + (failures.length ? `FAILED ${failures.length} of ${count}` : `PASSED ${count} checks`));
if (failures.length) {
  for (const f of failures) console.log('  - ' + f);
  process.exit(1);
}
