// The running world for Riverside Q01: walking, two vehicles, the patrol,
// interactions and prompts. Durable changes go through `transition`, which
// queues them, commits the next Progress through the injected `commit` and
// only then applies it and emits its events. No rendering or DOM here.

import type { CreatureId, Line, PersonId, QuickId, SymbolId } from './content.ts';
import {
  BEATS,
  CHIP_LINES,
  CLOSE_REPLY,
  SHOPS,
  WRONG_NUMBERS,
  CREATURES,
  LINES,
  LOST_SITES,
  NOTICE_MACHINE,
  PEOPLE,
  QUICK_JOBS,
  RESULT_TEXT,
  SYMBOLS,
  TICKET_CRAB,
} from './content.ts';
import type { RawInput, SteeringPreset } from './controls.ts';
import { vehicleControls, walkVector } from './controls.ts';
import type { Vec } from './math.ts';
import { distanceToBox, forward, pointInRect, rightOf } from './math.ts';
import type { StreetMap } from './map.ts';
import { Surface, gapToRect, isBlocked, surfaceAt } from './map.ts';
import type { EncounterAction, GameEvent, Progress, Result, Stats, StylePart } from './progress.ts';
import type { Ambient, AmbientEvent } from './ambient.ts';
import { createAmbient, honk as honkAmbient, stepAmbient, talk as talkTo, talkTarget } from './ambient.ts';
import {
  addStats,
  setStyle,
  acceptQ01,
  advanceQuick,
  carryingBattery,
  chooseCloseCrew,
  completeStep,
  deliverBattery,
  dropQuick,
  encounterAct,
  handoverConsequence,
  hasFlag,
  hearCounteroffer,
  liftShutter,
  newlyUnlocked,
  noticeMachine,
  quickStep,
  startEncounter,
  startQuick,
  takeCall,
} from './progress.ts';
import type { Pursuit } from './pursuit.ts';
import { startPursuit, stepPursuit } from './pursuit.ts';
import type { OpenGates } from './route.ts';
import { nextWaypoint, roadDistance } from './route.ts';
import type { Checkpoint } from './save.ts';
import type { VehicleSpec, VehicleState, WalkerState } from './vehicle.ts';
import { EXPRESS, PATROL, VAN, WALKER, stepVehicle, stepWalker, walkerFits } from './vehicle.ts';

export type Mode = 'world' | 'prompt' | 'encounter' | 'shop' | 'paused';
export type Locomotion = 'foot' | 'van' | 'express';
export type CommitOutcome = 'ok' | 'conflict' | 'failed';
export type Commit = (progress: Progress, label: string) => Promise<CommitOutcome>;

export interface Choice {
  id: string;
  label: string;
}

export interface Prompt {
  kind:
    | 'line'
    | 'confirm'
    | 'result'
    | 'caught'
    | 'save_failed'
    | 'next_call'
    | 'board'
    | 'beat_done'
    | 'quick_result'
    | 'puzzle'
    | 'cutscene'
    | 'close_choice';
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
  | { type: 'checkpoint' }
  | AmbientEvent
  | { type: 'horn'; at: Vec }
  | { type: 'wrong_call' }
  | { type: 'chips' }
  | { type: 'chat'; id: string }
  | { type: 'shop'; shop: 'tailor' | 'paint' };

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
  /** A prompt held back briefly so the street change can be seen first. */
  pending: { prompt: Prompt; at: number } | null;
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
  /** Last post clock (simulation seconds since the mail was collected) and whether heat touched it. */
  quickElapsed: number;
  quickPursuit: boolean;
  /** Symbols picked so far at the yard cabinet. */
  puzzle: SymbolId[] | null;
  /** Step "near" captions already shown this session. */
  nearShown: Set<string>;
  seq: number;
  /** People and pigeons around the courier. */
  ambient: Ambient;
  /** Free-play counts waiting to be saved together. */
  pendingStats: Partial<Stats>;
  pendingMet: string[];
  statsFlushAt: number;
  /** Wrong-number calls on the depot payphone during free roam. */
  call: { nextAt: number; until: number };
  hornReadyAt: number;
  /** Which shop is open, if any. */
  shop: 'tailor' | 'paint' | null;
  /** Set when you leave Body & Paint, so the button says "Get out" until the van leaves the bay. */
  bayUsed: boolean;
}

