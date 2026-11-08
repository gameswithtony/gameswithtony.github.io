// @ts-check
// The Colleagues (Mr Lacerda and Mr Turczi) and Sandra, as in the official solo rules
// (Reference Book pp 2-4) and /kanbanev/. The helper told you what to do; here the engine does it.
// Every place the rules leave a choice is settled by the rule named in docs/ENGINE.md.
import * as D from './data.js';
import {
    H, DONE, ask, log, NAME, deptOf, posOf, occupant, sandraDept, di, isCert, addPP, botPP, hasDiff,
    fromSupply, toSupply, canAssemble, cleanFullLines, refillDesigns, takeFO, advancePace, partValue,
    weekScore, evaluated, certCount, myCars, shuffle, pick, rand, ppSince,
} from './core.js';
import { rollSync, applyKanban } from './tasks.js';

// ================================================================ Plan and Selection decks
/** Start of each Department Selection (not day 1): deal Plan cards until the column has 3. */
export function dealPlans(st) {
    const pl = st.plan;
    let reshuffle = false, guard = 0;
    while (pl.col.length < 3 && guard++ < 50) {
        if (!pl.deck.length) { pl.deck = shuffle(st, pl.discard); pl.discard = []; if (!pl.deck.length) break; }
        const id = pl.deck.shift();
        if (id === D.RESHUFFLE) { pl.discard.push(id); reshuffle = true; continue; }
        pl.col.push(id);
    }
    if (reshuffle) {
        pl.deck = shuffle(st, [...pl.deck, ...pl.discard]);
        pl.discard = [];
        log(st, 'sys', 'plan', 'Plan deck reshuffled');
    }
}
function drawSel(st) {
    if (!st.sel.deck.length) { st.sel.deck = shuffle(st, st.sel.discard); st.sel.discard = []; }
    return st.sel.deck.shift();
}

// ================================================================ Department Selection
/** A Colleague flips a Selection card, takes the top or bottom Plan card, and moves. */
export function botSelect(st, who) {
    const sid = drawSel(st);
    st.sel.card[who] = sid;
    const s = D.sel(sid);
    const pid = s.take === 't' ? st.plan.col.shift() : st.plan.col.pop();
    st.plan.card[who] = pid;
    const want = D.plan(pid).d;
    const ws = resolveStation(st, who, want);
    if (ws === null) return;
    st.pos[who] = ws;
    const d = deptOf(ws);
    log(st, who, 'move', `${NAME[who]} → ${D.DEPT_NAME[d]} (${posOf(ws)})${d !== want ? ` · Plan said ${D.DEPT_NAME[want]}` : ''}`, { plan: pid, sel: sid });
}
/**
 * Where a Colleague lands for a Plan card's department, with the workstations as they are now:
 * Mr Lacerda takes bottom workstations, Mr Turczi top ones; a taken workstation or the department
 * they are already in sends them to the next department down (Admin, then R&D again).
 */
export function resolveStation(st, who, want) {
    const pos = who === 'L' ? 1 : 0;
    const cur = deptOf(st.pos[who]);
    let i = di(want);
    for (let k = 0; k < 5; k++, i = (i + 1) % 5) {
        const ws = i * 2 + pos;
        if (D.DEPTS[i] === cur || occupant(st, ws)) continue;
        return ws;
    }
    return null;
}
/** Colleagues still to pick in this Department Selection, in order (empty outside it). */
export function pickQueue(st) {
    const t = st.stack.find(x => x.t === 'selRound');
    return t ? t.order.slice(t.i).filter(w => w === 'L' || w === 'T') : [];
}
/**
 * What the Plan column says about the Colleagues still to pick. The next one takes the top or
 * bottom card; the one after could end up with any card, depending on the first pick.
 */
