// @ts-check
// Structural level validation (PLAN §9.1). Errors mean the level refuses to load — init()
// throws on them. Warnings mean "look at this", nothing more.
//
// Deliberately structural only. Whether a level is *good* is the sim's job (PLAN §13); if
// this file ever starts having opinions about difficulty it has grown into a designer.

import { LEVEL_DEFAULTS } from './rules.js';
import { caps, isEndpoint } from './state.js';
import { n4, parseMap } from './grid.js';
import { resolvePool } from './shapes.js';

/** @typedef {import('../levels/index.js').LevelDef} LevelDef */

/**
 * A performance ceiling, not a target. Raised 40 → 64 on 2026-08-04 with the board rescale
 * (PLAN §9): the corpus now runs 32×20 to 50×30, so 40 had become a design constraint
 * instead of a guard rail. 64×64 is 4096 cells — still nothing for the BFS passes, and
 * still small enough that a runaway generated map is caught rather than rendered.
 */
export const MAX_DIM = 64;

/** Below this a level is a formality rather than a build (warning only). */
const DEGENERATE_PATH = 4;

/** The band the sim was tuned against (warning only). */
const DENSITY_RANGE = [0.1, 0.4];

/**
 * @param {LevelDef} def
 * @returns {{ errors: string[], warnings: string[] }}
 */
export function validateLevel(def) {
  /** @type {string[]} */
  const errors = [];
  /** @type {string[]} */
  const warnings = [];

  if (!def || typeof def !== 'object') return { errors: ['level definition must be an object'], warnings };
  if (typeof def.id !== 'string' || def.id === '') errors.push('id must be a non-empty string');

  checkNumbers(def, errors, warnings);

  if (typeof def.map !== 'string') {
    errors.push('map must be a string');
    return { errors, warnings };
  }

  let m;
  try {
    m = parseMap(def.map);
  } catch (err) {
    // parseMap owns the unknown-character and endpoint-count errors, with row/column.
    errors.push(String(/** @type {Error} */ (err).message).replace(/^parseMap: /, ''));
    return { errors, warnings };
  }

  if (m.w > MAX_DIM || m.h > MAX_DIM) {
    errors.push(`board is ${m.w}×${m.h}; the ceiling is ${MAX_DIM}×${MAX_DIM}`);
  }

  // Every endpoint, not just the pair: 'A' plus 'B', 'C', 'D'… (rev. 2026-08-05). An endpoint
  // beside another endpoint is connected already, which is why the test asks whether the
  // neighbour is *any* endpoint rather than whether it is the one other one.
  /** @type {[string, number][]} */
  const endpoints = [['A', m.origin], ...m.dests.map((d, i) => /** @type {[string, number]} */ ([letter(i), d]))];
  for (const [label, end] of endpoints) {
    const reachable = n4(m, end).some((j) => isEndpoint(m, j) || caps(m.terrain[j]).handBuildable);
    if (!reachable) errors.push(`endpoint '${label}' has no buildable neighbour, so nothing can ever connect to it`);
  }

  // Every destination has to be reachable from 'A' over ground that could ever carry a route,
  // and each one is named when it is not — "the level is unwinnable" is not a useful sentence
  // on a three-destination map unless it says which leg is the impossible one.
  const reach = oceanReach(m, m.origin);
  const unreachable = m.dests.filter((d) => !reach.has(d));
  for (const d of unreachable) {
    errors.push(`no ocean connectivity from 'A' to '${letter(m.dests.indexOf(d))}' — the level is unwinnable by construction`);
  }
  if (unreachable.length === 0) {
    const near = oceanDistance(m);
    if (near.len < DEGENERATE_PATH) {
      warnings.push(`degenerate path length: A and ${letter(near.to)} are ${near.len} steps apart`);
    }
  }

  checkCast(def, m, errors);

  const stranded = strandedOcean(m, reach);
  if (stranded > 0) {
    warnings.push(`${stranded} ocean cell(s) are landlocked — unreachable from either endpoint and unusable`);
  }

  return { errors, warnings };
}

