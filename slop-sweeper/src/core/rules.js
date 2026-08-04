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
  // Lowered 10 → 7 on 2026-08-04 with single-click Analyze. The explicit hit was set when
  // one review turned over eight tiles, so a defect was cheap to find; now it is not, and
  // the *implicit* cost of a blast has doubled anyway — every user in the hole re-walks a
  // fifty-tile route from the origin. Seven still makes detonation the largest discrete
  // event in the game and still separates genRush from balanced by a wide margin.
  DETONATE_HIT: 7,
  SERVED_BONUS: 0,            // tuning lever only; no confidence regeneration (PLAN §3.11)
  BLAST_RADIUS: 1,            // tile + orthogonals (SPEC §5 baseline)
  // ANALYZE_REVEALS is gone (2026-08-04 user decision). Analyze is one minesweeper click:
  // it opens the tile you pointed at, and a zero clue cascades for free. A bulk reveal did
  // the deduction for the player, risk-free, which is exactly what made the minesweeper
  // layer unplayable. The reveal count is now a property of the board, not a constant.
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
 * @property {number} userMoveEvery
 * @property {number} blastRadius
 */

/** @type {LevelParams} */
export const LEVEL_DEFAULTS = Object.freeze({
  arrivals: Object.freeze({ count: 10, firstTick: 6, every: 4 }),
  // 0.25 → 0.14 with the block rescale, then → 0.18 when Analyze became a single click:
  // a bulk-8 reveal made dense blocks cheap to read, and one click at a time does not, so
  // the puzzle can afford to be a puzzle again. A 16-cell block now carries ~3 defects.
  // The corpus runs 0.15–0.16 (PLAN §9); the validator warns outside 0.10–0.40.
  mineDensity: 0.16,
  shapePool: 'compact',
  userMoveEvery: RULES.USER_MOVE_EVERY,
  blastRadius: RULES.BLAST_RADIUS,
});
