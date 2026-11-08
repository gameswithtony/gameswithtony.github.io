// @ts-check
// Game flow and your rules: the day loop, your turn, Meetings, End of game.
import * as D from './data.js';
import {
    H, DONE, push, ask, log, NAME, deptOf, posOf, wsShifts, occupant, sandraDept, di, isCert, track, certCount,
    deskCap, storeCap, garageOpen, myCars, partValue, tested, addPP, gain, gainSpeech, settlePending,
    fromSupply, toSupply, canAssemble, cleanFullLines, refillDesigns, takeFO, advancePace, toTestTrack,
    certOrder, wsOrder, certSpaceTaken, finalMet, finalScore, botFinalScore, sum, rankOf, pgCount, pgSlot,
    shuffle, freeStorage, slotCap, upgCount, botPP,
} from './core.js';
import { botSelect, sandraMove, dealPlans, refillDemand } from './bots.js';

// ================================================================ setup
H.game = (st, t, a) => {
    const p = st.p, o = st.opts;
    if (t.s === 'start') {
        const tiles = o.expert ? D.GARAGE_TILES.expert : D.GARAGE_TILES.basic;
        p.garages = tiles.map(tile => ({ car: null, tile, flipped: false }));
        if (o.delayed) { p.aside = tiles.slice(0, 4); p.garages.slice(0, 4).forEach(g => g.tile = null); }
        t.s = 'cert';
    }
    if (t.s === 'cert') {
        if (!a) return ask(st, { q: 'certStart', opts: [0, 1, 2, 3] });
        const sp = a.v;
        p.cert = [0, sp];
        st.bots.L.cert = [0, sp === 0 ? 1 : 0];
        st.bots.T.cert = [0, sp === 2 ? 3 : 2];
        D.CERT[0][sp].forEach(b => certBenefit(st, b));
        log(st, 'you', 'cert', `Certification start space ${sp + 1}`);
        t.s = o.special ? 'special' : o.planner && !o.delayed ? 'planner' : 'go';
        a = undefined;
    }
    if (t.s === 'special') {
        if (!a) return ask(st, { q: 'special', opts: D.SPECIAL_GARAGE.filter(k => !(o.nice && k === 'sgAvoid')) });
        p.garages[4].tile = a.v;
        p.sg = { tile: a.v, used: false, live: false };
        log(st, 'you', 'garage', `Special Garage Bonus: ${a.v}`);
        t.s = o.planner && !o.delayed ? 'planner' : 'go';
        a = undefined;
    }
    if (t.s === 'planner') {
        t.left = t.left || p.garages.slice(0, 4).map(g => g.tile);
        t.g = t.g || 0;
        if (a) {
            p.garages[t.g].tile = a.v;
            t.left.splice(t.left.indexOf(a.v), 1);
            t.g++;
        }
        if (t.left.length > 1) return ask(st, { q: 'planner', g: t.g, opts: [...new Set(t.left)] });
        if (t.left.length === 1) { p.garages[t.g].tile = t.left[0]; t.left = []; }
        t.s = 'go';
    }
    st.phase = 'select';
    push(st, { t: 'day', s: 'select' });
    return DONE;
};

/** A printed benefit code (certification track). */
export function certBenefit(st, b) {
    if (b.startsWith('pp')) addPP(st, +b.slice(2), 'Certification track');
    else if (b === 'sp') gainSpeech(st);
    else gain(st, b);
}

// ================================================================ the day
H.day = (st, t) => {
    switch (t.s) {
        case 'select': {
            st.phase = 'select';
            if (st.day > 1) dealPlans(st);
            st.notes = [];
            const order = st.day === 1 ? certOrder(st) : wsOrder(st);
            t.s = 'work';
            push(st, { t: 'selRound', order, i: 0 });
            return;
        }
        case 'work': {
            st.phase = 'work';
            t.s = 'eod';
            push(st, { t: 'workRound', order: wsOrder(st), i: 0 });
            return;
        }
        case 'eod': {
            st.phase = 'eod';
            t.s = 'meet';
            push(st, { t: 'endOfDay' });
            return;
        }
        case 'meet': {
            t.s = 'check';
            if (st.meetingDue) push(st, { t: 'meeting', s: 'start' });
            return;
        }
        case 'check': {
            if (endTriggered(st)) { push(st, { t: 'final' }); return DONE; }
            st.day++;
            t.s = 'select';
            return;
        }
    }
};
export const endTriggered = st => (st.week >= 2 && st.cycle >= 3) || (st.week >= 3 && st.cycle >= 2);

H.selRound = (st, t, a) => {
    while (t.i < t.order.length) {
        const who = t.order[t.i];
        if (who === 'you') {
            if (!a) return ask(st, { q: 'station', opts: stationOpts(st), notes: st.notes.slice() });
            st.pos.you = a.v;
            st.notes.push({ w: 'you', ws: a.v });
            log(st, 'you', 'move', `You → ${D.DEPT_NAME[deptOf(a.v)]} (${posOf(a.v)})`);
            a = undefined;
        } else if (who === 'S') {
            if (st.day > 1) { sandraMove(st); st.notes.push({ w: 'S', ws: st.pos.S }); }
        } else {
            botSelect(st, who);
            st.notes.push({ w: who, ws: st.pos[who], plan: st.plan.card[who], sel: st.sel.card[who] });
        }
        t.i++;
    }
    if (!a) return ask(st, { q: 'stations', notes: st.notes.slice() });
    return DONE;
};
/** Workstations you may move to: another department, not Sandra's, empty. */
export function stationOpts(st) {
    const cur = deptOf(st.pos.you), sd = sandraDept(st);
    const out = [];
    for (let ws = 0; ws < 10; ws++) {
        const d = deptOf(ws);
        if (d === cur || d === sd || occupant(st, ws)) continue;
        out.push(ws);
    }
    return out;
}

