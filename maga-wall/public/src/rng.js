/* A tiny seeded PRNG (mulberry32). Seeded so a run can be replayed exactly in
 * tests; the game itself seeds from the clock.
 */
export function makeRng(seed = 1) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.int = (n) => Math.floor(next() * n);
  next.range = (lo, hi) => lo + next() * (hi - lo);
  next.pick = (arr) => arr[Math.floor(next() * arr.length)];
  /** Weighted pick from a { key: weight } object. */
  next.weighted = (weights) => {
    let total = 0;
    for (const k in weights) total += weights[k];
    let roll = next() * total;
    for (const k in weights) {
      roll -= weights[k];
      if (roll <= 0) return k;
    }
    return Object.keys(weights)[0];
  };
  return next;
}
