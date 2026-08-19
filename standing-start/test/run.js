/* Standing Start — the checks that do not need a browser.
 *
 * These cover the parts that are easy to break silently while tuning: track
 * geometry, the drift and boost state machine, the design invariants the spec
 * argued for, and whether the service worker still lists every file that
 * exists. Whether the driving is fun has to be tested by driving it.
 *
 *   node test/run.js
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { GROUPS, defaults } from '../src/config.js';
import { OVAL, buildTrack, locate, angleDelta } from '../src/track.js';
import { createSim, step, reset, tierFor } from '../src/simulation.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
let count = 0;

function check(name, cond, extra) {
  count++;
  const line = '  ' + (cond ? 'ok  ' : 'FAIL') + ' ' + name + (extra ? '  — ' + extra : '');
  console.log(line);
  if (!cond) failures.push(name);
}

function section(t) { console.log('\n' + t); }

const idle = { lock: 0, active: false, driftRequest: false, release: false };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** A stand-in for a competent player: hold the centreline. */
function autoLock(sim, gain = 2.2, correction = 0.55) {
  const th = sim.track.hs[sim.index];
  const herr = angleDelta(th, sim.heading);
  return clamp(herr * gain - (sim.lateral / sim.track.halfWidth) * correction, -1, 1);
}

function drive(sim, seconds, fn) {
  const dt = 1 / 120;
  for (let i = 0; i < Math.round(seconds / dt); i++) {
    const input = fn ? fn(sim, i * dt) : { ...idle, lock: autoLock(sim) };
    step(sim, dt, input);
  }
}

/* -------------------------------------------------------------------------- */

section('Config');
{
  const cfg = defaults();
  let inRange = true;
  let missingLabel = false;
  for (const g of GROUPS) {
    for (const [name, def] of Object.entries(g.params)) {
      if (def.v < def.min || def.v > def.max) { inRange = false; console.log('    out of range: ' + name); }
      if (!def.label) missingLabel = true;
    }
  }
  check('every default sits inside its own slider range', inRange);
  check('every parameter has a label for the panel', !missingLabel);
  check('config exposes every tunable the sim reads', Object.keys(cfg).length > 50, Object.keys(cfg).length + ' params');
}

section('Track');
{
  const t = buildTrack(OVAL);
  check('the loop closes on itself', t.closeError < 0.001, t.closeError.toExponential(2) + 'u');
  check('length matches the shape commands', Math.abs(t.length - (680 + 2 * Math.PI * 185)) < 1, t.length.toFixed(1) + 'u');
  check('centreline is sampled at the requested spacing', Math.abs(t.length / t.count - t.segment) < 0.05);

  const on = locate(t, 0, 40, 8);
  check('a point on the centreline reads zero lateral', Math.abs(on.lateral) < 1e-9);
  check('distance along the track is measured correctly', Math.abs(on.s - 40) < 0.01, on.s.toFixed(3));
  const right = locate(t, 13, 40, 8);
  check('lateral offset is signed to the right of travel', Math.abs(right.lateral - 13) < 1e-9);

  check('angleDelta wraps the short way round', Math.abs(angleDelta(-3.1, 3.1) - 0.0831853) < 1e-4);
}

section('Design invariants');
{
  const cfg = defaults();
  check('overcooking begins before the top tier is reached',
    cfg.overcookStart < cfg.tier3Charge,
    'overcook ' + cfg.overcookStart + 's vs tier 3 at ' + cfg.tier3Charge + 's');
  check('tier thresholds increase', cfg.tier1Charge < cfg.tier2Charge && cfg.tier2Charge < cfg.tier3Charge);
  check('tier rewards increase', cfg.tier1Speed < cfg.tier2Speed && cfg.tier2Speed < cfg.tier3Speed);
  check('the outward slide is tunable', typeof cfg.driftSlide === 'number');
}