H.workRound = (st, t) => {
    if (t.i >= t.order.length) return DONE;
    const who = t.order[t.i++];
    if (who === 'you') push(st, { t: 'yourTurn', s: 'start' });
    else if (who === 'S') { if (st.day > 1) push(st, { t: 'sandraTurn' }); }
    else push(st, { t: 'botTurn', who });
};

// ================================================================ your turn
/** Departments you can work in this turn. */
export const active = st => st.turn ? [st.turn.dept, ...(st.turn.other ? [st.turn.other] : [])] : [];

/** Shifts you could still spend (workstation first, then Banked Shifts up to the daily cap). */
export function shiftsLeft(st) {
    const t = st.turn;
    return Math.max(0, Math.min(t.cap - t.used, Math.max(0, t.base - t.used) + st.p.bank));
}
export function spend(st, n) {
    const t = st.turn;
    for (let i = 0; i < n; i++) {
        if (t.used >= t.base) { st.p.bank--; t.bankUsed++; }
        t.used++;
    }
}

H.yourTurn = (st, t, a) => {
    const p = st.p;
    if (t.s === 'start') {
        const ws = st.pos.you, dept = deptOf(ws);
        st.turn = {
            who: 'you', dept, other: null, base: wsShifts(ws) + (dept === 'adm' && p.chargers?.[4] ? 1 : 0), used: 0, bankUsed: 0, cap: D.MAX_SHIFTS,
            kanban: false, voucher: false, charger: false, freeUpg: false, design: false, claims: 0, placed: [], log0: st.log.length,
        };
        t.s = dept === 'adm' ? 'other' : 'enter';
    }
    if (t.s === 'other') {
        if (!a) return ask(st, { q: 'adminOther', opts: ['rd', 'asm', 'log', 'des', 'none'] });
        st.turn.other = a.v === 'none' ? null : a.v;
        if (st.turn.other) log(st, 'you', 'admin', `Admin: also working in ${D.DEPT_NAME[st.turn.other]}`);
        a = undefined;
        t.s = 'enter';
    }
    if (t.s === 'enter') {
        t.s = 'menu';
        if (active(st).includes('asm')) {
            const cleared = cleanFullLines(st);
            if (cleared.length) { log(st, 'sys', 'asm', `Full lines cleaned: ${cleared.map(m => D.MODEL_NAME[m]).join(', ')}`); st.turn.cleaned = cleared; }
        }
    }
    if (t.s === 'menu') {
        if (!a) return ask(st, menuPrompt(st));
        const v = a.v;
        switch (v.a) {
            case 'train': spend(st, 1); push(st, { t: 'train', d: v.d, n: 1 }); return;
            case 'book': p.books--; push(st, { t: 'train', d: v.d, n: 1, book: true }); return;
            case 'design': push(st, { t: 'pickDesign' }); return;
            case 'kanban': push(st, { t: 'kanban', s: 'card' }); return;
            case 'collect': push(st, { t: 'collect', s: 'ware' }); return;
            case 'voucher': spend(st, 1); st.turn.voucher = true; gain(st, 'voucher'); log(st, 'you', 'voucher', 'Parts Voucher'); return;
            case 'provide': push(st, { t: 'provide' }); return;
            case 'claim': push(st, { t: 'claim', s: 'car' }); return;
            case 'upgrade': push(st, { t: 'upgrade', s: 'design' }); return;
            case 'charger': push(st, { t: 'charger' }); return;
            case 'recycle': push(st, { t: 'recycle' }); return;
            case 'sg': push(st, { t: 'sgUse' }); return;
            case 'flip': flipGarage(st, v.g); return;
            case 'end': t.s = 'finish'; break;
        }
    }
    if (t.s === 'finish') {
        const tr = st.turn;
        if (tr.claims) advancePace(st, tr.claims);
        if (tr.design) refillDesigns(st);
        settlePending(st);
        p.garages.forEach(g => { if (g.car && g.tile && !g.flipped) g.ready = true; });
        if (p.sg && p.garages[4].car) p.sg.live = true;
        refillDemand(st);
        log(st, 'you', 'end', `Turn over · ${tr.used} Shift${tr.used === 1 ? '' : 's'}${tr.bankUsed ? ` (${tr.bankUsed} banked)` : ''}`);
        st.turn = null;
        return DONE;
    }
};

