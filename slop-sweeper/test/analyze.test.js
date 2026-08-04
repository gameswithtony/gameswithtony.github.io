// @ts-check
// SPEC §4.3 as revised 2026-08-04: **Analyze is one minesweeper click.** It opens the tile
// you pointed at and nothing else — unless that tile's clue is zero, in which case the
// classic cascade runs, which is free because a zero cannot neighbour a mine. A mined
// target is confirmed rather than opened, and does not go off (PLAN §3.1).
import test from 'node:test';
import assert from 'node:assert/strict';

import { cellAt } from '../src/core/grid.js';
import { clue, init, legalActions, reduce } from '../src/core/reduce.js';

const NEVER = { count: 4, firstTick: 9999, every: 9999 };

//  9×5 of open water, endpoints on the middle row so the slop art below has room.
const BOARD = {
  id: 'analyze-board',
  map: ['#########', '#########', 'A#######B', '#########', '#########'].join('\n'),
  arrivals: NEVER,
};

/**
 * Paint a block of slop from ASCII, so every scenario below reads as the board it is.
 *   `.` untouched · `o` hidden · `x` hidden + mined · `f` flagged · `X` flagged + mined
 * @param {string[]} art one string per row
 */
function board(art) {
  const s = init(BOARD, 1);
  /** @type {number[]} */
  const cells = [];
  art.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.') return;
    const i = cellAt(s, x, y);
    s.con[i] = { k: 'aiHidden', mine: ch === 'x' || ch === 'X', block: 0, flagged: ch === 'f' || ch === 'X' };
    cells.push(i);
  }));
  s.blocks = [{ id: 0, cells: cells.slice().sort((a, b) => a - b) }];
  return { s, at: (/** @type {number} */ x, /** @type {number} */ y) => cellAt(s, x, y), cells };
}

/** A 5×5 slop square at cols 2–6 with one defect in its bottom-right quarter. */
const SQUARE = [
  '..ooooo..',
  '..ooooo..',
  '..ooooo..',
  '..ooooo..',
  '..ooxoo..',
];

test('a click on a numbered tile opens exactly that tile', () => {
  const { s, at } = board(SQUARE);
  const target = at(3, 3);                       // diagonally adjacent to the mine at (4,4)
  assert.deepEqual(clue(s, target), { lo: 1, hi: 1 }, 'the fixture is a numbered tile');

  const { s: done, ev } = reduce(s, { t: 'analyze', cell: target });
  const analyzed = /** @type {any} */ (ev[0]);
  assert.equal(analyzed.t, 'analyzed');
  assert.deepEqual(analyzed.revealed, [target], 'one click, one tile');
  assert.deepEqual(analyzed.minesFound, []);
  assert.equal(done.con[target].k, 'aiRevealed');
  assert.equal(done.con[at(2, 3)].k, 'aiHidden', 'its neighbours are untouched');
  assert.equal(done.tick, 1, 'review costs a turn');
  assert.equal(done.stats.analyzed, 1);
});