export interface Action {
  kind:
    | 'answer'
    | 'enter_van'
    | 'enter_express'
    | 'exit'
    | 'inspect'
    | 'lift'
    | 'give'
    | 'talk'
    | 'step'
    | 'quick'
    | 'talk_ped'
    | 'wrong_call'
    | 'chips'
    | 'tailor'
    | 'paint'
    | null;
  verb: string;
  enabled: boolean;
  reason?: string;
  person?: PersonId;
}

const ENTER_REACH = 14;
/** Seconds between a handover and its result card. */
export const RESULT_DELAY = 2;

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
    pending: null,
    caption: null,
    encounter: null,
    saveFailed: null,
    parked: false,
    outbox: [],
    commit,
    busy: new Set(),
    queue: Promise.resolve(),
    handoverAt: null,
    quickElapsed: 0,
    quickPursuit: false,
    puzzle: null,
    nearShown: new Set(),
    seq: 0,
    ambient: createAmbient(),
    pendingStats: {},
    pendingMet: [],
    statsFlushAt: 0,
    call: { nextAt: 75, until: 0 },
    hornReadyAt: 0,
    shop: null,
    bayUsed: false,
  };
  if (checkpoint) restoreCheckpoint(s, checkpoint);
  // A first night: say who the little light circling the courier is.
  if (!checkpoint && progress.story.stage === 'offered') {
    s.caption = { text: 'Wickwing, your lantern moth, circles your shoulder. Its glow brightens near anything that rings.', until: 9 };
  }
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
    quickElapsed: Number(s.quickElapsed.toFixed(2)),
    quickPursuit: s.quickPursuit,
  };
}

