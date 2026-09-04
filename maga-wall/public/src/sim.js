/* The game simulation.
 *
 * Pure logic: no canvas, no DOM, no audio, no timers. update() advances the
 * world by dt and pushes events onto g.events, which the renderer and the
 * audio layer drain. That split is what lets test/run.js play thousands of
 * simulated seconds under node.
 *
 * THE LOOP, in one paragraph. Pieces fall into a 7x11 grid; the grid is the
 * wall, seen side-on. Zombies walk in from the left and chew through it at
 * whatever height they are standing. When a block dies the column above it
 * settles down, so damage always eats the wall's mass rather than punching
 * neat holes. Completing a horizontal course promotes every block in it one
 * material tier, which is the armour mechanic. Building to the ceiling is a
 * penalty, not a death: a tower is bad wall. You lose when three zombies get
 * past the right-hand face and reach the rally.
 */

import {
  COLS, ROWS, MATERIALS, MAX_TIER, PIECE, SCORE, WAVE, ZOMBIES, BALLOON,
  EAGLE, CRATE, BREACH_LIMIT, HORDE, VW, HUD_H, GROUND_Y, GRID_Y,
  fallInterval, spawnInterval, zombieSpeedMul, zombieHpMul, zombieDmgMul,
  biteMul, scrumSize, spawnWeights,
  OVERBUILD_PENALTY, worldX, rowY,
} from './config.js';
import { makeRng } from './rng.js';
import { SHAPES, makeDealer } from './pieces.js';

export const EMPTY = -1;

/** Where the eagle sits when it is ready. Sim needs it for the tap box. */
/** On the finial of the flagpole the renderer draws at x=186. */
export const PERCH = { x: 187, y: 52 };

export const idx = (c, r) => r * COLS + c;
export const inGrid = (c, r) => c >= 0 && c < COLS && r >= 0 && r < ROWS;

/* -------------------------------------------------------------------------- */
/* Construction                                                               */
/* -------------------------------------------------------------------------- */

export function createGame(seed = (Date.now() & 0x7fffffff)) {
  const rng = makeRng(seed);
  const g = {
    seed,
    rng,
    dealer: makeDealer(rng),

    time: 0,
    phase: 'play',            // 'play' | 'break' | 'over'
    wave: 1,
    waveT: 0,
    breakT: 0,

    tier: new Int8Array(COLS * ROWS).fill(EMPTY),
    hp: new Float32Array(COLS * ROWS),
    hurt: new Float32Array(COLS * ROWS),
    destroyedAt: new Float32Array(COLS * ROWS).fill(-999),
    rowComplete: new Array(ROWS).fill(false),

    piece: null,
    nextShape: null,
    fallAcc: 0,
    lockT: 0,
    lockResets: 0,
    entryT: 0,

    zombies: [],
    nextZid: 1,
    spawnT: 1.2,
    balloonT: 0,

    eagle: { state: 'perched', t: 0, cd: EAGLE.firstReadyAt, x: PERCH.x, y: PERCH.y, fx: 0, fy: 0, tx: 0, ty: 0, carried: null, flip: false },
    crate: null,
    crateT: 0,

    score: 0,
    combo: 0,
    mult: 1,
    breaches: 0,

    stats: { kills: 0, seals: 0, pieces: 0, eagle: 0, best: 0 },

    shake: 0,
    flash: 0,
    events: [],
  };

  g.nextShape = g.dealer.next(1);
  g.balloonT = rng.range(BALLOON.every[0], BALLOON.every[1]);
  g.crateT = rng.range(CRATE.every[0], CRATE.every[1]);
  spawnPiece(g);
  return g;
}

const emit = (g, t, data) => { g.events.push(data ? { t, ...data } : { t }); };

const popup = (g, x, y, text, colour) => emit(g, 'popup', { x, y, text, colour });

/* -------------------------------------------------------------------------- */
/* Grid helpers                                                               */
/* -------------------------------------------------------------------------- */

export const solid = (g, c, r) => inGrid(c, r) && g.tier[idx(c, r)] !== EMPTY;

/** Height of a column = 1 + the highest solid row, 0 if empty. */
export function columnHeight(g, c) {
  for (let r = ROWS - 1; r >= 0; r--) if (g.tier[idx(c, r)] !== EMPTY) return r + 1;
  return 0;
}

export function wallMass(g) {
  let n = 0;
  for (let i = 0; i < g.tier.length; i++) if (g.tier[i] !== EMPTY) n++;
  return n;
}

