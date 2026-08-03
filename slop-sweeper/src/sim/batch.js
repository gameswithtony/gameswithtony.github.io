// @ts-check
// The batch runner (PLAN §13). Pure and environment-agnostic on purpose: no `process`, no
// `fs`, no DOM. `run.js` wraps it for Node and the Level Lab (§9.2) imports the same
// function to quick-sim a pasted map in the browser.

import { RULES } from '../core/rules.js';
import { init, reduce } from '../core/reduce.js';
import { solve } from '../core/solver.js';
import { makePolicy } from './policies.js';

/** @typedef {import('../core/state.js').GameState} GameState */
/** @typedef {import('../core/state.js').Ev} Ev */
/** @typedef {import('../levels/index.js').LevelDef} LevelDef */
/** @typedef {import('./policies.js').Bot} Bot */

/** A game this long is a loss by definition — policies must terminate (PLAN §13). */
export const MAX_TICKS = 400;

/**
 * @typedef {object} GameResult
 * @property {number} seed
 * @property {boolean} won
 * @property {number} ticks
 * @property {number} confidence
 * @property {number} detonations
 * @property {number} waitingIntegral   Σ over ticks of the number of users waiting
 * @property {{ placed: number, generated: number, analyzed: number, waited: number }} verbs
 * @property {number} served
 * @property {number} refunds
 * @property {boolean} guessForced      deduction was impossible at some sampled moment
 * @property {boolean} bailed           the solver gave up on a component at some point
 * @property {number} rejects           should always be 0; a non-zero column means a bot bug
 */

/**
 * @typedef {object} BatchStats
 * @property {string} level
 * @property {string} policy
 * @property {number} games
 * @property {number} seed
 * @property {number} winRate
 * @property {number} medianWinTicks
 * @property {number} meanTicks
 * @property {number} meanConfidence
 * @property {number} meanWinConfidence
 * @property {number} detonationsPerGame
 * @property {number} waitingPerGame
 * @property {number} refundsPerGame
 * @property {{ placed: number, generated: number, analyzed: number, waited: number }} verbs
 * @property {number} guessForcedRate
 * @property {number} bailedRate
 * @property {number} rejects
 * @property {GameResult[]} games_
 */

/**
 * @param {LevelDef} def
 * @param {string | ((seed: number) => Bot)} policy   a policy spec or a bot factory
 * @param {number} seed
 * @param {{ solver?: boolean, maxTicks?: number }} [opts]
 * @returns {GameResult}
 */
export function runGame(def, policy, seed, opts = {}) {
  const solver = opts.solver ?? true;
  const maxTicks = opts.maxTicks ?? MAX_TICKS;
  const bot = typeof policy === 'string' ? makePolicy(policy, seed) : policy(seed);

  let s = init(def, seed);
  let waitingIntegral = 0;
  let refunds = 0;
  let rejects = 0;
  let guessForced = false;
  let bailed = false;
  let stalls = 0;

  while (s.phase.k === 'play' || s.phase.k === 'placing') {
    if (s.tick >= maxTicks) break;
    const before = s.tick;
    const beforePhase = s.phase.k;
    const action = bot.act(s);
    const r = reduce(s, action);
    s = r.s;
    bot.observe(r.ev);

    for (const e of r.ev) {
      if (e.t === 'generateRefunded') refunds++;
      else if (e.t === 'rejected') rejects++;
      // The drain is WAIT_DRAIN_PER_USER per waiting user, so the event carries the count.
      else if (e.t === 'confidence' && e.reason === 'waiting') {
        waitingIntegral += Math.round(-e.delta / RULES.WAIT_DRAIN_PER_USER);
      }
    }

    // Sampled after the verbs that change what is knowable (PLAN §13).
    if (solver && !guessForced && (action.t === 'placeBlock' || action.t === 'analyze')) {
      const sol = solve(s);
      bailed = bailed || sol.bailed;
      guessForced = guessForced || sol.guessForced;
    }

    // Generate and a refund both leave the clock alone by design, so "no tick" is not a
    // stall — "no tick and no phase change" is. A bot that does that repeatedly is broken,
    // and the batch stops rather than spinning; `rejects` in the table says so.
    stalls = (s.tick === before && s.phase.k === beforePhase) ? stalls + 1 : 0;
    if (stalls > 32) break;
  }

  return {
    seed,
    won: s.phase.k === 'won',
    ticks: s.tick,
    confidence: s.confidence,
    detonations: s.stats.detonations,
    waitingIntegral,
    verbs: {
      placed: s.stats.placed,
      generated: s.stats.generated,
      analyzed: s.stats.analyzed,
      waited: s.stats.waited,
    },
    served: s.stats.served,
    refunds,
    guessForced,
    bailed,
    rejects,
  };
}

/**
 * @param {LevelDef} def
 * @param {string | ((seed: number) => Bot)} policy
 * @param {number} n
 * @param {number} seed
 * @param {{ solver?: boolean, maxTicks?: number }} [opts]
 * @returns {BatchStats}
 */
export function runGames(def, policy, n, seed, opts = {}) {
  /** @type {GameResult[]} */
  const games = [];
  for (let i = 0; i < n; i++) {
    // Odd multiplier so consecutive batch seeds never share low bits with each other.
    games.push(runGame(def, policy, ((seed + i * 0x9e3779b1) >>> 0), opts));
  }

  const wins = games.filter((g) => g.won);
  /** @param {number[]} xs */
  const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

  return {
    level: def.id,
    policy: typeof policy === 'string' ? policy : 'custom',
    games: n,
    seed,
    winRate: n ? wins.length / n : 0,
    medianWinTicks: median(wins.map((g) => g.ticks)),
    meanTicks: mean(games.map((g) => g.ticks)),
    meanConfidence: mean(games.map((g) => g.confidence)),
    meanWinConfidence: mean(wins.map((g) => g.confidence)),
    detonationsPerGame: mean(games.map((g) => g.detonations)),
    waitingPerGame: mean(games.map((g) => g.waitingIntegral)),
    refundsPerGame: mean(games.map((g) => g.refunds)),
    verbs: {
      placed: mean(games.map((g) => g.verbs.placed)),
      generated: mean(games.map((g) => g.verbs.generated)),
      analyzed: mean(games.map((g) => g.verbs.analyzed)),
      waited: mean(games.map((g) => g.verbs.waited)),
    },
    guessForcedRate: n ? games.filter((g) => g.guessForced).length / n : 0,
    bailedRate: n ? games.filter((g) => g.bailed).length / n : 0,
    rejects: games.reduce((a, g) => a + g.rejects, 0),
    games_: games,
  };
}

/**
 * @param {number[]} xs
 * @returns {number} 0 when empty — callers read it beside a win rate, which says why
 */
export function median(xs) {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
