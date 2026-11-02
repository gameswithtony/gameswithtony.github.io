// @ts-check
// THE M1 GATE (PLAN §14.2) — rewritten 2026-11-02 for the twelve-level campaign.
//
// M1 always meant one thing: the loop runs end to end, headless, and somebody gets served. Since
// 2026-11-02 a level also states a goal, and the campaign carries three rules every level is
// tuned against (src/sim/report.js prints them for the whole corpus). This file pins all of it on
// level 1, deterministically, with fixed seeds:
//
//   · the expert bot clears the level, using Generate, Place and Beta on the way;
//   · hand-only play never reaches the goal (generated blocks are necessary);
//   · the expert with its betas taken away mostly fails (a beta is necessary).
//
// (Rewritten 2026-08-06 for `tutorial`, which is now a test fixture. Its two assertions had been
// failing since the owner's own tutorial refinements; the campaign replaced the level instead.)
import test from 'node:test';
import assert from 'node:assert/strict';

import { init, reduce } from '../src/core/reduce.js';
import { makePolicy } from '../src/sim/policies.js';
import { getLevel, levelIds } from '../src/levels/index.js';

/** A game that runs this long has hung; the policies all terminate well inside it. */
const GUARD = 400;
const SEEDS = [1, 2, 3, 4, 5, 6];

/**
 * @param {import('../src/levels/index.js').LevelDef} def
 * @param {string} spec
 * @param {number} seed
 * @returns {import('../src/core/state.js').GameState}
 */
function play(def, spec, seed) {
  const bot = makePolicy(spec, seed);
  let s = init(def, seed);
  for (let guard = 0; guard < GUARD * 4; guard++) {
    if (s.phase.k !== 'play' && s.phase.k !== 'placing') return s;
    if (s.tick > GUARD) break;
    const r = reduce(s, bot.act(s));
    s = r.s;
    bot.observe(r.ev);
  }
  throw new Error(`${spec} @ ${seed} never terminated`);
}

const first = () => getLevel(levelIds()[0]);

test('THE M1 GATE: the expert clears level 1 headless, with every build verb', () => {
  const level = first();
  const games = SEEDS.map((seed) => ({ seed, s: play(level, 'expert', seed) }));
  for (const { seed, s } of games) {
    assert.equal(s.stats.served + s.stats.lost, s.schedule.total, `seed ${seed}: unresolved users`);
    assert.ok(s.stats.generated > 0, `seed ${seed}: nothing was generated`);
    assert.ok(s.stats.placed > 0, `seed ${seed}: nothing was placed by hand`);
    assert.ok(s.stats.betas > 0, `seed ${seed}: no beta shipped`);
  }
  const won = games.filter((g) => g.s.phase.k === 'won').length;
  assert.ok(won >= 5, `only ${won} of ${SEEDS.length} seeds cleared level 1`);
});

test('THE FLOOR: hand-only play never reaches the goal on level 1', () => {
  const level = first();
  for (const seed of SEEDS.slice(0, 3)) {
    const s = play(level, 'handOnly', seed);
    assert.equal(s.phase.k, 'lost', `seed ${seed} was not a loss`);
    assert.equal(s.stats.generated, 0, 'hand-only');
    assert.ok(s.stats.served < level.goal, `seed ${seed} reached the goal by hand`);
  }
});

test('THE BETA RULE: without betas the expert mostly fails level 1', () => {
  const level = { ...first(), betaSupply: 0 };
  const won = SEEDS.filter((seed) => play(level, 'expert', seed).phase.k === 'won').length;
  assert.ok(won <= 2, `the expert cleared level 1 without a beta on ${won} of ${SEEDS.length} seeds`);
});

test('every campaign level states a goal, a story and a beta supply', () => {
  for (const id of levelIds()) {
    const def = getLevel(id);
    assert.ok(def.goal >= 2, `${id}: goal ${def.goal}`);
    assert.ok(def.betaSupply >= 1, `${id}: needs at least one beta`);
    assert.ok(typeof def.story === 'string', `${id}: story`);
  }
});
