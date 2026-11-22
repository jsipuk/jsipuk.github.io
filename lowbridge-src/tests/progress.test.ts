import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Progress, Result } from '../src/rules/progress.ts';
import {
  acceptQ01,
  deliverBattery,
  encounterAct,
  hearCounteroffer,
  initialProgress,
  liftShutter,
  returnSummary,
  startEncounter,
} from '../src/rules/progress.ts';

const ok = (r: Result): Progress => {
  assert.ok(r.ok, r.ok ? '' : r.reason);
  return r.progress;
};

test('answering puts one battery in custody; answering again changes nothing', () => {
  const p = ok(acceptQ01(initialProgress()));
  assert.equal(p.story.stage, 'carrying');
  assert.deepEqual(p.cargo, ['spare_battery']);
  assert.equal(acceptQ01(p).ok, false);
});

test('Nell’s counteroffer is heard once', () => {
  const p = ok(hearCounteroffer(ok(acceptQ01(initialProgress()))));
  assert.ok(p.flags.includes('counteroffer_heard'));
  assert.equal(hearCounteroffer(p).ok, false);
  assert.equal(hearCounteroffer(initialProgress()).ok, false, 'not before the battery');
});

for (const [who, crew, other, flag, next] of [
  ['mo_vale', 'ferry', 'market', 'ferry_running', 'Q02F'],
  ['nell_price', 'market', 'ferry', 'market_lit', 'Q02M'],
] as const) {
  test(`handover to ${who}: cargo, recipient, both trust changes, street flag, next job and receipt together`, () => {
    const carrying = ok(hearCounteroffer(ok(acceptQ01(initialProgress()))));
    const p = ok(deliverBattery(carrying, who));
    assert.deepEqual(p.cargo, []);
    assert.equal(p.recipient, who);
    assert.equal(p.crews[crew], 1);
    assert.equal(p.crews[other], -1);
    assert.ok(p.flags.includes(flag));
    assert.equal(p.story.stage, 'delivered');
    assert.equal(p.story.nextJob, next);
    assert.equal(p.completed.length, 1);
    assert.equal(p.completed[0].group, 'Q01_battery_handover');
    // One battery, one outcome.
    assert.equal(deliverBattery(p, who).ok, false);
    assert.equal(deliverBattery(p, who === 'mo_vale' ? 'nell_price' : 'mo_vale').ok, false);
    assert.match(returnSummary(p).recall, who === 'mo_vale' ? /gave Mo the battery/ : /gave Nell the battery/);
  });
}

test('trust stays within -2..+3', () => {
  const p = ok(acceptQ01(initialProgress()));
  p.crews = { ferry: 3, market: -2 };
  const q = ok(deliverBattery(p, 'mo_vale'));
  assert.deepEqual(q.crews, { ferry: 3, market: -2 });
});

test('encounter: early washer bounces back and costs a turn; Dim calms; washer recruits once', () => {
  let p = ok(startEncounter(initialProgress()));
  assert.deepEqual(p.encounter, { id: 'ticket_crab', turn: 0, pose: 'raised_claws' });
  p = ok(encounterAct(p, 'offer_washer'));
  assert.equal(p.encounter!.turn, 1);
  assert.equal(p.encounter!.pose, 'raised_claws');
  assert.ok(p.items.includes('washer'), 'washer stays available');
  p = ok(encounterAct(p, 'dim'));
  assert.equal(p.encounter!.pose, 'claws_lowered');
  // Leave on the calm turn and resume later: same turn and pose.
  const resumed = ok(startEncounter(p));
  assert.deepEqual(resumed.encounter, p.encounter);
  p = ok(encounterAct(resumed, 'offer_washer'));
  assert.equal(p.encounter, null);
  assert.deepEqual(p.roster, ['wickwing', 'clatterjack']);
  assert.deepEqual(p.team, ['wickwing', 'clatterjack']);
  assert.deepEqual(p.guide.clatterjack, ['recruited']);
  assert.equal(startEncounter(p).ok, false, 'recruited exactly once');
});

test('a full team sends the recruit to the depot roster', () => {
  let p = initialProgress();
  p.team = ['wickwing', 'wickwing'] as never;
  p = ok(startEncounter(p));
  p = ok(encounterAct(ok(encounterAct(p, 'dim')), 'offer_washer'));
  assert.ok(p.roster.includes('clatterjack'));
  assert.ok(!p.team.includes('clatterjack'));
});

test('the shutter needs Clatterjack and stays open', () => {
  assert.equal(liftShutter(initialProgress()).ok, false);
  let p = ok(startEncounter(initialProgress()));
  p = ok(encounterAct(ok(encounterAct(p, 'dim')), 'offer_washer'));
  p = ok(liftShutter(p));
  assert.ok(p.flags.includes('yard_shutter_open'));
  assert.deepEqual(p.guide.clatterjack, ['recruited', 'field_use']);
  assert.equal(liftShutter(p).ok, false);
});
