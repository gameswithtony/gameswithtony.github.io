// @ts-check
// SPEC §10.2 / PLAN §7.4. The solver is instrumentation: these tests pin what it claims, not
// how fast it claims it.
import test from 'node:test';
import assert from 'node:assert/strict';

import { CON_HAND } from '../src/core/state.js';
import { cellAt } from '../src/core/grid.js';
import { MAX_COMPONENT_CELLS, solve } from '../src/core/solver.js';
import { clue, init } from '../src/core/reduce.js';

const NEVER = { count: 4, firstTick: 9999, every: 9999 };

/** 8×5 of open water, endpoints on the middle row. */
const BOARD = {
  id: 'solver-board',
  map: ['########', '########', 'A######B', '########', '########'].join('\n'),
  arrivals: NEVER,
};

/**
 * @param {import('../src/core/state.js').GameState} s
 * @param {number} id
 * @param {[number, number, boolean][]} cells
 */
function block(s, id, cells) {
  const idx = cells.map(([x, y]) => cellAt(s, x, y));
  cells.forEach(([x, y, mine], i) => { s.con[idx[i]] = { k: 'aiHidden', mine, block: id, flagged: false }; });
  s.blocks[id] = { id, cells: idx };
  return idx;
}

test('a block total alone leaves both cells unknown', () => {
  const s = init(BOARD, 1);
  const cells = block(s, 0, [[2, 2, true], [3, 2, false]]);
  const r = solve(s);
  assert.deepEqual(r.safe, []);
  assert.deepEqual(r.mines, []);
  assert.deepEqual(r.unknown, cells.slice().sort((a, b) => a - b));
  assert.equal(r.bailed, false);
});

test('one revealed zero collapses it: a provable safe cell and a provable mine', () => {
  const s = init(BOARD, 1);
  const [mined, clean] = block(s, 0, [[2, 2, true], [3, 2, false]]);

  // A revealed tile east of the pair sees the clean cell and nothing mined: its clue is 0.
  s.con[cellAt(s, 4, 1)] = { k: 'aiRevealed', block: 1 };
  const r = solve(s);

  assert.deepEqual(r.safe, [clean], 'no consistent assignment mines it');
  assert.deepEqual(r.mines, [mined], 'and the block total forces the other one');
  assert.deepEqual(r.unknown, []);
  assert.equal(r.bailed, false);
});

test('the solver never enumerates over a rectangle, so coastlines are free (SPEC §10.7)', () => {
  //  x: 0 1 2 3 4
  //  0  . # . # .     two one-cell inlets, void on both sides of each
  //  1  A # # # B
  //  2  . # . # .
  const level = { id: 'solver-inlets', map: ['.#.#.', 'A###B', '.#.#.'].join('\n'), arrivals: NEVER };
  const s = init(level, 1);
  const west = cellAt(s, 1, 0);
  const east = cellAt(s, 3, 0);
  s.con[west] = { k: 'aiHidden', mine: true, block: 0, flagged: false };
  s.con[east] = { k: 'aiHidden', mine: false, block: 0, flagged: false };
  s.blocks = [{ id: 0, cells: [west, east] }];

  // (1,1) is walled in by void on five of its eight sides, so its clue is a statement about
  // exactly one hidden cell. A solver that enumerated a rectangular frontier would have
  // invented five more variables here and proved nothing.
  s.con[cellAt(s, 1, 1)] = { k: 'aiRevealed', block: 1 };

  const r = solve(s);
  assert.deepEqual(r.mines, [west], 'the clue pins it on its own');
  assert.deepEqual(r.safe, [east], 'and the block total does the rest');
  assert.deepEqual(r.unknown, []);
});

test('independent components are solved separately, which is what keeps it tractable', () => {
  // Fifteen two-cell blocks: 30 hidden cells. As one frontier that is 2^30 and would bail;
  // split into fifteen components of two it is 60 states.
  const level = {
    id: 'solver-components',
    map: ['A' + '#'.repeat(38), '#'.repeat(38) + 'B'].join('\n'),
    arrivals: NEVER,
  };
  const s = init(level, 1);
  for (let i = 0; i < 15; i++) block(s, i, [[i * 2 + 4, 0, true], [i * 2 + 5, 0, false]]);
  assert.equal(s.blocks.length, 15);

  const r = solve(s);
  assert.equal(r.bailed, false, 'thirty cells in one component would have bailed');
  assert.equal(r.unknown.length, 30, 'each pair is a coin flip on its own');
  assert.equal(r.safe.length + r.mines.length, 0);
});

test('an oversized component bails, and bailing is metrics-only: its cells go to unknown', () => {
  const level = {
    id: 'solver-bail',
    map: ['A' + '#'.repeat(38), '#'.repeat(38) + 'B'].join('\n'),
    arrivals: NEVER,
  };
  const s = init(level, 1);
  /** @type {[number, number, boolean][]} */
  const cells = [];
  for (let i = 0; i < MAX_COMPONENT_CELLS + 4; i++) cells.push([i + 1, 0, i % 5 === 0]);
  const idx = block(s, 0, cells);

  const r = solve(s);
  assert.equal(r.bailed, true);
  assert.deepEqual(r.unknown, idx.slice().sort((a, b) => a - b));
  assert.deepEqual(r.safe, []);
  assert.deepEqual(r.mines, []);
});

