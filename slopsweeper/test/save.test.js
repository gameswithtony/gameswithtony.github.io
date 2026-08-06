// @ts-check
// THE SERIALIZABILITY GUARANTEE (user decision 2026-08-04: the game survives a refresh).
//
// The UI persists `GameState` by handing it to `JSON.stringify` and revives it with
// `JSON.parse` — no custom encoder, no field list to keep in step with core. That is only
// safe while GameState is plain JSON all the way down, and nothing in core's own tests would
// notice the day somebody reaches for a Set, a Map, a class instance, a function, a
// `Date`, `undefined`, `NaN` or `Infinity`. This file is what notices.
//
// It is deliberately a CORE test with no DOM in it: the property under test belongs to the
// state, not to the storage code that happens to depend on it.

import test from 'node:test';
import assert from 'node:assert/strict';

import { init, legalActions, reduce } from '../src/core/reduce.js';
import { levelParams, setLevelParams } from '../src/core/state.js';
import { hashState } from '../src/sim/hash.js';
import { getLevel, levelIds } from '../src/levels/index.js';

/**
 * A round trip through exactly what the UI does. `levelParams` is keyed on the terrain
 * array's identity (a WeakMap in core), so a revived state has to be re-associated with its
 * level's parameters — main.js does this on restore, and a test that skipped it would be
 * testing a state that plays at the wrong patience.
 * @param {import('../src/core/state.js').GameState} s
 */
function roundTrip(s) {
  const revived = JSON.parse(JSON.stringify(s));
  setLevelParams(revived, levelParams(s));
  return revived;
}

/**
 * Walk a real game far enough to touch every shape GameState can hold: hand tiles, a drawn
 * block (phase `placing`, which carries rotation/anchor arrays), a committed block, revealed
 * cells, a flag, and enough ticks for users to spawn and move.
 * @returns {{ s: import('../src/core/state.js').GameState, log: string[] }}
 */
function playAWhile() {
  const id = levelIds().includes('tutorial') ? 'tutorial' : levelIds()[0];
  let s = init(getLevel(id), 20260804);
  const log = [];

  /** @param {import('../src/core/state.js').Action} a */
  const go = (a) => {
    const out = reduce(s, a);
    s = out.s;
    log.push(`${a.t}:${out.ev.map((e) => e.t).join(',')}`);
  };

  // A few hand tiles off the origin, wherever they are legal.
  for (let n = 0; n < 3; n++) {
    const cell = s.con.findIndex((_, i) => legalActions(s, i).includes('place'));
    if (cell < 0) break;
    go({ t: 'place', cell });
  }
  // Draw a block and commit it — that is the only way to get slop, clues and mines onto the
  // board, and the only way through phase `placing`.
  go({ t: 'generate' });
  if (s.phase.k === 'placing') {
    const rot = s.phase.rots.find((r) => r.anchors.length > 0);
    if (rot) go({ t: 'placeBlock', cell: rot.anchors[0], rot: /** @type {0|1|2|3} */ (rot.rot) });
  }
  // Flag one hidden cell, analyze another that is not flagged.
  const hidden = s.con.findIndex((c) => c.k === 'aiHidden');
  if (hidden >= 0) go({ t: 'flag', cell: hidden });
  const analyzable = s.con.findIndex((c, i) => c.k === 'aiHidden' && legalActions(s, i).includes('analyze'));
  if (analyzable >= 0) go({ t: 'analyze', cell: analyzable });
  // Then wait, and keep waiting until the schedule has actually put people on the board — the
  // one part of GameState the verbs above cannot reach. This used to be a flat eight ticks, which
  // worked while the first level's first arrival landed on turn 4; `tutorial` holds its burst
  // back to turn 13 (2026-08-06) and eight ticks silently stopped covering the user list. A bound
  // rather than a count, so the fixture follows the schedule instead of restating it.
  for (let n = 0; n < 40 && s.phase.k === 'play' && (n < 8 || s.users.length < 2); n++) go({ t: 'wait' });
  assert.ok(s.users.length >= 2, `the fixture never reached the schedule: ${s.users.length} users`);
  return { s, log };
}

test('GameState survives JSON.stringify → parse byte-for-byte', () => {
  const { s } = playAWhile();
  const once = JSON.stringify(s);
  const revived = roundTrip(s);
  assert.equal(JSON.stringify(revived), once, 'the round trip changed the encoding');
  assert.equal(hashState(revived), hashState(s), 'the revived state hashes differently');
  assert.deepEqual(revived, s);
});

test('a revived state answers legalActions identically, everywhere', () => {
  const { s } = playAWhile();
  const revived = roundTrip(s);
  assert.deepEqual(legalActions(revived), legalActions(s), 'global verbs differ');
  for (let i = 0; i < s.w * s.h; i++) {
    assert.deepEqual(legalActions(revived, i), legalActions(s, i), `cell ${i} offers different verbs`);
  }
});

