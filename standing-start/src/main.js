/* Standing Start — Phase 1 feel prototype.
 *
 * Wires the pieces together and runs the loop. The simulation advances on a
 * fixed timestep so the drift and boost timings mean the same thing whatever
 * the display is doing; rendering happens once per frame.
 */

import { OVAL } from './track.js';
import { createSim, step, reset, resetStats } from './simulation.js';
import { createInput } from './input.js';
import { createCamera, updateCamera } from './camera.js';
import { createRenderer, resize, draw, boostFlash } from './render.js';
import { createPanel, loadSaved } from './tuning.js';

const FIXED = 1 / 120;
const MAX_FRAME = 0.25;

const canvas = document.getElementById('view');
const debugEl = document.getElementById('debug');
const cfg = loadSaved();

const sim = createSim(OVAL, cfg);
const cam = createCamera();
const renderer = createRenderer(canvas);
const input = createInput(canvas, cfg);

createPanel(document.body, cfg, {
  resetCar: () => { reset(sim); resetStats(sim); updateCamera(cam, sim, cfg, 0, 0, true); },
  onChange: () => { resize(renderer, cfg); },
});

function fit() { resize(renderer, cfg); }
window.addEventListener('resize', fit);
window.addEventListener('orientationchange', () => setTimeout(fit, 120));
fit();
updateCamera(cam, sim, cfg, 0, 0, true);

// --- loop ------------------------------------------------------------------

let last = performance.now();
let accumulator = 0;
let frameMs = 0;
let fps = 0;
let fpsCount = 0;
let fpsSince = last;
let debugSince = 0;
let seenBoosts = 0;
let worstFrame = 0;

function frame(now) {
  // A handle for the console and for automated driving checks. The prototype is
// a diagnostic tool, so its state is deliberately reachable.
window.__ss = { sim, cfg, cam, input, renderer };

requestAnimationFrame(frame);

  let dt = (now - last) / 1000;
  last = now;
  if (dt > MAX_FRAME) dt = MAX_FRAME;

  const started = performance.now();
  const state = input.read();

  accumulator += dt;
  let guard = 0;
  while (accumulator >= FIXED && guard++ < 16) {
    step(sim, FIXED, state);
    // Edge flags belong to the frame, not to every substep.
    state.driftRequest = false;
    state.release = false;
    accumulator -= FIXED;
  }

  if (sim.stats.boosts > seenBoosts) {
    seenBoosts = sim.stats.boosts;
    boostFlash(renderer);
  }

  updateCamera(cam, sim, cfg, dt, state.lock, false);
  draw(renderer, sim, cam, cfg, dt);

  const cost = performance.now() - started;
  frameMs += (cost - frameMs) * 0.1;
  worstFrame = Math.max(worstFrame * 0.995, cost);
  fpsCount++;
  if (now - fpsSince >= 500) {
    fps = (fpsCount * 1000) / (now - fpsSince);
    fpsCount = 0;
    fpsSince = now;
  }

  if (now - debugSince > 100) {
    debugSince = now;
    paintDebug(state);
  }
}

function paintDebug(state) {
  const s = sim.stats;
  const tier = sim.drifting
    ? (sim.driftTime >= cfg.tier3Charge ? 3
      : sim.driftTime >= cfg.tier2Charge ? 2
      : sim.driftTime >= cfg.tier1Charge ? 1 : 0)
    : 0;
  const rows = [
    ['fps', fps.toFixed(0) + '  ' + frameMs.toFixed(1) + 'ms  peak ' + worstFrame.toFixed(1)],
    ['speed', sim.speed.toFixed(1) + (sim.boostLeft > 0 ? '  BOOST T' + sim.boostTier + ' ' + sim.boostLeft.toFixed(2) + 's' : '')],
    ['steer', state.lock.toFixed(2) + '  ' + state.travel.toFixed(0) + 'px  ' + state.model + (sim.assisting ? '  assist' : '')],
    ['drift', sim.drifting ? 'yes ' + sim.driftTime.toFixed(2) + 's  charged T' + tier + (sim.driftTime > cfg.overcookStart ? '  OVERCOOK' : '') : 'no'],
    ['heading', (((sim.heading * 57.2958) % 360 + 360) % 360).toFixed(0) + '°  slip ' + (sim.slip * 57.2958).toFixed(0) + '°'],
    ['track', (sim.onTrack ? 'on' : 'OFF') + '  lat ' + sim.lateral.toFixed(1) + (sim.recovering ? '  RECOVERING' : '')],
    ['laps', sim.lap + '  last ' + sim.lastLap.toFixed(2) + '  best ' + (sim.bestLap ? sim.bestLap.toFixed(2) : '--')],
    ['drifts', s.drifts + '  aborted ' + s.aborted + '  T1/2/3 ' + s.tiers[1] + '/' + s.tiers[2] + '/' + s.tiers[3]],
    ['errors', 'walls ' + s.wallHits + '  offtrack ' + s.offTrackTime.toFixed(1) + 's  recover ' + s.recoveries],
    ['items', String(input.itemEvents)],
  ];
  debugEl.textContent = rows.map(([k, v]) => k.padEnd(8) + v).join('\n');
}

// A handle for the console and for automated driving checks. The prototype is
// a diagnostic tool, so its state is deliberately reachable.
window.__ss = { sim, cfg, cam, input, renderer };

requestAnimationFrame(frame);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* offline is a bonus here */ });
  });
}