/** Your turn menu: every task with its cost or the reason it is blocked. */
export function menuPrompt(st) {
    const p = st.p, tr = st.turn, left = shiftsLeft(st);
    const acts = [];
    const add = (k, x = {}) => acts.push({ k, ...x });
    for (const d of active(st)) {
        const maxed = p.tr[di(d)] >= D.EXPERT;
        add('train', { d, cost: 1, why: maxed ? 'expert' : !left ? 'shifts' : null });
        add('book', { d, cost: 0, why: maxed ? 'expert' : !p.books ? (p.pend.book ? 'newBook' : 'books') : null });
    }
    const act = active(st);
    if (act.includes('des')) add('design', { cost: 1, why: !left ? 'shifts' : p.desk.length >= deskCap(st) ? 'desk' : !designOpts(st).length ? 'noDesign' : null });
    if (act.includes('log')) {
        add('kanban', { cost: 1, why: tr.kanban ? 'once' : !left ? 'shifts' : !p.kanban.length ? 'noKanban' : null });
        add('collect', { cost: 1, why: !left ? 'shifts' : !freeStorage(st) ? 'storage' : !D.PARTS.some(pt => st.ware[pt]) ? 'emptyWare' : null });
        add('voucher', { cost: 1, why: !isCert(st, 'you', 'log') ? 'certLog' : tr.voucher ? 'once' : !left ? 'shifts' : null });
    }
    if (act.includes('asm')) add('provide', { cost: 1, why: !left ? 'shifts' : !provideOpts(st).length ? 'noProvide' : null });
    if (act.includes('rd')) {
        const cars = claimOpts(st);
        add('claim', { cost: cars.length ? Math.min(...cars.map(c => c.cost)) : 1, why: !st.track.some(Boolean) ? 'noCars' : !openGarages(st).length ? 'garages' : !cars.length ? (cars.blocked || 'noMatch') : null });
        add('upgrade', { cost: 1, why: !left ? 'shifts' : !upgradeDesigns(st, 'shift').length ? (p.desk.some(id => D.dPart(id)) ? 'noPart' : 'noUpgDesign') : null });
    }
    if (act.includes('adm') && st.opts.charger) add('charger', { cost: 1, why: tr.charger ? 'once' : !left ? 'shifts' : !st.chargerSupply || p.chargers.every(Boolean) ? 'chargers' : null });
    const rec = recycleOpts(st);
    add('recycle', { cost: 0, why: !rec.length ? (p.parts.length ? 'recycleSame' : 'noParts') : null });
    if (p.sg && p.sg.live && !p.sg.used && ['sgUpgrade', 'sgTrain2', 'sgShift5', 'sgDesign'].includes(p.sg.tile)) add('sg', { cost: 0, tile: p.sg.tile, why: sgBlock(st) });
    p.garages.forEach((g, i) => { if (st.opts.delayed && g.car && g.tile && !g.flipped && g.ready && i < 4) add('flip', { g: i, tile: g.tile, cost: 0 }); });
    add('end', { cost: 0 });
    return { kind: 'menu', q: 'turn', dept: tr.dept, other: tr.other, acts, left, used: tr.used, base: tr.base, cap: tr.cap };
}
function sgBlock(st) {
    const p = st.p;
    switch (p.sg.tile) {
        case 'sgUpgrade': return upgradeDesigns(st, 'supply').length ? null : 'noUpgDesign';
        case 'sgDesign': return p.desk.length >= deskCap(st) ? 'desk' : null;
        case 'sgTrain2': return p.tr.filter(x => x < D.EXPERT).length >= 2 ? null : 'expert';
    }
    return null;
}

// ================================================================ training and certification
H.train = (st, t) => {
    const p = st.p;
    if (t.n <= 0) return DONE;
    const i = di(t.d);
    if (p.tr[i] >= D.EXPERT) return DONE;
    p.tr[i]++; p.ts[i] = ++st.tseq; t.n--;
    log(st, 'you', 'train', `${D.DEPT_NAME[t.d]} training ${p.tr[i]}${t.book ? ' (Book)' : ''}`);
    if (p.tr[i] === D.CERTIFIED) {
        log(st, 'you', 'cert', `Certified in ${D.DEPT_NAME[t.d]}`);
        if (!st.firstCert[t.d]) { st.firstCert[t.d] = 'you'; addPP(st, 2, `first certified in ${D.DEPT_NAME[t.d]}`); }
        push(st, { t: 'certMove' });
        return;
    }
    if (p.tr[i] === D.EXPERT) expert(st, t.d);
    if (t.n <= 0) return DONE;
};
function expert(st, d) {
    const aw = st.award[d];
    log(st, 'you', 'expert', `Expert in ${D.DEPT_NAME[d]}`);
    if (!st.firstExpert[d]) { st.firstExpert[d] = 'you'; addPP(st, 3, `first Expert in ${D.DEPT_NAME[d]}`); }
    if (aw.tok) { aw.tok = 0; gainSpeech(st); log(st, 'you', 'speech', 'Generic Speech token (first Expert)'); }
    if (aw.tile) {
        const tile = aw.tile; aw.tile = null;
        if (tile === 'pp2') addPP(st, 2, 'Award'); else gain(st, tile);
        log(st, 'you', 'award', `Award: ${tile}`);
    }
}
H.certMove = (st, t, a) => {
    const p = st.p, sec = p.cert[0] + 1;
    if (sec > 5) return DONE;
    const opts = [0, 1, 2, 3].filter(sp => !certSpaceTaken(st, sec, sp, 'you'));
    if (!a && opts.length > 1) return ask(st, { q: 'certSpace', sec, opts });
    const sp = a ? a.v : opts[0];
    p.cert = [sec, sp];
    D.CERT[sec][sp].forEach(b => certBenefit(st, b));
    log(st, 'you', 'cert', `Certification track section ${sec}, space ${sp + 1}`);
    checkFactory(st);
    return DONE;
};
/** Factory Goals: the first time you meet one, take one of its Speech tokens. */
export function checkFactory(st) {
    const p = st.p;
    p.fg = p.fg || {};
    for (const f of st.factory) {
        if (!f.tok || p.fg[f.g]) continue;
        const have = f.g === 'cars' ? myCars(st).length : f.g === 'upg' ? p.upgd.length : certCount(st);
        if (have >= f.n) { f.tok--; p.fg[f.g] = true; gainSpeech(st); log(st, 'you', 'factory', `Factory Goal met: ${f.n} ${f.g}`); }
    }
}