export function maxWallHeight(g) {
  let h = 0;
  for (let c = 0; c < COLS; c++) h = Math.max(h, columnHeight(g, c));
  return h;
}

function setCell(g, c, r, tier) {
  const i = idx(c, r);
  g.tier[i] = tier;
  g.hp[i] = MATERIALS[tier].hp;
}

/* -------------------------------------------------------------------------- */
/* Pieces                                                                     */
/* -------------------------------------------------------------------------- */

export function pieceState(p) { return SHAPES[p.shape].states[p.rot]; }

export function pieceCells(p) {
  const s = pieceState(p);
  return s.cells.map(([dx, dy]) => [p.x + dx, p.y + dy]);
}

function collides(g, shape, rot, x, y) {
  const s = SHAPES[shape].states[rot];
  for (const [dx, dy] of s.cells) {
    const c = x + dx;
    const r = y + dy;
    if (c < 0 || c >= COLS || r < 0) return true;
    if (r >= ROWS) continue;              // above the field is open air
    if (g.tier[idx(c, r)] !== EMPTY) return true;
  }
  return false;
}

function spawnPiece(g) {
  const shape = g.nextShape;
  g.nextShape = g.dealer.next(g.wave);
  const s = SHAPES[shape].states[0];
  const x = Math.floor((COLS - s.w) / 2);
  const y = ROWS - s.h;
  g.piece = { shape, rot: 0, x, y };
  g.fallAcc = 0;
  g.lockT = 0;
  g.lockResets = 0;

  // No room to appear at all: the top of the wall topples off so the game can
  // never wedge itself shut.
  if (collides(g, shape, 0, x, y)) {
    toppleTop(g);
    if (collides(g, shape, 0, x, y)) g.piece.y = ROWS - s.h;
  }
  emit(g, 'spawn');
}

/** A short beat between lock and the next piece: punctuation, and a ceiling
 * on how fast anyone can possibly build. */
function queueNextPiece(g) {
  g.piece = null;
  g.entryT = PIECE.entryDelay;
}

/**
 * The top course crumbles off anything built into the danger zone.
 *
 * This has to clear real height, not one block. If it only shaved full columns
 * the player who overbuilds ends up toppling every single piece forever with no
 * way back down, which reads as the game being broken rather than as a penalty.
 */
function toppleTop(g) {
  const DANGER = ROWS - 2;
  let any = false;
  for (let c = 0; c < COLS; c++) {
    const h = columnHeight(g, c);
    if (h > DANGER) {
      for (let r = h - 1; r >= DANGER; r--) destroyCell(g, c, r, 'topple');
      any = true;
    }
  }
  if (!any) {
    // Nothing was over the line; shave the tallest column so there is always
    // at least one block of progress.
    let best = 0;
    for (let c = 1; c < COLS; c++) if (columnHeight(g, c) > columnHeight(g, best)) best = c;
    const h = columnHeight(g, best);
    if (h > 0) destroyCell(g, best, h - 1, 'topple');
  }
}

export function tryMove(g, dx, dy) {
  const p = g.piece;
  if (!p) return false;
  if (collides(g, p.shape, p.rot, p.x + dx, p.y + dy)) return false;
  p.x += dx;
  p.y += dy;
  if (dx !== 0 && g.lockResets < PIECE.lockResets) { g.lockT = 0; g.lockResets++; }
  return true;
}

export function tryRotate(g, dir = 1) {
  const p = g.piece;
  if (!p) return false;
  const shape = SHAPES[p.shape];
  if (shape.states.length === 1) return false;
  const from = shape.states[p.rot];
  const rot = (p.rot + dir + shape.states.length) % shape.states.length;
  const to = shape.states[rot];
  // Keep the bounding-box centre roughly still, then try the kick list.
  const bx = p.x + Math.round((from.w - to.w) / 2);
  const by = p.y + Math.round((from.h - to.h) / 2);
  for (const [kx, ky] of PIECE.kicks) {
    if (!collides(g, p.shape, rot, bx + kx, by + ky)) {
      p.rot = rot;
      p.x = bx + kx;
      p.y = by + ky;
      if (g.lockResets < PIECE.lockResets) { g.lockT = 0; g.lockResets++; }
      emit(g, 'rotate');
      return true;
    }
  }
  return false;
}

export function ghostY(g) {
  const p = g.piece;
  if (!p) return 0;
  let y = p.y;
  while (!collides(g, p.shape, p.rot, p.x, y - 1)) y--;
  return y;
}

