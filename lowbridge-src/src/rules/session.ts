// The M0 session: world, dialogue and paused states; walking, driving, the
// bay, the phone and the lap log. No rendering or DOM here, so the rules run
// under `node --test`.

import type { Vec } from './math.ts';
import { angleDiff, boxCorners, distanceToBox, forward, pointInRect, rectCentre, rightOf } from './math.ts';
import type { StreetMap } from './map.ts';
import { Surface, inBay, isBlocked, surfaceAt } from './map.ts';
import type { RawInput, SteeringPreset } from './controls.ts';
import { vehicleControls, walkVector } from './controls.ts';
import type { VehicleState, WalkerState } from './vehicle.ts';
import { VAN, WALKER, stepVehicle, stepWalker, walkerFits } from './vehicle.ts';

export type Mode = 'world' | 'dialogue' | 'paused';
export type Locomotion = 'foot' | 'van';

export interface DialogueLine {
  speaker: string;
  role: string;
  text: string;
}

export const MO_FIRST_CALL: DialogueLine = {
  speaker: 'Mo Vale',
  role: 'Ferry Crew, on the payphone',
  text: 'Starter’s dead. Last ferry’s full. Tell me you’ve still got that battery.',
};

export interface LapRecord {
  run: number;
  preset: SteeringPreset | 'mixed';
  lapSeconds: number;
  bumps: number;
  /** What each counted bump hit and the tile it was on, e.g. "lamp_station_2 at 20,26". */
  hits: string[];
}

export interface RunState {
  n: number;
  enteredAt: number | null;
  lap: boolean;
  parked: boolean;
  lapSeconds: number | null;
  bumps: number;
  hits: string[];
  lastBumpAt: number;
  parkTimer: number;
  presetsUsed: SteeringPreset[];
}

export interface Session {
  map: StreetMap;
  mode: Mode;
  resumeMode: Exclude<Mode, 'paused'>;
  /** Seconds of active world simulation. Pauses, dialogue and background time do not count. */
  simTime: number;
  preset: SteeringPreset;
  locomotion: Locomotion;
  player: WalkerState;
  van: VehicleState;
  phoneRinging: boolean;
  dialogue: DialogueLine | null;
  run: RunState;
  log: LapRecord[];
}

export type GameEvent =
  | { type: 'enter' }
  | { type: 'exit' }
  | { type: 'bump'; strength: number; at: Vec }
  | { type: 'lap' }
  | { type: 'parked'; lapSeconds: number }
  | { type: 'ring' }
  | { type: 'answer'; line: DialogueLine }
  | { type: 'hangup' }
  | { type: 'logged'; record: LapRecord };

export type ActionKind = 'enter' | 'exit' | 'answer' | 'hangup';

export interface Action {
  kind: ActionKind | null;
  verb: string;
  enabled: boolean;
  reason?: string;
}

export interface Objective {
  text: string;
  target: Vec | null;
}

const ENTER_REACH = 14;
const PARK_SETTLE = 0.35;
const PARK_ALIGN = 0.35;
const BUMP_DEBOUNCE = 0.4;

const newRun = (n: number): RunState => ({
  n,
  enteredAt: null,
  lap: false,
  parked: false,
  lapSeconds: null,
  bumps: 0,
  hits: [],
  lastBumpAt: -Infinity,
  parkTimer: 0,
  presetsUsed: [],
});

export function createSession(map: StreetMap, preset: SteeringPreset): Session {
  return {
    map,
    mode: 'world',
    resumeMode: 'world',
    simTime: 0,
    preset,
    locomotion: 'foot',
    player: { x: map.playerStart.x, y: map.playerStart.y, facing: -Math.PI / 2 },
    van: { ...map.vanStart, speed: 0, steer: 0, contact: false },
    // Q01 opens with the phone already ringing; answering or ignoring it are both fine.
    phoneRinging: true,
    dialogue: null,
    run: newRun(1),
    log: [],
  };
}

// ------------------------------------------------------------- collisions

function blockedForWalker(s: Session, p: Vec): boolean {
  if (isBlocked(s.map, p)) return true;
  const v = s.van;
  return distanceToBox(p, v.x, v.y, v.heading, VAN.halfLength, VAN.halfWidth) === 0;
}

function vanNearPoi(s: Session): boolean {
  const c = rectCentre(s.map.bay.rect);
  return Math.hypot(s.van.x - c.x, s.van.y - c.y) < 56;
}

const vanCorners = (v: VehicleState) => boxCorners(v.x, v.y, v.heading, VAN.halfLength, VAN.halfWidth);