// ================================================================ Design
export function designOpts(st) {
    const out = [], ds = st.design;
    for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) if (ds.disp[r][c]) out.push({ k: 'disp', r, c, id: ds.disp[r][c], ben: D.DISPLAY_BEN[c] });
    if (isCert(st, 'you', 'des')) {
        if (ds.central.length) out.push({ k: 'central', id: ds.central[0], ben: st.p.chargers?.[3] ? 'book' : null });
        [0, 1].forEach(r => { if (ds.fo[r].length) out.push({ k: 'fo', r, id: ds.fo[r][0], ben: null }); });
    }
    return out;
}
H.pickDesign = (st, t, a) => {
    const p = st.p;
    const opts = designOpts(st).filter(o => !t.free || o.k === 'disp');
    if (!a) return ask(st, { q: 'design', opts: opts.map(o => ({ ...o })), free: !!t.free });
    const o = a.v;
    let id;
    if (o.k === 'disp') { id = st.design.disp[o.r][o.c]; st.design.disp[o.r][o.c] = null; }
    else if (o.k === 'central') id = st.design.central.shift();
    else id = takeFO(st, o.r);
    if (!t.free) spend(st, 1);
    st.turn.design = true;
    p.desk.push(id);
    const ben = o.k === 'disp' ? D.DISPLAY_BEN[o.c] : o.k === 'central' && p.chargers?.[3] ? 'book' : null;
    if (ben) gain(st, ben);
    log(st, 'you', 'design', `Design ${id}${ben ? ` (+${ben})` : ''}`);
    return DONE;
};

// ================================================================ Logistics
/** Parts a Kanban card adds for a layout. */
export function kanbanAdds(cardIdx, layout) {
    let rows = D.KANBAN[cardIdx];
    if (layout.flip) rows = [...rows].reverse();
    const above = layout.up ? [rows[0], rows[1]] : [rows[0]];
    const below = layout.up ? [rows[2]] : [rows[1], rows[2]];
    const out = [];
    above.flat().forEach(pt => { if (D.TOP_PARTS.includes(pt)) out.push(pt); });
    below.flat().forEach(pt => { if (!D.TOP_PARTS.includes(pt)) out.push(pt); });
    return { rows, out };
}
export function applyKanban(st, cardIdx, layout) {
    const added = [];
    kanbanAdds(cardIdx, layout).out.forEach(pt => { if (fromSupply(st, pt)) { st.ware[pt]++; added.push(pt); } });
    st.kanbanShown = { card: cardIdx, ...layout };
    return added;
}
H.kanban = (st, t, a) => {
    const p = st.p;
    if (t.s === 'card') {
        if (!a) return ask(st, { q: 'kanbanCard', opts: p.kanban.slice() });
        t.card = a.v; t.s = 'layout'; a = undefined;
    }
    if (!a) return ask(st, { q: 'kanbanLayout', card: t.card, opts: D.KANBAN_LAYOUTS.map(l => l.k) });
    const layout = D.KANBAN_LAYOUTS.find(l => l.k === a.v);
    spend(st, 1);
    st.turn.kanban = true;
    gain(st, 'shift', p.chargers?.[2] ? 2 : 1);
    const added = applyKanban(st, t.card, layout);
    p.kanban.splice(p.kanban.indexOf(t.card), 1);
    st.kanbanDeck.push(t.card);
    p.kanban.push(st.kanbanDeck.shift());
    log(st, 'you', 'kanban', `Kanban Order: +${added.length} Parts${added.length ? ' (' + added.map(x => D.PART_NAME[x]).join(', ') + ')' : ''}`);
    return DONE;
};
H.collect = (st, t, a) => {
    if (t.s === 'ware') {
        if (!a) return ask(st, { q: 'collectWare', opts: D.PARTS.filter(pt => st.ware[pt] > 0), room: freeStorage(st) });
        t.part = a.v; t.s = 'num'; a = undefined;
    }
    const max = Math.min(st.ware[t.part], freeStorage(st));
    if (!a && max > 1) return ask(st, { kind: 'num', q: 'collectNum', part: t.part, min: 1, max, def: max });
    const n = a ? a.v : 1;
    spend(st, 1);
    st.ware[t.part] -= n;
    for (let i = 0; i < n; i++) st.p.parts.push(t.part);
    log(st, 'you', 'collect', `Collected ${n} ${D.PART_NAME[t.part]}`);
    return DONE;
};

