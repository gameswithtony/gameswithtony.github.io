// @ts-check
// A worker-thread pool for sim cells (2026-11-02). report.js and tune.js both fan a grid of
// (level, overrides, policy) cells out over every core; this is the one place that does it.
// Node-only. Each result carries the full served histogram, so a goal can be chosen after the
// fact without re-running anything.

import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { cpus } from 'node:os';
import { fileURLToPath } from 'node:url';
import { runGames } from './batch.js';
import { getLevel } from '../levels/index.js';

/**
 * @typedef {object} Cell
 * @property {string} level
 * @property {string} key                      caller's label for this cell
 * @property {string} policy
 * @property {Record<string, unknown>} [over]  fields merged over the level definition
 */

/**
 * @typedef {object} CellResult
 * @property {string} level
 * @property {string} key
 * @property {number[]} hist     hist[k] = games that served exactly k users
 * @property {number} total      users scheduled
 * @property {number} betas      mean betas shipped
 * @property {number} killed
 * @property {number} gaveUp
 * @property {number} ticks      mean game length
 * @property {number} firstServed  median turn of the first arrival (winning games), -1 if none
 * @property {number} handStreak   mean over games of the longest run of hand placements
 * @property {number} handShare    mean share of busy turns spent placing by hand
 * @property {number} closeCalls   mean users per game served with two turns or fewer to spare
 */

/**
 * Share of games that served at least `goal` users.
 * @param {CellResult} r
 * @param {number} goal
 */
export function winAt(r, goal) {
  let n = 0;
  let won = 0;
  r.hist.forEach((c, k) => { n += c; if (k >= goal) won += c; });
  return n ? won / n : 0;
}

/** @param {CellResult} r */
export function servedShare(r) {
  let n = 0;
  let sum = 0;
  r.hist.forEach((c, k) => { n += c; sum += c * k; });
  return n && r.total ? sum / n / r.total : 0;
}

/** @param {number[]} xs */
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

if (!isMainThread && workerData?.poolCells) {
  /** @type {{ poolCells: Cell[], games: number, seed: number }} */
  const { poolCells, games, seed } = workerData;
  for (const c of poolCells) {
    const def = { ...getLevel(c.level), ...(c.over ?? {}) };
    const st = runGames(def, c.policy, games, seed, { solver: false });
    const total = st.games_[0]?.total ?? 0;
    const hist = new Array(total + 1).fill(0);
    for (const g of st.games_) hist[g.served]++;
    const firsts = st.games_.map((g) => g.firstServedTick).filter((t) => t >= 0).sort((a, b) => a - b);
    /** @type {CellResult} */
    const r = {
      level: c.level, key: c.key, hist, total, betas: st.verbs.betas,
      killed: st.killedPerGame, gaveUp: st.gaveUpPerGame, ticks: st.meanTicks,
      firstServed: firsts.length ? firsts[firsts.length >> 1] : -1,
      handStreak: mean(st.games_.map((g) => g.handStreak)),
      handShare: mean(st.games_.map((g) => g.handShare)),
      closeCalls: mean(st.games_.map((g) => g.closeCalls)),
    };
    parentPort?.postMessage(r);
  }
}

/**
 * @param {Cell[]} cells
 * @param {number} games
 * @param {number} seed
 * @returns {Promise<Map<string, CellResult>>} keyed `${level}|${key}`
 */
export async function runCells(cells, games, seed) {
  const n = Math.max(1, Math.min(cpus().length, cells.length));
  /** @type {Cell[][]} */
  const buckets = Array.from({ length: n }, () => []);
  cells.forEach((c, i) => buckets[i % n].push(c));
  /** @type {Map<string, CellResult>} */
  const out = new Map();
  await Promise.all(buckets.map((b) => new Promise((resolve, reject) => {
    const w = new Worker(fileURLToPath(import.meta.url), { workerData: { poolCells: b, games, seed } });
    w.on('message', (r) => out.set(`${r.level}|${r.key}`, r));
    w.on('error', reject);
    w.on('exit', resolve);
  })));
  return out;
}
