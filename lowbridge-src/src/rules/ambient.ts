// The town around the job: people on the pavements and pigeons that scatter.
// Pure and seeded, so it runs under node --test. Nobody gets hurt: vehicles
// make people step aside, and a bump makes them stumble and shout.

import type { Vec } from './math.ts';
import { distanceToBox, forward, rightOf } from './math.ts';
import type { StreetMap } from './map.ts';
import { isBlocked } from './map.ts';
import { BRUSH_LINES, BUMP_LINES, FLOCKS, HORN_LINES, LOCALS, PASSER_LINES, PASSERS } from './content.ts';

export interface Ped {
  id: string;
  /** Named locals have a name; passers-by do not. */
  name: string | null;
  coat: string;
  path: Vec[];
  seg: number;
  dir: 1 | -1;
  x: number;
  y: number;
  heading: number;
  state: 'walk' | 'dodge' | 'stumble';
  /** Seconds left in the current dodge or stumble. */
  t: number;
  dodge: Vec;
  /** Seconds until this person reacts out loud again. */
  quiet: number;
  lines: string[];
  lineIdx: number;
}

export interface Bird {
  ox: number;
  oy: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  state: 'ground' | 'flying' | 'gone' | 'landing';
  t: number;
}

export interface Flock {
  id: string;
  home: Vec;
  birds: Bird[];
  /** Seconds until the flock comes back after scattering. */
  away: number;
}

export interface Ambient {
  peds: Ped[];
  flocks: Flock[];
  seed: number;
}

/** A body the town reacts to: the courier on foot, or the vehicle they drive. */
export interface Mover {
  pos: Vec;
  vehicle: { heading: number; speed: number; halfLength: number; halfWidth: number } | null;
}

export type AmbientEvent =
  | { type: 'pigeons'; count: number; at: Vec }
  | { type: 'ped_bump'; id: string; name: string | null; line: string; at: Vec }
  | { type: 'ped_brush'; id: string; name: string | null; line: string; at: Vec }
  | { type: 'ped_horn'; id: string; name: string | null; line: string; at: Vec };

const WALK_SPEED = 24;
const SCATTER_RADIUS = 30;
const HORN_RADIUS = 150;

function rand(a: Ambient): number {
  a.seed = (a.seed * 1664525 + 1013904223) >>> 0;
  return a.seed / 4294967296;
}

export function createAmbient(seed = 7): Ambient {
  const a: Ambient = { peds: [], flocks: [], seed };
  const ped = (id: string, name: string | null, coat: string, path: Vec[], lines: string[], start: number): Ped => {
    const from = path[0];
    const to = path[Math.min(1, path.length - 1)];
    const x = from.x + (to.x - from.x) * start;
    const y = from.y + (to.y - from.y) * start;
    return { id, name, coat, path, seg: 0, dir: 1, x, y, heading: Math.atan2(to.y - from.y, to.x - from.x), state: 'walk', t: 0, dodge: { x: 0, y: 0 }, quiet: 0, lines, lineIdx: 0 };
  };
  for (const l of LOCALS) a.peds.push(ped(l.id, l.name, l.coat, l.path, l.lines, 0.3));
  PASSERS.forEach((p, i) => a.peds.push(ped(p.id, null, p.coat, p.path, PASSER_LINES, (i * 0.37) % 1)));
  for (const f of FLOCKS) {
    const birds: Bird[] = [];
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2 + 0.4;
      const r = 6 + (i % 3) * 4;
      const ox = Math.cos(ang) * r;
      const oy = Math.sin(ang) * r * 0.6;
      birds.push({ ox, oy, x: f.at.x + ox, y: f.at.y + oy, vx: 0, vy: 0, state: 'ground', t: 0 });
    }
    a.flocks.push({ id: f.id, home: { ...f.at }, birds, away: 0 });
  }
  return a;
}

