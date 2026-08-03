// @ts-check
// PLAN §3.1 and §3.2: review is a BFS over one contiguous region, a mined tile is confirmed
// rather than skipped, and confirming it does not set it off.
import test from 'node:test';
import assert from 'node:assert/strict';

import { cellAt } from '../src/core/grid.js';
import { init, legalActions, reduce } from '../src/core/reduce.js';

const NEVER = { count: 4, firstTick: 9999, every: 9999 };

//  x: 0 1 2 3 4 5 6
//  0  # # # # # # #
//  1  A # # # # # B
//  2  # # # # # # #
const BOARD = { id: 'analyze-board', map: ['#######', 'A#####B', '#######'].join('\n'), arrivals: NEVER };

/**
 * @param {number} seed
 * @param {[number, number, boolean][]} slop  [x, y, mined]
 * @param {number} [block]
 */
function withSlop(seed, slop, block = 0) {
  const s = init({ ...BOARD, analyzeReveals: 3 }, seed);
  const cells = slop.map(([x, y]) => cellAt(s, x, y));
  slop.forEach(([x, y, mine], i) => { s.con[cells[i]] = { k: 'aiHidden', mine, block }; });
  s.blocks = [{ id: block, cells }];
  return { s, cells };
}

test('review walks the contiguous region and stops at the budget, in BFS order', () => {
  // A row of six hidden cells; the budget is three, so only the first three flip.
  const { s, cells } = withSlop(1, [[1, 1, false], [2, 1, false], [3, 1, false], [4, 1, false], [5, 1, false]]);
  const { s: done, ev } = reduce(s, { t: 'analyze', cell: cells[2] });

  const analyzed = /** @type {any} */ (ev[0]);
  assert.equal(analyzed.t, 'analyzed');
  // BFS from (3,1): itself, then its two neighbours in ascending cell order.
  assert.deepEqual(analyzed.revealed, [cells[2], cells[1], cells[3]]);
  assert.deepEqual(analyzed.minesFound, []);
  assert.equal(done.con[cells[0]].k, 'aiHidden', 'the budget ran out before reaching it');
  assert.equal(done.con[cells[1]].k, 'aiRevealed');
  assert.equal(done.tick, 1, 'review costs a turn');
  assert.equal(done.stats.analyzed, 1);
});

test('review never spills out of the region it was pointed at', () => {
  // Two separate strips of slop on different rows, with clear water between them.
  const { s, cells } = withSlop(1, [[1, 0, false], [2, 0, false], [1, 2, false], [2, 2, false]]);
  const { s: done, ev } = reduce(s, { t: 'analyze', cell: cells[0] });

  assert.deepEqual(/** @type {any} */ (ev[0]).revealed, [cells[0], cells[1]]);
  assert.equal(done.con[cells[2]].k, 'aiHidden', 'the other module is untouched');
  assert.equal(done.con[cells[3]].k, 'aiHidden');
});

test('a mined tile is confirmed, not skipped, and does not detonate (PLAN §3.1)', () => {
  const { s, cells } = withSlop(1, [[1, 1, false], [2, 1, true], [3, 1, false]]);
  const { s: done, ev } = reduce(s, { t: 'analyze', cell: cells[0] });

  const analyzed = /** @type {any} */ (ev[0]);
  assert.deepEqual(analyzed.revealed, [cells[0], cells[2]]);
  assert.deepEqual(analyzed.minesFound, [cells[1]]);
  assert.equal(done.con[cells[1]].k, 'mineConfirmed');
  assert.equal(/** @type {any} */ (done.con[cells[1]]).block, 0, 'it remembers which generation shipped it');

  assert.equal(ev.some((e) => e.t === 'detonate'), false, 'reviewing a defect does not set it off');
  assert.equal(done.stats.detonations, 0);
  assert.equal(done.confidence, 100, 'and it costs no confidence');
  // A confirmed mine is a permanent wall: with Overwrite absent you route around it.
  assert.deepEqual(done.blocks[0].cells, cells, 'the cell still belongs to its block');
});

test('the walk continues past a confirmed mine, because the region was fixed first', () => {
  const { s, cells } = withSlop(1, [[1, 1, true], [2, 1, false], [3, 1, false]]);
  const { s: done } = reduce(s, { t: 'analyze', cell: cells[0] });
  assert.equal(done.con[cells[0]].k, 'mineConfirmed');
  assert.equal(done.con[cells[1]].k, 'aiRevealed');
  assert.equal(done.con[cells[2]].k, 'aiRevealed');
});

test('the walk order is a pure function of the board, not of insertion order', () => {
  /** @param {number} seed */
  const run = (seed) => {
    // A plus-shape around (3,1): every frontier is a genuine tie the cell index breaks.
    const { s, cells } = withSlop(seed, [[3, 1, false], [2, 1, false], [4, 1, false], [3, 0, false], [3, 2, false]]);
    return /** @type {any} */ (reduce(s, { t: 'analyze', cell: cells[0] }).ev[0]).revealed;
  };
  assert.deepEqual(run(1), run(999), 'the seed cannot change a review');
  const revealed = run(1);
  assert.equal(revealed.length, 3);
  assert.equal(revealed[0], 10, 'the target first');
  assert.ok(revealed[1] < revealed[2], 'then the frontier in ascending cell order');
});

test('only unreviewed AI tiles can be reviewed', () => {
  const { s, cells } = withSlop(1, [[1, 1, false]]);
  assert.deepEqual(legalActions(s, cells[0]), ['analyze']);
  for (const cell of [s.origin, s.dest, cellAt(s, 2, 2), -1, s.w * s.h]) {
    assert.equal(legalActions(s, cell).includes('analyze'), false);
    assert.equal(reduce(s, { t: 'analyze', cell }).ev[0].t, 'rejected');
  }
  const done = reduce(s, { t: 'analyze', cell: cells[0] }).s;
  assert.match(
    /** @type {any} */ (reduce(done, { t: 'analyze', cell: cells[0] }).ev[0]).reason,
    /only unreviewed AI tiles/,
  );
});