export function hardDrop(g) {
  const p = g.piece;
  if (!p) return;
  const target = ghostY(g);
  const rows = p.y - target;
  p.y = target;
  if (rows > 0) g.score += rows * SCORE.hardDropPerRow;
  emit(g, 'harddrop', { rows });
  lockPiece(g);
}

function lockPiece(g) {
  const p = g.piece;
  const cells = pieceCells(p);
  g.piece = null;
  g.stats.pieces++;

  // Overbuilding is a penalty, not a loss. The tower topples and you keep
  // playing, poorer and without your combo.
  const tooTall = cells.some(([, r]) => r >= ROWS - 1);
  if (tooTall) {
    g.score = Math.max(0, g.score - OVERBUILD_PENALTY);
    g.combo = 0;
    g.mult = 1;
    g.shake = Math.max(g.shake, 4);
    toppleTop(g);
    popup(g, worldX(COLS / 2), GRID_Y + 20, 'TOO TALL!', '#ff4d4d');
    emit(g, 'topple');
    sealScan(g, null);
    queueNextPiece(g);
    return;
  }

  let repaired = 0;
  for (const [c, r] of cells) {
    if (g.time - g.destroyedAt[idx(c, r)] <= SCORE.repairWindow) repaired++;
    setCell(g, c, r, 0);
  }

  // Anything standing where the masonry landed is now part of the masonry.
  for (const z of g.zombies) {
    if (z.dead || z.kind === 'balloon' || z.state === 'grabbed') continue;
    const zc = Math.floor(z.x + 0.5);
    if (cells.some(([c, r]) => c === zc && r === z.row)) killZombie(g, z, 'squish');
  }

  // Placement quality: an unsupported cell is a gap, and gaps break the combo.
  let gaps = 0;
  for (const [c, r] of cells) {
    if (r > 0 && g.tier[idx(c, r - 1)] === EMPTY) gaps++;
  }

  if (gaps === 0) {
    g.combo++;
    g.mult = Math.min(SCORE.comboMax, 1 + Math.floor(g.combo / SCORE.comboPerStep));
    const pts = SCORE.placeSolid * g.mult;
    g.score += pts;
    if (g.combo >= SCORE.comboPerStep) {
      popup(g, worldX(cells[0][0] + 0.5), rowY(cells[0][1]) - 4, 'SOLID x' + g.mult, '#6ee06e');
    }
    emit(g, 'lock', { solid: true, combo: g.combo });
  } else {
    g.combo = 0;
    g.mult = 1;
    g.score += Math.max(0, SCORE.placeGappy - SCORE.gapPenaltyEach * gaps);
    emit(g, 'lock', { solid: false, gaps });
  }

  if (repaired > 0) {
    g.score += SCORE.repairCell * repaired;
    popup(g, worldX(cells[0][0] + 0.5), rowY(cells[0][1]) - 12, 'REPAIR +' + SCORE.repairCell * repaired, '#ffd45c');
    emit(g, 'repair', { cells: repaired });
  }

  sealScan(g, new Set(cells.map(([, r]) => r)));
  queueNextPiece(g);
}

/* -------------------------------------------------------------------------- */
/* Sealing a course                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Update the "this course is closed" latch for every row, and pay out for the
 * ones the player just closed.
 *
 * The award is gated on rows the locking piece actually contributed to. Without
 * that gate the wall settling after a bite re-completes the bottom course for
 * free, and the zombies end up paying the player to be eaten.
 *
 * @param {Set<number>|null} awardRows rows the player just built into
 */
function sealScan(g, awardRows = null) {
  for (let r = 0; r < ROWS; r++) {
    let complete = true;
    for (let c = 0; c < COLS; c++) {
      if (g.tier[idx(c, r)] === EMPTY) { complete = false; break; }
    }
    if (!complete) { g.rowComplete[r] = false; continue; }
    const wasComplete = g.rowComplete[r];
    g.rowComplete[r] = true;
    if (!wasComplete && awardRows && awardRows.has(r)) sealRow(g, r);
  }
}

