// @ts-check
// BLOCKING-FLAG DETECTION (owner decision 2026-08-05; SPEC §4.5).
//
// Born from a playtest: the owner's own flag sat on the single cut vertex between his users and
// both remaining destinations, nothing moved, and the board read as a pathfinding bug. It was
// not one — flags are impassable and always have been — but nothing on screen said "the wall is
// yours". `blockingFlags(s)` is that sentence, computed: the flagged cells whose *individual*
// removal would let at least one currently-stuck walker move.
//
// It is derived display data. No event, no state field, no save impact, no RNG, and nothing in
// the tick pipeline may consult it — the last of which is asserted at the bottom of this file,
// because the day it becomes a game rule it stops being safe to change.
import test from 'node:test';
import assert from 'node:assert/strict';

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { CON_HAND } from '../src/core/state.js';
import { blockingFlags } from '../src/core/routing.js';
import { init, reduce } from '../src/core/reduce.js';
import { hashState } from '../src/sim/hash.js';

/** @typedef {import('../src/core/state.js').GameState} GameState */
/** @typedef {import('../src/core/state.js').Con} Con */
/** @typedef {import('../src/core/state.js').User} User */

const NEVER = { count: 2, firstTick: 9999, every: 9999 };

/** @param {number} block @returns {Con} */
const slop = (block = 0) => ({ k: 'aiHidden', mine: false, block, flagged: false });

/** @param {number} block @returns {Con} */
const flag = (block = 0) => ({ k: 'aiHidden', mine: false, block, flagged: true });

/**
 * Queue users at the origin without waiting for the schedule — the tests here are about one
 * board rather than about a clock. Note they carry no `ordered` key at all, which is also how
 * a restored v3 save reads, so every assertion below is made against that shape too.
 * @param {GameState} s
 * @param {number} n
 * @param {number[]} todo
 */
function queue(s, n, todo = [0]) {
  for (let i = 0; i < n; i++) {
    s.users.push({ id: s.users.length, at: s.origin, state: 'queued', todo: todo.slice(), visited: [], stalled: false, waited: 0 });
  }
  s.schedule = { ...s.schedule, total: s.users.length, spawned: s.users.length };
  return s;
}

/** @param {GameState} s @param {[number, Con][]} cells */
function build(s, cells) {
  for (const [i, con] of cells) s.con[i] = con;
  s.blocks = [{ id: 0, cells: cells.filter(([, c]) => c.k === 'aiHidden').map(([i]) => i).sort((a, b) => a - b) }];
  return s;
}

// --- (a) THE PLAYTEST ---------------------------------------------------------------------

//  x: 0 1 2 3 4
//  0  A # # # B      the only route east, with the middle tile flagged
//  1  . # . # .      two dead-end spurs hanging off it, one of them flagged too
const CUT = { id: 'blk-cut', map: ['A###B', '.#.#.'].join('\n'), arrivals: NEVER };

test('THE CUT FLAG: the one flag standing between the queue and B is named, and only it', () => {
  const s = queue(build(init(CUT, 1), [[1, CON_HAND], [2, flag()], [3, CON_HAND], [6, flag()]]), 2);

  assert.deepEqual(blockingFlags(s), [2], 'the cut is reported; the spur flag is not');

  // Unflagging it is the fix, and the hint goes quiet the moment it is applied — nobody is
  // stuck any more, so no flag is blocking anybody, including the one still standing.
  const fixed = reduce(s, { t: 'flag', cell: 2 }).s;
  assert.deepEqual(blockingFlags(fixed), [], 'the route is open, so nothing is a blocker');

  // …and a flag that never mattered still does not matter once it is the only one left.
  const spurOnly = reduce(fixed, { t: 'flag', cell: 6 }).s;
  assert.deepEqual(blockingFlags(spurOnly), [], 'a flag on a dead end blocks nobody');
});

test('two flags are both named when either one alone would free somebody, ascending', () => {
  //  x: 0 1 2 3        Two independent routes from A to B, each shut by its own flag. Lifting
  //  0  A # # B        either one opens that route, so each is individually decisive — and the
  //  1  # # # #        answer comes back in cell order, never in the order they were found.
  const level = { id: 'blk-two-routes', map: ['A##B', '####'].join('\n'), arrivals: NEVER };
  const s = queue(build(init(level, 1), [
    [1, flag()], [2, CON_HAND], [4, CON_HAND], [5, CON_HAND], [6, flag(1)], [7, CON_HAND],
  ]), 1);

  assert.deepEqual(blockingFlags(s), [1, 6]);
});

