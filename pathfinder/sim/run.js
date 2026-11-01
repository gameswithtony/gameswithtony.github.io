// Headless random-play: plays N full games answering every prompt at random.
// Usage: node sim/run.js [games=200] [seed=1]
import { newGame, answer, choices, scoreBreakdown, YOU, PF } from '../js/engine.js';

const N = +(process.argv[2] || 200);
const SEED = +(process.argv[3] || 1);
const POLICY = process.argv[4] || 'random'; // random | builder
const PREF = ['construct', 'upgrade', 'ship', 'hire', 'blueprint', 'rnd', 'tech', 'control', 'resupply'];
let rs = SEED;
const rnd = () => (rs = (rs * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

/** Prefer ending a turn sometimes, and taking real actions over "done". */
function choose(pr) {
    const cs = choices(pr);
    if (!cs.length) throw new Error('no choices for ' + JSON.stringify(pr).slice(0, 300));
    if (pr.kind === 'menu' && POLICY === 'builder') {
        const ex = cs.filter(c => c.a === 'exec' || c.a === 'goal');
        if (ex.length && rnd() < 0.7) return ex[Math.floor(rnd() * ex.length)];
        for (const k of PREF) { const m = cs.find(c => c.a === 'main' && c.k === k); if (m && rnd() < 0.75) return m; }
    }
    if (pr.kind === 'menu') {
        const end = cs.find(c => c.a === 'end');
        if (end && rnd() < 0.6) return end;
        const mains = cs.filter(c => c.a === 'main');
        if (mains.length && rnd() < 0.8) return mains[Math.floor(rnd() * mains.length)];
    }
    if (cs.length > 1 && cs.includes('done') && rnd() < 0.7) {
        const real = cs.filter(c => c !== 'done' && c !== 'back');
        if (real.length) return real[Math.floor(rnd() * real.length)];
    }
    return cs[Math.floor(rnd() * cs.length)];
}

const stats = { games: 0, rounds: 0, you: 0, pf: 0, level: 0, wins: 0, steps: 0, levels: [0, 0, 0, 0, 0, 0] };
for (let g = 0; g < N; g++) {
    const opts = { seed: SEED * 1000 + g + (POLICY === 'builder' ? 500000 : 0), difficulty: ['rookie', 'chief', 'legend'][g % 3], length: g % 2 ? 'long' : 'short' };
    let st = newGame(opts);
    let steps = 0;
    try {
        while (!st.over) {
            if (++steps > 6000) throw new Error('game did not finish');
            const v = choose(st.prompt);
            st = answer(JSON.parse(JSON.stringify(st)), v);
            check(st);
        }
    } catch (e) {
        console.error(`GAME ${g} (seed ${opts.seed}) step ${steps}: ${e.stack}`);
        console.error('prompt:', JSON.stringify(st.prompt)?.slice(0, 400));
        console.error('stack:', JSON.stringify(st.stack.map(t => t.t + ':' + t.s)));
        console.error('last log:', st.log.slice(-8).map(l => `${l.w} ${l.k} ${l.text}`).join(' | '));
        process.exit(1);
    }
    stats.games++; stats.rounds += st.round; stats.steps += steps;
    const a = scoreBreakdown(st, YOU, true).total, b = scoreBreakdown(st, PF, true).total;
    stats.you += a; stats.pf += b; stats.wins += a >= b ? 1 : 0; stats.levels[st.level]++;
}
console.log(`${stats.games} games ok · avg rounds ${(stats.rounds / N).toFixed(1)} · avg steps ${(stats.steps / N).toFixed(0)}`);
console.log(`avg score random-you ${(stats.you / N).toFixed(1)} vs Pathfinder ${(stats.pf / N).toFixed(1)} · random wins ${stats.wins}`);
console.log(`final colony levels ${JSON.stringify(stats.levels)}`);

/** Invariants that must always hold. */
function check(st) {
    const p = st.p[YOU];
    const onSlots = Object.values(st.slots).flat().filter(o => o === YOU).length;
    const onMines = Object.values(st.hex).filter(x => x.b && x.b.col === YOU).length;
    const total = p.col.lq + p.col.wa + p.col.sup + onSlots + onMines;
    if (total !== 12) throw new Error(`colonists ${total} != 12 ${JSON.stringify(p.col)} slots ${onSlots} mines ${onMines}`);
    for (const k in p.res) if (p.res[k] < 0) throw new Error('negative ' + k);
    if (p.cr < 0) throw new Error('negative crystals');
    if (p.col.lq < 0 || p.col.wa < 0 || p.col.sup < 0) throw new Error('negative colonists');
    const seen = new Set();
    for (const b of st.bots) { if (seen.has(b.h)) throw new Error('two bots on ' + b.h); seen.add(b.h); }
    if (st.rover && seen.has(st.rover)) throw new Error('rover shares hex with bot ' + st.rover);
    for (const k in st.slots) if (k !== 'hire' && st.slots[k].length > 3) throw new Error('slot overflow ' + k);
    for (const w in st.ware) if (st.ware[w] < 0) throw new Error('warehouse negative ' + w);
}
