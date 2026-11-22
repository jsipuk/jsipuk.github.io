import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BEATS, LOST_SITES, PLACES } from '../src/rules/content.ts';
import { NO_INPUT } from '../src/rules/controls.ts';
import { TILE } from '../src/rules/map.ts';
import type { Progress, Result } from '../src/rules/progress.ts';
import {
  acceptQ01,
  advanceQuick,
  cabinetAnswer,
  chooseCloseCrew,
  completeStep,
  deliverBattery,
  dropQuick,
  initialProgress,
  returnSummary,
  startQuick,
  takeCall,
} from '../src/rules/progress.ts';
import { SCHEMA_VERSION, SaveController, checkImport, createMemoryStore, exportSave, freshEnvelope } from '../src/rules/save.ts';
import type { Session } from '../src/rules/session.ts';
import { availableAction, choose, currentStep, openBoard, pause, resume, settled } from '../src/rules/session.ts';
import { STEP, act, harness, relaunch, run, travelTo, walkTo } from './helpers.ts';

const ok = (r: Result): Progress => {
  assert.ok(r.ok, r.ok ? '' : r.reason);
  return r.progress;
};
const delivered = (who: 'mo_vale' | 'nell_price') => ok(deliverBattery(ok(acceptQ01(initialProgress())), who));

for (const [who, first, symbol] of [
  ['mo_vale', 'Q02F', 'waves'],
  ['nell_price', 'Q02M', 'bell'],
] as const) {
  test(`rules: the ${first} branch runs through Q03, Q04 and the close`, () => {
    let p = delivered(who);
    assert.equal(p.shift.lead, first);
    p = ok(takeCall(p));
    assert.deepEqual(p.shift.active, { beat: first, step: 0 });
    p = ok(completeStep(p));
    p = ok(completeStep(p));
    assert.equal(p.shift.active, null);
    assert.equal(p.shift.lead, 'Q03');
    assert.equal(p.shift.branchSymbol, symbol);
    assert.ok(p.journal.includes('address_ticket_office'));
    p = ok(completeStep(ok(completeStep(ok(takeCall(p))))));
    assert.ok(p.flags.includes('maintenance_route'));
    assert.equal(p.shift.lead, 'Q04');
    p = ok(takeCall(p));
    p = ok(completeStep(p)); // relay
    assert.ok(p.cargo.includes('relay'));
    assert.equal(completeStep(p, ['anchor', 'crown']).ok, false, 'wrong symbols buzz');
    assert.deepEqual(cabinetAnswer(p), [symbol, 'three_rings']);
    p = ok(completeStep(p, ['three_rings', symbol]));
    assert.ok(!p.cargo.includes('relay'));
    assert.ok(p.flags.includes('warning_lamp_lit'));
    assert.equal(p.shift.lead, 'SHIFT_01_CLOSE');
    p = ok(completeStep(ok(takeCall(p)))); // watch
    assert.ok(p.sightings.includes('reedling'));
    assert.equal(p.shift.complete, false, 'waits for the crew choice');
    p = ok(chooseCloseCrew(p, 'nell_price'));
    assert.equal(p.shift.complete, true);
    assert.deepEqual(p.shift.done, [first, 'Q03', 'Q04', 'SHIFT_01_CLOSE']);
    assert.ok(p.journal.includes('close_nell'));
    assert.match(returnSummary(p).recall, /Shift one is done/);
    // Trust only moved with the battery.
    assert.deepEqual(p.crews, who === 'mo_vale' ? { ferry: 1, market: -1 } : { ferry: -1, market: 1 });
  });
}

