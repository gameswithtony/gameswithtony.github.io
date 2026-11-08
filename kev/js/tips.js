// @ts-check
// Tap-to-explain text: icon, name, current value, a few short lines. Used by v-tip and explain mode.
import * as D from './data.js';
import * as T from './text.js';
import {
    deptOf, di, isCert, certCount, deskCap, storeCap, slotCap, myCars, tested, partValue, upgCount, trackLeader,
    pgCount, pgSlot, finalMet, sandraDept, weekScore, wsShifts, occupant, canAssemble, endTriggered,
    kanbanAdds, speakValue, canDouble, sandraValue, selCounts, planOutlook,
} from './engine.js';

const N = T.WHO;
const tip = (ic, t, v, d) => ({ ic, t, v: v === undefined ? '' : String(v), d: [].concat(d || []) });

// ================================================================ status
export const pp = st => tip('pp', 'Your PP', st.p.pp, [
    'Production Points. You start at 15.', 'Colleagues never score: what they gain, you lose.',
    `At 0 or below after End of Week, a Meeting or final scoring, you are fired.${st.opts.diff.includes(9) ? ' Immediate Termination: at any time.' : ''}`,
    `Highest so far: ${st.p.maxPP}.`]);
export const day = st => tip('week', 'Day', st.day, ['Each day: pick a workstation, then everyone works top to bottom.', 'Sandra moves one department down each day.']);
export const week = st => tip('week', 'Week marker', `${st.week} of 3`, [
    'Advances when Sandra reaches her desk (End of Week scoring).',
    `Game ends after the day when Week and Production Cycle reach 2 and 3 (either way). ${endTriggered(st) ? 'Triggered: this is the last day.' : ''}`]);
export const cycle = st => tip('cycle', 'Production Cycle', `${st.cycle} of 3`, [
    'Advances after each Meeting.', `Meetings held: ${st.meetings}.`]);
export const meeting = st => tip('meeting', 'Meeting', st.meetingDue ? 'Tonight' : 'Not called', [
    'Called when the Pace Car reaches a striped space.', `Pace Car: ${(D.STRIPE_EVERY - (st.pace % D.STRIPE_EVERY)) % D.STRIPE_EVERY || D.STRIPE_EVERY} space(s) to the next stripe.`]);
export const sandra = st => {
    const d = sandraDept(st), i = di(d);
    return tip('S', 'Sandra', st.pos.S === D.DESK ? 'At her desk' : T.DN[d], [
        `Evaluates the ${st.opts.nice ? 'most' : 'least'} trained in ${T.DN[d]}: ${T.SANDRA_CRIT[d]} ${st.opts.nice ? '2 or more earns 1 PP per Banked Shift over 5' : '2 or fewer costs 1 PP + 1 per Banked Shift under 5'}.`,
        `Then: ${T.SANDRA_TASK[d]}.`, 'You may not move to her department.']);
};
export const bank = st => tip('bank', 'Banked Shifts', `${st.p.bank} of 10`, [
    'Spend them to work more Shifts: never more than 4 in a turn.', 'Each scores 1 PP at the end. Fewer than 5 adds to Sandra\'s penalty.',
    ...(st.p.pend.shift ? [`+${st.p.pend.shift} arriving after this turn.`] : [])]);
export const books = st => tip('book', 'Books', st.p.books, ['Return a Book to train once, free, in a department you work in.', '1 PP each at the end.',
    ...(st.p.pend.book ? [`+${st.p.pend.book} arriving after this turn.`] : [])]);
export const vouchers = st => tip('voucher', 'Parts Vouchers', st.p.vouchers, ['Use one for any Part from the supply when you Provide a Part or Upgrade.', '1 PP each at the end.',
    ...(st.p.pend.voucher ? [`+${st.p.pend.voucher} arriving after this turn.`] : [])]);
export const speech = st => tip('speech', 'Speech tokens', `${st.p.sp} on your board`, [
    `Slots: ${slotCap(st)}. Beside your board: ${st.p.spSide} of yours${st.p.gen ? `, ${st.p.gen} generic` : ''}.`,
    'Spend them in Meetings and on the Final Goal. 1 PP each left at the end.',
    'Gaining one moves one of yours onto an empty slot; generics swap in after a Meeting.']);
