// @ts-check
// The curated block table (SPEC §4.2, PLAN §10) and its rotations. Twenty hand-authored
// stencils of 12–26 cells, chunky by construction — long thin tendrils destroy deduction.
// Eighteen of them sit in the three named pools; two belong to no pool at all and can only
// be asked for by name (see the variety pass, below).
//
// Rotation only, no reflection (OPEN #10); the asymmetric stencils carry the variety. That
// is not only a restriction: with no reflection, a sweep and its mirror image are two
// different blocks a player has to read differently, which is why the table now holds both.
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
//
// THE THREE-ROW RULE (an invariant of the *pools*, not a preference): in the union
// `compact+awkward`, R12 is the only stencil whose bounding box fits a three-row corridor.
// `strait`, `caldera` and `delta` are each built on the sentence "only R12 crosses a
// three-row neck" — the neck is where those levels make you build by hand, and a second low
// stencil in either pool would delete that decision silently, in every level at once. So a
// stencil joining `compact` or `awkward` must need **four rows in every rotation**: its
// bounding box has to be at least 4×4. `heavy` carries the same idea one size up — nothing
// in it is narrower than five either way, so a four-row lagoon still refuses the whole pool,
// which is what `atoll` is written against. A stencil in no pool is exempt: a level that
// names one has opted in with its eyes open.
//
// VARIETY PASS, 2026-08-06 (user decision). The original twelve were sound and the compact
// pool was dull: a rectangle is placed without a thought and read without one either. Eight
// stencils join them, aimed at the middle of a spectrum whose two ends are both failures — a
// shape with enormous perimeter per cell is deduced off its coastline before you have spent
// a turn on it, and a solid slab offers no coastline to bite on at all. Moderate irregularity
// is the target: a bay, a cleft, a slant, a hole.
//
// What each of them is *for* is the same tactic. A hand tile displays its defect count, so
// building beside generated ground reads the block's edge for free, one turn at a time, with
// none of Analyze's risk (levels/README §6). A rectangle gives that tactic four flat faces;
// a notch or a bay gives it somewhere to sit *inside* the silhouette, where one tile sees
// four or five block cells instead of three. D20's enclosed hole is the extreme of it — a
// tile built into the hole sees eight block cells at once, the largest single read in the
// game — and because a hole is not part of the shape, nothing has to be free underneath it:
// the donut drops happily over a volcano, over void, or over ground you already own.
//
// Two of the eight are **explicit-only**, in no pool, reachable only as `shapePool: ['N16']`.
// They are narrower than the three-row rule allows, and that is exactly their job: a level
// whose whole argument is a tight channel can hand generation something that fits it. Keeping
// them out of the presets is what lets the rule above stay true of every preset level.
//
// The new rows are **appended** rather than filed into their sections. `phase.shape` is a raw
// index into this array and it goes into the save blob (ui/main.js), so renumbering the table
// would reshuffle an in-flight placement under a returning player. POOLS, at the bottom, is
// where membership actually lives; the order here is only how the file reads.
//
// One consequence to state plainly: widening a pool changes the draw for every level that
// names it, so the sim figures quoted in levels/README predate this pass and the corpus wants
// a re-run before anyone quotes them again.

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

  // --- The 2026-08-06 variety pass (see the header). Pool is named per row, because these
  // are appended in one block rather than filed above; POOLS is still the only authority.

  // compact — the kite. A 5×5 lozenge, four fifths solid, so it places like a compact shape
  // and reads like one; the compact pool keeps its job. What it adds is the only outline in
  // the table that steps on all four sides: it beds into a diagonal coast where every
  // rectangle leaves a ragged gap, a placement decision the pool did not previously contain.
  ['K19', ['..XXX', '.XXXX', 'XXXXX', 'XXXX.', 'XXX..']],

  // awkward — the chevron. Two legs, a shoulder, and a two-wide cleft in the base: the shape
  // that most wants to be built *into*. A hand tile in the cleft sees four block cells where
  // one against a flat face sees three. The taper costs it the most perimeter per cell in the
  // table (1.4) — that is the ceiling, not a target; much more and the coast gives it away.
  ['V16', ['..XX..', '.XXXX.', 'XXXXXX', 'XX..XX']],

  // awkward — the sweep. Z16's mirror family, which rotation alone can never reach, plus a
  // solid overlap band through the middle so it is not merely the staircase backwards: the
  // band is where the two arms' clues talk to each other, and it is the part that makes the
  // shape worth deducing rather than reading off two separate ends.
  ['S18', ['..XXXX', '..XXXX', 'XXXXXX', 'XXXX..']],

  // awkward — the donut. The only stencil with an enclosed hole, and the strongest deduction
  // anchor the table can offer: the hole counts zero for clues from the outside, and a hand
  // tile built into it sees all eight surrounding block cells at once. Fully symmetric, so
  // it has one rotation and no orientation decision — the hole is the whole decision.
  ['D20', ['.XXX.', 'XXXXX', 'XX.XX', 'XXXXX', '.XXX.']],

  // heavy — the boot. A two-wide mast on a six-wide foot. The mast is exactly as narrow as
  // the chunkiness rule allows, which is the point: it reaches up a channel that nothing else
  // in `heavy` can enter while the foot pays for the turn. It needs an L-shaped hole to land
  // in, so a heavy Generate becomes a placement question rather than a formality.
  ['J22', ['XX....', 'XX....', 'XXXXXX', 'XXXXXX', 'XXXXXX']],

  // heavy — the bitten slab. Six by five with a two-by-two bite out of the near edge: the most
  // ground a single Generate can buy, and the first heavy block with a handle on it. A hand
  // tile at the head of the bay sees five block cells, more than any tile outside the
  // silhouette can — so the biggest, most dangerous block is also the one worth building into.
  ['B26', ['XXXXXX', 'XXXXXX', 'XXXXXX', 'XX..XX', 'XX..XX']],

  // EXPLICIT-ONLY (no pool) — the runner. Three rows tall, so no preset may carry it (the
  // three-row rule, above); `shapePool: ['R12','N16']` on a corridor level is the point.
  // Sixteen cells down a neck that R12 crosses twelve at a time, with a bite in the trailing
  // edge so it is not a pure slab. Ask for it by name or never see it.
  ['N16', ['XXXXXX', 'XXXXXX', 'XX..XX']],

  // EXPLICIT-ONLY (no pool) — the plank. Two rows: the only stencil that fits a two-row
  // channel, where today the answer is always "build it by hand". Every cell of it is on the
  // coast, so it is far and away the easiest block in the table to deduce — that is the
  // price of the width, it is stated rather than hidden, and it is why it is in no pool.
  ['M12', ['XXXXXX', 'XXXXXX']],
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
 * are dropped: the squares O16 and O25 and the donut D20 offer one, the 180°-symmetric
 * R12/W20/Z16/K19/M12 two, the rest four. Because rotational symmetry has a period that
 * divides 4, the surviving turns
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

