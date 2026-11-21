import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildM0Map, Surface, surfaceAt } from '../src/rules/map.ts';
import { NO_INPUT } from '../src/rules/controls.ts';
import { createClock, framesToSteps, resetClock } from '../src/rules/clock.ts';
import {
  availableAction,
  createSession,
  interact,
  objective,
  pause,
  resume,
  stepSession,
} from '../src/rules/session.ts';
import { STEP, driveLap, walkTo } from './helpers.ts';

const fresh = (preset: 'pad' | 'wheel' = 'pad') => createSession(buildM0Map(), preset);

test('spawn: on the pavement, van outside the depot, phone ringing', () => {
  const s = fresh();
  assert.equal(s.locomotion, 'foot');
  assert.equal(surfaceAt(s.map, s.player.x, s.player.y), Surface.Pavement);
  assert.equal(surfaceAt(s.map, s.van.x, s.van.y), Surface.Yard);
  assert.equal(s.phoneRinging, true);
  assert.equal(objective(s).text, 'Walk to the van');
});

test('fixture nodes sit on road tiles', () => {
  const map = buildM0Map();
  for (const [id, p] of Object.entries(map.nodes)) {
    assert.equal(surfaceAt(map, p.x, p.y), Surface.Road, id);
  }
});

test('walking to the phone offers Answer, with a captioned call and no lap logged', () => {
  const s = fresh();
  walkTo(s, { x: 92, y: 562 });
  const action = availableAction(s);
  assert.equal(action.kind, 'answer');
  assert.equal(action.verb, 'Answer');
  const events = interact(s);
  assert.equal(s.mode, 'dialogue');
  assert.equal(s.phoneRinging, false);
  assert.ok(events.some((e) => e.type === 'answer' && e.line.speaker === 'Mo Vale'));
  assert.equal(s.log.length, 0);
  assert.deepEqual(stepSession(s, { ...NO_INPUT, padX: 1 }, STEP), [], 'dialogue holds the world still');
  assert.equal(availableAction(s).verb, 'Hang up');
  interact(s);
  assert.equal(s.mode, 'world');
});

test('Get in appears only beside the van', () => {
  const s = fresh();
  assert.equal(availableAction(s).kind, null);
  walkTo(s, { x: 76, y: 664 });
  assert.equal(availableAction(s).kind, 'enter');
  interact(s);
  assert.equal(s.locomotion, 'van');
  assert.equal(objective(s).text, 'Drive round the block by Ticket Street');
});

test('cannot get out while moving; can once stopped', () => {
  const s = fresh();
  walkTo(s, { x: 76, y: 664 });
  interact(s);
  for (let t = 0; t < 0.4; t += STEP) stepSession(s, { ...NO_INPUT, padX: 1 }, STEP);
  const moving = availableAction(s);
  assert.equal(moving.enabled, false);
  assert.equal(moving.reason, 'Stop to get out');
  for (let t = 0; t < 1; t += STEP) stepSession(s, { ...NO_INPUT, brake: s.van.speed > 0 }, STEP);
  assert.equal(availableAction(s).enabled, true);
});

test('walkers cannot pass through buildings or the van', () => {
  const s = fresh();
  walkTo(s, { x: 20, y: 604 }, 5); // west, into the depot wall
  assert.ok(s.player.x > 80, `stopped at the depot wall, x=${s.player.x.toFixed(1)}`);
  const s2 = fresh();
  walkTo(s2, { x: 60, y: 700 }, 5); // into the van
  assert.ok(Math.abs(s2.player.y - 700) > 5 || Math.abs(s2.player.x - 60) > 5);
});

