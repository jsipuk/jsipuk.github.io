// Vehicle and walker movement. Both steering presets feed the same
// VehicleControls into the same physics, so a preset only changes how
// thumbs and keys become throttle, brake and steer.

import type { Vec } from './math.ts';
import { boxOutline, clamp } from './math.ts';

export interface VehicleSpec {
  id: string;
  halfLength: number;
  halfWidth: number;
  /** px per second */
  maxForward: number;
  maxReverse: number;
  pavementMax: number;
  /** px per second squared */
  accel: number;
  reverseAccel: number;
  brakeDecel: number;
  coastDecel: number;
  /** Stronger rolling drag near points of interest, so the van settles where you mean to stop. */
  poiCoastDecel: number;
  /** Turning radius in px grows with speed: minRadius + radiusPerSpeed * |speed|. */
  minRadius: number;
  radiusPerSpeed: number;
  maxYawRate: number;
  /** How fast the wheels follow the steering input, in full-lock units per second. */
  steerRate: number;
  /** Highest speed at which the driver can get out. */
  exitSpeed: number;
}

export const VAN: VehicleSpec = {
  id: 'courier_van',
  halfLength: 15,
  halfWidth: 8.5,
  maxForward: 150,
  maxReverse: 55,
  pavementMax: 80,
  accel: 200,
  reverseAccel: 150,
  brakeDecel: 460,
  coastDecel: 115,
  poiCoastDecel: 240,
  minRadius: 24,
  radiusPerSpeed: 0.26,
  maxYawRate: 3,
  steerRate: 7,
  exitSpeed: 14,
};

export interface VehicleState {
  x: number;
  y: number;
  heading: number;
  /** Signed speed along the heading. Negative is reversing. */
  speed: number;
  /** Current wheel angle, -1..1. Positive turns clockwise on screen. */
  steer: number;
  /** True while touching an obstacle; used so one hit counts as one bump. */
  contact: boolean;
}

export interface VehicleControls {
  throttle: number;
  steer: number;
  brake: boolean;
}

export const NO_CONTROLS: VehicleControls = { throttle: 0, steer: 0, brake: false };

export interface VehicleWorld {
  blocked(p: Vec): boolean;
  onPavement(p: Vec): boolean;
  nearPoi: boolean;
}

export interface VehicleStepResult {
  /** Impact speed in px/s when this step starts a collision, otherwise 0. */
  bump: number;
}

const STOP_EPS = 4;

export function stepVehicle(
  spec: VehicleSpec,
  v: VehicleState,
  c: VehicleControls,
  dt: number,
  world: VehicleWorld,
): VehicleStepResult {
  const cap = world.onPavement(v) ? spec.pavementMax : spec.maxForward;
  const coast = world.nearPoi ? spec.poiCoastDecel : spec.coastDecel;
  const throttle = clamp(c.throttle, 0, 1);
  let speed = v.speed;

  if (c.brake) {
    if (speed > STOP_EPS) speed = Math.max(0, speed - spec.brakeDecel * dt);
    else speed = Math.max(-spec.maxReverse, speed - spec.reverseAccel * dt);
  } else if (throttle > 0.01) {
    if (speed < -STOP_EPS) {
      speed = Math.min(0, speed + spec.brakeDecel * dt);
    } else {
      const target = cap * throttle;
      speed = speed < target ? Math.min(target, speed + spec.accel * dt) : Math.max(target, speed - coast * dt);
    }
  } else if (speed > 0) {
    speed = Math.max(0, speed - coast * dt);
  } else if (speed < 0) {
    speed = Math.min(0, speed + coast * dt);
  }
  // Mounting the pavement drags the van down to a crawl.
  if (speed > cap) speed = Math.max(cap, speed - 300 * dt);

  const steerTarget = clamp(c.steer, -1, 1);
  const steer = v.steer + clamp(steerTarget - v.steer, -spec.steerRate * dt, spec.steerRate * dt);
  const radius = spec.minRadius + spec.radiusPerSpeed * Math.abs(speed);
  const yaw = clamp((speed / radius) * steer, -spec.maxYawRate, spec.maxYawRate);

  const nh = v.heading + yaw * dt;
  const nx = v.x + Math.cos(nh) * speed * dt;
  const ny = v.y + Math.sin(nh) * speed * dt;
  const hits = (x: number, y: number, h: number) =>
    boxOutline(x, y, h, spec.halfLength, spec.halfWidth).some((p) => world.blocked(p));

  v.steer = steer;
  let bump = 0;
  if (!hits(nx, ny, nh)) {
    v.x = nx;
    v.y = ny;
    v.heading = nh;
    v.speed = speed;
    v.contact = false;
    return { bump };
  }

  // Blocked: try to slide along the obstacle before giving up.
  const intended = Math.abs(speed * dt);
  const candidates: [number, number, number][] = [
    [nx, v.y, nh],
    [v.x, ny, nh],
    [nx, v.y, v.heading],
    [v.x, ny, v.heading],
    [v.x, v.y, nh],
  ];
  let moved = 0;
  let found = false;
  for (const [x, y, h] of candidates) {
    if (!hits(x, y, h)) {
      moved = Math.hypot(x - v.x, y - v.y);
      v.x = x;
      v.y = y;
      v.heading = h;
      found = true;
      break;
    }
  }
  const hard = !found || moved < intended * 0.35;
  if (hard) {
    if (!v.contact && Math.abs(speed) > 30) bump = Math.abs(speed);
    // A light bounce reads as a bump without throwing the van around.
    speed = Math.abs(speed) > 30 ? -Math.sign(speed) * Math.min(Math.abs(speed) * 0.2, 18) : 0;
  } else {
    if (!v.contact && Math.abs(speed) > 70) bump = Math.abs(speed) * 0.5;
    speed *= 0.9;
  }
  v.speed = speed;
  v.contact = true;
  return { bump };
}

// ---------------------------------------------------------------- on foot

export const WALKER = { radius: 5, speed: 72 };

export interface WalkerState {
  x: number;
  y: number;
  facing: number;
}

function circleBlocked(x: number, y: number, r: number, blocked: (p: Vec) => boolean): boolean {
  if (blocked({ x, y })) return true;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    if (blocked({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r })) return true;
  }
  return false;
}

/** Screen-relative walking with wall sliding. `move` has magnitude 0..1. */
export function stepWalker(w: WalkerState, move: Vec, dt: number, blocked: (p: Vec) => boolean): void {
  const mag = Math.hypot(move.x, move.y);
  if (mag < 0.001) return;
  const scale = Math.min(mag, 1) / mag;
  const dx = move.x * scale * WALKER.speed * dt;
  const dy = move.y * scale * WALKER.speed * dt;
  w.facing = Math.atan2(move.y, move.x);
  if (!circleBlocked(w.x + dx, w.y, WALKER.radius, blocked)) w.x += dx;
  if (!circleBlocked(w.x, w.y + dy, WALKER.radius, blocked)) w.y += dy;
}

export const walkerFits = (p: Vec, blocked: (p: Vec) => boolean): boolean =>
  !circleBlocked(p.x, p.y, WALKER.radius, blocked);