export const storage = st => tip('supply', 'Parts storage', `${st.p.parts.length} of ${storeCap(st)}`, ['Logistics certification adds a space.']);
export const desk = st => tip('design', 'Desk', `${st.p.desk.length} of ${deskCap(st)} Designs`, ['Designs claim cars and get upgraded.', 'Design certification adds a space.']);

// ================================================================ things on the board
export function part(st, pt) {
    const v = partValue(st, pt);
    return tip(pt, T.P[pt], v ? `value ${v}` : 'not upgraded', [
        `Warehouse ${st.ware[pt]} · supply ${st.supply[pt]}${st.recycle.includes(pt) ? ' · in Recycling' : ''}.`,
        `Tested Designs for it score its value at the end.${st.dbl[pt] ? ' Already Double-Upgraded.' : ''}`]);
}
export function model(st, m) {
    return tip(m, `${T.M[m]} cars`, `${D.CAR_VALUE[m]} PP each`, [
        `Upgrades made: ${upgCount(st, m)}. End of Week: each of your ${T.M[m]} cars scores 1 per upgrade plus 1 per Tested ${T.M[m]} Design.`,
        `Assembly: ${st.asm.sp[m].length} of ${D.ASM_SPACES[m]} Parts. Supply: ${st.carSupply[m]} cars.`]);
}
export function design(id, st) {
    const pt = D.dPart(id), m = D.dModel(id);
    return tip(pt || m, `${T.M[m]} Design`, pt ? T.P[pt] : 'blank', [
        `Claims a ${T.M[m]} car from the test track.`,
        pt ? `Upgrade: put a ${T.P[pt]} on a ${T.M[m]} upgrade space for 2 PP.` : 'Blank: cannot be upgraded.']);
}
export function upgraded(id, st) {
    const pt = D.dPart(id), m = D.dModel(id), isTested = myCars(st).includes(m);
    return tip(isTested ? 'tested' : 'upgraded', `Upgraded ${T.M[m]} ${T.P[pt]}`, isTested ? 'Tested' : 'Not tested', [
        isTested ? `You have a ${T.M[m]}: scores ${partValue(st, pt)} PP at the end (the ${T.P[pt]} value) and 1 PP per ${T.M[m]} car each End of Week.`
            : `Claim a ${T.M[m]} car to make it Tested.`]);
}
export function upgSpace(st, m, i) {
    const b = D.UPGRADE_SPACES[m][i], got = st.upg[m][i];
    return tip(got || T.ben(b).ic, `${T.M[m]} upgrade space`, got ? T.P[got] : T.ben(b).txt, [got ? 'Filled.' : `Covering it gives ${T.ben(b).txt}.`]);
}
export function track(st, d) {
    const i = di(d), l = trackLeader(st, i), aw = st.award[d];
    return tip(d, `${T.DN[d]} training`, `You ${st.p.tr[i]} · L ${st.bots.L.tr[i]} · T ${st.bots.T.tr[i]}`, [
        'Space 3 certifies, space 5 is Expert. First to certify: 2 PP. First Expert: 3 PP.',
        `Expert prize: ${aw.tok ? 'Speech token' : 'token gone'}${aw.tile ? `, Award (${T.AWARD[aw.tile]})` : ''}.`,
        `Leading: ${l[1] ? N[l[0]] : 'nobody'}. The leader scores 5 PP at the end (ties: latest arrival).`]);
}
export function ws(st, w) {
    const who = occupant(st, w);
    return tip(deptOf(w), T.wsName(w), who ? N[who] : 'Empty', w === D.DESK ? ["Sandra's desk: End of Week when she sits here."] : [`${wsShifts(w)} Shift${wsShifts(w) > 1 ? 's' : ''}. Higher workstations act first.`]);
}
export function testTrack(st) {
    const cars = st.track.filter(Boolean);
    return tip('track', 'Test track', `${cars.length} of 4 cars`, ['Claim cars in R&D: the 1st costs 1 Shift, then 2, 2, 3.', 'Each claimed car moves the Pace Car 1 space.',
        'A 5th car pushes out the one behind the Pace Car.']);
}
export function slot(st, i) {
    const m = st.track[i];
    return tip(m || 'track', `Test track car ${i + 1}`, m ? T.M[m] : 'Empty', [`Costs ${D.CLAIM_COST[i]} Shift${i ? 's' : ''} to claim. Needs a ${m ? T.M[m] : 'matching'} Design and an empty garage.`]);
}
export function demand(st, i) {
    const dm = st.demand[i];
    return tip('demand', 'Demand', `${T.M[dm.m]} · ${dm.tok} token${dm.tok === 1 ? '' : 's'}`, [`Assemble a ${T.M[dm.m]} off the line to take a Speech token.`, 'Empty tiles are replaced at the end of a turn.']);
}
/** A start space or plate on the Assembly line, with the car on it if any. */
export function asmNode(st, n) {
    const m = st.asm.at[n];
    const next = D.NEXT[n] || [];
    const where = x => x in D.EXIT_PP ? `off the line (${D.EXIT_PP[x]} PP)` : T.placeName(x);
    if (n.startsWith('s:')) {
        const line = n.slice(2);
        return tip(line, `${T.M[line]} start space`, m ? `${T.M[m]} car` : 'Empty', [
            `Adding a Part to the ${T.M[line]} line moves this car to ${where(next[0])}; a car already there is bumped on.`,
            `Then a new ${T.M[line]} car enters: ${st.carSupply[line]} left in the supply.`]);
    }
    const lines = [next.length > 1
        ? `When bumped, it moves to ${where(next[0])} or ${where(next[1])}. You choose on your turns; Mr Lacerda turns toward the middle row, Mr Turczi goes left.`
        : `When bumped, it moves to ${where(next[0])}.`];
    if (m) lines.unshift(`A car only moves when another car pushes into this plate.`);
    if (m && st.demand.some(d => d.m === m && d.tok)) lines.push(`${T.M[m]} cars are in Demand: rolling one off takes a Speech token.`);
    return tip(m || 'asm', `${T.placeName(n)[0].toUpperCase() + T.placeName(n).slice(1)}`, m ? `${T.M[m]} car` : 'Empty', lines);
}
/** One assembly space of a Model. */
export function asmSpace(st, m, k) {
    const have = st.asm.sp[m], pt = have[k], n = D.ASM_SPACES[m];
    const up = st.upg[m].filter(Boolean).filter(x => !have.includes(x));
    return tip(pt || m, `${T.M[m]} assembly space ${k + 1} of ${n}`, pt ? T.P[pt] : 'Empty', pt
        ? ['Provided. When all spaces are full, they clear at the start of the next Assembly turn.']
        : [`Takes any Part not already here${have.length ? ` (${have.map(x => T.P[x]).join(', ')})` : ''}.`,
            up.length ? `Upgraded Parts first: ${up.map(x => T.P[x]).join(', ')}.` : 'No Upgraded Parts are waiting for this Model.',
            'Each Part added moves the line.']);
}
export function exit(x) { return tip('pp', 'Line exit', `${D.EXIT_PP[x]} PP`, ['A car pushed off here scores this, then goes to the test track.']); }
export function recycle(st) {
    return tip('recycle', 'Recycling', st.recycle.map(x => T.P[x]).join(', '), ['Any time on your turn: swap a Part from your storage for one here.', 'The three Parts always differ. No Recycling in Meetings.']);
}
export function ware(st, pt) {
    return tip(pt, `${T.P[pt]} warehouse`, st.ware[pt], ['Collect Parts: 1 Shift takes any number from one warehouse.', D.TOP_PARTS.includes(pt) ? 'Above the Kanban line.' : 'Below the Kanban line.']);
}
export function stacks(st, k, r) {
    const ds = st.design;
    const list = k === 'central' ? ds.central : ds.fo[r];
    return tip('stack', k === 'central' ? 'Central stack' : `First Office ${r ? 'bottom' : 'top'}`, `${list.length} left`,
        [list[0] ? `Top: ${T.designName(list[0])}.` : 'Empty.', 'Needs Design certification to take from (Advanced Design).']);
}
export function dispCol(c) {
    const b = D.DISPLAY_BEN[c];
    return tip(b ? T.ben(b).ic : 'design', `Display column ${c + 1}`, b ? T.ben(b).txt : 'No bonus', ['Taking a Design here gives this bonus.']);
}
export function cert(st) {
    return tip('cert', 'Certification track', `You: section ${st.p.cert[0]}`, ['Each certification moves you to an empty space in the next section and gives its benefit.',
        'Order on this track, right to left, is the Meeting order.']);
}
export function certSpace(st, sec, sp) {
    const who = ['you', 'L', 'T'].find(k => { const c = k === 'you' ? st.p.cert : st.bots[k].cert; return c[0] === sec && c[1] === sp; });
    return tip('cert', `Section ${sec}, space ${sp + 1}`, who ? N[who] : 'Empty', [D.CERT[sec][sp].length ? D.CERT[sec][sp].map(b => T.ben(b).txt).join(' + ') : 'No benefit']);
}
export function factory(st, f) {
    const have = f.g === 'cars' ? myCars(st).length : f.g === 'upg' ? st.p.upgd.length : certCount(st);
    return tip('factory', 'Factory Goal', `${f.n} ${T.FACT[f.g]}`, [`You have ${have}.`, f.tok ? (st.p.fg?.[f.g] ? 'Met.' : 'Meet it to take its Speech token.') : 'Its token is gone.', 'The Colleagues never take these.']);
}
export function finalGoal(st) {
    const f = D.fin(st.finalGoal);
    return tip('final', 'Final Goal', `${f.a.filter(a => finalMet(st, a)).length} of 3 met`, ['At the end, spend 1 Speech token per achievement you meet.',
        ...f.a.map(a => `${a.pp} PP: ${T.finalText(a)}${finalMet(st, a) ? ' (met)' : ''}`)]);
}
export function pg(st, id) {
    const c = D.pg(id), n = pgCount(st, id), s = pgSlot(st, id);
    return tip(T.pgIcon(id), `Performance Goal ${id}`, `${c.pp} PP per ${T.pgText(id)}`, [
        `Speech icons: ${c.m.map(x => x + '×').join(' ')}. A token scores up to the multiplier on the highest empty icon.`,
        `You have ${n}.${s >= 0 && st.prompt?.q === 'meet' ? ` Speaking now: ${speakValue(st, id)} PP.` : ''}`]);
}
export function bot(st, who) {
    const b = st.bots[who];
    return tip(who, N[who], `−${b.pts} PP from you`, [
        who === 'L' ? 'Bottom workstations. Certified where he works: actions twice.' : 'Top workstations. Acts once; claims the most valuable car.',
        `Certifications: ${certCount(st, who)}. Cars: ${b.cars.length}. Upgraded Designs this week: ${b.upgd.length}.`]);
}
export function planColumn(st) {
    const n = selCounts(st);
    return tip('plan', 'How the Colleagues pick', `Selection deck: ${n.t} top · ${n.b} bottom`, [
        'Each Colleague flips a Selection card and takes the top or bottom Plan card.',
        "Mr Lacerda goes to that department's bottom workstation, Mr Turczi the top. If it is taken or is his current department, he tries the next department down.",
        'Where he lands depends on what is free when he picks: your move or Sandra’s can push him on. Colleagues ignore Sandra otherwise.',
        'Two Plan cards are dealt each morning. The one left over can swap Recycling at the end of the day.']);
}
export function planCard(st, id, pos) {
    const p = D.plan(id);
    return tip(p.d, `Plan card: ${T.DN[p.d]}`, pos === 'only' ? 'Left over' : pos[0].toUpperCase() + pos.slice(1), [
        pos === 'top' ? 'A Colleague whose Selection card says top takes this.' : pos === 'bottom' ? 'A Colleague whose Selection card says bottom takes this.'
            : pos === 'middle' ? 'Not takeable until the first pick moves it to an end.' : 'Nobody takes it today.',
        p.parts.length ? `If it is left over tonight, a Selection card can swap Recycling with: ${p.parts.map(x => T.P[x]).join(', ')}.` : 'No end-of-day Recycling swap.']);
}
export function diffCard(id) { const c = D.DIFFICULTY.find(x => x.id === id); return tip('difficulty', `Difficulty ${id}: ${c.name}`, '', [c.d]); }
export function charger(st, i) { return tip('charger', `Charging space ${i + 1}`, st.p.chargers?.[i] ? 'Charger token' : 'Empty', [T.CHARGER[i] + '.', 'Each Charger token scores 1 PP per car at the end.']); }
export function garage(st, g) {
    const gr = st.p.garages[g], locked = g === 4 && !isCert(st, 'you', 'asm');
    const tile = gr.tile ? T.GARAGE[gr.tile] : null;
    return tip('garage', `Garage ${g + 1}`, gr.car ? T.M[gr.car] : locked ? 'Locked' : 'Empty', [
        locked ? 'Assembly certification unlocks it.' : '',
        tile ? `${gr.flipped ? 'Used' : 'Bonus'}: ${tile.txt}.` : st.opts.delayed && g < 4 ? 'Delayed Tuning: you pick a tile when you park here.' : '',
        gr.car ? `Scores ${D.CAR_VALUE[gr.car]} PP at the end.` : ''].filter(Boolean));
}
export function weekPreview(st) { return tip('week', 'End of Week (now)', `${weekScore(st)} PP`, ['Per car: upgrades on its Model + your Tested Designs of it.']); }
export function kanbanCard(idx) {
    const rows = D.KANBAN[idx];
    return tip('kanban', 'Kanban Order card', rows.map(r => r.map(x => T.P[x]).join(' + ')).join(' / '), ['Placed with 4 symbols on one side of the line, 2 on the other.', 'A symbol adds a Part when it is on its warehouse\'s side.']);
}

