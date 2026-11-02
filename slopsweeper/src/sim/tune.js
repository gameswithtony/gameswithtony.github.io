// @ts-check
// THE TUNER (2026-11-02). Sweeps one level's pressure dials, runs the design report's cells for
// every combination, picks the best goal for each from the served histograms, and prints the
// combinations closest to where this level sits in the campaign arc.
//
//   node src/sim/tune.js --level tutorial --patience 5,6,7 --first 4,6 --every 1,2 \
//        --betas 1,2 --win 0.9 --need 1 --games 100
//
// Lists are comma-separated; anything not given keeps the level's own value. `--win` is the
// expert clear rate this slot in the arc wants and `--need` the betas it should need.

import { runCells } from './pool.js';
import { levelCells, problemsOf, summarise } from './report.js';
import { getLevel } from '../levels/index.js';
import { arrivalCount } from '../core/casting.js';

const args = process.argv.slice(2);
/** @type {Record<string, string>} */
const opt = {};
for (let i = 0; i < args.length; i += 2) opt[args[i].replace(/^--/, '')] = args[i + 1];
const id = opt.level;
if (!id) throw new Error('--level is required');
const def = getLevel(id);
/** @param {string | undefined} s @param {number[]} dflt */
const list = (s, dflt) => (s ? s.split(',').map(Number) : dflt);
const cad = def.arrivals.at ? null : def.arrivals;
const patiences = list(opt.patience, [def.patience]);
const firsts = list(opt.first, cad ? [cad.firstTick] : [-1]);
const everys = list(opt.every, cad ? [cad.every] : [-1]);
const counts = list(opt.count, [arrivalCount(def.arrivals)]);
const supplies = list(opt.betas, [def.betaSupply]);
const densities = list(opt.density, [def.mineDensity]);
const refills = list(opt.refill, [def.destRefill]);
const radii = list(opt.radius, [def.blastRadius]);
const games = Number(opt.games ?? 100);
const seed = Number(opt.seed ?? 1);
const wantWin = Number(opt.win ?? 0.8);
const wantNeed = Number(opt.need ?? 1);

// `--at "4,5,6;3,4,5,9"` sweeps explicit arrival lists instead of the cadence dials.
const ats = opt.at ? opt.at.split(';').map((x) => x.split(',').map(Number)) : null;

/** @type {{ key: string, over: Record<string, unknown> }[]} */
const combos = [];
if (ats) for (const patience of patiences) for (const at of ats) for (const betaSupply of supplies) for (const mineDensity of densities) for (const destRefill of refills) for (const blastRadius of radii) {
  combos.push({ key: `p${patience} at${at[0]}..${at[at.length - 1]}/${at.length} β${betaSupply} d${mineDensity} r${destRefill} b${blastRadius}`,
    over: { patience, betaSupply, mineDensity, destRefill, blastRadius, arrivals: { at } } });
}
if (!ats) for (const patience of patiences) for (const firstTick of firsts) for (const every of everys)
  for (const count of counts) for (const betaSupply of supplies) for (const mineDensity of densities) for (const destRefill of refills) for (const blastRadius of radii) {
    /** @type {Record<string, unknown>} */
    const over = { patience, betaSupply, mineDensity, destRefill, blastRadius };
    if (firstTick >= 0) over.arrivals = { count, firstTick, every };
    combos.push({ key: `p${patience} f${firstTick} e${every} n${count} β${betaSupply} d${mineDensity} r${destRefill} b${blastRadius}`, over });
  }

const started = Date.now();
const cells = combos.flatMap((c) => levelCells(id, c.over, `${c.key}:`));
const res = await runCells(cells, games, seed);

/** @param {number} x */
const pct = (x) => `${Math.round(x * 100)}%`;
/** @type {{ key: string, goal: number, score: number, line: string }[]} */
const found = [];
for (const c of combos) {
  const total = arrivalCount(/** @type {any} */ (c.over.arrivals ?? def.arrivals));
  const supply = /** @type {number} */ (c.over.betaSupply);
  // `--goal all` pins the goal to the whole cast (a level that requires a perfect run).
  for (let goal = opt.goal === 'all' ? total : 1; goal <= total; goal++) {
    const m = summarise(res, id, supply, goal, `${c.key}:`);
    const probs = problemsOf(m);
    const score = 3 * Math.abs(m.expert - wantWin) + 0.5 * Math.abs(m.need - wantNeed) + 0.25 * probs.length
      + Math.max(0, m.curve[0] - 0.2);
    found.push({
      key: c.key, goal, score,
      line: `${c.key.padEnd(34)} goal ${String(goal).padStart(2)}/${total}  expert ${pct(m.expert).padStart(4)}`
        + `  β ${m.curve.map(pct).join(' ').padEnd(20)} need ${m.need}  scatter ${pct(m.scatter).padStart(4)}`
        + `  sloppy ${pct(m.sloppy).padStart(4)}  hand ${pct(m.hand).padStart(3)}  1st ${m.firstServed}`
        + `  close ${m.closeCalls.toFixed(1)}  hand ${pct(m.handShare)}/${m.handStreak.toFixed(1)}`
        + `  turns ${m.ticks.toFixed(0)}${probs.length ? `  ! ${probs.join('; ')}` : ''}`,
    });
  }
}
found.sort((a, b) => a.score - b.score);
console.log(`# tune ${id} — want expert ${pct(wantWin)}, need ${wantNeed}; ${games} games/cell\n`);
const seen = new Set();
let shown = 0;
for (const f of found) {
  if (seen.has(f.key)) continue;     // best goal per combination only
  seen.add(f.key);
  console.log(f.line);
  if (++shown >= Number(opt.top ?? 12)) break;
}
console.log(`\n_${cells.length} cells in ${((Date.now() - started) / 1000).toFixed(1)}s._`);
