// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import { cellAt } from '../src/core/grid.js';
import { init, reduce } from '../src/core/reduce.js';

/** @template T @param {T} o @returns {T} */
function deepFreeze(o) {
  if (o && typeof o === 'object' && !Object.isFrozen(o)) {
    Object.freeze(o);
    for (const v of Object.values(o)) deepFreeze(v);
  }
  return o;
}

const LEVEL = {
  id: 'purity',
  map: ['#####', 'A###B', '#####'].join('\n'),
  arrivals: { count: 3, firstTick: 0, every: 2 },
};

test('reduce never mutates the state it was given', () => {
  // Get to a busy tick: users on the board, users queued, a partly built path.
  let s = init(LEVEL, 7);
  s = reduce(s, { t: 'place', cell: cellAt(s, 1, 1) }).s;
  s = reduce(s, { t: 'place', cell: cellAt(s, 2, 1) }).s;
  s = reduce(s, { t: 'place', cell: cellAt(s, 3, 1) }).s;
  s = reduce(s, { t: 'wait' }).s;
  assert.ok(s.users.length >= 2 && s.users.some((u) => u.state === 'moving'));

  deepFreeze(s);
  const before = JSON.stringify(s);

  const placed = reduce(s, { t: 'place', cell: cellAt(s, 1, 0) });
  const waited = reduce(s, { t: 'wait' });
  const rejectedResult = reduce(s, { t: 'place', cell: cellAt(s, 1, 1) });

  assert.equal(JSON.stringify(s), before, 'the input state is byte-identical afterwards');
  assert.notEqual(placed.s, s);
  assert.notEqual(placed.s.con, s.con);
  assert.notEqual(placed.s.users, s.users);
  assert.equal(placed.s.terrain, s.terrain, 'terrain is load-time constant and stays shared');
  assert.equal(waited.s.tick, s.tick + 1);
  assert.equal(rejectedResult.s, s, 'a rejected action returns the input untouched');

  // Mutating a result must not reach back into the original.
  waited.s.users[0].visited.push(-1);
  assert.equal(JSON.stringify(s), before);
});
