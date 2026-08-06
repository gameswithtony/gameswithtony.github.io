// @ts-check
// The level registry. A new level is one file plus one line here (PLAN §9.1); every
// optional field defaults from rules.js, so `{ id, map }` alone is a playable level.

import { LEVEL_DEFAULTS } from '../core/rules.js';
import { tutorial } from './tutorial.js';
import { channel } from './channel.js';
import { strait } from './strait.js';
import { caldera } from './caldera.js';
import { atoll } from './atoll.js';
import { delta } from './delta.js';
import { marina } from './marina.js';
import { gyre } from './gyre.js';
import { reach } from './reach.js';
import { sprawl } from './sprawl.js';

/**
 * @typedef {object} LevelDef
 * @property {string} id
 * @property {string} map        charmap: '.'/space VOID · '#' OCEAN · '^' VOLCANO · 'A' origin · 'B'…'H' destinations
 * @property {string} [name]     default: id
 * @property {import('../core/rules.js').Arrivals} [arrivals]
 *                                       `{ count, firstTick, every }` — a cadence — or
 *                                       `{ at: [2, 5, 9] }`, the turns spelled out, whose
 *                                       length is the user count. Never both (rev. 2026-08-05)
 * @property {number} [mineDensity]
 * @property {number} [patience]         the level's bar; a walker may carry its own
 * @property {number} [betaSupply]
 * @property {import('../core/rules.js').WalkerDef[]} [walkers]
 *                                       THE CAST (2026-08-05): the roles this level is written
 *                                       for, dealt against `arrivals` by seed. An entry is
 *                                       `{ stops: ['B','D'], ordered?, patience? }`. Mutually
 *                                       exclusive with `itineraries`, which is this field
 *                                       without the per-walker bar
 * @property {import('../core/rules.js').Itinerary[]} [itineraries]
 *                                       destination letters per user, dealt from the seed;
 *                                       omitted or empty = every user visits every destination.
 *                                       An entry is `['B','D']` (any order) or
 *                                       `{ stops: ['B','D'], ordered: true }` (that order,
 *                                       enforced — rev. 2026-08-05)
 * @property {number} [destRefill]       patience returned on an intermediate stop; default 0.5
 * @property {'compact' | 'awkward' | 'heavy' | string[]} [shapePool]
 * @property {number} [userMoveEvery]
 * @property {number} [blastRadius]
 */

/** @typedef {Required<LevelDef>} ResolvedLevel */

/** @type {Map<string, LevelDef>} */
const REGISTRY = new Map();

/**
 * @param {LevelDef} def
 * @returns {LevelDef}
 */
export function register(def) {
  if (!def || typeof def.id !== 'string' || !def.id) throw new Error('register: level needs an id');
  if (typeof def.map !== 'string') throw new Error(`register: level '${def.id}' needs a map`);
  if (REGISTRY.has(def.id)) throw new Error(`register: level '${def.id}' is already registered`);
  REGISTRY.set(def.id, def);
  return def;
}

/**
 * Apply every field default. The reducer takes a LevelDef and falls back to the same
 * constants, so a hand-written definition works unresolved too.
 * @param {LevelDef} def
 * @returns {ResolvedLevel}
 */
export function resolveLevel(def) {
  return {
    id: def.id,
    name: def.name ?? def.id,
    map: def.map,
    // The cadence form fills its gaps from the defaults, as it always has; the explicit form
    // has no gaps to fill and is copied whole. Merging the two would produce a definition
    // carrying fields from both shapes, which is exactly what the validator refuses — so the
    // resolver must not be the thing that builds one (rev. 2026-08-05).
    arrivals: def.arrivals?.at !== undefined
      ? { at: def.arrivals.at.slice() }
      : { ...LEVEL_DEFAULTS.arrivals, ...(def.arrivals ?? {}) },
    mineDensity: def.mineDensity ?? LEVEL_DEFAULTS.mineDensity,
    patience: def.patience ?? LEVEL_DEFAULTS.patience,
    betaSupply: def.betaSupply ?? LEVEL_DEFAULTS.betaSupply,
    itineraries: def.itineraries ?? LEVEL_DEFAULTS.itineraries,
    walkers: def.walkers ?? LEVEL_DEFAULTS.walkers,
    destRefill: def.destRefill ?? LEVEL_DEFAULTS.destRefill,
    shapePool: def.shapePool ?? LEVEL_DEFAULTS.shapePool,
    userMoveEvery: def.userMoveEvery ?? LEVEL_DEFAULTS.userMoveEvery,
    blastRadius: def.blastRadius ?? LEVEL_DEFAULTS.blastRadius,
  };
}

/**
 * @param {string} id
 * @returns {ResolvedLevel}
 */
export function getLevel(id) {
  const def = REGISTRY.get(id);
  if (!def) throw new Error(`unknown level '${id}' (have: ${levelIds().join(', ')})`);
  return resolveLevel(def);
}

/** @returns {string[]} */
export function levelIds() {
  return [...REGISTRY.keys()];
}

/** @returns {ResolvedLevel[]} */
export function allLevels() {
  return levelIds().map(getLevel);
}

// The corpus (PLAN §9). One line each — that is the whole registration cost.
//
// THE TEN-LEVEL LINEUP (2026-08-06, owner decision), and the order below is not incidental:
// **this list is the menu, and the menu is the difficulty arc.** The registry used to be
// grouped by when a level was written — the six PLAN §9 levels in their tuning order, with
// `delta` bolted on the end because it was the multi-destination showcase and nobody wanted to
// disturb the corpus rows. That is a changelog, not a curriculum, and it stopped being tenable
// the day the corpus went to ten.
//
// So it is re-sorted by what a player meets, front to back: `tutorial` teaches the verbs on
// open water; `channel` and `strait` are the two one-neck levels; `caldera` and `atoll` make
// you walk around something; `delta` is the first trunk decision with several destinations;
// `marina`, `gyre` and `reach` are the 2026-08-06 trio — a comb of independent piers, a ring
// with a direction to choose, and a sixty-seven-tile switchback built for betas; and `sprawl`
// is last because it is the widest, longest and least forgiving thing here.
//
// Two things this order is load-bearing for. `tutorial` stays FIRST — `main.js` opens a new
// player on `levelIds()[0]`, so line one of this list is the level the game starts on, and it
// was `plain` in that slot until the control level was retired and rebuilt as the teaching
// level earlier the same day (see `tutorial.js`): the id moved, the position did not. And
// `--all` reads straight down the registry, so a corpus sim table now prints in difficulty
// order — the rows moved on this date and the numbers did not.
register(tutorial);
register(channel);
register(strait);
register(caldera);
register(atoll);
register(delta);
register(marina);
register(gyre);
register(reach);
register(sprawl);

