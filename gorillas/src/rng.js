// Seeded PRNG (mulberry32). Two streams per match (terrain / game) so wind
// rolls and AI noise can never perturb city generation.

export function createRng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (lo, hi) => lo + next() * (hi - lo),
    int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),   // inclusive
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    chance: (p) => next() < p,
    // For save/resume: mulberry32's entire state is one uint32.
    getState: () => a >>> 0,
    setState: (v) => { a = v >>> 0; },
  };
}

export function randomSeed() {
  return (Math.random() * 0xffffffff) >>> 0;
}