// ================================================================ Recycling
export function recycleOpts(st) {
    const out = [];
    const mine = [...new Set(st.p.parts)].filter(pt => !st.recycle.includes(pt));
    for (const give of mine) for (const take of st.recycle) out.push({ give, take });
    return out;
}
H.recycle = (st, t, a) => {
    if (!a) return ask(st, { q: 'recycle', opts: recycleOpts(st) });
    const { give, take } = a.v, p = st.p;
    p.parts.splice(p.parts.indexOf(give), 1); p.parts.push(take);
    st.recycle[st.recycle.indexOf(take)] = give;
    log(st, 'you', 'recycle', `Recycled ${D.PART_NAME[give]} for ${D.PART_NAME[take]}`);
    return DONE;
};

// ================================================================ Assembly
export function provideOpts(st) {
    const p = st.p, out = [];
    const ignore = !!p.chargers?.[1];
    for (const m of D.MODELS) {
        for (const pt of new Set(p.parts)) if (canAssemble(st, m, pt, ignore)) out.push({ m, part: pt, src: 'store' });
        if (p.vouchers) for (const pt of D.PARTS) if (st.supply[pt] > 0 && canAssemble(st, m, pt, ignore)) out.push({ m, part: pt, src: 'voucher' });
    }
    return out;
}
H.provide = (st, t, a) => {
    const p = st.p;
    if (!a) return ask(st, { q: 'provide', opts: provideOpts(st) });
    const { m, part, src } = a.v;
    spend(st, 1);
    if (src === 'store') p.parts.splice(p.parts.indexOf(part), 1);
    else { p.vouchers--; st.supply[part]--; }
    st.asm.sp[m].push(part);
    log(st, 'you', 'provide', `${D.PART_NAME[part]} to ${D.MODEL_NAME[m]}${src === 'voucher' ? ' (Voucher)' : ''}`);
    push(st, { t: 'roll', m, who: 'you' });
    return DONE;
};

/** One car moves out of its start space; every car it bumps moves on too. */
H.roll = (st, t, a) => {
    const at = st.asm.at;
    if (!t.started) {
        t.started = true;
        t.from = 's:' + t.m; t.mover = at[t.from];
        at[t.from] = null;
        t.moves = [];
        if (!t.mover) { log(st, 'sys', 'asm', `No ${D.MODEL_NAME[t.m]} car to move`); return finishRoll(st, t); }
    }
    while (t.mover) {
        const opts = D.NEXT[t.from];
        let target;
        if (opts.length === 1) target = opts[0];
        else if (t.who === 'you') {
            if (!a) return ask(st, { q: 'route', car: t.mover, from: t.from, opts: opts.slice(), moves: t.moves.slice() });
            target = a.v; a = undefined;
        } else target = t.who === 'L' ? opts[1] : opts[0];
        t.moves.push({ car: t.mover, from: t.from, to: target });
        if (target in D.EXIT_PP) { rollOff(st, t.mover, target, t.who); t.mover = null; break; }
        const bumped = at[target];
        at[target] = t.mover;
        t.mover = bumped; t.from = target;
    }
    return finishRoll(st, t);
};
function finishRoll(st, t) {
    if (st.carSupply[t.m] > 0 && !st.asm.at['s:' + t.m]) { st.carSupply[t.m]--; st.asm.at['s:' + t.m] = t.m; }
    return DONE;
}
/** A Colleague's roll: no prompts, so it finishes at once. Returns the moves. */
export function rollSync(st, m, who) {
    const t = { t: 'roll', m, who };
    H.roll(st, t);
    return t.moves;
}
/** A car leaves the end of a conveyor onto the test track. */
export function rollOff(st, m, exit, who) {
    const pp = D.EXIT_PP[exit];
    const dem = st.demand.find(x => x.m === m && x.tok > 0);
    if (who === 'you') {
        addPP(st, pp, `${D.MODEL_NAME[m]} off the line`);
        if (dem) { dem.tok--; gainSpeech(st); log(st, 'you', 'speech', `Demand met: ${D.MODEL_NAME[m]} (Speech token)`); }
    } else {
        botPP(st, who, pp, `${D.MODEL_NAME[m]} off the line`);
        if (dem) { dem.tok--; botPP(st, who, st.opts.diff.includes(2) ? 2 : 1, `Demand ${D.MODEL_NAME[m]}`); }
    }
    const out = toTestTrack(st, m);
    log(st, 'sys', 'track', `${D.MODEL_NAME[m]} to the test track${out ? ` · ${D.MODEL_NAME[out]} leaves it` : ''}`);
}

