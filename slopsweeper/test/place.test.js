// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import { cellAt } from '../src/core/grid.js';
import { init, legalActions, reduce } from '../src/core/reduce.js';

// The expected verb lists below read `['place', 'beta']` since 2026-08-05: a beta milestone
// (SPEC §4.7) is placed by exactly the target rules a hand tile is, so wherever Place is on
// offer and supply is left, so is BETA. Nothing about *placement* changed — every assertion
// in this file is the one it always was, with the new verb added to the menu.

//  x: 0 1 2 3 4 5
//  0  . # # # # #
//  1  A # ^ # # B
//  2  . # # # # #
const LEVEL = {
  id: 'place-test',
  map: ['.#####', 'A#^##B', '.#####'].join('\n'),
  arrivals: { count: 4, firstTick: 999, every: 999 },   // nobody shows up; these tests are about the board
};

const fresh = () => init(LEVEL, 1);
/** @param {import('../src/core/state.js').GameState} s @param {number} x @param {number} y */
const at = (s, x, y) => cellAt(s, x, y);

test('a hand tile may branch from an endpoint', () => {
  const s = fresh();
  const cell = at(s, 1, 1);
  assert.deepEqual(legalActions(s, cell), ['place', 'beta']);
  const { s: s2, ev } = reduce(s, { t: 'place', cell });
  assert.equal(s2.con[cell].k, 'hand');
  assert.deepEqual(ev[0], { t: 'placed', cells: [cell] });
  assert.equal(s2.tick, 1, 'a legal action advances exactly one tick');
  assert.equal(s2.stats.placed, 1);
});

test('a hand tile may branch from another hand tile', () => {
  let s = fresh();
  s = reduce(s, { t: 'place', cell: at(s, 1, 1) }).s;
  const next = at(s, 1, 0);
  assert.deepEqual(legalActions(s, next), ['place', 'beta']);
  s = reduce(s, { t: 'place', cell: next }).s;
  assert.equal(s.con[next].k, 'hand');
});

test('a hand tile may branch from an aiRevealed tile', () => {
  const s = fresh();
  const revealed = at(s, 3, 1);
  s.con[revealed] = { k: 'aiRevealed', block: 0 };
  const target = at(s, 3, 0);
  assert.deepEqual(legalActions(s, target), ['place', 'beta']);
});

test('a hand tile MAY branch from unreviewed slop, flagged or not (rev. 2026-08-04)', () => {
  // Overrides SPEC §4.1. The old rule refused this, to teach AI dependency by absence; the
  // player can now always build a legal path, and pays for building on unread ground in
  // risk rather than in legality. A flag restricts walkers, never builders.
  const s = fresh();
  const hidden = at(s, 3, 1);
  const target = at(s, 3, 0);

  for (const flagged of [false, true]) {
    s.con[hidden] = { k: 'aiHidden', mine: true, block: 0, flagged };
    assert.deepEqual(legalActions(s, target), ['place', 'beta'], `flagged: ${flagged}`);
    const { s: built, ev } = reduce(s, { t: 'place', cell: target });
    assert.deepEqual(ev[0], { t: 'placed', cells: [target] });
    assert.equal(built.con[target].k, 'hand');
    // …and the tile it branched from is untouched: still hidden, still mined, still flagged.
    assert.deepEqual(built.con[hidden], { k: 'aiHidden', mine: true, block: 0, flagged });
  }

  // Reviewing the neighbour changes nothing — it was already legal.
  s.con[hidden] = { k: 'aiRevealed', block: 0 };
  assert.deepEqual(legalActions(s, target), ['place', 'beta']);
});

test('the branch test is "any structure", but the TARGET rules are untouched', () => {
  const s = fresh();
  /** @param {number} cell */
  const why = (cell) => /** @type {any} */ (reduce(s, { t: 'place', cell }).ev[0]).reason;

  // Open water next to nothing but more open water is still refused: "any structure" is not
  // "anywhere". (3,0) touches (2,0), (4,0) and (3,1), all of them empty ocean.
  assert.match(why(at(s, 3, 0)), /must touch an endpoint or a tile that is already built/);
  assert.deepEqual(legalActions(s, at(s, 3, 0)), []);

  // A mine-confirmed tile is structure too, so it is branchable-from even though nothing
  // produces it any more (state.js keeps the row coherent).
  const confirmed = { ...s, con: s.con.slice() };
  confirmed.con[at(s, 3, 1)] = { k: 'mineConfirmed', block: 0 };
  assert.deepEqual(legalActions(confirmed, at(s, 3, 0)), ['place', 'beta']);

  // Terrain and occupancy still decide the target.
  assert.match(why(at(s, 2, 1)), /cannot build on volcano/);
  assert.match(why(at(s, 0, 0)), /cannot build on void/);
  assert.match(why(s.origin), /endpoints are not buildable/);
  assert.match(why(s.dests[0]), /endpoints are not buildable/);
  assert.match(why(-1), /off the board/);
  assert.match(why(s.w * s.h), /off the board/);
  // Slop is structure to build *from*, never ground to build *on*.
  const slop = { ...s, con: s.con.slice() };
  slop.con[at(s, 1, 1)] = { k: 'aiHidden', mine: false, block: 0, flagged: false };
  assert.match(
    /** @type {any} */ (reduce(slop, { t: 'place', cell: at(s, 1, 1) }).ev[0]).reason,
    /already built/,
  );
});

test('placement is refused off structure, on non-ocean terrain, on endpoints and on built cells', () => {
  const s = fresh();
  /** @param {number} cell */
  const why = (cell) => /** @type {any} */ (reduce(s, { t: 'place', cell }).ev[0]).reason;

  assert.match(why(at(s, 3, 0)), /must touch an endpoint/);
  assert.match(why(at(s, 2, 1)), /cannot build on volcano/);
  assert.match(why(at(s, 0, 0)), /cannot build on void/);
  assert.match(why(s.origin), /endpoints are not buildable/);
  assert.match(why(s.dests[0]), /endpoints are not buildable/);
  assert.match(why(-1), /off the board/);
  assert.match(why(s.w * s.h), /off the board/);

  const built = at(s, 1, 1);
  const s2 = reduce(s, { t: 'place', cell: built }).s;
  assert.match(/** @type {any} */ (reduce(s2, { t: 'place', cell: built }).ev[0]).reason, /already built/);
});

test('legalActions is the single source of truth for the action bar', () => {
  const s = fresh();
  assert.deepEqual(legalActions(s), ['generate', 'wait'], 'global verbs when no cell is selected');
  assert.deepEqual(legalActions(s, at(s, 2, 1)), [], 'volcano offers nothing');

  const done = { ...s, phase: /** @type {const} */ ({ k: 'won' }) };
  assert.deepEqual(legalActions(done), []);
  assert.deepEqual(legalActions(done, at(s, 1, 1)), []);
  assert.match(/** @type {any} */ (reduce(done, { t: 'wait' }).ev[0]).reason, /game is over/);
});

test('an unknown action is a hard error, not a silent no-op', () => {
  const s = fresh();
  assert.throws(() => reduce(s, /** @type {any} */ ({ t: 'nonsense' })), /unhandled action/);
  assert.throws(() => reduce(s, /** @type {any} */ ({ t: 'overwrite', cell: 0 })), /unhandled action/);
});