/**
 * Membership lives here, not in the order of the table above. The 2026-08-06 additions are
 * filed by feel and by size band: `compact` is 12–20 and places nearly anywhere, `awkward` is
 * 14–20 and argues with the coastline, `heavy` is 22–26 and needs a clear five-by-five before
 * it will land at all. A pool is a difficulty statement, so a stencil joins the one whose
 * *placement* cost it shares, not the one its cell count would suggest.
 * @type {Readonly<Record<string, string[]>>}
 */
export const POOLS = Object.freeze({
  compact: ['R12', 'P14', 'O16', 'L16', 'W20', 'K19'],
  awkward: ['C20', 'T14', 'Y15', 'Z16', 'U18', 'V16', 'S18', 'D20'],
  heavy: ['H22', 'O25', 'J22', 'B26'],
});

/**
 * The stencils no preset can draw (2026-08-06). Both are narrower than the three-row rule
 * lets a pool member be, so they exist only for levels that name them —
 * `shapePool: ['R12', 'N16']` — and their absence from POOLS is load-bearing rather than an
 * oversight: it is what keeps "only R12 crosses a three-row neck" true of every preset.
 * Exported so the standing test can hold the two lists apart by name instead of by subtraction.
 * @type {readonly string[]}
 */
export const EXPLICIT_ONLY = Object.freeze(['N16', 'M12']);

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
