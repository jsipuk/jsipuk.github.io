// The running world for Riverside Q01: walking, two vehicles, the patrol,
// interactions and prompts. Durable changes go through `transition`, which
// queues them, commits the next Progress through the injected `commit` and
// only then applies it and emits its events. No rendering or DOM here.

import type { CreatureId, Line, PersonId } from './content.ts';
import { CREATURES, LINES, NEXT_JOBS, NOTICE_MACHINE, PEOPLE, RESULT_TEXT, TICKET_CRAB } from './content.ts';
import type { RawInput, SteeringPreset } from './controls.ts';
import { vehicleControls, walkVector } from './controls.ts';
import type { Vec } from './math.ts';
import { distanceToBox, forward, pointInRect, rightOf } from './math.ts';
import type { StreetMap } from './map.ts';
import { Surface, gapToRect, isBlocked, surfaceAt } from './map.ts';
import type { EncounterAction, GameEvent, Progress, Result } from './progress.ts';
import {
  acceptQ01,
  carryingBattery,
  deliverBattery,
  encounterAct,
  handoverConsequence,
  hasFlag,
  hearCounteroffer,
  liftShutter,
  noticeMachine,
  startEncounter,
} from './progress.ts';
import type { Pursuit } from './pursuit.ts';
import { startPursuit, stepPursuit } from './pursuit.ts';
import type { OpenGates } from './route.ts';
import { nextWaypoint, roadDistance } from './route.ts';
import type { Checkpoint } from './save.ts';
import type { VehicleSpec, VehicleState, WalkerState } from './vehicle.ts';
import { EXPRESS, PATROL, VAN, WALKER, stepVehicle, stepWalker, walkerFits } from './vehicle.ts';

export type Mode = 'world' | 'prompt' | 'encounter' | 'paused';
export type Locomotion = 'foot' | 'van' | 'express';
export type CommitOutcome = 'ok' | 'conflict' | 'failed';
export type Commit = (progress: Progress, label: string) => Promise<CommitOutcome>;

export interface Choice {
  id: string;
  label: string;
}

export interface Prompt {
  kind: 'line' | 'confirm' | 'result' | 'caught' | 'save_failed' | 'next_call';
  title?: string;
  text?: string;
  line?: Line;
  choices: Choice[];
  recipient?: PersonId;
}

export type WorldEvent =
  | GameEvent
  | { type: 'enter'; vehicle: 'van' | 'express' }
  | { type: 'exit' }
  | { type: 'bump'; strength: number; at: Vec }
  | { type: 'heat' }
  | { type: 'escaped' }
  | { type: 'caught' }
  | { type: 'parked' }
  | { type: 'save_failed'; label: string }
  | { type: 'checkpoint' };

export interface Session {
  map: StreetMap;
  mode: Mode;
  resumeMode: Exclude<Mode, 'paused'>;
  /** Seconds of active simulation. Pauses, prompts and the encounter do not count. */
  simTime: number;
  preset: SteeringPreset;
  locomotion: Locomotion;
  player: WalkerState;
  van: VehicleState;
  express: VehicleState & { borrowed: boolean };
  progress: Progress;
  pursuit: Pursuit | null;
  prompts: Prompt[];
  /** Captioned radio or street text that does not stop play. */
  caption: { speaker?: string; text: string; until: number } | null;
  encounter: { text: string; done: boolean } | null;
  saveFailed: { label: string; retry: () => Promise<boolean> } | null;
  parked: boolean;
  outbox: WorldEvent[];
  commit: Commit;
  busy: Set<string>;
  queue: Promise<unknown>;
  /** Simulation time of the handover, for the five-minute gate. */
  handoverAt: number | null;
}

export interface Action {
  kind: 'answer' | 'enter_van' | 'enter_express' | 'exit' | 'inspect' | 'lift' | 'give' | 'talk' | null;
  verb: string;
  enabled: boolean;
  reason?: string;
  person?: PersonId;
}

const ENTER_REACH = 14;

// ------------------------------------------------------------------ setup

