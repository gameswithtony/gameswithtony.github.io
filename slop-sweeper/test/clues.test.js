// @ts-check
// SPEC §7.2/§7.4/§7.5 and PLAN §3.5/§3.10: clues count eight ways, everything that cannot
// hold a mine counts zero, and nothing clue-shaped is ever stored.
import test from 'node:test';
import assert from 'node:assert/strict';

import { CON_HAND } from '../src/core/state.js';
import { cellAt } from '../src/core/grid.js';
import { blockMines, clue, init, reduce } from '../src/core/reduce.js';

const NEVER = { count: 9, firstTick: 9999, every: 9999 };

//  x: 0 1 2 3 4 5 6
//  0  # # # ^ # # #
//  1  A # # # # # B
//  2  # # . # # # #
const BOARD = {
  id: 'clue-board',
  map: ['###^###', 'A#####B', '##.####'].join('\n'),
  arrivals: NEVER,
  blastRadius: 1,
};

test('a clue counts mines in all eight neighbours; movement stays four-way (SPEC §7.4)', () => {
  const s = init(BOARD, 1);
  const centre = cellAt(s, 4, 1);
  assert.deepEqual(clue(s, centre), { lo: 0, hi: 0 });

  // Two diagonals and one orthogonal — all three count.
  for (const [x, y] of /** @type {[number, number][]} */ ([[5, 0], [3, 2], [4, 2]])) {
    s.con[cellAt(s, x, y)] = { k: 'aiHidden', mine: true, block: 0, flagged: false };
  }
  assert.deepEqual(clue(s, centre), { lo: 3, hi: 3 }, 'diagonals count');
  assert.equal(clue(s, centre).lo, clue(s, centre).hi, 'the prototype ships the exact tier');

  // Its west neighbour sees only the two that are adjacent to *it*.
  assert.deepEqual(clue(s, cellAt(s, 3, 1)), { lo: 2, hi: 2 });
});

test('A HAND TILE SENSES THE DEFECTS BESIDE IT: clue() is cell-agnostic (SPEC §7.4)', () => {
  // Revised 2026-08-04 (user decision): hand tiles display their count, so building
  // alongside a generated block is a safe, slow way to read its edge. `clue()` never needed
  // changing — it has always counted the mine set around a cell index with no opinion about
  // what is built there — and this test exists so a future refactor cannot quietly make it
  // revealed-only. The renderer's choice to leave a hand tile blank below 1 is display; the
  // information here is identical to a reviewed tile's.
  const s = init(BOARD, 1);
  const sensor = cellAt(s, 4, 1);
  s.con[sensor] = CON_HAND;
  assert.deepEqual(clue(s, sensor), { lo: 0, hi: 0 }, 'nothing next to it yet');

  // Unreviewed slop counts, diagonally as well as orthogonally…
  s.con[cellAt(s, 5, 0)] = { k: 'aiHidden', mine: true, block: 0, flagged: false };
  s.con[cellAt(s, 4, 2)] = { k: 'aiHidden', mine: true, block: 0, flagged: false };
  // …a flag on the tile is a claim and changes nothing…
  s.con[cellAt(s, 3, 2)] = { k: 'aiHidden', mine: true, block: 0, flagged: true };
  // …and a confirmed mine keeps counting while it exists (PLAN §3.10).
  s.con[cellAt(s, 5, 2)] = { k: 'mineConfirmed', block: 0 };
  assert.deepEqual(clue(s, sensor), { lo: 4, hi: 4 });

  // Everything that cannot hold a mine contributes zero, from a hand tile's point of view
  // exactly as from anywhere else.
  s.con[cellAt(s, 3, 0)] = CON_HAND;
  s.con[cellAt(s, 4, 0)] = { k: 'aiRevealed', block: 0 };
  s.con[cellAt(s, 5, 1)] = { k: 'aiHidden', mine: false, block: 0, flagged: false };
  s.con[cellAt(s, 3, 1)] = { k: 'aiHidden', mine: false, block: 0, flagged: true };
  assert.deepEqual(clue(s, sensor), { lo: 4, hi: 4 }, 'hand, revealed and clean slop add nothing');

  // The same neighbourhood read from an unbuilt ocean cell gives the same number: the cell's
  // own construction state is not an input.
  const bare = { ...s, con: s.con.slice() };
  bare.con[sensor] = { k: 'none' };
  assert.deepEqual(clue(bare, sensor), clue(s, sensor));
});

test('ocean, void, volcano, hand, revealed and endpoints all count zero (SPEC §7.5)', () => {
  const s = init(BOARD, 1);
  const centre = cellAt(s, 1, 1);
  s.con[cellAt(s, 0, 0)] = CON_HAND;
  s.con[cellAt(s, 1, 0)] = { k: 'aiRevealed', block: 0 };
  // (2,2) is void and (0,1) is the origin endpoint; (2,1) is left as open ocean.
  assert.equal(s.terrain[cellAt(s, 2, 2)], 'void');
  assert.deepEqual(clue(s, centre), { lo: 0, hi: 0 });

  // The one state that does hold a mine changes the answer, and only that one.
  s.con[cellAt(s, 2, 1)] = { k: 'aiHidden', mine: true, block: 0, flagged: false };
  assert.deepEqual(clue(s, centre), { lo: 1, hi: 1 });
  s.con[cellAt(s, 2, 1)] = { k: 'aiHidden', mine: false, block: 0, flagged: false };
  assert.deepEqual(clue(s, centre), { lo: 0, hi: 0 }, 'unmined slop counts zero too');
});