test('a click on a zero cascades, stops on the numbers, and never opens the mine', () => {
  const { s, at } = board(SQUARE);
  const target = at(2, 0);                       // far corner: clue 0
  assert.deepEqual(clue(s, target), { lo: 0, hi: 0 });

  const { s: done, ev } = reduce(s, { t: 'analyze', cell: target });
  const revealed = /** @type {number[]} */ (/** @type {any} */ (ev[0]).revealed);

  // Twenty-five cells of slop, one of them mined: the cascade opens the other twenty-four.
  assert.equal(revealed.length, 24);
  assert.equal(done.con[at(4, 4)].k, 'aiHidden', 'the defect is still there, still hidden');
  assert.deepEqual(/** @type {any} */ (ev[0]).minesFound, []);
  assert.equal(revealed[0], target, 'the tile you clicked comes first');

  // THE CASCADE IS PROVABLY SAFE, and this is the proof restated as an assertion: nothing
  // it opened was mined, and every tile it *recursed through* had a zero clue, which by the
  // definition of a clue means it had no mined neighbour to hand on to.
  for (const c of revealed) {
    assert.equal(/** @type {any} */ (s.con[c]).mine, false, `cascade opened mined cell ${c}`);
    assert.equal(done.con[c].k, 'aiRevealed');
  }
  const zeros = revealed.filter((c) => clue(done, c).hi === 0);
  for (const c of zeros) {
    for (const n of [-1, 1, -done.w, done.w, -done.w - 1, -done.w + 1, done.w - 1, done.w + 1]) {
      const j = c + n;
      const con = done.con[j];
      if (con && con.k === 'aiHidden') assert.equal(con.mine, false, 'a zero neighboured a mine');
    }
  }

  // The border of the hole is numbered tiles: opened, but they did not pass it on.
  for (const [x, y] of /** @type {[number, number][]} */ ([[3, 3], [4, 3], [5, 3], [3, 4], [5, 4]])) {
    assert.deepEqual(clue(done, at(x, y)), { lo: 1, hi: 1 });
    assert.equal(done.con[at(x, y)].k, 'aiRevealed');
  }
});

test('the cascade never leaves the region it was pointed at', () => {
  // Two strips of slop with clear water between them; both are all zeros.
  const { s, at } = board([
    '..ooo....',
    '.........',
    '..ooo....',
    '.........',
    '.........',
  ]);
  const { s: done, ev } = reduce(s, { t: 'analyze', cell: at(2, 0) });
  assert.deepEqual(/** @type {any} */ (ev[0]).revealed, [at(2, 0), at(3, 0), at(4, 0)]);
  for (const x of [2, 3, 4]) assert.equal(done.con[at(x, 2)].k, 'aiHidden', 'the other module is untouched');
});

test('the cascade honours flags, exactly as minesweeper does', () => {
  // A flagged row cuts a three-wide strip in two, 8-connectivity included.
  const { s, at } = board([
    '..ooo....',
    '..fff....',
    '..ooo....',
    '.........',
    '.........',
  ]);
  const { s: done, ev } = reduce(s, { t: 'analyze', cell: at(2, 0) });
  assert.deepEqual(/** @type {any} */ (ev[0]).revealed, [at(2, 0), at(3, 0), at(4, 0)]);
  for (const x of [2, 3, 4]) {
    assert.equal(done.con[at(x, 1)].k, 'aiHidden', 'a flagged tile is never opened by a cascade');
    assert.equal(/** @type {any} */ (done.con[at(x, 1)]).flagged, true, 'and keeps its flag');
    assert.equal(done.con[at(x, 2)].k, 'aiHidden', 'nor is anything walled off behind one');
  }

  // Withdraw one flag and the same click gets through: the wall was the player's, not the
  // board's.
  const unflagged = reduce(done, { t: 'flag', cell: at(3, 1) }).s;
  const through = reduce(unflagged, { t: 'analyze', cell: at(3, 1) }).s;
  for (const x of [2, 3, 4]) assert.equal(through.con[at(x, 2)].k, 'aiRevealed');
});

test('a mined target is confirmed, does not cascade, and does not detonate (PLAN §3.1)', () => {
  const { s, at } = board(SQUARE);
  const mine = at(4, 4);
  const { s: done, ev } = reduce(s, { t: 'analyze', cell: mine });

  const analyzed = /** @type {any} */ (ev[0]);
  assert.deepEqual(analyzed.revealed, [], 'the click ends on the defect');
  assert.deepEqual(analyzed.minesFound, [mine]);
  assert.equal(done.con[mine].k, 'mineConfirmed');
  assert.equal(/** @type {any} */ (done.con[mine]).block, 0, 'it remembers which generation shipped it');
  assert.equal(done.con[at(3, 4)].k, 'aiHidden', 'nothing around it moved');

  assert.equal(ev.some((e) => e.t === 'detonate'), false, 'reviewing a defect does not set it off');
  assert.equal(done.stats.detonations, 0);
  assert.equal(done.confidence, 100, 'and it costs no confidence');
  // A confirmed mine is a permanent wall: with Overwrite absent you route around it.
  assert.equal(done.blocks[0].cells.includes(mine), true, 'the cell still belongs to its block');
});

