// @ts-check
// SPEC §4.5 as decided 2026-08-04: **flags steer users.** A flag is free — it toggles an
// annotation on an unreviewed AI tile and no tick runs — and its whole cost is that users
// refuse to walk through it. That is the only capability it changes; a flagged tile still
// counts for clues, still anchors generation, and still goes up with a blast.
import test from 'node:test';
import assert from 'node:assert/strict';

import { CON, CON_HAND, conCaps, isFlagged, isPassable } from '../src/core/state.js';
import { cellAt } from '../src/core/grid.js';
import { clue, init, legalActions, reduce } from '../src/core/reduce.js';
import { gateOpen, passable } from '../src/core/routing.js';
import { hashState } from '../src/sim/hash.js';

const NEVER = { count: 4, firstTick: 9999, every: 9999 };

//  x: 0 1 2 3 4 5 6
//  1  A # # # # # B
const BOARD = { id: 'flag-board', map: ['#######', 'A#####B', '#######'].join('\n'), arrivals: NEVER };

/**
 * @param {number} seed
 * @param {[number, number, boolean][]} slop  [x, y, mined]
 */
function withSlop(seed, slop) {
  const s = init(BOARD, seed);
  const cells = slop.map(([x, y]) => cellAt(s, x, y));
  slop.forEach(([, , mine], i) => { s.con[cells[i]] = { k: 'aiHidden', mine, block: 0, flagged: false }; });
  s.blocks = [{ id: 0, cells: cells.slice().sort((a, b) => a - b) }];
  return { s, cells };
}

test('flagging toggles, and it is free: no tick, no drain, nothing but the cell', () => {
  const { s, cells } = withSlop(1, [[2, 1, true]]);
  const before = hashState(s);

  const on = reduce(s, { t: 'flag', cell: cells[0] });
  assert.deepEqual(on.ev, [{ t: 'flagged', cell: cells[0], on: true }]);
  assert.equal(on.s.tick, s.tick, 'the clock does not move');
  assert.deepEqual(on.s.users, s.users, 'and no user moved or lost patience');
  assert.deepEqual(on.s.stats, s.stats, 'flagging is not a verb the stats count');
  assert.deepEqual(on.s.users, s.users);
  assert.equal(isFlagged(on.s.con[cells[0]]), true);
  assert.notEqual(hashState(on.s), before, 'but the state really did change');

  const off = reduce(on.s, { t: 'flag', cell: cells[0] });
  assert.deepEqual(off.ev, [{ t: 'flagged', cell: cells[0], on: false }]);
  assert.equal(isFlagged(off.s.con[cells[0]]), false);
  assert.equal(hashState(off.s), before, 'toggling back is exactly a no-op');
});

test('the flag rides on the tile, so it remembers the mine and the block underneath', () => {
  const { s, cells } = withSlop(1, [[2, 1, true]]);
  const flagged = reduce(s, { t: 'flag', cell: cells[0] }).s;
  const con = /** @type {any} */ (flagged.con[cells[0]]);
  assert.equal(con.k, 'aiHidden', 'a flag is an annotation, not a construction state');
  assert.equal(con.mine, true);
  assert.equal(con.block, 0);
  assert.equal(CON.flagged, undefined, 'and the old standalone state is gone');
});

test('a flag changes passability and nothing else', () => {
  const { s, cells } = withSlop(1, [[2, 1, true]]);
  const cell = cells[0];
  const open = conCaps(s.con[cell]);
  const shut = conCaps(reduce(s, { t: 'flag', cell }).s.con[cell]);

  assert.equal(open.passable, true);
  assert.equal(shut.passable, false, 'users refuse to enter');
  for (const k of /** @type {const} */ (['handFrom', 'genFrom', 'occupies', 'holdsMine'])) {
    assert.equal(shut[k], open[k], `a flag must not change ${k}`);
  }
  assert.equal(isPassable('ocean', reduce(s, { t: 'flag', cell }).s.con[cell]), false);
});

test('a flagged tile still counts for clues — a flag is a claim, not knowledge', () => {
  const { s, cells } = withSlop(1, [[2, 1, true]]);
  const watcher = cellAt(s, 3, 1);
  assert.deepEqual(clue(s, watcher), { lo: 1, hi: 1 });
  const flagged = reduce(s, { t: 'flag', cell: cells[0] }).s;
  assert.deepEqual(clue(flagged, watcher), { lo: 1, hi: 1 }, 'flagging must not move a clue');

  // …and flagging an *unmined* tile does not invent one either.
  const { s: s2, cells: c2 } = withSlop(1, [[2, 1, false]]);
  const wrong = reduce(s2, { t: 'flag', cell: c2[0] }).s;
  assert.deepEqual(clue(wrong, watcher), { lo: 0, hi: 0 }, 'the board never confirms your guess');
});

test('a wall of flags closes the gate; unflagging reopens it', () => {
  //  A one-cell-tall corridor: the slop at (2,1) is the only way through.
  const level = { id: 'flag-corridor', map: 'A###B', arrivals: { count: 2, firstTick: 0, every: 1 } };
  let s = init(level, 1);
  s.con[cellAt(s, 1, 0)] = CON_HAND;
  s.con[cellAt(s, 2, 0)] = { k: 'aiHidden', mine: true, block: 0, flagged: false };
  s.con[cellAt(s, 3, 0)] = CON_HAND;
  s.blocks = [{ id: 0, cells: [cellAt(s, 2, 0)] }];
  assert.equal(gateOpen(s), true, 'the gate is topological: mined slop is still a route');

  const shut = reduce(s, { t: 'flag', cell: cellAt(s, 2, 0) }).s;
  assert.equal(passable(shut, cellAt(shut, 2, 0)), false);
  assert.equal(gateOpen(shut), false, 'the flag is a wall the player built');

  const reopened = reduce(shut, { t: 'flag', cell: cellAt(shut, 2, 0) }).s;
  assert.equal(gateOpen(reopened), true);
});

