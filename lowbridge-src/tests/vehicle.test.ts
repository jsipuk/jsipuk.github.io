import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { VehicleState, VehicleWorld } from '../src/rules/vehicle.ts';
import { NO_CONTROLS, VAN, stepVehicle } from '../src/rules/vehicle.ts';

const STEP = 1 / 60;
const open: VehicleWorld = { blocked: () => false, onPavement: () => false, nearPoi: false };
const van = (over: Partial<VehicleState> = {}): VehicleState => ({
  x: 0, y: 0, heading: 0, speed: 0, steer: 0, contact: false, ...over,
});
const run = (v: VehicleState, seconds: number, c = NO_CONTROLS, world = open) => {
  let bumps = 0;
  for (let t = 0; t < seconds; t += STEP) if (stepVehicle(VAN, v, c, STEP, world).bump > 0) bumps++;
  return bumps;
};

test('throttle reaches top speed and releasing rolls to a stop', () => {
  const v = van();
  run(v, 2, { throttle: 1, steer: 0, brake: false });
  assert.equal(v.speed, VAN.maxForward);
  const x = v.x;
  run(v, 3);
  assert.equal(v.speed, 0);
  const rolled = v.x - x;
  assert.ok(rolled > 35 && rolled < 90, `coasted ${rolled.toFixed(0)}px`);
});

test('brake stops quickly, then the same control reverses', () => {
  const v = van({ speed: VAN.maxForward });
  const x = v.x;
  let t = 0;
  while (v.speed > 0) {
    stepVehicle(VAN, v, { throttle: 0, steer: 0, brake: true }, STEP, open);
    t += STEP;
  }
  assert.ok(v.x - x < 30, `stopping distance ${(v.x - x).toFixed(1)}px`);
  assert.ok(t < 0.4);
  run(v, 1, { throttle: 0, steer: 0, brake: true });
  assert.equal(v.speed, -VAN.maxReverse);
});

test('a stationary van does not turn on the spot', () => {
  const v = van();
  run(v, 1, { throttle: 0, steer: 1, brake: false });
  assert.equal(v.heading, 0);
});

test('turning circle widens with speed', () => {
  const slow = van({ speed: 40, steer: 1 });
  const fast = van({ speed: 150, steer: 1 });
  stepVehicle(VAN, slow, { throttle: 40 / 150, steer: 1, brake: false }, STEP, open);
  stepVehicle(VAN, fast, { throttle: 1, steer: 1, brake: false }, STEP, open);
  const radius = (v: VehicleState) => v.speed / (v.heading / STEP);
  assert.ok(radius(fast) > radius(slow) * 1.5);
});

test('hitting a wall stops the van and counts one bump', () => {
  const wall: VehicleWorld = { ...open, blocked: (p) => p.x > 100 };
  const v = van();
  const bumps = run(v, 3, { throttle: 1, steer: 0, brake: false }, wall);
  assert.equal(bumps, 1);
  assert.ok(v.x + VAN.halfLength <= 100);
  assert.ok(Math.abs(v.speed) < 20);
});

test('the pavement slows the van to a crawl', () => {
  const kerb: VehicleWorld = { ...open, onPavement: () => true };
  const v = van({ speed: VAN.maxForward });
  run(v, 1, { throttle: 1, steer: 0, brake: false }, kerb);
  assert.equal(v.speed, VAN.pavementMax);
});