test('EMPTY WHEN NOBODY IS STUCK — a flag only blocks if somebody is waiting on it', () => {
  const board = () => build(init(CUT, 1), [[1, CON_HAND], [2, flag()], [3, CON_HAND]]);

  assert.deepEqual(blockingFlags(board()), [], 'no users at all: nothing is being blocked');

  const walking = board();
  walking.users = [{ id: 0, at: 1, state: 'moving', todo: [0], visited: [0, 1], stalled: false, waited: 0 }];
  walking.schedule = { ...walking.schedule, total: 1, spawned: 1 };
  assert.deepEqual(blockingFlags(walking), [], 'a user that moved this tick is not stuck');

  const done = board();
  done.users = [{ id: 0, at: 4, state: 'arrived', todo: [], visited: [], stalled: false, waited: 0 }];
  done.schedule = { ...done.schedule, total: 1, spawned: 1 };
  assert.deepEqual(blockingFlags(done), [], 'and neither is one that already got there');
});

test('empty when no flag stands: unbuilt water is not a blocker, it is the game', () => {
  const s = queue(build(init(CUT, 1), [[1, CON_HAND], [2, slop()]]), 2);
  assert.equal(s.users[0].state, 'queued');
  assert.deepEqual(blockingFlags(s), [], 'the route is short a tile, and no flag is to blame');
});

// --- (b) the honest limitation --------------------------------------------------------------

test('A TWO-FLAG CUT MARKS NEITHER — single-removal semantics, stated and tested', () => {
  //  A # F F # B: two flags in series on the only route. Lifting either one leaves the other
  //  standing, so neither is individually decisive and neither is reported. That is a false
  //  negative and it is deliberate (routing.js): the alternative is a set-cover search whose
  //  answer sometimes highlights two cells and sometimes four, which teaches nobody anything.
  const level = { id: 'blk-series', map: 'A####B', arrivals: NEVER };
  const s = queue(build(init(level, 1), [[1, CON_HAND], [2, flag()], [3, flag(1)], [4, CON_HAND]]), 1);

  assert.deepEqual(blockingFlags(s), [], 'lifting one of two walls is still a wall');

  // Take one down by hand and the other becomes decisive, which is the shape of the advice the
  // player gets: fix something, look again.
  const half = reduce(s, { t: 'flag', cell: 2 }).s;
  assert.deepEqual(blockingFlags(half), [3]);
});

// --- (c) the two kinds of stuck -------------------------------------------------------------

test('a walker stalled by a flag slammed in front of it is stuck too, and its blocker is found', () => {
  const level = { id: 'blk-strand', map: 'A####B', arrivals: { count: 1, firstTick: 0, every: 1 } };
  let s = init(level, 1);
  build(s, [[1, CON_HAND], [2, CON_HAND], [3, slop()], [4, CON_HAND]]);

  s = reduce(s, { t: 'wait' }).s;                 // spawn
  s = reduce(s, { t: 'wait' }).s;                 // depart + step
  s = reduce(s, { t: 'wait' }).s;                 // step again
  assert.equal(s.users[0].state, 'moving');
  assert.equal(s.users[0].stalled, false);
  assert.deepEqual(blockingFlags(s), [], 'while it is walking, nothing is blocking it');

  s = reduce(s, { t: 'flag', cell: 3 }).s;        // the door, slammed — free, and no tick runs
  assert.deepEqual(blockingFlags(s), [], 'a flag is not a blocker until somebody has stalled on it');

  s = reduce(s, { t: 'wait' }).s;                 // …and now the tick says so
  assert.equal(s.users[0].stalled, true);
  assert.deepEqual(blockingFlags(s), [3]);
});

