// Greybox art drawn to canvases at 2x: wet teal brick, amber lamps, cream
// signs, a dark river. Original placeholders only.

import type { StyleItem } from './rules/content.ts';
import { HAT_STYLES, JACKET_STYLES, PLACES, SHOPS, VAN_BODIES, VAN_STRIPES } from './rules/content.ts';
import type { StreetMap, TileRect } from './rules/map.ts';
import { Surface, TILE } from './rules/map.ts';
import { EXPRESS, PATROL, VAN } from './rules/vehicle.ts';

export const ART_SCALE = 2;
const S = ART_SCALE;

export const PALETTE = {
  void: '#081012',
  brick: '#1d383b',
  brickLight: '#244448',
  mortar: '#152b2e',
  roof: '#2a4b4f',
  roofEdge: '#3a6064',
  pavement: '#36413f',
  slab: '#2e3836',
  kerb: '#6e7672',
  road: '#191f22',
  roadSpeck: '#222a2d',
  line: 'rgba(233, 223, 196, 0.55)',
  yard: '#262d2d',
  water: '#0c2430',
  waterLight: '#16384a',
  fence: '#2b3134',
  amber: '#ffb347',
  cream: '#efe4c8',
  ink: '#11201f',
  red: '#c8372d',
  bay: '#f2c94c',
};

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * S);
  c.height = Math.ceil(h * S);
  const g = c.getContext('2d')!;
  g.scale(S, S);
  return [c, g];
}

// Deterministic speckle so the textures are the same every load.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const roundRect = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
};

const overlap = (a: TileRect, b: TileRect): TileRect | null => {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const r = Math.min(a.x + a.w, b.x + b.w);
  const btm = Math.min(a.y + a.h, b.y + b.h);
  return r > x && btm > y ? { x, y, w: r - x, h: btm - y } : null;
};

