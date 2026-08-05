// @ts-check
// The curated block table (SPEC §4.2, PLAN §10) and its rotations. Twelve hand-authored
// stencils of 12–26 cells, chunky by construction — long thin tendrils destroy deduction.
// Rotation only, no reflection (OPEN #10); the asymmetric stencils carry the variety.
//
// SIZE REVISION, 2026-08-04 (user decision, overrides SPEC §4.2's "4–8 cells"): a generated
// block must be a genuine mini-minesweeper. At four cells one Analyze cleared the whole
// thing, so the fantasy — *the AI is fast, but you owe turns to understand what it gave
// you* — never got to happen. Twelve to twenty-six cells means a block carries several
// defects, takes two or three reviews to read, and is worth routing around rather than
// through. Boards grew ~2× linearly to match (PLAN §9).
//
// CHUNKINESS RULE: every limb of every stencil is at least two cells wide. A one-cell
// tendril has almost no 8-neighbourhood overlap with the rest of the block, so its clues
// constrain nothing and the deduction layer degenerates into guessing.

/** @typedef {[number, number]} Offset  [dx, dy], normalized so both minima are 0 */

/**
 * @typedef {object} Shape
 * @property {string} id
 * @property {Offset[]} cells   normalized, sorted row-major
 * @property {number} size
 */

/**
 * Authored as the ASCII PLAN §10 prints, so the table stays readable and a new shape is a
 * new row. `X` is a cell; anything else is empty.
 * @type {[string, string[]][]}
 */
const STENCILS = [
  // compact — dense rectangles and near-rectangles: easy to place, easy to read.
  ['R12', ['XXXX', 'XXXX', 'XXXX']],
  ['P14', ['XXXX', 'XXXX', 'XXXX', 'XX..']],
  ['O16', ['XXXX', 'XXXX', 'XXXX', 'XXXX']],
  ['L16', ['XXX..', 'XXX..', 'XXXXX', 'XXXXX']],
  ['W20', ['XXXXX', 'XXXXX', 'XXXXX', 'XXXXX']],
  // awkward — irregular blobs: more perimeter per cell, notches, staircases.
  ['C20', ['XXXX', 'XXXX', 'XX..', 'XX..', 'XXXX', 'XXXX']],
  ['T14', ['.XX.', 'XXXX', 'XXXX', '.XX.', '.XX.']],
  ['Y15', ['..XXX', 'XXXXX', 'XXXXX', '..XX.']],
  ['Z16', ['XXXX..', 'XXXX..', '..XXXX', '..XXXX']],
  ['U18', ['XX.XX', 'XX.XX', 'XXXXX', 'XXXXX']],
  // heavy — enormous throughput, enormous exposure.
  ['H22', ['XX.XX', 'XX.XX', 'XXXXX', 'XXXXX', 'XX.XX']],
  ['O25', ['XXXXX', 'XXXXX', 'XXXXX', 'XXXXX', 'XXXXX']],
];

/** The band SPEC §4.2 is revised to (see the header note); a typo in a stencil trips it. */
export const SIZE_RANGE = Object.freeze([12, 26]);

/**
 * @param {Offset[]} cells
 * @returns {Offset[]}
 */
function normalize(cells) {
  let mx = Infinity, my = Infinity;
  for (const [x, y] of cells) {
    if (x < mx) mx = x;
    if (y < my) my = y;
  }
  return cells
    .map((c) => /** @type {Offset} */ ([c[0] - mx, c[1] - my]))
    .sort((a, b) => (a[1] - b[1]) || (a[0] - b[0]));
}

/**
 * A quarter turn clockwise: (x, y) → (−y, x), then back to the origin.
 * @param {Offset[]} cells
 * @returns {Offset[]}
 */
function rotateCW(cells) {
  return normalize(cells.map((c) => /** @type {Offset} */ ([-c[1], c[0]])));
}

/**
 * @param {Offset[]} cells
 * @returns {string}
 */
function key(cells) {
  return cells.map((c) => `${c[0]},${c[1]}`).join(' ');
}

