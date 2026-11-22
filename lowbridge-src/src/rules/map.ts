// Riverside, the first district, in the fixture's 72 x 48 tile frame (16 px tiles).
//
// Fixture connections are kept; some nodes moved so five-tile roads fit with
// pavements and buildings between them (see docs/05-build-board.md, M1 record):
//   depot (9,39) - depot_corner (9,30) - ticket_office (22,30) - ring_east (61,30)
//   ring_east - ring_north (61,16) - merge (34,16) - fork (34,6)
//   fork - quay (12,6)    fork - market (56,6)
//   ticket_office - yard_in (22,23) through the yard shutter, yard_in - yard_out (34,23) - merge
// The ring road is the long, always-open way; the yard is the short way once
// Clatterjack lifts the shutter. M0's back streets (Ticket Street, Back Lane) stay.

import type { Rect, Vec } from './math.ts';
import { pointInRect } from './math.ts';

export const TILE = 16;
export const MAP_W = 72;
export const MAP_H = 48;
/** Rows of river drawn above row 0 so the top of the map reads as water. */
export const RIVER_ROWS_ABOVE = 8;

export const Surface = {
  Void: 0,
  Building: 1,
  Road: 2,
  Pavement: 3,
  Yard: 4,
  Water: 5,
  Fence: 6,
} as const;
export type SurfaceId = (typeof Surface)[keyof typeof Surface];

const SOLID = new Set<number>([Surface.Void, Surface.Building, Surface.Water, Surface.Fence]);

export interface TileRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Solid round obstacle: lamp post or bollard. */
export interface Prop {
  id: string;
  kind: 'lamp' | 'bollard';
  x: number;
  y: number;
  r: number;
}

/** Solid box obstacle: market stall, ticket machine. */
export interface Block {
  id: string;
  kind: 'stall' | 'ticket_machine';
  rect: Rect;
}

export interface Building {
  id: string;
  rect: TileRect;
  label?: string;
}

export interface Road {
  id: string;
  name: string;
  rect: TileRect;
  /** A flag that must be set for routing through this road (the yard shutter). */
  gate?: 'yard_shutter_open';
}

export interface Pose {
  x: number;
  y: number;
  heading: number;
}

export interface StreetMap {
  w: number;
  h: number;
  tiles: Uint8Array;
  /** Camera bounds in px (includes the drawn river above row 0). */
  region: Rect;
  roads: Road[];
  buildings: Building[];
  props: Prop[];
  blocks: Block[];
  phone: { id: 'depot_payphone'; x: number; y: number; half: number; reach: number };
  bay: { id: 'depot_bay'; rect: Rect; axis: number };
  /** The builders' yard shutter: solid until Clatterjack lifts it. */
  shutter: { id: 'yard_shutter'; rect: Rect; reach: number };
  /** Ticket machine where the wild Clatterjack lives. */
  machine: { id: 'ticket_machine'; x: number; y: number; reach: number; noticeRadius: number };
  /** Footprint the courier must leave for Nell's counteroffer ("first departure from depot"). */
  depotArea: Rect;
  people: {
    mo_vale: { x: number; y: number; reach: number };
    nell_price: { x: number; y: number; reach: number };
  };
  ferry: Rect;
  stalls: Rect[];
  vanStart: Pose;
  expressStart: Pose;
  patrolSpawn: Pose;
  playerStart: Vec;
  /** Fixture nodes, in px at tile centres. */
  nodes: Record<string, Vec>;
}

export const tileCentre = (tx: number, ty: number): Vec => ({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 });
const px = (r: TileRect): Rect => ({ x: r.x * TILE, y: r.y * TILE, w: r.w * TILE, h: r.h * TILE });

