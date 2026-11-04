// Headless random play with invariants checked after every answer.
// Usage: node sim/run.js [games=200] [seed=1] [random|builder]
import { newGame, answer, choices, partCount, carCount, storeCap, deskCap, slotCap } from '../js/engine.js';
import * as D from '../js/data.js';

const N = +(process.argv[2] || 200);
const SEED = +(process.argv[3] || 1);
const POLICY = process.argv[4] || 'builder';
let rs = SEED;
const rnd = () => (rs = (rs * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const PREF = ['claim', 'upgrade', 'provide', 'design', 'collect', 'kanban', 'voucher', 'charger', 'sg', 'flip', 'book', 'train', 'recycle'];

function choose(pr) {
    const cs = choices(pr);
    if (!cs.length) throw new Error('no choices for ' + JSON.stringify(pr).slice(0, 300));
    if (pr.kind === 'menu') {
        const end = cs.find(c => c.a === 'end');
        if (POLICY === 'builder') {
            for (const k of PREF) { const m = cs.filter(c => c.a === k); if (m.length && rnd() < 0.8) return m[Math.floor(rnd() * m.length)]; }
            return end;
        }
        if (rnd() < 0.25) return end;
        const real = cs.filter(c => c.a !== 'end');
        return real.length ? real[Math.floor(rnd() * real.length)] : end;
    }
    if (pr.q === 'meet' && POLICY === 'builder') {
        const sp = cs.filter(c => c.a === 'speak' || (c.a === 'play' && c.tok));
        if (sp.length && rnd() < 0.8) return sp[Math.floor(rnd() * sp.length)];
    }
    return cs[Math.floor(rnd() * cs.length)];
}

export function check(st) {
    const parts = partCount(st);
    for (const pt of D.PARTS) if (parts[pt] !== D.PARTS_PER_TYPE) throw new Error(`part count ${pt} = ${parts[pt]}`);
    const cars = carCount(st);
    for (const m of D.MODELS) if (cars[m] !== D.CARS_PER_MODEL) throw new Error(`car count ${m} = ${cars[m]}`);
    for (const pt of D.PARTS) if (st.supply[pt] < 0 || st.ware[pt] < 0) throw new Error('negative parts ' + pt);
    for (const m of D.MODELS) if (st.carSupply[m] < 0) throw new Error('negative cars ' + m);
    const p = st.p;
    if (p.bank < 0 || p.books < 0 || p.vouchers < 0 || p.sp < 0 || p.spSide < 0 || p.gen < 0) throw new Error('negative resource ' + JSON.stringify({ b: p.bank, bk: p.books, v: p.vouchers, sp: p.sp, side: p.spSide }));
    if (p.bank + p.pend.shift > D.SHIFT_BANK_MAX) throw new Error('bank over max');
    if (p.parts.length > storeCap(st)) throw new Error('storage over cap');
    if (p.desk.length > deskCap(st)) throw new Error('desk over cap');
    if (p.sp > slotCap(st)) throw new Error('speech over slots');
    if (!st.over && st.phase !== 'meeting' && p.sp + p.spSide + p.sgSpeech < D.SPEECH_TOKENS - 1) throw new Error('lost own speech tokens ' + (p.sp + p.spSide));
    if (st.bots.parts.length > D.BOT_PART_CAP) throw new Error('bot parts over cap');
    if (st.recycle.length !== 3 || new Set(st.recycle).size !== 3) throw new Error('recycle pool ' + st.recycle);
    if (st.track.filter(Boolean).length > D.TRACK_SLOTS) throw new Error('track over 4');
    const ws = Object.values(st.pos).filter(x => x !== null && x !== D.DESK);
    if (new Set(ws).size !== ws.length) throw new Error('two workers on one workstation ' + JSON.stringify(st.pos));
    for (const m of D.MODELS) {
        if (st.asm.sp[m].length > D.ASM_SPACES[m]) throw new Error('assembly over ' + m);
        if (new Set(st.asm.sp[m]).size !== st.asm.sp[m].length) throw new Error('duplicate part in assembly ' + m);
    }
    const designs = [...st.design.central, ...st.design.fo[0], ...st.design.fo[1], ...st.design.disp.flat().filter(Boolean), ...p.desk, ...p.upgd, ...st.bots.stack, ...st.bots.L.upgd, ...st.bots.T.upgd];
    if (new Set(designs).size !== designs.length) throw new Error('duplicate design');
    for (const m of D.MODELS) st.upg[m].forEach(pt => { if (pt && !st.val) throw new Error(); });
}

const stats = { games: 0, days: 0, wins: 0, fired: 0, pp: 0, steps: 0, meetings: 0, weeks: 0, botPts: 0 };
const t0 = Date.now();
for (let g = 0; g < N; g++) {
    const diff = g % 4 === 0 ? [] : [((g * 7) % 9) + 1, ((g * 5) % 9) + 1].filter((x, i, a) => a.indexOf(x) === i);
    const opts = { seed: SEED * 1000 + g, color: D.PLAYER_COLORS[g % 4], nice: g % 5 === 1, planner: g % 3 === 1, expert: g % 4 === 2, delayed: g % 6 === 3, special: g % 2 === 0, charger: g % 3 !== 2, addons: g % 3 === 0, diff, sandbox: process.argv[5] !== 'fire' };
    let st = newGame(opts);
    let steps = 0;
    try {
        check(st);
        while (!st.over) {
            if (++steps > 20000) throw new Error('game did not finish');
            const v = choose(st.prompt);
            st = answer(JSON.parse(JSON.stringify(st)), v);
            check(st);
        }
    } catch (e) {
        console.error(`GAME ${g} (seed ${opts.seed}) step ${steps}: ${e.stack}`);
        console.error('opts:', JSON.stringify(opts));
        console.error('prompt:', JSON.stringify(st.prompt)?.slice(0, 500));
        console.error('stack:', JSON.stringify(st.stack.map(t => t.t + ':' + (t.s || ''))));
        console.error('last log:', st.log.slice(-10).map(l => `${l.w} ${l.text}`).join(' | '));
        process.exit(1);
    }
    stats.games++; stats.days += st.day; stats.steps += steps; stats.meetings += st.meetings; stats.weeks += st.weeks;
    if (st.result?.win) stats.wins++;
    if (st.result?.fired) stats.fired++;
    stats.pp += st.p.pp; stats.botPts += st.bots.L.pts + st.bots.T.pts;
}
const f = x => (x / stats.games).toFixed(1);
console.log(`${stats.games} games ok (${POLICY}) in ${((Date.now() - t0) / 1000).toFixed(1)}s · avg days ${f(stats.days)} · meetings ${f(stats.meetings)} · weeks ${f(stats.weeks)} · steps ${f(stats.steps)}`);
console.log(`avg final PP ${f(stats.pp)} · Colleague PP ${f(stats.botPts)} · wins ${stats.wins} · fired ${stats.fired}`);