export function planOutlook(st) {
    const col = st.plan.col, q = pickQueue(st);
    return q.map((w, k) => {
        if (k > 0 || !col.length) return { w, after: q[0] };
        const top = col[0], bot = col[col.length - 1];
        return { w, opts: [{ take: 't', id: top, ws: resolveStation(st, w, D.plan(top).d) }, { take: 'b', id: bot, ws: resolveStation(st, w, D.plan(bot).d) }] };
    });
}
/** Selection cards left in the deck by what they take (the discards are face up). */
export function selCounts(st) {
    const n = { t: 0, b: 0 };
    st.sel.deck.forEach(id => n[D.sel(id).take]++);
    return n;
}
/** Sandra: next empty workstation in the next department down; Admin means her desk. */
export function sandraMove(st) {
    const from = sandraDept(st);
    let i = from === 'adm' ? 0 : di(from) + 1;
    for (; i < 4; i++) {
        for (const pos of [0, 1]) if (!occupant(st, i * 2 + pos)) { st.pos.S = i * 2 + pos; log(st, 'S', 'move', `Sandra → ${D.DEPT_NAME[D.DEPTS[i]]}`); return; }
    }
    st.pos.S = D.DESK;
    log(st, 'S', 'move', 'Sandra → her desk (Admin)');
}

// ================================================================ training
/** A Colleague advances one space on a track, with certification and Expert effects. */
export function botTrain(st, who, d, lines) {
    const b = st.bots[who], i = di(d);
    if (b.tr[i] >= D.EXPERT) {
        if (hasDiff(st, 7) && st.p.bank > 0) { st.p.bank--; lines.push({ k: 'overtime', d }); log(st, who, 'overtime', `${NAME[who]}: Forced Overtime, you lose a Banked Shift`); }
        else lines.push({ k: 'maxed', d });
        return;
    }
    b.tr[i]++; b.ts[i] = ++st.tseq;
    lines.push({ k: 'train', d, n: b.tr[i] });
    if (b.tr[i] === D.CERTIFIED) {
        lines.push({ k: 'cert', d });
        if (!st.firstCert[d]) { st.firstCert[d] = who; botPP(st, who, 2, `first certified in ${D.DEPT_NAME[d]}`); }
        const sec = b.cert[0] + 1;
        if (sec <= 5) {
            const yours = st.p.cert;
            const sp = who === 'L' ? (yours[0] === sec && yours[1] === 0 ? 1 : 0) : (yours[0] === sec && yours[1] === 2 ? 3 : 2);
            b.cert = [sec, sp];
            if (hasDiff(st, 3)) {
                const ben = D.CERT[sec][sp];
                const pp = ben.filter(x => x.startsWith('pp')).reduce((s, x) => s + +x.slice(2), 0);
                const speech = ben.filter(x => x === 'sp').length * (hasDiff(st, 2) ? 2 : 1);
                botPP(st, who, pp + speech, 'Certified Advantage');
            }
        }
    }
    if (b.tr[i] === D.EXPERT) {
        lines.push({ k: 'expert', d });
        const aw = st.award[d];
        if (aw.tok) { aw.tok = 0; botPP(st, who, hasDiff(st, 2) ? 2 : 1, `Expert Speech token in ${D.DEPT_NAME[d]}`); }
        if (!st.firstExpert[d]) { st.firstExpert[d] = who; botPP(st, who, 3, `first Expert in ${D.DEPT_NAME[d]}`); }
    }
}
const lacerdaCert = (st, d) => hasDiff(st, 1) || isCert(st, 'L', d);

// ================================================================ Part selection
/** 1st Part need uses this Colleague's Selection card, 2nd the other's, then fresh cards. */
function nextPart(st, who, ctx) {
    ctx.n = (ctx.n || 0) + 1;
    if (ctx.n === 1 && st.sel.card[who]) return D.sel(st.sel.card[who]).part;
    const other = who === 'L' ? 'T' : 'L';
    if (ctx.n === 2 && st.sel.card[other]) return D.sel(st.sel.card[other]).part;
    const id = drawSel(st);
    st.sel.discard.push(id);
    return D.sel(id).part;
}
/** Keep drawing until a Part passes `ok` (bounded; null if none do). */
function choosePart(st, who, ctx, ok) {
    const tried = new Set();
    for (let k = 0; k < 30 && tried.size < 6; k++) {
        const pt = nextPart(st, who, ctx);
        if (ok(pt)) return pt;
        tried.add(pt);
    }
    return null;
}