function sealRow(g, r) {
  let minTier = MAX_TIER;
  for (let c = 0; c < COLS; c++) minTier = Math.min(minTier, g.tier[idx(c, r)]);
  const target = Math.min(MAX_TIER, minTier + 1);
  const promoted = target > minTier;
  for (let c = 0; c < COLS; c++) {
    const i = idx(c, r);
    const was = g.tier[i];
    g.tier[i] = Math.max(was, target);
    // Promotion re-casts the block, so it comes back at full health. Closing a
    // course that is already maxed out is applause, not a free repair.
    if (promoted && g.tier[i] > was) g.hp[i] = MATERIALS[g.tier[i]].hp;
  }
  const pts = Math.round(SCORE.sealBase * (target + 1) * g.mult * (promoted ? 1 : 0.5));
  g.score += pts;
  g.stats.seals++;
  g.shake = Math.max(g.shake, 2.5);
  g.flash = Math.max(g.flash, 0.18);
  popup(g, worldX(COLS / 2), rowY(r) - 2, MATERIALS[target].name + ' +' + pts, '#ffd45c');
  emit(g, 'seal', { row: r, tier: target, promoted });
}

/* -------------------------------------------------------------------------- */
/* Damage, destruction and settling                                           */
/* -------------------------------------------------------------------------- */

export function damageCell(g, c, r, amount) {
  if (!solid(g, c, r)) return false;
  const i = idx(c, r);
  g.hp[i] -= amount;
  g.hurt[i] = 0.22;
  if (g.hp[i] <= 0) { destroyCell(g, c, r, 'eaten'); return true; }
  emit(g, 'chew', { c, r });
  return false;
}

function destroyCell(g, c, r, cause) {
  const i = idx(c, r);
  const tier = g.tier[i];
  g.tier[i] = EMPTY;
  g.hp[i] = 0;
  g.hurt[i] = 0;
  g.destroyedAt[i] = g.time;
  g.shake = Math.max(g.shake, cause === 'topple' ? 3 : 2);
  emit(g, 'break', { c, r, tier, cause });
  settleColumn(g, c);
  sealScan(g, null);
}

/** Compact a column downwards. Blocks do not float, and neither does the wall. */
function settleColumn(g, c) {
  let write = 0;
  let moved = false;
  for (let r = 0; r < ROWS; r++) {
    const i = idx(c, r);
    if (g.tier[i] === EMPTY) continue;
    if (r !== write) {
      const w = idx(c, write);
      g.tier[w] = g.tier[i];
      g.hp[w] = g.hp[i];
      g.hurt[w] = g.hurt[i];
      g.tier[i] = EMPTY;
      g.hp[i] = 0;
      g.hurt[i] = 0;
      moved = true;
    }
    write++;
  }
  if (!moved) return;
  emit(g, 'settle', { c });
  // Anything standing in this column that a block just fell into is flattened.
  for (const z of g.zombies) {
    if (z.dead || z.kind === 'balloon' || z.state === 'grabbed') continue;
    if (Math.floor(z.x + 0.5) === c && solid(g, c, z.row)) killZombie(g, z, 'crush');
  }
}

/* -------------------------------------------------------------------------- */
/* Zombies                                                                    */
/* -------------------------------------------------------------------------- */

/** How far ahead of its left edge a zombie can reach, in cells. */
const REACH = 0.95;
/**
 * A blocked zombie snaps to exactly (targetColumn - REACH), which puts its nose
 * precisely on that column's left edge. Math.floor of the resulting hair-below-
 * zero value lands one column short, so "am I touching the wall?" answers no and
 * a climber clinging to the face drops off it. Nudge every position-to-column
 * conversion off the boundary.
 */
const EPS = 1e-4;

/**
 * The first standing block ahead of a zombie in its row, or -1.
 * Scanning rather than indexing one cell is what makes this robust: a zombie
 * that has snapped flush sits a fraction of a cell short of the boundary, and
 * any single-cell lookup there is a coin toss.
 */
function faceColumn(g, x, row) {
  const nose = x + REACH;
  for (let c = Math.max(0, Math.floor(nose + EPS)); c < COLS; c++) {
    if (solid(g, c, row)) return c;
  }
  return -1;
}

/** Is there wall close enough in front to hold on to, or to bite? */
function wallWithinReach(g, x, row) {
  const c = faceColumn(g, x, row);
  return c >= 0 && c - (x + REACH) <= HORDE.biteReach;
}