/** The safe spot to step out, preferring the pavement side. Null if every door is blocked. */
export function exitPoint(s: Session): Vec | null {
  const v = s.van;
  const f = forward(v.heading);
  const r = rightOf(v.heading);
  const side = VAN.halfWidth + WALKER.radius + 2;
  const end = VAN.halfLength + WALKER.radius + 2;
  // Right-hand drive: the driver's door is on the right. A longer step reaches the kerb.
  const candidates: Vec[] = [];
  for (const reach of [side, side + 8]) {
    candidates.push({ x: v.x + r.x * reach, y: v.y + r.y * reach });
    candidates.push({ x: v.x - r.x * reach, y: v.y - r.y * reach });
  }
  candidates.push({ x: v.x - f.x * end, y: v.y - f.y * end }, { x: v.x + f.x * end, y: v.y + f.y * end });
  const fits = candidates.filter((p) => walkerFits(p, (q) => isBlocked(s.map, q)));
  const safe = fits.find((p) => {
    const surface = surfaceAt(s.map, p.x, p.y);
    return surface === Surface.Pavement || surface === Surface.Yard;
  });
  return safe ?? fits[0] ?? null;
}

/** Name what the van hit at a bump point: a lamp post, the phone box, the barrier or a wall. */
export function describeHit(map: StreetMap, at: Vec): string {
  const tile = `${Math.floor(at.x / 16)},${Math.floor(at.y / 16)}`;
  for (const prop of map.props) {
    if (Math.hypot(prop.x - at.x, prop.y - at.y) < prop.r + 10) return `${prop.id} at ${tile}`;
  }
  const ph = map.phone;
  if (Math.abs(ph.x - at.x) < ph.half + 10 && Math.abs(ph.y - at.y) < ph.half + 10) return `phone box at ${tile}`;
  for (const [dx, dy] of [[0, 0], [8, 0], [-8, 0], [0, 8], [0, -8]]) {
    if (surfaceAt(map, at.x + dx, at.y + dy) === Surface.Barrier) return `barrier at ${tile}`;
  }
  return `wall at ${tile}`;
}

// ---------------------------------------------------------------- actions

export function availableAction(s: Session): Action {
  if (s.mode === 'dialogue') return { kind: 'hangup', verb: 'Hang up', enabled: true };
  if (s.mode !== 'world') return { kind: null, verb: '', enabled: false };

  if (s.locomotion === 'van') {
    if (Math.abs(s.van.speed) > VAN.exitSpeed) {
      return { kind: 'exit', verb: 'Get out', enabled: false, reason: 'Stop to get out' };
    }
    if (!exitPoint(s)) return { kind: 'exit', verb: 'Get out', enabled: false, reason: 'No room to get out here' };
    return { kind: 'exit', verb: 'Get out', enabled: true };
  }

  const p = s.player;
  const phone = s.map.phone;
  const phoneGap = Math.hypot(p.x - phone.x, p.y - phone.y) - phone.reach;
  const vanGap = distanceToBox(p, s.van.x, s.van.y, s.van.heading, VAN.halfLength, VAN.halfWidth) - ENTER_REACH;
  const canAnswer = s.phoneRinging && phoneGap <= 0;
  const canEnter = vanGap <= 0;
  if (canAnswer && (!canEnter || phoneGap <= vanGap)) return { kind: 'answer', verb: 'Answer', enabled: true };
  if (canEnter) return { kind: 'enter', verb: 'Get in', enabled: true };
  return { kind: null, verb: '', enabled: false };
}

