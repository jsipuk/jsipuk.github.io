/* Standing Start — track data and the builder that turns it into a centreline.
 *
 * A track is described as a list of shape commands, never as geometry. The
 * builder walks the commands and produces the sampled centreline the
 * simulation and renderer both read. Adding a track means adding data; it
 * should never mean touching the renderer.
 *
 * Coordinates: x is right, z is forward, y is up. A heading of 0 points along
 * +z, and heading increases clockwise when viewed from above (turning right).
 */

export const forwardX = (h) => Math.sin(h);
export const forwardZ = (h) => Math.cos(h);
export const rightX = (h) => Math.cos(h);
export const rightZ = (h) => -Math.sin(h);

export const OVAL = {
  name: 'Prototype Oval',
  halfWidth: 20,      // asphalt, each side of the centreline
  shoulder: 14,       // off-track surface before the barrier
  segment: 5,         // centreline sample spacing, u
  start: { x: 0, z: 0, heading: 0 },
  shape: [
    { type: 'straight', length: 340 },
    { type: 'arc', radius: 185, sweep: 180 },
    { type: 'straight', length: 340 },
    { type: 'arc', radius: 185, sweep: 180 },
  ],
};

/**
 * Walk a track's shape commands and sample the centreline at a fixed spacing.
 * Returns typed arrays plus the derived measurements the rest of the game needs.
 */
export function buildTrack(def) {
  const xs = [];
  const zs = [];
  const hs = [];
  const cum = [];

  let x = def.start.x;
  let z = def.start.z;
  let h = def.start.heading;
  let s = 0;

  const push = () => { xs.push(x); zs.push(z); hs.push(h); cum.push(s); };
  push();

  for (const cmd of def.shape) {
    if (cmd.type === 'straight') {
      const steps = Math.max(1, Math.round(cmd.length / def.segment));
      const step = cmd.length / steps;
      for (let i = 0; i < steps; i++) {
        x += forwardX(h) * step;
        z += forwardZ(h) * step;
        s += step;
        push();
      }
    } else if (cmd.type === 'arc') {
      const sweep = (cmd.sweep * Math.PI) / 180;
      const arcLen = Math.abs(sweep) * cmd.radius;
      const steps = Math.max(1, Math.round(arcLen / def.segment));
      const step = arcLen / steps;
      const dh = sweep / steps;
      for (let i = 0; i < steps; i++) {
        // Advance along the chord, then rotate, so samples sit on the arc.
        h += dh / 2;
        x += forwardX(h) * step;
        z += forwardZ(h) * step;
        h += dh / 2;
        s += step;
        push();
      }
    } else {
      throw new Error('unknown track command: ' + cmd.type);
    }
  }

  // The loop is closed: the duplicated final sample is dropped and the total
  // length recorded so positions can wrap.
  const length = s;
  xs.pop(); zs.pop(); hs.pop(); cum.pop();

  return {
    def,
    name: def.name,
    halfWidth: def.halfWidth,
    shoulder: def.shoulder,
    segment: def.segment,
    count: xs.length,
    length,
    xs: Float64Array.from(xs),
    zs: Float64Array.from(zs),
    hs: Float64Array.from(hs),
    cum: Float64Array.from(cum),
    // How far the built loop misses its own start by. Useful in tests.
    closeError: Math.hypot(x - def.start.x, z - def.start.z),
  };
}

/** Wrap a sample index into range. */
export function wrapIndex(track, i) {
  const n = track.count;
  return ((i % n) + n) % n;
}

/**
 * Locate a world position against the track, searching outward from a hint
 * index. The car moves continuously, so a local search is enough and keeps
 * this off the profile.
 *
 * Returns { index, s, lateral, heading } where lateral is signed, positive to
 * the right of the direction of travel.
 */
export function locate(track, x, z, hint, span = 45) {
  let best = -1;
  let bestD = Infinity;
  for (let k = -span; k <= span; k++) {
    const i = wrapIndex(track, hint + k);
    const dx = x - track.xs[i];
    const dz = z - track.zs[i];
    const d = dx * dx + dz * dz;
    if (d < bestD) { bestD = d; best = i; }
  }

  const h = track.hs[best];
  const dx = x - track.xs[best];
  const dz = z - track.zs[best];
  const along = dx * forwardX(h) + dz * forwardZ(h);
  const lateral = dx * rightX(h) + dz * rightZ(h);

  let s = track.cum[best] + along;
  if (s < 0) s += track.length;
  if (s >= track.length) s -= track.length;

  return { index: best, s, lateral, heading: h };
}

/** Signed smallest difference between two angles, in radians. */
export function angleDelta(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
