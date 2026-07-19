// rng.js — the one source of randomness. mulberry32, seeded, with a serializable
// cursor so a save resumes its stream exactly (browser and Node identical).
//
// PLAN.md §4.2/§4.6: all randomness flows through here; getState()/setState()
// let the cursor round-trip through JSON.stringify into the save.
//
// Pure module: no DOM, no Date, no Math.random.

/**
 * Create a seeded RNG. `seed` is coerced to a uint32.
 * @param {number} seed
 * @returns {{
 *   next: () => number,          // float in [0, 1)
 *   d100: () => number,          // integer in [1, 100]
 *   range: (min:number, max:number) => number,  // integer in [min, max] inclusive
 *   chance: (p:number) => boolean,               // true with probability p
 *   pick: <T>(arr:T[]) => T,
 *   shuffle: <T>(arr:T[]) => T[],                // returns a new shuffled array
 *   getState: () => number,      // current cursor (uint32) — serialize this
 *   setState: (s:number) => void // restore a cursor
 * }}
 */
export function createRng(seed) {
  // The mutable cursor. mulberry32 advances it by a fixed increment each draw.
  let a = (seed >>> 0);

  function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function range(min, max) {
    if (max < min) [min, max] = [max, min];
    return Math.floor(next() * (max - min + 1)) + min;
  }

  return {
    next,
    d100: () => Math.floor(next() * 100) + 1,
    range,
    chance: (p) => next() < p,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    shuffle: (arr) => {
      const out = arr.slice();
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },
    getState: () => (a >>> 0),
    setState: (s) => { a = (s >>> 0); }
  };
}

/**
 * Convenience: build an RNG positioned at a saved cursor.
 * @param {number} seed  original seed (kept for reference/back-compat)
 * @param {number} cursor  a value previously returned by getState()
 */
export function rngFromState(seed, cursor) {
  const rng = createRng(seed);
  rng.setState(cursor);
  return rng;
}

export default createRng;