/** The whole district as one image, positioned at map.region.x/y. */
export function drawStreet(map: StreetMap): HTMLCanvasElement {
  const { region } = map;
  const [c, g] = canvas(region.w, region.h);
  g.translate(-region.x, -region.y);
  const rand = rng(1998);
  const tx0 = region.x / TILE;
  const ty0 = region.y / TILE;
  const tx1 = tx0 + region.w / TILE;
  const ty1 = ty0 + region.h / TILE;
  const at = (x: number, y: number) => {
    if (y < 0 && x >= 0 && x < map.w) return Surface.Water;
    return x < 0 || y < 0 || x >= map.w || y >= map.h ? Surface.Void : map.tiles[y * map.w + x];
  };

  for (let ty = ty0; ty < ty1; ty++) {
    for (let tx = tx0; tx < tx1; tx++) {
      const s = at(tx, ty);
      const x = tx * TILE;
      const y = ty * TILE;
      switch (s) {
        case Surface.Building: {
          g.fillStyle = PALETTE.brick;
          g.fillRect(x, y, TILE, TILE);
          g.fillStyle = PALETTE.mortar;
          for (let row = 0; row < 4; row++) {
            g.fillRect(x, y + row * 4, TILE, 0.6);
            const off = row % 2 ? 4 : 0;
            for (let col = off; col < TILE; col += 8) g.fillRect(x + col, y + row * 4, 0.6, 4);
          }
          break;
        }
        case Surface.Pavement: {
          g.fillStyle = PALETTE.pavement;
          g.fillRect(x, y, TILE, TILE);
          g.fillStyle = PALETTE.slab;
          g.fillRect(x, y, TILE, 0.7);
          g.fillRect(x, y + 8, TILE, 0.5);
          g.fillRect(x, y, 0.7, TILE);
          g.fillRect(x + 8, y, 0.5, TILE);
          break;
        }
        case Surface.Road: {
          g.fillStyle = PALETTE.road;
          g.fillRect(x, y, TILE, TILE);
          g.fillStyle = PALETTE.roadSpeck;
          for (let i = 0; i < 5; i++) g.fillRect(x + rand() * TILE, y + rand() * TILE, 1, 1);
          break;
        }
        case Surface.Yard: {
          g.fillStyle = PALETTE.yard;
          g.fillRect(x, y, TILE, TILE);
          g.strokeStyle = 'rgba(239,228,200,0.05)';
          g.lineWidth = 1;
          g.beginPath();
          g.moveTo(x, y + TILE);
          g.lineTo(x + TILE, y);
          g.stroke();
          break;
        }
        case Surface.Water: {
          g.fillStyle = PALETTE.water;
          g.fillRect(x, y, TILE, TILE);
          g.fillStyle = PALETTE.waterLight;
          for (let i = 0; i < 2; i++) g.fillRect(x + rand() * 10, y + rand() * TILE, 4 + rand() * 4, 0.8);
          break;
        }
        case Surface.Fence: {
          g.fillStyle = PALETTE.yard;
          g.fillRect(x, y, TILE, TILE);
          g.fillStyle = PALETTE.fence;
          g.fillRect(x + 1, y + 5, TILE - 2, 6);
          g.fillStyle = '#4a5357';
          for (let px = x + 2; px < x + TILE; px += 4) g.fillRect(px, y + 4, 1, 8);
          break;
        }
        default: {
          g.fillStyle = PALETTE.void;
          g.fillRect(x, y, TILE, TILE);
        }
      }
    }
  }

  // Kerbs: a light edge wherever pavement meets road.
  g.fillStyle = PALETTE.kerb;
  for (let ty = 0; ty < map.h; ty++) {
    for (let tx = 0; tx < map.w; tx++) {
      if (at(tx, ty) !== Surface.Pavement) continue;
      const x = tx * TILE;
      const y = ty * TILE;
      const road = (s: number) => s === Surface.Road;
      if (road(at(tx + 1, ty))) g.fillRect(x + TILE - 1.5, y, 1.5, TILE);
      if (road(at(tx - 1, ty))) g.fillRect(x, y, 1.5, TILE);
      if (road(at(tx, ty + 1))) g.fillRect(x, y + TILE - 1.5, TILE, 1.5);
      if (road(at(tx, ty - 1))) g.fillRect(x, y, TILE, 1.5);
    }
  }
  // The quay edge: a bright stone lip along the water.
  g.fillStyle = '#8a8f86';
  for (let tx = 0; tx < map.w; tx++) {
    if (at(tx, 0) === Surface.Water) continue;
    if (at(tx, -1) === Surface.Water) g.fillRect(tx * TILE, 0, TILE, 1.5);
  }
  for (let tx = 0; tx < map.w; tx++) {
    for (let ty = 0; ty < 3; ty++) {
      if (at(tx, ty) === Surface.Water && at(tx, ty + 1) !== Surface.Water) g.fillRect(tx * TILE, (ty + 1) * TILE - 1.5, TILE, 1.5);
    }
  }

  // Centre lines on public roads, broken at junctions. None in the yard.
  const publicRoads = map.roads.filter((r) => !['yard_road', 'yard_gate'].includes(r.id));
  const junctions: TileRect[] = [];
  for (let i = 0; i < map.roads.length; i++) {
    for (let j = i + 1; j < map.roads.length; j++) {
      const o = overlap(map.roads[i].rect, map.roads[j].rect);
      if (o) junctions.push(o);
    }
  }
  const inJunction = (px: number, py: number) =>
    junctions.some((j) => px >= j.x * TILE - 2 && px <= (j.x + j.w) * TILE + 2 && py >= j.y * TILE - 2 && py <= (j.y + j.h) * TILE + 2);
  g.fillStyle = PALETTE.line;
  for (const road of publicRoads) {
    const r = road.rect;
    const horizontal = r.w > r.h;
    const cx = (r.x + r.w / 2) * TILE;
    const cy = (r.y + r.h / 2) * TILE;
    const len = (horizontal ? r.w : r.h) * TILE;
    const start = (horizontal ? r.x : r.y) * TILE;
    for (let d = start + 4; d < start + len - 4; d += 14) {
      const px = horizontal ? d : cx;
      const py = horizontal ? cy : d;
      if (inJunction(px, py) || inJunction(horizontal ? d + 8 : cx, horizontal ? cy : d + 8)) continue;
      if (horizontal) g.fillRect(d, cy - 0.75, 8, 1.5);
      else g.fillRect(cx - 0.75, d, 1.5, 8);
    }
  }

  // Roofs over named buildings.
  for (const b of map.buildings) {
    const x = b.rect.x * TILE;
    const y = b.rect.y * TILE;
    const w = b.rect.w * TILE;
    const h = b.rect.h * TILE;
    if (w < 24 || h < 24) continue;
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(x + 3, y + 3, w - 4, h - 4);
    g.fillStyle = PALETTE.roof;
    g.fillRect(x + 2, y + 2, w - 5, h - 5);
    g.strokeStyle = PALETTE.roofEdge;
    g.lineWidth = 1;
    g.strokeRect(x + 2.5, y + 2.5, w - 6, h - 6);
    g.fillStyle = PALETTE.roofEdge;
    if (w > h) g.fillRect(x + 6, y + h / 2 - 0.5, w - 13, 1);
    else g.fillRect(x + w / 2 - 0.5, y + 6, 1, h - 13);
  }

  // Ticket office awning faces Station Road; the lay-by in front is marked.
  const office = map.buildings.find((b) => b.id === 'ticket_office');
  if (office) {
    const x = office.rect.x * TILE;
    const y = office.rect.y * TILE;
    const w = office.rect.w * TILE;
    for (let i = 0; i < w - 8; i += 8) {
      g.fillStyle = (i / 8) % 2 ? PALETTE.cream : '#2f7f7a';
      g.fillRect(x + 4 + i, y - 4, 8, 6);
    }
  }
  g.strokeStyle = 'rgba(242, 201, 76, 0.4)';
  g.setLineDash([4, 3]);
  g.strokeRect(17 * TILE + 1, 33 * TILE + 1, 9 * TILE - 2, TILE - 2);
  g.setLineDash([]);

  // Ticket machine: a squat cabinet with a coin slot.
  {
    const m = map.machine;
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(m.x - 5, m.y - 3, 12, 9);
    g.fillStyle = '#3e5a5d';
    roundRect(g, m.x - 6, m.y - 5, 12, 9, 1.5);
    g.fill();
    g.fillStyle = '#d9cfb2';
    g.fillRect(m.x - 4, m.y - 3.5, 8, 2.5);
    g.fillStyle = '#11201f';
    g.fillRect(m.x - 1.5, m.y + 1, 3, 1.5);
  }

  // Depot door and forecourt markings.
  g.fillStyle = PALETTE.amber;
  g.fillRect(4 * TILE + 13, 36 * TILE, 3, 22);
  g.strokeStyle = 'rgba(242, 201, 76, 0.35)';
  g.lineWidth = 1;
  g.strokeRect(1 * TILE + 4, 39 * TILE + 4, 6 * TILE - 8, 6 * TILE - 8);

  // The depot bay.
  {
    const b = map.bay.rect;
    g.strokeStyle = PALETTE.bay;
    g.lineWidth = 1.5;
    g.setLineDash([5, 3]);
    g.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    g.setLineDash([]);
    g.save();
    g.translate(b.x + b.w / 2, b.y + b.h / 2);
    g.rotate(-Math.PI / 2);
    g.fillStyle = 'rgba(242, 201, 76, 0.7)';
    g.font = 'bold 8px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('BAY', 0, 0);
    g.restore();
  }

  // Quay: a ferry ramp running down into the water.
  g.fillStyle = '#4b514c';
  g.fillRect(5 * TILE, -1.5 * TILE, 4 * TILE, 3 * TILE);
  g.fillStyle = '#5c635d';
  for (let y = -1.5 * TILE; y < 1.5 * TILE; y += 4) g.fillRect(5 * TILE, y, 4 * TILE, 1);
  // Mooring bollards along the quay edge.
  g.fillStyle = '#1a1d1c';
  for (const x of [11, 14, 17]) {
    g.beginPath();
    g.arc(x * TILE, 1.2 * TILE, 2, 0, Math.PI * 2);
    g.fill();
  }

  // Phone box: red, with a darker roof crown.
  {
    const p = map.phone;
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(p.x - p.half + 1.5, p.y - p.half + 1.5, p.half * 2, p.half * 2);
    g.fillStyle = PALETTE.red;
    roundRect(g, p.x - p.half, p.y - p.half, p.half * 2, p.half * 2, 1.5);
    g.fill();
    g.fillStyle = '#8f231c';
    roundRect(g, p.x - p.half + 2.5, p.y - p.half + 2.5, p.half * 2 - 5, p.half * 2 - 5, 1);
    g.fill();
    g.fillStyle = PALETTE.cream;
    g.fillRect(p.x - p.half + 1, p.y + p.half - 2.2, p.half * 2 - 2, 1.2);
  }

  // Shift-one landmarks: the old council post, the bell hatch, the yard cabinet,
  // the riverside warning lamp and the quay post box.
  {
    const post = PLACES.oldPost;
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(post.x - 2, post.y - 9, 6, 6);
    g.fillStyle = '#5f6b62';
    g.fillRect(post.x - 3, post.y - 10, 6, 6);
    g.fillStyle = '#b7b09a';
    g.fillRect(post.x - 2, post.y - 9, 4, 2);

    const hatch = PLACES.nellHatch;
    g.strokeStyle = '#6a5a44';
    g.lineWidth = 1;
    g.strokeRect(hatch.x - 6, hatch.y - 14, 12, 8);
    g.fillStyle = '#3a3028';
    g.fillRect(hatch.x - 5.5, hatch.y - 13.5, 11, 7);
    g.fillStyle = '#8a7a5a';
    g.fillRect(hatch.x - 1, hatch.y - 11, 2, 2);

    const cab = PLACES.cabinet;
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(cab.x - 6, cab.y - 6, 13, 10);
    g.fillStyle = '#4a6a52';
    roundRect(g, cab.x - 7, cab.y - 7, 13, 10, 1.5);
    g.fill();
    g.fillStyle = '#d9cfb2';
    g.fillRect(cab.x - 5, cab.y - 5, 9, 1.5);

    const lamp = PLACES.viewpoint;
    g.fillStyle = '#1a1d1c';
    g.beginPath();
    g.arc(lamp.x, lamp.y - 14, 3.5, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#5a2320';
    g.beginPath();
    g.arc(lamp.x, lamp.y - 14, 2, 0, Math.PI * 2);
    g.fill();

    const box = PLACES.postBox;
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.beginPath();
    g.arc(box.x + 1, box.y - 7, 4.5, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = PALETTE.red;
    g.beginPath();
    g.arc(box.x, box.y - 8, 4.5, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#1a1d1c';
    g.fillRect(box.x - 2.5, box.y - 9, 5, 1);
  }

  // Free-play shop fronts: the tailor's window, the chip shop, the garage door.
  {
    const window = (x: number, y: number, w: number, glow: string, awning: string) => {
      g.fillStyle = glow;
      g.fillRect(x, y, w, 5);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      for (let i = x + 6; i < x + w; i += 7) g.fillRect(i, y, 1, 5);
      g.fillStyle = awning;
      for (let i = 0; i < w; i += 4) {
        g.fillStyle = i % 8 === 0 ? awning : PALETTE.cream;
        g.fillRect(x + i, y + 5, 4, 3);
      }
    };
    const t = SHOPS.tailor.at;
    window(t.x - 14, 410, 28, '#f6d58a', '#6b3a5e');
    const ch = SHOPS.chips.at;
    window(ch.x - 16, 176, 32, '#ffe6a3', '#2f7f7a');
    // Body & Paint: a wide roller door with a lit strip over it, and the bay marked out.
    const p = SHOPS.paint.at;
    g.fillStyle = '#3b4247';
    g.fillRect(p.x - 40, 600, 80, 8);
    g.fillStyle = 'rgba(0,0,0,0.3)';
    for (let i = 601; i < 608; i += 2) g.fillRect(p.x - 40, i, 80, 0.6);
    g.fillStyle = '#f6d58a';
    g.fillRect(p.x - 40, 598, 80, 2);
    g.strokeStyle = 'rgba(255, 233, 168, 0.5)';
    g.lineWidth = 1;
    g.setLineDash([3, 2]);
    g.strokeRect(p.x - 20, p.y - 12, 40, 22);
    g.setLineDash([]);
  }

  // Lamp pools, then posts and bollards on top.
  g.globalCompositeOperation = 'lighter';
  for (const lamp of map.props) {
    if (lamp.kind !== 'lamp') continue;
    const grad = g.createRadialGradient(lamp.x, lamp.y, 2, lamp.x, lamp.y, 46);
    grad.addColorStop(0, 'rgba(255, 179, 71, 0.30)');
    grad.addColorStop(0.5, 'rgba(255, 160, 60, 0.10)');
    grad.addColorStop(1, 'rgba(255, 160, 60, 0)');
    g.fillStyle = grad;
    g.fillRect(lamp.x - 46, lamp.y - 46, 92, 92);
  }
  g.globalCompositeOperation = 'source-over';
  for (const prop of map.props) {
    g.fillStyle = prop.kind === 'lamp' ? '#1a1d1c' : '#5a6266';
    g.beginPath();
    g.arc(prop.x, prop.y, prop.r, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = prop.kind === 'lamp' ? PALETTE.amber : PALETTE.cream;
    g.beginPath();
    g.arc(prop.x, prop.y, prop.kind === 'lamp' ? 1.4 : 1, 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

/** Courier van facing east (heading 0), in any body paint and stripe from Body & Paint. */
export function drawVan(bodyId = 'cream', stripeId = 'teal'): HTMLCanvasElement {
  const body = VAN_BODIES.find((b) => b.id === bodyId) ?? VAN_BODIES[0];
  const stripe = VAN_STRIPES.find((b) => b.id === stripeId) ?? VAN_STRIPES[0];
  const L = VAN.halfLength * 2;
  const W = VAN.halfWidth * 2;
  const pad = 3;
  const [c, g] = canvas(L + pad * 2, W + pad * 2);
  g.translate(pad, pad);
  // Shadow.
  g.fillStyle = 'rgba(0,0,0,0.4)';
  roundRect(g, 1.5, 1.5, L, W, 3);
  g.fill();
  // Body: square rear, rounded nose.
  g.fillStyle = body.fill;
  g.beginPath();
  g.moveTo(0, 0.5);
  g.lineTo(L - 4, 0);
  g.quadraticCurveTo(L, 0, L, 4);
  g.lineTo(L, W - 4);
  g.quadraticCurveTo(L, W, L - 4, W);
  g.lineTo(0, W - 0.5);
  g.closePath();
  g.fill();
  // Roof stripe; the racing stripe gets a pinline each side.
  g.fillStyle = stripe.fill;
  g.fillRect(2, W / 2 - 2, L - 12, 4);
  if (stripe.trim !== stripe.fill) {
    g.fillStyle = stripe.trim;
    g.fillRect(2, W / 2 - 3, L - 12, 0.8);
    g.fillRect(2, W / 2 + 2.2, L - 12, 0.8);
  }
  // Windscreen.
  g.fillStyle = '#22383c';
  g.fillRect(L - 9, 2, 4, W - 4);
  g.fillStyle = 'rgba(239,228,200,0.35)';
  g.fillRect(L - 8.5, 3, 1, W - 9);
  // Headlights.
  g.fillStyle = '#fff1bf';
  g.fillRect(L - 1.5, 1.5, 1.5, 3);
  g.fillRect(L - 1.5, W - 4.5, 1.5, 3);
  // Rear doors and tail lights.
  g.fillStyle = body.trim;
  g.fillRect(0, W / 2 - 0.4, 3, 0.8);
  g.fillStyle = '#d23c2c';
  g.fillRect(0, 0.8, 1.5, 3);
  g.fillRect(0, W - 3.8, 1.5, 3);
  // Wing mirrors.
  g.fillStyle = '#3b4a4a';
  g.fillRect(L - 10, -1.5, 2, 2);
  g.fillRect(L - 10, W - 0.5, 2, 2);
  // Wickwing, the lantern moth, rides on the left mirror.
  const grad = g.createRadialGradient(L - 9, -1, 0, L - 9, -1, 3);
  grad.addColorStop(0, 'rgba(255, 236, 170, 1)');
  grad.addColorStop(1, 'rgba(255, 179, 71, 0)');
  g.fillStyle = grad;
  g.fillRect(L - 12, -4, 6, 6);
  return c;
}

/** Soft headlight beam, drawn from its left edge (the van's nose). */
export function drawBeam(): HTMLCanvasElement {
  const [c, g] = canvas(70, 44);
  const grad = g.createLinearGradient(0, 0, 70, 0);
  grad.addColorStop(0, 'rgba(255, 240, 190, 0.5)');
  grad.addColorStop(1, 'rgba(255, 240, 190, 0)');
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(0, 22 - 7);
  g.lineTo(70, 0);
  g.lineTo(70, 44);
  g.lineTo(0, 22 + 7);
  g.closePath();
  g.fill();
  return c;
}

/** Jacket colours. Words go with each swatch, never colour alone. */
export const JACKETS = JACKET_STYLES;
export const DEFAULT_JACKET = 'amber';

/** Walk frames: 0 standing, 1 left foot forward, 2 right foot forward. */
export const COURIER_FRAMES = 3;

/**
 * The courier on foot, seen from above and facing east: shoulders in the
 * jacket colour with a reflective band, dark head. While walking,
 * a foot pokes out in front and the opposite hand swings forward.
 */
export function drawCourier(jacketId: string, frame: number, hatId = 'none'): HTMLCanvasElement {
  const jacket = JACKETS.find((j) => j.id === jacketId) ?? JACKETS[0];
  const hat = HAT_STYLES.find((h) => h.id === hatId) ?? HAT_STYLES[0];
  const [c, g] = canvas(18, 18);
  g.translate(9, 9);
  // Stride: how far the left foot is ahead (+) or behind (-); hands swing the other way.
  const stride = frame === 1 ? 1 : frame === 2 ? -1 : 0;

  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.beginPath();
  g.ellipse(1, 1, 5, 6.5, 0, 0, Math.PI * 2);
  g.fill();

  // Feet: dark trousers ending in shoes, one each side of the body's centre line.
  // Light trainers so a stepping foot reads against dark, wet pavement.
  const foot = (side: number, ahead: number) => {
    const x = ahead * 5.4;
    g.fillStyle = '#5b6470';
    g.fillRect(Math.min(0, x), side * 2.3 - 1.2, Math.abs(x) + 0.5, 2.4);
    g.fillStyle = '#e8e2cf';
    roundRect(g, x - 1.4 + (ahead > 0 ? 1 : ahead < 0 ? -0.6 : 0.2), side * 2.3 - 1.3, 3, 2.6, 1.1);
    g.fill();
  };
  foot(-1, stride);
  foot(1, -stride);

  // Hands swing opposite to the feet, just outside the shoulders.
  const hand = (side: number, ahead: number) => {
    const x = ahead * 2.2;
    g.fillStyle = jacket.fill;
    g.beginPath();
    g.ellipse(x * 0.6, side * 4.9, 1.6, 1.2, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#d9b48c';
    g.beginPath();
    g.arc(x + 0.4, side * 5.4, 1.05, 0, Math.PI * 2);
    g.fill();
  };
  hand(-1, -stride);
  hand(1, stride);

  // Shoulders and jacket.
  g.fillStyle = jacket.fill;
  g.beginPath();
  g.ellipse(0, 0, 3.6, 5.4, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.35)';
  g.lineWidth = 0.5;
  g.stroke();
  // Reflective band across the back of the shoulders.
  g.fillStyle = jacket.trim;
  g.fillRect(-2.4, -4.9, 1.1, 9.8);
  // Head, a little forward of the shoulders, with a hint of face at the front.
  g.fillStyle = '#2b211b';
  g.beginPath();
  g.arc(0.7, 0, 2.15, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#d9b48c';
  g.beginPath();
  g.ellipse(2.4, 0, 0.75, 1.25, 0, 0, Math.PI * 2);
  g.fill();
  drawHat(g, hat, 0.7);
  return c;
}

/** A hat seen from above, centred on the head at (hx, 0), brim to the east. */
function drawHat(g: CanvasRenderingContext2D, hat: StyleItem, hx: number): void {
  if (hat.id === 'none') return;
  if (hat.id === 'flat_cap') {
    g.fillStyle = hat.trim;
    g.beginPath();
    g.ellipse(hx + 1.9, 0, 1.4, 2.1, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = hat.fill;
    g.beginPath();
    g.ellipse(hx + 0.2, 0, 2.3, 2.3, 0, 0, Math.PI * 2);
    g.fill();
    return;
  }
  if (hat.id === 'sou_wester') {
    // Wide brim, longer at the back to keep rain off the collar.
    g.fillStyle = hat.trim;
    g.beginPath();
    g.ellipse(hx - 0.5, 0, 3.6, 3.2, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = hat.fill;
    g.beginPath();
    g.ellipse(hx - 0.2, 0, 3.2, 2.8, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = hat.trim;
    g.beginPath();
    g.arc(hx, 0, 1.6, 0, Math.PI * 2);
    g.fill();
    return;
  }
  // Beanies: a knitted dome with a rolled band and a bobble.
  g.fillStyle = hat.fill;
  g.beginPath();
  g.arc(hx - 0.2, 0, 2.25, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.25)';
  g.lineWidth = 0.4;
  g.beginPath();
  g.arc(hx - 0.2, 0, 1.4, 0, Math.PI * 2);
  g.stroke();
  if (hat.id === 'lamp_beanie') {
    const glow = g.createRadialGradient(hx - 0.4, 0, 0, hx - 0.4, 0, 3.4);
    glow.addColorStop(0, 'rgba(255, 233, 168, 0.9)');
    glow.addColorStop(1, 'rgba(255, 179, 71, 0)');
    g.fillStyle = glow;
    g.fillRect(hx - 4, -3.6, 7.2, 7.2);
  }
  g.fillStyle = hat.trim;
  g.beginPath();
  g.arc(hx - 0.4, 0, 0.95, 0, Math.PI * 2);
  g.fill();
}

/** Walk frames for people in town. */
export const PED_FRAMES = 2;

/**
 * Someone out for the evening, from above, facing east: a coat in their own
 * colour, a dark head, feet that alternate. Frame 2 is a stumble pose.
 */
export function drawPedestrian(coat: string, frame: number): HTMLCanvasElement {
  const [c, g] = canvas(16, 16);
  g.translate(8, 8);
  g.fillStyle = 'rgba(0,0,0,0.3)';
  g.beginPath();
  g.ellipse(0.8, 0.8, 4.4, 5.4, 0, 0, Math.PI * 2);
  g.fill();
  if (frame === 2) {
    // Arms out, leaning back.
    g.fillStyle = coat;
    g.fillRect(-1, -6.2, 1.6, 12.4);
  }
  const stride = frame === 1 ? 1 : frame === 0 ? -1 : 0;
  g.fillStyle = '#3a3f46';
  g.fillRect(stride * 3.4 - 1, -2.6, 2.2, 1.9);
  g.fillRect(-stride * 3.4 - 1, 0.7, 2.2, 1.9);
  g.fillStyle = coat;
  g.beginPath();
  g.ellipse(0, 0, 3.2, 4.6, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.35)';
  g.lineWidth = 0.5;
  g.stroke();
  g.fillStyle = '#2b211b';
  g.beginPath();
  g.arc(0.6, 0, 1.9, 0, Math.PI * 2);
  g.fill();
  return c;
}

/** Pigeon frames: 0 and 1 pecking on the ground, 2 and 3 wings up and down in flight. */
export const PIGEON_FRAMES = 4;

export function drawPigeon(frame: number): HTMLCanvasElement {
  const [c, g] = canvas(12, 12);
  g.translate(6, 6);
  const flying = frame >= 2;
  if (!flying) {
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.beginPath();
    g.ellipse(0.5, 0.6, 2.6, 1.7, 0, 0, Math.PI * 2);
    g.fill();
  }
  if (flying) {
    const span = frame === 2 ? 5.2 : 3.2;
    g.fillStyle = '#7d848c';
    g.beginPath();
    g.moveTo(-0.5, 0);
    g.lineTo(-1.6, -span);
    g.lineTo(1.2, -span + 0.6);
    g.lineTo(1, 0);
    g.lineTo(1.2, span - 0.6);
    g.lineTo(-1.6, span);
    g.closePath();
    g.fill();
  }
  // Tail, body, head with a green-purple neck sheen.
  g.fillStyle = '#5f666e';
  g.fillRect(-3.4, -0.8, 1.6, 1.6);
  g.fillStyle = '#9aa1a8';
  g.beginPath();
  g.ellipse(0, 0, 2.5, 1.6, 0, 0, Math.PI * 2);
  g.fill();
  const peck = !flying && frame === 1 ? 0.8 : 0;
  g.fillStyle = '#6d8f7d';
  g.beginPath();
  g.arc(2 + peck, 0, 1.1, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#4a5157';
  g.beginPath();
  g.arc(2.4 + peck, 0, 0.75, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#e2a04b';
  g.fillRect(3 + peck, -0.25, 0.7, 0.5);
  return c;
}



// ------------------------------------------------------------------ vehicles

/** The express car: low, red, pointed nose, cream stripe. Distinct rear lights. */
export function drawExpress(): HTMLCanvasElement {
  const L = EXPRESS.halfLength * 2;
  const W = EXPRESS.halfWidth * 2;
  const pad = 3;
  const [c, g] = canvas(L + pad * 2, W + pad * 2);
  g.translate(pad, pad);
  g.fillStyle = 'rgba(0,0,0,0.4)';
  roundRect(g, 1.5, 1.5, L, W, 4);
  g.fill();
  g.fillStyle = '#9b2c2c';
  g.beginPath();
  g.moveTo(1, 1);
  g.lineTo(L - 7, 0.5);
  g.quadraticCurveTo(L + 1, W / 2, L - 7, W - 0.5);
  g.lineTo(1, W - 1);
  g.closePath();
  g.fill();
  g.fillStyle = PALETTE.cream;
  g.fillRect(2, W / 2 - 1, L - 6, 2);
  g.fillStyle = '#1b2a2d';
  roundRect(g, L - 12, 2.5, 4.5, W - 5, 1.5);
  g.fill();
  roundRect(g, 4, 2.5, 3, W - 5, 1);
  g.fill();
  g.fillStyle = '#fff1bf';
  g.fillRect(L - 3, 1.5, 1.5, 2.5);
  g.fillRect(L - 3, W - 4, 1.5, 2.5);
  g.fillStyle = '#ff5a3c';
  g.fillRect(0.5, 1, 1.5, W - 2);
  return c;
}

/** The patrol car: dark with white doors and a roof bar. Frame 0/1 swap the lit side. */
export function drawPatrol(frame: number): HTMLCanvasElement {
  const L = PATROL.halfLength * 2;
  const W = PATROL.halfWidth * 2;
  const pad = 3;
  const [c, g] = canvas(L + pad * 2, W + pad * 2);
  g.translate(pad, pad);
  g.fillStyle = 'rgba(0,0,0,0.4)';
  roundRect(g, 1.5, 1.5, L, W, 3);
  g.fill();
  g.fillStyle = '#28303a';
  roundRect(g, 0, 0, L, W, 3);
  g.fill();
  g.fillStyle = '#d8dde0';
  g.fillRect(L * 0.3, 0, L * 0.35, 2.5);
  g.fillRect(L * 0.3, W - 2.5, L * 0.35, 2.5);
  g.fillStyle = '#16202a';
  g.fillRect(L - 9, 2, 4, W - 4);
  // Roof light bar: amber one side, white the other, swapping each frame.
  g.fillStyle = frame === 0 ? '#ffb347' : '#5f6b70';
  g.fillRect(L * 0.45, 1.5, 3, W / 2 - 1.5);
  g.fillStyle = frame === 0 ? '#5f6b70' : '#f4f6ff';
  g.fillRect(L * 0.45, W / 2, 3, W / 2 - 1.5);
  g.fillStyle = '#fff1bf';
  g.fillRect(L - 1.5, 1.5, 1.5, 3);
  g.fillRect(L - 1.5, W - 4.5, 1.5, 3);
  g.fillStyle = '#d23c2c';
  g.fillRect(0, 1, 1.5, 3);
  g.fillRect(0, W - 4, 1.5, 3);
  return c;
}

// -------------------------------------------------------------------- people

/** Mo (navy coat, orange life jacket) and Nell (plum shawl, cream scarf), seen from above facing south. */
export function drawPerson(who: 'mo_vale' | 'nell_price'): HTMLCanvasElement {
  const [c, g] = canvas(18, 18);
  g.translate(9, 9);
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.beginPath();
  g.ellipse(1, 1, 6, 5, 0, 0, Math.PI * 2);
  g.fill();
  const coat = who === 'mo_vale' ? '#2b3f66' : '#6b3a5e';
  const trim = who === 'mo_vale' ? '#f07a2c' : '#e6dcc0';
  g.fillStyle = coat;
  g.beginPath();
  g.ellipse(0, 0, 5.8, 4, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = trim;
  if (who === 'mo_vale') {
    g.fillRect(-5, -1, 10, 2.4);
  } else {
    g.beginPath();
    g.ellipse(0, 1.2, 3.6, 1.6, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = who === 'mo_vale' ? '#3b2a22' : '#b9b2a6';
  g.beginPath();
  g.arc(0, 0.6, 2.3, 0, Math.PI * 2);
  g.fill();
  return c;
}

// ------------------------------------------------------------------ creatures

/** Small street sprite of the bottle-cap crab. */
export function drawCrab(): HTMLCanvasElement {
  const [c, g] = canvas(12, 10);
  g.translate(6, 5.5);
  g.fillStyle = '#c4a14a';
  g.beginPath();
  g.arc(0, 0, 3.2, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#8d6f2a';
  g.lineWidth = 0.6;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.beginPath();
    g.moveTo(Math.cos(a) * 2.4, Math.sin(a) * 2.4);
    g.lineTo(Math.cos(a) * 3.2, Math.sin(a) * 3.2);
    g.stroke();
  }
  g.fillStyle = '#b5473a';
  g.beginPath();
  g.arc(-4, -2, 1.3, 0, Math.PI * 2);
  g.arc(4, -2, 1.3, 0, Math.PI * 2);
  g.fill();
  return c;
}

/**
 * Large two-tone portrait for the encounter: the crab under its bottle cap,
 * claws raised (keep away) or lowered (calm). Drawn at display size in CSS px.
 */
export function drawCrabPortrait(pose: 'raised_claws' | 'claws_lowered', size = 220): HTMLCanvasElement {
  const c = document.createElement('canvas');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  c.width = size * dpr;
  c.height = size * dpr;
  c.style.width = `${size}px`;
  c.style.height = `${size}px`;
  const g = c.getContext('2d')!;
  g.scale(dpr, dpr);
  const ink = '#11201f';
  const tone = pose === 'raised_claws' ? '#e8a33c' : '#9fd3c7';
  g.fillStyle = tone;
  g.fillRect(0, 0, size, size);
  g.fillStyle = ink;
  const cx = size / 2;
  const cy = size * 0.6;
  const r = size * 0.26;
  // Legs.
  g.lineWidth = size * 0.03;
  g.strokeStyle = ink;
  g.lineCap = 'round';
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.moveTo(cx + side * r * 0.7, cy + r * 0.1 + i * r * 0.22);
      g.lineTo(cx + side * r * 1.35, cy + r * 0.35 + i * r * 0.3);
      g.stroke();
    }
  }
  // Claws.
  const claw = (side: number) => {
    const raised = pose === 'raised_claws';
    const ax = cx + side * r * 0.9;
    const ay = cy - r * 0.2;
    const bx = cx + side * r * (raised ? 1.25 : 1.45);
    const by = raised ? cy - r * 1.35 : cy + r * 0.25;
    g.lineWidth = size * 0.045;
    g.beginPath();
    g.moveTo(ax, ay);
    g.lineTo(bx, by);
    g.stroke();
    g.beginPath();
    g.ellipse(bx, by, r * 0.32, r * 0.22, raised ? side * -0.5 : side * 0.3, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = tone;
    g.beginPath();
    g.moveTo(bx, by);
    g.lineTo(bx + side * r * 0.35, by + (raised ? -r * 0.12 : r * 0.12));
    g.lineTo(bx + side * r * 0.1, by + (raised ? -r * 0.28 : r * 0.28));
    g.closePath();
    g.fill();
    g.fillStyle = ink;
  };
  claw(-1);
  claw(1);
  // The bottle-cap shell with its crimped edge.
  g.beginPath();
  for (let i = 0; i <= 42; i++) {
    const a = (i / 42) * Math.PI * 2;
    const rr = i % 2 ? r : r * 1.08;
    g.lineTo(cx + Math.cos(a) * rr, cy - r * 0.15 + Math.sin(a) * rr * 0.62);
  }
  g.closePath();
  g.fill();
  g.fillStyle = tone;
  g.beginPath();
  g.ellipse(cx, cy - r * 0.25, r * 0.62, r * 0.32, 0, 0, Math.PI * 2);
  g.fill();
  // Eyes on stalks.
  g.fillStyle = ink;
  for (const side of [-1, 1]) {
    g.lineWidth = size * 0.02;
    g.beginPath();
    g.moveTo(cx + side * r * 0.25, cy - r * 0.55);
    g.lineTo(cx + side * r * 0.32, cy - r * 0.95);
    g.stroke();
    g.beginPath();
    g.arc(cx + side * r * 0.32, cy - r * 0.98, size * 0.028, 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

// ------------------------------------------------------------ ferry and market

/** The ferry seen from above, bow to the right. Lit when running. */
export function drawFerry(lit: boolean): HTMLCanvasElement {
  const L = 11 * TILE;
  const W = 3.4 * TILE;
  const [c, g] = canvas(L, W);
  g.fillStyle = 'rgba(0,0,0,0.35)';
  roundRect(g, 3, 3, L - 4, W - 4, 10);
  g.fill();
  g.fillStyle = '#3d4a4f';
  g.beginPath();
  g.moveTo(2, 4);
  g.lineTo(L - 22, 2);
  g.quadraticCurveTo(L - 1, W / 2, L - 22, W - 2);
  g.lineTo(2, W - 4);
  g.closePath();
  g.fill();
  g.fillStyle = lit ? '#e6dcc0' : '#6d7570';
  roundRect(g, 18, 9, L - 58, W - 18, 3);
  g.fill();
  // Windows: dark when moored, warm when running.
  g.fillStyle = lit ? '#ffcf73' : '#2a3134';
  for (let x = 22; x < L - 44; x += 9) {
    g.fillRect(x, 11, 5, 3);
    g.fillRect(x, W - 14, 5, 3);
  }
  g.fillStyle = lit ? '#c8372d' : '#5a3a36';
  g.beginPath();
  g.arc(L - 32, W / 2, 5, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = PALETTE.cream;
  g.font = 'bold 7px system-ui, sans-serif';
  g.fillText('LOWBRIDGE FERRY', 22, W / 2 + 2.5);
  return c;
}

/** One market stall from above: awning stripes, dark or lit. */
export function drawStall(lit: boolean, index: number): HTMLCanvasElement {
  const w = 3 * TILE;
  const h = 2 * TILE;
  const [c, g] = canvas(w, h);
  const colours = [
    ['#2f7f7a', '#e6dcc0'],
    ['#c8372d', '#e6dcc0'],
    ['#6b3a5e', '#f2c94c'],
    ['#2b3f66', '#e6dcc0'],
  ][index % 4];
  for (let i = 0; i < 6; i++) {
    g.fillStyle = colours[i % 2];
    g.fillRect((i * w) / 6, 0, w / 6 + 0.5, h - 6);
  }
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.fillRect(0, h - 6, w, 6);
  g.fillStyle = '#3a3028';
  g.fillRect(2, h - 5, w - 4, 4);
  if (!lit) {
    g.fillStyle = 'rgba(6, 12, 14, 0.62)';
    g.fillRect(0, 0, w, h);
  } else {
    g.fillStyle = '#ffd27a';
    for (let x = 5; x < w; x += 9) {
      g.beginPath();
      g.arc(x, h - 3, 1.4, 0, Math.PI * 2);
      g.fill();
    }
  }
  return c;
}

/** A map pin for a destination: amber diamond with a dark centre. */
export function drawPin(): HTMLCanvasElement {
  const [c, g] = canvas(12, 16);
  g.fillStyle = PALETTE.amber;
  g.beginPath();
  g.moveTo(6, 15);
  g.lineTo(1, 6);
  g.arc(6, 5.5, 5, Math.PI, 0);
  g.lineTo(11, 6);
  g.closePath();
  g.fill();
  g.fillStyle = PALETTE.ink;
  g.beginPath();
  g.arc(6, 5.5, 2, 0, Math.PI * 2);
  g.fill();
  return c;
}
