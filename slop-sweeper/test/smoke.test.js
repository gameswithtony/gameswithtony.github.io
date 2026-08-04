// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import { RULES, LEVEL_DEFAULTS } from '../src/core/rules.js';
import { MOVE_STREAM_XOR, initStreams, mulberry32 } from '../src/core/rng.js';
import { CON, TERRAIN, caps } from '../src/core/state.js';
import { getLevel, levelIds } from '../src/levels/index.js';
import { init } from '../src/core/reduce.js';

test('rules.js carries every PLAN §8 constant', () => {
  for (const k of [
    'CONFIDENCE_START', 'WAIT_DRAIN_PER_USER', 'DETONATE_HIT', 'SERVED_BONUS', 'BLAST_RADIUS',
    'USER_MOVE_EVERY', 'ART_PX_PER_TILE', 'FONT_MIN_DEVICE_PX',
    'ZOOM_MAX_ARTPX', 'TAP_SLOP_CSS', 'TAP_MS', 'STEP_TWEEN_MS', 'FF_INTERVAL_MS',
  ]) {
    assert.equal(typeof RULES[k], 'number', `missing constant ${k}`);
  }
  assert.equal(RULES.CONFIDENCE_START, 100);
  // Removed 2026-08-04 with single-click Analyze: a per-level reveal budget has nothing
  // left to budget, and a stale constant is how a dead rule comes back to life.
  assert.equal('ANALYZE_REVEALS' in RULES, false);
  assert.equal('analyzeReveals' in LEVEL_DEFAULTS, false);
  assert.equal(LEVEL_DEFAULTS.arrivals.count, 10);
  assert.equal(LEVEL_DEFAULTS.userMoveEvery, RULES.USER_MOVE_EVERY);
});

test('mulberry32 is deterministic and its whole state is one uint32', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  const first = [a(), a(), a()];
  assert.deepEqual(first, [b(), b(), b()]);

  const at = a.getState();
  const rest = [a(), a()];
  const resumed = mulberry32(at);
  assert.deepEqual(rest, [resumed(), resumed()]);

  const set = mulberry32(0);
  set.setState(at);
  assert.equal(set(), rest[0]);

  for (const v of first) assert.ok(v >= 0 && v < 1);
});

test('the two streams are split by the golden-ratio xor', () => {
  const s = initStreams(7);
  assert.equal(s.gen, 7);
  assert.equal(s.move, (7 ^ MOVE_STREAM_XOR) >>> 0);
  assert.notEqual(mulberry32(s.gen)(), mulberry32(s.move)());
});

test('the terrain table has a complete row per SPEC §2.1 feature', () => {
  for (const t of ['ocean', 'void', 'volcano']) {
    const row = caps(t);
    for (const k of ['handBuildable', 'generatable', 'passable', 'knownEmpty', 'blastStops']) {
      assert.equal(typeof row[k], 'boolean', `${t}.${k}`);
    }
  }
  assert.equal(TERRAIN.ocean.handBuildable, true);
  assert.equal(TERRAIN.void.handBuildable, false);
  assert.equal(TERRAIN.volcano.blastStops, true);
  assert.equal(TERRAIN.void.blastStops, true);
  assert.equal(TERRAIN.ocean.blastStops, false);
  assert.throws(() => caps('lava'), /unknown terrain/);
});

test('the construction table carries the full SPEC §2.2 union', () => {
  assert.deepEqual(
    Object.keys(CON).sort(),
    ['aiHidden', 'aiRevealed', 'hand', 'mineConfirmed', 'none'],
  );
  assert.equal(CON.aiHidden.passable, true);
  assert.equal(CON.aiHidden.handFrom, false);   // SPEC §4.1, the load-bearing rule
  assert.equal(CON.aiHidden.genFrom, true);     // SPEC §4.2
  assert.equal(CON.mineConfirmed.passable, false);
});

test('the registry boots a level into a well-formed state', () => {
  assert.ok(levelIds().includes('plain'));
  const s = init(getLevel('plain'), 1);
  assert.equal(s.level, 'plain');
  assert.equal(s.tick, 0);
  assert.equal(s.confidence, RULES.CONFIDENCE_START);
  assert.equal(s.phase.k, 'play');
  assert.equal(s.con.length, s.w * s.h);
  assert.equal(s.users.length, 0);
  assert.deepEqual(s.rng, initStreams(1));
});