function spawnZombie(g, kind) {
  const def = ZOMBIES[kind];
  const hp = kind === 'balloon' ? 1 : Math.max(1, Math.round(def.hp * zombieHpMul(g.wave)));
  const z = {
    id: g.nextZid++,
    kind,
    x: -3.1 - g.rng() * 0.7,
    row: 0,
    drawRow: 0,
    hp,
    maxHp: hp,
    speed: def.speed * zombieSpeedMul(g.wave) * g.rng.range(0.9, 1.1),
    dmg: def.dmg * zombieDmgMul(g.wave),
    biteEvery: def.bite * biteMul(g.wave),
    state: 'walk',
    biteT: g.rng() * 0.3,
    climbT: 0,
    climbed: 0,
    anim: g.rng() * 6,
    alt: 0,
    dead: false,
  };
  if (kind === 'balloon') { z.alt = maxWallHeight(g) + 2.5; z.row = 0; }
  else {
    // Fall in behind the back of the queue rather than inside it.
    for (const o of g.zombies) {
      if (o.dead || o.kind === 'balloon' || o.row !== 0) continue;
      z.x = Math.min(z.x, o.x - HORDE.separation);
    }
  }
  g.zombies.push(z);
  emit(g, 'zspawn', { kind });
  return z;
}

export function killZombie(g, z, how) {
  if (z.dead) return;
  z.dead = true;
  const def = ZOMBIES[z.kind];
  const base = def.score;
  const bonus = how === 'squish' || how === 'crush' ? SCORE.squish : 0;
  const pts = Math.round((base + bonus) * g.mult);
  g.score += pts;
  g.stats.kills++;
  const px = worldX(z.x + 0.5);
  const py = z.kind === 'balloon' ? balloonY(z) : rowY(z.row) + 8;
  popup(g, px, py - 10, '+' + pts, how === 'eagle' ? '#ffd45c' : '#ff9c9c');
  emit(g, 'kill', { how, kind: z.kind, x: px, y: py });
  if (how === 'squish' || how === 'crush') g.shake = Math.max(g.shake, 3);
}

export const balloonY = (z) => rowY(Math.min(ROWS - 0.5, z.alt)) + 8;

function updateZombie(g, z, dt) {
  const def = ZOMBIES[z.kind];
  z.anim += dt;

  if (z.state === 'grabbed') return;

  if (z.kind === 'balloon') {
    z.alt = Math.min(ROWS + 0.5, Math.max(z.alt, maxWallHeight(g) + 2.2));
    z.x += z.speed * dt;
    if (z.x >= COLS + 0.4) breach(g, z);
    return;
  }

  // Gravity, with one exception: a climber with a wall block at face height is
  // clinging to it, not standing in mid-air. Without this a climber scaling the
  // outer face has nothing under its feet and falls back down every frame.
  const cc = Math.floor(z.x + 0.5);
  const clinging = def.climb > 0 && wallWithinReach(g, z.x, z.row);
  if (z.row > 0 && !solid(g, cc, z.row - 1) && !clinging) {
    z.row--;
    z.climbed = Math.max(0, z.climbed - 1);
    z.state = 'walk';
    return;
  }

  // Queue up behind whoever is in front, in this row only. This is what turns
  // the horde into a shoving line instead of twenty zombies in one pixel.
  let cap = Infinity;
  for (const o of g.zombies) {
    if (o === z || o.dead || o.kind === 'balloon' || o.state === 'grabbed') continue;
    if (o.row !== z.row || o.x <= z.x) continue;
    const limit = o.x - HORDE.separation;
    if (limit < cap) cap = limit;
  }
  const nx = Math.max(z.x, Math.min(z.x + z.speed * dt, cap));

  // The first standing block in this row at or ahead of the zombie's nose.
  const nose = nx + REACH;
  const tc = faceColumn(g, nx, z.row);

  if (tc >= 0 && tc <= nose + EPS) {
    // Flush against the wall: climb it, or eat it.
    z.x = Math.min(z.x, tc - REACH);
    const canClimb = def.climb > 0 && z.climbed < def.climb
      && z.row + 1 < ROWS && !solid(g, Math.floor(z.x + 0.5), z.row + 1);
    if (canClimb) {
      z.state = 'climb';
      z.climbT += dt;
      if (z.climbT >= 0.5) { z.climbT = 0; z.row++; z.climbed++; z.state = 'walk'; }
      return;
    }
    bite(g, z, def, tc, dt);
    return;
  }

  z.x = nx;

  // Reaching over the front rank. Capped, so a hundred-strong queue still only
  // does the damage of a small scrum.
  if (tc >= 0 && tc - nose <= HORDE.biteReach && countBiters(g, tc, z.row) < scrumSize(g.wave)) {
    bite(g, z, def, tc, dt);
    return;
  }

  z.state = 'walk';
  z.biteT = Math.min(z.biteT, (z.biteEvery || def.bite) * 0.5);
  if (z.x >= COLS + 0.4) breach(g, z);
}

function countBiters(g, c, row) {
  let n = 0;
  for (const o of g.zombies) if (!o.dead && o.state === 'bite' && o.row === row && o.target === c) n++;
  return n;
}