export function createSession(
  map: StreetMap,
  preset: SteeringPreset,
  progress: Progress,
  commit: Commit,
  checkpoint: Checkpoint | null = null,
): Session {
  const s: Session = {
    map,
    mode: 'world',
    resumeMode: 'world',
    simTime: 0,
    preset,
    locomotion: 'foot',
    player: { x: map.playerStart.x, y: map.playerStart.y, facing: -Math.PI / 2 },
    van: { ...map.vanStart, speed: 0, steer: 0, contact: false },
    express: { ...map.expressStart, speed: 0, steer: 0, contact: false, borrowed: false },
    progress,
    pursuit: null,
    prompts: [],
    caption: null,
    encounter: null,
    saveFailed: null,
    parked: false,
    outbox: [],
    commit,
    busy: new Set(),
    queue: Promise.resolve(),
    handoverAt: null,
  };
  if (checkpoint) restoreCheckpoint(s, checkpoint);
  return s;
}

export function checkpoint(s: Session): Checkpoint {
  const pose = (v: VehicleState) => ({ x: v.x, y: v.y, heading: v.heading });
  return {
    locomotion: s.locomotion,
    player: { x: s.player.x, y: s.player.y, facing: s.player.facing },
    van: pose(s.van),
    express: { ...pose(s.express), borrowed: s.express.borrowed },
    pursuit: s.pursuit !== null,
  };
}

/** Restore positions if they are still valid; otherwise fall back to the depot. */
export function restoreCheckpoint(s: Session, cp: Checkpoint): void {
  const map = s.map;
  const okVehicle = (p: { x: number; y: number }) => !isBlocked(map, p, true) && surfaceAt(map, p.x, p.y) !== Surface.Void;
  if (okVehicle(cp.van)) Object.assign(s.van, cp.van, { speed: 0, steer: 0 });
  if (okVehicle(cp.express)) Object.assign(s.express, cp.express, { speed: 0, steer: 0 });
  s.express.borrowed = cp.express.borrowed;
  if (cp.pursuit) {
    // Authored chase restart: in the express car at the lay-by, patrol on its way.
    Object.assign(s.express, map.expressStart, { speed: 0, steer: 0, borrowed: true });
    s.locomotion = 'express';
    s.pursuit = startPursuit(map);
    return;
  }
  s.locomotion = cp.locomotion;
  if (cp.locomotion === 'foot') {
    const p = { x: cp.player.x, y: cp.player.y };
    if (walkerFits(p, (q) => blockedForWalker(s, q))) Object.assign(s.player, cp.player);
  }
}

// -------------------------------------------------------------- obstacles

export const gates = (p: Progress): OpenGates =>
  new Set(hasFlag(p, 'yard_shutter_open') ? ['yard_shutter_open'] : []);

const shutterOpen = (s: Session) => hasFlag(s.progress, 'yard_shutter_open');

function inVehicleBox(p: Vec, v: VehicleState, spec: VehicleSpec): boolean {
  return distanceToBox(p, v.x, v.y, v.heading, spec.halfLength, spec.halfWidth) === 0;
}

function blockedForWalker(s: Session, p: Vec): boolean {
  if (isBlocked(s.map, p, shutterOpen(s))) return true;
  if (inVehicleBox(p, s.van, VAN) || inVehicleBox(p, s.express, EXPRESS)) return true;
  return s.pursuit !== null && inVehicleBox(p, s.pursuit.car, PATROL);
}

function blockedForVehicle(s: Session, p: Vec, self: 'van' | 'express' | 'patrol'): boolean {
  if (isBlocked(s.map, p, shutterOpen(s))) return true;
  if (self !== 'van' && inVehicleBox(p, s.van, VAN)) return true;
  if (self !== 'express' && inVehicleBox(p, s.express, EXPRESS)) return true;
  return self !== 'patrol' && s.pursuit !== null && inVehicleBox(p, s.pursuit.car, PATROL);
}

