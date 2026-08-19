/* Standing Start — pseudo-3D renderer.
 *
 * The simulation runs in flat world space. This file is the only place that
 * knows the world is drawn in perspective: it transforms world points into
 * camera space, clips them against the near plane, and projects them onto the
 * canvas. Nothing here feeds back into the driving.
 *
 * Everything is primitive geometry on purpose. Placeholder art is the point of
 * Phase 1 — the question is whether the driving is fun, not whether it is
 * pretty.
 */

import { wrapIndex, forwardX, forwardZ, rightX, rightZ } from './track.js';

const NEAR = 0.7;

const SKY_TOP = '#141d30';
const SKY_LOW = '#3f6081';
const GRASS = '#2c4432';
const GRASS_ALT = '#293f2e';
const ROAD = '#3a3d44';
const ROAD_ALT = '#35383e';
const KERB_A = '#b8433a';
const KERB_B = '#d6d2ca';
const DASH = '#c9c5bc';
const WALL_A = '#a8433c';
const WALL_B = '#cdc9c1';
const POST = '#8d9099';
const CAR_BODY = '#e2695a';
const CAR_BODY_DARK = '#a83c30';
const CAR_CABIN_TOP = '#2f353f';
const CAR_CABIN = '#23272e';
const CAR_NOSE = '#f2c14e';
const SHADOW = 'rgba(0,0,0,0.35)';

const TIER_COLOUR = ['rgba(206,206,206,', 'rgba(242,193,78,', 'rgba(240,138,54,', 'rgba(94,204,240,'];

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  return {
    canvas,
    ctx,
    w: 0, h: 0, dpr: 1, focal: 400, horizon: 0,
    sky: null,
    particles: [],
    spawnCarry: 0,
    flash: 0,
    // Scratch buffers, reused every frame so the draw loop allocates nothing.
    _cam: new Float64Array(48),
    _clip: new Float64Array(64),
    _scr: new Float64Array(64),
  };
}

export function resize(r, cfg) {
  const dpr = Math.min(window.devicePixelRatio || 1, cfg.dprCap);
  const w = r.canvas.clientWidth;
  const h = r.canvas.clientHeight;
  r.canvas.width = Math.max(1, Math.round(w * dpr));
  r.canvas.height = Math.max(1, Math.round(h * dpr));
  r.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  r.w = w;
  r.h = h;
  r.dpr = dpr;
  r.horizon = h * 0.38;
  const g = r.ctx.createLinearGradient(0, 0, 0, r.horizon);
  g.addColorStop(0, SKY_TOP);
  g.addColorStop(1, SKY_LOW);
  r.sky = g;
  return r;
}

export function setFocal(r, cfg) {
  r.focal = (r.h / 2) / Math.tan((cfg.fov * Math.PI) / 360);
}

/* ---- projection ---------------------------------------------------------- */

/**
 * Transform a world polygon into camera space, clip it against the near plane
 * and project it to screen. Returns the number of screen points written into
 * r._scr as x,y pairs, or 0 if the polygon is entirely behind the camera.
 */
