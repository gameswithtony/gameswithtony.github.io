// @ts-check
// Every tunable number in the game, one file (SPEC §10.2, PLAN §8). None of these is
// sacred except the structural ones marked SPEC — the sim (§13) tunes the rest.

export const RULES = Object.freeze({
  CONFIDENCE_START: 100,
  // Per waiting user per tick — continuous, scales (SPEC §8.2). Lowered 0.75 → 0.40 on
  // 2026-08-04: routes roughly doubled with the board rescale (PLAN §9), so a competent
  // build now costs about twice as many turns and the waiting integral doubled with it.
  // At 0.75 every level in the corpus lost on the meter alone, whatever the player did.
  // The budget is CONFIDENCE_START / this ≈ 267 waiting-user-ticks per game. Three eighths
  // rather than a round 0.4 because it is exact in binary: the meter is subtracted from
  // once per tick and compared to zero, and 0.4 accumulates drift within a few dozen ticks.
  WAIT_DRAIN_PER_USER: 0.375,
  DETONATE_HIT: 10,
  SERVED_BONUS: 0,            // tuning lever only; no confidence regeneration (PLAN §3.11)
  BLAST_RADIUS: 1,            // tile + orthogonals (SPEC §5 baseline)
  // Raised 5 → 8 on 2026-08-04 with the block rescale (PLAN §10): a review has to make a
  // visible dent in a 12–25-cell block or Analyze stops being a verb and becomes a tax.
  // Eight still leaves the biggest blocks needing three reviews to read end to end.
  ANALYZE_REVEALS: 8,
  USER_MOVE_EVERY: 1,         // OPEN #1
  ART_PX_PER_TILE: 16,        // SPEC §10.8 (revised 2026-08-04: finer art grid, calmer tiles)
  FONT_MIN_DEVICE_PX: 10,     // zoom tiers derive from this, never tuned apart (SPEC §10.8)
  ZOOM_MAX_ARTPX: 6,          // 16 × 6 = 96 device px per tile, the same ceiling as before
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
  // Lowered 0.25 → 0.14 on 2026-08-04 with the block rescale: at twelve to twenty-five
  // cells a block, 0.25 means six defects in one generation, which is not a puzzle. The
  // corpus runs 0.10–0.14 (PLAN §9); the validator still warns outside 0.10–0.40.
  mineDensity: 0.14,
  shapePool: 'compact',
  analyzeReveals: RULES.ANALYZE_REVEALS,
  userMoveEvery: RULES.USER_MOVE_EVERY,
  blastRadius: RULES.BLAST_RADIUS,
});
