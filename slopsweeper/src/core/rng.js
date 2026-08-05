// @ts-check
// Seeded PRNG (mulberry32), ported from gorillas/src/rng.js. Two streams per game so
// routing tie-breaks can never perturb block draws and mine rolls (PLAN §7.5).
// Math.random is forbidden everywhere in core.

/**
 * @typedef {object} RngExtras
 * @property {(lo: number, hi: number) => number} range
 * @property {(lo: number, hi: number) => number} int    inclusive
 * @property {<T>(arr: T[]) => T} pick
 * @property {(p: number) => boolean} chance
 * @property {() => number} getState
 * @property {(v: number) => void} setState
 */

/** @typedef {(() => number) & RngExtras} Rng */

/** The whole state of a mulberry32 stream is one uint32 — that is why GameState.rng is two numbers. */
export const MOVE_STREAM_XOR = 0x9e3779b9;

/**
 * @param {number} seed  also the raw stream state: mulberry32(x) resumes exactly where getState() === x
 * @returns {Rng}
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  const next = /** @type {Rng} */ (() => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  });
  next.range = (lo, hi) => lo + next() * (hi - lo);
  next.int = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1));
  next.pick = (arr) => arr[Math.floor(next() * arr.length)];
  next.chance = (p) => next() < p;
  next.getState = () => a >>> 0;
  next.setState = (v) => { a = v >>> 0; };
  return next;
}

/** Resume a stream from a state carried in GameState.rng. */
export const fromState = mulberry32;

/**
 * The stream split: gen = seed, move = seed ^ 0x9e3779b9 (PLAN §7.5).
 * @param {number} seed
 * @returns {{ gen: number, move: number }}
 */
export function initStreams(seed) {
  const s = seed >>> 0;
  return { gen: s, move: (s ^ MOVE_STREAM_XOR) >>> 0 };
}

/** Non-deterministic entry point — UI only, never core. */
export function randomSeed() {
  return (Math.random() * 0xffffffff) >>> 0;
}