function projectPoly(r, cam, pts, n) {
  const cs = r._cam;
  const cy = Math.cos(cam.yaw);
  const sy = Math.sin(cam.yaw);

  for (let i = 0; i < n; i++) {
    const dx = pts[i * 3] - cam.x;
    const dy = pts[i * 3 + 1] - cam.y;
    const dz = pts[i * 3 + 2] - cam.z;
    cs[i * 3] = dx * cy - dz * sy;
    cs[i * 3 + 1] = dy;
    cs[i * 3 + 2] = dx * sy + dz * cy;
  }

  // Sutherland-Hodgman against the single plane z = NEAR.
  const clip = r._clip;
  let m = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const az = cs[i * 3 + 2];
    const bz = cs[j * 3 + 2];
    const aIn = az >= NEAR;
    const bIn = bz >= NEAR;
    if (aIn) {
      clip[m * 3] = cs[i * 3]; clip[m * 3 + 1] = cs[i * 3 + 1]; clip[m * 3 + 2] = az; m++;
    }
    if (aIn !== bIn) {
      const t = (NEAR - az) / (bz - az);
      clip[m * 3] = cs[i * 3] + (cs[j * 3] - cs[i * 3]) * t;
      clip[m * 3 + 1] = cs[i * 3 + 1] + (cs[j * 3 + 1] - cs[i * 3 + 1]) * t;
      clip[m * 3 + 2] = NEAR;
      m++;
    }
  }
  if (m < 3) return 0;

  const scr = r._scr;
  const halfW = r.w / 2;
  for (let i = 0; i < m; i++) {
    const s = r.focal / clip[i * 3 + 2];
    scr[i * 2] = halfW + clip[i * 3] * s;
    scr[i * 2 + 1] = r.horizon - clip[i * 3 + 1] * s;
  }
  return m;
}

function fillPoly(r, cam, pts, n, colour) {
  const m = projectPoly(r, cam, pts, n);
  if (!m) return;
  const ctx = r.ctx;
  const scr = r._scr;
  ctx.beginPath();
  ctx.moveTo(scr[0], scr[1]);
  for (let i = 1; i < m; i++) ctx.lineTo(scr[i * 2], scr[i * 2 + 1]);
  ctx.closePath();
  ctx.fillStyle = colour;
  ctx.fill();
}

/* ---- world --------------------------------------------------------------- */

const quad = new Float64Array(12);

function ribbon(r, cam, track, i, j, from, to, y, colour) {
  const hi = track.hs[i];
  const hj = track.hs[j];
  quad[0] = track.xs[i] + rightX(hi) * from; quad[1] = y; quad[2] = track.zs[i] + rightZ(hi) * from;
  quad[3] = track.xs[i] + rightX(hi) * to;   quad[4] = y; quad[5] = track.zs[i] + rightZ(hi) * to;
  quad[6] = track.xs[j] + rightX(hj) * to;   quad[7] = y; quad[8] = track.zs[j] + rightZ(hj) * to;
  quad[9] = track.xs[j] + rightX(hj) * from; quad[10] = y; quad[11] = track.zs[j] + rightZ(hj) * from;
  fillPoly(r, cam, quad, 4, colour);
}

function wall(r, cam, track, i, j, at, height, colour) {
  const hi = track.hs[i];
  const hj = track.hs[j];
  const xi = track.xs[i] + rightX(hi) * at;
  const zi = track.zs[i] + rightZ(hi) * at;
  const xj = track.xs[j] + rightX(hj) * at;
  const zj = track.zs[j] + rightZ(hj) * at;
  quad[0] = xi; quad[1] = 0; quad[2] = zi;
  quad[3] = xi; quad[4] = height; quad[5] = zi;
  quad[6] = xj; quad[7] = height; quad[8] = zj;
  quad[9] = xj; quad[10] = 0; quad[11] = zj;
  fillPoly(r, cam, quad, 4, colour);
}

