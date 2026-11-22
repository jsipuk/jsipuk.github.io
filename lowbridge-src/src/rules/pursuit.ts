// The patrol: one car that chases while heat is up. Lose line of sight for six
// simulation seconds to clear heat; three continuous seconds boxed in while
// nearly stationary counts as caught. Timers only advance in simulation steps,
// so pausing freezes them.

import type { Vec } from './math.ts';
import { angleDiff, boxOutline, clamp, distanceToBox } from './math.ts';
import type { StreetMap } from './map.ts';
import { Surface, TILE, surfaceAt } from './map.ts';
import type { OpenGates } from './route.ts';
import { nextWaypoint } from './route.ts';
import type { VehicleControls, VehicleSpec, VehicleState } from './vehicle.ts';
import { PATROL, stepVehicle } from './vehicle.ts';

export const ESCAPE_SECONDS = 6;
export const CAUGHT_SECONDS = 3;
/** Night-time sight distance in px (15 tiles). */
export const SIGHT_RANGE = 240;
/** Seconds between the report and the patrol setting off. */
export const RESPONSE_DELAY = 2;
const CONTACT_PX = 6;
const STATIONARY = 15;

export interface Pursuit {
  car: VehicleState;
  /** Where the patrol last saw the courier (at first, where the car was reported taken). */
  lastSeen: Vec;
  /** False while still driving to the report; the escape clock waits until it arrives or sees you. */
  searching: boolean;
  /** Seconds left before it sets off. */
  delay: number;
  /** Continuous seconds out of the patrol's sight. */
  outOfSight: number;
  /** Continuous seconds boxed in while nearly stationary. */
  boxed: number;
  inSight: boolean;
  stuck: number;
  reversing: number;
}

/** What the patrol is chasing this step. */
export interface Quarry {
  pos: Vec;
  speed: number;
  /** The player's vehicle, or null when on foot. */
  box: { spec: VehicleSpec; state: VehicleState } | null;
  walkerRadius: number;
}

export function startPursuit(map: StreetMap, reportedAt: Vec = map.expressStart): Pursuit {
  const s = map.patrolSpawn;
  return {
    car: { x: s.x, y: s.y, heading: s.heading, speed: 0, steer: 0, contact: false },
    lastSeen: { x: reportedAt.x, y: reportedAt.y },
    searching: false,
    delay: RESPONSE_DELAY,
    outOfSight: 0,
    boxed: 0,
    inSight: false,
    stuck: 0,
    reversing: 0,
  };
}

const SIGHT_BLOCKERS = new Set<number>([Surface.Building, Surface.Fence, Surface.Void]);

/** Straight line of sight across the tile map, within range. Water and roads don't block it. */
export function lineOfSight(map: StreetMap, a: Vec, b: Vec, range = SIGHT_RANGE): boolean {
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  if (d > range) return false;
  const steps = Math.max(1, Math.ceil(d / (TILE / 3)));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (SIGHT_BLOCKERS.has(surfaceAt(map, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t))) return false;
  }
  return true;
}

/** Gap in px between the patrol car and the quarry's body. */
export function contactGap(car: VehicleState, q: Quarry): number {
  const outline = boxOutline(car.x, car.y, car.heading, PATROL.halfLength, PATROL.halfWidth);
  if (q.box) {
    const { spec, state } = q.box;
    return Math.min(...outline.map((p) => distanceToBox(p, state.x, state.y, state.heading, spec.halfLength, spec.halfWidth)));
  }
  const toCar = distanceToBox(q.pos, car.x, car.y, car.heading, PATROL.halfLength, PATROL.halfWidth);
  return Math.max(0, toCar - q.walkerRadius);
}

export type PursuitOutcome = 'chasing' | 'escaped' | 'caught';

export function stepPursuit(
  map: StreetMap,
  p: Pursuit,
  q: Quarry,
  dt: number,
  blocked: (pt: Vec) => boolean,
  open: OpenGates,
): PursuitOutcome {
  const car = p.car;
  if (p.delay > 0) {
    p.delay -= dt;
    return 'chasing';
  }
  p.inSight = lineOfSight(map, car, q.pos);
  const d = Math.hypot(q.pos.x - car.x, q.pos.y - car.y);
  if (p.inSight) {
    p.lastSeen = { x: q.pos.x, y: q.pos.y };
    p.searching = true;
  }
  const toLastSeen = Math.hypot(p.lastSeen.x - car.x, p.lastSeen.y - car.y);
  if (toLastSeen < 48) p.searching = true;

  // Drive: straight at the courier when close and visible, otherwise along the
  // roads to where it last saw them. It never knows where you went unseen.
  const aim = p.inSight && d < 180 ? q.pos : nextWaypoint(map, car, p.lastSeen, open);
  const arrived = !p.inSight && toLastSeen < 40;
  const diff = angleDiff(Math.atan2(aim.y - car.y, aim.x - car.x), car.heading);
  let controls: VehicleControls;
  if (p.reversing > 0) {
    p.reversing -= dt;
    controls = { throttle: 0, brake: true, steer: -Math.sign(diff) || 1 };
  } else {
    let throttle = Math.abs(diff) < 0.5 ? 1 : Math.abs(diff) < 1.2 ? 0.6 : 0.35;
    if (d < 50) throttle = Math.min(throttle, 0.45);
    if (arrived) throttle = 0; // Lost you here: sit and look.
    const brake = Math.abs(diff) > 2.0 && car.speed > 50;
    controls = { throttle: brake ? 0 : throttle, brake, steer: clamp(diff / 0.4, -1, 1) };
    // Wedged against something: back off briefly and try again.
    p.stuck = Math.abs(car.speed) < 6 && throttle > 0 && contactGap(car, q) > CONTACT_PX ? p.stuck + dt : 0;
    if (p.stuck > 0.7) {
      p.stuck = 0;
      p.reversing = 0.8;
    }
  }
  stepVehicle(PATROL, car, controls, dt, {
    blocked,
    onPavement: (pt) => surfaceAt(map, pt.x, pt.y) === Surface.Pavement,
    nearPoi: false,
  });

  p.outOfSight = p.inSight || !p.searching ? 0 : p.outOfSight + dt;
  const touching = contactGap(car, q) < CONTACT_PX;
  p.boxed = touching && Math.abs(q.speed) < STATIONARY ? p.boxed + dt : 0;
  if (p.boxed >= CAUGHT_SECONDS) return 'caught';
  if (p.outOfSight >= ESCAPE_SECONDS) return 'escaped';
  return 'chasing';
}