test('a confirmed mine keeps counting while it exists (PLAN §3.10)', () => {
  // No action produces `mineConfirmed` since 2026-08-04 — analyzing a defect detonates it
  // (PLAN §3 ruling 1). The state is kept anyway, per PLAN §2's rule about implementing the
  // full §2.2 union, so its arithmetic is still specified and still tested: a future defuse
  // verb would produce it and must find the clue layer already correct.
  const s = init(BOARD, 1);
  const centre = cellAt(s, 4, 1);
  const mined = cellAt(s, 5, 1);
  s.con[mined] = { k: 'aiHidden', mine: true, block: 0, flagged: false };
  s.blocks = [{ id: 0, cells: [mined] }];
  assert.deepEqual(clue(s, centre), { lo: 1, hi: 1 });

  const after = { ...s, con: s.con.slice() };
  after.con[mined] = { k: 'mineConfirmed', block: 0 };
  assert.deepEqual(clue(after, centre), { lo: 1, hi: 1 }, 'standard flag arithmetic');
  assert.equal(blockMines(after, 0), 1);
});

test('analyzing a defect detonates it, and confirms nothing (rev. 2026-08-04)', () => {
  const s = init(BOARD, 1);
  const mined = cellAt(s, 5, 1);
  s.con[mined] = { k: 'aiHidden', mine: true, block: 0, flagged: false };
  s.blocks = [{ id: 0, cells: [mined] }];

  const { s: after, ev } = reduce(s, { t: 'analyze', cell: mined });
  assert.equal(ev[0].t, 'detonate');
  assert.equal(after.con[mined].k, 'none', 'the tile is open water now');
  assert.deepEqual(clue(after, cellAt(s, 4, 1)), { lo: 0, hi: 0 }, 'the clue drops with the mine');
  assert.equal(blockMines(after, 0), 0);
});

test('silent mine destruction lowers the clues around it and the block badge (PLAN §3.5)', () => {
  const s = init(BOARD, 1);
  for (let x = 1; x <= 5; x++) s.con[cellAt(s, x, 1)] = CON_HAND;

  // A three-cell generation carrying two defects, one of which a user is about to find.
  const trigger = cellAt(s, 3, 1);
  const doomed = cellAt(s, 4, 1);
  const survivor = cellAt(s, 5, 0);
  s.con[trigger] = { k: 'aiHidden', mine: true, block: 0, flagged: false };
  s.con[doomed] = { k: 'aiHidden', mine: true, block: 0, flagged: false };
  s.con[survivor] = { k: 'aiHidden', mine: true, block: 0, flagged: false };
  s.blocks = [{ id: 0, cells: [survivor, trigger, doomed] }];
  s.users = [{ id: 0, at: cellAt(s, 2, 1), state: 'moving', visited: [s.origin, cellAt(s, 2, 1)], stalled: false }];
  s.schedule = { ...s.schedule, total: 1, spawned: 1 };

  const watcher = cellAt(s, 4, 0);
  assert.deepEqual(clue(s, watcher), { lo: 3, hi: 3 }, 'it can see all three defects');
  assert.equal(blockMines(s, 0), 3);

  const { s: after, ev } = reduce(s, { t: 'wait' });
  const boom = /** @type {any} */ (ev.find((e) => e.t === 'detonate'));
  assert.ok(boom);
  assert.deepEqual(boom.minesLost.sort((/** @type {number} */ a, /** @type {number} */ b) => a - b), [trigger, doomed].sort((a, b) => a - b));

  // Nothing invalidated a cached number, because there is no cached number: the clue and
  // the badge are recomputed from the mine set every time they are asked (never-wrong rule).
  assert.deepEqual(clue(after, watcher), { lo: 1, hi: 1 }, 'two defects went up with the blast');
  assert.equal(blockMines(after, 0), 1);
  assert.deepEqual(after.blocks[0].cells, [survivor]);

  // …and the renderer is never told which of the destroyed cells held them (SPEC §5).
  assert.equal(after.con[doomed].k, 'none');
  assert.equal(after.con[trigger].k, 'none');
});

test('clue() is derived, not stored: it moves the instant the board does', () => {
  const s = init(BOARD, 1);
  const centre = cellAt(s, 4, 1);
  const neighbour = cellAt(s, 4, 2);
  const snapshot = clue(s, centre);
  s.con[neighbour] = { k: 'aiHidden', mine: true, block: 0, flagged: false };
  assert.notDeepEqual(clue(s, centre), snapshot);
  assert.deepEqual(Object.keys(s).filter((k) => /clue/i.test(k)), [], 'nothing clue-shaped is in the state');
});