section('Boost');
{
  const cfg = defaults();
  check('tier boundaries fall on the right side', tierFor(cfg, 0.64) === 0 && tierFor(cfg, 0.65) === 1 &&
    tierFor(cfg, 1.24) === 1 && tierFor(cfg, 2.0) === 3);

  const sim = createSim(OVAL, cfg);
  sim.speed = cfg.topSpeed;
  sim.drifting = true; sim.driftDir = 1; sim.driftTime = 2.1;
  const before = sim.speed;
  step(sim, 1 / 120, { lock: 0, active: false, driftRequest: false, release: true });
  check('releasing a charged drift fires a boost', sim.boostLeft > 0 && sim.boostTier === 3);
  check('the boost lands as an immediate impulse, not just a raised cap',
    sim.speed > before + 1, '+' + (sim.speed - before).toFixed(1) + 'u/s on the first step');

  // Distance covered in 2.5s from the moment of release, against the same car
  // with no boost at all.
  function distance(tier) {
    const c = defaults();
    const s = createSim(OVAL, c);
    s.speed = c.topSpeed;
    if (tier) {
      s.drifting = true; s.driftDir = 1; s.driftTime = [0, 0.7, 1.3, 2.1][tier];
      step(s, 1 / 120, { lock: 0.4, active: false, driftRequest: false, release: true });
    }
    const dt = 1 / 120;
    let d = 0;
    for (let i = 0; i < Math.round(2.5 / dt); i++) {
      step(s, dt, idle);
      d += s.speed * dt;
    }
    return d;
  }
  const gains = [1, 2, 3].map((t) => distance(t) - distance(0));
  check('every tier is worth more than the one below', gains[0] > 0 && gains[1] > gains[0] && gains[2] > gains[1],
    gains.map((g, i) => 'T' + (i + 1) + ' +' + g.toFixed(0)).join(' '));
}

section('Drift');
{
  const cfg = defaults();
  const sim = createSim(OVAL, cfg);
  sim.speed = cfg.topSpeed;
  step(sim, 1 / 120, { lock: 0.8, active: true, driftRequest: true, release: false });
  check('a drift starts when asked for at speed and on lock', sim.drifting && sim.driftDir === 1);

  const slow = createSim(OVAL, defaults());
  slow.speed = 5;
  step(slow, 1 / 120, { lock: 0.8, active: true, driftRequest: true, release: false });
  check('a drift is refused below the minimum speed', !slow.drifting);

  const straight = createSim(OVAL, defaults());
  straight.speed = defaults().topSpeed;
  step(straight, 1 / 120, { lock: 0.05, active: true, driftRequest: true, release: false });
  check('a drift is refused without steering lock', !straight.drifting);

  // Heading and travel must actually diverge, or there is nothing to see.
  const d = createSim(OVAL, defaults());
  d.speed = defaults().topSpeed;
  drive(d, 0.9, (s, t) => ({ lock: 0.9, active: true, driftRequest: t < 0.02, release: false }));
  check('drifting separates where the car points from where it goes',
    Math.abs(d.slip) > 0.12, (d.slip * 57.2958).toFixed(1) + '° of slip');

  // Overcooking must cost steering. Measured inside a single long drift on a
  // skid pad, so barriers cannot end it before the penalty bites.
  const PAD = { ...OVAL, shoulder: 5000 };
  function turnRate(from, to) {
    const cfg2 = defaults();
    const s = createSim(PAD, cfg2);
    s.speed = cfg2.topSpeed;
    const dt = 1 / 120;
    let h0 = 0;
    let turned = 0;
    for (let i = 0; i < Math.round(to / dt); i++) {
      const t = i * dt;
      step(s, dt, { lock: 0.7, active: true, driftRequest: t < 0.02, release: false });
      if (Math.abs(t - from) < dt / 2) h0 = s.heading;
      if (t >= from) turned = s.heading - h0;
    }
    return { rate: Math.abs(turned) / (to - from), drifting: s.drifting };
  }
  const early = turnRate(1.0, 1.5);
  const late = turnRate(3.0, 3.5);
  check('the drift survives long enough to overcook', early.drifting && late.drifting);
  check('overcooking reduces the rate of turn', late.rate < early.rate * 0.95,
    early.rate.toFixed(3) + ' rad/s early vs ' + late.rate.toFixed(3) + ' late');
}