function bite(g, z, def, tc, dt) {
  z.state = 'bite';
  z.target = tc;
  z.biteT += dt;
  if (z.biteT >= (z.biteEvery || def.bite)) {
    z.biteT = 0;
    const broke = damageCell(g, tc, z.row, z.dmg || def.dmg);
    emit(g, 'bite', { broke, x: worldX(tc), y: rowY(z.row) + 8 });
  }
}

function breach(g, z) {
  z.dead = true;
  g.breaches++;
  g.combo = 0;
  g.mult = 1;
  g.shake = Math.max(g.shake, 6);
  g.flash = Math.max(g.flash, 0.25);
  emit(g, 'breach', { left: BREACH_LIMIT - g.breaches, kind: z.kind });
  popup(g, worldX(COLS + 0.5), GROUND_Y - 26, 'BREACH!', '#ff4d4d');
  if (g.breaches >= BREACH_LIMIT) gameOver(g);
}

function gameOver(g) {
  if (g.phase === 'over') return;
  g.phase = 'over';
  g.piece = null;
  g.shake = 8;
  emit(g, 'gameover');
}

/* -------------------------------------------------------------------------- */
/* Eagle                                                                      */
/* -------------------------------------------------------------------------- */

export const eagleReady = (g) => g.eagle.state === 'perched' && g.eagle.cd <= 0 && g.phase !== 'over';

/** The zombie most worth removing: furthest along, brutes weighted up. */
function eagleTarget(g) {
  let best = null;
  let bestScore = -Infinity;
  for (const z of g.zombies) {
    if (z.dead || z.state === 'grabbed' || z.kind === 'balloon') continue;
    const s = z.x + (z.kind === 'brute' ? 0.9 : 0) + z.row * 0.15;
    if (s > bestScore) { bestScore = s; best = z; }
  }
  return best;
}

/** @returns {boolean} whether the eagle actually launched. */
export function launchEagle(g) {
  if (!eagleReady(g)) return false;
  const target = eagleTarget(g);
  if (!target) { emit(g, 'eagle_screech'); return false; }
  const e = g.eagle;
  e.state = 'swoop';
  e.t = 0;
  e.fx = PERCH.x;
  e.fy = PERCH.y;
  e.carried = target;
  target.state = 'grabbed';
  emit(g, 'eagle_launch');
  return true;
}

function updateEagle(g, dt) {
  const e = g.eagle;
  switch (e.state) {
    case 'perched':
      if (e.cd > 0) e.cd = Math.max(0, e.cd - dt);
      e.x = PERCH.x;
      e.y = PERCH.y + Math.sin(g.time * 2.4) * 1.2;
      e.flip = false;
      break;

    case 'swoop': {
      e.t += dt / EAGLE.swoopTime;
      const z = e.carried;
      const tx = z ? worldX(z.x + 0.5) : PERCH.x;
      const ty = z ? rowY(z.row) + 6 : PERCH.y;
      const k = Math.min(1, e.t);
      const ease = k * k;                          // accelerating dive
      e.x = e.fx + (tx - e.fx) * ease;
      e.y = e.fy + (ty - e.fy) * ease - Math.sin(k * Math.PI) * 10;
      e.flip = true;
      if (z && !z.dead) { z.x = (e.x - worldX(0)) / 16 - 0.5; }
      if (e.t >= 1) {
        e.state = 'carry';
        e.t = 0;
        g.score += SCORE.eagle;
        g.stats.eagle++;
        g.shake = Math.max(g.shake, 3);
        popup(g, e.x, e.y - 14, 'EAGLE! +' + SCORE.eagle, '#ffd45c');
        emit(g, 'eagle_grab');
        if (z) killZombie(g, z, 'eagle');
      }
      break;
    }

    case 'carry': {
      e.t += dt / EAGLE.carryTime;
      const k = Math.min(1, e.t);
      e.x += (140 * dt);
      e.y -= (90 * dt);
      e.flip = false;
      if (e.carried) { e.carried.x = (e.x - worldX(0)) / 16 - 0.5; }
      if (k >= 1 || e.y < -30) {
        if (e.carried) { const i = g.zombies.indexOf(e.carried); if (i >= 0) g.zombies.splice(i, 1); }
        e.carried = null;
        e.state = 'gone';
        e.cd = EAGLE.cooldown;
      }
      break;
    }

    case 'gone':
      e.cd -= dt;
      e.x = -50;
      e.y = -50;
      if (e.cd <= EAGLE.returnTime) { e.state = 'return'; e.t = 0; }
      break;

    case 'return': {
      e.t += dt / EAGLE.returnTime;
      const k = Math.min(1, e.t);
      e.x = -20 + (PERCH.x + 20) * k;
      e.y = HUD_H + 4 + Math.sin(k * Math.PI) * -6 + (PERCH.y - HUD_H - 4) * k;
      e.flip = false;
      if (k >= 1) { e.state = 'perched'; e.cd = 0; emit(g, 'eagle_ready'); }
      break;
    }
    default: break;
  }
}