export function driving(s: Session): { spec: VehicleSpec; state: VehicleState } | null {
  if (s.locomotion === 'van') return { spec: VAN, state: s.van };
  if (s.locomotion === 'express') return { spec: EXPRESS, state: s.express };
  return null;
}

export function bodyPos(s: Session): Vec {
  const d = driving(s);
  return d ? { x: d.state.x, y: d.state.y } : { x: s.player.x, y: s.player.y };
}

// ------------------------------------------------------------ transitions

/**
 * Queue a durable change. It is computed against the latest progress when its
 * turn comes, committed, and only then applied with its events.
 */
export function transition(
  s: Session,
  label: string,
  fn: (p: Progress) => Result,
  after?: (events: GameEvent[]) => void,
): Promise<boolean> {
  if (s.busy.has(label)) return Promise.resolve(false);
  s.busy.add(label);
  const run = async (): Promise<boolean> => {
    try {
      const r = fn(s.progress);
      if (!r.ok) return false;
      const outcome = await s.commit(r.progress, label);
      if (outcome === 'conflict') return false; // The commit adopted a newer save from another tab.
      if (outcome === 'failed') {
        s.saveFailed = { label, retry: () => transition(s, label, fn, after) };
        s.outbox.push({ type: 'save_failed', label });
        return false;
      }
      s.progress = r.progress;
      s.saveFailed = null;
      s.outbox.push(...r.events);
      after?.(r.events);
      return true;
    } finally {
      s.busy.delete(label);
    }
  };
  const p = s.queue.then(run, run);
  s.queue = p.catch(() => undefined);
  return p;
}

/** Wait for queued transitions (tests and the "Park up" save). */
export const settled = (s: Session): Promise<unknown> => s.queue;

// ---------------------------------------------------------------- actions

function exitPoint(s: Session): Vec | null {
  const d = driving(s);
  if (!d) return null;
  const v = d.state;
  const f = forward(v.heading);
  const r = rightOf(v.heading);
  const side = d.spec.halfWidth + WALKER.radius + 2;
  const end = d.spec.halfLength + WALKER.radius + 2;
  const candidates: Vec[] = [];
  for (const reach of [side, side + 8]) {
    candidates.push({ x: v.x + r.x * reach, y: v.y + r.y * reach });
    candidates.push({ x: v.x - r.x * reach, y: v.y - r.y * reach });
  }
  candidates.push({ x: v.x - f.x * end, y: v.y - f.y * end }, { x: v.x + f.x * end, y: v.y + f.y * end });
  const fits = candidates.filter((p) => walkerFits(p, (q) => blockedForWalker(s, q)));
  const safe = fits.find((p) => {
    const surface = surfaceAt(s.map, p.x, p.y);
    return surface === Surface.Pavement || surface === Surface.Yard;
  });
  return safe ?? fits[0] ?? null;
}

