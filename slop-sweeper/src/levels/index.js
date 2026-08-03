// @ts-check
// The level registry. A new level is one file plus one line here (PLAN §9.1); every
// optional field defaults from rules.js, so `{ id, map }` alone is a playable level.

import { LEVEL_DEFAULTS } from '../core/rules.js';
import { plain } from './plain.js';

/**
 * @typedef {object} LevelDef
 * @property {string} id
 * @property {string} map        charmap: '.'/space VOID · '#' OCEAN · '^' VOLCANO · 'A' origin · 'B' dest
 * @property {string} [name]     default: id
 * @property {{ count: number, firstTick: number, every: number }} [arrivals]
 * @property {number} [mineDensity]
 * @property {'compact' | 'awkward' | 'heavy' | string[]} [shapePool]
 * @property {number} [analyzeReveals]
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
    arrivals: { ...LEVEL_DEFAULTS.arrivals, ...(def.arrivals ?? {}) },
    mineDensity: def.mineDensity ?? LEVEL_DEFAULTS.mineDensity,
    shapePool: def.shapePool ?? LEVEL_DEFAULTS.shapePool,
    analyzeReveals: def.analyzeReveals ?? LEVEL_DEFAULTS.analyzeReveals,
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

register(plain);
// M2: channel, atoll, caldera, strait, sprawl (PLAN §9 roster).
