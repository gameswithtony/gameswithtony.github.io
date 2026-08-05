// @ts-check
// THE POINTS ECONOMY (user decision 2026-08-04), replacing the stakeholder-confidence meter.
// Pressure is the users themselves: they run out of patience and leave, they die in blasts,
// and the level ends when every scheduled user has resolved. Score is arrivals; one is a win,
// all of them is the goal, none is a loss.
//
// The old `meters.test.js` tested the drain, the zero-crossing and the all-arrived win. Those
// rules no longer exist; these are their replacements.
import test from 'node:test';
import assert from 'node:assert/strict';

import { RULES } from '../src/core/rules.js';
import { CON_HAND } from '../src/core/state.js';
import { cellAt } from '../src/core/grid.js';
import { init, reduce } from '../src/core/reduce.js';

//  Its own board with its own schedule: patience is a rule, and a rule test must not move
//  when the sim retunes a level's arrival numbers (PLAN §13).
const WAITING = {
  id: 'patience-wait',
  map: ['##########', 'A########B', '##########'].join('\n'),
  arrivals: { count: 3, firstTick: 0, every: 4 },
  patience: 5,
};

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

test('a queued user burns patience every tick it cannot leave', () => {
  let s = init(WAITING, 1);
  const limit = /** @type {number} */ (WAITING.patience);

  const first = reduce(s, { t: 'wait' });   // tick 0: user 0 spawns and is already stuck
  s = first.s;
  assert.equal(s.users.length, 1);
  assert.equal(s.users[0].state, 'queued');
  assert.equal(s.users[0].waited, 1, 'queued *is* waiting — there is nowhere to go');
  assert.equal(first.ev.some((e) => e.t === 'userLost'), false);

  s = waits(s, limit - 2).s;
  assert.equal(s.users[0].waited, limit - 1, 'one tick of patience left');
  assert.equal(s.users[0].state, 'queued');

  const { s: after, ev } = waits(s, 1);
  assert.deepEqual(
    ev.filter((e) => e.t === 'userLost'),
    [{ t: 'userLost', user: 0, at: after.origin, reason: 'gaveUp' }],
    'a queued user gives up where it stood: the origin',
  );
  assert.equal(after.users[0].state, 'gone');
  assert.equal(after.stats.lost, 1);
});

test('MOVING IS NOT WAITING: a user walking a live route never loses patience', () => {
  const level = { id: 'patience-walk', map: 'A####B', arrivals: { count: 1, firstTick: 0, every: 1 }, patience: 3 };
  let s = init(level, 1);
  for (const x of [1, 2, 3, 4]) s.con[cellAt(s, x, 0)] = CON_HAND;

  // Six ticks on a three-tick patience: it arrives, unbothered. The single tick on the
  // counter is the spawn gate — a user spawned this tick departs on the next one (PLAN
  // §3.9), and it is queued when patience is charged. Everything after that is walking.
  const { s: after } = waits(s, 7);
  assert.equal(after.users[0].state, 'arrived');
  assert.equal(after.users[0].waited, 1, 'only the gating tick counted; walking never does');
  assert.equal(after.stats.served, 1);
  assert.equal(after.phase.k, 'won');
});

test('patience is CUMULATIVE, not consecutive — a route that keeps stalling bleeds you out', () => {
  //  A#B with the middle cell built and unbuilt under the user's feet. The old confidence
  //  meter forgave nothing but also remembered nothing per-user; this does the opposite.
  const level = { id: 'patience-cumulative', map: 'A##B', arrivals: { count: 1, firstTick: 0, every: 1 }, patience: 3 };
  let s = init(level, 1);
  s = waits(s, 1).s;                       // spawn, gate shut: waited 1
  assert.equal(s.users[0].waited, 1);

  // Open the route: it departs and steps, so the counter holds where it was.
  s.con[1] = CON_HAND;
  s.con[2] = CON_HAND;
  s = waits(s, 1).s;
  assert.equal(s.users[0].state, 'moving');
  assert.equal(s.users[0].waited, 1, 'walking does not pay the debt back down');

  // Shut it again in front of the walker: it stalls, and the count resumes from 1, not 0.
  s = { ...s, con: s.con.slice() };
  s.con[2] = { k: 'none' };
  const stalled = waits(s, 1).s;
  assert.equal(stalled.users[0].stalled, true);
  assert.equal(stalled.users[0].waited, 2, 'cumulative: it never forgets');

  const { s: dead, ev } = waits(stalled, 1);
  assert.equal(dead.users[0].state, 'gone', 'three cumulative ticks, three strikes');
  assert.deepEqual(
    ev.filter((e) => e.t === 'userLost'),
    [{ t: 'userLost', user: 0, at: 1, reason: 'gaveUp' }],
    'and it gives up on the cell it was standing on, not at the origin',
  );
});

