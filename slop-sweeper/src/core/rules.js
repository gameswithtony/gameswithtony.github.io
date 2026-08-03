// @ts-check
// Every tunable number in the game, one file (SPEC §10.2, PLAN §8). None of these is
// sacred except the structural ones marked SPEC — the sim (§13) tunes the rest.

export const RULES = Object.freeze({
  CONFIDENCE_START: 100,
  WAIT_DRAIN_PER_USER: 0.75,   // per waiting user per tick — continuous, scales (SPEC §8.2)
  DETONATE_HIT: 10,
  SERVED_BONUS: 0,            // tuning lever only; no confidence regeneration (PLAN §3.11)
  BLAST_RADIUS: 1,            // tile + orthogonals (SPEC §5 baseline)
  ANALYZE_REVEALS: 5,
  USER_MOVE_EVERY: 1,         // OPEN #1
  ART_PX_PER_TILE: 8,         // SPEC §10.8
  FONT_MIN_DEVICE_PX: 10,     // zoom tiers derive from this, never tuned apart (SPEC §10.8)
  ZOOM_MAX_ARTPX: 12,
  TAP_SLOP_CSS: 6,
  TAP_MS: 250,
  STEP_TWEEN_MS: 120,         // view only
  FF_INTERVAL_MS: 180,        // view only
});

/**
 * Defaults for every optional LevelDef field (PLAN §6). `levels/index.js` applies them;
 * they live here so there is exactly one place a number is written down.
 * @typedef {object} LevelParams
 * @property {{ count: number, firstTick: number, every: number }} arrivals
 * @property {number} mineDensity
 * @property {'compact' | 'awkward' | 'heavy' | string[]} shapePool
 * @property {number} analyzeReveals
 * @property {number} userMoveEvery
 * @property {number} blastRadius
 */

/** @type {LevelParams} */
export const LEVEL_DEFAULTS = Object.freeze({
  arrivals: Object.freeze({ count: 10, firstTick: 6, every: 4 }),
  mineDensity: 0.25,
  shapePool: 'compact',
  analyzeReveals: RULES.ANALYZE_REVEALS,
  userMoveEvery: RULES.USER_MOVE_EVERY,
  blastRadius: RULES.BLAST_RADIUS,
});