test('guessForced: the gate is open and every route crosses ground nobody can clear', () => {
  const level = { id: 'solver-corridor', map: 'A##B', arrivals: NEVER };
  const s = init(level, 1);
  assert.equal(solve(s).guessForced, false, 'a shut gate is an unfinished build, not a gamble');

  // Both corridor cells are slop from one two-cell block carrying one defect: a coin flip
  // on the only route there is.
  s.con[1] = { k: 'aiHidden', mine: true, block: 0, flagged: false };
  s.con[2] = { k: 'aiHidden', mine: false, block: 0, flagged: false };
  s.blocks = [{ id: 0, cells: [1, 2] }];
  const forced = solve(s);
  assert.equal(forced.guessForced, true);
  assert.deepEqual(forced.unknown, [1, 2]);

  // Hand-build a parallel route and there is nothing left to guess about.
  const wide = init({ id: 'solver-parallel', map: ['A##B', '####'].join('\n'), arrivals: NEVER }, 1);
  wide.con[1] = { k: 'aiHidden', mine: true, block: 0, flagged: false };
  wide.con[2] = { k: 'aiHidden', mine: false, block: 0, flagged: false };
  wide.blocks = [{ id: 0, cells: [1, 2] }];
  assert.equal(solve(wide).guessForced, true, 'the bypass is not built yet');
  for (const c of [cellAt(wide, 0, 1), cellAt(wide, 1, 1), cellAt(wide, 2, 1), cellAt(wide, 3, 1)]) {
    wide.con[c] = CON_HAND;
  }
  assert.equal(solve(wide).guessForced, false, 'a route of understood ground is never a guess');
});

test('provably safe slop on the route is not a forced guess', () => {
  const level = { id: 'solver-safe-route', map: ['A##B', '####'].join('\n'), arrivals: NEVER };
  const s = init(level, 1);
  // Two cells, zero defects announced: the block total proves both safe.
  s.con[1] = { k: 'aiHidden', mine: false, block: 0, flagged: false };
  s.con[2] = { k: 'aiHidden', mine: false, block: 0, flagged: false };
  s.blocks = [{ id: 0, cells: [1, 2] }];
  const r = solve(s);
  assert.deepEqual(r.safe, [1, 2]);
  assert.equal(r.guessForced, false);
});

test('a HAND tile is a clue source: structure senses the defects beside it', () => {
  // Revised 2026-08-04 (user decision). The block total says "one of these two", and nothing
  // else on the board narrows it — except a hand tile the player built alongside, which
  // touches exactly one of the pair and reads zero.
  const s = init(BOARD, 1);
  const [mined, clean] = block(s, 0, [[2, 2, true], [4, 2, false]]);

  const blind = solve(s);
  assert.deepEqual(blind.unknown, [mined, clean].sort((a, b) => a - b), 'a coin flip so far');
  assert.deepEqual(blind.safe, []);

  // (5,1) is 8-adjacent to (4,2) and to nothing else hidden. Its clue is 0.
  const sensor = cellAt(s, 5, 1);
  s.con[sensor] = CON_HAND;
  assert.deepEqual(clue(s, sensor), { lo: 0, hi: 0 });

  const r = solve(s);
  assert.deepEqual(r.safe, [clean], 'the hand tile clears the cell it touches');
  assert.deepEqual(r.mines, [mined], 'and the block total forces the other one');
  assert.deepEqual(r.unknown, []);
  assert.equal(r.bailed, false);
});

test('a hand clue can flip guessForced off — the deduction is real, not decorative', () => {
  //  x: 0 1 2 3
  //  0  A o o B      the only route is two cells of slop carrying one defect
  //  1  # # # #
  const level = { id: 'solver-hand-route', map: ['A##B', '####'].join('\n'), arrivals: NEVER };
  const s = init(level, 1);
  s.con[cellAt(s, 1, 0)] = { k: 'aiHidden', mine: false, block: 0, flagged: false };
  s.con[cellAt(s, 2, 0)] = { k: 'aiHidden', mine: true, block: 0, flagged: false };
  s.blocks = [{ id: 0, cells: [cellAt(s, 1, 0), cellAt(s, 2, 0)] }];
  assert.equal(solve(s).guessForced, true, 'the gate is open and both route cells are a guess');

  // A single hand tile under the west cell, reading zero, proves that cell safe — but the
  // route still crosses the east one, which the block total then proves is the mine.
  s.con[cellAt(s, 0, 1)] = CON_HAND;
  const half = solve(s);
  assert.deepEqual(half.safe, [cellAt(s, 1, 0)]);
  assert.deepEqual(half.mines, [cellAt(s, 2, 0)]);
  assert.equal(half.guessForced, true, 'knowing where the mine is does not make it passable');

  // Give the route somewhere else to go and the board stops forcing a guess: every cell on
  // the surviving route is either hand-built or proved safe by a hand clue.
  for (const c of [cellAt(s, 1, 1), cellAt(s, 2, 1), cellAt(s, 3, 1)]) s.con[c] = CON_HAND;
  assert.equal(solve(s).guessForced, false);
});

test('endpoints are not clue sources — they display nothing', () => {
  const level = { id: 'solver-endpoint', map: ['A#B', '###'].join('\n'), arrivals: NEVER };
  const s = init(level, 1);
  // One hidden cell touching only the two endpoints and open water. If an endpoint were
  // treated as a clue source, its zero would "prove" this cell safe out of thin air.
  s.con[cellAt(s, 1, 0)] = { k: 'aiHidden', mine: true, block: 0, flagged: false };
  s.blocks = [{ id: 0, cells: [cellAt(s, 1, 0)] }];
  assert.deepEqual(clue(s, s.origin), { lo: 1, hi: 1 }, 'the count exists…');
  const r = solve(s);
  assert.deepEqual(r.mines, [cellAt(s, 1, 0)], '…but only the block total is allowed to use it');
  assert.deepEqual(r.safe, []);
});