/** @type {Shape[]} */
export const SHAPES = STENCILS.map(([id, rows]) => {
  /** @type {Offset[]} */
  const cells = [];
  for (let y = 0; y < rows.length; y++) {
    for (let x = 0; x < rows[y].length; x++) {
      if (rows[y][x] === 'X') cells.push([x, y]);
    }
  }
  const [lo, hi] = SIZE_RANGE;
  if (cells.length < lo || cells.length > hi) throw new Error(`shape ${id} is ${cells.length} cells; §4.2 (rev. 2026-08-04) says ${lo}–${hi}`);
  const norm = normalize(cells);
  return Object.freeze({ id, cells: norm, size: norm.length });
});

/** @type {Map<string, number>} */
const BY_ID = new Map(SHAPES.map((sh, i) => [sh.id, i]));

/**
 * @param {string} id
 * @returns {number} index into SHAPES
 */
export function shapeIndex(id) {
  const i = BY_ID.get(id);
  if (i === undefined) throw new Error(`unknown shape '${id}' (have: ${SHAPES.map((s) => s.id).join(', ')})`);
  return i;
}

/** @type {Map<number, Offset[][]>} */
const ROTATIONS = new Map();

/**
 * Distinct rotations, in quarter-turn order. A symmetric shape repeats, so the duplicates
 * are dropped: the squares O16 and O25 offer one, the 180°-symmetric R12/W20/Z16 two, the
 * rest four. Because rotational symmetry has a period that divides 4, the surviving turns
 * are always 0…p−1 — so **the array index and
 * the quarter-turn count are the same number**, which is what lets `Action.placeBlock.rot`
 * be both an index into `phase.rots` and something a renderer can draw.
 * @param {number} shapeIdx
 * @returns {Offset[][]}
 */
export function rotationsOf(shapeIdx) {
  let out = ROTATIONS.get(shapeIdx);
  if (out) return out;
  const shape = SHAPES[shapeIdx];
  if (!shape) throw new Error(`unknown shape index ${shapeIdx}`);
  /** @type {Set<string>} */
  const seen = new Set();
  out = [];
  let cur = shape.cells;
  for (let turn = 0; turn < 4; turn++) {
    const k = key(cur);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(cur);
    }
    cur = rotateCW(cur);
  }
  ROTATIONS.set(shapeIdx, out);
  return out;
}

// --- Pools (PLAN §10) ---------------------------------------------------------------

/** @type {Readonly<Record<string, string[]>>} */
export const POOLS = Object.freeze({
  compact: ['R12', 'P14', 'O16', 'L16', 'W20'],
  awkward: ['C20', 'T14', 'Y15', 'Z16', 'U18'],
  heavy: ['H22', 'O25'],
});

/**
 * A level's `shapePool` is either an explicit array of shape ids or a `+`-joined union of
 * preset names — `'compact'`, `'compact+awkward'`, `'awkward+heavy'`. Empty segments are
 * ignored, so PLAN §9's `'compact+'` is exactly `compact`. Returns shape indices, deduped
 * and ascending, so the draw is a pure function of the pool text.
 * @param {'compact' | 'awkward' | 'heavy' | string | string[]} pool
 * @returns {number[]}
 */
export function resolvePool(pool) {
  if (Array.isArray(pool)) {
    if (pool.length === 0) throw new Error('shapePool: explicit pool is empty');
    return dedupe(pool.map(shapeIndex));
  }
  if (typeof pool !== 'string') throw new Error(`shapePool: expected a name or an array of shape ids, got ${typeof pool}`);
  const names = pool.split('+').map((n) => n.trim()).filter((n) => n !== '');
  if (names.length === 0) throw new Error(`shapePool: '${pool}' names no pool`);
  /** @type {number[]} */
  const ids = [];
  for (const n of names) {
    const preset = POOLS[n];
    if (!preset) throw new Error(`shapePool: unknown pool '${n}' (have: ${Object.keys(POOLS).join(', ')})`);
    for (const id of preset) ids.push(shapeIndex(id));
  }
  return dedupe(ids);
}

/**
 * @param {number[]} xs
 * @returns {number[]}
 */
function dedupe(xs) {
  return [...new Set(xs)].sort((a, b) => a - b);
}