section('Track limits and recovery');
{
  const cfg = defaults();
  const sim = createSim(OVAL, cfg);
  sim.speed = cfg.topSpeed;
  // Drive hard at the barrier.
  drive(sim, 3, () => ({ lock: 1, active: false, driftRequest: false, release: false }));
  const limit = sim.track.halfWidth + sim.track.shoulder;
  check('the car cannot leave the barriers', Math.abs(sim.lateral) <= limit + 1e-6, sim.lateral.toFixed(2));
  check('hitting a barrier costs speed', sim.stats.wallHits > 0 && sim.speed < cfg.topSpeed);

  const stuck = createSim(OVAL, defaults());
  stuck.speed = 0;
  stuck.heading = stuck.track.hs[0] + Math.PI;
  stuck.velDir = stuck.heading;
  drive(stuck, 2.5, () => idle);
  check('a badly stuck car triggers recovery', stuck.stats.recoveries > 0);
  drive(stuck, 4, () => ({ ...idle, lock: autoLock(stuck) }));
  check('recovery puts the car back on the road facing forwards',
    Math.abs(angleDelta(stuck.track.hs[stuck.index], stuck.heading)) < 0.6 && stuck.speed > 20,
    'speed ' + stuck.speed.toFixed(0));

  // Recovery has to steer back onto the road, not just straighten up and drive
  // along the wall. Placed on the barrier, pointing straight down the track,
  // with a hands-off thumb.
  const pinned = createSim(OVAL, defaults());
  const edge = pinned.track.halfWidth + pinned.track.shoulder;
  const h10 = pinned.track.hs[10];
  pinned.x = pinned.track.xs[10] + Math.cos(h10) * edge;
  pinned.z = pinned.track.zs[10] - Math.sin(h10) * edge;
  pinned.heading = pinned.velDir = h10;
  pinned.speed = 40;
  pinned.recovering = true;
  pinned.recoverLeft = defaults().recoverTime;
  const startLat = Math.abs(locate(pinned.track, pinned.x, pinned.z, 10).lateral);
  drive(pinned, defaults().recoverTime, () => idle);
  check('recovery closes on the road within its own duration',
    Math.abs(pinned.lateral) < startLat - 4,
    startLat.toFixed(1) + ' to ' + Math.abs(pinned.lateral).toFixed(1) + ' lateral');
  drive(pinned, 0.2, () => idle);
  check('and hands back a car that is on the road and racing',
    Math.abs(pinned.lateral) < pinned.track.halfWidth && pinned.speed > 40 && !pinned.recovering,
    'lateral ' + pinned.lateral.toFixed(1) + ', speed ' + pinned.speed.toFixed(0));

  // Scraping along a barrier is one contact, not one per frame.
  const scrape = createSim(OVAL, defaults());
  scrape.speed = defaults().topSpeed;
  drive(scrape, 3, () => ({ lock: 1, active: false, driftRequest: false, release: false }));
  check('the wall counter counts contacts, not frames',
    scrape.stats.wallHits > 0 && scrape.stats.wallHits < 15,
    scrape.stats.wallHits + ' hits over 3s of scraping');
}

section('Laps');
{
  const sim = createSim(OVAL, defaults());
  drive(sim, 70);
  check('laps are counted', sim.lap >= 2, sim.lap + ' laps');
  check('a best lap is recorded and is plausible', sim.bestLap > 10 && sim.bestLap < 60, sim.bestLap.toFixed(2) + 's');
  check('a clean lap stays on the track', sim.stats.wallHits === 0 && sim.stats.offTrackTime === 0);
}

section('Determinism');
{
  const a = createSim(OVAL, defaults());
  const b = createSim(OVAL, defaults());
  drive(a, 20);
  drive(b, 20);
  check('the same inputs produce the same drive', Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.z - b.z) < 1e-9);

  const c = createSim(OVAL, defaults());
  drive(c, 12);
  reset(c);
  check('reset returns the car to the grid', c.speed === 0 && c.lap === 0 && Math.abs(c.lateral) < 1e-9);
}

section('Shell');
{
  const sw = readFileSync(join(ROOT, 'sw.js'), 'utf8');
  const listed = [...sw.matchAll(/'\.\/([^']+)'/g)].map((m) => m[1]);
  const actual = readdirSync(join(ROOT, 'src')).filter((f) => f.endsWith('.js')).map((f) => 'src/' + f);
  const missing = actual.filter((f) => !listed.includes(f));
  check('the service worker precaches every source file', missing.length === 0, missing.join(', ') || 'all listed');

  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  check('the page loads the entry module', html.includes('src/main.js') && html.includes('type="module"'));
  check('the page is pinned to portrait in the manifest',
    JSON.parse(readFileSync(join(ROOT, 'manifest.webmanifest'), 'utf8')).orientation === 'portrait');
}

console.log('\n' + (failures.length ? failures.length + ' of ' + count + ' checks failed' : 'all ' + count + ' checks passed'));
process.exit(failures.length ? 1 : 0);
