// @ts-check
// Generate: draw a shape from the level's pool — guaranteed placeable since 2026-08-12, see
// drawPlaceableShape — enumerate every legal placement before the turn commits (SPEC §4.2),
// and roll the block's mines once position and rotation are final (PLAN §3.6). VOID
// rejection is not written down anywhere here — it falls out of the terrain capability
// table, exactly as SPEC §10.7 demands.

import { RULES } from './rules.js';
import { n4 } from './grid.js';
import { conCaps, isEndpoint, isGeneratable } from './state.js';
import { resolvePool, rotationsOf } from './shapes.js';

/** @typedef {import('./state.js').GameState} GameState */
/** @typedef {import('./state.js').RotAnchors} RotAnchors */
/** @typedef {import('./shapes.js').Offset} Offset */
/** @typedef {import('./rng.js').Rng} Rng */

/**
 * Uniform draw from the level's pool. No preview and no player reroll (SPEC §4.2); the one
 * caller that redraws is `drawPlaceableShape`, below, and only over shapes that fit.
 * @param {Rng} gen
 * @param {'compact' | 'awkward' | 'heavy' | string | string[]} pool
 * @returns {number} index into SHAPES
 */
export function drawShape(gen, pool) {
  const ids = resolvePool(pool);
  return ids[Math.floor(gen() * ids.length)];
}

/**
 * The draw the reducer uses (revised 2026-08-12, user decision). Placement cannot be
 * declined once a block is shown (SPEC §4.2), so what is shown must be placeable: a first
 * roll that fits nowhere is redrawn invisibly, uniformly over the pool's placeable
 * remainder, from the same seeded stream. That is distribution-identical to rejection
 * sampling — uniform over the placeable subset — but bounded at two stream numbers, so the
 * replay contract (PLAN §7.5) stays exact. When the first roll fits, this is bit-identical
 * to the plain draw it replaces.
 *
 * Returns null when nothing in the pool fits at any rotation; the caller cancels without
 * saving `gen`, so a refused Generate never advances the stream.
 * @param {GameState} s
 * @param {Rng} gen
 * @param {'compact' | 'awkward' | 'heavy' | string | string[]} pool
 * @returns {{ shape: number, rots: RotAnchors[] } | null}
 */
export function drawPlaceableShape(s, gen, pool) {
  const first = drawShape(gen, pool);
  const firstRots = legalPlacements(s, first);
  if (firstRots.some((r) => r.anchors.length > 0)) return { shape: first, rots: firstRots };

  /** @type {{ shape: number, rots: RotAnchors[] }[]} */
  const fits = [];
  for (const shape of resolvePool(pool)) {
    if (shape === first) continue;                     // just proven unplaceable
    const rots = legalPlacements(s, shape);
    if (rots.some((r) => r.anchors.length > 0)) fits.push({ shape, rots });
  }
  if (fits.length === 0) return null;
  return fits[Math.floor(gen() * fits.length)];
}

/**
 * Free generatable cells that touch structure — every legal placement must cover at least
 * one of them, because the block cell that satisfies the adjacency rule is itself a free
 * generatable cell next to structure. Enumerating from here instead of from the whole board
 * turns ~50k checks into a few thousand without changing the answer.
 * @param {GameState} s
 * @returns {number[]}
 */
function genFrontier(s) {
  /** @type {number[]} */
  const out = [];
  for (let i = 0; i < s.con.length; i++) {
    if (isEndpoint(s, i)) continue;                    // endpoints are not buildable (PLAN §3.8)
    if (!isGeneratable(s.terrain[i], s.con[i])) continue;
    for (const j of n4(s, i)) {
      if (isEndpoint(s, j) || conCaps(s.con[j]).genFrom) { out.push(i); break; }
    }
  }
  return out;
}

/**
 * Legality of one concrete placement (SPEC §4.2): every block cell lands on generatable
 * terrain with nothing built on it, and at least one block cell is 4-adjacent to structure —
 * an endpoint, a hand tile, a revealed tile, or (unlike hand placement, SPEC §4.1) an
 * unreviewed `aiHidden` tile.
 * @param {GameState} s
 * @param {number} ax
 * @param {number} ay
 * @param {Offset[]} cells
 * @returns {number[] | null} the covered cell indices, or null if the placement is illegal
 */