/* -------------------------------------------------------------------------- */
/* Supply crate                                                               */
/* -------------------------------------------------------------------------- */

function updateCrate(g, dt) {
  if (g.crate) {
    const c = g.crate;
    c.t += dt;
    c.y = HUD_H + 6 + (GROUND_Y - 14 - (HUD_H + 6)) * (c.t / CRATE.fallTime);
    c.sway = Math.sin(c.t * 1.8) * 5;
    if (c.t >= CRATE.fallTime) { g.crate = null; emit(g, 'crate_miss'); }
    return;
  }
  if (g.wave < CRATE.fromWave || g.phase === 'over') return;
  g.crateT -= dt;
  if (g.crateT <= 0) {
    g.crateT = g.rng.range(CRATE.every[0], CRATE.every[1]);
    g.crate = { x: worldX(g.rng.range(0.5, COLS - 0.5)), y: HUD_H + 6, t: 0, sway: 0 };
    emit(g, 'crate_drop');
  }
}

/** Full repair of every standing block. The one big "get out of jail" button. */
export function takeCrate(g) {
  if (!g.crate) return false;
  const { x, y } = g.crate;
  g.crate = null;
  let healed = 0;
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      const i = idx(c, r);
      if (g.tier[i] === EMPTY) continue;
      if (g.hp[i] < MATERIALS[g.tier[i]].hp) healed++;
      g.hp[i] = MATERIALS[g.tier[i]].hp;
    }
  }
  g.score += SCORE.crate;
  g.flash = Math.max(g.flash, 0.2);
  popup(g, x, y - 12, 'REBUILT! +' + SCORE.crate, '#6ee06e');
  emit(g, 'crate_take', { healed });
  return true;
}

/* -------------------------------------------------------------------------- */
/* Tap routing                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Everything tappable inside the scene, in one place, so input.js does not
 * need to know what an eagle is. Returns the kind of thing that was hit.
 * @returns {'eagle'|'balloon'|'crate'|null}
 */
