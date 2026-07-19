// rng.test.js — WP0 done-when: determinism (same seed -> same sequence) and
// d100 distribution sanity. Run: node --test test/ (from /token).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRng, rngFromState } from '../src/sim/rng.js';

test('same seed produces an identical sequence', () => {
  const a = createRng(12345);
  const b = createRng(12345);
  const seqA = Array.from({ length: 500 }, () => a.next());
  const seqB = Array.from({ length: 500 }, () => b.next());
  assert.deepEqual(seqA, seqB);
});

test('different seeds diverge', () => {
  const a = createRng(1);
  const b = createRng(2);
  const seqA = Array.from({ length: 100 }, () => a.next());
  const seqB = Array.from({ length: 100 }, () => b.next());
  assert.notDeepEqual(seqA, seqB);
});

test('next() stays in [0, 1)', () => {
  const r = createRng(99);
  for (let i = 0; i < 100000; i++) {
    const x = r.next();
    assert.ok(x >= 0 && x < 1, `out of range: ${x}`);
  }
});

test('d100 stays in [1, 100] and is roughly uniform', () => {
  const r = createRng(7);
  const N = 200000;
  const buckets = new Array(101).fill(0); // index 0 unused
  let sum = 0;
  for (let i = 0; i < N; i++) {
    const v = r.d100();
    assert.ok(v >= 1 && v <= 100, `d100 out of range: ${v}`);
    buckets[v]++;
    sum += v;
  }
  const mean = sum / N;
  assert.ok(Math.abs(mean - 50.5) < 0.5, `mean drifted: ${mean}`);
  // every face should appear near N/100; allow generous +/-25% slack
  const expected = N / 100;
  for (let v = 1; v <= 100; v++) {
    assert.ok(
      buckets[v] > expected * 0.75 && buckets[v] < expected * 1.25,
      `face ${v} count ${buckets[v]} outside tolerance`
    );
  }
});

test('range() is inclusive on both ends and stays in bounds', () => {
  const r = createRng(3);
  let sawMin = false, sawMax = false;
  for (let i = 0; i < 20000; i++) {
    const v = r.range(5, 9);
    assert.ok(v >= 5 && v <= 9);
    assert.ok(Number.isInteger(v));
    if (v === 5) sawMin = true;
    if (v === 9) sawMax = true;
  }
  assert.ok(sawMin && sawMax, 'range never hit its endpoints');
});

test('getState()/setState() round-trips the cursor', () => {
  const r = createRng(42);
  for (let i = 0; i < 17; i++) r.next(); // advance to an arbitrary point
  const saved = r.getState();
  const after = Array.from({ length: 50 }, () => r.next());
  // rewind and replay
  r.setState(saved);
  const replay = Array.from({ length: 50 }, () => r.next());
  assert.deepEqual(after, replay);
});

test('rngFromState resumes an independent stream at the saved cursor', () => {
  const live = createRng(2024);
  for (let i = 0; i < 30; i++) live.next();
  const cursor = live.getState();
  const rest = Array.from({ length: 40 }, () => live.next());

  const resumed = rngFromState(2024, cursor);
  const resumedRest = Array.from({ length: 40 }, () => resumed.next());
  assert.deepEqual(rest, resumedRest);
});

test('pick and shuffle are deterministic for a fixed seed', () => {
  const items = [1, 2, 3, 4, 5, 6, 7, 8];
  const a = createRng(555);
  const b = createRng(555);
  assert.deepEqual(
    Array.from({ length: 20 }, () => a.pick(items)),
    Array.from({ length: 20 }, () => b.pick(items))
  );
  assert.deepEqual(a.shuffle(items), b.shuffle(items));
  // shuffle returns a new array, leaves the input intact
  const original = items.slice();
  a.shuffle(items);
  assert.deepEqual(items, original);
});