/**
 * @param {number} i
 * @returns {string} the charmap letter for destination `i` — 0 is 'B'
 */
function letter(i) {
  return String.fromCharCode('B'.charCodeAt(0) + i);
}

/**
 * The cast, in whichever of its two fields the level wrote it (PLAN §9.1). Structural only, like
 * everything else here: whether a level *should* send a user to C and D but never B is a design
 * question, and this file does not have those.
 *
 * Revised 2026-08-05 (owner decision — the walker cast list, SPEC §6.6). `walkers` is the newer,
 * wider field and `itineraries` the older, narrower one, and **a level may not carry both**. That
 * is an error rather than a merge or a precedence rule on purpose: the two fields say the same
 * kind of thing, so a definition with both is one whose author changed their mind halfway, and
 * the useful answer is to say so rather than to silently run whichever the code happens to
 * prefer. Everything else is shared — one `checkStops` implementation, so the two fields cannot
 * drift into accepting different letters.
 * @param {LevelDef} def
 * @param {import('./grid.js').ParsedMap} m
 * @param {string[]} errors
 */
function checkCast(def, m, errors) {
  // "Both" means both carrying entries, not both keys existing: `resolveLevel` fills every
  // optional field from the defaults, so a resolved level always has an `itineraries` and a
  // `walkers` and one of them is `[]`. An empty list is a level that did not author that field.
  if (def.itineraries?.length && def.walkers?.length) {
    errors.push('a level lists either itineraries or walkers, never both — walkers is the wider field, so keep that one');
  }
  const known = new Set(m.dests.map((_, i) => letter(i)));

  if (def.itineraries !== undefined) {
    if (!Array.isArray(def.itineraries)) {
      errors.push('itineraries must be an array of destination-letter arrays');
    } else {
      def.itineraries.forEach((entry, n) => checkStops(`itineraries[${n}]`, entry, known, errors, false));
    }
  }

  if (def.walkers !== undefined) {
    if (!Array.isArray(def.walkers)) {
      errors.push('walkers must be an array of { stops, ordered?, patience? }');
      return;
    }
    def.walkers.forEach((entry, n) => checkStops(`walkers[${n}]`, entry, known, errors, true));
  }
}

/**
 * One entry of either field: the rules for a list of stops, written once.
 *
 * Both shapes — the bare `['B','D']` and the object `{ stops, ordered }` — unwrap to the same
 * `stops` array and are then checked by the same loop, so the object form cannot quietly drift
 * into accepting a duplicate the array form refuses. `walkers` accepts the bare array too, and
 * that is deliberate rather than an oversight: an entry with no options *is* just a list of
 * stops, and refusing to read one would be this file having an opinion about style.
 *
 * `ordered` must be a boolean if it is present at all. `patience` is checked only where it means
 * something — an `itineraries` entry that carries one is naming a field that field has never had,
 * and the error says which list it was found in.
 * @param {string} label       how the message names this entry
 * @param {unknown} entry
 * @param {Set<string>} known  the destination letters this map carries
 * @param {string[]} errors
 * @param {boolean} allowPatience  true for `walkers`, the only field with a per-walker bar
 */
function checkStops(label, entry, known, errors, allowPatience) {
  const object = !Array.isArray(entry) && !!entry && typeof entry === 'object';
  const rec = /** @type {{ stops?: unknown, ordered?: unknown, patience?: unknown }} */ (
    object ? entry : {});
  const stops = object ? rec.stops : entry;
  if (rec.ordered !== undefined && typeof rec.ordered !== 'boolean') {
    errors.push(`${label}.ordered must be a boolean`);
  }
  if (rec.patience !== undefined) {
    if (!allowPatience) {
      errors.push(`${label} sets a patience, which only a walkers entry may do`);
    } else if (!Number.isInteger(rec.patience) || /** @type {number} */ (rec.patience) < 1) {
      errors.push(`${label}.patience must be a positive integer (got ${rec.patience})`);
    }
  }
  if (!Array.isArray(stops) || stops.length === 0) {
    errors.push(`${label} must be a non-empty array of destination letters, or { stops: [...], ordered }`);
    return;
  }
  /** @type {Set<string>} */
  const seen = new Set();
  for (const ch of stops) {
    if (typeof ch !== 'string' || !known.has(ch)) {
      errors.push(`${label} names '${ch}', which is not a destination on this map`);
    } else if (seen.has(ch)) {
      errors.push(`${label} visits '${ch}' twice`);
    }
    if (typeof ch === 'string') seen.add(ch);
  }
}