export function tapScene(g, x, y) {
  if (g.phase === 'over') return null;

  if (g.crate) {
    const c = g.crate;
    if (Math.abs(x - (c.x + c.sway)) <= CRATE.tapPad && Math.abs(y - c.y) <= CRATE.tapPad) {
      takeCrate(g);
      return 'crate';
    }
  }

  for (const z of g.zombies) {
    if (z.dead || z.kind !== 'balloon') continue;
    const bx = worldX(z.x + 0.5);
    const by = balloonY(z);
    if (Math.abs(x - bx) <= 12 && y >= by - 26 && y <= by + 10) {
      killZombie(g, z, 'pop');
      emit(g, 'balloon_pop', { x: bx, y: by });
      g.shake = Math.max(g.shake, 2);
      return 'balloon';
    }
  }

  if (eagleReady(g)) {
    const e = g.eagle;
    if (Math.abs(x - e.x) <= EAGLE.tapPad && Math.abs(y - e.y) <= EAGLE.tapPad) {
      return launchEagle(g) ? 'eagle' : null;
    }
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* Main update                                                                */
/* -------------------------------------------------------------------------- */

/**
 * @param {object} g
 * @param {number} dt seconds, already clamped by the caller
 * @param {{actions?: string[], soft?: boolean}} input
 */
export function update(g, dt, input = {}) {
  g.time += dt;
  g.shake = Math.max(0, g.shake - dt * 14);
  g.flash = Math.max(0, g.flash - dt);
  for (let i = 0; i < g.hurt.length; i++) if (g.hurt[i] > 0) g.hurt[i] = Math.max(0, g.hurt[i] - dt);

  if (g.phase === 'over') {
    for (const z of g.zombies) z.anim += dt;
    return;
  }

  g.score += SCORE.survivePerSec * dt;

  /* --- waves --- */
  if (g.phase === 'play') {
    g.waveT += dt;
    if (g.waveT >= WAVE.length) {
      g.phase = 'break';
      g.breakT = WAVE.breakLength;
      g.score += SCORE.waveClear * g.wave;
      g.stats.best = Math.max(g.stats.best, g.wave);
      popup(g, VW / 2, GRID_Y + 40, 'WAVE ' + g.wave + ' HELD', '#6ee06e');
      emit(g, 'wave_clear', { wave: g.wave });
    }
  } else if (g.phase === 'break') {
    g.breakT -= dt;
    if (g.breakT <= 0) {
      g.wave++;
      g.waveT = 0;
      g.phase = 'play';
      emit(g, 'wave_start', { wave: g.wave });
    }
  }

  /* --- player actions --- */
  const actions = input.actions || [];
  for (const a of actions) {
    if (!g.piece) break;
    if (a === 'left') { if (tryMove(g, -1, 0)) emit(g, 'move'); }
    else if (a === 'right') { if (tryMove(g, 1, 0)) emit(g, 'move'); }
    else if (a === 'rotate') tryRotate(g, 1);
    else if (a === 'rotateCCW') tryRotate(g, -1);
    else if (a === 'hard') hardDrop(g);
  }

  /* --- falling --- */
  if (!g.piece && g.entryT > 0) {
    g.entryT -= dt;
    if (g.entryT <= 0) spawnPiece(g);
  }
  if (g.piece) {
    const interval = fallInterval(g.wave);
    const rate = input.soft ? PIECE.softDropMul : 1;
    g.fallAcc += dt * rate;
    let guard = 0;
    while (g.fallAcc >= interval && g.piece && guard++ < 32) {
      g.fallAcc -= interval;
      if (!tryMove(g, 0, -1)) { g.fallAcc = 0; break; }
    }
    if (g.piece) {
      const resting = collides(g, g.piece.shape, g.piece.rot, g.piece.x, g.piece.y - 1);
      if (resting) {
        g.lockT += dt;
        if (g.lockT >= PIECE.lockDelay) lockPiece(g);
      } else {
        g.lockT = 0;
      }
    }
  }

  /* --- zombies --- */
  if (g.phase === 'play') {
    g.spawnT -= dt;
    if (g.spawnT <= 0) {
      const grace = (g.wave === 1 && g.time < WAVE.openingGrace) ? 1.9 : 1;
      g.spawnT = spawnInterval(g.wave) * g.rng.range(0.78, 1.28) * grace;
      const alive = g.zombies.reduce((n, z) => n + (z.dead ? 0 : 1), 0);
      if (alive < HORDE.maxAlive) spawnZombie(g, g.rng.weighted(spawnWeights(g.wave)));
    }
    if (g.wave >= BALLOON.fromWave) {
      g.balloonT -= dt;
      if (g.balloonT <= 0) {
        g.balloonT = g.rng.range(BALLOON.every[0], BALLOON.every[1]);
        const alive = g.zombies.filter((z) => z.kind === 'balloon' && !z.dead).length;
        if (alive < BALLOON.maxAlive) spawnZombie(g, 'balloon');
      }
    }
  }

  for (const z of g.zombies) {
    if (z.dead) continue;
    updateZombie(g, z, dt);
    z.drawRow += (z.row - z.drawRow) * Math.min(1, dt * 14);
  }
  if (g.zombies.some((z) => z.dead)) {
    g.zombies = g.zombies.filter((z) => !z.dead || z === g.eagle.carried);
  }

  updateEagle(g, dt);
  updateCrate(g, dt);
}

/* -------------------------------------------------------------------------- */
/* Readouts for the HUD and the renderer                                      */
/* -------------------------------------------------------------------------- */

export const displayScore = (g) => Math.floor(g.score);

/** 0..1 how healthy the standing wall is; drives the crowd's mood. */
export function wallIntegrity(g) {
  let hp = 0;
  let max = 0;
  for (let i = 0; i < g.tier.length; i++) {
    if (g.tier[i] === EMPTY) continue;
    hp += g.hp[i];
    max += MATERIALS[g.tier[i]].hp;
  }
  if (!max) return 0;
  return hp / max;
}

/** How worried the rally should look, 0 calm .. 1 panicking. */
export function rallyPanic(g) {
  let worst = 0;
  for (const z of g.zombies) {
    if (z.dead) continue;
    worst = Math.max(worst, (z.x + 3) / (COLS + 3));
  }
  const breachPart = g.breaches / BREACH_LIMIT;
  return Math.min(1, Math.max(worst * 0.8, breachPart));
}
