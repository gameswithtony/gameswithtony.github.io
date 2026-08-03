// @ts-check
// Generate: draw a shape from the level's pool, enumerate every legal placement before the
// turn commits (SPEC §4.2), and roll the block's mines once position and rotation are final
// (PLAN §3.6). VOID rejection is not written down anywhere here — it falls out of the
// terrain capability table, exactly as SPEC §10.7 demands.

import { n4 } from './grid.js';
import { conCaps, isGeneratable } from './state.js';
import { resolvePool, rotationsOf } from './shapes.js';

/** @typedef {import('./state.js').GameState} GameState */
/** @typedef {import('./state.js').RotAnchors} RotAnchors */
/** @typedef {import('./shapes.js').Offset} Offset */
/** @typedef {import('./rng.js').Rng} Rng */

/**
 * Uniform draw from the level's pool. No preview and no reroll (SPEC §4.2), so this is the
 * only place a shape is chosen and it happens on invocation.
 * @param {Rng} gen
 * @param {'compact' | 'awkward' | 'heavy' | string | string[]} pool
 * @returns {number} index into SHAPES
 */
export function drawShape(gen, pool) {
  const ids = resolvePool(pool);
  return ids[Math.floor(gen() * ids.length)];
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
    if (i === s.origin || i === s.dest) continue;      // endpoints are not buildable (PLAN §3.8)
    if (!isGeneratable(s.terrain[i], s.con[i])) continue;
    for (const j of n4(s, i)) {
      if (j === s.origin || j === s.dest || conCaps(s.con[j]).genFrom) { out.push(i); break; }
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
    if (i === s.origin || i === s.dest) return null;
    if (!isGeneratable(s.terrain[i], s.con[i])) return null;
    covered.push(i);
  }
  for (const i of covered) {
    for (const j of n4(s, i)) {
      if (j === s.origin || j === s.dest || conCaps(s.con[j]).genFrom) return covered;
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
 * rotation are final (PLAN §3.6). Zero is a legitimate and delightful outcome.
 * @param {Rng} gen
 * @param {number[]} cells
 * @param {number} density
 * @returns {Set<number>}
 */
export function rollMines(gen, cells, density) {
  /** @type {Set<number>} */
  const mines = new Set();
  for (const c of cells) if (gen.chance(density)) mines.add(c);
  return mines;
}