export function availableAction(s: Session): Action {
  if (s.mode !== 'world') return { kind: null, verb: '', enabled: false };
  const d = driving(s);
  if (d) {
    if (Math.abs(d.state.speed) > d.spec.exitSpeed) return { kind: 'exit', verb: 'Get out', enabled: false, reason: 'Stop to get out' };
    if (!exitPoint(s)) return { kind: 'exit', verb: 'Get out', enabled: false, reason: 'No room to get out here' };
    return { kind: 'exit', verb: 'Get out', enabled: true };
  }

  const p = s.player;
  const prog = s.progress;
  const heat = s.pursuit !== null;
  const options: { gap: number; action: Action }[] = [];
  const add = (gap: number, action: Action) => {
    if (gap <= 0) options.push({ gap, action });
  };

  const phone = s.map.phone;
  if (prog.story.stage === 'offered') {
    add(Math.hypot(p.x - phone.x, p.y - phone.y) - phone.reach, { kind: 'answer', verb: 'Answer', enabled: true });
  }
  add(distanceToBox(p, s.van.x, s.van.y, s.van.heading, VAN.halfLength, VAN.halfWidth) - ENTER_REACH, {
    kind: 'enter_van',
    verb: 'Get in the van',
    enabled: true,
  });
  add(distanceToBox(p, s.express.x, s.express.y, s.express.heading, EXPRESS.halfLength, EXPRESS.halfWidth) - ENTER_REACH, {
    kind: 'enter_express',
    verb: s.express.borrowed ? 'Get in the car' : 'Take the express car',
    enabled: true,
  });

  const m = s.map.machine;
  if (!prog.roster.includes('clatterjack')) {
    add(Math.hypot(p.x - m.x, p.y - m.y) - m.reach, {
      kind: 'inspect',
      verb: prog.encounter ? 'Back to the crab' : 'Look closer',
      enabled: !heat,
      reason: heat ? 'Lose the patrol first' : undefined,
    });
  }

  if (!hasFlag(prog, 'yard_shutter_open')) {
    const canLift = prog.team.includes('clatterjack');
    add(gapToRect(p, s.map.shutter.rect) - s.map.shutter.reach, {
      kind: 'lift',
      verb: canLift ? 'Lift shutter' : 'Shutter’s jammed',
      enabled: canLift && !heat,
      reason: !canLift ? 'Strong claws could lift it' : heat ? 'Lose the patrol first' : undefined,
    });
  }

  for (const person of ['mo_vale', 'nell_price'] as const) {
    const at = s.map.people[person];
    const gap = Math.hypot(p.x - at.x, p.y - at.y) - at.reach;
    const short = PEOPLE[person].short;
    const canOffer = person === 'mo_vale' || hasFlag(prog, 'counteroffer_heard');
    if (carryingBattery(prog) && canOffer) {
      const blocked = heat ? 'Lose the patrol first' : s.saveFailed ? 'Progress hasn’t saved' : undefined;
      add(gap, { kind: 'give', verb: `Give battery to ${short}`, enabled: !blocked, reason: blocked, person });
    } else {
      add(gap, { kind: 'talk', verb: `Talk to ${short}`, enabled: true, person });
    }
  }

  options.sort((a, b) => a.gap - b.gap);
  return options[0]?.action ?? { kind: null, verb: '', enabled: false };
}

function prompt(s: Session, pr: Prompt): void {
  s.prompts.push(pr);
  if (s.mode === 'world') s.mode = 'prompt';
  else if (s.mode === 'paused' && s.resumeMode === 'world') s.resumeMode = 'prompt';
}

function closePrompt(s: Session): void {
  s.prompts.shift();
  if (s.prompts.length === 0 && s.mode === 'prompt') s.mode = 'world';
}

function talkLine(s: Session, person: PersonId): Line {
  const prog = s.progress;
  if (prog.story.stage === 'delivered') {
    if (prog.recipient === person) return person === 'mo_vale' ? LINES.moThanked : LINES.nellThanked;
    return person === 'mo_vale' ? LINES.moCold : LINES.nellCold;
  }
  return person === 'mo_vale' ? LINES.moWaiting : LINES.nellWaiting;
}