// ================================================================ R&D
export function openGarages(st) {
    const p = st.p;
    const open = p.garages.map((g, i) => i).filter(i => !p.garages[i].car && garageOpen(st, i));
    if (st.opts.planner && open.length) return [open[0]];
    return open;
}
/** Cars you can claim now: position, cost, and whether you hold a matching Design. */
export function claimOpts(st) {
    const left = shiftsLeft(st), p = st.p;
    const out = /** @type {any} */ ([]);
    if (!openGarages(st).length) return out;
    st.track.forEach((m, i) => {
        if (!m) return;
        const cost = D.CLAIM_COST[i];
        if (!p.desk.some(id => D.dModel(id) === m)) return;
        if (cost > left) { out.blocked = 'shifts'; return; }
        out.push({ i, m, cost });
    });
    return out;
}
H.claim = (st, t, a) => {
    const p = st.p;
    if (t.s === 'car') {
        if (!a) return ask(st, { q: 'claimCar', opts: claimOpts(st), track: st.track.slice() });
        t.car = a.v; t.s = 'design'; a = undefined;
    }
    if (t.s === 'design') {
        const ds = [...new Set(p.desk.filter(id => D.dModel(id) === t.car.m))];
        if (ds.length > 1 && !a) return ask(st, { q: 'claimDesign', m: t.car.m, opts: ds });
        t.design = a ? a.v : ds[0]; t.s = 'garage'; a = undefined;
    }
    if (t.s === 'garage') {
        const gs = openGarages(st);
        if (gs.length > 1 && !a) return ask(st, { q: 'garage', m: t.car.m, opts: gs });
        t.g = a ? a.v : gs[0]; a = undefined;
        // take the car
        spend(st, t.car.cost);
        st.track[t.car.i] = null;
        p.desk.splice(p.desk.indexOf(t.design), 1);
        st.design.central.push(t.design);
        st.turn.claims++;
        p.garages[t.g].car = t.car.m;
        log(st, 'you', 'claim', `Claimed ${D.MODEL_NAME[t.car.m]} into garage ${t.g + 1} (${t.car.cost} Shift${t.car.cost > 1 ? 's' : ''})`);
        t.s = 'bonus';
    }
    if (t.s === 'bonus') {
        const g = p.garages[t.g];
        if (st.opts.delayed && t.g < 4) {
            if (p.aside.length) {
                const opts = [...new Set(p.aside)];
                if (!a && opts.length > 1) return ask(st, { q: 'delayTile', g: t.g, opts });
                const tile = a ? a.v : opts[0];
                p.aside.splice(p.aside.indexOf(tile), 1);
                g.tile = tile; g.flipped = false; g.ready = false;
            }
        } else garageBonus(st, t.g);
        checkFactory(st);
        return DONE;
    }
};
/** Gain a garage tile's bonus and flip it. */
export function garageBonus(st, gi) {
    const p = st.p, g = p.garages[gi];
    if (!g.tile || g.flipped) return;
    if (D.SPECIAL_GARAGE.includes(g.tile)) {
        if (g.tile === 'sgSpeech') {
            if (p.spSide > 0) p.spSide--; // one of yours goes on the tile (else a generic)
            p.sgSpeech = 1; g.flipped = true; p.sg.used = true;
            log(st, 'you', 'garage', 'Special garage: Speech token on the tile');
        }
        return; // the others activate on a later turn
    }
    const gainList = D.GARAGE_GAIN[g.tile] || {};
    Object.entries(gainList).forEach(([k, n]) => gain(st, k, n));
    g.flipped = true;
    log(st, 'you', 'garage', `Garage ${gi + 1} bonus: ${g.tile}`);
}
function flipGarage(st, gi) {
    const g = st.p.garages[gi];
    garageBonus(st, gi);
    g.flipped = true;
}

/** Upgradeable Designs on your desk that have a Part source. via: shift (normal task) | supply (free part). */
export function upgradeDesigns(st, via) {
    const p = st.p;
    return [...new Set(p.desk)].filter(id => {
        const pt = D.dPart(id);
        if (!pt) return false;
        return partSources(st, pt, via).length > 0;
    });
}
export function partSources(st, pt, via) {
    const p = st.p, out = [];
    if (via === 'supply') return st.supply[pt] > 0 ? ['supply'] : [];
    if (p.parts.includes(pt)) out.push('store');
    if (p.vouchers && st.supply[pt] > 0) out.push('voucher');
    if (p.chargers?.[0] && st.turn && !st.turn.freeUpg && st.supply[pt] > 0) out.push('free');
    return out;
}
export function canDouble(st, pt) {
    return isCert(st, 'you', 'rd') && !st.p.dblUsed && !st.dbl[pt] && st.val[pt] < 5;
}
H.upgrade = (st, t, a) => {
    const p = st.p, via = t.via === 'sg' ? 'supply' : 'shift';
    if (t.s === 'design') {
        const ds = upgradeDesigns(st, via);
        if (!a) return ask(st, { q: 'upgDesign', opts: ds });
        t.id = a.v; t.part = D.dPart(t.id); t.m = D.dModel(t.id); t.s = 'source'; a = undefined;
    }
    if (t.s === 'source') {
        const src = partSources(st, t.part, via);
        if (!a && src.length > 1) return ask(st, { q: 'upgSource', part: t.part, opts: src });
        t.src = a ? a.v : src[0]; t.s = 'space'; a = undefined;
    }
    if (t.s === 'space') {
        const sp = st.upg[t.m].map((x, i) => x ? -1 : i).filter(i => i >= 0);
        if (!a && new Set(sp.map(i => D.UPGRADE_SPACES[t.m][i])).size > 1) return ask(st, { q: 'upgSpace', m: t.m, opts: sp });
        t.sp = a ? a.v : sp[0]; t.s = 'double'; a = undefined;
    }
    if (t.s === 'double') {
        if (canDouble(st, t.part) && !a) return ask(st, { q: 'double', part: t.part, opts: ['yes', 'no'] });
        const dbl = a ? a.v === 'yes' : false;
        if (via === 'shift') spend(st, 1);
        if (t.src === 'store') p.parts.splice(p.parts.indexOf(t.part), 1);
        else if (t.src === 'voucher') { p.vouchers--; st.supply[t.part]--; }
        else { st.supply[t.part]--; if (t.src === 'free') st.turn.freeUpg = true; }
        st.upg[t.m][t.sp] = t.part;
        const ben = D.UPGRADE_SPACES[t.m][t.sp];
        if (ben) { if (ben.startsWith('pp')) addPP(st, +ben.slice(2), 'upgrade space'); else gain(st, ben); }
        st.val[t.part] = Math.min(5, st.val[t.part] + (dbl ? 2 : 1));
        if (dbl) { st.dbl[t.part] = true; p.dblUsed = true; addPP(st, partValue(st, t.part), 'Double-Upgrade'); }
        p.desk.splice(p.desk.indexOf(t.id), 1);
        p.upgd.push(t.id);
        addPP(st, 2, `Upgraded ${D.MODEL_NAME[t.m]} ${D.PART_NAME[t.part]}`);
        if (t.via === 'sg') { p.sg.used = true; }
        checkFactory(st);
        return DONE;
    }
};