test('reducing a revived state produces the identical result', () => {
  const { s } = playAWhile();
  const revived = roundTrip(s);
  // Every verb the state currently allows, not just a convenient one: the RNG streams, the
  // schedule and the user list all have to come back intact for these to agree.
  /** @type {import('../src/core/state.js').Action[]} */
  const tries = [{ t: 'wait' }, { t: 'generate' }];
  const cell = s.con.findIndex((c) => c.k === 'aiHidden');
  if (cell >= 0) tries.push({ t: 'analyze', cell }, { t: 'flag', cell });
  const place = s.con.findIndex((_, i) => legalActions(s, i).includes('place'));
  if (place >= 0) tries.push({ t: 'place', cell: place });

  for (const a of tries) {
    const before = reduce(s, a);
    const after = reduce(revived, a);
    assert.equal(hashState(after.s), hashState(before.s), `'${a.t}' diverged`);
    assert.deepEqual(after.ev, before.ev, `'${a.t}' emitted different events`);
    assert.deepEqual(after.s, before.s, `'${a.t}' produced a different state`);
  }
});

test('a revived state keeps playing to the same ending', () => {
  const { s } = playAWhile();
  const revived = roundTrip(s);
  let a = s;
  let b = revived;
  /** @type {string[]} */
  const evA = [];
  /** @type {string[]} */
  const evB = [];
  for (let n = 0; n < 300 && a.phase.k === 'play'; n++) {
    const outA = reduce(a, { t: 'wait' });
    const outB = reduce(b, { t: 'wait' });
    a = outA.s;
    b = outB.s;
    evA.push(...outA.ev.map((e) => e.t));
    evB.push(...outB.ev.map((e) => e.t));
  }
  assert.deepEqual(evB, evA, 'the two runs diverged in their event streams');
  assert.equal(hashState(b), hashState(a));
  assert.equal(b.phase.k, a.phase.k);
  assert.deepEqual(b.stats, a.stats);
});

test('phase placing round-trips — rotations and anchors are arrays, not something clever', () => {
  const id = levelIds().includes('tutorial') ? 'tutorial' : levelIds()[0];
  let s = init(getLevel(id), 7);
  s = reduce(s, { t: 'generate' }).s;
  assert.equal(s.phase.k, 'placing', 'generate did not enter placing');

  const revived = roundTrip(s);
  assert.equal(revived.phase.k, 'placing');
  assert.deepEqual(revived.phase, s.phase);
  assert.ok(Array.isArray(revived.phase.rots) && revived.phase.rots.length > 0);
  for (const r of revived.phase.rots) {
    assert.ok(Array.isArray(r.cells) && Array.isArray(r.anchors));
    for (const c of r.cells) assert.ok(Array.isArray(c) && c.length === 2, 'an offset lost its tuple shape');
  }
  // and it still commits to the same board
  const rot = s.phase.rots.find((r) => r.anchors.length > 0);
  if (rot) {
    /** @type {import('../src/core/state.js').Action} */
    const commit = { t: 'placeBlock', cell: rot.anchors[0], rot: /** @type {0|1|2|3} */ (rot.rot) };
    assert.equal(hashState(reduce(revived, commit).s), hashState(reduce(s, commit).s));
  }
});

test('no value in GameState is outside JSON', () => {
  const { s } = playAWhile();
  /** @param {unknown} v @param {string} path */
  const walk = (v, path) => {
    if (v === null) return;
    const t = typeof v;
    if (t === 'number') {
      assert.ok(Number.isFinite(v), `${path} is ${v} — JSON turns that into null`);
      return;
    }
    if (t === 'string' || t === 'boolean') return;
    assert.notEqual(t, 'undefined', `${path} is undefined — JSON drops it`);
    assert.notEqual(t, 'function', `${path} is a function`);
    assert.notEqual(t, 'bigint', `${path} is a bigint — JSON.stringify throws on it`);
    assert.notEqual(t, 'symbol', `${path} is a symbol`);
    assert.ok(!(v instanceof Set) && !(v instanceof Map), `${path} is a Set/Map — it serializes as {}`);
    assert.ok(!(v instanceof Date), `${path} is a Date — it revives as a string`);
    if (Array.isArray(v)) {
      v.forEach((item, i) => walk(item, `${path}[${i}]`));
      return;
    }
    assert.equal(Object.getPrototypeOf(v), Object.prototype, `${path} is a class instance, not a plain object`);
    for (const [k, item] of Object.entries(/** @type {object} */ (v))) walk(item, `${path}.${k}`);
  };
  walk(s, 'state');
});