function drawWorld(r, cam, sim, cfg) {
  const track = sim.track;
  const ctx = r.ctx;

  ctx.fillStyle = r.sky;
  ctx.fillRect(0, 0, r.w, r.horizon + 1);
  ctx.fillStyle = GRASS;
  ctx.fillRect(0, r.horizon, r.w, r.h - r.horizon);

  const far = Math.max(4, Math.round(cfg.drawDistance / track.segment));
  const hw = track.halfWidth;
  const edge = hw + track.shoulder;

  for (let k = far; k >= -4; k--) {
    // Far geometry is drawn every other segment: it covers a couple of pixels
    // and halves the fill count where it costs nothing to lose.
    const lod = k > 34;
    if (lod && (k & 1)) continue;
    const stride = lod ? 2 : 1;
    const i = wrapIndex(track, sim.index + k);
    const j = wrapIndex(track, sim.index + k + stride);
    const band = (Math.floor((sim.index + k) / 2) & 1) === 0;

    ribbon(r, cam, track, i, j, -edge, edge, 0, band ? GRASS : GRASS_ALT);
    ribbon(r, cam, track, i, j, -hw, hw, 0.01, band ? ROAD : ROAD_ALT);

    if (!lod) {
      const alt = ((sim.index + k) & 1) === 0;
      ribbon(r, cam, track, i, j, -hw, -hw + 2.4, 0.02, alt ? KERB_A : KERB_B);
      ribbon(r, cam, track, i, j, hw - 2.4, hw, 0.02, alt ? KERB_A : KERB_B);
      if (alt) ribbon(r, cam, track, i, j, -0.7, 0.7, 0.02, DASH);
      wall(r, cam, track, i, j, -edge, 3.2, alt ? WALL_A : WALL_B);
      wall(r, cam, track, i, j, edge, 3.2, alt ? WALL_A : WALL_B);
    }

    if (((sim.index + k) % 12) === 0) {
      wall(r, cam, track, i, wrapIndex(track, i + 1), -edge - 6, 8, POST);
      wall(r, cam, track, i, wrapIndex(track, i + 1), edge + 6, 8, POST);
    }
  }
}

/* ---- car ----------------------------------------------------------------- */

const CAR_LEN = 8;
const CAR_WID = 4.6;
const box = new Float64Array(12);
const corners = new Float64Array(24);   // 4 bottom then 4 top, xyz each
const faceOrder = [0, 1, 2, 3];

function carCorners(sim, halfLen, halfWid, forwardOffset, y0, y1) {
  const h = sim.heading;
  const fx = forwardX(h);
  const fz = forwardZ(h);
  const rx = rightX(h);
  const rz = rightZ(h);
  const cx = sim.x + fx * forwardOffset;
  const cz = sim.z + fz * forwardOffset;
  const plan = [
    [-halfWid, halfLen], [halfWid, halfLen], [halfWid, -halfLen], [-halfWid, -halfLen],
  ];
  for (let i = 0; i < 4; i++) {
    const x = cx + rx * plan[i][0] + fx * plan[i][1];
    const z = cz + rz * plan[i][0] + fz * plan[i][1];
    corners[i * 3] = x; corners[i * 3 + 1] = y0; corners[i * 3 + 2] = z;
    corners[12 + i * 3] = x; corners[12 + i * 3 + 1] = y1; corners[12 + i * 3 + 2] = z;
  }
  return corners;
}

function carQuad(sim, halfLen, halfWid, forwardOffset, y) {
  const c = carCorners(sim, halfLen, halfWid, forwardOffset, y, y);
  for (let i = 0; i < 12; i++) box[i] = c[i];
  return box;
}

/**
 * Draw a solid box. The four sides are painted far to near so the near face
 * always wins; the roof goes on last. Flat quads read as paper from the chase
 * camera, and the car has to read as an object for a drift to be legible.
 */
function drawBox(r, cam, sim, halfLen, halfWid, forwardOffset, y0, y1, side, top) {
  const c = carCorners(sim, halfLen, halfWid, forwardOffset, y0, y1);

  faceOrder.sort((a, b) => {
    const da = depthOf(cam, c, a);
    const db = depthOf(cam, c, b);
    return db - da;
  });

  for (const f of faceOrder) {
    const i = f;
    const j = (f + 1) % 4;
    box[0] = c[i * 3];      box[1] = y0; box[2] = c[i * 3 + 2];
    box[3] = c[j * 3];      box[4] = y0; box[5] = c[j * 3 + 2];
    box[6] = c[j * 3];      box[7] = y1; box[8] = c[j * 3 + 2];
    box[9] = c[i * 3];      box[10] = y1; box[11] = c[i * 3 + 2];
    fillPoly(r, cam, box, 4, side);
  }

  for (let i = 0; i < 4; i++) {
    box[i * 3] = c[12 + i * 3];
    box[i * 3 + 1] = y1;
    box[i * 3 + 2] = c[12 + i * 3 + 2];
  }
  fillPoly(r, cam, box, 4, top);
}