test('patience is per-level, and defaults from rules.js', () => {
  const s = init({ id: 'patience-default', map: 'A#B', arrivals: { count: 1, firstTick: 0, every: 1 } }, 1);
  const { s: after } = waits(s, RULES.USER_PATIENCE);
  assert.equal(after.users[0].state, 'gone', `the default is ${RULES.USER_PATIENCE} ticks`);

  const patient = init({ id: 'patience-override', map: 'A#B', arrivals: { count: 1, firstTick: 0, every: 1 }, patience: RULES.USER_PATIENCE + 5 }, 1);
  assert.equal(waits(patient, RULES.USER_PATIENCE).s.users[0].state, 'queued', 'the override wins');
});

test('losing every user is the loss condition, and the event carries the score', () => {
  const { s, ev } = waits(init(WAITING, 1), 40);
  assert.equal(s.phase.k, 'lost');
  assert.equal(s.users.length, 3, 'all three were scheduled…');
  assert.equal(s.users.every((u) => u.state === 'gone'), true, '…and all three walked out');
  assert.equal(s.stats.served, 0);
  assert.equal(s.stats.lost, 3);
  assert.deepEqual(ev.filter((e) => e.t === 'lost'), [{ t: 'lost', served: 0, total: 3 }]);
  assert.match(/** @type {any} */ (reduce(s, { t: 'wait' }).ev[0]).reason, /game is over/);
});

test('one arrival is a win; the rest of the losses are just a lower score', () => {
  //  Two users, a route that exists for exactly long enough to deliver the first.
  const level = { id: 'patience-partial', map: 'A#B', arrivals: { count: 2, firstTick: 0, every: 6 }, patience: 3 };
  let s = init(level, 1);
  s.con[1] = CON_HAND;
  s = waits(s, 3).s;                       // spawn+gate, depart+step, step onto B
  assert.equal(s.stats.served, 1);

  s = { ...s, con: s.con.slice() };
  s.con[1] = { k: 'none' };                // and the route is gone before user 1 spawns
  const { s: end, ev } = waits(s, 20);

  assert.equal(end.phase.k, 'won', 'one served is a win, however grim the rest of it was');
  assert.deepEqual(ev.filter((e) => e.t === 'won'), [{ t: 'won', served: 1, total: 2 }]);
  assert.equal(end.stats.served, 1);
  assert.equal(end.stats.lost, 1);
});

test('the level does not end while a user could still arrive', () => {
  const level = { id: 'patience-open', map: 'A#B', arrivals: { count: 2, firstTick: 0, every: 1 }, patience: 40 };
  let s = init(level, 1);
  s = waits(s, 6).s;
  assert.equal(s.phase.k, 'play', 'both are alive and queued, so nothing is decided');
  assert.equal(s.users.every((u) => u.state === 'queued'), true);

  s = { ...s, con: s.con.slice() };
  s.con[1] = CON_HAND;
  const { s: end } = waits(s, 4);
  assert.equal(end.phase.k, 'won');
  assert.equal(end.stats.served, 2, 'a perfect game');
});

test('a user gone to patience stays gone: no revival, no second chance', () => {
  const level = { id: 'patience-final', map: 'A#B', arrivals: { count: 1, firstTick: 0, every: 1 }, patience: 2 };
  let s = init(level, 1);
  s = waits(s, 2).s;
  assert.equal(s.users[0].state, 'gone');
  assert.equal(s.phase.k, 'lost');

  // Even with the board fixed, the user does not come back — the game is over.
  const fixed = { ...s, con: s.con.slice(), phase: /** @type {const} */ ({ k: 'play' }) };
  fixed.con[1] = CON_HAND;
  const { s: after, ev } = waits(fixed, 3);
  assert.equal(after.users[0].state, 'gone');
  assert.equal(after.stats.served, 0);
  assert.equal(ev.some((e) => e.t === 'departed'), false, 'gone users never depart');
  assert.equal(ev.some((e) => e.t === 'step'), false);
});
