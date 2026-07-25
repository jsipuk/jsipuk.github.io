/**
 * Deterministic-friendly id helpers.
 *
 * `createId` uses a monotonic counter plus a seedable pseudo-random suffix so
 * tests can produce stable ids by calling `setIdSeed`.
 */

let counter = 0;
let seed = 0;

/** Mulberry32: small, fast, deterministic. */
export function createRng(initialSeed: number): () => number {
  let state = initialSeed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let rng = createRng(Date.now());

/** Makes id generation deterministic. Used by tests and the seeded demo save. */
export function setIdSeed(newSeed: number): void {
  seed = newSeed;
  counter = 0;
  rng = createRng(newSeed);
}

export function createId(prefix: string): string {
  counter += 1;
  const random = Math.floor(rng() * 0xffffff)
    .toString(36)
    .padStart(4, '0');
  return `${prefix}_${counter.toString(36)}${random}`;
}

export function currentIdSeed(): number {
  return seed;
}

/** Zero-padded serial suffix, e.g. 7 -> "0007". */
export function padSerial(value: number, width = 4): string {
  return value.toString().padStart(width, '0');
}