export function buildRiverside(): StreetMap {
  const w = MAP_W;
  const h = MAP_H;
  const tiles = new Uint8Array(w * h).fill(Surface.Building);
  const at = (x: number, y: number) => tiles[y * w + x];
  const paint = (r: TileRect, s: SurfaceId, when: (cur: number) => boolean = () => true) => {
    for (let y = Math.max(r.y, 0); y < Math.min(r.y + r.h, h); y++) {
      for (let x = Math.max(r.x, 0); x < Math.min(r.x + r.w, w); x++) {
        if (when(at(x, y))) tiles[y * w + x] = s;
      }
    }
  };

  const roads: Road[] = [
    { id: 'depot_lane', name: 'Depot Lane', rect: { x: 7, y: 28, w: 5, h: 19 } },
    { id: 'station_road', name: 'Station Road', rect: { x: 7, y: 28, w: 57, h: 5 } },
    { id: 'ticket_street', name: 'Ticket Street', rect: { x: 32, y: 28, w: 5, h: 19 } },
    { id: 'back_lane', name: 'Back Lane', rect: { x: 7, y: 42, w: 30, h: 5 } },
    { id: 'ring_east', name: 'Ring Road', rect: { x: 59, y: 14, w: 5, h: 19 } },
    { id: 'ring_north', name: 'Ring Road', rect: { x: 32, y: 14, w: 32, h: 5 } },
    { id: 'yard_lane', name: 'Yard Lane', rect: { x: 32, y: 4, w: 5, h: 22 } },
    { id: 'yard_road', name: "Builders' Yard", rect: { x: 20, y: 21, w: 17, h: 5 } },
    { id: 'yard_gate', name: "Builders' Yard gate", rect: { x: 20, y: 21, w: 5, h: 8 }, gate: 'yard_shutter_open' },
    { id: 'harbour_road', name: 'Harbour Road', rect: { x: 6, y: 4, w: 53, h: 5 } },
  ];

  // Pavements two tiles wide around every road, then the roads themselves.
  for (const road of roads) {
    const r = road.rect;
    paint({ x: r.x - 2, y: r.y - 2, w: r.w + 4, h: r.h + 4 }, Surface.Pavement, (c) => c === Surface.Building);
  }
  for (const road of roads) paint(road.rect, Surface.Road);

  // The river along the top, the quay apron and ferry ramp, the market square.
  paint({ x: 0, y: 0, w: 46, h: 2 }, Surface.Water);
  paint({ x: 4, y: 1, w: 14, h: 3 }, Surface.Yard);
  paint({ x: 46, y: 0, w: 18, h: 4 }, Surface.Pavement);

  // Builders' yard: concrete inside a fence, with the shutter in the south gateway.
  paint({ x: 18, y: 19, w: 21, h: 7 }, Surface.Yard, (c) => c !== Surface.Road);
  const fence = (r: TileRect) => paint(r, Surface.Fence, (c) => c !== Surface.Road);
  fence({ x: 18, y: 19, w: 21, h: 1 });
  fence({ x: 18, y: 26, w: 21, h: 1 });
  fence({ x: 18, y: 19, w: 1, h: 8 });
  fence({ x: 38, y: 19, w: 1, h: 8 });

  // Depot forecourt, the ticket-office lay-by, and a footpath walkers can use but vans can't.
  paint({ x: 1, y: 39, w: 6, h: 6 }, Surface.Yard);
  paint({ x: 17, y: 33, w: 9, h: 1 }, Surface.Road);
  paint({ x: 46, y: 19, w: 3, h: 9 }, Surface.Pavement);

  const buildings: Building[] = [
    { id: 'depot', rect: { x: 0, y: 26, w: 5, h: 13 }, label: 'DEPOT' },
    { id: 'depot_rear', rect: { x: 0, y: 45, w: 5, h: 3 } },
    { id: 'chapel_row', rect: { x: 14, y: 35, w: 4, h: 5 } },
    { id: 'ticket_office', rect: { x: 18, y: 35, w: 7, h: 5 }, label: 'TICKETS' },
    { id: 'launderette', rect: { x: 25, y: 35, w: 5, h: 5 } },
    { id: 'harbour_block', rect: { x: 0, y: 11, w: 30, h: 8 } },
    { id: 'west_block', rect: { x: 0, y: 19, w: 18, h: 7 } },
    { id: 'north_terrace', rect: { x: 39, y: 11, w: 18, h: 1 } },
    { id: 'mid_east', rect: { x: 39, y: 21, w: 7, h: 5 } },
    { id: 'mid_east_2', rect: { x: 49, y: 21, w: 8, h: 5 } },
    { id: 'east_edge', rect: { x: 66, y: 0, w: 6, h: 48 } },
    { id: 'south_east', rect: { x: 39, y: 35, w: 18, h: 13 } },
    { id: 'ring_corner', rect: { x: 57, y: 35, w: 9, h: 13 } },
  ];

  const lamp = (id: string, x: number, y: number): Prop => ({ id, kind: 'lamp', x, y, r: 3 });
  const bollard = (id: string, x: number, y: number): Prop => ({ id, kind: 'bollard', x, y, r: 3 });
  // Lamp posts stand at the back of the pavement, so clipping a kerb on a corner doesn't hit one.
  const props: Prop[] = [
    lamp('lamp_depot_north', 86, 456),
    lamp('lamp_depot_south', 86, 744),
    lamp('lamp_station_1', 200, 422),
    lamp('lamp_station_4', 584, 422),
    lamp('lamp_station_5', 680, 422),
    lamp('lamp_station_6', 900, 422),
    lamp('lamp_block_ne', 264, 554),
    lamp('lamp_block_nw', 424, 554),
    lamp('lamp_back_lane', 344, 646),
    lamp('lamp_ticket_east', 618, 600),
    lamp('lamp_depot_east', 218, 600),
    lamp('lamp_ring_east', 1050, 360),
    lamp('lamp_ring_north_1', 600, 198),
    lamp('lamp_ring_north_2', 820, 198),
    lamp('lamp_yard_lane', 486, 184),
    lamp('lamp_harbour_1', 300, 166),
    lamp('lamp_harbour_2', 700, 166),
    lamp('lamp_quay', 120, 26),
    lamp('lamp_market', 760, 26),
    // Bollards close the footpath to vehicles; walkers pass between them.
    bollard('bollard_path_n1', 753, 360),
    bollard('bollard_path_n2', 767, 360),
    bollard('bollard_path_s1', 753, 408),
    bollard('bollard_path_s2', 767, 408),
  ];

  const stalls: Rect[] = [
    { x: 48 * TILE, y: 0, w: 3 * TILE, h: 2 * TILE },
    { x: 52 * TILE, y: 0, w: 3 * TILE, h: 2 * TILE },
    { x: 56 * TILE, y: 0, w: 3 * TILE, h: 2 * TILE },
    { x: 60 * TILE, y: 0, w: 3 * TILE, h: 2 * TILE },
  ];
  const machine = { id: 'ticket_machine' as const, x: 344, y: 551, reach: 26, noticeRadius: 140 };
  const blocks: Block[] = [
    ...stalls.map((rect, i) => ({ id: `stall_${i + 1}`, kind: 'stall' as const, rect })),
    { id: 'ticket_machine', kind: 'ticket_machine', rect: { x: machine.x - 6, y: machine.y - 5, w: 12, h: 9 } },
  ];

  return {
    w,
    h,
    tiles,
    region: { x: 0, y: -RIVER_ROWS_ABOVE * TILE, w: w * TILE, h: (h + RIVER_ROWS_ABOVE) * TILE },
    roads,
    buildings,
    props,
    blocks,
    phone: { id: 'depot_payphone', x: 88, y: 546, half: 6, reach: 26 },
    bay: { id: 'depot_bay', rect: { x: 112, y: 544, w: 32, h: 48 }, axis: -Math.PI / 2 },
    shutter: { id: 'yard_shutter', rect: px({ x: 20, y: 26, w: 5, h: 1 }), reach: 26 },
    machine,
    depotArea: px({ x: 0, y: 33, w: 13, h: 15 }),
    people: {
      mo_vale: { x: 13 * TILE, y: 2.6 * TILE, reach: 28 },
      nell_price: { x: 57.5 * TILE, y: 2.7 * TILE, reach: 28 },
    },
    ferry: { x: 3 * TILE, y: -4 * TILE, w: 11 * TILE, h: 3.4 * TILE },
    stalls,
    vanStart: { x: 60, y: 680, heading: 0 },
    expressStart: { x: 21.5 * TILE, y: 33.5 * TILE, heading: 0 },
    patrolSpawn: { x: 61.5 * TILE, y: 16.5 * TILE, heading: Math.PI / 2 },
    playerStart: { x: 88, y: 604 },
    nodes: {
      depot: tileCentre(9, 39),
      depot_corner: tileCentre(9, 30),
      ticket_office: tileCentre(22, 30),
      ring_east: tileCentre(61, 30),
      ring_north: tileCentre(61, 16),
      yard_in: tileCentre(22, 23),
      yard_out: tileCentre(34, 23),
      merge: tileCentre(34, 16),
      fork: tileCentre(34, 6),
      quay: tileCentre(12, 6),
      market: tileCentre(56, 6),
    },
  };
}

