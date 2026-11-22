// The M0 handling block: the south-west corner of Riverside, laid out in the
// fixture's 72 x 48 tile frame so T04 can grow it into the full district.
// Fixture nodes used here: depot (9,39), depot_corner (9,30), ticket_office (22,30).

import type { Rect, Vec } from './math.ts';
import { pointInRect } from './math.ts';

export const TILE = 16;
export const MAP_W = 72;
export const MAP_H = 48;

export const Surface = {
  Void: 0,
  Building: 1,
  Road: 2,
  Pavement: 3,
  Yard: 4,
  Barrier: 5,
} as const;
export type SurfaceId = (typeof Surface)[keyof typeof Surface];

const SOLID = new Set<number>([Surface.Void, Surface.Building, Surface.Barrier]);

export interface TileRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Prop {
  id: string;
  kind: 'lamp';
  x: number;
  y: number;
  r: number;
}

export interface Building {
  id: string;
  rect: TileRect;
  label?: string;
}

export interface StreetMap {
  w: number;
  h: number;
  tiles: Uint8Array;
  /** Camera and play bounds in px. */
  region: Rect;
  roads: { id: string; name: string; rect: TileRect }[];
  buildings: Building[];
  props: Prop[];
  phone: { id: 'depot_payphone'; x: number; y: number; half: number; reach: number };
  bay: { id: 'depot_bay'; rect: Rect; axis: number };
  lapCheckpoint: { id: 'ticket_street'; rect: Rect };
  barrier: TileRect;
  vanStart: { x: number; y: number; heading: number };
  playerStart: Vec;
  /** Fixture nodes present in this block, in px (tile centres). */
  nodes: Record<string, Vec>;
}

export const tileCentre = (tx: number, ty: number): Vec => ({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 });
const tileRectPx = (r: TileRect): Rect => ({ x: r.x * TILE, y: r.y * TILE, w: r.w * TILE, h: r.h * TILE });

export function buildM0Map(): StreetMap {
  const w = MAP_W;
  const h = MAP_H;
  const tiles = new Uint8Array(w * h).fill(Surface.Void);
  const region: TileRect = { x: 0, y: 22, w: 42, h: 26 };

  const paint = (r: TileRect, s: SurfaceId, only?: SurfaceId) => {
    for (let y = Math.max(r.y, region.y); y < Math.min(r.y + r.h, region.y + region.h); y++) {
      for (let x = Math.max(r.x, region.x); x < Math.min(r.x + r.w, region.x + region.w); x++) {
        const i = y * w + x;
        if (only === undefined || tiles[i] === only) tiles[i] = s;
      }
    }
  };

  // Roads are five tiles wide with two-tile pavements.
  const roads = [
    { id: 'depot_lane', name: 'Depot Lane', rect: { x: 7, y: 28, w: 5, h: 19 } },
    { id: 'station_road', name: 'Station Road', rect: { x: 7, y: 28, w: 35, h: 5 } },
    { id: 'ticket_street', name: 'Ticket Street', rect: { x: 32, y: 28, w: 5, h: 19 } },
    { id: 'back_lane', name: 'Back Lane', rect: { x: 7, y: 42, w: 30, h: 5 } },
  ];

  paint(region, Surface.Building);
  for (const road of roads) {
    const r = road.rect;
    paint({ x: r.x - 2, y: r.y - 2, w: r.w + 4, h: r.h + 4 }, Surface.Pavement, Surface.Building);
  }
  for (const road of roads) paint(road.rect, Surface.Road);
  // Depot forecourt opens onto Depot Lane.
  paint({ x: 1, y: 39, w: 6, h: 6 }, Surface.Yard);
  // Ring road continues east in T04. Tonight it is closed at the edge of the block.
  const barrier: TileRect = { x: 40, y: 28, w: 1, h: 5 };
  paint(barrier, Surface.Barrier);

  const buildings: Building[] = [
    { id: 'depot', rect: { x: 0, y: 26, w: 5, h: 13 }, label: 'DEPOT' },
    { id: 'depot_rear', rect: { x: 0, y: 45, w: 5, h: 3 } },
    { id: 'terrace_west', rect: { x: 0, y: 22, w: 20, h: 4 } },
    { id: 'builders_yard_gate', rect: { x: 20, y: 22, w: 5, h: 4 }, label: 'YARD' },
    { id: 'terrace_east', rect: { x: 25, y: 22, w: 17, h: 4 } },
    { id: 'chapel_row', rect: { x: 14, y: 35, w: 4, h: 5 } },
    { id: 'ticket_office', rect: { x: 18, y: 35, w: 7, h: 5 }, label: 'TICKETS' },
    { id: 'launderette', rect: { x: 25, y: 35, w: 5, h: 5 } },
    { id: 'east_block', rect: { x: 39, y: 35, w: 3, h: 13 } },
  ];

  const lamp = (id: string, x: number, y: number): Prop => ({ id, kind: 'lamp', x, y, r: 3 });
  // Lamp posts stand at the back of the pavement, so clipping a kerb on a corner doesn't hit one.
  const props: Prop[] = [
    lamp('lamp_depot_north', 86, 456),
    lamp('lamp_depot_south', 86, 744),
    lamp('lamp_station_1', 200, 422),
    lamp('lamp_station_2', 328, 422),
    lamp('lamp_station_3', 456, 422),
    lamp('lamp_station_4', 584, 422),
    lamp('lamp_block_ne', 264, 554),
    lamp('lamp_block_nw', 424, 554),
    lamp('lamp_back_lane', 344, 646),
    lamp('lamp_ticket_east', 618, 600),
    lamp('lamp_depot_east', 218, 600),
  ];

  return {
    w,
    h,
    tiles,
    region: tileRectPx(region),
    roads,
    buildings,
    props,
    phone: { id: 'depot_payphone', x: 88, y: 546, half: 6, reach: 26 },
    // Kerbside bay on the northbound (left-hand) lane of Depot Lane, beside the phone box.
    bay: { id: 'depot_bay', rect: { x: 112, y: 544, w: 32, h: 48 }, axis: -Math.PI / 2 },
    lapCheckpoint: { id: 'ticket_street', rect: { x: 512, y: 544, w: 80, h: 112 } },
    barrier,
    vanStart: { x: 60, y: 680, heading: 0 },
    playerStart: { x: 88, y: 604 },
    nodes: {
      depot: tileCentre(9, 39),
      depot_corner: tileCentre(9, 30),
      ticket_office: tileCentre(22, 30),
    },
  };
}

export function surfaceAt(map: StreetMap, x: number, y: number): SurfaceId {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  if (tx < 0 || ty < 0 || tx >= map.w || ty >= map.h) return Surface.Void;
  return map.tiles[ty * map.w + tx] as SurfaceId;
}

/** Fixed obstacles: solid tiles, lamp posts and the phone box. */
export function isBlocked(map: StreetMap, p: Vec): boolean {
  if (SOLID.has(surfaceAt(map, p.x, p.y))) return true;
  for (const prop of map.props) {
    if ((p.x - prop.x) ** 2 + (p.y - prop.y) ** 2 < prop.r * prop.r) return true;
  }
  const ph = map.phone;
  return Math.abs(p.x - ph.x) < ph.half && Math.abs(p.y - ph.y) < ph.half;
}

export const isWalkableSurface = (s: SurfaceId): boolean => !SOLID.has(s);

export function inBay(map: StreetMap, corners: Vec[]): boolean {
  return corners.every((c) => pointInRect(c, map.bay.rect, 1));
}