/** Do whatever the action button says. */
export async function interact(s: Session): Promise<void> {
  const a = availableAction(s);
  if (!a.enabled || !a.kind) return;
  switch (a.kind) {
    case 'answer':
      await transition(s, 'accept', acceptQ01, () =>
        prompt(s, { kind: 'line', line: LINES.moAccept, choices: [{ id: 'ok', label: 'Hang up' }] }),
      );
      return;
    case 'enter_van':
    case 'enter_express': {
      const which = a.kind === 'enter_van' ? 'van' : 'express';
      s.locomotion = which;
      const v = which === 'van' ? s.van : s.express;
      v.speed = 0;
      v.steer = 0;
      s.outbox.push({ type: 'enter', vehicle: which });
      if (which === 'express' && !s.express.borrowed) {
        // A new taking raises heat once. The battery comes with you.
        s.express.borrowed = true;
        s.pursuit = startPursuit(s.map, { x: s.express.x, y: s.express.y });
        s.caption = { text: 'Someone saw you take the express car. A patrol is coming.', until: s.simTime + 6 };
        s.outbox.push({ type: 'heat' });
      }
      s.outbox.push({ type: 'checkpoint' });
      return;
    }
    case 'exit': {
      const at = exitPoint(s);
      const d = driving(s);
      if (!at || !d) return;
      d.state.speed = 0;
      d.state.steer = 0;
      s.locomotion = 'foot';
      s.player.x = at.x;
      s.player.y = at.y;
      s.player.facing = Math.atan2(at.y - d.state.y, at.x - d.state.x);
      s.outbox.push({ type: 'exit' }, { type: 'checkpoint' });
      return;
    }
    case 'inspect':
      await transition(s, 'encounter', startEncounter, (events) => {
        const e = events.find((x) => x.type === 'encounter_turn');
        s.encounter = { text: e && e.type === 'encounter_turn' ? e.text : '', done: false };
        s.mode = 'encounter';
      });
      return;
    case 'lift':
      await transition(s, 'lift', liftShutter, () => {
        s.caption = { text: 'Clatterjack hooks the shutter and hauls it up. The yard’s open.', until: s.simTime + 6 };
      });
      return;
    case 'give': {
      const person = a.person!;
      prompt(s, {
        kind: 'confirm',
        title: `Give the battery to ${PEOPLE[person].short}?`,
        text: handoverConsequence(person),
        recipient: person,
        choices: [
          { id: 'give', label: `Give battery to ${PEOPLE[person].short}` },
          { id: 'cancel', label: 'Not yet' },
        ],
      });
      return;
    }
    case 'talk':
      prompt(s, { kind: 'line', line: talkLine(s, a.person!), choices: [{ id: 'ok', label: 'OK' }] });
      return;
  }
}

/** Answer the prompt on screen. */
export async function choose(s: Session, choiceId: string): Promise<void> {
  const pr = s.prompts[0];
  if (!pr || s.mode !== 'prompt') return;
  if (pr.kind === 'confirm' && choiceId === 'give' && pr.recipient) {
    const recipient = pr.recipient;
    closePrompt(s);
    const ok = await transition(
      s,
      'deliver',
      (p) => deliverBattery(p, recipient),
      () => {
        s.handoverAt = s.simTime;
        const next = s.progress.story.nextJob!;
        prompt(s, {
          kind: 'result',
          title: recipient === 'mo_vale' ? 'The ferry’s running' : 'The market’s lit',
          text: RESULT_TEXT[recipient],
          line: recipient === 'mo_vale' ? LINES.moNext : LINES.nellNext,
          choices: [
            { id: 'park', label: 'Park up' },
            { id: 'next', label: `Take the next call · ${NEXT_JOBS[next].minutes} min` },
          ],
        });
      },
    );
    if (!ok && s.saveFailed) {
      prompt(s, {
        kind: 'save_failed',
        title: 'Progress hasn’t saved',
        text: 'The battery is still with you. Nothing has changed hands.',
        choices: [
          { id: 'retry', label: 'Try again' },
          { id: 'cancel', label: 'Not now' },
        ],
      });
    }
    return;
  }
  if (pr.kind === 'save_failed' && choiceId === 'retry') {
    closePrompt(s);
    const retry = s.saveFailed?.retry;
    if (retry) await retry();
    return;
  }
  if (pr.kind === 'result') {
    closePrompt(s);
    if (choiceId === 'park') {
      s.parked = true;
      s.outbox.push({ type: 'parked' }, { type: 'checkpoint' });
    } else {
      const next = NEXT_JOBS[s.progress.story.nextJob!];
      prompt(s, {
        kind: 'next_call',
        title: `${next.name} · about ${next.minutes} min`,
        text: `${next.lead}. This call arrives in the next build. Drive around Riverside until then.`,
        choices: [{ id: 'ok', label: 'Free roam' }],
      });
    }
    return;
  }
  closePrompt(s);
}