/**
 * The arrival schedule, in either of its two shapes (owner decision 2026-08-05, SPEC §6.1).
 *
 * `{ count, firstTick, every }` is the cadence; `{ at: [...] }` is the list of turns, and its
 * length is the count. **A definition carrying fields from both is an error, not a merge**: the
 * two forms answer the same question and a mixture is an author mid-edit, so the useful thing is
 * to name the collision rather than to pick a winner and ship a schedule nobody wrote.
 *
 * The list must be strictly increasing rather than merely sorted, because two users listed on
 * the same turn is not a thing the schedule can express — `spawns` walks the list one entry per
 * arrival — and a repeated turn is therefore a typo the author would want back. It must be
 * non-empty for the same reason `count` must be positive: a level with no arrivals cannot be won
 * or lost, it just runs.
 * @param {import('./rules.js').Arrivals} a
 * @param {string[]} errors
 */
function checkArrivals(a, errors) {
  if (!a || typeof a !== 'object') {
    errors.push('arrivals must be { count, firstTick, every } or { at: [...] }');
    return;
  }
  const listed = a.at !== undefined;
  const cadence = a.count !== undefined || a.firstTick !== undefined || a.every !== undefined;
  if (listed && cadence) {
    errors.push('arrivals is either { count, firstTick, every } or { at: [...] } — not both');
    return;
  }
  if (listed) {
    const at = a.at;
    if (!Array.isArray(at) || at.length === 0) {
      errors.push('arrivals.at must be a non-empty array of turn numbers');
      return;
    }
    at.forEach((t, i) => {
      if (!Number.isInteger(t) || t < 0) errors.push(`arrivals.at[${i}] must be a non-negative integer (got ${t})`);
      else if (i > 0 && t <= at[i - 1]) errors.push(`arrivals.at must be strictly increasing (${at[i - 1]} then ${t})`);
    });
    return;
  }
  if (!Number.isInteger(a.count) || /** @type {number} */ (a.count) < 1) errors.push(`arrivals.count must be a positive integer (got ${a.count})`);
  if (!Number.isInteger(a.firstTick) || /** @type {number} */ (a.firstTick) < 0) errors.push(`arrivals.firstTick must be a non-negative integer (got ${a.firstTick})`);
  if (!Number.isInteger(a.every) || /** @type {number} */ (a.every) < 1) errors.push(`arrivals.every must be a positive integer (got ${a.every})`);
}

/**
 * @param {LevelDef} def
 * @param {string[]} errors
 * @param {string[]} warnings
 */