export function surfaceAt(map: StreetMap, x: number, y: number): SurfaceId {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  if (tx < 0 || ty < 0 || tx >= map.w || ty >= map.h) return Surface.Void;
  return map.tiles[ty * map.w + tx] as SurfaceId;
}

/** Fixed obstacles: solid tiles, props, stalls, the machine, the phone box and (unless lifted) the shutter. */
export function isBlocked(map: StreetMap, p: Vec, shutterOpen = false): boolean {
  if (SOLID.has(surfaceAt(map, p.x, p.y))) return true;
  for (const prop of map.props) {
    if ((p.x - prop.x) ** 2 + (p.y - prop.y) ** 2 < prop.r * prop.r) return true;
  }
  for (const b of map.blocks) if (pointInRect(p, b.rect)) return true;
  const ph = map.phone;
  if (Math.abs(p.x - ph.x) < ph.half && Math.abs(p.y - ph.y) < ph.half) return true;
  return !shutterOpen && pointInRect(p, map.shutter.rect);
}

export const isWalkableSurface = (s: SurfaceId): boolean => !SOLID.has(s);

export const isDriveSurface = (s: SurfaceId): boolean =>
  s === Surface.Road || s === Surface.Pavement || s === Surface.Yard;

export function inBay(map: StreetMap, corners: Vec[]): boolean {
  return corners.every((c) => pointInRect(c, map.bay.rect, 1));
}

/** Distance from a point to a rect's edge (0 inside). */
export function gapToRect(p: Vec, r: Rect): number {
  const dx = Math.max(r.x - p.x, 0, p.x - (r.x + r.w));
  const dy = Math.max(r.y - p.y, 0, p.y - (r.y + r.h));
  return Math.hypot(dx, dy);
}
