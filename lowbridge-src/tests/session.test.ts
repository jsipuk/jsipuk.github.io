import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NO_INPUT } from '../src/rules/controls.ts';
import { TILE, buildRiverside } from '../src/rules/map.ts';
import { createMemoryStore } from '../src/rules/save.ts';
import type { Session } from '../src/rules/session.ts';
import { availableAction, choose, encounterChoose, objective, pause, resume, settled } from '../src/rules/session.ts';
import { STEP, act, driveTo, harness, run, walkTo } from './helpers.ts';

const map = buildRiverside();
const PARK = { mo_vale: { x: 13 * TILE, y: 6 * TILE }, nell_price: { x: 57 * TILE, y: 6 * TILE } };
const NEAR = { mo_vale: { x: 13 * TILE, y: 3.9 * TILE }, nell_price: { x: 57.5 * TILE, y: 3.9 * TILE } };

async function answerAndBoard(s: Session) {
  await walkTo(s, { x: 92, y: 566 });
  assert.equal(availableAction(s).kind, 'answer');
  await act(s);
  assert.equal(s.mode, 'prompt');
  assert.equal(s.prompts[0].line!.speaker, 'Mo Vale');
  await choose(s, 'ok');
  assert.equal(s.mode, 'world');
  assert.deepEqual(s.progress.cargo, ['spare_battery']);
  await walkTo(s, { x: 70, y: 664 });
  assert.equal(availableAction(s).kind, 'enter_van');
  await act(s);
  assert.equal(s.locomotion, 'van');
}

async function handOver(s: Session, who: 'mo_vale' | 'nell_price') {
  await driveTo(s, PARK[who], { stop: 30 });
  await act(s); // get out
  assert.equal(s.locomotion, 'foot');
  await walkTo(s, NEAR[who]);
  const a = availableAction(s);
  assert.equal(a.kind, 'give', `next to ${who}: ${a.verb}`);
  await act(s);
  assert.equal(s.prompts[0].kind, 'confirm');
  assert.match(s.prompts[0].text!, /−1/);
  await choose(s, 'give');
  await settled(s);
}

for (const who of ['mo_vale', 'nell_price'] as const) {
  test(`direct run by the ring road, shutter shut, no recruit: hand the battery to ${who}`, async () => {
    const { s, store } = harness();
    await answerAndBoard(s);
    if (who === 'nell_price') {
      // Nell's radio fires on leaving the depot; drive out first so it lands.
      await driveTo(s, map.nodes.depot_corner, { stop: 40 });
      assert.ok(s.progress.flags.includes('counteroffer_heard'), 'counteroffer heard on departure');
    }
    await handOver(s, who);
    const p = s.progress;
    assert.equal(p.recipient, who);
    assert.ok(p.flags.includes('counteroffer_heard'));
    assert.ok(!p.flags.includes('yard_shutter_open'));
    assert.equal(p.completed.length, 1);
    assert.equal(s.prompts[0].kind, 'result');
    assert.ok(s.handoverAt! < 240, `handover at ${s.handoverAt!.toFixed(0)} s of driving and walking`);
    // The save holds the same outcome.
    const saved = await store.load();
    assert.equal(saved!.progress.recipient, who);
    await choose(s, 'park');
    assert.equal(s.parked, true);
  });
}

test('curious route: recruit Clatterjack, lift the shutter, cut through the yard to Mo', async () => {
  const { s } = harness();
  await answerAndBoard(s);
  await driveTo(s, { x: 21 * TILE, y: 30.5 * TILE }, { stop: 30 });
  await act(s); // out at the ticket office
  await walkTo(s, { x: 326, y: 552 });
  assert.equal(availableAction(s).verb, 'Look closer');
  await act(s);
  assert.equal(s.mode, 'encounter');
  await encounterChoose(s, 'offer_washer'); // too early
  assert.equal(s.progress.encounter!.turn, 1);
  await encounterChoose(s, 'leave');
  assert.equal(s.mode, 'world');
  await act(s); // come back: same settled turn
  assert.equal(s.progress.encounter!.turn, 1);
  await encounterChoose(s, 'dim');
  await encounterChoose(s, 'offer_washer');
  assert.ok(s.progress.roster.includes('clatterjack'));
  assert.equal(s.encounter!.done, true);
  await encounterChoose(s, 'continue');
  // Round the express car parked in the lay-by, across Station Road, up to the shutter.
  await walkTo(s, { x: 314, y: 552 });
  await walkTo(s, { x: 314, y: 500 });
  await walkTo(s, { x: 22 * TILE, y: 27.6 * TILE });
  assert.equal(availableAction(s).kind, 'lift');
  await act(s);
  assert.ok(s.progress.flags.includes('yard_shutter_open'));
  await walkTo(s, { x: 330, y: 506 });
  await walkTo(s, { x: s.van.x + 6, y: s.van.y - 16 }, 60);
  assert.equal(availableAction(s).kind, 'enter_van');
  await act(s);
  // The arrow now routes through the yard.
  await handOver(s, 'mo_vale');
  assert.equal(s.progress.recipient, 'mo_vale');
});

test('double tap on the handover gives one receipt and one trust award', async () => {
  const { s } = harness();
  await answerAndBoard(s);
  await handOver(s, 'mo_vale');
  // A second confirm arriving late is refused by the receipt.
  s.prompts.unshift({ kind: 'confirm', recipient: 'mo_vale', choices: [] });
  s.mode = 'prompt';
  await Promise.all([choose(s, 'give'), choose(s, 'give')]);
  assert.equal(s.progress.completed.length, 1);
  assert.deepEqual(s.progress.crews, { ferry: 1, market: -1 });
});