function checkNumbers(def, errors, warnings) {
  checkArrivals(def.arrivals ?? LEVEL_DEFAULTS.arrivals, errors);

  const density = def.mineDensity ?? LEVEL_DEFAULTS.mineDensity;
  if (typeof density !== 'number' || !Number.isFinite(density) || density < 0 || density > 1) {
    errors.push(`mineDensity must be a probability in [0, 1] (got ${density})`);
  } else if (density < DENSITY_RANGE[0] || density > DENSITY_RANGE[1]) {
    warnings.push(`mineDensity ${density} is outside the tuned range ${DENSITY_RANGE[0]}–${DENSITY_RANGE[1]}`);
  }

  // A fraction, not a count: `0` is a level where reaching an intermediate destination buys
  // nothing but the walk (the beta rule, applied to real endpoints) and `1` is one where it
  // resets the clock outright. Both are settings somebody might mean, so both are legal.
  const refill = def.destRefill ?? LEVEL_DEFAULTS.destRefill;
  if (typeof refill !== 'number' || !Number.isFinite(refill) || refill < 0 || refill > 1) {
    errors.push(`destRefill must be a fraction in [0, 1] (got ${refill})`);
  }

  try {
    resolvePool(def.shapePool ?? LEVEL_DEFAULTS.shapePool);
  } catch (err) {
    errors.push(String(/** @type {Error} */ (err).message));
  }

  // `blastRadius: 0` is a level that only kills the triggerer; `betaSupply: 0` is a level
  // with the beta verb switched off. Both are meaningful settings, so both floor at zero.
  const ZERO_IS_MEANINGFUL = ['blastRadius', 'betaSupply'];
  for (const k of /** @type {const} */ (['userMoveEvery', 'blastRadius', 'patience', 'betaSupply'])) {
    const v = def[k];
    if (v === undefined) continue;
    const floor = ZERO_IS_MEANINGFUL.includes(k) ? 0 : 1;
    if (!Number.isInteger(v) || v < floor) errors.push(`${k} must be an integer ≥ ${floor} (got ${v})`);
  }
}

/**
 * Flood fill over cells a path could ever occupy: ocean, plus the endpoints themselves.
 * Volcano and void stop it by capability, never by name.
 * @param {import('./grid.js').ParsedMap} m
 * @param {number} from
 * @returns {Set<number>}
 */
function oceanReach(m, from) {
  /** @type {Set<number>} */
  const seen = new Set([from]);
  let frontier = [from];
  while (frontier.length) {
    /** @type {number[]} */
    const next = [];
    for (const i of frontier) {
      for (const j of n4(m, i)) {
        if (seen.has(j) || !caps(m.terrain[j]).handBuildable) continue;
        seen.add(j);
        next.push(j);
      }
    }
    frontier = next;
  }
  return seen;
}

/**
 * The *nearest* destination and how far off it is, over buildable water. The degenerate-path
 * warning is about whether the level is a formality, and a level is a formality the moment any
 * one of its destinations is two steps from the door.
 * @param {import('./grid.js').ParsedMap} m
 * @returns {{ len: number, to: number }} `to` indexes `m.dests`; `len` Infinity if none is reachable
 */
function oceanDistance(m) {
  /** @type {Map<number, number>} */
  const dist = new Map([[m.origin, 0]]);
  let frontier = [m.origin];
  while (frontier.length) {
    /** @type {number[]} */
    const next = [];
    for (const i of frontier) {
      const d = (dist.get(i) ?? 0) + 1;
      for (const j of n4(m, i)) {
        if (dist.has(j)) continue;
        const at = m.dests.indexOf(j);
        if (at < 0 && !caps(m.terrain[j]).handBuildable) continue;
        dist.set(j, d);
        if (at >= 0) return { len: d, to: at };
        next.push(j);
      }
    }
    frontier = next;
  }
  return { len: Infinity, to: 0 };
}

/**
 * @param {import('./grid.js').ParsedMap} m
 * @param {Set<number>} fromOrigin
 * @returns {number}
 */
function strandedOcean(m, fromOrigin) {
  /** @type {Set<number>} */
  const fromDest = new Set();
  for (const d of m.dests) for (const c of oceanReach(m, d)) fromDest.add(c);
  let n = 0;
  for (let i = 0; i < m.terrain.length; i++) {
    if (!caps(m.terrain[i]).handBuildable) continue;
    if (!fromOrigin.has(i) && !fromDest.has(i)) n++;
  }
  return n;
}

/**
 * @param {LevelDef} def
 * @returns {LevelDef} the same def, once it is known to be loadable
 */
export function assertValidLevel(def) {
  const { errors } = validateLevel(def);
  if (errors.length) {
    throw new Error(`level '${def?.id ?? '?'}' is invalid:\n  - ${errors.join('\n  - ')}`);
  }
  return def;
}