test('rules: one job at a time; quick jobs open after the battery and never move trust', () => {
  assert.equal(startQuick(initialProgress(), 'last_post', 'a').ok, false);
  let p = delivered('mo_vale');
  p = ok(startQuick(p, 'last_post', 'lp-1'));
  assert.equal(takeCall(p).ok, false, 'story call waits');
  p = ok(advanceQuick(p)); // collect mail
  assert.ok(p.cargo.includes('mail'));
  const done = advanceQuick(p, 52.4, false);
  p = ok(done);
  assert.equal(p.quick.bests.quiet, 52.4);
  assert.equal(p.quick.bests.pursuit, null, 'quiet and pursuit runs never compete');
  p = ok(advanceQuick(ok(advanceQuick(ok(startQuick(p, 'last_post', 'lp-2')))), 70, true));
  assert.equal(p.quick.bests.pursuit, 70);
  assert.equal(p.quick.bests.quiet, 52.4);
  assert.deepEqual(p.crews, { ferry: 1, market: -1 });
  p = ok(takeCall(p));
  assert.equal(startQuick(p, 'lost_property', 'x').ok, false, 'quick jobs wait during a story call');
});

test('rules: lost property marks each site once, then goes round again', () => {
  let p = delivered('nell_price');
  const found: string[] = [];
  for (let i = 0; i < 4; i++) {
    p = ok(startQuick(p, 'lost_property', `lp${i}`));
    found.push(p.quick.active!.site!);
    p = ok(advanceQuick(ok(advanceQuick(p))));
  }
  assert.deepEqual(found.slice(0, 3), LOST_SITES.map((s) => s.id));
  assert.deepEqual(p.quick.lostFound, LOST_SITES.map((s) => s.id));
  assert.equal(p.quick.runs, 4);
});

test('rules: dropping a quick job returns its cargo and changes nothing else', () => {
  let p = ok(advanceQuick(ok(startQuick(delivered('mo_vale'), 'last_post', 'x'))));
  p = ok(dropQuick(p));
  assert.equal(p.quick.active, null);
  assert.ok(!p.cargo.includes('mail'));
  assert.equal(p.quick.bests.quiet, null);
});

test('A10: a saved M1 export migrates to the current schema and keeps everything earned', () => {
  const text = readFileSync(new URL('./fixtures/save-v1-mo.json', import.meta.url), 'utf8');
  const c = checkImport(text);
  assert.ok(c.ok);
  assert.equal(c.migratedFrom, 1);
  const p = c.envelope.progress;
  assert.equal(c.envelope.schemaVersion, SCHEMA_VERSION);
  assert.equal(p.recipient, 'mo_vale');
  assert.ok(p.flags.includes('yard_shutter_open'));
  assert.ok(p.roster.includes('clatterjack'));
  assert.equal(p.shift.lead, 'Q02F', 'the next lead survives the migration');
  assert.deepEqual(p.quick.lostFound, []);
});

test('A10: import refuses malformed and newer files; an export round-trips', () => {
  assert.equal(checkImport('not json').ok, false);
  assert.equal(checkImport('{"format":"something-else"}').ok, false);
  const newer = { format: 'lowbridge-save', envelope: { ...freshEnvelope(), schemaVersion: 99 } };
  const n = checkImport(JSON.stringify(newer));
  assert.equal(!n.ok && n.reason, 'newer');
  const broken = structuredClone(freshEnvelope());
  broken.progress.crews.market = 42;
  const b = checkImport(JSON.stringify({ format: 'lowbridge-save', envelope: broken }));
  assert.equal(!b.ok && b.reason, 'invalid');
  const env = { ...freshEnvelope(), revision: 3, progress: delivered('nell_price') };
  const back = checkImport(exportSave(env, 'test'));
  assert.ok(back.ok);
  assert.deepEqual(back.envelope.progress, env.progress);
});

test('A10: a failed import leaves the existing save untouched', async () => {
  const store = createMemoryStore();
  const c = new SaveController(store);
  await c.write(delivered('mo_vale'), null);
  const before = await store.load();
  const result = checkImport('{"format":"lowbridge-save","envelope":{"schemaVersion":2}}');
  assert.equal(result.ok, false);
  assert.deepEqual(await store.load(), before);
});

// ---------------------------------------------------------------- sessions

