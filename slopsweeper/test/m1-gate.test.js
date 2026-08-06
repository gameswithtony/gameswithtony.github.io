// @ts-check
// THE M1 GATE (PLAN §14.2) — rewritten 2026-08-06.
//
// It used to read: *a scripted **hand-only** playthrough of `plain` completes headless in Node*,
// and it asserted that hand tiles alone reached phase `won` with 8 of 9 users served. That
// premise is now forbidden by design. The owner's rule (2026-08-06) is that every level must make
// generated blocks **necessary** — hand-only play must not be able to serve most walkers — and
// `plain` was renamed and rebuilt as `tutorial` for exactly that reason. A gate asserting the
// opposite would have been a test pinning the property the redesign deleted, and it would have
// gone red the moment the level landed. (It did: the old assertion failed against `plain`'s own
// last tuning pass before this file was touched.)
//
// M1 always meant one thing — **the loop runs end to end, headless, and somebody gets served** —
// and that is what this file gates now, with the build the level is actually written for:
//
//   · a competent generating policy, on four fixed seeds, finishes `tutorial` in phase `won`,
//     having spent all four build verbs on the way — Generate, Place, Analyze and Beta; and
//   · `handOnly` on those same seeds finishes `lost` with nobody delivered — the floor property
//     written down as a test rather than left in a sim table.
//
// Both halves are deterministic rather than statistical: `makePolicy` draws from its own seeded
// stream and `reduce` is pure, so a (policy, seed) pair is a recording that plays back the same
// way every time. Four fixed seeds, ~250 ticks in all, which is what keeps the gate a gate.
//
// **What it asserts about those recordings is deliberately shape-blind**, and that is a
// considered choice rather than a shrug. Which stencils `Generate` can draw is a live tuning
// surface — `src/core/shapes.js` grew from twelve stencils to twenty on 2026-08-06 — and every
// exact count a generating playthrough produces (blocks drawn, tiles placed, users delivered)
// moves when that table moves. A gate pinned to "seed 1 serves exactly three" would go red on a
// shape-pool edit that broke nothing, which is a gate that trains people to edit the gate. So the
// AI half asserts the *properties* M1 is actually about — it terminates, it wins, it used the
// verbs — over a small fixed set of seeds, and the floor half, which never generates and is
// therefore immune to all of it, asserts exact numbers.
import test from 'node:test';
import assert from 'node:assert/strict';

import { cellXY } from '../src/core/grid.js';
import { init, reduce } from '../src/core/reduce.js';
import { makePolicy } from '../src/sim/policies.js';
import { getLevel } from '../src/levels/index.js';

/** A game that runs this long has hung; the policies all terminate well inside it. */
const GUARD = 400;

/**
 * Play one game to the end and hand back the final state — the same loop `src/sim/batch.js`
 * runs, minus the statistics, because what this file wants to look at is the board.
 * @param {import('../src/levels/index.js').LevelDef} def
 * @param {string} spec
 * @param {number} seed
 * @returns {import('../src/core/state.js').GameState}
 */
function play(def, spec, seed) {
  const bot = makePolicy(spec, seed);
  let s = init(def, seed);
  for (let guard = 0; guard < GUARD; guard++) {
    if (s.phase.k !== 'play' && s.phase.k !== 'placing') return s;
    const r = reduce(s, bot.act(s));
    s = r.s;
    bot.observe(r.ev);
  }
  throw new Error(`${spec} @ ${seed} never terminated`);
}

test('THE M1 GATE: an AI playthrough of tutorial completes headless and wins', () => {
  const level = getLevel('tutorial');
  assert.equal(level.arrivals.count, 9);

  // The board this gate has always described, plus the destination the 2026-08-06 redesign added.
  const s0 = init(level, 1);
  assert.equal(s0.w, 32);
  assert.equal(s0.h, 20);
  const a = cellXY(s0, s0.origin);
  const b = cellXY(s0, s0.dests[0]);
  const c = cellXY(s0, s0.dests[1]);
  assert.equal(a.y, b.y, 'the trunk still runs straight across');
  assert.equal(c.x, b.x, 'and C hangs off the same wall');
  assert.equal(c.y - b.y, 6, 'six rows below it — the late fork');

  // `balanced-beta:0.4` is the shape of play the level is written for: generate about half the
  // time, read what you generated, and ship a milestone when the queue starts hurting. It clears
  // `tutorial` on roughly two seeds in three, so four fixed seeds failing together would be a
  // real regression rather than a bad day.
  const games = [1, 2, 9, 12].map((seed) => ({ seed, s: play(level, 'balanced-beta:0.4', seed) }));

  for (const { seed, s } of games) {
    assert.equal(s.users.length, level.arrivals.count, `seed ${seed}: not everyone spawned`);
    assert.equal(s.stats.served + s.stats.lost, level.arrivals.count, `seed ${seed}: unresolved users`);
    assert.equal(s.users.every((u) => u.state === 'arrived' || u.state === 'gone'), true);
    assert.ok(s.tick < GUARD, `seed ${seed} finished in ${s.tick} ticks`);
    // The half of the gate that is about the *game* rather than the runtime: this level cannot
    // be won by placing tiles, so a playthrough that reached the end without generating and
    // reading has not exercised what M1 is for.
    assert.ok(s.stats.generated > 0, `seed ${seed}: nothing was generated`);
    assert.ok(s.stats.placed > 0, `seed ${seed}: nothing was placed by hand`);
    assert.ok(s.stats.analyzed > 0, `seed ${seed}: nothing was reviewed`);
  }

  const won = games.filter((g) => g.s.phase.k === 'won');
  assert.ok(won.length >= 3, `only ${won.length} of 4 seeds reached 'won'`);
  const served = games.reduce((n, g) => n + g.s.stats.served, 0);
  assert.ok(served >= 4, `four games delivered only ${served} users between them`);
  // And the third build verb, which the level stocks two of and the policy spends under
  // pressure. Asked of the set rather than of one game: whether a given seed gets pressed hard
  // enough to want a beta is the seed's business.
  assert.ok(games.some((g) => g.s.stats.betas > 0), 'not one beta was shipped in four games');
  assert.ok(games.some((g) => g.s.stats.detonations > 0),
    'generated ground never went off — that is the trade this level is made of');
});

test('THE FLOOR: hand-only play of tutorial delivers nobody, on any of those seeds', () => {
  // The other half of the owner's rule, and the reason the gate above cannot be a hand build.
  // Thirty tiles separate A from B, so a hand-only game opens the route on turn 30 — and the last
  // of the nine spawns on turn 21 with eight ticks of goodwill, so it walks out on turn 29. The
  // game is over one turn before the road exists. Not a near miss and not seed luck: the schedule
  // is written to finish before the build can, which is what the level is for.
  const level = getLevel('tutorial');
  for (const seed of [1, 2, 9]) {
    const s = play(level, 'handOnly', seed);
    assert.equal(s.phase.k, 'lost', `seed ${seed} was not a loss`);
    assert.equal(s.stats.served, 0, `seed ${seed} delivered somebody by hand`);
    assert.equal(s.stats.generated, 0, 'hand-only');
    assert.equal(s.stats.detonations, 0, 'nothing was generated, so nothing blew up');
    assert.equal(s.stats.lost, level.arrivals.count, 'every user gave up');
  }
});
