// @ts-check
// THE DESIGN REPORT (2026-11-02). `run.js` prints numbers; this prints verdicts. One row per
// level, measured with the expert bot (src/sim/expert.js), plus every campaign rule a level
// breaks:
//
//   · it can be cleared  — the expert reaches the goal often enough to call the level fair
//   · betas are needed   — without them the expert rarely clears it, and later levels need more
//   · the opening counts — scattering the first three blocks costs something, but not the game
//   · AI is needed       — hand-only play never reaches the goal
//   · the arc climbs     — each level is no easier than the one before it
//
//   node src/sim/report.js                      every registered level, 200 games a cell
//   node src/sim/report.js --level tutorial --games 400 --seed 7
//
// Cells run in parallel worker threads (src/sim/pool.js). Node-only, like run.js.

import { runCells, servedShare, winAt } from './pool.js';
import { getLevel, levelIds } from '../levels/index.js';
import { arrivalCount } from '../core/casting.js';

/** @typedef {import('./pool.js').Cell} Cell */
/** @typedef {import('./pool.js').CellResult} CellResult */

/** What a level must look like. Tuning targets, not rules of the game. */
export const TARGETS = Object.freeze({
  minExpertWin: 0.6,       // a strong player clears it more often than not
  maxNoBetaShare: 0.4,     // with no betas the expert clears it at most this share as often
  maxHandWin: 0.02,        // hand-only never clears it
  minOpening: 0.06,        // scattering the opening costs at least this much win rate
  maxOpening: 0.35,        // ...and no more than this
  arcSlack: 0.06,          // a level may be this much easier than the one before it
  // Mean longest run of consecutive hand placements. Four or five is probes and gap-closing,
  // which are decisions; past that it is a handwritten stretch, which is a chore.
  maxHandStreak: 5.5,
  maxHandShare: 0.4,       // share of busy turns spent placing by hand
  needSlack: 0.1,          // "needs k betas": k is the fewest within this of the full supply
});

/**
 * Win rate as a function of beta supply, and the fewest betas that get within `needSlack` of
 * the full supply's rate.
 * @param {(k: number) => number} winWith
 * @param {number} supply
 */
export function betaNeed(winWith, supply) {
  const full = winWith(supply);
  for (let k = 0; k <= supply; k++) if (winWith(k) >= full - TARGETS.needSlack) return k;
  return supply;
}

/**
 * The cells one level needs.
 * @param {string} id
 * @param {Record<string, unknown>} [over]
 * @param {string} [prefix]
 * @returns {Cell[]}
 */
export function levelCells(id, over = {}, prefix = '') {
  const def = { ...getLevel(id), ...over };
  /** @type {Cell[]} */
  const cells = [];
  for (let k = 0; k <= def.betaSupply; k++) {
    cells.push({ level: id, key: `${prefix}b${k}`, policy: 'expert', over: { ...over, betaSupply: k } });
  }
  cells.push({ level: id, key: `${prefix}scatter`, policy: 'expert-scatter3', over });
  cells.push({ level: id, key: `${prefix}sloppy`, policy: 'expert-sloppy35', over });
  cells.push({ level: id, key: `${prefix}hand`, policy: 'handOnly', over });
  return cells;
}

/**
 * Summarise one level's cells at a given goal.
 * @param {Map<string, CellResult>} res
 * @param {string} id
 * @param {number} supply
 * @param {number} goal
 * @param {string} [prefix]
 */
export function summarise(res, id, supply, goal, prefix = '') {
  /** @param {string} key */
  const get = (key) => /** @type {CellResult} */ (res.get(`${id}|${prefix}${key}`));
  const curve = [];
  for (let k = 0; k <= supply; k++) curve.push(winAt(get(`b${k}`), goal));
  const ex = get(`b${supply}`);
  return {
    expert: curve[supply],
    curve,
    need: betaNeed((k) => curve[k], supply),
    served: servedShare(ex),
    betas: ex.betas,
    ticks: ex.ticks,
    firstServed: ex.firstServed,
    scatter: winAt(get('scatter'), goal),
    sloppy: winAt(get('sloppy'), goal),
    hand: winAt(get('hand'), goal),
    failed: ex.killed,
    gaveUp: ex.gaveUp,
    handStreak: ex.handStreak,
    handShare: ex.handShare,
    closeCalls: ex.closeCalls,
  };
}

/**
 * Every rule this summary breaks, as text.
 * @param {ReturnType<typeof summarise>} m
 */
