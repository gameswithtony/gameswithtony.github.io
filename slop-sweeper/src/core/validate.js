// @ts-check
// Structural level validation (PLAN §9.1). Errors mean the level refuses to load — init()
// throws on them. Warnings mean "look at this", nothing more.
//
// Deliberately structural only. Whether a level is *good* is the sim's job (PLAN §13); if
// this file ever starts having opinions about difficulty it has grown into a designer.

import { LEVEL_DEFAULTS } from './rules.js';
import { caps } from './state.js';
import { n4, parseMap } from './grid.js';
import { resolvePool } from './shapes.js';

/** @typedef {import('../levels/index.js').LevelDef} LevelDef */

/** SPEC §11 sizes the corpus modestly; 40×40 is the performance ceiling, not the target. */
export const MAX_DIM = 40;

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

  for (const [label, end] of /** @type {[string, number][]} */ ([['A', m.origin], ['B', m.dest]])) {
    const other = end === m.origin ? m.dest : m.origin;
    const reachable = n4(m, end).some((j) => j === other || caps(m.terrain[j]).handBuildable);
    if (!reachable) errors.push(`endpoint '${label}' has no buildable neighbour, so nothing can ever connect to it`);
  }

  const reach = oceanReach(m, m.origin);
  if (!reach.has(m.dest)) {
    errors.push("no ocean connectivity from 'A' to 'B' — the level is unwinnable by construction");
  } else {
    const len = oceanDistance(m);
    if (len < DEGENERATE_PATH) warnings.push(`degenerate path length: A and B are ${len} steps apart`);
  }

  const stranded = strandedOcean(m, reach);
  if (stranded > 0) {
    warnings.push(`${stranded} ocean cell(s) are landlocked — unreachable from either endpoint and unusable`);
  }

  return { errors, warnings };
}

/**
 * @param {LevelDef} def
 * @param {string[]} errors
 * @param {string[]} warnings
 */
function checkNumbers(def, errors, warnings) {
  const arrivals = def.arrivals ?? LEVEL_DEFAULTS.arrivals;
  if (!arrivals || typeof arrivals !== 'object') {
    errors.push('arrivals must be { count, firstTick, every }');
  } else {
    if (!Number.isInteger(arrivals.count) || arrivals.count < 1) errors.push(`arrivals.count must be a positive integer (got ${arrivals.count})`);
    if (!Number.isInteger(arrivals.firstTick) || arrivals.firstTick < 0) errors.push(`arrivals.firstTick must be a non-negative integer (got ${arrivals.firstTick})`);
    if (!Number.isInteger(arrivals.every) || arrivals.every < 1) errors.push(`arrivals.every must be a positive integer (got ${arrivals.every})`);
  }

  const density = def.mineDensity ?? LEVEL_DEFAULTS.mineDensity;
  if (typeof density !== 'number' || !Number.isFinite(density) || density < 0 || density > 1) {
    errors.push(`mineDensity must be a probability in [0, 1] (got ${density})`);
  } else if (density < DENSITY_RANGE[0] || density > DENSITY_RANGE[1]) {
    warnings.push(`mineDensity ${density} is outside the tuned range ${DENSITY_RANGE[0]}–${DENSITY_RANGE[1]}`);
  }

  try {
    resolvePool(def.shapePool ?? LEVEL_DEFAULTS.shapePool);
  } catch (err) {
    errors.push(String(/** @type {Error} */ (err).message));
  }

  for (const k of /** @type {const} */ (['analyzeReveals', 'userMoveEvery', 'blastRadius'])) {
    const v = def[k];
    if (v === undefined) continue;
    const floor = k === 'blastRadius' ? 0 : 1;
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
 * @param {import('./grid.js').ParsedMap} m
 * @returns {number} steps from A to B over buildable water
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
        if (j !== m.dest && !caps(m.terrain[j]).handBuildable) continue;
        dist.set(j, d);
        if (j === m.dest) return d;
        next.push(j);
      }
    }
    frontier = next;
  }
  return Infinity;
}

/**
 * @param {import('./grid.js').ParsedMap} m
 * @param {Set<number>} fromOrigin
 * @returns {number}
 */
function strandedOcean(m, fromOrigin) {
  const fromDest = oceanReach(m, m.dest);
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