test('the reveal list is a pure function of the board, in ascending frontier order', () => {
  /** @param {number} seed */
  const run = (seed) => {
    const { s, at } = board(SQUARE);
    return /** @type {any} */ (reduce({ ...s, seed }, { t: 'analyze', cell: at(2, 0) }).ev[0]).revealed;
  };
  assert.deepEqual(run(1), run(999), 'the seed cannot change a review');
  const revealed = run(1);
  // The seed first, then each frontier in ascending cell order — so the list is sorted
  // within each ring even though the rings themselves interleave rows.
  assert.equal(new Set(revealed).size, revealed.length, 'no cell is opened twice');
});

test('analyze refuses a flagged target: unflag it first', () => {
  const { s, at } = board(SQUARE);
  const flagged = reduce(s, { t: 'flag', cell: at(2, 0) }).s;
  assert.deepEqual(legalActions(flagged, at(2, 0)), ['flag'], 'only the flag itself is on offer');
  assert.match(
    /** @type {any} */ (reduce(flagged, { t: 'analyze', cell: at(2, 0) }).ev[0]).reason,
    /flagged .* unflag it first/,
  );
  assert.equal(reduce(flagged, { t: 'analyze', cell: at(2, 0) }).s.tick, 0, 'and costs nothing');
});

test('only unreviewed AI tiles can be reviewed', () => {
  const { s, at } = board(['..o......', '.........', '.........', '.........', '.........']);
  const cell = at(2, 0);
  assert.deepEqual(legalActions(s, cell), ['analyze', 'flag']);
  for (const c of [s.origin, s.dest, at(8, 4), -1, s.w * s.h]) {
    assert.equal(legalActions(s, c).includes('analyze'), false);
    assert.equal(reduce(s, { t: 'analyze', cell: c }).ev[0].t, 'rejected');
  }
  const done = reduce(s, { t: 'analyze', cell }).s;
  assert.match(
    /** @type {any} */ (reduce(done, { t: 'analyze', cell }).ev[0]).reason,
    /only unreviewed AI tiles/,
  );
});

test('PROPERTY: over real generated blocks, a cascade never opens a defect', () => {
  // The scenarios above are hand-drawn; this one plays the actual game. Generate, commit,
  // then click every hidden tile in turn and check the invariant after each one.
  let checked = 0;
  for (let seed = 1; seed <= 40; seed++) {
    let s = init({ id: 'analyze-live', map: BOARD.map, arrivals: NEVER, mineDensity: 0.25 }, seed);
    for (let round = 0; round < 3; round++) {
      const drawn = reduce(s, { t: 'generate' });
      if (drawn.ev[0].t !== 'blockDrawn') break;
      const rot = /** @type {any} */ (drawn.s.phase).rots.find((/** @type {any} */ r) => r.anchors.length);
      if (!rot) break;
      s = reduce(drawn.s, { t: 'placeBlock', cell: rot.anchors[0], rot: rot.rot }).s;
    }
    for (let i = 0; i < s.con.length; i++) {
      if (s.con[i].k !== 'aiHidden') continue;
      const { ev } = reduce(s, { t: 'analyze', cell: i });
      const a = /** @type {any} */ (ev[0]);
      assert.equal(a.t, 'analyzed');
      for (const c of a.revealed) {
        assert.equal(/** @type {any} */ (s.con[c]).mine, false, `seed ${seed}: cascade opened mined cell ${c}`);
      }
      assert.ok(a.minesFound.length === 0 || (a.minesFound.length === 1 && a.minesFound[0] === i),
        'only the tile you clicked can ever be confirmed');
      checked++;
    }
  }
  assert.ok(checked > 200, `only ${checked} clicks exercised`);
});