// ================================================================ Admin extras
H.charger = (st, t, a) => {
    const p = st.p;
    if (!a) return ask(st, { q: 'chargerSlot', opts: p.chargers.map((x, i) => x ? -1 : i).filter(i => i >= 0) });
    spend(st, 1); st.turn.charger = true;
    p.chargers[a.v] = true; st.chargerSupply--;
    log(st, 'you', 'charger', `Charger token on position ${a.v + 1}`);
    return DONE;
};
H.sgUse = (st, t, a) => {
    const p = st.p, tile = p.sg.tile;
    if (tile === 'sgShift5') { st.turn.cap = 5; p.sg.used = true; log(st, 'you', 'garage', 'Special garage: up to 5 Shifts this turn'); return DONE; }
    if (tile === 'sgUpgrade') { push(st, { t: 'upgrade', s: 'design', via: 'sg' }); return DONE; }
    if (tile === 'sgDesign') { p.sg.used = true; push(st, { t: 'pickDesign', free: true }); return DONE; }
    if (tile === 'sgTrain2') {
        t.done = t.done || [];
        if (a) t.done.push(a.v);
        if (t.done.length < 2) {
            const opts = D.DEPTS.filter(d => p.tr[di(d)] < D.EXPERT && !t.done.includes(d));
            if (opts.length) return ask(st, { q: 'train2', opts, n: t.done.length });
        }
        p.sg.used = true;
        log(st, 'you', 'garage', 'Special garage: train in 2 departments');
        t.done.slice().reverse().forEach(d => push(st, { t: 'train', d, n: 1 }));
        return DONE;
    }
    return DONE;
};

