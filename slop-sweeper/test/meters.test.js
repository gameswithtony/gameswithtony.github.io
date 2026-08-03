// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import { RULES } from '../src/core/rules.js';
import { init, reduce } from '../src/core/reduce.js';
import { getLevel } from '../src/levels/index.js';

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

test('the drain scales with the number of waiting users', () => {
  //  plain: 8 users, first at tick 6, one every 5 ticks. Nothing is built, so they pile up.
  let s = init(getLevel('plain'), 1);
  const drain = RULES.WAIT_DRAIN_PER_USER;

  s = waits(s, 6).s;      // ticks 0-5: nobody has arrived to wait yet
  assert.equal(s.users.length, 0);
  assert.equal(s.confidence, RULES.CONFIDENCE_START);

  const r = reduce(s, { t: 'wait' });   // tick 6: the first user spawns and waits at once
  s = r.s;
  assert.equal(s.users.length, 1);
  assert.equal(s.confidence, RULES.CONFIDENCE_START - drain);
  assert.deepEqual(r.ev.filter((e) => e.t === 'confidence'), [{ t: 'confidence', delta: -drain, reason: 'waiting' }]);

  s = waits(s, 4).s;      // ticks 7-10: still one user waiting
  assert.equal(s.confidence, RULES.CONFIDENCE_START - drain * 5);

  const r2 = reduce(s, { t: 'wait' });  // tick 11: the second arrives, so the slope doubles
  assert.equal(r2.s.users.length, 2);
  assert.equal(r2.s.confidence, s.confidence - drain * 2);
});

test('confidence at or below zero is a loss', () => {
  const level = { id: 'meters-loss', map: 'A#B', arrivals: { count: 1, firstTick: 0, every: 1 } };
  let s = init(level, 1);
  s = waits(s, 1).s;                       // one user spawns and starts waiting
  s = { ...s, confidence: RULES.WAIT_DRAIN_PER_USER };

  const { s: end, ev } = waits(s, 1);
  assert.equal(end.confidence, 0);
  assert.equal(end.phase.k, 'lost');
  assert.equal(ev.some((e) => e.t === 'lost'), true);
  assert.match(/** @type {any} */ (reduce(end, { t: 'wait' }).ev[0]).reason, /game is over/);
});

test('the level is won when every scheduled user has arrived', () => {
  const level = { id: 'meters-win', map: 'AB', arrivals: { count: 2, firstTick: 0, every: 1 } };
  const { s, ev } = waits(init(level, 1), 6);
  assert.equal(s.phase.k, 'won');
  assert.equal(s.stats.served, 2);
  assert.equal(s.users.every((u) => u.state === 'arrived'), true);
  assert.equal(ev.filter((e) => e.t === 'won').length, 1);
  assert.equal(ev.filter((e) => e.t === 'arrived').length, 2);
  assert.ok(s.confidence > 0);
});