async function playQ01(s: Session, who: 'mo_vale' | 'nell_price') {
  await walkTo(s, { x: 92, y: 566 });
  await act(s);
  await choose(s, 'ok');
  if (who === 'nell_price') {
    await walkTo(s, { x: 100, y: 470 });
    await walkTo(s, { x: 90, y: 600 });
  }
  await travelTo(s, who === 'mo_vale' ? { x: 208, y: 62 } : { x: 920, y: 62 }, {
    park: who === 'mo_vale' ? { x: 13 * TILE, y: 6 * TILE } : { x: 57 * TILE, y: 6 * TILE },
  });
  await act(s);
  await choose(s, 'give');
  await settled(s);
  run(s, NO_INPUT, 2.2);
  assert.equal(s.prompts[0]?.kind, 'result');
}

async function takeTheCall(s: Session) {
  // From any result or done card, "Take the next call"; then hang up on the caller.
  const pr = s.prompts[0];
  if (pr && pr.choices.some((c) => c.id === 'take' || c.id === 'next')) {
    await choose(s, pr.choices.some((c) => c.id === 'take') ? 'take' : 'next');
  } else {
    openBoard(s);
    await choose(s, 'take');
  }
  await settled(s);
  assert.equal(s.prompts[0]?.kind, 'line', 'caller line');
  await choose(s, 'ok');
}

async function doCurrentStep(s: Session) {
  const step = currentStep(s)!;
  const parks: Record<string, { x: number; y: number }> = {
    meet_mo: { x: 13 * TILE, y: 6 * TILE },
    meet_nell: { x: 57 * TILE, y: 6 * TILE },
    counter: { x: 378, y: 506 },
    relay: { x: 132, y: 600 },
    cabinet: { x: 432, y: 370 },
    watch: { x: 640, y: 96 },
  };
  await travelTo(s, { x: step.at.x, y: step.at.y + (step.id === 'cabinet' ? 22 : step.at.y < 70 ? 18 : -14) }, { park: parks[step.id] });
  const a = availableAction(s);
  assert.equal(a.kind, 'step', `at ${step.id}: ${a.verb} ${Math.round(s.player.x)},${Math.round(s.player.y)}`);
  await act(s);
  while (s.prompts[0]?.kind === 'line') await choose(s, 'ok');
}

async function solveCabinet(s: Session, symbol: string) {
  assert.equal(s.prompts[0].kind, 'puzzle');
  await choose(s, 'sym:anchor');
  await choose(s, 'sym:crown');
  assert.equal(s.prompts[0].kind, 'puzzle', 'wrong pair: try again');
  await choose(s, `sym:${symbol}`);
  await choose(s, 'sym:three_rings');
  await settled(s);
}

/** The whole shift, optionally relaunching from the store between beats (a split run). */
async function playShift(who: 'mo_vale' | 'nell_price', split: boolean) {
  const store = createMemoryStore();
  let h = harness(store);
  const next = async () => {
    if (!split) return;
    await settled(h.s);
    h = await relaunch(store);
  };
  await playQ01(h.s, who);
  await choose(h.s, 'park');
  await next();
  const first = who === 'mo_vale' ? 'Q02F' : 'Q02M';
  for (const beat of [first, 'Q03', 'Q04', 'SHIFT_01_CLOSE'] as const) {
    if (split) {
      openBoard(h.s);
      await choose(h.s, 'take');
      await settled(h.s);
      await choose(h.s, 'ok');
    } else {
      await takeTheCall(h.s);
    }
    assert.equal(h.s.progress.shift.active?.beat, beat);
    while (currentStep(h.s)) {
      const step = currentStep(h.s)!;
      await doCurrentStep(h.s);
      if (step.kind === 'puzzle') await solveCabinet(h.s, who === 'mo_vale' ? 'waves' : 'bell');
      if (step.kind === 'watch') break;
    }
    if (beat === 'SHIFT_01_CLOSE') {
      assert.equal(h.s.prompts[0]?.kind, 'cutscene');
      await choose(h.s, 'log');
      await choose(h.s, 'first:mo_vale');
      await settled(h.s);
    }
    if (split && beat !== 'SHIFT_01_CLOSE') {
      while (h.s.prompts.length) await choose(h.s, 'close');
      await next();
    }
  }
  return h.s.progress;
}

