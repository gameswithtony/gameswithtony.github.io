// @ts-check
// CASTING (owner decision 2026-08-05, SPEC §6.6): who walks out of the door, in what order,
// this run. A level authors a *cast* — a pool of walkers — and every game deals that pool
// against the arrival schedule. Same seed, same deal; different seed, different deal.
//
// It exists because the two obvious designs are both worse than this one. **Fixed round-robin**
// (what `itineraries` did until today) makes the tenth user's list a property of the level, so
// replaying a level is the same experience twice and the only variable left is the board. **A
// fresh roll per spawn** makes the demand unknowable, which SPEC §6.1's forecast forbids — you
// cannot budget turns against a schedule that is still being invented. Casting is the third
// answer: the *whole cast is dealt at init*, so the demand is fixed and forecastable from the
// first turn of the game, and it is dealt *from the seed*, so the same level asks a different
// question of you the next time you press New Game.
//
// Everything here is pure in (def, seed). Nothing it produces is stored: `resolveCast` runs at
// `init()`, its answer rides in LevelParams beside the level's other numbers (state.js), and a
// save restored days later re-derives the identical cast from the seed it already carries —
// which is the whole reason a per-walker feature could land without a save version.

import { mulberry32 } from './rng.js';

/** @typedef {import('./rules.js').WalkerDef} WalkerDef */
/** @typedef {import('./rules.js').Arrivals} Arrivals */
/** @typedef {import('../levels/index.js').LevelDef} LevelDef */

/**
 * The casting stream's split constant, and it is deliberately **not** `0x9e3779b9`.
 *
 * That one is already spoken for: `rng.MOVE_STREAM_XOR` is the golden-ratio constant, so
 * `mulberry32(seed ^ 0x9e3779b9)` is the movement stream, and a casting stream built from it
 * would draw the same numbers that decide movement tie-breaks — dealt from the same sequence,
 * one step ahead of it. That is not a bug you would ever see, which is exactly why it is worth
 * refusing: two streams that correlate perfectly and silently are a trap for whoever reads this
 * next. `0x85ebca6b` is murmur3's finalizer constant, unused as a stream split anywhere else in
 * the codebase.
 *
 * The stream is **private and init-time only**. It is created here, consumed here, and thrown
 * away; it is never written into `GameState.rng`, and neither the generation nor the movement
 * stream advances by a single step because of anything in this file. That is the mechanism by
 * which the six corpus levels play bit-for-bit the games they played before casting existed —
 * their sim rows are byte-compared, not argued for.
 */
export const CAST_STREAM_XOR = 0x85ebca6b;

/**
 * How many users a schedule brings, whichever shape it is written in (SPEC §6.1).
 * @param {Arrivals} a
 * @returns {number}
 */
export function arrivalCount(a) {
  return a.at ? a.at.length : a.count;
}

/**
 * @param {number} i
 * @returns {string} the charmap letter for destination `i` — 0 is 'B'
 */
function letter(i) {
  return String.fromCharCode('B'.charCodeAt(0) + i);
}

/**
 * One authored entry, normalized. `ordered` is written out as a real boolean and `patience` is
 * carried only when the author actually set one, so a cast entry answers both questions without
 * anybody downstream having to know which of the three authoring shapes it came from.
 * @param {WalkerDef | import('./rules.js').Itinerary} entry
 * @returns {WalkerDef}
 */
function normalize(entry) {
  const loose = Array.isArray(entry);
  const stops = (loose ? entry : entry.stops).slice();
  const ordered = !loose && entry.ordered === true;
  const patience = !loose && typeof (/** @type {WalkerDef} */ (entry).patience) === 'number'
    ? /** @type {WalkerDef} */ (entry).patience
    : undefined;
  return Object.freeze(patience === undefined ? { stops, ordered } : { stops, ordered, patience });
}