/** Encounter buttons: Dim, Offer washer, Leave, or Continue after recruiting. */
export async function encounterChoose(s: Session, action: EncounterAction | 'leave' | 'continue'): Promise<void> {
  if (s.mode !== 'encounter' || !s.encounter) return;
  if (action === 'leave' || action === 'continue') {
    const recruited = s.encounter.done;
    s.encounter = null;
    s.mode = 'world';
    if (recruited) {
      s.caption = { text: 'Clatterjack rides in your pocket. Its claws could lift that yard shutter.', until: s.simTime + 7 };
    }
    return;
  }
  await transition(s, 'encounter_act', (p) => encounterAct(p, action), (events) => {
    for (const e of events) {
      if (e.type === 'encounter_turn' && s.encounter) s.encounter.text = e.text;
      if (e.type === 'recruited' && s.encounter) {
        s.encounter.text = TICKET_CRAB.reactions.recruit;
        s.encounter.done = true;
      }
    }
  });
}

// ------------------------------------------------------------------- time

export function pause(s: Session): void {
  if (s.mode === 'paused') return;
  s.resumeMode = s.mode;
  s.mode = 'paused';
}

export function resume(s: Session): void {
  if (s.mode !== 'paused') return;
  s.mode = s.resumeMode;
}

function capture(s: Session): void {
  // Back to the depot on foot; the van is recovered, the car goes back to its lay-by.
  s.pursuit = null;
  s.locomotion = 'foot';
  Object.assign(s.player, s.map.playerStart, { facing: -Math.PI / 2 });
  Object.assign(s.van, s.map.vanStart, { speed: 0, steer: 0, contact: false });
  Object.assign(s.express, s.map.expressStart, { speed: 0, steer: 0, contact: false, borrowed: false });
  s.outbox.push({ type: 'caught' }, { type: 'checkpoint' });
  const carrying = carryingBattery(s.progress);
  prompt(s, {
    kind: 'caught',
    title: 'Caught',
    text: carrying
      ? 'The patrol walks you back to the depot. The battery’s still in your bag, and the van’s waiting outside.'
      : 'The patrol walks you back to the depot. The van’s outside, ready to go.',
    choices: [{ id: 'ok', label: 'Back to work' }],
  });
}

/** Advance the world by one fixed step. */
export function stepSession(s: Session, raw: RawInput, dt: number): void {
  if (s.mode !== 'world') return;
  s.simTime += dt;
  if (s.caption && s.simTime > s.caption.until) s.caption = null;

  const d = driving(s);
  if (d) {
    const which = s.locomotion as 'van' | 'express';
    const controls = vehicleControls(raw, s.preset, d.state.heading, d.state.speed);
    const speedBefore = d.state.speed;
    const result = stepVehicle(d.spec, d.state, controls, dt, {
      blocked: (p) => blockedForVehicle(s, p, which),
      onPavement: (p) => surfaceAt(s.map, p.x, p.y) === Surface.Pavement,
      nearPoi: false,
    });
    if (result.bump > 0) {
      const f = forward(d.state.heading);
      const end = speedBefore >= 0 ? 1 : -1;
      s.outbox.push({
        type: 'bump',
        strength: result.bump,
        at: { x: d.state.x + f.x * d.spec.halfLength * end, y: d.state.y + f.y * d.spec.halfLength * end },
      });
    }
  } else {
    stepWalker(s.player, walkVector(raw), dt, (p) => blockedForWalker(s, p));
  }

  const body = bodyPos(s);
  const prog = s.progress;
  if (carryingBattery(prog) && !hasFlag(prog, 'counteroffer_heard') && !pointInRect(body, s.map.depotArea)) {
    void transition(s, 'counteroffer', hearCounteroffer, () => {
      s.caption = { speaker: LINES.nellCounter.speaker, text: LINES.nellCounter.text, until: s.simTime + 9 };
    });
  }
  const m = s.map.machine;
  if (
    !hasFlag(prog, 'machine_noticed') &&
    !prog.roster.includes('clatterjack') &&
    Math.hypot(body.x - m.x, body.y - m.y) < m.noticeRadius
  ) {
    void transition(s, 'notice', noticeMachine, () => {
      if (!s.caption || !s.caption.speaker) s.caption = { text: NOTICE_MACHINE, until: s.simTime + 7 };
    });
  }

  if (s.pursuit) {
    const dv = driving(s);
    const outcome = stepPursuit(
      s.map,
      s.pursuit,
      { pos: body, speed: dv ? dv.state.speed : 0, box: dv, walkerRadius: WALKER.radius },
      dt,
      (p) => blockedForVehicle(s, p, 'patrol'),
      gates(prog),
    );
    if (outcome === 'escaped') {
      s.pursuit = null;
      s.caption = { text: 'Lost the patrol. Heat’s clear.', until: s.simTime + 5 };
      s.outbox.push({ type: 'escaped' }, { type: 'checkpoint' });
    } else if (outcome === 'caught') {
      capture(s);
    }
  }
}

