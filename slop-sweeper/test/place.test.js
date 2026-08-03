// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import { cellAt } from '../src/core/grid.js';
import { init, legalActions, reduce } from '../src/core/reduce.js';

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
  assert.deepEqual(legalActions(s, cell), ['place']);
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
  assert.deepEqual(legalActions(s, next), ['place']);
  s = reduce(s, { t: 'place', cell: next }).s;
  assert.equal(s.con[next].k, 'hand');
});

test('a hand tile may branch from an aiRevealed tile', () => {
  const s = fresh();
  const revealed = at(s, 3, 1);
  s.con[revealed] = { k: 'aiRevealed', block: 0 };
  const target = at(s, 3, 0);
  assert.deepEqual(legalActions(s, target), ['place']);
});

test('a hand tile can NEVER branch from an aiHidden tile (SPEC §4.1)', () => {
  const s = fresh();
  const hidden = at(s, 3, 1);
  s.con[hidden] = { k: 'aiHidden', mine: false, block: 0 };
  const target = at(s, 3, 0);

  assert.deepEqual(legalActions(s, target), [], 'the action bar teaches the rule by absence');
  const { s: s2, ev } = reduce(s, { t: 'place', cell: target });
  assert.equal(s2, s, 'a rejected action returns the same state object');
  assert.equal(s2.tick, 0, 'a rejected action never advances the tick');
  assert.equal(ev.length, 1);
  assert.equal(ev[0].t, 'rejected');
  assert.match(/** @type {any} */ (ev[0]).reason, /must touch an endpoint/);

  // The same cell becomes legal the moment that neighbour is understood.
  s.con[hidden] = { k: 'aiRevealed', block: 0 };
  assert.deepEqual(legalActions(s, target), ['place']);
});

test('placement is refused off structure, on non-ocean terrain, on endpoints and on built cells', () => {
  const s = fresh();
  /** @param {number} cell */
  const why = (cell) => /** @type {any} */ (reduce(s, { t: 'place', cell }).ev[0]).reason;

  assert.match(why(at(s, 3, 0)), /must touch an endpoint/);
  assert.match(why(at(s, 2, 1)), /cannot build on volcano/);
  assert.match(why(at(s, 0, 0)), /cannot build on void/);
  assert.match(why(s.origin), /endpoints are not buildable/);
  assert.match(why(s.dest), /endpoints are not buildable/);
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
  assert.throws(() => reduce(s, /** @type {any} */ ({ t: 'flag', cell: 0 })), /unhandled action/);
});