const pick = (a: Ambient, lines: readonly string[]) => lines[Math.floor(rand(a) * lines.length) % lines.length];

/** Send a flock up and away from a point. Returns how many birds were on the ground. */
function scatter(a: Ambient, f: Flock, from: Vec): number {
  let count = 0;
  for (const b of f.birds) {
    if (b.state !== 'ground' && b.state !== 'landing') continue;
    count++;
    const ang = Math.atan2(b.y - from.y, b.x - from.x) + (rand(a) - 0.5) * 0.9;
    const speed = 70 + rand(a) * 40;
    b.vx = Math.cos(ang) * speed;
    b.vy = Math.sin(ang) * speed - 20;
    b.state = 'flying';
    b.t = 1.4;
  }
  if (count) f.away = 16 + rand(a) * 10;
  return count;
}

export function stepAmbient(a: Ambient, map: StreetMap, m: Mover, dt: number): AmbientEvent[] {
  const events: AmbientEvent[] = [];
  const v = m.vehicle;

  // Pigeons: anything coming within reach of a bird on the ground sends the flock up.
  for (const f of a.flocks) {
    const near = f.birds.some((b) => b.state === 'ground' && reach(m, b) < SCATTER_RADIUS);
    if (near) {
      const count = scatter(a, f, m.pos);
      if (count) events.push({ type: 'pigeons', count, at: { ...f.home } });
    }
    for (const b of f.birds) {
      if (b.state === 'flying') {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.t -= dt;
        if (b.t <= 0) b.state = 'gone';
      } else if (b.state === 'landing') {
        b.t -= dt;
        const k = Math.max(0, b.t / 0.8);
        b.x = f.home.x + b.ox + b.vx * k;
        b.y = f.home.y + b.oy + b.vy * k;
        if (b.t <= 0) b.state = 'ground';
      }
    }
    if (f.away > 0) {
      f.away -= dt;
      const clear = Math.hypot(m.pos.x - f.home.x, m.pos.y - f.home.y) > 90;
      if (f.away <= 0 && clear) {
        // Drift back in from a little way off.
        for (const b of f.birds) {
          b.state = 'landing';
          b.t = 0.8;
          b.vx = (rand(a) - 0.5) * 60;
          b.vy = -30 - rand(a) * 20;
        }
      } else if (f.away <= 0) {
        f.away = 2;
      }
    }
  }

  // People.
  for (const p of a.peds) {
    p.quiet = Math.max(0, p.quiet - dt);
    if (v) {
      const gap = distanceToBox(p, m.pos.x, m.pos.y, v.heading, v.halfLength, v.halfWidth);
      const moving = Math.abs(v.speed) > 5;
      if (gap < 4 && moving && p.state !== 'stumble') {
        // Bumped: pushed clear, a stumble and a shout. Never hurt.
        const side = sideOf(p, m.pos, v.heading);
        const r = rightOf(v.heading);
        p.x += r.x * side * 12;
        p.y += r.y * side * 12;
        p.state = 'stumble';
        p.t = 1;
        if (p.quiet === 0) {
          p.quiet = 3;
          events.push({ type: 'ped_bump', id: p.id, name: p.name, line: pick(a, BUMP_LINES), at: { x: p.x, y: p.y } });
        }
        continue;
      }
      // Step aside from a vehicle heading this way.
      if (p.state === 'walk' && Math.abs(v.speed) > 15) {
        const f = forward(v.heading);
        const dx = p.x - m.pos.x;
        const dy = p.y - m.pos.y;
        const ahead = (dx * f.x + dy * f.y) * Math.sign(v.speed);
        const r = rightOf(v.heading);
        const lateral = dx * r.x + dy * r.y;
        if (ahead > 0 && ahead < 70 && Math.abs(lateral) < v.halfWidth + 16) {
          const side = lateral >= 0 ? 1 : -1;
          const target = { x: p.x + r.x * side * 26, y: p.y + r.y * side * 26 };
          const ok = !isBlocked(map, target);
          p.dodge = ok ? { x: r.x * side, y: r.y * side } : { x: -r.x * side, y: -r.y * side };
          p.state = 'dodge';
          p.t = 0.6;
        }
      }
    } else if (Math.hypot(p.x - m.pos.x, p.y - m.pos.y) < 9 && p.quiet === 0) {
      // Walking into someone on foot.
      p.quiet = 6;
      events.push({ type: 'ped_brush', id: p.id, name: p.name, line: pick(a, BRUSH_LINES), at: { x: p.x, y: p.y } });
    }

    if (p.state === 'dodge') {
      const nx = p.x + p.dodge.x * 45 * dt;
      const ny = p.y + p.dodge.y * 45 * dt;
      if (!isBlocked(map, { x: nx, y: ny })) {
        p.x = nx;
        p.y = ny;
      }
      p.t -= dt;
      if (p.t <= 0) p.state = 'walk';
      continue;
    }
    if (p.state === 'stumble') {
      p.t -= dt;
      if (p.t <= 0) p.state = 'walk';
      continue;
    }
    if (p.path.length < 2) continue;
    const target = p.path[p.dir === 1 ? p.seg + 1 : p.seg];
    const dx = target.x - p.x;
    const dy = target.y - p.y;
    const d = Math.hypot(dx, dy);
    if (d < 2) {
      if (p.dir === 1 && p.seg + 1 >= p.path.length - 1) p.dir = -1;
      else if (p.dir === -1 && p.seg <= 0) p.dir = 1;
      else p.seg += p.dir;
      continue;
    }
    p.heading = Math.atan2(dy, dx);
    p.x += (dx / d) * Math.min(d, WALK_SPEED * dt);
    p.y += (dy / d) * Math.min(d, WALK_SPEED * dt);
  }
  return events;
}

