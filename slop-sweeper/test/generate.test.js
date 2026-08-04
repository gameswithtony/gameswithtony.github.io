// @ts-check
// SPEC §4.2 and PLAN §7.2: the legal set, the refund, the state machine, the mine roll.
import test from 'node:test';
import assert from 'node:assert/strict';

import { TERRAIN, defineTerrain } from '../src/core/state.js';
import { cellAt, n4 } from '../src/core/grid.js';
import { SHAPES, shapeIndex } from '../src/core/shapes.js';
import { legalPlacements, placementCells, rollMines } from '../src/core/generate.js';
import { mulberry32 } from '../src/core/rng.js';
import { init, legalActions, reduce } from '../src/core/reduce.js';

const NEVER = { count: 4, firstTick: 9999, every: 9999 };

/**
 * 16 by 12 of open water with the endpoints on the middle row. Sized for the 2026-08-04
 * block table (PLAN §10): `O16` is the 4x4 square, the smallest one-rotation stencil there
 * is, and a board it could only just sit on would test the bounds check, not the rule.
 */
const OPEN = {
  id: 'gen-open',
  map: [...Array(5).fill('#'.repeat(16)), `A${'#'.repeat(14)}B`, ...Array(6).fill('#'.repeat(16))].join('\n'),
  arrivals: NEVER,
  shapePool: ['O16'],
};

/** @param {import('../src/core/state.js').GameState} s @param {string} id */
const rots = (s, id) => legalPlacements(s, shapeIndex(id));
/** @param {import('../src/core/state.js').GameState} s @param {string} id */
const anchorSet = (s, id) => new Set(rots(s, id).flatMap((r) => r.anchors));

test('every placement lands wholly on free generatable terrain and touches structure', () => {
  const s = init(OPEN, 1);
  const placements = rots(s, 'O16');
  assert.equal(placements.length, 1, 'the square has one rotation');

  for (const anchor of placements[0].anchors) {
    const cells = placementCells(s, anchor, placements[0].cells);
    assert.ok(cells, `anchor ${anchor} should be placeable`);
    for (const c of /** @type {number[]} */ (cells)) {
      assert.equal(s.terrain[c], 'ocean');
      assert.equal(s.con[c].k, 'none');
      assert.notEqual(c, s.origin);
      assert.notEqual(c, s.dest);
    }
  }
  // On a fresh board the only structure is the endpoints, so every legal square hugs one.
  for (const anchor of placements[0].anchors) {
    const cells = /** @type {number[]} */ (placementCells(s, anchor, placements[0].cells));
    assert.ok(
      cells.some((c) => n4(s, c).some((j) => j === s.origin || j === s.dest)),
      `anchor ${anchor} touches no structure`,
    );
  }

  // The enumeration only walks the structure frontier, so cross-check it against a brute
  // force over every cell on the board — the shortcut must not lose a single placement.
  const brute = [];
  for (let i = 0; i < s.w * s.h; i++) if (placementCells(s, i, placements[0].cells)) brute.push(i);
  assert.deepEqual(placements[0].anchors, brute);
  assert.equal(brute.length, 12);
});

test('a block may branch from unreviewed slop; a hand tile still may not (SPEC §4.1/§4.2)', () => {
  const s = init(OPEN, 1);
  const hidden = cellAt(s, 8, 9);            // far from either endpoint
  s.con[hidden] = { k: 'aiHidden', mine: false, block: 0, flagged: false };

  // The square anchored at (4,6) reaches the slop with its (7,9) corner and touches no
  // other structure, so the slop is the only thing making it legal.
  const anchor = cellAt(s, 4, 6);
  assert.equal(anchorSet(s, 'O16').has(anchor), true, 'generation may branch from aiHidden');

  const target = cellAt(s, 7, 9);            // the only structure it could branch from is slop
  assert.deepEqual(legalActions(s, target), [], 'hand placement still may not');
  assert.deepEqual(legalActions(s, hidden), ['analyze', 'flag'], 'but the slop can be reviewed or flagged');
});