export function interact(s: Session): GameEvent[] {
  const action = availableAction(s);
  if (!action.enabled || !action.kind) return [];
  const events: GameEvent[] = [];

  switch (action.kind) {
    case 'enter': {
      s.locomotion = 'van';
      s.van.speed = 0;
      s.van.steer = 0;
      if (s.run.enteredAt === null) s.run.enteredAt = s.simTime;
      events.push({ type: 'enter' });
      break;
    }
    case 'exit': {
      const at = exitPoint(s);
      if (!at) return [];
      s.van.speed = 0;
      s.van.steer = 0;
      s.locomotion = 'foot';
      s.player.x = at.x;
      s.player.y = at.y;
      s.player.facing = Math.atan2(at.y - s.van.y, at.x - s.van.x);
      events.push({ type: 'exit' });
      break;
    }
    case 'answer': {
      s.phoneRinging = false;
      s.dialogue = MO_FIRST_CALL;
      s.mode = 'dialogue';
      s.resumeMode = 'dialogue';
      events.push({ type: 'answer', line: MO_FIRST_CALL });
      if (s.run.parked && s.run.lapSeconds !== null) {
        const used = s.run.presetsUsed;
        const record: LapRecord = {
          run: s.run.n,
          preset: used.length === 1 ? used[0] : 'mixed',
          lapSeconds: s.run.lapSeconds,
          bumps: s.run.bumps,
          hits: [...s.run.hits],
        };
        s.log.push(record);
        s.run = newRun(s.run.n + 1);
        events.push({ type: 'logged', record });
      }
      break;
    }
    case 'hangup': {
      s.dialogue = null;
      s.mode = 'world';
      s.resumeMode = 'world';
      events.push({ type: 'hangup' });
      break;
    }
  }
  return events;
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

/** Advance the world by one fixed step. Does nothing outside the world state. */
export function stepSession(s: Session, raw: RawInput, dt: number): GameEvent[] {
  if (s.mode !== 'world') return [];
  const events: GameEvent[] = [];
  s.simTime += dt;

  if (s.locomotion === 'van') {
    const controls = vehicleControls(raw, s.preset, s.van.heading, s.van.speed);
    const driving = controls.throttle > 0 || controls.brake || Math.abs(s.van.speed) > 1;
    if (driving && !s.run.presetsUsed.includes(s.preset)) s.run.presetsUsed.push(s.preset);
    const speedBefore = s.van.speed;
    const result = stepVehicle(VAN, s.van, controls, dt, {
      blocked: (p) => isBlocked(s.map, p),
      onPavement: (p) => surfaceAt(s.map, p.x, p.y) === Surface.Pavement,
      nearPoi: vanNearPoi(s),
    });
    if (result.bump > 0) {
      const f = forward(s.van.heading);
      // The end that hit is the one it was travelling towards before the step.
      const end = speedBefore >= 0 ? 1 : -1;
      const at = { x: s.van.x + f.x * VAN.halfLength * end, y: s.van.y + f.y * VAN.halfLength * end };
      events.push({ type: 'bump', strength: result.bump, at });
      const counting = s.run.enteredAt !== null && !s.run.parked;
      if (counting && s.simTime - s.run.lastBumpAt > BUMP_DEBOUNCE) {
        s.run.bumps++;
        if (s.run.hits.length < 12) s.run.hits.push(describeHit(s.map, at));
      }
      s.run.lastBumpAt = s.simTime;
    }
    if (!s.run.lap && s.run.enteredAt !== null && pointInRect(s.van, s.map.lapCheckpoint.rect)) {
      s.run.lap = true;
      events.push({ type: 'lap' });
    }
  } else {
    stepWalker(s.player, walkVector(raw), dt, (p) => blockedForWalker(s, p));
  }

  // Parking counts once the lap is done and the van has settled in the bay.
  if (s.run.lap && !s.run.parked) {
    const aligned =
      Math.abs(angleDiff(s.van.heading, s.map.bay.axis)) < PARK_ALIGN ||
      Math.abs(angleDiff(s.van.heading, s.map.bay.axis + Math.PI)) < PARK_ALIGN;
    const settled = Math.abs(s.van.speed) < 3 && aligned && inBay(s.map, vanCorners(s.van));
    s.run.parkTimer = settled ? s.run.parkTimer + dt : 0;
    if (s.run.parkTimer >= PARK_SETTLE && s.run.enteredAt !== null) {
      s.run.parked = true;
      s.run.lapSeconds = s.simTime - s.run.enteredAt;
      events.push({ type: 'parked', lapSeconds: s.run.lapSeconds });
      if (!s.phoneRinging) {
        s.phoneRinging = true;
        events.push({ type: 'ring' });
      }
    }
  }
  return events;
}

// -------------------------------------------------------------- objective

export function objective(s: Session): Objective {
  const map = s.map;
  const run = s.run;
  const inVan = s.locomotion === 'van';
  const van = { x: s.van.x, y: s.van.y };
  if (run.enteredAt === null) {
    return { text: run.n === 1 ? 'Walk to the van' : `Lap ${run.n} · get back in the van`, target: van };
  }
  if (!run.lap) {
    return inVan
      ? { text: 'Drive round the block by Ticket Street', target: rectCentre(map.lapCheckpoint.rect) }
      : { text: 'Get back in the van', target: van };
  }
  if (!run.parked) {
    return inVan
      ? { text: 'Park in the marked bay by the phone box', target: rectCentre(map.bay.rect) }
      : { text: 'Get back in the van', target: van };
  }
  if (inVan) return { text: 'Parked. Get out', target: null };
  return { text: 'Answer the phone', target: { x: map.phone.x, y: map.phone.y } };
}

/** Plain snapshot for the debug hook and for tests. */
export function snapshot(s: Session) {
  return {
    mode: s.mode,
    simTime: Number(s.simTime.toFixed(3)),
    preset: s.preset,
    locomotion: s.locomotion,
    player: { x: s.player.x, y: s.player.y },
    van: { x: s.van.x, y: s.van.y, heading: s.van.heading, speed: s.van.speed },
    phoneRinging: s.phoneRinging,
    action: availableAction(s),
    objective: objective(s).text,
    run: { ...s.run, presetsUsed: [...s.run.presetsUsed] },
    log: s.log.map((r) => ({ ...r })),
  };
}