test('flagging behind a walker strands it, and stranded users drain (SPEC §6.4)', () => {
  const level = { id: 'flag-strand', map: 'A####B', arrivals: { count: 1, firstTick: 0, every: 1 } };
  let s = init(level, 1);
  for (const x of [1, 2, 3, 4]) s.con[cellAt(s, x, 0)] = CON_HAND;
  s.con[cellAt(s, 3, 0)] = { k: 'aiHidden', mine: false, block: 0, flagged: false };
  s.blocks = [{ id: 0, cells: [cellAt(s, 3, 0)] }];

  s = reduce(s, { t: 'wait' }).s;            // spawn
  s = reduce(s, { t: 'wait' }).s;            // depart + step
  assert.equal(s.users[0].state, 'moving');
  const walker = s.users[0].at;

  // Slam the door in front of it. The flag costs nothing to place…
  s = reduce(s, { t: 'flag', cell: cellAt(s, 3, 0) }).s;
  assert.equal(s.users[0].at, walker, 'and nothing moves while you place it');

  const { s: after, ev } = reduce(s, { t: 'wait' });
  assert.equal(after.users[0].stalled, true, 'the route it was walking is gone');
  assert.equal(after.users[0].waited, s.users[0].waited + 1, 'a stranded user is a waiting user');
});

test('a blast takes the flag with the cell', () => {
  const level = { id: 'flag-blast', map: ['#####', 'A###B', '#####'].join('\n'), arrivals: { count: 1, firstTick: 0, every: 1 } };
  let s = init(level, 1);
  const trigger = cellAt(s, 1, 1);
  const neighbour = cellAt(s, 1, 0);        // beside the route, so the flag cannot shut it
  s.con[trigger] = { k: 'aiHidden', mine: true, block: 0, flagged: false };
  s.con[neighbour] = { k: 'aiHidden', mine: false, block: 0, flagged: false };
  s.con[cellAt(s, 2, 1)] = CON_HAND;
  s.con[cellAt(s, 3, 1)] = CON_HAND;
  s.blocks = [{ id: 0, cells: [neighbour, trigger] }];
  s.users = [{ id: 0, at: s.origin, state: 'moving', visited: [s.origin], stalled: false, waited: 0 }];
  s.schedule = { ...s.schedule, total: 1, spawned: 1 };

  s = reduce(s, { t: 'flag', cell: neighbour }).s;
  assert.equal(isFlagged(s.con[neighbour]), true);

  const { s: after, ev } = reduce(s, { t: 'wait' });
  assert.ok(ev.some((e) => e.t === 'detonate'), 'the walker found the defect next door');
  assert.equal(after.con[neighbour].k, 'none', 'the flagged cell was destroyed');
  assert.equal(isFlagged(after.con[neighbour]), false, 'so the flag went with it');
});

test('flag is illegal during placing, off the board, and on anything but slop', () => {
  const { s, cells } = withSlop(1, [[2, 1, false]]);
  assert.equal(legalActions(s, cells[0]).includes('flag'), true);

  for (const c of [s.origin, s.dest, cellAt(s, 4, 2), -1, s.w * s.h, 1.5]) {
    assert.equal(legalActions(s, /** @type {number} */ (c)).includes('flag'), false);
    assert.equal(reduce(s, { t: 'flag', cell: /** @type {number} */ (c) }).ev[0].t, 'rejected');
  }

  // SPEC §4.2's exclusivity: once a block is drawn, placing it is the only verb in the game.
  const drawn = reduce(init({ ...BOARD, shapePool: ['R12'] }, 3), { t: 'generate' }).s;
  assert.equal(drawn.phase.k, 'placing');
  assert.deepEqual(legalActions(drawn), ['placeBlock']);
  assert.match(/** @type {any} */ (reduce(drawn, { t: 'flag', cell: 0 }).ev[0]).reason, /cannot flag during phase/);
});

test('flags survive the determinism contract: same log, same hashes', () => {
  const { s, cells } = withSlop(7, [[2, 1, true], [3, 1, false], [4, 1, false]]);
  /** @type {import('../src/core/state.js').Action[]} */
  const log = [
    { t: 'flag', cell: cells[0] },
    { t: 'wait' },
    { t: 'flag', cell: cells[1] },
    { t: 'flag', cell: cells[1] },
    { t: 'analyze', cell: cells[2] },
    { t: 'wait' },
  ];
  /** @param {import('../src/core/state.js').GameState} start */
  const replay = (start) => {
    let cur = start;
    const hashes = [hashState(cur)];
    for (const a of log) {
      cur = reduce(cur, a).s;
      hashes.push(hashState(cur));
    }
    return hashes;
  };
  assert.deepEqual(replay(s), replay(withSlop(7, [[2, 1, true], [3, 1, false], [4, 1, false]]).s));
  // The free actions are visible in the log's fingerprint, so a replay cannot skip them.
  assert.notEqual(replay(s)[1], replay(s)[0]);
});