const comparable = (p: Progress) => {
  const c = structuredClone(p) as Progress & { quick: { active: null } };
  c.completed = c.completed.map((r) => ({ ...r, instance: '' }));
  c.story.instance = '';
  return c;
};

test('A09: the Mo branch, played straight through, reaches the close', async () => {
  const p = await playShift('mo_vale', false);
  assert.equal(p.shift.complete, true);
  assert.equal(p.shift.closeChoice, 'mo_vale');
  assert.ok(p.sightings.includes('reedling'));
});

test('A09: the Nell branch, split over five sessions, earns the same as straight through', async () => {
  const straight = await playShift('nell_price', false);
  const split = await playShift('nell_price', true);
  assert.equal(split.shift.complete, true);
  assert.deepEqual(comparable(split), comparable(straight));
});

test('A08: park after Q01, relaunch, do a quick job between story calls, then take the right call', async () => {
  const store = createMemoryStore();
  const h = harness(store);
  await playQ01(h.s, 'nell_price');
  await choose(h.s, 'park');
  await settled(h.s);
  const again = await relaunch(store);
  const s = again.s;
  assert.equal(s.progress.shift.lead, 'Q02M');
  openBoard(s);
  await choose(s, 'quick:lost_property');
  assert.equal(s.progress.quick.active?.site, 'glove');
  const site = LOST_SITES[0].at;
  await travelTo(s, { x: site.x, y: site.y + 10 }, { park: { x: 54 * TILE, y: 6.5 * TILE } });
  assert.equal(availableAction(s).kind, 'quick');
  await act(s);
  await travelTo(s, { x: PLACES.switchboard.x, y: PLACES.switchboard.y }, { park: { x: 132, y: 600 } });
  await act(s);
  assert.equal(s.prompts[0]?.kind, 'quick_result');
  assert.deepEqual(s.progress.quick.lostFound, ['glove']);
  assert.deepEqual(s.progress.crews, { ferry: -1, market: 1 }, 'no story trust from a quick job');
  await choose(s, 'board');
  await choose(s, 'take');
  await settled(s);
  assert.equal(s.prompts[0]?.line?.speaker, 'Nell Price', 'correct caller');
  assert.equal(s.progress.shift.active?.beat, 'Q02M');
});

test('A16: Last post with the express car counts as a chase even after heat clears; pauses do not count', async () => {
  const h = harness();
  const s = h.s;
  await playQ01(s, 'mo_vale');
  await choose(s, 'board');
  await choose(s, 'quick:last_post');
  await travelTo(s, PLACES.switchboard, { park: { x: 132, y: 600 } });
  await act(s); // collect the mail: clock starts
  assert.ok(s.progress.cargo.includes('mail'));
  const t0 = s.quickElapsed;
  pause(s);
  run(s, NO_INPUT, 3);
  resume(s);
  assert.equal(s.quickElapsed, t0, 'paused time is not scored');
  // Heat during the run, cleared before posting.
  s.pursuit = { ...((await import('../src/rules/pursuit.ts')).startPursuit(s.map)) };
  run(s, NO_INPUT, STEP * 2);
  s.pursuit = null;
  await travelTo(s, { x: PLACES.postBox.x, y: PLACES.postBox.y + 14 }, { park: { x: 16 * TILE, y: 6 * TILE } });
  assert.equal(availableAction(s).kind, 'quick');
  await act(s);
  assert.equal(s.prompts[0]?.kind, 'quick_result');
  assert.ok(s.progress.quick.bests.pursuit !== null);
  assert.equal(s.progress.quick.bests.quiet, null, 'quiet record untouched');
});

void BEATS;
