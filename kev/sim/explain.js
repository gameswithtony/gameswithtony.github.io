// Walks simulated games and builds the explanation for every legal answer and every data point.
// Fails on empty titles or text containing undefined / NaN / [object.
// Usage: node sim/explain.js [games=30]
import { newGame, answer, choices } from '../js/engine.js';
import * as TIP from '../js/tips.js';
import * as T from '../js/text.js';
import * as D from '../js/data.js';
import { botLine } from '../js/bots.js';

const N = +(process.argv[2] || 30);
let rs = 3;
const rnd = () => (rs = (rs * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
let checked = 0; const distinct = new Set();
function ok(t, where) {
    checked++; distinct.add(JSON.stringify(t));
    const s = JSON.stringify(t);
    if (!t || !t.t || /^[{"\[0-9]/.test(t.t) || /undefined|NaN|\[object/.test(s)) throw new Error(`bad text at ${where}: ${s}`);
}
function statusTips(st) {
    ok(TIP.pp(st), 'pp'); ok(TIP.day(st), 'day'); ok(TIP.week(st), 'week'); ok(TIP.cycle(st), 'cycle'); ok(TIP.meeting(st), 'meeting');
    ok(TIP.sandra(st), 'sandra'); ok(TIP.bank(st), 'bank'); ok(TIP.books(st), 'books'); ok(TIP.vouchers(st), 'vouchers'); ok(TIP.speech(st), 'speech');
    ok(TIP.storage(st), 'storage'); ok(TIP.desk(st), 'desk'); ok(TIP.testTrack(st), 'track'); ok(TIP.recycle(st), 'recycle'); ok(TIP.cert(st), 'cert');
    ok(TIP.finalGoal(st), 'final'); ok(TIP.weekPreview(st), 'weekPrev');
    D.PARTS.forEach(p => { ok(TIP.part(st, p), 'part'); ok(TIP.ware(st, p), 'ware'); });
    D.MODELS.forEach(m => { ok(TIP.model(st, m), 'model'); D.UPGRADE_SPACES[m].forEach((_, i) => ok(TIP.upgSpace(st, m, i), 'upgSpace')); });
    D.DEPTS.forEach(d => ok(TIP.track(st, d), 'track ' + d));
    for (let w = 0; w <= 10; w++) if (w !== 10 || true) { if (w < 10 || w === D.DESK) ok(TIP.ws(st, w), 'ws'); }
    [0, 1, 2, 3].forEach(i => { ok(TIP.slot(st, i), 'slot'); ok(TIP.dispCol(i), 'col'); });
    [0, 1].forEach(i => ok(TIP.demand(st, i), 'demand'));
    ['X1', 'X2', 'X3'].forEach(x => ok(TIP.exit(x), 'exit'));
    Object.keys(st.asm.at).forEach(n => ok(TIP.asmNode(st, n), 'asmNode ' + n));
    D.MODELS.forEach(m => { for (let k = 0; k < D.ASM_SPACES[m]; k++) ok(TIP.asmSpace(st, m, k), 'asmSpace'); });
    ok(TIP.stacks(st, 'central'), 'central'); ok(TIP.stacks(st, 'fo', 0), 'fo');
    for (let s = 0; s < 6; s++) for (let sp = 0; sp < 4; sp++) ok(TIP.certSpace(st, s, sp), 'certSpace');
    st.factory.forEach(f => ok(TIP.factory(st, f), 'factory'));
    [...st.pg.room, ...st.pg.table, ...st.p.hand].forEach(id => ok(TIP.pg(st, id), 'pg ' + id));
    ['L', 'T'].forEach(w => ok(TIP.bot(st, w), 'bot'));
    st.p.garages.forEach((g, i) => ok(TIP.garage(st, i), 'garage'));
    [...st.p.desk].forEach(id => ok(TIP.design(id, st), 'design'));
    [...st.p.upgd].forEach(id => ok(TIP.upgraded(id, st), 'upgraded'));
    st.p.kanban.forEach(k => ok(TIP.kanbanCard(k), 'kanban'));
    if (st.p.chargers) [0, 1, 2, 3, 4].forEach(i => ok(TIP.charger(st, i), 'charger'));
    st.opts.diff.forEach(id => ok(TIP.diffCard(id), 'diff'));
    ok(TIP.planColumn(st), 'planColumn');
    st.plan.col.forEach((id, i, a) => ok(TIP.planCard(st, id, a.length === 1 ? 'only' : i === 0 ? 'top' : i === a.length - 1 ? 'bottom' : 'middle'), 'planCard'));
    D.PG.forEach(c => { if (!T.pgText(c.id)) throw new Error('pg text ' + c.id); });
    D.FINAL.forEach(f => f.a.forEach(a => { if (!T.finalText(a) || T.finalText(a) === a.c) throw new Error('final text ' + a.c); }));
}
for (let g = 0; g < N; g++) {
    let st = newGame({ seed: 900 + g, sandbox: true, special: g % 2 === 0, charger: g % 3 !== 0, addons: g % 3 === 1, planner: g % 4 === 1, delayed: g % 5 === 2, expert: g % 3 === 2, nice: g % 4 === 3, diff: g % 2 ? [g % 9 + 1] : [] });
    let steps = 0;
    while (!st.over && steps++ < 20000) {
        const pr = st.prompt;
        const cs = choices(pr);
        if (pr.kind === 'menu') pr.acts.forEach(a => { const v = { a: a.k }; if (a.d) v.d = a.d; if (a.g !== undefined) v.g = a.g; ok(TIP.choice(st, pr, v), 'menu ' + a.k); });
        else cs.forEach(v => ok(TIP.choice(st, pr, v), pr.q));
        if (pr.q === 'botTurn') pr.lines.forEach(l => { const s = botLine(l); if (!s || /undefined|NaN/.test(s)) throw new Error('bot line ' + JSON.stringify(l)); });
        if (steps % 7 === 0) statusTips(st);
        let v = cs[Math.floor(rnd() * cs.length)];
        if (pr.kind === 'menu') { const real = cs.filter(c => c.a !== 'end'); v = real.length && rnd() < .75 ? real[Math.floor(rnd() * real.length)] : cs.find(c => c.a === 'end'); }
        st = answer(JSON.parse(JSON.stringify(st)), v);
    }
    statusTips(st);
}
console.log(`${N} games · ${distinct.size} distinct explanations (${checked} checks) · all have text`);
