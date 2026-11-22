import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NO_INPUT, padVector, vehicleControls } from '../src/rules/controls.ts';

const NORTH = -Math.PI / 2;

test('pad pushed straight ahead drives straight', () => {
  const c = vehicleControls({ ...NO_INPUT, padY: -1 }, 'pad', NORTH);
  assert.equal(c.throttle, 1);
  assert.ok(Math.abs(c.steer) < 1e-9);
  assert.equal(c.brake, false);
});

test('pad pushed right while facing north steers clockwise', () => {
  const c = vehicleControls({ ...NO_INPUT, padX: 1 }, 'pad', NORTH);
  assert.equal(c.steer, 1);
  assert.ok(c.throttle > 0 && c.throttle < 1, 'eases off for a sharp turn');
});

test('pad dead zone springs to a stop', () => {
  assert.deepEqual(padVector({ ...NO_INPUT, padX: 0.1, padY: 0.1 }), { x: 0, y: 0 });
  const c = vehicleControls({ ...NO_INPUT, padX: 0.1 }, 'pad', NORTH);
  assert.equal(c.throttle, 0);
  assert.equal(c.steer, 0);
});

test('pad with brake aims the rear of the van', () => {
  // Facing north, rear points south. Pushing east should swing the rear east:
  // reversing with positive steer turns the nose anticlockwise.
  const c = vehicleControls({ ...NO_INPUT, padX: 1, brake: true }, 'pad', NORTH);
  assert.equal(c.brake, true);
  assert.equal(c.throttle, 0);
  assert.equal(c.steer, 1);
});

test('wheel preset maps buttons directly; down key brakes only in this preset', () => {
  const raw = { ...NO_INPUT, wheelSteer: -1, wheelThrottle: 1, keyDown: true, padY: 1 };
  assert.deepEqual(vehicleControls(raw, 'wheel', 0), { throttle: 1, steer: -1, brake: true });
  const pad = vehicleControls(raw, 'pad', 0);
  assert.equal(pad.brake, false, 'down key is a direction in the pad preset');
});

test('no input produces no movement in either preset', () => {
  for (const preset of ['pad', 'wheel'] as const) {
    const c = vehicleControls(NO_INPUT, preset, 0);
    assert.equal(c.throttle, 0);
    assert.equal(c.steer, 0);
    assert.equal(c.brake, false);
  }
});

test('pad pulled back from a standstill reverses', () => {
  const c = vehicleControls({ ...NO_INPUT, padY: 1 }, 'pad', NORTH, 0);
  assert.equal(c.brake, true, 'brake/reverse engaged');
  assert.equal(c.throttle, 0);
  assert.ok(Math.abs(c.steer) < 1e-9, 'straight back');
});

test('pad pulled back while driving forwards brakes in a straight line first', () => {
  const c = vehicleControls({ ...NO_INPUT, padY: 1, padX: 0.3 }, 'pad', NORTH, 120);
  assert.deepEqual(c, { throttle: 0, steer: 0, brake: true });
});

test('pad to the side drives forwards from a standstill, but keeps reversing once moving back', () => {
  const side = { ...NO_INPUT, padX: 1, padY: 0.25 }; // about 104° off a north-facing van
  assert.equal(vehicleControls(side, 'pad', NORTH, 0).brake, false, 'standstill: drive forwards');
  assert.equal(vehicleControls(side, 'pad', NORTH, -30).brake, true, 'already reversing: stay in reverse');
});

test('steering C: the pad only points, Go drives', () => {
  const ahead = vehicleControls({ ...NO_INPUT, padY: -1 }, 'hybrid', NORTH, 0);
  assert.equal(ahead.throttle, 0, 'no Go, no throttle');
  const right = vehicleControls({ ...NO_INPUT, padX: 1 }, 'hybrid', NORTH, 60);
  assert.deepEqual(right, { throttle: 0, steer: 1, brake: false }, 'steers while rolling');
  const go = vehicleControls({ ...NO_INPUT, goButton: 1 }, 'hybrid', NORTH, 0);
  assert.deepEqual(go, { throttle: 1, steer: 0, brake: false }, 'Go alone drives straight');
  const half = vehicleControls({ ...NO_INPUT, padY: -0.5, goButton: 1 }, 'hybrid', NORTH, 0);
  assert.equal(half.throttle, 1, 'a small push still drives at full Go');
});

test('steering C: Go only drives forwards; pointing behind swings round', () => {
  const behind = vehicleControls({ ...NO_INPUT, padY: 1, padX: 0.1, goButton: 1 }, 'hybrid', NORTH, 0);
  assert.equal(behind.brake, false, 'never reverses on Go');
  assert.ok(behind.throttle > 0 && behind.throttle < 1, 'eases off to turn round');
  assert.equal(Math.abs(behind.steer), 1);
  const upKey = vehicleControls({ ...NO_INPUT, padY: -1, wheelThrottle: 1 }, 'hybrid', NORTH, 0);
  assert.equal(upKey.throttle, 0, 'the up key points; it is not Go');
});

test('steering C: Brake/Reverse backs up straight, and the pad still sets where the front points', () => {
  const straight = vehicleControls({ ...NO_INPUT, brake: true }, 'hybrid', NORTH, 0);
  assert.deepEqual(straight, { throttle: 0, steer: 0, brake: true });
  // Reversing, facing north, pad points north-east: nose turns right, so steer is negative while going back.
  const turn = vehicleControls({ ...NO_INPUT, brake: true, padX: 0.7, padY: -0.7 }, 'hybrid', NORTH, -30);
  assert.equal(turn.brake, true);
  assert.ok(turn.steer < 0);
});