/** Restore positions if they are still valid; otherwise fall back to the depot. */
export function restoreCheckpoint(s: Session, cp: Checkpoint): void {
  const map = s.map;
  const okVehicle = (p: { x: number; y: number }) => !isBlocked(map, p, true) && surfaceAt(map, p.x, p.y) !== Surface.Void;
  if (okVehicle(cp.van)) Object.assign(s.van, cp.van, { speed: 0, steer: 0 });
  if (okVehicle(cp.express)) Object.assign(s.express, cp.express, { speed: 0, steer: 0 });
  s.express.borrowed = cp.express.borrowed;
  s.quickElapsed = cp.quickElapsed ?? 0;
  s.quickPursuit = cp.quickPursuit ?? false;
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
      const before = s.progress;
      s.progress = r.progress;
      s.saveFailed = null;
      s.outbox.push(...r.events);
      // Story moments unlock looks too (a crew friend, the Reedlings, shift one): announce them.
      if (!r.events.some((e) => e.type === 'unlocked')) {
        const items = newlyUnlocked(before, r.progress);
        if (items.length) s.outbox.push({ type: 'unlocked', items });
      }
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
    const bay = SHOPS.paint;
    if (!s.bayUsed && s.locomotion === 'van' && Math.hypot(d.state.x - bay.at.x, d.state.y - bay.at.y) < bay.reach && Math.abs(d.state.speed) <= d.spec.exitSpeed) {
      // No hiding from the patrol in the paint shop.
      if (!s.pursuit) return { kind: 'paint', verb: 'Body & Paint', enabled: true };
    }
    if (Math.abs(d.state.speed) > d.spec.exitSpeed) return { kind: 'exit', verb: 'Get out', enabled: false, reason: 'Stop to get out' };
    if (!exitPoint(s)) return { kind: 'exit', verb: 'Get out', enabled: false, reason: 'No room to get out here' };
    return { kind: 'exit', verb: 'Get out', enabled: true };
  }

  const p = s.player;
  const prog = s.progress;
  const heat = s.pursuit !== null;
  const options: { gap: number; action: Action }[] = [];
  /** In reach when gap <= 0. A bias pushes an action behind others in reach without shrinking its own reach. */
  const add = (gap: number, action: Action, bias = 0) => {
    if (gap <= 0) options.push({ gap: gap + bias, action });
  };

  const phone = s.map.phone;
  if (prog.story.stage === 'offered') {
    add(Math.hypot(p.x - phone.x, p.y - phone.y) - phone.reach, { kind: 'answer', verb: 'Answer', enabled: true });
  } else if (wrongCallRinging(s)) {
    add(Math.hypot(p.x - phone.x, p.y - phone.y) - phone.reach, { kind: 'wrong_call', verb: 'Answer', enabled: true });
  }
  const shopGap = (at: Vec, reachPx: number) => Math.hypot(p.x - at.x, p.y - at.y) - reachPx;
  const busy = heat ? 'Lose the patrol first' : undefined;
  add(shopGap(SHOPS.tailor.at, SHOPS.tailor.reach), { kind: 'tailor', verb: 'Second Thread · clothes', enabled: !heat, reason: busy });
  add(shopGap(SHOPS.chips.at, SHOPS.chips.reach), { kind: 'chips', verb: 'Buy chips', enabled: !heat, reason: busy });
  const who = talkTarget(s.ambient, p);
  if (who) {
    // People wander past: the van, the phone and the job come first while they're in reach too.
    add(Math.hypot(p.x - who.x, p.y - who.y) - 20, { kind: 'talk_ped', verb: `Talk to ${who.name ?? 'a passer-by'}`, enabled: true }, 30);
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

  const step = currentStep(s);
  if (step) {
    add(Math.hypot(p.x - step.at.x, p.y - step.at.y) - step.reach - 0.5, {
      kind: 'step',
      verb: step.verb,
      enabled: !heat,
      reason: heat ? 'Lose the patrol first' : undefined,
    });
  }
  const qs = quickStep(prog);
  if (qs) {
    add(Math.hypot(p.x - qs.at.x, p.y - qs.at.y) - 24 - 0.5, { kind: 'quick', verb: qs.verb, enabled: true });
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

/** The active story step, if a beat is running and still has steps. */
export function currentStep(s: Session) {
  const a = s.progress.shift.active;
  if (!a) return null;
  return BEATS[a.beat].steps[a.step] ?? null;
}

const fmt = (sec: number | null) =>
  sec === null ? '—' : `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}.${String(Math.floor((sec % 1) * 10))}`;
export const formatTime = fmt;

/** The dispatch board: the story call, the quick jobs, and Park up. One job at a time. */
export function openBoard(s: Session): void {
  const p = s.progress;
  const sh = p.shift;
  const busy = sh.active !== null || p.quick.active !== null;
  const lines: string[] = [];
  const choices: Choice[] = [];
  if (p.story.stage !== 'delivered') {
    lines.push('Story: Q01 One good battery is still running.');
  } else if (sh.active) {
    lines.push(`Story: ${BEATS[sh.active.beat].name} in progress.`);
  } else if (sh.lead) {
    const b = BEATS[sh.lead];
    lines.push(`Story: ${b.name} is waiting · about ${b.minutes} min.`);
    if (!busy) choices.push({ id: 'take', label: `Take the call: ${b.name} · ${b.minutes} min` });
  } else if (sh.complete) {
    lines.push('Story: shift one is complete. Shift two arrives in a later build.');
  }
  if (p.story.stage === 'delivered') {
    const q = p.quick;
    if (q.active) {
      lines.push(`Quick job: ${QUICK_JOBS[q.active.job].name} in progress.`);
      choices.push({ id: 'drop', label: `Drop ${QUICK_JOBS[q.active.job].name}` });
    } else if (!sh.active) {
      choices.push({ id: 'quick:last_post', label: `Last post · ${QUICK_JOBS.last_post.minutes} min · best ${fmt(q.bests.quiet)}` });
      choices.push({
        id: 'quick:lost_property',
        label: `Lost property · ${QUICK_JOBS.lost_property.minutes} min · ${q.lostFound.length}/${LOST_SITES.length} found`,
      });
    }
    lines.push(`Last post bests: quiet ${fmt(q.bests.quiet)} · with a chase ${fmt(q.bests.pursuit)}.`);
  }
  lines.push('One job at a time. A story call waits while you do a quick job.');
  choices.push({ id: 'park', label: 'Park up' }, { id: 'close', label: 'Back to the street' });
  prompt(s, { kind: 'board', title: 'Dispatch', text: lines.join(' '), choices });
}

function beatDonePrompt(s: Session, beatId: keyof typeof BEATS): void {
  const beat = BEATS[beatId];
  const lead = s.progress.shift.lead;
  const choices: Choice[] = [{ id: 'park', label: 'Park up' }];
  if (lead) choices.push({ id: 'take', label: `Take the next call · ${BEATS[lead].minutes} min` });
  choices.push({ id: 'board', label: 'Dispatch board' });
  prompt(s, { kind: 'beat_done', title: beat.done.title, text: beat.done.text, choices });
}

async function doStep(s: Session): Promise<void> {
  const step = currentStep(s);
  if (!step) return;
  if (step.kind === 'puzzle') {
    if (!s.progress.cargo.includes(step.requiresCargo ?? '')) {
      prompt(s, { kind: 'line', text: 'The cabinet is open but the relay socket is empty. Bring the relay from the depot.', choices: [{ id: 'ok', label: 'OK' }] });
      return;
    }
    s.puzzle = [];
    puzzlePrompt(s, 'Two symbols are scratched beside the relay socket: match the two from your journal.');
    return;
  }
  await transition(s, `step:${step.id}`, (p) => completeStep(p), (events) => afterStep(s, events));
}

function afterStep(s: Session, events: GameEvent[]): void {
  for (const e of events) {
    if (e.type === 'step_done') {
      if (e.line) prompt(s, { kind: 'line', line: e.line, choices: [{ id: 'ok', label: 'OK' }] });
      else if (e.caption) s.caption = { text: e.caption, until: s.simTime + 8 };
      if (e.step === 'watch') {
        prompt(s, {
          kind: 'cutscene',
          title: 'Three rings',
          text: 'The warning lamp blinks. Along the mud, a line of pocket-sized creatures answers it, one after another: three rings, then three more. You record it.',
          choices: [{ id: 'log', label: 'Log the sighting' }],
        });
      }
    }
    if (e.type === 'beat_done' && e.beat !== 'SHIFT_01_CLOSE') beatDonePrompt(s, e.beat);
  }
}

function puzzlePrompt(s: Session, text: string): void {
  const picked = s.puzzle ?? [];
  const choices: Choice[] = (Object.keys(SYMBOLS) as SymbolId[])
    .filter((id) => !picked.includes(id))
    .map((id) => ({ id: `sym:${id}`, label: `${SYMBOLS[id].glyph} ${SYMBOLS[id].name}` }));
  choices.push({ id: 'cancel', label: 'Close the cabinet' });
  const chosen = picked.length ? ` Chosen: ${picked.map((id) => SYMBOLS[id].name).join(', ')}.` : '';
  prompt(s, { kind: 'puzzle', title: 'Yard cabinet', text: `${text}${chosen}`, choices });
}

function callPrompt(s: Session): void {
  const a = s.progress.shift.active;
  if (!a) return;
  const beat = BEATS[a.beat];
  prompt(s, { kind: 'line', line: beat.caller, text: `${beat.name} · about ${beat.minutes} min`, choices: [{ id: 'ok', label: 'On my way' }] });
}

async function startJob(s: Session, job: QuickId): Promise<void> {
  s.seq += 1;
  await transition(s, 'quick_start', (p) => startQuick(p, job, `${job}-${p.quick.runs + 1}-${s.seq}`), () => {
    s.quickElapsed = 0;
    s.quickPursuit = false;
    const qs = quickStep(s.progress);
    if (qs) s.caption = { text: qs.objective, until: s.simTime + 6 };
  });
}

// --------------------------------------------------------------- free play

export const wrongCallRinging = (s: Session): boolean => s.simTime < s.call.until;

/** The depot payphone rings for the story, or with a wrong number during free roam. */
export const phoneRinging = (s: Session): boolean => s.progress.story.stage === 'offered' || wrongCallRinging(s);

function note(s: Session, delta: Partial<Stats>, met: string[] = []): void {
  for (const [k, v] of Object.entries(delta) as [keyof Stats, number][]) s.pendingStats[k] = (s.pendingStats[k] ?? 0) + v;
  for (const m of met) if (!s.pendingMet.includes(m)) s.pendingMet.push(m);
}

/** Save free-play counts in one small commit. */
function flushStats(s: Session): void {
  if (!Object.keys(s.pendingStats).length && !s.pendingMet.length) return;
  if (s.busy.has('stats')) return;
  void transition(s, 'stats', (p) => {
    const delta = s.pendingStats;
    const met = s.pendingMet;
    s.pendingStats = {};
    s.pendingMet = [];
    return addStats(p, delta, met);
  });
}

/** The van's horn. Pigeons scatter and people grumble. */
export function horn(s: Session): void {
  const d = driving(s);
  if (!d || s.mode !== 'world' || s.simTime < s.hornReadyAt) return;
  s.hornReadyAt = s.simTime + 0.5;
  const at = { x: d.state.x, y: d.state.y };
  s.outbox.push({ type: 'horn', at });
  note(s, { honks: 1 });
  for (const e of honkAmbient(s.ambient, at)) handleAmbient(s, e);
}

function handleAmbient(s: Session, e: AmbientEvent): void {
  s.outbox.push(e);
  if (e.type === 'pigeons') note(s, { pigeons: e.count });
  if (e.type === 'ped_bump') note(s, { pedBumps: 1 });
  if (e.type === 'ped_bump' || e.type === 'ped_brush' || e.type === 'ped_horn') {
    if (!s.caption || !s.caption.speaker || s.caption.speaker === 'Passer-by' || s.caption.until < s.simTime + 2) {
      s.caption = { speaker: e.name ?? 'Passer-by', text: e.line, until: s.simTime + 3 };
    }
  }
}

/** Pick something in the open shop, or a jacket from the pause menu. */
export async function shopChoose(s: Session, part: StylePart, id: string): Promise<void> {
  if (s.mode !== 'shop' && s.mode !== 'paused') return;
  await transition(s, `style:${part}`, (p) => setStyle(p, part, id));
}

export function shopClose(s: Session): void {
  if (s.mode !== 'shop') return;
  if (s.shop === 'paint') s.bayUsed = true;
  s.shop = null;
  s.mode = 'world';
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
    case 'step':
      await doStep(s);
      return;
    case 'talk_ped': {
      const who = talkTarget(s.ambient, s.player);
      if (!who) return;
      const text = talkTo(s.ambient, who);
      note(s, { chats: 1 }, [who.id]);
      s.outbox.push({ type: 'chat', id: who.id });
      prompt(s, { kind: 'line', line: { speaker: who.name ?? 'Passer-by', role: 'Riverside', text }, choices: [{ id: 'ok', label: 'OK' }] });
      return;
    }
    case 'wrong_call': {
      s.call.until = 0;
      note(s, { calls: 1 });
      s.outbox.push({ type: 'wrong_call' });
      const text = WRONG_NUMBERS[Math.floor(s.simTime * 7) % WRONG_NUMBERS.length];
      prompt(s, { kind: 'line', line: { speaker: 'Payphone', role: 'Wrong number', text }, choices: [{ id: 'ok', label: 'Hang up' }] });
      return;
    }
    case 'chips': {
      note(s, { chips: 1 });
      s.outbox.push({ type: 'chips' });
      s.caption = { speaker: 'The Fry Light', text: CHIP_LINES[Math.floor(s.simTime * 3) % CHIP_LINES.length], until: s.simTime + 6 };
      flushStats(s);
      return;
    }
    case 'tailor':
    case 'paint':
      s.shop = a.kind;
      s.mode = 'shop';
      s.outbox.push({ type: 'shop', shop: a.kind });
      return;
    case 'quick': {
      const job = s.progress.quick.active?.job;
      await transition(
        s,
        'quick_step',
        (p) => advanceQuick(p, s.quickElapsed, s.quickPursuit),
        (events) => {
          for (const e of events) {
            if (e.type === 'quick_step') {
              s.caption = { text: e.caption, until: s.simTime + 6 };
              s.quickElapsed = 0;
              s.quickPursuit = s.pursuit !== null;
            }
            if (e.type === 'quick_done') {
              const text =
                e.job === 'last_post'
                  ? `${fmt(e.time)} ${e.category === 'pursuit' ? 'with a chase' : 'quiet run'}. ${e.improved ? 'New best!' : `Best ${fmt(e.best)}.`}`
                  : e.newSite
                    ? `Handed in. ${s.progress.quick.lostFound.length} of ${LOST_SITES.length} lost things found.`
                    : 'Handed in. You’d already found that one before.';
              prompt(s, {
                kind: 'quick_result',
                title: QUICK_JOBS[e.job].name,
                text,
                choices: [
                  { id: 'park', label: 'Park up' },
                  { id: 'board', label: 'Dispatch board' },
                ],
              });
            }
          }
        },
      );
      void job;
      return;
    }
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
        // Let the ferry start or the stalls light before the card covers the street.
        s.caption = { text: `Battery handed to ${PEOPLE[recipient].short}.`, until: s.simTime + 2 };
        s.pending = { at: s.simTime + RESULT_DELAY, prompt: {
          kind: 'result',
          title: recipient === 'mo_vale' ? 'The ferry’s running' : 'The market’s lit',
          text: RESULT_TEXT[recipient],
          line: recipient === 'mo_vale' ? LINES.moNext : LINES.nellNext,
          choices: [
            { id: 'park', label: 'Park up' },
            { id: 'next', label: `Take the next call · ${BEATS[next].minutes} min` },
            { id: 'board', label: 'Dispatch board' },
          ],
        } };
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
  if (choiceId === 'park') {
    closePrompt(s);
    s.prompts = [];
    if (s.mode === 'prompt') s.mode = 'world';
    s.parked = true;
    s.outbox.push({ type: 'parked' }, { type: 'checkpoint' });
    return;
  }
  if (choiceId === 'take' || (pr.kind === 'result' && choiceId === 'next')) {
    closePrompt(s);
    await transition(s, 'take_call', takeCall, () => callPrompt(s));
    return;
  }
  if (choiceId === 'board') {
    closePrompt(s);
    openBoard(s);
    return;
  }
  if (choiceId.startsWith('quick:')) {
    closePrompt(s);
    await startJob(s, choiceId.slice(6) as QuickId);
    return;
  }
  if (choiceId === 'drop') {
    closePrompt(s);
    await transition(s, 'quick_drop', dropQuick, () => {
      s.caption = { text: 'Quick job dropped. Nothing gained, nothing lost.', until: s.simTime + 5 };
    });
    return;
  }
  if (pr.kind === 'puzzle') {
    closePrompt(s);
    if (choiceId === 'cancel') {
      s.puzzle = null;
      return;
    }
    const picked = [...(s.puzzle ?? []), choiceId.slice(4) as SymbolId];
    s.puzzle = picked;
    if (picked.length < 2) {
      puzzlePrompt(s, 'One more.');
      return;
    }
    const step = currentStep(s);
    const ok = await transition(s, 'step:cabinet', (p) => completeStep(p, picked), (events) => {
      s.puzzle = null;
      afterStep(s, events);
    });
    if (!ok && !s.saveFailed) {
      s.puzzle = [];
      puzzlePrompt(s, 'The relay buzzes and spits. Not those two. Check your journal and try again.');
    }
    void step;
    return;
  }
  if (pr.kind === 'cutscene') {
    closePrompt(s);
    prompt(s, {
      kind: 'close_choice',
      title: 'Who hears it first?',
      text: 'Both crews will want the recording. Radio one of them first.',
      choices: [
        { id: 'first:mo_vale', label: 'Radio Mo first' },
        { id: 'first:nell_price', label: 'Radio Nell first' },
      ],
    });
    return;
  }
  if (pr.kind === 'close_choice') {
    closePrompt(s);
    const first = choiceId.slice(6) as PersonId;
    await transition(s, 'close', (p) => chooseCloseCrew(p, first), () => {
      prompt(s, { kind: 'line', line: CLOSE_REPLY[first], choices: [{ id: 'ok', label: 'OK' }] });
      prompt(s, {
        kind: 'beat_done',
        title: 'Shift one complete',
        text: 'The sighting is logged and the line is ringing again. Shift two arrives in a later build; quick jobs are on the dispatch board.',
        choices: [
          { id: 'park', label: 'Park up' },
          { id: 'board', label: 'Dispatch board' },
        ],
      });
    });
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
  if (s.pending && s.simTime >= s.pending.at) {
    const pr = s.pending.prompt;
    s.pending = null;
    prompt(s, pr);
    return;
  }

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
  // Last post clock: simulation time only, from collecting the mail to posting it.
  const q = prog.quick.active;
  if (q && q.job === 'last_post' && q.step === 1) {
    s.quickElapsed += dt;
    if (s.pursuit) s.quickPursuit = true;
  }
  const step = currentStep(s);
  if (step?.near && !s.nearShown.has(step.id) && Math.hypot(body.x - step.at.x, body.y - step.at.y) < 120) {
    s.nearShown.add(step.id);
    s.caption = { text: step.near, until: s.simTime + 6 };
  }
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

  // The town: people step aside, pigeons scatter.
  const dv0 = driving(s);
  const ambientEvents = stepAmbient(
    s.ambient,
    s.map,
    {
      pos: body,
      vehicle: dv0
        ? { heading: dv0.state.heading, speed: dv0.state.speed, halfLength: dv0.spec.halfLength, halfWidth: dv0.spec.halfWidth }
        : null,
    },
    dt,
  );
  for (const e of ambientEvents) handleAmbient(s, e);
  if (s.bayUsed && Math.hypot(body.x - SHOPS.paint.at.x, body.y - SHOPS.paint.at.y) > SHOPS.paint.reach + 12) s.bayUsed = false;
  // Wrong numbers on the depot payphone, now and then, once the story call is answered.
  if (prog.story.stage !== 'offered' && !wrongCallRinging(s) && s.simTime >= s.call.nextAt) {
    s.call.until = s.simTime + 25;
    s.call.nextAt = s.simTime + 110 + ((s.simTime * 13) % 70);
  }
  if (s.simTime >= s.statsFlushAt) {
    s.statsFlushAt = s.simTime + 2;
    flushStats(s);
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
  if (s.pursuit) return { text: 'Lose the patrol', target: null };
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
  const qs = quickStep(s.progress);
  if (qs) return { text: qs.objective, target: nextWaypoint(map, body, qs.at, open) };
  const step = currentStep(s);
  if (step) return { text: step.objective, target: nextWaypoint(map, body, step.at, open) };
  const sh = s.progress.shift;
  if (sh.lead) {
    const b = BEATS[sh.lead];
    return { text: `Next call: ${b.name} · about ${b.minutes} min · Pause → Dispatch`, target: null };
  }
  if (sh.complete) return { text: 'Shift one complete · quick jobs on the dispatch board', target: null };
  return { text: 'Free roam', target: null };
}

/** Where the current story or quick-job step happens, for a street pin. */
export function stepPin(s: Session): Vec | null {
  return quickStep(s.progress)?.at ?? currentStep(s)?.at ?? null;
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
    /** Where the current story or quick-job step happens (the street pin). */
    pin: stepPin(s),
    /** The arrow's next waypoint towards each recipient, for choosing one deliberately. */
    routes: Object.fromEntries([
      ...(['mo_vale', 'nell_price'] as const).map((who) => [who, nextWaypoint(s.map, bodyPos(s), s.map.people[who], gates(s.progress))]),
      ...(['tailor', 'paint', 'chips'] as const).map((shop) => [shop, nextWaypoint(s.map, bodyPos(s), SHOPS[shop].at, gates(s.progress))]),
    ]),
    prompt: s.prompts[0] ? { kind: s.prompts[0].kind, title: s.prompts[0].title, choices: s.prompts[0].choices } : null,
    encounter: s.encounter,
    caption: s.caption?.text ?? null,
    saveFailed: s.saveFailed?.label ?? null,
    parked: s.parked,
    handoverAt: s.handoverAt,
    shop: s.shop,
    phoneRinging: phoneRinging(s),
    people: s.ambient.peds.map((p) => ({ id: p.id, name: p.name, x: Math.round(p.x), y: Math.round(p.y), state: p.state })),
    pigeons: s.ambient.flocks.map((f) => ({ id: f.id, x: f.home.x, y: f.home.y, onGround: f.birds.filter((b) => b.state === 'ground').length })),
  };
}