// ================================================================ departmental actions
function botUpgrade(st, who, lines) {
    const b = st.bots;
    const id = b.stack[0];
    if (!id) { lines.push({ k: 'noUpgrade', why: 'stack' }); return; }
    const m = D.dModel(id), pt = D.dPart(id);
    if (st.supply[pt] <= 0) { lines.push({ k: 'noUpgrade', why: 'supply', part: pt }); return; }
    b.stack.shift();
    const rank = ben => !ben ? 0 : ben.startsWith('pp') ? 10 + +ben.slice(2) : ben === 'shift' ? 3 : 2;
    const free = st.upg[m].map((x, i) => x ? -1 : i).filter(i => i >= 0);
    const sp = free.sort((x, y) => rank(D.UPGRADE_SPACES[m][y]) - rank(D.UPGRADE_SPACES[m][x]) || x - y)[0];
    st.supply[pt]--;
    st.upg[m][sp] = pt;
    const ben = D.UPGRADE_SPACES[m][sp];
    st.val[pt] = Math.min(5, st.val[pt] + 1);
    const v = partValue(st, pt);
    botPP(st, who, v, `upgraded ${D.MODEL_NAME[m]} ${D.PART_NAME[pt]}`);
    if (ben && ben.startsWith('pp') && hasDiff(st, 4)) botPP(st, who, +ben.slice(2), 'Productive Upgrades');
    if (ben && !ben.startsWith('pp') && hasDiff(st, 5)) botPP(st, who, 1, 'Optimized Upgrades');
    st.bots[who].upgd.push(id);
    lines.push({ k: 'upgrade', id, sp, pp: v });
}
function botClaim(st, who, lines) {
    const tr = st.track.filter(Boolean);
    if (!tr.length) { lines.push({ k: 'noClaim' }); return; }
    let i = 0;
    if (who === 'T') {
        const best = D.TURCZI_CLAIM.find(m => tr.includes(m));
        i = tr.indexOf(best);
    }
    const m = tr[i];
    tr.splice(i, 1);
    st.track = tr;
    st.bots[who].cars.push(m);
    lines.push({ k: 'claim', m, pos: i });
    advancePace(st, 1);
}
function botProvide(st, who, ctx, lines) {
    const cleared = cleanFullLines(st);
    if (cleared.length) lines.push({ k: 'cleaned', models: cleared });
    const pt = choosePart(st, who, ctx, x => st.supply[x] > 0);
    if (!pt) { lines.push({ k: 'noProvide', why: 'supply' }); return; }
    const start = D.MODELS.indexOf(D.BOT_ASM_MODEL[sandraDept(st)]);
    for (let k = 0; k < 5; k++) {
        const m = D.MODELS[(start + k) % 5];
        if (!canAssemble(st, m, pt)) continue;
        st.supply[pt]--;
        st.asm.sp[m].push(pt);
        const moves = rollSync(st, m, who);
        lines.push({ k: 'provide', m, part: pt, moves });
        return;
    }
    lines.push({ k: 'noProvide', why: 'rules', part: pt });
}
function botKanban(st, who, lines) {
    const card = st.kanbanDeck.shift();
    const pair = D.KANBAN[card][0][0];
    const layout = { flip: !D.TOP_PARTS.includes(pair), up: ['rd', 'asm', 'log'].includes(sandraDept(st)) };
    const added = applyKanban(st, card, layout);
    st.kanbanDeck.push(card);
    lines.push({ k: 'kanban', card, up: layout.up, added });
}
function botCollect(st, who, ctx, lines) {
    if (!D.PARTS.some(pt => st.ware[pt] > 0)) { lines.push({ k: 'noCollect' }); return; }
    const pt = choosePart(st, who, ctx, x => st.ware[x] > 0);
    if (!pt) { lines.push({ k: 'noCollect' }); return; }
    const n = st.ware[pt];
    st.ware[pt] = 0;
    toSupply(st, pt, n - 1);
    st.bots.parts.push(pt);
    let dropped = null;
    if (st.bots.parts.length > D.BOT_PART_CAP) {
        const low = Math.min(...st.bots.parts.map(x => st.val[x]));
        const cands = [...new Set(st.bots.parts.filter(x => st.val[x] === low))];
        dropped = cands[Math.floor(rand(st) * cands.length)];
        st.bots.parts.splice(st.bots.parts.indexOf(dropped), 1);
        toSupply(st, dropped);
    }
    lines.push({ k: 'collect', part: pt, n, dropped });
}
function botDesigns(st, who, lines) {
    const col = D.BOT_DESIGN_COL[sandraDept(st)];
    const got = [];
    if (col === 0) { [0, 1].forEach(r => { if (st.design.fo[r].length) got.push(takeFO(st, r)); }); }
    else[0, 1].forEach(r => { const id = st.design.disp[r][col - 1]; if (id) { got.push(id); st.design.disp[r][col - 1] = null; } });
    if (who === 'L' && lacerdaCert(st, 'des') && st.design.central.length) got.push(st.design.central.shift());
    for (const id of got) {
        if (D.dPart(id)) st.bots.stack.push(id);
        else { st.design.central.push(id); botPP(st, who, 2, `blank Design ${D.MODEL_NAME[D.dModel(id)]}`); }
    }
    refillDesigns(st);
    lines.push({ k: 'designs', col, got });
}

