// Test helpers: a scripted driver that completes the M0 lap with either preset.
import type { RawInput, SteeringPreset } from '../src/rules/controls.ts';
import { NO_INPUT } from '../src/rules/controls.ts';
import { angleDiff, clamp } from '../src/rules/math.ts';
import type { Vec } from '../src/rules/math.ts';
import type { GameEvent, Session } from '../src/rules/session.ts';
import { stepSession } from '../src/rules/session.ts';
import { VAN } from '../src/rules/vehicle.ts';

export const STEP = 1 / 60;

// Left-hand traffic, clockwise round the block, finishing northbound into the bay.
export const LAP_WAYPOINTS: Vec[] = [
  { x: 104, y: 680 },
  { x: 132, y: 640 },
  { x: 132, y: 500 },
  { x: 180, y: 506 },
  { x: 540, y: 506 },
  { x: 572, y: 550 },
  { x: 572, y: 712 },
  { x: 530, y: 730 },
  { x: 160, y: 730 },
  { x: 130, y: 690 },
  { x: 128, y: 620 },
];
export const BAY_STOP: Vec = { x: 128, y: 568 };

export function inputTowards(s: Session, target: Vec, preset: SteeringPreset, speedLimit = 1): RawInput {
  const dx = target.x - s.van.x;
  const dy = target.y - s.van.y;
  const d = Math.hypot(dx, dy) || 1;
  if (preset === 'pad') {
    return { ...NO_INPUT, padX: (dx / d) * speedLimit, padY: (dy / d) * speedLimit };
  }
  if (preset === 'hybrid') {
    return { ...NO_INPUT, padX: dx / d, padY: dy / d, goButton: s.van.speed < VAN.maxForward * speedLimit ? 1 : 0 };
  }
  const diff = angleDiff(Math.atan2(dy, dx), s.van.heading);
  const wantSlow = Math.abs(diff) > 0.6;
  return {
    ...NO_INPUT,
    wheelSteer: clamp(diff / 0.35, -1, 1),
    wheelThrottle: s.van.speed > VAN.maxForward * speedLimit || (wantSlow && s.van.speed > 70) ? 0 : 1,
  };
}

/** Point `ahead` px further along the polyline from the van's projection onto segment `seg`. */
function pursuit(path: Vec[], seg: number, from: Vec, ahead: number): { seg: number; target: Vec } {
  let i = seg;
  // Move on once the van has passed the end of the current segment.
  for (;;) {
    if (i >= path.length - 1) return { seg: i, target: path[path.length - 1] };
    const a = path[i];
    const b = path[i + 1];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const t = ((from.x - a.x) * (b.x - a.x) + (from.y - a.y) * (b.y - a.y)) / (len * len);
    if (t < 1) break;
    i++;
  }
  const a = path[i];
  const b = path[i + 1];
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const t = Math.max(0, ((from.x - a.x) * (b.x - a.x) + (from.y - a.y) * (b.y - a.y)) / (len * len));
  let remaining = ahead + t * len;
  let j = i;
  while (j < path.length - 1) {
    const p = path[j];
    const q = path[j + 1];
    const l = Math.hypot(q.x - p.x, q.y - p.y);
    if (remaining <= l) return { seg: i, target: { x: p.x + ((q.x - p.x) * remaining) / l, y: p.y + ((q.y - p.y) * remaining) / l } };
    remaining -= l;
    j++;
  }
  return { seg: i, target: path[path.length - 1] };
}

/** Drive the lap and stop in the bay. Returns every event seen. */
export function driveLap(s: Session, preset: SteeringPreset, maxSeconds = 90): GameEvent[] {
  const events: GameEvent[] = [];
  const path = LAP_WAYPOINTS;
  let seg = 0;
  let t = 0;
  const end = path[path.length - 1];
  while (t < maxSeconds && !(seg >= path.length - 2 && Math.hypot(end.x - s.van.x, end.y - s.van.y) < 20)) {
    const next = pursuit(path, seg, s.van, 40);
    seg = next.seg;
    const limit = seg >= path.length - 3 ? 0.4 : 0.65;
    events.push(...stepSession(s, inputTowards(s, next.target, preset, limit), STEP));
    t += STEP;
  }
  // Creep up to the bay and stop.
  while (t < maxSeconds && !s.run.parked) {
    const gap = s.van.y - BAY_STOP.y;
    const raw: RawInput =
      gap > 6 ? inputTowards(s, BAY_STOP, preset, 0.3) : { ...NO_INPUT, brake: s.van.speed > 0 };
    events.push(...stepSession(s, raw, STEP));
    t += STEP;
  }
  return events;
}

export function walkTo(s: Session, target: Vec, maxSeconds = 20): void {
  let t = 0;
  while (t < maxSeconds && Math.hypot(target.x - s.player.x, target.y - s.player.y) > 3) {
    const dx = target.x - s.player.x;
    const dy = target.y - s.player.y;
    const d = Math.hypot(dx, dy);
    stepSession(s, { ...NO_INPUT, padX: dx / d, padY: dy / d }, STEP);
    t += STEP;
  }
}