test('VOID rejection falls out of the capability table, not a special case (SPEC §10.7)', (t) => {
  t.after(() => { delete TERRAIN.reclaimed; });

  //  x: 0 1 2 3 4 5 6 7 8
  //  2  A # # # . # # # B    the void cell is a hole, not a wall: routes go round it
  const level = {
    id: 'gen-void',
    map: ['#########', '#########', 'A###.###B', '#########', '#########'].join('\n'),
    arrivals: NEVER,
  };
  const s = init(level, 1);
  const gap = cellAt(s, 4, 2);
  assert.equal(s.terrain[gap], 'void');
  for (const anchor of anchorSet(s, 'O16')) {
    const cells = /** @type {number[]} */ (placementCells(s, anchor, SHAPES[shapeIndex('O16')].cells));
    assert.ok(!cells.includes(gap), 'no placement may cover void');
  }
  assert.equal(anchorSet(s, 'O16').has(cellAt(s, 1, 0)), false, 'the square straddling the gap is refused');
  assert.equal(anchorSet(s, 'O16').has(cellAt(s, 1, 1)), false);

  // Flip the capability, not the code: a void-shaped feature that IS generatable is placeable.
  defineTerrain('reclaimed', {
    handBuildable: true, generatable: true, passable: false, knownEmpty: true, blastStops: false,
  });
  s.terrain[gap] = /** @type {any} */ ('reclaimed');
  assert.equal(anchorSet(s, 'O16').has(cellAt(s, 1, 0)), true, 'one table row changed the answer');
});

test('generate draws, enters placing, and offers nothing but placeBlock (SPEC §4.2)', () => {
  const s = init(OPEN, 5);
  assert.deepEqual(legalActions(s), ['generate', 'wait']);

  const { s: drawn, ev } = reduce(s, { t: 'generate' });
  assert.equal(ev.length, 1);
  assert.equal(ev[0].t, 'blockDrawn');
  assert.equal(drawn.phase.k, 'placing');
  assert.equal(drawn.tick, 0, 'the draw itself does not consume a turn');
  assert.notEqual(drawn.rng.gen, s.rng.gen, 'but it does consume the draw');

  // No preview, no decline, no reroll: a state-machine property (acceptance §15).
  assert.deepEqual(legalActions(drawn), ['placeBlock']);
  const anchor = /** @type {any} */ (drawn.phase).rots[0].anchors[0];
  assert.deepEqual(legalActions(drawn, anchor), ['placeBlock']);
  assert.deepEqual(legalActions(drawn, cellAt(drawn, 2, 2)), [], 'an illegal anchor offers nothing');
  for (const a of /** @type {import('../src/core/state.js').Action[]} */ ([
    { t: 'generate' }, { t: 'wait' }, { t: 'place', cell: cellAt(drawn, 1, 1) }, { t: 'analyze', cell: anchor },
  ])) {
    assert.equal(reduce(drawn, a).ev[0].t, 'rejected', `${a.t} must be refused during placing`);
  }
});

test('an empty legal set refunds: no tick, no block, phase untouched (SPEC §4.2)', () => {
  // Two ocean cells and no room for anything: A#B with the middle cell already built.
  const level = { id: 'gen-refund', map: 'A#B', arrivals: NEVER, shapePool: ['O16'] };
  const s = reduce(init(level, 1), { t: 'place', cell: 1 }).s;
  assert.equal(legalPlacements(s, shapeIndex('O16')).every((r) => r.anchors.length === 0), true);

  const before = s.tick;
  const { s: after, ev } = reduce(s, { t: 'generate' });
  assert.deepEqual(ev, [{ t: 'generateRefunded' }]);
  assert.equal(after.tick, before, 'the turn is refunded');
  assert.equal(after.phase.k, 'play', 'the phase is untouched');
  assert.equal(after, s, 'and so is the state — the draw is not spent, so this is not a reroll');
  assert.deepEqual(reduce(after, { t: 'generate' }).ev, [{ t: 'generateRefunded' }]);
});