function depthOf(cam, c, f) {
  const i = f;
  const j = (f + 1) % 4;
  const mx = (c[i * 3] + c[j * 3]) / 2 - cam.x;
  const mz = (c[i * 3 + 2] + c[j * 3 + 2]) / 2 - cam.z;
  return mx * Math.sin(cam.yaw) + mz * Math.cos(cam.yaw);
}

function drawCar(r, cam, sim) {
  fillPoly(r, cam, carQuad(sim, CAR_LEN / 2 + 0.9, CAR_WID / 2 + 0.9, 0, 0.02), 4, SHADOW);
  drawBox(r, cam, sim, CAR_LEN / 2, CAR_WID / 2, 0, 0.25, 1.9, CAR_BODY_DARK, CAR_BODY);
  drawBox(r, cam, sim, 2.0, CAR_WID / 2 - 0.7, -0.7, 1.9, 3.5, CAR_CABIN, CAR_CABIN_TOP);
  // The nose flash is the readability device: it is how the player sees the
  // car pointing somewhere other than where it is travelling.
  fillPoly(r, cam, carQuad(sim, 0.9, CAR_WID / 2 - 0.35, CAR_LEN / 2 - 0.9, 1.95), 4, CAR_NOSE);
}

/* ---- particles ----------------------------------------------------------- */

function updateParticles(r, sim, dt) {
  const ps = r.particles;
  for (let i = ps.length - 1; i >= 0; i--) {
    const p = ps[i];
    p.life -= dt;
    if (p.life <= 0) { ps[i] = ps[ps.length - 1]; ps.pop(); continue; }
    p.y += p.rise * dt;
    p.x += p.vx * dt;
    p.z += p.vz * dt;
  }

  if (!sim.drifting || sim.speed < 5) { r.spawnCarry = 0; return; }
  r.spawnCarry += dt * 42;
  const tier = Math.min(3, sim.driftTime >= sim.cfg.tier3Charge ? 3
    : sim.driftTime >= sim.cfg.tier2Charge ? 2
    : sim.driftTime >= sim.cfg.tier1Charge ? 1 : 0);
  while (r.spawnCarry >= 1 && ps.length < 90) {
    r.spawnCarry -= 1;
    const h = sim.heading;
    const side = (Math.random() < 0.5 ? -1 : 1) * (CAR_WID / 2);
    const back = -CAR_LEN / 2;
    ps.push({
      x: sim.x + rightX(h) * side + forwardX(h) * back,
      z: sim.z + rightZ(h) * side + forwardZ(h) * back,
      y: 0.3,
      vx: (Math.random() - 0.5) * 6 - rightX(h) * sim.driftDir * 4,
      vz: (Math.random() - 0.5) * 6 - rightZ(h) * sim.driftDir * 4,
      rise: 3 + Math.random() * 3,
      life: 0.38 + Math.random() * 0.24,
      max: 0.62,
      tier,
    });
  }
}

function drawParticles(r, cam) {
  // Billboards, not world-axis quads: a quad lying along the world axes turns
  // into a long sliver whenever the camera sees it near edge-on.
  const rx = Math.cos(cam.yaw);
  const rz = -Math.sin(cam.yaw);
  const fx = Math.sin(cam.yaw);
  const fz = Math.cos(cam.yaw);
  for (const p of r.particles) {
    // Anything this close to the lens is a smear across the whole screen
    // rather than a puff of smoke.
    const depth = (p.x - cam.x) * fx + (p.z - cam.z) * fz;
    if (depth < 9) continue;
    const age = 1 - p.life / p.max;
    const size = 0.45 + age * 1.25;
    const alpha = Math.max(0, p.life / p.max) * 0.3;
    const ox = rx * size;
    const oz = rz * size;
    const top = p.y + size * 1.6;
    box[0] = p.x - ox; box[1] = p.y; box[2] = p.z - oz;
    box[3] = p.x + ox; box[4] = p.y; box[5] = p.z + oz;
    box[6] = p.x + ox; box[7] = top;  box[8] = p.z + oz;
    box[9] = p.x - ox; box[10] = top; box[11] = p.z - oz;
    fillPoly(r, cam, box, 4, TIER_COLOUR[p.tier] + alpha.toFixed(3) + ')');
  }
}