// ================================================================ Meetings
/** Cards on the Meeting table: the room's four, then those you played. */
export const tableCards = st => [...st.pg.room, ...st.pg.table];
export function meetOpts(st, t) {
    const p = st.p, out = [];
    const tokens = p.sp + p.sgSpeech;
    const mine = id => (st.pg.tok[id] || []).includes('you');
    if (!t.played) for (const id of p.hand) {
        out.push({ a: 'play', id, tok: false });
        if (tokens) out.push({ a: 'play', id, tok: true });
    }
    if (tokens) for (const id of tableCards(st)) if (pgSlot(st, id) >= 0 && !mine(id)) out.push({ a: 'speak', id });
    if (t.played) out.push({ a: 'pass' });
    return out;
}
/** PP you would score with a token on card id now. */
export function speakValue(st, id) {
    const s = pgSlot(st, id);
    if (s < 0) return 0;
    const c = D.pg(id);
    // goal 32 counts the tokens still on your board after this one is placed
    const n = pgCount(st, id) - (c.c === 'speech' && st.p.sp > 0 ? 1 : 0);
    return Math.max(0, Math.min(n, c.m[s])) * c.pp;
}
function placeToken(st, id, who) {
    const c = D.pg(id), s = pgSlot(st, id);
    (st.pg.tok[id] = st.pg.tok[id] || []).push(who);
    return { c, s, mult: c.m[s] };
}
H.meeting = (st, t, a) => {
    const p = st.p;
    if (t.s === 'start') {
        st.phase = 'meeting';
        st.pg.tok = {}; st.pg.table = [];
        Object.assign(t, { order: certOrder(st), i: 0, passes: 0, played: !p.hand.length, bot: { L: st.meetings + 1, T: D.TURCZI_SPEECH }, used: 0, usedSg: 0, notes: [], scored: { you: 0, L: 0, T: 0 } });
        log(st, 'sys', 'meeting', `Meeting ${st.meetings + 1}`);
        t.s = 'turn';
    }
    while (t.s === 'turn') {
        if (t.passes >= 3) { t.s = 'end'; break; }
        const who = t.order[t.i % 3];
        if (who === 'you') {
            const opts = meetOpts(st, t);
            if (!a) return ask(st, { q: 'meet', opts, notes: t.notes.slice(), played: t.played, bot: { ...t.bot } });
            const v = a.v; a = undefined;
            t.notes = [];
            if (v.a === 'pass') { t.passes++; log(st, 'you', 'meet', 'Pass'); }
            else {
                t.passes = 0;
                let target = null;
                if (v.a === 'play') {
                    p.hand.splice(p.hand.indexOf(v.id), 1); st.pg.table.push(v.id); t.played = true;
                    log(st, 'you', 'meet', `Played Performance Goal ${v.id}`);
                    if (v.tok) target = v.id;
                } else target = v.id;
                if (target !== null) {
                    const pts = speakValue(st, target);
                    placeToken(st, target, 'you');
                    if (p.sp > 0) { p.sp--; t.used++; } else { p.sgSpeech--; t.usedSg++; }
                    addPP(st, pts, `Speech on goal ${target}`);
                    t.scored.you += pts;
                }
            }
        } else {
            const r = botSpeak(st, who, t);
            if (r) { t.passes = 0; t.notes.push(r); } else t.passes++;
        }
        t.i++;
    }
    if (t.s === 'end') {
        // used tokens go beside your board; generics turn into your own tokens
        p.spSide += t.used + t.usedSg;
        while (p.gen > 0 && p.spSide > 0 && p.sp < slotCap(st)) { p.gen--; p.spSide--; p.sp++; }
        st.pg.discard = (st.pg.discard || []).concat(st.pg.room, st.pg.table);
        st.pg.room = []; st.pg.table = [];
        t.s = 'next'; t.next = [];
    }
    if (t.s === 'next') {
        if (a) { t.next.push(a.v); p.hand.splice(p.hand.indexOf(a.v), 1); a = undefined; }
        if (t.next.length < 2 && p.hand.length) return ask(st, { q: 'nextPG', opts: p.hand.slice(), n: t.next.length, scored: { ...t.scored } });
        st.pg.room = shuffle(st, [...t.next, ...drawPG(st, 4 - t.next.length)]);
        p.hand.push(...drawPG(st, 4 - p.hand.length));
        st.pg.tok = {};
        st.meetingDue = false;
        st.meetings++;
        st.cycle = Math.min(3, st.cycle + 1);
        log(st, 'sys', 'meeting', `Meeting over · Production Cycle ${st.cycle}`);
        if (p.pp <= 0) st.fired = true;
        st.phase = 'eod';
        return DONE;
    }
};
export function drawPG(st, n) {
    const out = [];
    for (let i = 0; i < n; i++) {
        if (!st.pg.deck.length) { st.pg.deck = shuffle(st, st.pg.discard || []); st.pg.discard = []; }
        if (!st.pg.deck.length) break;
        out.push(st.pg.deck.shift());
    }
    return out;
}
/** A Colleague's Meeting turn: one Speech token on the next card in its direction. */
function botSpeak(st, who, t) {
    if (t.bot[who] <= 0) return null;
    let cards = tableCards(st);
    if (who === 'T') cards = cards.slice().reverse();
    const id = cards.find(c => pgSlot(st, c) >= 0 && !(st.pg.tok[c] || []).includes(who));
    if (id === undefined) { t.bot[who] = 0; return null; }
    const { c, mult } = placeToken(st, id, who);
    t.bot[who]--;
    const pts = c.pp * (who === 'L' ? mult : 1);
    botPP(st, who, pts, `Speech on goal ${id}`);
    t.scored[who] += pts;
    return { w: who, id, pts };
}

// ================================================================ end of game
H.final = (st, t) => {
    st.phase = 'final';
    const p = st.p;
    // Final Goal: spend Speech tokens on met achievements, best first
    const fg = D.fin(st.finalGoal);
    const met = fg.a.map((x, i) => ({ ...x, i })).filter(x => finalMet(st, x)).sort((x, y) => y.pp - x.pp);
    const spent = [];
    for (const x of met) {
        if (p.sp > 0) p.sp--; else if (p.gen > 0) p.gen--; else if (p.sgSpeech > 0) p.sgSpeech--; else break;
        spent.push(x.i); addPP(st, x.pp, 'Final Goal');
    }
    const you = finalScore(st);
    addPP(st, sum(you), 'Final scoring');
    const bots = botFinalScore(st);
    st.p.pp -= sum(bots);
    log(st, 'sys', 'final', "Colleagues' final scoring", { pp: -sum(bots) });
    const win = st.p.pp > 0;
    st.result = { win, pp: st.p.pp, you: { final: spent.reduce((s, i) => s + fg.a[i].pp, 0), ...you }, bots, spent, rank: win ? rankOf(st) : null };
    push(st, { t: 'over' });
    return DONE;
};
H.over = (st) => {
    st.phase = 'over'; st.over = true;
    if (st.fired && !st.result) st.result = { win: false, fired: true, pp: st.p.pp, day: st.day };
    st.turn = null;
    return ask(st, { kind: 'over', q: 'over' });
};

export { tested, upgCount, partValue, track, storeCap, deskCap, slotCap };