test('committing a block charges the turn, registers it, and states its defect count', () => {
  const s = reduce(init(OPEN, 5), { t: 'generate' }).s;
  const phase = /** @type {any} */ (s.phase);
  const rot = phase.rots.find((/** @type {any} */ r) => r.anchors.length);
  const anchor = rot.anchors[0];

  const { s: placed, ev } = reduce(s, { t: 'placeBlock', cell: anchor, rot: rot.rot });
  const cells = /** @type {number[]} */ (placementCells(s, anchor, rot.cells));

  assert.deepEqual(ev[0], { t: 'placed', cells });
  const toast = /** @type {any} */ (ev[1]);
  assert.equal(toast.t, 'blockPlaced');
  assert.equal(toast.block, 0);
  assert.deepEqual(toast.cells, cells);

  assert.equal(placed.tick, 1, 'the turn charges at commit, not at the draw');
  assert.equal(placed.phase.k, 'play');
  assert.equal(placed.stats.generated, 1);
  assert.deepEqual(placed.blocks, [{ id: 0, cells }]);
  for (const c of cells) assert.equal(placed.con[c].k, 'aiHidden');

  const mined = cells.filter((c) => /** @type {any} */ (placed.con[c]).mine);
  assert.equal(toast.mines, mined.length, 'the toast is never wrong about the count');
  assert.ok(toast.mines >= 0 && toast.mines <= cells.length, 'Binomial(size, p) stays in range');
});

test('placeBlock refuses anchors and rotations that were not drawn', () => {
  const s = reduce(init(OPEN, 5), { t: 'generate' }).s;
  const phase = /** @type {any} */ (s.phase);
  assert.match(/** @type {any} */ (reduce(s, { t: 'placeBlock', cell: cellAt(s, 2, 2), rot: 0 }).ev[0]).reason, /not a legal anchor/);
  assert.match(/** @type {any} */ (reduce(s, { t: 'placeBlock', cell: phase.rots[0].anchors[0], rot: /** @type {any} */ (7) }).ev[0]).reason, /was not drawn/);
});

test('the mine roll is Binomial(size, density), rolled after the placement is final', () => {
  const gen = mulberry32(99);
  const cells = [0, 1, 2, 3, 4];

  assert.equal(rollMines(mulberry32(1), cells, 0).size, 0, 'p=0 never mines');
  assert.equal(rollMines(mulberry32(1), cells, 1).size, cells.length, 'p=1 always mines');

  let total = 0;
  for (let i = 0; i < 400; i++) {
    const mines = rollMines(gen, cells, 0.25);
    assert.ok(mines.size >= 0 && mines.size <= cells.length);
    for (const c of mines) assert.ok(cells.includes(c));
    total += mines.size;
  }
  const mean = total / 400 / cells.length;
  assert.ok(Math.abs(mean - 0.25) < 0.05, `per-cell rate drifted to ${mean.toFixed(3)}`);

  // Zero is a legitimate and delightful outcome (PLAN §3.6).
  let zeroes = 0;
  for (let i = 0; i < 200; i++) if (rollMines(gen, cells, 0.25).size === 0) zeroes++;
  assert.ok(zeroes > 0, 'a clean generation must be possible');
});

test('the same seed and the same moves produce the same block and the same mines', () => {
  /** @param {number} seed */
  const play = (seed) => {
    let s = reduce(init(OPEN, seed), { t: 'generate' }).s;
    const shape = /** @type {any} */ (s.phase).shape;
    const rot = /** @type {any} */ (s.phase).rots.find((/** @type {any} */ r) => r.anchors.length);
    const r = reduce(s, { t: 'placeBlock', cell: rot.anchors[0], rot: rot.rot });
    return { shape, mines: /** @type {any} */ (r.ev[1]).mines, cells: /** @type {any} */ (r.ev[1]).cells };
  };
  assert.deepEqual(play(7), play(7));
  assert.deepEqual(play(4242), play(4242));

  const shapes = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => {
    const level = { ...OPEN, id: 'gen-draw', shapePool: /** @type {const} */ ('compact') };
    return /** @type {any} */ (reduce(init(level, n), { t: 'generate' }).s.phase).shape;
  });
  assert.ok(new Set(shapes).size > 1, 'different seeds must draw different shapes');
});
