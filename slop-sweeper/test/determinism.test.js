// @ts-check
// PLAN §7.5's determinism contract: init(level, seed) + an identical action sequence ⇒ an
// identical hashState at every tick. This is the standing test the whole sim rests on.
import test from 'node:test';
import assert from 'node:assert/strict';

import { init, reduce } from '../src/core/reduce.js';
import { hashState, serializeState } from '../src/sim/hash.js';
import { makePolicy } from '../src/sim/policies.js';
import { getLevel, levelIds } from '../src/levels/index.js';

/**
 * Play a whole game with a seeded bot — a deterministic action sequence by construction —
 * and record the hash after every action.
 * @param {string} levelId
 * @param {number} seed
 * @param {string} [policy]
 */
function replay(levelId, seed, policy = 'balanced:0.5') {
  const def = getLevel(levelId);
  let s = init(def, seed);
  const bot = makePolicy(policy, seed);
  /** @type {string[]} */
  const hashes = [hashState(s)];
  /** @type {import('../src/core/state.js').Action[]} */
  const actions = [];
  let guard = 0;
  while ((s.phase.k === 'play' || s.phase.k === 'placing') && guard++ < 400) {
    const a = bot.act(s);
    actions.push(a);
    const r = reduce(s, a);
    bot.observe(r.ev);
    s = r.s;
    hashes.push(hashState(s));
  }
  return { hashes, actions, final: s };
}

test('the same level, seed and actions produce the same hash at every tick', () => {
  for (const id of levelIds()) {
    const a = replay(id, 12345);
    const b = replay(id, 12345);
    assert.deepEqual(a.hashes, b.hashes, `${id} diverged`);
    assert.deepEqual(a.actions, b.actions);
    assert.equal(a.final.phase.k, b.final.phase.k);
    assert.equal(a.final.tick, b.final.tick);
    assert.ok(a.hashes.length > 4, `${id} produced only ${a.hashes.length} states`);
  }
});

test('replaying a recorded action log reproduces the game exactly', () => {
  const { hashes, actions } = replay('caldera', 777);
  let s = init(getLevel('caldera'), 777);
  const again = [hashState(s)];
  for (const a of actions) {
    s = reduce(s, a).s;
    again.push(hashState(s));
  }
  assert.deepEqual(again, hashes, 'the action log is the whole recording');
});

test('different seeds diverge', () => {
  const a = replay('plain', 1);
  const b = replay('plain', 2);
  assert.notEqual(a.hashes.join(), b.hashes.join());
  // The very first hash already differs, because the seed is part of the state.
  assert.notEqual(a.hashes[0], b.hashes[0]);

  const tails = [1, 2, 3, 4, 5].map((n) => replay('channel', n).hashes.at(-1));
  assert.ok(new Set(tails).size > 1, 'five seeds must not all land in the same place');
});

test('the hash covers everything a tick can change, in a fixed order', () => {
  const base = init(getLevel('plain'), 3);
  const text = serializeState(base);
  assert.equal(typeof text, 'string');
  assert.match(hashState(base), /^[0-9a-f]{8}$/);

  /** @param {(s: import('../src/core/state.js').GameState) => void} mutate */
  const changed = (mutate) => {
    const s = { ...base, con: base.con.slice(), stats: { ...base.stats }, rng: { ...base.rng } };
    mutate(s);
    return hashState(s) !== hashState(base);
  };
  assert.ok(changed((s) => { s.tick++; }));
  assert.ok(changed((s) => { s.confidence -= 0.5; }));
  assert.ok(changed((s) => { s.con[5] = { k: 'hand' }; }));
  assert.ok(changed((s) => { s.con[5] = { k: 'aiHidden', mine: true, block: 0 }; }));
  assert.ok(changed((s) => { s.rng.gen = (s.rng.gen + 1) >>> 0; }));
  assert.ok(changed((s) => { s.stats.detonations++; }));
  assert.ok(changed((s) => { s.phase = { k: 'won' }; }));
  assert.ok(changed((s) => { s.users = [{ id: 0, at: 1, state: 'moving', visited: [1], stalled: false }]; }));
  assert.ok(changed((s) => { s.blocks = [{ id: 0, cells: [1, 2] }]; }));

  // A mined and an unmined hidden cell must not collide — the sim would stop seeing blasts.
  const mined = { ...base, con: base.con.slice() };
  const clean = { ...base, con: base.con.slice() };
  mined.con[9] = { k: 'aiHidden', mine: true, block: 0 };
  clean.con[9] = { k: 'aiHidden', mine: false, block: 0 };
  assert.notEqual(hashState(mined), hashState(clean));
});
