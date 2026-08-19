/* Standing Start — the driving simulation.
 *
 * The car lives in world space: it has a position, a heading (where it points)
 * and a direction of travel. Those two angles are allowed to diverge, and that
 * divergence is the drift. Rendering projects this into a pseudo-3D view, but
 * the simulation never knows about the camera and has no idea it is being
 * drawn that way.
 */

import { buildTrack, locate, angleDelta, forwardX, forwardZ, rightX, rightZ } from './track.js';

const DEG = Math.PI / 180;

export function createSim(trackDef, cfg) {
  const track = buildTrack(trackDef);
  const sim = {
    track,
    cfg,
    x: 0, z: 0, heading: 0, velDir: 0, speed: 0, slip: 0,
    s: 0, lateral: 0, index: 0, onTrack: true, assisting: false,
    drifting: false, driftDir: 0, driftTime: 0, charge: 0,
    boostTier: 0, boostLeft: 0, boostCap: 0, boostCooldown: 0,
    recovering: false, recoverLeft: 0, recoverElapsed: 0, stuckFor: 0, onWall: false,
    time: 0, lap: 0, lapTime: 0, lastLap: 0, bestLap: 0,
    // What the two-minute test needs to be more than an impression.
    stats: {
      drifts: 0, aborted: 0, boosts: 0,
      tiers: [0, 0, 0, 0],
      wallHits: 0, offTrackTime: 0, recoveries: 0, items: 0,
    },
    events: [],
  };
  reset(sim);
  return sim;
}

export function reset(sim) {
  const t = sim.track;
  sim.x = t.xs[0];
  sim.z = t.zs[0];
  sim.heading = t.hs[0];
  sim.velDir = t.hs[0];
  sim.speed = 0;
  sim.slip = 0;
  sim.s = 0;
  sim.lateral = 0;
  sim.index = 0;
  sim.onTrack = true;
  sim.drifting = false;
  sim.driftDir = 0;
  sim.driftTime = 0;
  sim.charge = 0;
  sim.boostTier = 0;
  sim.boostLeft = 0;
  sim.boostCap = 0;
  sim.boostCooldown = 0;
  sim.recovering = false;
  sim.recoverLeft = 0;
  sim.recoverElapsed = 0;
  sim.stuckFor = 0;
  sim.onWall = false;
  sim.lapTime = 0;
}

export function resetStats(sim) {
  const s = sim.stats;
  s.drifts = 0; s.aborted = 0; s.boosts = 0;
  s.tiers = [0, 0, 0, 0];
  s.wallHits = 0; s.offTrackTime = 0; s.recoveries = 0; s.items = 0;
  sim.lap = 0; sim.lastLap = 0; sim.bestLap = 0;
}

/** Which boost tier a drift of this length has earned. 0 means none. */
export function tierFor(cfg, driftTime) {
  if (driftTime >= cfg.tier3Charge) return 3;
  if (driftTime >= cfg.tier2Charge) return 2;
  if (driftTime >= cfg.tier1Charge) return 1;
  return 0;
}

/** Charge progress 0..1 across the whole bar, for the HUD. */
export function chargeProgress(cfg, driftTime) {
  return Math.min(1, driftTime / cfg.tier3Charge);
}

function tierValues(cfg, tier) {
  if (tier === 1) return { speed: cfg.tier1Speed, dur: cfg.tier1Dur };
  if (tier === 2) return { speed: cfg.tier2Speed, dur: cfg.tier2Dur };
  return { speed: cfg.tier3Speed, dur: cfg.tier3Dur };
}

/**
 * Fire the boost a completed drift earned.
 *
 * A boost is an immediate velocity impulse plus a raised cap for its duration.
 * Raising the cap alone would leave ordinary acceleration to close the gap,
 * and at Tier 1 that ramp eats most of the boost's life — the player would
 * feel almost nothing.
 */
function fireBoost(sim, tier) {
  const cfg = sim.cfg;
  const { speed: pct, dur } = tierValues(cfg, tier);
  const target = cfg.topSpeed * (1 + pct);
  const gain = target - cfg.topSpeed;

  sim.speed = Math.min(target, sim.speed + gain * cfg.boostImpulse);
  sim.boostCap = target;
  sim.boostLeft = dur;
  sim.boostTier = tier;
  sim.stats.boosts++;
  sim.stats.tiers[tier]++;
  sim.events.push({ type: 'boost', tier, t: sim.time });
}

