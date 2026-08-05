// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import { RULES } from '../src/core/rules.js';
import { CON_HAND, CON_NONE } from '../src/core/state.js';
import { cellAt } from '../src/core/grid.js';
import { distField } from '../src/core/routing.js';
import { init, reduce } from '../src/core/reduce.js';

/** Endpoints diagonally opposite, so every step of the walk is a genuine two-way tie. */
const OPEN = {
  id: 'movement-open',
  map: ['A####', '#####', '#####', '#####', '####B'].join('\n'),
  arrivals: { count: 1, firstTick: 0, every: 1 },
};

/** @param {number} seed */
function pavedBoard(seed) {
  const s = init(OPEN, seed);
  s.con = s.con.map((_, i) => (i === s.origin || i === s.dest ? CON_NONE : CON_HAND));
  return s;
}

/** @param {import('../src/core/state.js').GameState} s @param {number} n */
function waits(s, n) {
  /** @type {import('../src/core/state.js').Ev[]} */
  const all = [];
  for (let i = 0; i < n; i++) {
    const r = reduce(s, { t: 'wait' });
    s = r.s;
    all.push(...r.ev);
  }
  return { s, ev: all };
}

test('every step strictly reduces distance to the destination', () => {
  let s = pavedBoard(3);
  const dist = distField(s);
  const { s: end, ev } = waits(s, 12);
  const steps = ev.filter((e) => e.t === 'step');
  assert.ok(steps.length >= 8);
  for (const st of /** @type {any[]} */ (steps)) {
    assert.equal(dist[st.to], dist[st.from] - 1, 'movement must be monotone (SPEC §6.3.1)');
  }
  assert.equal(end.users[0].state, 'arrived');
  assert.equal(end.users[0].at, end.dest);
});

test('a trip never re-enters a visited cell', () => {
  const { s } = waits(pavedBoard(9), 12);
  const visited = s.users[0].visited;
  assert.equal(new Set(visited).size, visited.length);
  assert.equal(visited[0], s.origin);
  assert.equal(visited[visited.length - 1], s.dest);
});

test('the tie-break is seeded: same seed, same walk', () => {
  const walk = (/** @type {number} */ seed) => waits(pavedBoard(seed), 12).s.users[0].visited;
  assert.deepEqual(walk(5), walk(5));
  assert.deepEqual(walk(1234), walk(1234));

  const walks = [1, 2, 3, 4, 5, 6].map((n) => walk(n).join(','));
  assert.ok(new Set(walks).size > 1, 'different seeds must produce different walks');
});

test('a user with no legal move stalls in place and counts as waiting', () => {
  // One corridor, one user, then the tile ahead is torn out mid-trip.
  const level = { id: 'movement-corridor', map: 'A###B', arrivals: { count: 1, firstTick: 0, every: 1 } };
  let s = init(level, 1);
  for (let x = 1; x <= 3; x++) s.con[cellAt(s, x, 0)] = CON_HAND;

  s = waits(s, 2).s;                       // spawn, then depart + step
  const u0 = s.users[0];
  assert.equal(u0.state, 'moving');
  assert.equal(u0.at, cellAt(s, 1, 0));
  assert.equal(u0.stalled, false);

  s = { ...s, con: s.con.slice() };
  s.con[cellAt(s, 2, 0)] = CON_NONE;       // the blast an M2 mine would have caused
  const r = reduce(s, { t: 'wait' });

  assert.equal(r.s.users[0].at, cellAt(s, 1, 0), 'stranded users wait in place (SPEC §6.4)');
  assert.equal(r.s.users[0].stalled, true);
  assert.equal(r.s.users[0].state, 'moving');
  assert.equal(r.ev.some((e) => e.t === 'step'), false);
  assert.equal(r.s.users[0].waited, s.users[0].waited + 1,
    'a stalled user burns patience like any other waiting user');
});