// ================================================================ a Colleague's turn
H.botTurn = (st, t, a) => {
    if (a) return DONE;
    const who = t.who, d = deptOf(st.pos[who]), lines = [], ctx = {}, log0 = st.log.length;
    botTrain(st, who, d, lines);
    const cert = who === 'L' && lacerdaCert(st, d);
    const twice = cert ? 2 : 1;
    switch (d) {
        case 'rd':
            for (let k = 0; k < (who === 'L' ? twice : 1); k++) botUpgrade(st, who, lines);
            botClaim(st, who, lines);
            break;
        case 'asm':
            for (let k = 0; k < (who === 'L' ? twice : 1); k++) botProvide(st, who, ctx, lines);
            break;
        case 'log':
            if (who === 'L') botKanban(st, who, lines);
            for (let k = 0; k < (who === 'L' ? twice : 1); k++) botCollect(st, who, ctx, lines);
            break;
        case 'des':
            botDesigns(st, who, lines);
            break;
        case 'adm': {
            const sd = sandraDept(st);
            for (let k = 0; k < (who === 'L' ? twice : 1); k++) botTrain(st, who, sd, lines);
            break;
        }
    }
    refillDemand(st);
    const pp = ppSince(st, log0);
    lines.forEach(l => log(st, who, 'bot', botLine(l)));
    return ask(st, { q: 'botTurn', who, d, cert, lines, pp, plan: st.plan.card[who], sel: st.sel.card[who] });
};
/** Short log text for one Colleague step. */
export function botLine(l) {
    const M = D.MODEL_NAME, P = D.PART_NAME, N = D.DEPT_NAME;
    switch (l.k) {
        case 'train': return `${N[l.d]} training ${l.n}`;
        case 'maxed': return `${N[l.d]} track already full`;
        case 'overtime': return `${N[l.d]} full: you lose a Banked Shift`;
        case 'cert': return `Certified in ${N[l.d]}`;
        case 'expert': return `Expert in ${N[l.d]}`;
        case 'upgrade': return `Upgraded ${M[D.dModel(l.id)]} ${P[D.dPart(l.id)]}`;
        case 'noUpgrade': return l.why === 'stack' ? 'Upgrade lost: no Design in their stack' : `Upgrade lost: no ${P[l.part]} in the supply`;
        case 'claim': return `Claimed ${M[l.m]} (car ${l.pos + 1})`;
        case 'noClaim': return 'Claim lost: test track empty';
        case 'cleaned': return `Cleaned full lines: ${l.models.map(m => M[m]).join(', ')}`;
        case 'provide': return `${P[l.part]} to ${M[l.m]}`;
        case 'noProvide': return l.why === 'supply' ? 'Assembly lost: no Part in the supply' : `Assembly lost: ${P[l.part]} fits no car`;
        case 'kanban': return `Kanban Order: +${l.added.length} Parts`;
        case 'collect': return `Took ${l.n} ${P[l.part]}, kept 1${l.dropped ? `, dropped ${P[l.dropped]}` : ''}`;
        case 'noCollect': return 'Collect lost: warehouses empty';
        case 'designs': return l.got.length ? `Took Designs: ${l.got.map(id => `${M[D.dModel(id)]} ${D.dPart(id) ? P[D.dPart(id)] : 'blank'}`).join(', ')}` : 'Design column empty';
    }
    return l.k;
}

