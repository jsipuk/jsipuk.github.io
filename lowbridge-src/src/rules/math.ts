// Small geometry helpers shared by the rules. Screen coordinates: x right, y down.
// A heading of 0 faces east; PI/2 faces south (screen down).

export interface Vec {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/** Wrap an angle to (-PI, PI]. */
export function wrapAngle(a: number): number {
  let r = a % (Math.PI * 2);
  if (r <= -Math.PI) r += Math.PI * 2;
  if (r > Math.PI) r -= Math.PI * 2;
  return r;
}

/** Signed shortest turn from `current` to `target`. Positive turns clockwise on screen. */
export const angleDiff = (target: number, current: number): number => wrapAngle(target - current);

export const forward = (heading: number): Vec => ({ x: Math.cos(heading), y: Math.sin(heading) });

/** The right-hand side of something facing `heading`, as seen from above. */
export const rightOf = (heading: number): Vec => ({ x: -Math.sin(heading), y: Math.cos(heading) });

export function pointInRect(p: Vec, r: Rect, pad = 0): boolean {
  return p.x >= r.x - pad && p.x <= r.x + r.w + pad && p.y >= r.y - pad && p.y <= r.y + r.h + pad;
}

export const rectCentre = (r: Rect): Vec => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

/** Points around an oriented box: corners, edge midpoints and quarter points on the long sides. */
export function boxOutline(x: number, y: number, heading: number, halfLength: number, halfWidth: number): Vec[] {
  const f = forward(heading);
  const r = rightOf(heading);
  const out: Vec[] = [];
  const along = [-1, -0.5, 0, 0.5, 1];
  for (const a of along) {
    for (const side of [-1, 1]) {
      out.push({
        x: x + f.x * a * halfLength + r.x * side * halfWidth,
        y: y + f.y * a * halfLength + r.y * side * halfWidth,
      });
    }
  }
  // Front and rear centres.
  out.push({ x: x + f.x * halfLength, y: y + f.y * halfLength });
  out.push({ x: x - f.x * halfLength, y: y - f.y * halfLength });
  return out;
}

export function boxCorners(x: number, y: number, heading: number, halfLength: number, halfWidth: number): Vec[] {
  const f = forward(heading);
  const r = rightOf(heading);
  return [
    [1, 1],
    [1, -1],
    [-1, -1],
    [-1, 1],
  ].map(([a, s]) => ({
    x: x + f.x * a * halfLength + r.x * s * halfWidth,
    y: y + f.y * a * halfLength + r.y * s * halfWidth,
  }));
}

/** Distance from a point to an oriented box (0 when inside). */
export function distanceToBox(
  p: Vec,
  x: number,
  y: number,
  heading: number,
  halfLength: number,
  halfWidth: number,
): number {
  const f = forward(heading);
  const r = rightOf(heading);
  const dx = p.x - x;
  const dy = p.y - y;
  const along = Math.abs(dx * f.x + dy * f.y) - halfLength;
  const across = Math.abs(dx * r.x + dy * r.y) - halfWidth;
  const ox = Math.max(along, 0);
  const oy = Math.max(across, 0);
  return Math.hypot(ox, oy);
}
