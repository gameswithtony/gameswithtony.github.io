// @ts-check
// The batch runner (PLAN §13). Pure and environment-agnostic on purpose: no `process`, no
// `fs`, no DOM. `run.js` wraps it for Node and the Level Lab (§9.2) imports the same
// function to quick-sim a pasted map in the browser.

import { init, reduce } from '../core/reduce.js';
import { solve } from '../core/solver.js';
import { patienceLimit } from '../core/state.js';
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
 * @property {boolean} won              at least one user reached B (points economy)
 * @property {number} served            the score
 * @property {number} total             users the level scheduled
 * @property {boolean} perfect          every scheduled user arrived
 * @property {number} ticks
 * @property {number} lostGaveUp        users who ran out of patience
 * @property {number} lostDetonation    users killed in a blast
 * @property {number} detonations
 * @property {number} waitingIntegral   Σ over users of the ticks they spent unable to move
 * @property {{ placed: number, generated: number, analyzed: number, waited: number, betas: number }} verbs
 * @property {number} firstServedTick   turn the first user arrived, -1 if nobody did
 * @property {number} handStreak        longest run of consecutive hand placements (2026-11-02)
 * @property {number} handShare         hand placements / turns spent building or reading
 * @property {number} closeCalls        users served with two turns of patience or fewer left
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
 * @property {number} winRate            share of games that served at least one user
 * @property {number} servedFraction     THE headline: mean served / scheduled
 * @property {number} perfectRate        share of games that served everybody
 * @property {number} medianWinTicks
 * @property {number} meanTicks
 * @property {number} meanServed
 * @property {number} gaveUpPerGame
 * @property {number} killedPerGame
 * @property {number} detonationsPerGame
 * @property {number} waitingPerGame
 * @property {number} refundsPerGame
 * @property {{ placed: number, generated: number, analyzed: number, waited: number, betas: number }} verbs
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
  let refunds = 0;
  let rejects = 0;
  let lostGaveUp = 0;
  let lostDetonation = 0;
  let guessForced = false;
  let bailed = false;
  let stalls = 0;
  let freeRun = 0;
  let firstServedTick = -1;
  // FUN METRICS (owner, 2026-11-02): a run of easy hand placements is a chore, and a user
  // served on their last turn of patience is the game at its best. Both are measured.
  let streak = 0;
  let handStreak = 0;
  let busy = 0;
  let closeCalls = 0;

  while (s.phase.k === 'play' || s.phase.k === 'placing') {
    if (s.tick >= maxTicks) break;
    const before = s.tick;
    const beforePhase = s.phase.k;
    const prev = s;
    const action = bot.act(s);
    const r = reduce(s, action);
    s = r.s;
    bot.observe(r.ev);

    for (const e of r.ev) {
      if (e.t === 'generateRefunded') refunds++;
      else if (e.t === 'rejected') rejects++;
      else if (e.t === 'arrived') {
        if (firstServedTick < 0) firstServedTick = s.tick;
        const u = s.users[e.user];
        if (u && patienceLimit(s, u) - u.waited <= 2) closeCalls++;
      }
      // Cause of death is not stored on the user, so book it from the event that announced
      // it — the reducer already publishes exactly the split we want to report.
      else if (e.t === 'userLost') (e.reason === 'gaveUp' ? lostGaveUp++ : lostDetonation++);
    }

    if (s.tick !== before) {
      if (action.t === 'place') { streak++; if (streak > handStreak) handStreak = streak; }
      else streak = 0;
      if (action.t !== 'wait') busy++;
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
    // A flag is free and changes the board without a tick, so "nothing moved" is judged by
    // the state object itself (a rejected or refunded action hands the same one back), with a
    // generous cap on free actions in a row as the backstop.
    stalls = (r.s === prev || (s.tick === before && s.phase.k === beforePhase && action.t !== 'flag'))
      ? stalls + 1 : 0;
    freeRun = s.tick === before ? freeRun + 1 : 0;
    if (stalls > 32 || freeRun > 400) break;
  }

  let waitingIntegral = 0;
  for (const u of s.users) waitingIntegral += u.waited;

  return {
    seed,
    won: s.phase.k === 'won',
    served: s.stats.served,
    total: s.schedule.total,
    perfect: s.stats.served === s.schedule.total,
    ticks: s.tick,
    lostGaveUp,
    lostDetonation,
    detonations: s.stats.detonations,
    waitingIntegral,
    verbs: {
      placed: s.stats.placed,
      generated: s.stats.generated,
      analyzed: s.stats.analyzed,
      waited: s.stats.waited,
      betas: s.stats.betas,
    },
    firstServedTick,
    handStreak,
    handShare: busy ? s.stats.placed / busy : 0,
    closeCalls,
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
    servedFraction: mean(games.map((g) => (g.total ? g.served / g.total : 0))),
    perfectRate: n ? games.filter((g) => g.perfect).length / n : 0,
    medianWinTicks: median(wins.map((g) => g.ticks)),
    meanTicks: mean(games.map((g) => g.ticks)),
    meanServed: mean(games.map((g) => g.served)),
    gaveUpPerGame: mean(games.map((g) => g.lostGaveUp)),
    killedPerGame: mean(games.map((g) => g.lostDetonation)),
    detonationsPerGame: mean(games.map((g) => g.detonations)),
    waitingPerGame: mean(games.map((g) => g.waitingIntegral)),
    refundsPerGame: mean(games.map((g) => g.refunds)),
    verbs: {
      placed: mean(games.map((g) => g.verbs.placed)),
      generated: mean(games.map((g) => g.verbs.generated)),
      analyzed: mean(games.map((g) => g.verbs.analyzed)),
      waited: mean(games.map((g) => g.verbs.waited)),
      betas: mean(games.map((g) => g.verbs.betas)),
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