for (const preset of ['pad', 'wheel'] as const) {
  test(`full M0 lap with the ${preset} preset: drive, park, get out on the pavement, answer`, () => {
    const s = fresh(preset);
    walkTo(s, { x: 76, y: 664 });
    interact(s);
    const events = driveLap(s, preset);
    assert.ok(events.some((e) => e.type === 'lap'), 'passed Ticket Street');
    assert.equal(s.run.parked, true, `parked; van at ${s.van.x.toFixed(0)},${s.van.y.toFixed(0)}`);
    assert.equal(objective(s).text, 'Parked. Get out');
    const bumps = events.filter((e) => e.type === 'bump').length;
    assert.equal(bumps, 0, 'the scripted lap is clean');

    interact(s);
    assert.equal(s.locomotion, 'foot');
    assert.equal(surfaceAt(s.map, s.player.x, s.player.y), Surface.Pavement, 'stepped out onto the pavement');
    assert.equal(s.phoneRinging, true);
    assert.equal(objective(s).text, 'Answer the phone');

    walkTo(s, { x: 100, y: 562 });
    assert.equal(availableAction(s).kind, 'answer');
    const answered = interact(s);
    const logged = answered.find((e) => e.type === 'logged');
    assert.ok(logged && logged.type === 'logged');
    assert.equal(logged.record.preset, preset);
    assert.ok(logged.record.lapSeconds > 8 && logged.record.lapSeconds < 60, `${logged.record.lapSeconds}s`);
    interact(s); // hang up
    assert.equal(objective(s).text, 'Lap 2 · get back in the van');
  });
}

test('parking before the lap does not count', () => {
  const s = fresh();
  walkTo(s, { x: 76, y: 664 });
  interact(s);
  s.van.x = 128;
  s.van.y = 568;
  s.van.heading = -Math.PI / 2;
  for (let t = 0; t < 1; t += STEP) stepSession(s, NO_INPUT, STEP);
  assert.equal(s.run.parked, false);
});

test('pause freezes world time and movement; resume returns to the same state', () => {
  const s = fresh();
  walkTo(s, { x: 76, y: 664 });
  interact(s);
  for (let t = 0; t < 0.5; t += STEP) stepSession(s, { ...NO_INPUT, padX: 1 }, STEP);
  const before = { x: s.van.x, t: s.simTime, speed: s.van.speed };
  pause(s);
  for (let i = 0; i < 120; i++) assert.deepEqual(stepSession(s, { ...NO_INPUT, padX: 1 }, STEP), []);
  assert.deepEqual({ x: s.van.x, t: s.simTime, speed: s.van.speed }, before);
  resume(s);
  assert.equal(s.mode, 'world');
});

test('a long frame or a return from the background never becomes a giant step', () => {
  const clock = createClock();
  assert.equal(framesToSteps(clock, 5), 6, 'five seconds away simulates at most 0.1 s');
  assert.equal(clock.acc, 0);
  assert.equal(framesToSteps(clock, 1 / 60 + 1e-6), 1);
  resetClock(clock);
  assert.equal(clock.acc, 0);
});

test('with no input after an interruption the van stays put', () => {
  const s = fresh();
  walkTo(s, { x: 76, y: 664 });
  interact(s);
  const x = s.van.x;
  for (let t = 0; t < 2; t += STEP) stepSession(s, NO_INPUT, STEP);
  assert.equal(s.van.x, x);
});

test('pad preset: pull the pad back and the van backs up the way the thumb points', () => {
  const s = fresh('pad');
  walkTo(s, { x: 76, y: 664 });
  interact(s);
  // Facing east in the forecourt. Pull the pad west: it should reverse, nose still east.
  const x = s.van.x;
  for (let t = 0; t < 0.4; t += STEP) stepSession(s, { ...NO_INPUT, padX: -1 }, STEP);
  assert.ok(s.van.speed < 0, `reversing at ${s.van.speed.toFixed(1)} px/s`);
  assert.ok(s.van.x < x - 5, 'moved west');
  assert.ok(Math.abs(s.van.heading) < 0.05, 'still facing east');
  // Push east again: it stops reversing and drives forwards.
  for (let t = 0; t < 1; t += STEP) stepSession(s, { ...NO_INPUT, padX: 1 }, STEP);
  assert.ok(s.van.speed > 0);
});