// ================================================================ Sandra
H.sandraTurn = (st, t, a) => {
    const p = st.p, d = sandraDept(st), i = di(d), nice = st.opts.nice;
    if (!t.s) {
        t.lines = []; t.log0 = st.log.length;
        const ev = evaluated(st, i, nice);
        t.evaluated = ev;
        if (ev.includes('you')) {
            const val = sandraValue(st, d);
            if (nice) {
                const gainPP = val >= 2 ? Math.max(0, p.bank - 5) : 0;
                t.lines.push({ k: 'reward', val, pp: gainPP });
                if (gainPP) addPP(st, gainPP, `Sandra's reward (${D.DEPT_NAME[d]})`);
                t.s = 'task';
            } else if (val <= 2) {
                t.pen = 1 + Math.max(0, 5 - p.bank);
                t.val = val;
                t.s = p.sg?.tile === 'sgAvoid' && p.sg.live && !p.sg.used ? 'avoid' : 'pen';
            } else { t.lines.push({ k: 'pass', val }); t.s = 'task'; }
        } else { t.lines.push({ k: 'notYou' }); t.s = 'task'; }
    }
    if (t.s === 'avoid') {
        if (!a) return ask(st, { q: 'avoid', pen: t.pen, opts: ['yes', 'no'] });
        if (a.v === 'yes') { p.sg.used = true; t.lines.push({ k: 'avoided', val: t.val, pp: t.pen }); log(st, 'you', 'garage', 'Special garage: penalty avoided'); t.s = 'task'; }
        else t.s = 'pen';
        a = undefined;
    }
    if (t.s === 'pen') {
        t.lines.push({ k: 'penalty', val: t.val, pp: t.pen });
        addPP(st, -t.pen, `Sandra's penalty (${D.DEPT_NAME[d]})`);
        t.s = 'task';
    }
    if (t.s === 'task') {
        sandraTask(st, d, t.lines);
        t.s = 'ack';
        if (st.over) return DONE;
        return ask(st, { q: 'sandra', d, lines: t.lines, evaluated: t.evaluated, pp: ppSince(st, t.log0) });
    }
    if (t.s === 'ack' && a) return DONE;
};
/** Your number for Sandra's criterion in department d. */
export function sandraValue(st, d) {
    const p = st.p;
    switch (D.SANDRA[d].c) {
        case 'upg': return p.upgd.length;
        case 'cars': return myCars(st).length;
        case 'parts': return p.parts.length;
        case 'designs': return p.desk.length;
        case 'certs': return certCount(st);
    }
    return 0;
}
function sandraTask(st, d, lines) {
    switch (D.SANDRA[d].task) {
        case 'pace': {
            const stripe = advancePace(st, 1);
            lines.push({ k: 'pace', stripe });
            break;
        }
        case 'clearAsm': {
            let n = 0;
            D.MODELS.forEach(m => { st.asm.sp[m].forEach(pt => { toSupply(st, pt); n++; }); st.asm.sp[m] = []; });
            lines.push({ k: 'clearAsm', n });
            break;
        }
        case 'clearWare': {
            let n = 0;
            D.PARTS.forEach(pt => { if (st.ware[pt] > 1) { n += st.ware[pt] - 1; toSupply(st, pt, st.ware[pt] - 1); st.ware[pt] = 1; } });
            lines.push({ k: 'clearWare', n });
            break;
        }
        case 'clearDesign': {
            const ids = [];
            for (let r = 0; r < 2; r++) for (const c of [2, 3]) { if (st.design.disp[r][c]) ids.push(st.design.disp[r][c]); st.design.disp[r][c] = null; }
            st.design.central.push(...shuffle(st, ids));
            refillDesigns(st);
            lines.push({ k: 'clearDesign', n: ids.length });
            break;
        }
        case 'week': endOfWeek(st, lines); break;
    }
}
/** End-of-Week scoring (Sandra at her desk). */
export function endOfWeek(st, lines) {
    const you = weekScore(st);
    addPP(st, you, 'End of Week');
    const per = hasDiff(st, 6) ? 3 : 2;
    const L = st.bots.L.upgd.length, T = st.bots.T.upgd.length;
    if (L) botPP(st, 'L', per * L, 'End of Week Designs');
    if (T) botPP(st, 'T', per * T, 'End of Week Designs');
    st.bots.L.upgd = []; st.bots.T.upgd = [];
    st.weeks++;
    let keep = 0;
    if (hasDiff(st, 8)) { keep = 2 * Math.min(4, st.weeks); botPP(st, 'L', keep, 'Keeping Up'); }
    st.week = Math.min(3, st.week + 1);
    lines.push({ k: 'week', you, L: per * L, T: per * T, keep, n: st.weeks });
    log(st, 'sys', 'week', `End of Week ${st.weeks}`);
    if (st.p.pp <= 0) st.fired = true;
}