function reach(m: Mover, b: Vec): number {
  if (!m.vehicle) return Math.hypot(b.x - m.pos.x, b.y - m.pos.y);
  const v = m.vehicle;
  return distanceToBox(b, m.pos.x, m.pos.y, v.heading, v.halfLength, v.halfWidth);
}

function sideOf(p: Vec, at: Vec, heading: number): number {
  const r = rightOf(heading);
  return (p.x - at.x) * r.x + (p.y - at.y) * r.y >= 0 ? 1 : -1;
}

/** The van's horn: pigeons nearby scatter and people nearby complain. */
export function honk(a: Ambient, at: Vec): AmbientEvent[] {
  const events: AmbientEvent[] = [];
  for (const f of a.flocks) {
    if (Math.hypot(f.home.x - at.x, f.home.y - at.y) < HORN_RADIUS) {
      const count = scatter(a, f, at);
      if (count) events.push({ type: 'pigeons', count, at: { ...f.home } });
    }
  }
  for (const p of a.peds) {
    if (Math.hypot(p.x - at.x, p.y - at.y) < 90 && p.quiet === 0) {
      p.quiet = 5;
      events.push({ type: 'ped_horn', id: p.id, name: p.name, line: pick(a, HORN_LINES), at: { x: p.x, y: p.y } });
      break;
    }
  }
  return events;
}

/** The person close enough to talk to, if any. */
export function talkTarget(a: Ambient, at: Vec, reachPx = 20): Ped | null {
  let best: Ped | null = null;
  let bestD = reachPx;
  for (const p of a.peds) {
    const d = Math.hypot(p.x - at.x, p.y - at.y);
    if (d < bestD) {
      best = p;
      bestD = d;
    }
  }
  return best;
}

/** Their next line: named locals go through theirs in order; passers-by pick at random. */
export function talk(a: Ambient, p: Ped): string {
  if (p.name) {
    const line = p.lines[p.lineIdx % p.lines.length];
    p.lineIdx += 1;
    return line;
  }
  return pick(a, p.lines);
}