// ================================================================ explain mode: what a dock answer would do
export function choice(st, pr, v) {
    const q = pr.kind === 'menu' ? 'menu' : pr.q;
    if (q === 'menu') {
        const a = pr.acts.find(x => x.k === v.a && (v.d === undefined || x.d === v.d) && (v.g === undefined || x.g === v.g));
        const why = a?.why ? `Unavailable: ${T.BLOCK[a.why] || a.why}.` : '';
        const L = {
            train: ['1 Shift: move 1 space on this training track.', 'Space 3 certifies you: a Certification track move and a department benefit.'],
            book: ['Free: return a Book to move 1 training space.'],
            design: ['1 Shift each: move a Design to your desk.', 'Columns 3 and 4 give a Banked Shift or a Book.', 'Certified: also the tops of the stacks.'],
            kanban: ['Once a turn, 1 Shift: bank 1 Shift and stock the warehouses from a Kanban card.'],
            collect: ['1 Shift: take any number of Parts from one warehouse.'],
            voucher: ['Once a turn, 1 Shift: take a Parts Voucher.'],
            provide: ['1 Shift: add a Part to a car. Its line moves; a car pushed off scores 1 or 2 PP.', 'Each Model needs different Parts; Upgraded Parts first.'],
            claim: ['Take a car from the test track with a matching Design (the Design goes back).', 'Cost by position: 1, 2, 2, 3 Shifts. The garage bonus is yours.'],
            upgrade: ['1 Shift: a Design plus its Part on an upgrade space: 2 PP, the space bonus, and the Part\'s value rises.'],
            charger: ['Once a turn, 1 Shift: a Charger token with a permanent ability.'],
            recycle: ['Free: swap one of your Parts for one in Recycling.'],
            sg: ['Free: use your special garage tile.'],
            flip: ['Free: flip this garage tile and gain its bonus.'],
            end: ['Finish your turn. New Books, Vouchers and Banked Shifts become usable.'],
        }[v.a] || [];
        return tip(T.ACT[v.a]?.ic || 'help', T.ACT[v.a]?.name || v.a, v.d ? T.DN[v.d] : '', [...L, why].filter(Boolean));
    }
    switch (q) {
        case 'station': {
            const d = deptOf(v);
            const pushes = planOutlook(st).filter(o => o.opts).flatMap(o => o.opts.filter(x => x.ws === v).map(x =>
                `${N[o.w]} lands here if he gets the ${x.take === 't' ? 'top' : 'bottom'} Plan card (${T.DN[D.plan(x.id).d]}). Taking it pushes him to the next department.`));
            return tip(d, T.wsName(v), `${wsShifts(v)} Shift${wsShifts(v) > 1 ? 's' : ''}`, [`Work in ${T.DN[d]} today.`, ...pushes, 'Higher workstations act earlier and choose earlier tomorrow.']);
        }
        case 'certStart': case 'certSpace': {
            const sec = q === 'certStart' ? 0 : pr.sec;
            return tip('cert', `Space ${v + 1}`, D.CERT[sec][v].map(b => T.ben(b).txt).join(' + ') || 'No benefit', ['Further right acts earlier in Meetings.']);
        }
        case 'design': return v.id ? design(v.id, st) : tip('design', 'Design', '', []);
        case 'kanbanLayout': {
            const L = D.KANBAN_LAYOUTS.find(l => l.k === v);
            const r = kanbanAdds(pr.card, L);
            return tip('kanban', 'Kanban layout', `+${r.out.length} Parts`, [r.out.map(x => T.P[x]).join(', ') || 'No Parts']);
        }
        case 'provide': return tip(v.part, `${T.P[v.part]} to ${T.M[v.m]}`, v.src === 'voucher' ? 'Uses a Voucher' : 'From storage', ['The car on the start space moves one step; cars it bumps move on.']);
        case 'upgSpace': return upgSpace(st, pr.m, v);
        case 'double': return tip('upgraded', 'Double-Upgrade', v === 'yes' ? 'Use it' : 'Save it', ['Once per game: the Part value rises 2 and you score its new value.', 'Each Part can be Double-Upgraded once by anyone.']);
        case 'route': return tip(T.routeDir(pr.from, v), T.placeName(v), '', [v in D.EXIT_PP ? `Off the line: ${D.EXIT_PP[v]} PP, then the test track.` : 'The car stops on that plate; any car there is bumped on.']);
        case 'meet':
            if (v.a === 'pass') return tip('skip', 'Pass', '', ['You can speak again on a later turn. The Meeting ends when everyone passes in a row.']);
            if (v.a === 'play') return tip('pg', `Play goal ${v.id}`, v.tok ? `+ token: ${speakValueHand(st, v.id)} PP` : 'No token', ['You must play one goal each Meeting.', 'It joins the table; anyone may speak on it.']);
            return pg(st, v.id);
        case 'garage': return garage(st, v);
        case 'chargerSlot': return charger(st, v);
        case 'special': case 'planner': case 'delayTile': return tip(T.GARAGE[v].ic, 'Garage tile', T.GARAGE[v].txt, []);
        case 'kanbanCard': return kanbanCard(v);
        case 'collectWare': return tip(v, `${T.P[v]} warehouse`, `${st.ware[v]} here`, [`Take up to ${Math.min(st.ware[v], pr.room)} into storage for 1 Shift.`]);
        case 'collectNum': return tip(pr.part, `Take ${v}`, T.P[pr.part], ['Each needs a storage space.']);
        case 'recycle': return tip('recycle', 'Recycle', `${T.P[v.give]} for ${T.P[v.take]}`, ['Your Part goes into Recycling; you take the other.']);
        case 'claimCar': return slot(st, v.i);
        case 'claimDesign': return tip('design', T.designName(v), 'Goes back', ['It goes to the bottom of the Central stack.', D.dPart(v) ? 'Keep upgradeable Designs if you plan to upgrade them.' : 'Blank Designs cannot be upgraded anyway.']);
        case 'upgDesign': return design(v, st);
        case 'upgSource': return tip(v === 'store' ? 'supply' : v === 'voucher' ? 'voucher' : 'charger', { store: 'Your storage', voucher: 'Parts Voucher', free: 'Supply (Charger)' }[v], T.P[pr.part], [v === 'store' ? 'Uses the Part from your storage.' : v === 'voucher' ? 'Spends a Voucher; the Part comes from the supply.' : 'Your R&D Charger ability: free supply Part, once a visit.']);
        case 'adminOther': return v === 'none' ? tip('adm', 'Admin only', '', ['Every Shift and Book trains Admin.']) : tip(v, T.DN[v], 'With Admin', [`Spend Shifts on ${T.DN[v]} tasks or on training either track.`]);
        case 'train2': return track(st, v);
        case 'nextPG': return tip(T.pgIcon(v), `Goal ${v} to the next Meeting`, `${D.pg(v).pp} PP per ${T.pgText(v)}`, ['It joins the next Meeting table. The goal you keep stays in hand.']);
        case 'eodRecycle': return tip('recycle', 'Recycling swap', `${T.P[v.out]} out, ${T.P[v.in]} in`, ['End of day Plan card swap.']);
        case 'avoid': return tip(v === 'yes' ? 'star' : 'x', v === 'yes' ? 'Avoid it' : 'Take the penalty', `${pr.pen} PP`, [v === 'yes' ? 'Uses up your special garage tile.' : 'Keeps the tile for a bigger penalty.']);
        case 'stations': case 'botTurn': case 'sandra': case 'eod': return tip('check', 'OK', '', ['Carry on.']);
        case 'collect': return tip('warehouse', 'Collect', '', []);
    }
    return tip('help', String(typeof v === 'object' ? JSON.stringify(v) : v), '', []);
}
function speakValueHand(st, id) {
    const c = D.pg(id);
    return Math.min(pgCount(st, id), c.m[0]) * c.pp;
}
export { sandraValue, canDouble, canAssemble };
