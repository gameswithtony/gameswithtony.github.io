// Headless AI-vs-AI harness.
// node sim/run.js --games 100 --personas balanced,cotton [--workers 6] [--seed 1] [--denial] [--out file.json]
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { writeFileSync } from 'node:fs';
import os from 'node:os';
import { playGame } from './game.js';

function args() {
    const a = process.argv.slice(2), o = {};
    for (let i = 0; i < a.length; i++) {
        if (!a[i].startsWith('--')) continue;
        const k = a[i].slice(2), v = a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true;
        o[k] = v;
    }
    return o;
}

if (!isMainThread) {
    const { seeds, personas, denial, rotate } = workerData;
    for (const seed of seeds) {
        // rotate seats so no persona keeps a seat advantage
        const k = rotate ? seed % personas.length : 0;
        const order = personas.map((_, i) => (i + k) % personas.length);
        const rec = playGame({ seed, personas: order.map(i => personas[i]), measureDenial: denial });
        rec.seatPersona = order;
        parentPort.postMessage(rec);
    }
    process.exit(0);
}

const opt = args();
const games = +(opt.games || 20);
const personas = String(opt.personas || 'balanced,balanced').split(',');
const workers = Math.min(+(opt.workers || Math.max(1, os.cpus().length - 1)), games);
const seed0 = +(opt.seed || 1);
const seeds = Array.from({ length: games }, (_, i) => seed0 + i);
const records = [];
const t0 = Date.now();

await Promise.all(Array.from({ length: workers }, (_, w) => new Promise((resolve, reject) => {
    const mine = seeds.filter((_, i) => i % workers === w);
    const wk = new Worker(new URL(import.meta.url), { workerData: { seeds: mine, personas, denial: !!opt.denial, rotate: true } });
    wk.on('message', r => { records.push(r); if (records.length % 10 === 0) process.stderr.write(`${records.length}/${games}\r`); });
    wk.on('error', reject);
    wk.on('exit', resolve);
})));

summarize(records, personas, (Date.now() - t0) / 1000);
if (opt.out) writeFileSync(opt.out, JSON.stringify(records));

function summarize(recs, personas, secs) {
    const n = personas.length;
    const stat = xs => { const s = xs.slice().sort((a, b) => a - b); const m = xs.reduce((a, b) => a + b, 0) / xs.length; return `mean ${m.toFixed(1)}  p10 ${s[Math.floor(s.length * 0.1)]}  median ${s[Math.floor(s.length / 2)]}  p90 ${s[Math.floor(s.length * 0.9)]}  min ${s[0]}  max ${s[s.length - 1]}`; };
    console.log(`\n${recs.length} games, ${n} players, ${secs.toFixed(1)}s (${(recs.reduce((a, r) => a + r.ms, 0) / recs.length / 1000).toFixed(1)}s/game cpu)`);
    const all = recs.flatMap(r => r.vp);
    console.log('All scores:   ' + stat(all));
    console.log('Winner score: ' + stat(recs.map(r => r.vp[r.rank[0]])));
    console.log('Margin 1st-2nd: ' + stat(recs.map(r => r.vp[r.rank[0]] - r.vp[r.rank[1]])));
    // by persona index (seats rotate)
    const byP = personas.map(() => ({ wins: 0, vp: [], seats: 0 }));
    for (const r of recs) r.seatPersona.forEach((pi, seat) => { byP[pi].vp.push(r.vp[seat]); if (r.rank[0] === seat) byP[pi].wins++; });
    personas.forEach((p, i) => console.log(`  [${i}] ${p.padEnd(10)} win ${(100 * byP[i].wins / recs.length).toFixed(0)}%  vp ${stat(byP[i].vp)}`));
    // seat advantage
    const seatWins = new Array(n).fill(0);
    for (const r of recs) seatWins[r.rank[0]]++;
    console.log('Wins by seat (seat 0 = first in setup list): ' + seatWins.join(' / '));
    // score breakdown
    const avg = f => (recs.flatMap(r => r.score.map(f)).reduce((a, b) => a + b, 0) / (recs.length * n)).toFixed(1);
    console.log(`Avg per player: canal links ${avg(x => x.canalLinks)}, canal tiles ${avg(x => x.canalTiles)}, rail links ${avg(x => x.railLinks)}, rail tiles ${avg(x => x.railTiles)}, bonus ${avg(x => x.bonus)}`);
    // action mix
    for (const era of ['canal', 'rail']) {
        const tot = {};
        for (const r of recs) for (const pm of r.actionMix) for (const [k, v] of Object.entries(pm[era])) tot[k] = (tot[k] || 0) + v;
        const sum = Object.values(tot).reduce((a, b) => a + b, 0);
        console.log(`Action mix ${era}: ` + Object.entries(tot).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${(100 * v / sum).toFixed(0)}%`).join(', '));
    }
    // moments per game (summed over players)
    const keys = Object.keys(recs[0].moments);
    const line = keys.map(k => {
        const per = recs.map(r => r.moments[k].reduce((a, b) => a + b, 0));
        const m = per.reduce((a, b) => a + b, 0) / recs.length;
        return `${k} ${k.startsWith('income') ? (m / n).toFixed(1) + '/player' : m.toFixed(1)}`;
    });
    console.log('Moments per game: ' + line.join(', '));
    // per persona (seats rotate)
    for (const k of ['denial', 'gift', 'bigGift', 'merchantBeer', 'loan', 'canalL2Flipped', 'canalL2Unflipped']) {
        const per = personas.map(() => 0);
        for (const r of recs) r.seatPersona.forEach((pi, seat) => { per[pi] += r.moments[k][seat]; });
        console.log(`  ${k} per game by persona: ` + personas.map((p, i) => `${p} ${(per[i] / recs.length).toFixed(2)}`).join(', '));
    }
}