export function problemsOf(m) {
  /** @param {number} x */
  const pct = (x) => `${Math.round(x * 100)}%`;
  /** @type {string[]} */
  const out = [];
  if (m.expert < TARGETS.minExpertWin) out.push(`expert clears only ${pct(m.expert)}`);
  if (m.hand > TARGETS.maxHandWin) out.push(`hand-only clears ${pct(m.hand)}`);
  if (m.need < 1) out.push(`needs no beta (β0 ${pct(m.curve[0])})`);
  if (m.curve[0] > m.expert * TARGETS.maxNoBetaShare) out.push(`β0 still clears ${pct(m.curve[0])}`);
  const open = m.expert - m.scatter;
  if (open < TARGETS.minOpening) out.push(`opening barely matters (${pct(open)})`);
  if (open > TARGETS.maxOpening) out.push(`opening decides the game (${pct(open)})`);
  if (m.handStreak > TARGETS.maxHandStreak) out.push(`long hand runs (${m.handStreak.toFixed(1)} in a row)`);
  if (m.handShare > TARGETS.maxHandShare) out.push(`too much hand placement (${pct(m.handShare)} of turns)`);
  return out;
}

async function main() {
  const args = process.argv.slice(2);
  /** @type {string[]} */
  const levels = [];
  let games = 200;
  let seed = 1;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--level') levels.push(args[++i]);
    else if (args[i] === '--games') games = Number(args[++i]);
    else if (args[i] === '--seed') seed = Number(args[++i]);
    else throw new Error(`unknown argument '${args[i]}'`);
  }
  const all = levelIds();
  if (!levels.length) levels.push(...all);

  const started = Date.now();
  const cells = levels.flatMap((id) => levelCells(id));
  const res = await runCells(cells, games, seed);

  /** @param {number} x */
  const pct = (x) => `${Math.round(x * 100)}%`;
  const header = ['#', 'level', 'goal', 'pat', 'quiet', 'expert', 'β curve 0..S', 'need', 'βused',
    'scatter', 'sloppy', 'hand', 'served', 'failed', 'gaveUp', 'close', 'hand%', 'run', '1st', 'turns'];
  /** @type {string[][]} */
  const rows = [];
  /** @type {string[]} */
  const problems = [];
  let prev = null;
  for (const id of levels) {
    const def = getLevel(id);
    const total = arrivalCount(def.arrivals);
    const first = def.arrivals.at ? def.arrivals.at[0] : def.arrivals.firstTick;
    const m = summarise(res, id, def.betaSupply, def.goal);
    rows.push([
      String(all.indexOf(id) + 1), id, `${def.goal}/${total}`, String(def.patience), String(first),
      pct(m.expert), m.curve.map(pct).join(' '), String(m.need), m.betas.toFixed(1),
      pct(m.scatter), pct(m.sloppy), pct(m.hand), pct(m.served), m.failed.toFixed(1), m.gaveUp.toFixed(1),
      m.closeCalls.toFixed(1), pct(m.handShare), m.handStreak.toFixed(1), String(m.firstServed), m.ticks.toFixed(0),
    ]);
    for (const p of problemsOf(m)) problems.push(`${id}: ${p}`);
    if (prev) {
      if (m.expert > prev.expert + TARGETS.arcSlack) problems.push(`${id}: easier than the level before for the expert`);
      if (m.sloppy > prev.sloppy + TARGETS.arcSlack) problems.push(`${id}: easier than the level before for the sloppy expert`);
      if (m.need < prev.need) problems.push(`${id}: needs fewer betas than the level before`);
    }
    prev = m;
  }

  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  /** @param {string[]} r */
  const line = (r) => `| ${r.map((c, i) => c.padEnd(widths[i])).join(' | ')} |`;
  console.log(`# slop-sweeper design report — ${games} games/cell, seed ${seed}\n`);
  console.log(line(header));
  console.log(`| ${widths.map((w) => '-'.repeat(w)).join(' | ')} |`);
  for (const r of rows) console.log(line(r));
  console.log('\nWin columns are the share of games that reached the goal. The β curve reruns the expert'
    + ' with 0, 1, … betas; `need` is the fewest betas within 10 points of the full supply. scatter'
    + ' places its first three blocks at random; sloppy skips looking 35% of turns. `served`, `failed` (users who hit a bug),'
    + ' `gaveUp`, `close` (users served with two turns of patience or fewer left), `hand%` (share of'
    + ' busy turns spent placing by hand), `run` (longest streak of hand placements), `1st` (median'
    + ' turn of the first arrival) and `turns` are the expert with full supply.');
  console.log(problems.length ? `\n## ${problems.length} problem(s)\n\n${problems.map((p) => `- ${p}`).join('\n')}` : '\nNo problems.');
  console.log(`\n_${cells.length} cells in ${((Date.now() - started) / 1000).toFixed(1)}s._`);
}

if (/report\.js$/.test(process.argv[1] ?? '')) main();
