// Hill-climb AI weights by self-play: candidate vs current, paired seeds with swapped seats.
// node sim/tune.js --iters 40 --games 60 [--players 2] [--from sim/tuned.json] [--out sim/tuned.json]
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { readFileSync, writeFileSync, existsSync, appendFileSync } from 'node:fs';
import os from 'node:os';
import { playGame } from './game.js';
import { BASE } from '../engine/ai.js';

if (!isMainThread) {
    const { jobs } = workerData;
    for (const j of jobs) parentPort.postMessage({ id: j.id, cand: j.cand, rec: playGame({ seed: j.seed, personas: j.personas }) });
    process.exit(0);
}

const a = process.argv.slice(2);
const get = (k, d) => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : d; };
const iters = +get('iters', 30), games = +get('games', 60);
const playerCounts = String(get('players', '2')).split(',').map(Number);
const outFile = get('out', 'sim/tuned.json'), logFile = outFile.replace('.json', '.log');
const workers = Math.max(1, os.cpus().length - 1);

// tunable parameters: [path, step, min, max]
const PARAMS = [
    ['pSellReady', 0.05, 0.5, 1], ['pRouteNoBeer', 0.08, 0.1, 0.9], ['pRailLater', 0.08, 0.1, 0.9],
    ['pByLinks.1', 0.08, 0.1, 0.95], ['pByLinks.2', 0.07, 0.05, 0.8], ['pByLinks.3', 0.05, 0, 0.6],
    ['coalRate.0', 0.15, 0.1, 2], ['coalRate.1', 0.2, 0.2, 3], ['ironRate.0', 0.15, 0.1, 2], ['ironRate.1', 0.15, 0.1, 2],
    ['beerBase.0', 0.03, 0, 0.4], ['beerBase.1', 0.08, 0, 1],
    ['moneyRate.0', 0.05, 0.1, 0.8], ['moneyRate.1', 0.05, 0.1, 0.8], ['incomeDiscount', 0.1, 0.3, 1.2],
    ['spendPerAction', 3, 4, 30], ['poorBoost', 0.15, 0, 1.5], ['shortfallRate', 0.25, 0.2, 3], ['shortfallHorizon', 1, 1, 10],
    ['matW', 0.1, 0, 1.5], ['interest.0', 0.15, 0, 2], ['interest.1', 0.15, 0, 2], ['interest.2', 0.15, 0, 2],
    ['interest.3', 0.15, 0, 2], ['interest.4', 0.15, 0, 2], ['interest.5', 0.15, 0, 2],
    ['handW', 0.04, 0, 0.5], ['orderW', 0.4, 0, 4], ['linkBias', 0.05, -0.3, 0.5],
    ['incomeGrowth', 0.4, 0, 4], ['flipSlack', 1, 1, 6], ['laBlend', 0.1, 0, 1], ['lookahead', 2, 2, 10],
];
const getP = (w, path) => { const [k, i] = path.split('.'); return i === undefined ? w[k] : w[k][+i]; };
const setP = (w, path, v) => { const [k, i] = path.split('.'); if (i === undefined) w[k] = v; else { w[k] = w[k].slice(); w[k][+i] = v; } };
const round = x => Math.round(x * 1000) / 1000;

let current = existsSync(get('from', '')) ? JSON.parse(readFileSync(get('from'), 'utf8')) : JSON.parse(JSON.stringify(BASE));
delete current.temperature;

/** Play `games` games (paired seeds, swapped seats) of cand vs base. Returns mean margin and win rate for cand. */
async function match(cand, base, seed0) {
    const jobs = [];
    for (let g = 0; g < games; g++) {
        const pair = Math.floor(g / 2);
        const seed = seed0 + pair;
        const players = playerCounts[pair % playerCounts.length];
        const candSeat = g % 2 === 0 ? 0 : players - 1; // same seed, candidate in first vs last seat
        const personas = Array.from({ length: players }, (_, i) => i === candSeat ? cand : base);
        jobs.push({ id: g, seed, personas, cand: candSeat });
    }
    const results = [];
    await Promise.all(Array.from({ length: workers }, (_, wi) => new Promise((res, rej) => {
        const mine = jobs.filter((_, i) => i % workers === wi);
        if (!mine.length) return res();
        const wk = new Worker(new URL(import.meta.url), { workerData: { jobs: mine } });
        wk.on('message', m => results.push(m)); wk.on('error', rej); wk.on('exit', res);
    })));
    let margin = 0, wins = 0;
    for (const { cand: c, rec } of results) {
        const others = rec.vp.filter((_, i) => i !== c);
        margin += rec.vp[c] - others.reduce((a, b) => a + b, 0) / others.length; // vs rivals' mean (max is biased in 3p)
        if (rec.rank[0] === c) wins++;
    }
    return { margin: margin / results.length, win: wins / results.length };
}

let seed = +get('seed', 1000);
appendFileSync(logFile, `\n# tune start ${new Date().toISOString()} players=${playerCounts} games=${games}\n`);
const wins = n => 1 / n; // expected win share for an equal player
for (let it = 0; it < iters; it++) {
    const cand = JSON.parse(JSON.stringify(current));
    const changes = [];
    const k = Math.random() < 0.3 ? 2 : 1;
    for (let j = 0; j < k; j++) {
        const [path, step, lo, hi] = PARAMS[Math.floor(Math.random() * PARAMS.length)];
        const old = getP(cand, path);
        const nv = round(Math.min(hi, Math.max(lo, old + (Math.random() < 0.5 ? -1 : 1) * step)));
        if (nv !== old) { setP(cand, path, nv); changes.push(`${path} ${old}->${nv}`); }
    }
    if (!changes.length) { it--; continue; }
    const r = await match(cand, current, seed);
    seed += games;
    const share = playerCounts.reduce((a, n) => a + wins(n), 0) / playerCounts.length;
    let accept = r.margin > 1.5 && r.win > share + 0.03;
    let line = `${it}: ${changes.join(', ')}  margin ${r.margin.toFixed(1)}  win ${(100 * r.win).toFixed(0)}% (even ${(100 * share).toFixed(0)}%)`;
    if (accept) {
        // confirm on fresh seeds before keeping it (noise control)
        const c = await match(cand, current, seed + 500000);
        seed += games;
        accept = c.margin > 0.5 && c.win > share;
        line += `  confirm margin ${c.margin.toFixed(1)} win ${(100 * c.win).toFixed(0)}%  ${accept ? 'ACCEPT' : 'rejected on confirm'}`;
    }
    console.log(line); appendFileSync(logFile, line + '\n');
    if (accept) { current = cand; writeFileSync(outFile, JSON.stringify(current, null, 1)); }
}
writeFileSync(outFile, JSON.stringify(current, null, 1));
console.log('done ->', outFile);