// -------------------------------------------------------------- objective

export interface Objective {
  text: string;
  target: Vec | null;
}

/** People the battery could go to right now, for street markers. */
export function destinations(s: Session): PersonId[] {
  if (!carryingBattery(s.progress)) return [];
  return hasFlag(s.progress, 'counteroffer_heard') ? ['mo_vale', 'nell_price'] : ['mo_vale'];
}

export function objective(s: Session): Objective {
  const map = s.map;
  const body = bodyPos(s);
  const open = gates(s.progress);
  if (s.pursuit) return { text: 'Lose the patrol: stay out of its sight for 6 seconds', target: null };
  const stage = s.progress.story.stage;
  if (stage === 'offered') {
    const phone = { x: map.phone.x, y: map.phone.y };
    return { text: 'The payphone outside the depot is ringing', target: nextWaypoint(map, body, phone, open) };
  }
  if (stage === 'carrying') {
    const options = destinations(s);
    const nearest = options
      .map((p) => ({ p, d: roadDistance(map, body, map.people[p], open) }))
      .sort((a, b) => a.d - b.d)[0].p;
    const text = options.length > 1 ? 'Battery: Mo at the quay, or Nell at the market' : 'Take the battery to Mo at the ferry quay';
    return { text, target: nextWaypoint(map, body, map.people[nearest], open) };
  }
  const next = NEXT_JOBS[s.progress.story.nextJob!];
  return { text: `Next: ${next.lead} · about ${next.minutes} min (next build)`, target: null };
}

export function teamNames(p: Progress): string[] {
  return p.team.map((c: CreatureId) => `${CREATURES[c].name}, ${CREATURES[c].kind}`);
}

/** Plain snapshot for the debug hook and tests. */
export function snapshot(s: Session) {
  const v = driving(s);
  return {
    mode: s.mode,
    simTime: Number(s.simTime.toFixed(3)),
    preset: s.preset,
    locomotion: s.locomotion,
    player: { x: s.player.x, y: s.player.y },
    van: { x: s.van.x, y: s.van.y, heading: s.van.heading, speed: s.van.speed },
    express: { x: s.express.x, y: s.express.y, heading: s.express.heading, speed: s.express.speed, borrowed: s.express.borrowed },
    vehicle: v ? { x: v.state.x, y: v.state.y, heading: v.state.heading, speed: v.state.speed } : null,
    pursuit: s.pursuit
      ? {
          x: s.pursuit.car.x,
          y: s.pursuit.car.y,
          inSight: s.pursuit.inSight,
          outOfSight: Number(s.pursuit.outOfSight.toFixed(2)),
          boxed: Number(s.pursuit.boxed.toFixed(2)),
        }
      : null,
    progress: structuredClone(s.progress),
    action: availableAction(s),
    objective: objective(s).text,
    /** Where the job arrow points, for scripted drivers that follow it like a player. */
    arrow: objective(s).target,
    prompt: s.prompts[0] ? { kind: s.prompts[0].kind, title: s.prompts[0].title, choices: s.prompts[0].choices } : null,
    encounter: s.encounter,
    caption: s.caption?.text ?? null,
    saveFailed: s.saveFailed?.label ?? null,
    parked: s.parked,
    handoverAt: s.handoverAt,
  };
}