/* ---- hud ----------------------------------------------------------------- */

function drawHud(r, sim, cfg) {
  const ctx = r.ctx;
  const w = r.w;
  const pad = Math.round(w * 0.06);
  const barW = w - pad * 2;
  const barY = Math.round(r.h * 0.26);
  const barH = 12;

  ctx.fillStyle = 'rgba(8,10,14,0.55)';
  ctx.fillRect(pad, barY, barW, barH);

  const tier = sim.drifting
    ? (sim.driftTime >= cfg.tier3Charge ? 3
      : sim.driftTime >= cfg.tier2Charge ? 2
      : sim.driftTime >= cfg.tier1Charge ? 1 : 0)
    : 0;

  if (sim.drifting) {
    const p = Math.min(1, sim.driftTime / cfg.tier3Charge);
    ctx.fillStyle = TIER_COLOUR[tier] + '0.95)';
    ctx.fillRect(pad, barY, barW * p, barH);
    if (sim.driftTime > cfg.overcookStart) {
      // Overcooking is shown as the bar bleeding away at the leading edge.
      const over = Math.min(1, (sim.driftTime - cfg.overcookStart) / 1.5);
      ctx.fillStyle = 'rgba(200,60,50,' + (0.35 + over * 0.5).toFixed(2) + ')';
      ctx.fillRect(pad, barY, barW * p, barH);
    }
  }

  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (const t of [cfg.tier1Charge, cfg.tier2Charge]) {
    const x = pad + barW * (t / cfg.tier3Charge);
    ctx.fillRect(Math.round(x) - 1, barY - 3, 2, barH + 6);
  }

  if (r.flash > 0) {
    ctx.fillStyle = 'rgba(255,255,255,' + (r.flash * 0.16).toFixed(3) + ')';
    ctx.fillRect(0, 0, r.w, r.h);
  }

  // Speed and lap sit on the right, below the panel toggle: the debug block
  // owns the left of the top strip.
  ctx.font = '600 ' + Math.round(w * 0.085) + 'px ui-monospace, Menlo, monospace';
  ctx.textAlign = 'right';
  ctx.fillStyle = sim.boostLeft > 0 ? '#5eccf0' : '#e8eaee';
  ctx.fillText(String(Math.round(sim.speed)), w - pad, barY - 34);

  ctx.font = '500 ' + Math.round(w * 0.032) + 'px ui-monospace, Menlo, monospace';
  ctx.fillStyle = '#aeb4be';
  const best = sim.bestLap ? sim.bestLap.toFixed(2) : '--.--';
  ctx.fillText('L' + sim.lap + '  ' + sim.lapTime.toFixed(2) + '  BEST ' + best, w - pad, barY - 14);

  if (sim.recovering) {
    ctx.textAlign = 'center';
    ctx.font = '600 ' + Math.round(w * 0.05) + 'px ui-monospace, Menlo, monospace';
    ctx.fillStyle = '#f2c14e';
    ctx.fillText('RECOVERING', w / 2, r.h * 0.335);
  }
}

/* ---- frame --------------------------------------------------------------- */

export function draw(r, sim, cam, cfg, dt) {
  setFocal(r, cfg);
  updateParticles(r, sim, dt);
  if (r.flash > 0) r.flash = Math.max(0, r.flash - dt * 4);

  drawWorld(r, cam, sim, cfg);
  drawParticles(r, cam);
  drawCar(r, cam, sim);
  drawHud(r, sim, cfg);
}

export function boostFlash(r) { r.flash = 1; }