function coverage(s, ax, ay, cells) {
  /** @type {number[]} */
  const covered = [];
  for (const [dx, dy] of cells) {
    const x = ax + dx, y = ay + dy;
    // Array-safety only: without it the offsets would wrap a row. Playability is decided
    // one line down by the capability table, never by these bounds (SPEC §10.7).
    if (x < 0 || y < 0 || x >= s.w || y >= s.h) return null;
    const i = y * s.w + x;
    if (isEndpoint(s, i)) return null;
    if (!isGeneratable(s.terrain[i], s.con[i])) return null;
    covered.push(i);
  }
  for (const i of covered) {
    for (const j of n4(s, i)) {
      if (isEndpoint(s, j) || conCaps(s.con[j]).genFrom) return covered;
    }
  }
  return null;
}

/**
 * @param {GameState} s
 * @param {number} anchor
 * @param {Offset[]} cells
 * @returns {number[] | null}
 */
export function placementCells(s, anchor, cells) {
  if (!Number.isInteger(anchor) || anchor < 0 || anchor >= s.w * s.h) return null;
  return coverage(s, anchor % s.w, (anchor / s.w) | 0, cells);
}

/**
 * Every legal anchor per unique rotation, computed *before* the turn commits so an empty
 * set refunds rather than punishes (SPEC §4.2). The UI highlights straight from this.
 * @param {GameState} s
 * @param {number} shapeIdx
 * @returns {RotAnchors[]}
 */
export function legalPlacements(s, shapeIdx) {
  const rotations = rotationsOf(shapeIdx);
  const frontier = genFrontier(s);
  /** @type {RotAnchors[]} */
  const out = [];
  for (let rot = 0; rot < rotations.length; rot++) {
    const cells = rotations[rot];
    /** @type {Set<number>} */
    const tried = new Set();
    /** @type {number[]} */
    const anchors = [];
    for (const f of frontier) {
      const fx = f % s.w, fy = (f / s.w) | 0;
      for (const [dx, dy] of cells) {
        const ax = fx - dx, ay = fy - dy;
        if (ax < 0 || ay < 0) continue;
        const anchor = ay * s.w + ax;
        if (tried.has(anchor)) continue;
        tried.add(anchor);
        if (coverage(s, ax, ay, cells)) anchors.push(anchor);
      }
    }
    anchors.sort((a, b) => a - b);
    out.push({ rot: /** @type {0 | 1 | 2 | 3} */ (rot), cells, anchors });
  }
  return out;
}

/**
 * Binomial(size, density), one Bernoulli per cell in commit order, drawn after position and
 * rotation are final (PLAN §3.6) — **then topped up to `MIN_BLOCK_DEFECTS`.**
 *
 * Revised 2026-08-04 (user decision, superseding PLAN §3 ruling 6's "zero is possible"):
 * every generation ships at least two defects. A clean block was a lovely moment and a bad
 * rule: it meant a Generate could be strictly free, so the honest play was sometimes to
 * spam it and hope, and the tension the whole game is built on — fast ground you do not
 * understand — simply did not apply to that block. With a floor, the question is never
 * *whether* the block is dangerous, only *how* dangerous and *where*.
 *
 * The top-up draws uniformly from the cells the Bernoulli pass left clean, one at a time,
 * from the same `gen` stream — so it is as deterministic as the roll it corrects, and the
 * replay contract (PLAN §7.5) holds unchanged. `floor = min(MIN_BLOCK_DEFECTS, size)` so a
 * block smaller than the floor mines every cell instead of looping forever; the real table
 * starts at twelve cells (PLAN §10), so that guard is for a hypothetical, not for today.
 *
 * **Placement-time only.** A later blast may take a block below two, or to zero, and nothing
 * puts it back — the floor is a property of what generation ships, not an invariant of the
 * board (PLAN §3.5's derive-everything-live rule is what makes that safe).
 *
 * @param {Rng} gen
 * @param {number[]} cells
 * @param {number} density
 * @returns {Set<number>}
 */
export function rollMines(gen, cells, density) {
  /** @type {Set<number>} */
  const mines = new Set();
  for (const c of cells) if (gen.chance(density)) mines.add(c);

  const floor = Math.min(RULES.MIN_BLOCK_DEFECTS, cells.length);
  if (mines.size >= floor) return mines;

  // Swap-remove from a shrinking pool: uniform, no rejection loop, and it consumes exactly
  // one number from the stream per defect added.
  const clean = cells.filter((c) => !mines.has(c));
  while (mines.size < floor) {
    const pick = Math.floor(gen() * clean.length);
    mines.add(clean[pick]);
    clean[pick] = clean[clean.length - 1];
    clean.pop();
  }
  return mines;
}