test('a user camping on a beta is stuck, and the flag past it is what it is stuck behind', () => {
  //  y0: A # β # F B      a beta at (2,0), the road on past it shut by a flag at (4,0)
  //  y1: . . # . . .      plus a flagged dead end hanging off the beta, to be ignored
  const level = { id: 'blk-camp', map: ['A####B', '..#...'].join('\n'), arrivals: { count: 1, firstTick: 0, every: 1 }, patience: 40 };
  let s = init(level, 1);
  s = reduce(s, { t: 'place', cell: 1 }).s;       // tick 0: the user spawns
  s = reduce(s, { t: 'beta', cell: 2 }).s;        // tick 1: it departs for the milestone
  s = reduce(s, { t: 'place', cell: 3 }).s;       // tick 2: it reaches the beta and camps
  s = { ...s, con: s.con.slice() };
  build(s, [[4, flag()], [8, flag(1)]]);

  s = reduce(s, { t: 'wait' }).s;
  assert.equal(s.con[s.users[0].at].k, 'beta', 'it is standing on the milestone');
  assert.equal(s.users[0].stalled, true, 'camping is waiting (SPEC §4.7), so camping is stuck');

  assert.deepEqual(blockingFlags(s), [4], 'the flag on the road past the beta, and not the spur');
});

// --- (d) ordered users ask the ordered question ----------------------------------------------

test('an ordered user\'s blocker is found against its [todo[0]] mask, not its whole tour', () => {
  //  B # A # C, ordered B-then-C. The eastern arm is open and the western one is flagged, so a
  //  loose user would simply leave — and this one cannot, because right now it owes only B.
  const map = 'B#A#C';
  const arrivals = { count: 1, firstTick: 0, every: 1 };

  /** @param {any} itineraries */
  const run = (itineraries) => {
    const s = init(/** @type {any} */ ({ id: `blk-ord-${String(!!itineraries[0].ordered)}`, map, arrivals, patience: 40, itineraries }), 1);
    build(s, [[1, flag()], [3, CON_HAND]]);
    let cur = s;
    for (let n = 0; n < 2; n++) cur = reduce(cur, { t: 'wait' }).s;
    return cur;
  };

  const ordered = run([{ stops: ['B', 'C'], ordered: true }]);
  assert.equal(ordered.users[0].state, 'queued', 'it is waiting for its own leg');
  assert.deepEqual(blockingFlags(ordered), [1], 'and the flag on that leg is why');

  const loose = run([['B', 'C']]);
  assert.equal(loose.users[0].state, 'moving', 'the same letters, loose, went east');
  assert.deepEqual(blockingFlags(loose), [], 'nobody is stuck, so no flag is blocking anybody');

  // Unflagging is the fix here too, and it is the same fix the hint pointed at.
  const fixed = reduce(ordered, { t: 'flag', cell: 1 }).s;
  assert.deepEqual(blockingFlags(fixed), []);
});

// --- (e) it is view-layer information ---------------------------------------------------------

test('blockingFlags is pure, cached per state, and reads nothing it may mutate', () => {
  const s = queue(build(init(CUT, 1), [[1, CON_HAND], [2, flag()], [3, CON_HAND], [6, flag(1)]]), 2);
  const before = hashState(s);

  /** @template T @param {T} o @returns {T} */
  const deepFreeze = (o) => {
    if (o && typeof o === 'object' && !Object.isFrozen(o)) {
      Object.freeze(o);
      for (const v of Object.values(o)) deepFreeze(v);
    }
    return o;
  };
  deepFreeze(s);

  const first = blockingFlags(s);
  assert.deepEqual(first, [2]);
  assert.equal(hashState(s), before, 'the state it was handed is untouched');
  // The cache is a WeakMap on the state object, so the UI may ask every frame for free.
  assert.equal(blockingFlags(s), first, 'the second answer is the first answer');
});

test('THE TICK PIPELINE MUST NOT KNOW ABOUT IT: reduce.js does not import blockingFlags', () => {
  // An unusual test — it reads a source file — and it earns its place. `blockingFlags` is a
  // display decision, and the day the reducer consults one, a hint becomes a rule and every
  // replay in the determinism contract (PLAN §7.5) starts depending on what the UI wanted to
  // draw. The dependency law in README.md is enforced the same way: by something that fails.
  const src = readFileSync(fileURLToPath(new URL('../src/core/reduce.js', import.meta.url)), 'utf8');
  assert.equal(src.includes('blockingFlags'), false, 'reduce.js reached for view-layer information');
});
