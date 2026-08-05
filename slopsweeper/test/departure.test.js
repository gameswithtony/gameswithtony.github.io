// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import { CON_HAND } from '../src/core/state.js';
import { cellAt } from '../src/core/grid.js';
import { gateOpen } from '../src/core/routing.js';
import { init, reduce } from '../src/core/reduce.js';

const CORRIDOR = { id: 'gate-corridor', map: 'A##B', arrivals: { count: 3, firstTick: 999, every: 999 } };

/** Hand-place the users the schedule would have produced, so the tests control the clock. */
function queue(/** @type {import('../src/core/state.js').GameState} */ s, /** @type {number} */ n) {
  for (let i = 0; i < n; i++) {
    s.users.push({ id: s.users.length, at: s.origin, state: 'queued', todo: [0], visited: [], stalled: false, waited: 0 });
  }
  s.schedule = { ...s.schedule, total: n, spawned: n };
  return s;
}

test('the gate is topological: users wait until a path exists, then the whole queue drains at once', () => {
  let s = queue(init(CORRIDOR, 1), 3);
  assert.equal(gateOpen(s), false);

  const r1 = reduce(s, { t: 'place', cell: cellAt(s, 1, 0) });
  s = r1.s;
  assert.equal(gateOpen(s), false, 'a stub is not a path');
  assert.equal(s.users.every((u) => u.state === 'queued'), true);
  assert.equal(r1.ev.some((e) => e.t === 'departed'), false);

  const r2 = reduce(s, { t: 'place', cell: cellAt(s, 2, 0) });
  s = r2.s;
  assert.deepEqual(
    r2.ev.filter((e) => e.t === 'departed').map((e) => /** @type {any} */ (e).user),
    [0, 1, 2],
    'all queued users with an open path depart in the same tick (PLAN §3.9)',
  );
  assert.equal(s.users.every((u) => u.state === 'moving'), true);
  assert.equal(s.users.every((u) => u.at === cellAt(s, 1, 0)), true, 'and they step the same tick');
});

test('the gate is topological, not safe: a user departs into a mined corridor (SPEC §6.2)', () => {
  const s = queue(init(CORRIDOR, 1), 1);
  const mined = cellAt(s, 1, 0);
  s.con[mined] = { k: 'aiHidden', mine: true, block: 0, flagged: false };
  s.con[cellAt(s, 2, 0)] = { k: 'aiHidden', mine: false, block: 0, flagged: false };
  s.blocks = [{ id: 0, cells: [mined, cellAt(s, 2, 0)] }];
  assert.equal(gateOpen(s), true, 'aiHidden counts as passable, so the route reads as complete');

  const { s: s2, ev } = reduce(s, { t: 'wait' });
  assert.equal(ev.some((e) => e.t === 'departed'), true, 'it walked in willingly');
  assert.equal(ev.some((e) => e.t === 'step' && /** @type {any} */ (e).to === mined), true);
  // …and found out the hard way. Revised 2026-08-04 (points economy): the trip ends, full
  // stop — the user is killed, not sent back to try again.
  assert.equal(ev.some((e) => e.t === 'detonate'), true);
  assert.deepEqual(ev.filter((e) => e.t === 'userLost'),
    [{ t: 'userLost', user: 0, at: mined, reason: 'detonation' }]);
  assert.equal(s2.users[0].state, 'gone');
  assert.equal(s2.stats.lost, 1);
});

test('flagged slop and mine-confirmed tiles close the gate; the path is otherwise passable', () => {
  const s = queue(init(CORRIDOR, 1), 1);
  s.con[cellAt(s, 1, 0)] = CON_HAND;
  s.con[cellAt(s, 2, 0)] = CON_HAND;
  assert.equal(gateOpen(s), true);

  // Unreviewed slop is passable: the gate is topological, not safe (SPEC §6.2).
  s.con[cellAt(s, 2, 0)] = { k: 'aiHidden', mine: true, block: 0, flagged: false };
  assert.equal(gateOpen(s), true, 'users walk into mined corridors willingly');

  // A flag on that same tile is the player refusing to let them, and it shuts the route.
  s.con[cellAt(s, 2, 0)] = { k: 'aiHidden', mine: true, block: 0, flagged: true };
  assert.equal(gateOpen(s), false);

  s.con[cellAt(s, 2, 0)] = { k: 'mineConfirmed', block: 0 };
  assert.equal(gateOpen(s), false);
});

test('a user spawned this tick queues, and gates on the next one', () => {
  const level = { id: 'gate-adjacent', map: 'AB', arrivals: { count: 1, firstTick: 0, every: 1 } };
  let s = init(level, 1);
  assert.equal(gateOpen(s), true, 'endpoints are always passable, so this gate is open at tick 0');

  const r1 = reduce(s, { t: 'wait' });
  s = r1.s;
  assert.equal(r1.ev.filter((e) => e.t === 'spawned').length, 1);
  assert.equal(r1.ev.some((e) => e.t === 'departed'), false, 'spawned this tick, gates next tick');
  assert.equal(s.users[0].state, 'queued');

  const r2 = reduce(s, { t: 'wait' });
  assert.equal(r2.ev.some((e) => e.t === 'departed'), true);
  assert.equal(r2.s.users[0].state, 'arrived');
});
