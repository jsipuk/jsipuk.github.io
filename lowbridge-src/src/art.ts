// Greybox art drawn to canvases at 2x: wet teal brick, amber lamps, cream
// signs. Original placeholders only; replace once the handling test passes.

import type { StreetMap, TileRect } from './rules/map.ts';
import { Surface, TILE } from './rules/map.ts';
import { VAN } from './rules/vehicle.ts';

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

// Deterministic speckle so the road texture is the same every load.
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

/** The whole play region as one image, positioned at map.region.x/y. */
export function drawStreet(map: StreetMap): HTMLCanvasElement {
  const { region } = map;
  const [c, g] = canvas(region.w, region.h);
  g.translate(-region.x, -region.y);
  const rand = rng(1998);
  const tx0 = region.x / TILE;
  const ty0 = region.y / TILE;
  const tx1 = tx0 + region.w / TILE;
  const ty1 = ty0 + region.h / TILE;
  const at = (x: number, y: number) =>
    x < 0 || y < 0 || x >= map.w || y >= map.h ? Surface.Void : map.tiles[y * map.w + x];

  // Base surfaces.
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
        case Surface.Road:
        case Surface.Barrier: {
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
        default: {
          g.fillStyle = PALETTE.void;
          g.fillRect(x, y, TILE, TILE);
        }
      }
    }
  }

  // Kerbs: a light edge wherever pavement meets road or yard.
  g.fillStyle = PALETTE.kerb;
  for (let ty = ty0; ty < ty1; ty++) {
    for (let tx = tx0; tx < tx1; tx++) {
      if (at(tx, ty) !== Surface.Pavement) continue;
      const x = tx * TILE;
      const y = ty * TILE;
      const drive = (s: number) => s === Surface.Road || s === Surface.Barrier;
      if (drive(at(tx + 1, ty))) g.fillRect(x + TILE - 1.5, y, 1.5, TILE);
      if (drive(at(tx - 1, ty))) g.fillRect(x, y, 1.5, TILE);
      if (drive(at(tx, ty + 1))) g.fillRect(x, y + TILE - 1.5, TILE, 1.5);
      if (drive(at(tx, ty - 1))) g.fillRect(x, y, TILE, 1.5);
    }
  }

  // Centre lines, broken at junctions and corners.
  const junctions: TileRect[] = [];
  for (let i = 0; i < map.roads.length; i++) {
    for (let j = i + 1; j < map.roads.length; j++) {
      const o = overlap(map.roads[i].rect, map.roads[j].rect);
      if (o) junctions.push(o);
    }
  }
  const inJunction = (px: number, py: number) =>
    junctions.some((j) => px >= j.x * TILE && px <= (j.x + j.w) * TILE && py >= j.y * TILE && py <= (j.y + j.h) * TILE);
  g.fillStyle = PALETTE.line;
  for (const road of map.roads) {
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

  // Give-way line where Ticket Street meets Station Road.
  const ticket = map.roads.find((r) => r.id === 'ticket_street');
  if (ticket) {
    g.fillStyle = PALETTE.line;
    const y = (28 + 5) * TILE + 2;
    for (let x = ticket.rect.x * TILE + 2; x < (ticket.rect.x + ticket.rect.w) * TILE - 2; x += 6) g.fillRect(x, y, 4, 1.5);
  }

  // Roofs and facades over the brick.
  for (const b of map.buildings) {
    const x = b.rect.x * TILE;
    const y = b.rect.y * TILE;
    const w = b.rect.w * TILE;
    const h = b.rect.h * TILE;
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(x + 3, y + 3, w - 4, h - 4);
    g.fillStyle = b.id === 'builders_yard_gate' ? '#3b3f3c' : PALETTE.roof;
    g.fillRect(x + 2, y + 2, w - 5, h - 5);
    g.strokeStyle = PALETTE.roofEdge;
    g.lineWidth = 1;
    g.strokeRect(x + 2.5, y + 2.5, w - 6, h - 6);
    if (b.id === 'builders_yard_gate') {
      // Corrugated shutter, seen from above.
      g.fillStyle = 'rgba(239,228,200,0.12)';
      for (let gx = x + 4; gx < x + w - 4; gx += 3) g.fillRect(gx, y + h - 10, 1, 8);
    } else if (w > h) {
      g.fillStyle = PALETTE.roofEdge;
      g.fillRect(x + 6, y + h / 2 - 0.5, w - 13, 1);
    } else {
      g.fillStyle = PALETTE.roofEdge;
      g.fillRect(x + w / 2 - 0.5, y + 6, 1, h - 13);
    }
  }

  // Ticket office awning faces Station Road.
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

  // Depot door and forecourt markings.
  g.fillStyle = PALETTE.amber;
  g.fillRect(4 * TILE + 13, 36 * TILE, 3, 22);
  g.strokeStyle = 'rgba(242, 201, 76, 0.35)';
  g.lineWidth = 1;
  g.strokeRect(1 * TILE + 4, 39 * TILE + 4, 6 * TILE - 8, 6 * TILE - 8);

  // Road closed barrier.
  {
    const bx = map.barrier.x * TILE;
    const by = map.barrier.y * TILE;
    const bh = map.barrier.h * TILE;
    g.save();
    g.beginPath();
    g.rect(bx + 3, by, 10, bh);
    g.clip();
    for (let i = -12; i < bh + 12; i += 8) {
      g.fillStyle = (i / 8) % 2 === 0 ? PALETTE.red : PALETTE.cream;
      g.beginPath();
      g.moveTo(bx, by + i);
      g.lineTo(bx + 16, by + i - 8);
      g.lineTo(bx + 16, by + i);
      g.lineTo(bx, by + i + 8);
      g.fill();
    }
    g.restore();
  }

  // The bay: a painted box with BAY written in it.
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

  // Lamp pools, then the posts on top.
  g.globalCompositeOperation = 'lighter';
  for (const lamp of map.props) {
    const grad = g.createRadialGradient(lamp.x, lamp.y, 2, lamp.x, lamp.y, 46);
    grad.addColorStop(0, 'rgba(255, 179, 71, 0.30)');
    grad.addColorStop(0.5, 'rgba(255, 160, 60, 0.10)');
    grad.addColorStop(1, 'rgba(255, 160, 60, 0)');
    g.fillStyle = grad;
    g.fillRect(lamp.x - 46, lamp.y - 46, 92, 92);
  }
  g.globalCompositeOperation = 'source-over';
  for (const lamp of map.props) {
    g.fillStyle = '#1a1d1c';
    g.beginPath();
    g.arc(lamp.x, lamp.y, lamp.r, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = PALETTE.amber;
    g.beginPath();
    g.arc(lamp.x, lamp.y, 1.4, 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

/** Courier van facing east (heading 0). Cream body, teal stripe, cab at the front. */
export function drawVan(): HTMLCanvasElement {
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
  g.fillStyle = '#e6dcc0';
  g.beginPath();
  g.moveTo(0, 0.5);
  g.lineTo(L - 4, 0);
  g.quadraticCurveTo(L, 0, L, 4);
  g.lineTo(L, W - 4);
  g.quadraticCurveTo(L, W, L - 4, W);
  g.lineTo(0, W - 0.5);
  g.closePath();
  g.fill();
  // Roof stripe.
  g.fillStyle = '#2f7f7a';
  g.fillRect(2, W / 2 - 2, L - 12, 4);
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
  g.fillStyle = '#b9ae92';
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

/** The courier on foot, facing east: hi-vis shoulders, dark head. */
export function drawCourier(): HTMLCanvasElement {
  const [c, g] = canvas(14, 14);
  g.translate(7, 7);
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.beginPath();
  g.ellipse(1, 1, 4.5, 6, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#f0a640';
  g.beginPath();
  g.ellipse(0, 0, 4.2, 6, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#e8e2cf';
  g.fillRect(-0.6, -5.5, 1.2, 11);
  g.fillStyle = '#2b211b';
  g.beginPath();
  g.arc(0.6, 0, 2.9, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#d9b48c';
  g.fillRect(3, -0.8, 1.4, 1.6);
  return c;
}
