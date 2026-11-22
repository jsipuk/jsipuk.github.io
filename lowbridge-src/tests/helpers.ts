// Test harness: a session wired to a save store, and scripted walking/driving
// that follows the job arrow the way a player would.
import type { RawInput } from '../src/rules/controls.ts';
import { NO_INPUT } from '../src/rules/controls.ts';
import { angleDiff } from '../src/rules/math.ts';
import type { Vec } from '../src/rules/math.ts';
import type { StreetMap } from '../src/rules/map.ts';
import { buildRiverside } from '../src/rules/map.ts';
import { initialProgress } from '../src/rules/progress.ts';
import { nextWaypoint } from '../src/rules/route.ts';
import type { SaveStore } from '../src/rules/save.ts';
import { SaveController, createMemoryStore } from '../src/rules/save.ts';
import type { Session } from '../src/rules/session.ts';
import { checkpoint, createSession, driving, gates, interact, settled, stepSession } from '../src/rules/session.ts';

export const STEP = 1 / 60;
const MAP = buildRiverside();

export interface Harness {
  s: Session;
  store: SaveStore & { failWrites?: boolean };
  saves: SaveController;
}

/** A session on a fresh (or given) store, committing through a SaveController like the game does. */
export function harness(store: SaveStore & { failWrites?: boolean } = createMemoryStore(), map: StreetMap = MAP): Harness {
  const saves = new SaveController(store);
  const s = createSession(map, 'hybrid', initialProgress(), async (progress) => {
    const ok = await saves.write(progress, checkpoint(s));
    return ok ? 'ok' : saves.status === 'failed' ? 'failed' : 'conflict';
  });
  saves.onAdopt = (env) => {
    s.progress = env.progress;
  };
  return { s, store, saves };
}

export function run(s: Session, raw: RawInput, seconds: number): void {
  for (let t = 0; t < seconds; t += STEP) stepSession(s, raw, STEP);
}

export async function walkTo(s: Session, target: Vec, maxSeconds = 30): Promise<void> {
  let t = 0;
  let still = 0;
  let side = 1;
  let sidestep = 0;
  while (t < maxSeconds && Math.hypot(target.x - s.player.x, target.y - s.player.y) > 3) {
    let ang = Math.atan2(target.y - s.player.y, target.x - s.player.x);
    const before = { x: s.player.x, y: s.player.y };
    if (sidestep > 0) {
      sidestep -= STEP;
      ang += (side * Math.PI) / 2;
    }
    stepSession(s, { ...NO_INPUT, padX: Math.cos(ang), padY: Math.sin(ang) }, STEP);
    // Walked into something: step round it, as a person would.
    still = Math.hypot(s.player.x - before.x, s.player.y - before.y) < 0.05 ? still + STEP : 0;
    if (still > 0.15) {
      side = -side;
      sidestep = 0.35;
      still = 0;
    }
    t += STEP;
  }
  await settled(s);
}

/** Open a session from what a store holds, as a relaunch would. */
export async function relaunch(store: SaveStore & { failWrites?: boolean }, map: StreetMap = MAP): Promise<Harness> {
  const saves = new SaveController(store);
  const v = await saves.load();
  if (!v || !v.ok) throw new Error('nothing to relaunch from');
  const s = createSession(map, 'hybrid', v.envelope.progress, async (progress) => {
    const ok = await saves.write(progress, checkpoint(s));
    return ok ? 'ok' : saves.status === 'failed' ? 'failed' : 'conflict';
  }, v.envelope.checkpoint);
  saves.onAdopt = (env) => {
    s.progress = env.progress;
  };
  return { s, store, saves };
}

/** Get to a place: walk if it is close, otherwise drive the van there and walk the last bit. */
export async function travelTo(s: Session, target: Vec, opts: { park?: Vec } = {}): Promise<void> {
  const here = () => (driving(s) ? { x: driving(s)!.state.x, y: driving(s)!.state.y } : s.player);
  if (s.locomotion === 'foot' && Math.hypot(target.x - s.player.x, target.y - s.player.y) < 160) {
    await walkTo(s, target);
    return;
  }
  if (s.locomotion === 'foot') {
    await walkTo(s, { x: s.van.x + Math.cos(s.van.heading + Math.PI / 2) * 20, y: s.van.y + Math.sin(s.van.heading + Math.PI / 2) * 20 }, 90);
    await act(s);
    if ((s.locomotion as string) !== 'van') throw new Error(`could not get back in the van from ${Math.round(s.player.x)},${Math.round(s.player.y)}`);
  }
  await driveTo(s, opts.park ?? target, { stop: 40 });
  void here;
  await act(s);
  if ((s.locomotion as string) !== 'foot') throw new Error('could not get out');
  await walkTo(s, target);
}

/** Drive with steering C, following the road route to `target`, and stop within `stop` px. */
export async function driveTo(s: Session, target: Vec, opts: { stop?: number; maxSeconds?: number; top?: number } = {}): Promise<number> {
  const stop = opts.stop ?? 24;
  const max = opts.maxSeconds ?? 240;
  const top = opts.top ?? 95;
  let t = 0;
  let stuck = 0;
  let reversing = 0;
  for (; t < max; t += STEP) {
    const d = driving(s);
    if (!d) throw new Error('not driving');
    const v = d.state;
    const left = Math.hypot(target.x - v.x, target.y - v.y);
    if (left < stop) break;
    const aim = nextWaypoint(s.map, v, target, gates(s.progress));
    const ang = Math.atan2(aim.y - v.y, aim.x - v.x);
    const toAim = Math.hypot(aim.x - v.x, aim.y - v.y);
    const turn = Math.abs(angleDiff(ang, v.heading));
    const limit = left < 90 ? 35 : (toAim < 80 && aim !== target) || turn > 0.5 ? 45 : top;
    let raw: RawInput = { ...NO_INPUT, padX: Math.cos(ang), padY: Math.sin(ang), goButton: v.speed < limit ? 1 : 0, brake: v.speed > limit + 25 };
    stuck = Math.abs(v.speed) < 3 && raw.goButton ? stuck + STEP : 0;
    if (stuck > 0.6) {
      reversing = 0.7;
      stuck = 0;
    }
    if (reversing > 0) {
      reversing -= STEP;
      raw = { ...NO_INPUT, brake: true };
    }
    stepSession(s, raw, STEP);
  }
  for (let i = 0; i < 180 && driving(s) && Math.abs(driving(s)!.state.speed) > 0.5; i++) {
    stepSession(s, { ...NO_INPUT, brake: (driving(s)!.state.speed ?? 0) > 0 }, STEP);
  }
  await settled(s);
  return t;
}

export async function act(s: Session): Promise<void> {
  await interact(s);
  await settled(s);
}