function endDrift(sim, released) {
  if (!sim.drifting) return;
  const tier = released ? tierFor(sim.cfg, sim.driftTime) : 0;
  if (tier > 0) fireBoost(sim, tier);
  // A drift dropped almost immediately is the signature of an accidental one.
  if (sim.driftTime < 0.3) sim.stats.aborted++;
  sim.drifting = false;
  sim.driftDir = 0;
  sim.driftTime = 0;
  sim.charge = 0;
}

/**
 * Advance the simulation by dt seconds.
 * `input` is { lock, active, driftRequest, release } with lock in -1..1.
 */
export function step(sim, dt, input) {
  const cfg = sim.cfg;
  const track = sim.track;
  const topSpeed = cfg.topSpeed;
  sim.time += dt;
  sim.lapTime += dt;

  // --- drift state machine -------------------------------------------------

  if (sim.drifting && (!input.active || input.release)) {
    endDrift(sim, true);
  }

  if (!sim.drifting && input.driftRequest && !sim.recovering) {
    const fastEnough = sim.speed >= cfg.driftMinSpeed * topSpeed;
    const turning = Math.abs(input.lock) >= cfg.driftMinLock;
    if (fastEnough && turning) {
      sim.drifting = true;
      sim.driftDir = Math.sign(input.lock) || 1;
      sim.driftTime = 0;
      sim.stats.drifts++;
      sim.events.push({ type: 'drift', t: sim.time });
    }
  }

  if (sim.drifting) {
    sim.driftTime += dt;
    sim.charge = chargeProgress(cfg, sim.driftTime);
    if (sim.speed < cfg.driftMinSpeed * topSpeed * 0.75) endDrift(sim, false);
  }

  // --- steering ------------------------------------------------------------

  let lock = input.lock;
  if (sim.drifting) {
    // A drift is committed: the car keeps turning with a neutral thumb, and
    // the thumb adjusts the line around that.
    lock = Math.max(-1, Math.min(1, sim.driftDir * cfg.driftBase + input.lock));
  }

  const speedFrac = Math.min(1, sim.speed / topSpeed);
  let rate = cfg.steerRate * (1 - cfg.steerFalloff * speedFrac) * DEG;

  if (sim.drifting) {
    rate *= cfg.driftSteerMul;
    if (sim.driftTime > cfg.overcookStart) {
      const over = sim.driftTime - cfg.overcookStart;
      rate *= Math.max(0.25, 1 - cfg.overcookRate * over);
    }
  }

  sim.heading += lock * rate * dt;

  // --- steering assist -----------------------------------------------------

  const trackHeading = track.hs[sim.index];
  const headingErr = angleDelta(trackHeading, sim.heading);
  let assistRate = 0;
  let assistTarget = headingErr;
  if (sim.recovering) {
    assistRate = cfg.recoverAssist;
    // Aim across the track towards the centreline, not merely along it. Fixing
    // heading alone leaves a car pinned against a barrier driving parallel to
    // it for ever.
    const bias = Math.max(-1, Math.min(1, sim.lateral / track.halfWidth));
    assistTarget = angleDelta(trackHeading - bias * cfg.recoverAim * DEG, sim.heading);
  } else if (!sim.drifting) {
    // The 0-1 dial maps to at most 3 radians of correction per second, and
    // fades out as the player takes control.
    assistRate = cfg.steerAssist * 3 * (1 - Math.abs(input.lock));
  }
  sim.assisting = assistRate > 0.01;
  if (assistRate > 0) sim.heading += assistTarget * (1 - Math.exp(-assistRate * dt));

  // --- speed ---------------------------------------------------------------

  let cap = topSpeed;
  if (!sim.onTrack) cap *= cfg.offTrackSpeed;
  if (sim.drifting) cap *= 1 - cfg.driftSpeedLoss;

  const boosting = sim.boostLeft > 0;
  if (boosting) {
    sim.boostLeft -= dt;
    cap = Math.max(cap, sim.boostCap);
    if (sim.boostLeft <= 0) {
      sim.boostLeft = 0;
      sim.boostTier = 0;
      sim.boostCooldown = 1.5;
    }
  } else if (sim.boostCooldown > 0) {
    sim.boostCooldown = Math.max(0, sim.boostCooldown - dt);
  }

  const accel = topSpeed / cfg.timeToTop;
  if (sim.speed < cap) {
    sim.speed = Math.min(cap, sim.speed + accel * (boosting ? cfg.boostAccelMul : 1) * dt);
  } else if (sim.speed > cap) {
    const decay = sim.boostCooldown > 0 ? cfg.boostDecay : cfg.speedDecay;
    sim.speed = Math.max(cap, sim.speed - decay * dt);
  }

  // --- travel direction chases heading -------------------------------------

  const gripRate = sim.drifting ? cfg.driftGrip : cfg.grip;
  sim.velDir += angleDelta(sim.heading, sim.velDir) * (1 - Math.exp(-gripRate * dt));

  if (sim.drifting && sim.speed > 1) {
    // The outward push. This is what makes holding a drift cost something:
    // the longer it runs, the wider the line goes.
    const angular = cfg.driftSlide / Math.max(sim.speed, 20);
    sim.velDir -= sim.driftDir * angular * dt;
  }

  const slipNow = angleDelta(sim.heading, sim.velDir);
  const maxSlip = cfg.maxSlip * DEG;
  if (Math.abs(slipNow) > maxSlip) sim.velDir = sim.heading - Math.sign(slipNow) * maxSlip;
  sim.slip = angleDelta(sim.heading, sim.velDir);

  // --- integrate -----------------------------------------------------------

  sim.x += forwardX(sim.velDir) * sim.speed * dt;
  sim.z += forwardZ(sim.velDir) * sim.speed * dt;

  const prevS = sim.s;
  const loc = locate(track, sim.x, sim.z, sim.index);
  sim.index = loc.index;
  sim.s = loc.s;
  sim.lateral = loc.lateral;
  sim.onTrack = Math.abs(loc.lateral) <= track.halfWidth;
  if (!sim.onTrack) sim.stats.offTrackTime += dt;

  // --- barriers ------------------------------------------------------------

  const limit = track.halfWidth + track.shoulder;
  if (Math.abs(sim.lateral) < limit - 0.5) sim.onWall = false;
  if (Math.abs(sim.lateral) > limit) {
    const side = Math.sign(sim.lateral);
    const over = Math.abs(sim.lateral) - limit;
    const h = track.hs[sim.index];
    sim.x -= side * rightX(h) * over;
    sim.z -= side * rightZ(h) * over;
    sim.lateral = side * limit;
    sim.speed *= 1 - cfg.wallLoss;
    // Scrape along the wall rather than bouncing off it.
    sim.heading += angleDelta(h, sim.heading) * 0.5;
    sim.velDir += angleDelta(h, sim.velDir) * 0.5;
    if (!sim.onWall) {
      sim.stats.wallHits++;
      sim.events.push({ type: 'wall', t: sim.time });
    }
    sim.onWall = true;
    endDrift(sim, false);
  }

  // --- lap timing ----------------------------------------------------------

  if (prevS > track.length * 0.75 && sim.s < track.length * 0.25) {
    sim.lap++;
    if (sim.lap > 1) {
      sim.lastLap = sim.lapTime;
      if (!sim.bestLap || sim.lapTime < sim.bestLap) sim.bestLap = sim.lapTime;
    }
    sim.lapTime = 0;
  } else if (prevS < track.length * 0.25 && sim.s > track.length * 0.75) {
    sim.lap = Math.max(0, sim.lap - 1);
  }

  // --- recovery ------------------------------------------------------------

  // Drifting is a deliberate state, so pointing away from the track tangent
  // does not count as stuck while it lasts — otherwise a long drift through a
  // tight corner can be cancelled, and its charge lost, by the recovery
  // heuristic. Crawling still counts.
  const facingWrong = !sim.drifting && Math.abs(headingErr) > cfg.stuckAngle * DEG;
  const crawling = sim.speed < cfg.stuckSpeed * topSpeed;
  if (!sim.recovering && (crawling || facingWrong)) {
    sim.stuckFor += dt;
    if (sim.stuckFor > cfg.stuckTime) {
      sim.recovering = true;
      sim.recoverLeft = cfg.recoverTime;
      sim.recoverElapsed = 0;
      sim.stuckFor = 0;
      sim.stats.recoveries++;
      endDrift(sim, false);
      sim.events.push({ type: 'recover', t: sim.time });
    }
  } else if (!sim.recovering) {
    sim.stuckFor = Math.max(0, sim.stuckFor - dt);
  }

  if (sim.recovering) {
    sim.recoverLeft -= dt;
    sim.recoverElapsed += dt;
    // Hand back a car that is actually on the road. Recovery may run past its
    // nominal duration to finish the job, but never indefinitely.
    const done = sim.recoverLeft <= 0 && (sim.onTrack || sim.recoverElapsed > cfg.recoverTime * 3);
    if (done) { sim.recovering = false; sim.recoverElapsed = 0; }
  }

  return sim;
}
