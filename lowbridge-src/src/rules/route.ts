// Road routing for the job arrow. The map's roads are straight strips; where
// two overlap there is a junction. The arrow points at the next junction on the
// shortest way along the roads, so following it never cuts through buildings.

import type { Rect, Vec } from './math.ts';
import { pointInRect } from './math.ts';
import type { StreetMap } from './map.ts';
import { TILE } from './map.ts';

interface Junction {
  id: string;
  at: Vec;
  roads: string[];
}

interface RouteGraph {
  junctions: Junction[];
  /** Road id to its junctions. */
  byRoad: Map<string, Junction[]>;
  rects: Map<string, Rect>;
}

const graphs = new WeakMap<StreetMap, RouteGraph>();

function graphFor(map: StreetMap): RouteGraph {
  const cached = graphs.get(map);
  if (cached) return cached;
  const rects = new Map<string, Rect>();
  for (const road of map.roads) {
    const r = road.rect;
    rects.set(road.id, { x: r.x * TILE, y: r.y * TILE, w: r.w * TILE, h: r.h * TILE });
  }
  const junctions: Junction[] = [];
  for (let i = 0; i < map.roads.length; i++) {
    for (let j = i + 1; j < map.roads.length; j++) {
      const a = rects.get(map.roads[i].id)!;
      const b = rects.get(map.roads[j].id)!;
      const x = Math.max(a.x, b.x);
      const y = Math.max(a.y, b.y);
      const r = Math.min(a.x + a.w, b.x + b.w);
      const btm = Math.min(a.y + a.h, b.y + b.h);
      if (r > x && btm > y) {
        junctions.push({
          id: `${map.roads[i].id}+${map.roads[j].id}`,
          at: { x: (x + r) / 2, y: (y + btm) / 2 },
          roads: [map.roads[i].id, map.roads[j].id],
        });
      }
    }
  }
  const byRoad = new Map<string, Junction[]>();
  for (const road of map.roads) byRoad.set(road.id, junctions.filter((j) => j.roads.includes(road.id)));
  const graph = { junctions, byRoad, rects };
  graphs.set(map, graph);
  return graph;
}

const dist = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);

function rectGap(p: Vec, r: Rect): number {
  const dx = Math.max(r.x - p.x, 0, p.x - (r.x + r.w));
  const dy = Math.max(r.y - p.y, 0, p.y - (r.y + r.h));
  return Math.hypot(dx, dy);
}

/** Roads a point is on, or the nearest road when it is off-road (a forecourt, a pavement). */
function roadsAt(graph: RouteGraph, p: Vec): string[] {
  const on = [...graph.rects].filter(([, r]) => pointInRect(p, r)).map(([id]) => id);
  if (on.length) return on;
  let best = '';
  let gap = Infinity;
  for (const [id, r] of graph.rects) {
    const g = rectGap(p, r);
    if (g < gap) {
      gap = g;
      best = id;
    }
  }
  return [best];
}

/**
 * Where the job arrow should point when heading from `from` to `to`: the target
 * itself if both are on the same road, otherwise the next junction along the
 * shortest road route. A junction the driver is already in is skipped.
 */
export function nextWaypoint(map: StreetMap, from: Vec, to: Vec, arrivedPx = 32): Vec {
  const graph = graphFor(map);
  const fromRoads = roadsAt(graph, from);
  const toRoads = new Set(roadsAt(graph, to));
  if (fromRoads.some((r) => toRoads.has(r))) return to;

  // Dijkstra over junctions, entered from the roads `from` is on.
  const best = new Map<string, number>();
  const firstStep = new Map<string, Junction>();
  const queue: { j: Junction; d: number; first: Junction }[] = [];
  for (const road of fromRoads) {
    for (const j of graph.byRoad.get(road) ?? []) {
      queue.push({ j, d: dist(from, j.at), first: j });
    }
  }
  let finish: { d: number; first: Junction } | null = null;
  while (queue.length) {
    queue.sort((a, b) => a.d - b.d);
    const { j, d, first } = queue.shift()!;
    if ((best.get(j.id) ?? Infinity) <= d) continue;
    best.set(j.id, d);
    firstStep.set(j.id, first);
    if (j.roads.some((r) => toRoads.has(r))) {
      const total = d + dist(j.at, to);
      if (!finish || total < finish.d) finish = { d: total, first };
    }
    for (const road of j.roads) {
      for (const k of graph.byRoad.get(road) ?? []) {
        if (k.id !== j.id) queue.push({ j: k, d: d + dist(j.at, k.at), first });
      }
    }
  }
  if (!finish) return to;
  // Already standing in that junction: point at the one after it, or the target.
  if (dist(from, finish.first.at) < arrivedPx) {
    const onward = nextWaypoint(map, finish.first.at, to, 0);
    return onward;
  }
  return finish.first.at;
}