test('a stale second tab cannot give the same battery to the other crew', async () => {
  const store = createMemoryStore();
  const a = harness(store);
  const b = harness(store);
  await answerAndBoard(a.s);
  // Tab B loads the carrying state, then tab A delivers to Mo.
  b.s.progress = structuredClone(a.s.progress);
  b.saves.revision = a.saves.revision;
  b.s.progress.flags.push('counteroffer_heard');
  await handOver(a.s, 'mo_vale');
  b.s.prompts.push({ kind: 'confirm', recipient: 'nell_price', choices: [] });
  b.s.mode = 'prompt';
  await choose(b.s, 'give');
  assert.equal(b.s.progress.recipient, 'mo_vale', 'stale tab refreshed to the committed outcome');
  const saved = await store.load();
  assert.equal(saved!.progress.completed.length, 1);
  assert.equal(saved!.progress.recipient, 'mo_vale');
});

test('storage failure: the handover waits, nothing changes hands, retry commits it', async () => {
  const { s, store } = harness(createMemoryStore());
  await answerAndBoard(s);
  await driveTo(s, PARK.mo_vale, { stop: 30 });
  await act(s);
  await walkTo(s, NEAR.mo_vale);
  store.failWrites = true;
  await act(s);
  await choose(s, 'give');
  assert.equal(s.prompts[0].kind, 'save_failed');
  assert.deepEqual(s.progress.cargo, ['spare_battery']);
  assert.equal(s.progress.recipient, null);
  store.failWrites = false;
  await choose(s, 'retry');
  await settled(s);
  assert.equal(s.progress.recipient, 'mo_vale');
});

test('express car: heat once per taking, handover blocked during heat, caught keeps the battery', async () => {
  const { s } = harness();
  await answerAndBoard(s);
  await act(s); // out of the van in the forecourt
  // Walk to the lay-by and take the express car.
  s.player.x = s.map.expressStart.x - 6;
  s.player.y = s.map.expressStart.y - 18;
  assert.equal(availableAction(s).verb, 'Take the express car');
  await act(s);
  assert.equal(s.locomotion, 'express');
  assert.ok(s.pursuit, 'heat raised');
  assert.equal(objective(s).text.startsWith('Lose the patrol'), true);
  // Pause freezes the chase timers.
  run(s, NO_INPUT, 1);
  const frozen = { ...s.pursuit! };
  pause(s);
  run(s, NO_INPUT, 2);
  assert.equal(s.pursuit!.outOfSight, frozen.outOfSight);
  assert.equal(s.pursuit!.boxed, frozen.boxed);
  resume(s);
  // Sit still and let the patrol box us in.
  let t = 0;
  while (s.pursuit && t < 60) {
    run(s, NO_INPUT, STEP);
    t += STEP;
  }
  assert.equal(s.prompts[0]?.kind, 'caught', `caught after ${t.toFixed(1)} s`);
  await choose(s, 'ok');
  assert.equal(s.locomotion, 'foot');
  assert.deepEqual(s.progress.cargo, ['spare_battery'], 'battery survives');
  assert.equal(s.express.borrowed, false, 'car back in its lay-by');
  assert.ok(Math.hypot(s.player.x - s.map.playerStart.x, s.player.y - s.map.playerStart.y) < 1);
  // Both recipients are still possible: drive to Mo and hand over.
  await walkTo(s, { x: 70, y: 664 });
  await act(s);
  await handOver(s, 'mo_vale');
  assert.equal(s.progress.recipient, 'mo_vale');
});

test('the patrol gives up after six seconds without seeing you', async () => {
  const { s } = harness();
  await answerAndBoard(s);
  await act(s);
  s.player.x = s.map.expressStart.x - 6;
  s.player.y = s.map.expressStart.y - 18;
  await act(s);
  // Gone before it arrives: the car is down by the quay, far out of sight of the lay-by.
  Object.assign(s.express, { x: 13 * TILE, y: 6.5 * TILE, heading: Math.PI, speed: 0 });
  let t = 0;
  while (s.pursuit && t < 40) {
    run(s, NO_INPUT, STEP);
    t += STEP;
  }
  assert.equal(s.pursuit, null, 'heat cleared');
  assert.equal(s.prompts.length, 0, 'not caught');
  // It drove to the report (about 8 s), then searched for 6 s.
  assert.ok(t > 6 && t < 25, `gave up after ${t.toFixed(1)} s`);
});

test('encounter and shutter are blocked while the patrol is on you', async () => {
  const { s } = harness();
  await answerAndBoard(s);
  await act(s);
  s.player.x = s.map.expressStart.x - 6;
  s.player.y = s.map.expressStart.y - 18;
  await act(s); // take the car: heat
  await act(s); // straight back out
  await walkTo(s, { x: 314, y: s.player.y }, 5);
  await walkTo(s, { x: 314, y: 552 }, 5);
  await walkTo(s, { x: 326, y: 552 }, 5);
  const a = availableAction(s);
  assert.equal(a.kind, 'inspect');
  assert.equal(a.enabled, false);
  assert.equal(a.reason, 'Lose the patrol first');
});