// ================================================================ end of day
H.endOfDay = (st, t, a) => {
    const last = st.plan.col[0];
    if (!t.s) {
        t.s = 'swap'; t.lines = [];
        const parts = last ? D.plan(last).parts : [];
        if (parts.length) {
            const sid = drawSel(st);
            st.sel.discard.push(sid);
            t.part = D.sel(sid).part;
            const inRec = x => st.recycle.includes(x);
            t.pairs = parts.filter(pp => pp !== t.part && inRec(pp) !== inRec(t.part))
                .map(pp => inRec(t.part) ? { out: t.part, in: pp } : { out: pp, in: t.part })
                .filter(x => st.supply[x.in] > 0);
            t.plan = last;
        }
    }
    if (t.s === 'swap') {
        if (t.pairs && t.pairs.length > 1 && !a) return ask(st, { q: 'eodRecycle', opts: t.pairs, part: t.part, plan: t.plan });
        if (t.pairs) {
            const x = a ? a.v : t.pairs[0];
            if (x) {
                st.recycle[st.recycle.indexOf(x.out)] = x.in;
                st.supply[x.in]--; st.supply[x.out]++;
                t.lines.push({ k: 'swap', ...x });
                log(st, 'sys', 'recycle', `End of day: Recycling ${D.PART_NAME[x.out]} → ${D.PART_NAME[x.in]}`);
            } else t.lines.push({ k: 'noSwap', part: t.part });
        }
        a = undefined;
        // discard the Colleagues' Plan and Selection cards
        for (const w of ['L', 'T']) {
            if (st.plan.card[w]) st.plan.discard.push(st.plan.card[w]);
            if (st.sel.card[w]) st.sel.discard.push(st.sel.card[w]);
            st.plan.card[w] = null; st.sel.card[w] = null;
        }
        t.s = 'ack';
        if (t.pairs || st.meetingDue) return ask(st, { q: 'eod', lines: t.lines, part: t.part || null, plan: t.plan || null, meeting: st.meetingDue });
        return DONE;
    }
    if (t.s === 'ack') return DONE;
};

// ================================================================ demand
export function refillDemand(st) {
    for (let k = 0; k < 2; k++) {
        const dm = st.demand[k];
        if (dm.tok > 0) continue;
        st.demandAside.push(dm.m);
        if (!st.demandDeck.length) break;
        const m = st.demandDeck.shift();
        st.demand[k] = { m, tok: D.DEMAND[m] };
        log(st, 'sys', 'demand', `New Demand: ${D.MODEL_NAME[m]}`);
    }
    if (st.demandAside.length) { st.demandDeck = shuffle(st, [...st.demandDeck, ...st.demandAside]); st.demandAside = []; }
}
export { pick };