/**
 * **The pool a level offers**, in the order the level wrote it, before any dealing happens.
 *
 * Three sources, checked in the order a level would reach for them:
 *   · `walkers` — the explicit cast, the only form that can say `patience`.
 *   · `itineraries` — the older field, read as walkers with no patience override. This is what
 *     makes the new machinery a superset rather than a replacement: an `itineraries` level goes
 *     through exactly the same deal, and the only thing it cannot express is a per-walker bar.
 *   · neither — the implicit role: **one walker who owes every destination on the board.** That
 *     is the same sentence `itineraryFor`'s empty-list case has always meant, and on a
 *     one-destination level it is "everybody goes to B", which is the game every shipped level
 *     is. A one-entry pool cycles to a cast of identical entries and shuffles to itself, so the
 *     corpus passes through casting without casting being able to change it.
 *
 * The two fields are mutually exclusive and `validate.js` says so; the order here is the
 * tie-break for a definition that got past the validator anyway (a Lab paste, a hand-built test
 * fixture), and it prefers the more expressive field.
 * @param {LevelDef} def
 * @param {number} destCount  how many destinations the map carries
 * @returns {WalkerDef[]}
 */
export function castPool(def, destCount) {
  const walkers = def.walkers ?? [];
  if (walkers.length > 0) return walkers.map(normalize);
  const itineraries = def.itineraries ?? [];
  if (itineraries.length > 0) return itineraries.map(normalize);
  return [Object.freeze({ stops: Array.from({ length: destCount }, (_, i) => letter(i)), ordered: false })];
}

/**
 * **The deal.** Pool in, `count` walkers out, entry k belonging to spawn k.
 *
 * Two branches, and which one you get is decided by a comparison rather than by a flag, because
 * "I wrote more roles than there are arrivals" and "I wrote fewer" are different intentions and
 * the count is how an author states which one they meant:
 *
 * **Pool ≥ count — a seeded SUBSET.** Shuffle the pool, take the first `count`. An oversized
 * cast means some members simply do not appear this run, which is the owner's explicit request
 * and the sharpest version of "replaying a level is not the same experience twice": twelve roles
 * over nine arrivals is a level that asks nine of twelve possible questions and never the same
 * nine. It costs the author nothing to opt out — write exactly `count` roles and every one of
 * them is cast, in a shuffled order.
 *
 * **Pool < count — cycle, THEN shuffle.** The pool is repeated head-to-tail to exactly `count`
 * entries first, and only then shuffled, so **the authored mix is preserved exactly**: three
 * roles over nine arrivals is 3/3/3 on every seed, and only the running order moves. Shuffling a
 * three-entry pool nine times independently would have been the obvious implementation and it is
 * the wrong one — it would let a seed deal six of one role and none of another, which turns a
 * mix the author balanced into a lottery, and it would make the demand forecast (SPEC §6.1) a
 * distribution instead of a fact. Ratios are authored; order is rolled.
 *
 * Both branches are the same three lines — build a deck, shuffle the whole deck, take `count` —
 * because they *are* the same operation over two different decks, and writing them as two
 * functions would invite them to drift.
 *
 * Fisher–Yates, descending, one draw per swap: a uniform permutation, and taking a prefix of a
 * uniform permutation is a uniform subset in uniform order, so the subset branch needs no
 * separate argument.
 *
 * @param {WalkerDef[]} pool   at least one entry (castPool guarantees it)
 * @param {number} count       arrivals; the cast comes back exactly this long
 * @param {number} seed        the game's seed — the private stream is derived here and dropped
 * @returns {WalkerDef[]}
 */
export function resolveCast(pool, count, seed) {
  if (count <= 0 || pool.length === 0) return [];
  const rng = mulberry32((seed ^ CAST_STREAM_XOR) >>> 0);
  /** @type {WalkerDef[]} */
  const deck = pool.length >= count
    ? pool.slice()
    : Array.from({ length: count }, (_, k) => pool[k % pool.length]);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = deck[i];
    deck[i] = deck[j];
    deck[j] = t;
  }
  return deck.slice(0, count);
}

/**
 * The whole of the above, as `init()` uses it.
 * @param {LevelDef} def
 * @param {number} destCount
 * @param {Arrivals} arrivals
 * @param {number} seed
 * @returns {WalkerDef[]} one entry per scheduled user, in spawn order
 */
export function castFor(def, destCount, arrivals, seed) {
  return resolveCast(castPool(def, destCount), arrivalCount(arrivals), seed);
}
