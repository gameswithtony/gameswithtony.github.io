// @ts-check
// The harness itself (PLAN §13): the bots stay inside the rules, and a batch produces sane
// numbers without touching anything Node-specific.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { init, legalActions, reduce } from '../src/core/reduce.js';
import { DEFAULT_SWEEP, POLICY_NAMES, makePolicy } from '../src/sim/policies.js';
import { MAX_TICKS, runGame, runGames, median } from '../src/sim/batch.js';
import { getLevel } from '../src/levels/index.js';

/** The comments talk *about* the rules below, so they are not evidence of breaking them. */
const POLICY_CODE = readFileSync(new URL('../src/sim/policies.js', import.meta.url), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/[^\n]*/g, '');

test('no bot may read a mine (the information discipline of PLAN §13)', () => {
  // `blockPlaced.mines` is the toast the player sees, so `.mines` is fine; `.mine` is the
  // ground truth on a hidden cell and is not.
  assert.ok(POLICY_CODE.includes('blockPlaced'), 'the stripper ate the file');
  assert.equal(/\.mine\b/.test(POLICY_CODE), false, 'policies.js reads con[].mine');
  assert.equal(/solver/i.test(POLICY_CODE), false, 'policies.js reaches for the solver');
  assert.equal(/Math\.random/.test(POLICY_CODE), false, 'policies.js uses unseeded randomness');
});

test('core and sim run with no DOM in sight (SPEC §10.2)', () => {
  for (const g of ['window', 'document', 'localStorage', 'HTMLElement']) {
    assert.equal(typeof /** @type {any} */ (globalThis)[g], 'undefined', `${g} exists in this runtime`);
  }
  const st = runGames(getLevel('tutorial'), 'handOnly', 3, 1, { solver: false });
  assert.equal(st.games, 3);
});

test('every bot only ever asks for actions the reducer would allow', () => {
  for (const spec of DEFAULT_SWEEP) {
    const bot = makePolicy(spec, 4);
    let s = init(getLevel('caldera'), 4);
    let guard = 0;
    while ((s.phase.k === 'play' || s.phase.k === 'placing') && guard++ < 200) {
      const a = bot.act(s);
      const cell = /** @type {{ cell?: number }} */ (a).cell;
      const kinds = cell === undefined ? legalActions(s) : legalActions(s, cell);
      assert.ok(kinds.includes(a.t), `${spec} asked for ${a.t} which is not on offer`);
      const r = reduce(s, a);
      assert.equal(r.ev.some((e) => e.t === 'rejected'), false, `${spec} had ${a.t} rejected`);
      bot.observe(r.ev);
      s = r.s;
    }
  }
});

test('policy specs parse: names, dosages and ghost styles', () => {
  for (const name of POLICY_NAMES) assert.equal(makePolicy(name, 1).name, name);
  assert.equal(makePolicy('balanced:0.25', 1).name, 'balanced:0.25');
  assert.equal(makePolicy('balanced-edge:0.4', 1).name, 'balanced-edge:0.4');
  assert.equal(makePolicy('careful-greedy:0.9', 1).name, 'careful-greedy:0.9');
  assert.throws(() => makePolicy('reckless', 1), /unknown policy 'reckless'/);
  assert.throws(() => makePolicy('balanced:2', 1), /parameter must be in \[0, 1\]/);
});

test('SIM SMOKE: runGames(tutorial, handOnly, 5, seed) completes with sane stats', () => {
  const st = runGames(getLevel('tutorial'), 'handOnly', 5, 1);
  assert.equal(st.level, 'tutorial');
  assert.equal(st.policy, 'handOnly');
  assert.equal(st.games, 5);
  assert.equal(st.games_.length, 5);
  assert.equal(st.rejects, 0, 'a rejected bot action is a bug, not a metric');

  assert.ok(st.winRate >= 0 && st.winRate <= 1);
  assert.ok(st.meanTicks > 0 && st.meanTicks <= MAX_TICKS);
  assert.ok(st.servedFraction >= 0 && st.servedFraction <= 1, 'served fraction is the headline');
  assert.ok(st.perfectRate >= 0 && st.perfectRate <= 1);
  assert.equal(st.killedPerGame, 0, 'hand-only never generates, so nobody is ever blown up');
  assert.ok(st.gaveUpPerGame >= 0);
  assert.equal(st.detonationsPerGame, 0, 'hand-only never generates, so it never detonates');
  assert.equal(st.verbs.generated, 0);
  assert.equal(st.verbs.analyzed, 0);
  assert.ok(st.verbs.placed > 0);
  assert.ok(st.waitingPerGame >= 0);

  for (const g of st.games_) {
    assert.ok(g.ticks > 0 && g.ticks <= MAX_TICKS);
    assert.equal(typeof g.won, 'boolean');
    assert.equal(g.total, getLevel('tutorial').arrivals.count);
    assert.ok(g.served <= g.total);
    // Points economy (2026-08-04): a win is *one* arrival, not all of them. `perfect` is
    // the old bar, and it is now a separate, much rarer thing.
    assert.equal(g.won, g.served >= 1);
    assert.equal(g.perfect, g.served === g.total);
    assert.equal(g.served + g.lostGaveUp + g.lostDetonation, g.total, 'everyone is accounted for');
  }
});

test('a batch is reproducible, and its per-game seeds are spread', () => {
  const a = runGames(getLevel('atoll'), 'careful:0.4', 8, 99, { solver: false });
  const b = runGames(getLevel('atoll'), 'careful:0.4', 8, 99, { solver: false });
  assert.deepEqual(a.games_, b.games_);
  assert.equal(new Set(a.games_.map((g) => g.seed)).size, 8);

  const c = runGames(getLevel('atoll'), 'careful:0.4', 8, 100, { solver: false });
  assert.notDeepEqual(a.games_.map((g) => g.ticks), c.games_.map((g) => g.ticks));
});

test('a game always terminates, and a stuck bot is a loss rather than a hang', () => {
  const stubborn = () => ({
    name: 'stubborn',
    observe: () => {},
    act: () => /** @type {import('../src/core/state.js').Action} */ ({ t: 'generate' }),
  });
  const g = runGame(getLevel('tutorial'), stubborn, 1, { solver: false, maxTicks: 60 });
  assert.equal(g.won, false);
  assert.ok(g.ticks <= 60);
});

test('the solver instrumentation rides along without changing the game', () => {
  const withSolver = runGames(getLevel('strait'), 'balanced:0.5', 6, 5, { solver: true });
  const without = runGames(getLevel('strait'), 'balanced:0.5', 6, 5, { solver: false });
  assert.deepEqual(
    withSolver.games_.map((g) => [g.won, g.ticks, g.served]),
    without.games_.map((g) => [g.won, g.ticks, g.served]),
    'solving must never perturb play',
  );
  assert.ok(withSolver.guessForcedRate >= 0 && withSolver.guessForcedRate <= 1);
  assert.equal(without.guessForcedRate, 0, 'and it reports nothing when it is switched off');
});

test('median is the median', () => {
  assert.equal(median([]), 0);
  assert.equal(median([5]), 5);
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
});
