// @ts-check
// Game state, rule queries and the task runner.
// Flow is a stack of plain-object tasks; a handler finishes (returns DONE), pushes sub-tasks,
// or asks the human (st.prompt). State is plain JSON, so a snapshot is a save, an undo point
// and a share code.
import * as D from './data.js';
import { shuffle, pick, rand } from './rng.js';

export const DONE = 'done';
/** @type {Record<string, (st:any, t:any, a?:{v:any}) => any>} */
export const H = {};
export const BOTS = ['L', 'T'];
export const NAME = { you: 'You', L: 'Mr Lacerda', T: 'Mr Turczi', S: 'Sandra' };

// ================================================================ new game
/**
 * @param {{seed?:number, color?:string, nice?:boolean, planner?:boolean, expert?:boolean, delayed?:boolean,
 *   special?:boolean, charger?:boolean, addons?:boolean, diff?:number[], noFire?:boolean, sandbox?:boolean}} o
 */
export function newGame(o = {}) {
    const opts = {
        color: o.color || 'blue', nice: !!o.nice, planner: !!o.planner, expert: !!o.expert, delayed: !!o.delayed,
        special: !!o.special, charger: !!o.charger, addons: !!(o.addons && o.charger), sandbox: !!o.sandbox, noFire: !!(o.noFire || o.sandbox),
        diff: (o.diff || []).filter(id => !(o.noFire && id === 9)).slice().sort((a, b) => a - b),
    };
    const st = {
        v: 1, rng: (o.seed ?? Math.floor(Math.random() * 2 ** 31)) | 0, opts,
        day: 1, phase: 'setup', week: 0, cycle: 0, weeks: 0, meetings: 0, meetingDue: false,
        over: false, fired: false, result: null,
        pace: 0, track: /** @type {(string|null)[]} */ ([]),
        asm: { at: /** @type {Record<string,string|null>} */ ({}), sp: /** @type {Record<string,string[]>} */ ({}) },
        carSupply: /** @type {Record<string,number>} */ ({}),
        upg: /** @type {Record<string,(string|null)[]>} */ ({}),
        val: /** @type {Record<string,number>} */ ({}), dbl: /** @type {Record<string,boolean>} */ ({}),
        ware: /** @type {Record<string,number>} */ ({}), supply: /** @type {Record<string,number>} */ ({}),
        recycle: /** @type {string[]} */ ([]),
        kanbanDeck: /** @type {number[]} */ ([]), kanbanShown: /** @type {any} */ (null),
        design: { central: /** @type {string[]} */ ([]), fo: [[], []], disp: [[null, null, null, null], [null, null, null, null]] },
        pg: { deck: /** @type {number[]} */ ([]), room: /** @type {number[]} */ ([]), table: /** @type {number[]} */ ([]), tok: /** @type {Record<string,string[]>} */ ({}) },
        finalGoal: 0,
        factory: /** @type {{g:string,n:number,tok:number}[]} */ ([]),
        award: /** @type {Record<string,{tile:string|null,tok:number}>} */ ({}),
        demand: /** @type {{m:string,tok:number}[]} */ ([]), demandDeck: /** @type {string[]} */ ([]), demandAside: /** @type {string[]} */ ([]),
        firstCert: /** @type {Record<string,string>} */ ({}), firstExpert: /** @type {Record<string,string>} */ ({}),
        pos: /** @type {Record<string,number|null>} */ ({ you: null, L: null, T: null, S: D.DESK }),
        plan: { deck: /** @type {number[]} */ ([]), discard: /** @type {number[]} */ ([]), col: /** @type {number[]} */ ([]), card: /** @type {Record<string,number|null>} */ ({ L: null, T: null }) },
        sel: { deck: /** @type {number[]} */ ([]), discard: /** @type {number[]} */ ([]), card: /** @type {Record<string,number|null>} */ ({ L: null, T: null }) },
        bots: {
            L: newBot(1), T: newBot(0),
            stack: /** @type {string[]} */ ([]), parts: /** @type {string[]} */ ([]),
        },
        p: newYou(),
        chargerSupply: D.CHARGER_SUPPLY,
        tseq: 0,
        turn: /** @type {any} */ (null), stack: /** @type {any[]} */ ([]), prompt: /** @type {any} */ (null),
        log: /** @type {any[]} */ ([]), seq: 0, notes: /** @type {any[]} */ ([]),
    };

    // ---- cars, parts, upgrades
    D.MODELS.forEach(m => {
        st.asm.at['s:' + m] = m; st.asm.at[D.START_PLATE[m]] = m;
        st.asm.sp[m] = [];
        st.carSupply[m] = D.CARS_PER_MODEL - 2;
        st.upg[m] = [null, null, null, null, null, null];
    });
    D.PLATES.forEach(pl => { if (!(pl in st.asm.at)) st.asm.at[pl] = null; });
    D.PARTS.forEach(pt => { st.val[pt] = 0; st.dbl[pt] = false; st.ware[pt] = 0; st.supply[pt] = D.PARTS_PER_TYPE; });
    st.recycle = shuffle(st, [...D.PARTS]).slice(0, 3);
    st.recycle.forEach(pt => st.supply[pt]--);

    // ---- Kanban: reveal one card to stock the warehouses, then it goes to the bottom
    st.kanbanDeck = shuffle(st, D.KANBAN.map((_, i) => i));
    const first = st.kanbanDeck.shift();
    D.KANBAN[first].flat().forEach(pt => { if (st.supply[pt] > 0) { st.supply[pt]--; st.ware[pt]++; } });
    st.kanbanDeck.push(first);
    st.p.kanban = [st.kanbanDeck.shift(), st.kanbanDeck.shift()];
    const missing = D.PARTS.find(pt => !D.KANBAN[first].flat().includes(pt));

    // ---- Designs: 8 in the display, 3 stacks of 9; the Colleagues take 4 upgradeable ones from the Central stack
    const designs = shuffle(st, [...D.DESIGNS]);
    for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) st.design.disp[r][c] = designs.shift();
    st.design.central = designs.splice(0, 9);
    st.design.fo = [designs.splice(0, 9), designs.splice(0, 9)];
    const up = st.design.central.filter(id => D.dPart(id));
    const take = shuffle(st, up).slice(0, 4);
    st.bots.stack = take;
    st.design.central = shuffle(st, st.design.central.filter(id => !take.includes(id)));

    // ---- Performance Goals, Final Goal, Factory Goals, Awards, Demand
    st.pg.deck = shuffle(st, D.PG.filter(c => !c.addon || opts.addons).map(c => c.id));
    st.pg.room = st.pg.deck.splice(0, 4);
    st.p.hand = st.pg.deck.splice(0, 4);
    st.finalGoal = pick(st, D.FINAL.filter(f => !f.addon || opts.addons)).id;
    st.factory = Object.entries(D.FACTORY).map(([g, ns]) => ({ g, n: pick(st, ns), tok: 1 }));
    const awards = shuffle(st, D.AWARDS.flatMap(a => [a, a, a, a, a]));
    D.DEPTS.forEach(d => st.award[d] = { tile: awards.pop(), tok: 1 });
    st.demandDeck = shuffle(st, [...D.MODELS]);
    st.demand = [0, 1].map(() => { const m = st.demandDeck.shift(); return { m, tok: D.DEMAND[m] }; });

    // ---- the Colleagues' decks
    st.plan.deck = shuffle(st, D.PLAN.map(c => c.id));
    st.plan.col = st.plan.deck.splice(0, 3);
    st.plan.deck.push(D.RESHUFFLE);
    st.sel.deck = shuffle(st, D.SELECTION.map(c => c.id));

    // ---- your starting Design and Part
    st.p.desk.push(st.design.central.shift());
    st.supply[missing]--; st.p.parts.push(missing);

    if (opts.charger) st.p.chargers = [false, false, false, false, false];
    log(st, 'sys', 'start', 'Game start');
    st.stack.push({ t: 'game', s: 'start' });
    run(st);
    return st;
}

function newBot(start) {
    return { tr: [start, start, start, start, start], ts: [0, 0, 0, 0, 0], cert: [0, 0], cars: /** @type {string[]} */ ([]), upgd: /** @type {string[]} */ ([]), pts: 0 };
}
function newYou() {
    return {
        pp: D.START_PP, maxPP: D.START_PP,
        tr: [0, 0, 0, 0, 0], ts: [0, 0, 0, 0, 0], cert: [0, 0],
        bank: 0, books: 0, vouchers: 1, pend: { shift: 0, book: 0, voucher: 0 },
        parts: /** @type {string[]} */ ([]), desk: /** @type {string[]} */ ([]), upgd: /** @type {string[]} */ ([]),
        garages: /** @type {{car:string|null, tile:string|null, flipped:boolean, ready?:boolean}[]} */ ([]),
        aside: /** @type {string[]} */ ([]),
        kanban: /** @type {number[]} */ ([]), hand: /** @type {number[]} */ ([]),
        sp: 1, spSide: D.SPEECH_TOKENS - 1, gen: 0,
        dblUsed: false, chargers: /** @type {boolean[]|null} */ (null),
        sg: /** @type {{tile:string, used:boolean, live:boolean}|null} */ (null), sgSpeech: 0, avoidUsed: false,
    };
}

// ================================================================ runner
export function top(st) { return st.stack[st.stack.length - 1]; }

export function run(st) {
    let guard = 0;
    while (!st.prompt && st.stack.length) {
        if (++guard > 50000) throw new Error('runaway task loop at ' + JSON.stringify(top(st)));
        if (st.fired && (st.opts.noFire || st.opts.sandbox)) st.fired = false; // house rule: no firing (and tests)
        if (st.fired && !st.over && top(st).t !== 'over') { st.stack = [{ t: 'over' }]; continue; }
        const t = top(st);
        const h = H[t.t];
        if (!h) throw new Error('no handler for task ' + t.t);
        if (h(st, t) === DONE) remove(st, t);
    }
    return st;
}

/** Apply the human's answer to the current prompt. */
export function answer(st, v) {
    if (!st.prompt) throw new Error('no prompt to answer');
    const t = top(st);
    st.prompt = null;
    if (H[t.t](st, t, { v }) === DONE) remove(st, t);
    return run(st);
}
function remove(st, t) {
    const i = st.stack.lastIndexOf(t);
    if (i >= 0) st.stack.splice(i, 1);
}
export function push(st, task) { st.stack.push(task); }
export function ask(st, p) { st.prompt = Object.assign({ id: ++st.seq }, p); }
export function log(st, who, k, text, extra) {
    st.log.push(Object.assign({ d: st.day, w: who, k, text }, extra || {}));
}

// ================================================================ positions
export const deptOf = ws => ws === null || ws === undefined ? null : ws === D.DESK ? 'adm' : D.DEPTS[Math.floor(ws / 2)];
export const posOf = ws => ws === D.DESK ? 'desk' : ws % 2 ? 'bottom' : 'top';
export const wsShifts = ws => D.WS_SHIFTS[deptOf(ws)][ws % 2];
export const occupant = (st, ws) => Object.keys(st.pos).find(k => st.pos[k] === ws) || null;
export const sandraDept = st => deptOf(st.pos.S);
export const di = d => D.DEPTS.indexOf(d);

// ================================================================ the human: derived values
export const isCert = (st, who, d) => track(st, who)[di(d)] >= D.CERTIFIED;
export const track = (st, who) => who === 'you' ? st.p.tr : st.bots[who].tr;
export const certCount = (st, who = 'you') => track(st, who).filter(x => x >= D.CERTIFIED).length;
export const expertCount = st => st.p.tr.filter(x => x >= D.EXPERT).length;
export const deskCap = st => D.DESK_SPACES + (isCert(st, 'you', 'des') ? 1 : 0);
export const storeCap = st => D.STORAGE_SPACES + (isCert(st, 'you', 'log') ? 1 : 0);
export const slotCap = st => D.SPEECH_SLOTS + (isCert(st, 'you', 'adm') ? 1 : 0);
export const garageOpen = (st, g) => g < 4 || isCert(st, 'you', 'asm');
export const myCars = st => st.p.garages.filter(g => g.car).map(g => g.car);
export const partValue = (st, part) => D.VALUE[st.val[part]];
/** Upgraded Designs whose Model you have in a garage. */
export const tested = st => { const cars = myCars(st); return st.p.upgd.filter(id => cars.includes(D.dModel(id))); };
export const upgCount = (st, m) => st.upg[m].filter(Boolean).length;
export const freeStorage = st => storeCap(st) - st.p.parts.length;

// ================================================================ gains
/** Add PP to you (negative for losses). */
export function addPP(st, n, why) {
    if (!n) return;
    st.p.pp += n;
    if (st.phase !== 'final') st.p.maxPP = Math.max(st.p.maxPP, st.p.pp);
    log(st, n > 0 ? 'you' : 'sys', 'pp', why ? why[0].toUpperCase() + why.slice(1) : 'PP', { pp: n });
    if (hasDiff(st, 9) && st.p.pp <= 0 && st.phase !== 'setup') st.fired = true;
}
/** A Colleague "gains" PP: you lose it. */
export function botPP(st, who, n, why) {
    if (!n) return;
    st.bots[who].pts += n;
    st.p.pp -= n;
    log(st, who, 'pp', `${NAME[who]}: ${why[0].toUpperCase() + why.slice(1)}`, { pp: -n });
    if (hasDiff(st, 9) && st.p.pp <= 0) st.fired = true;
}
export const hasDiff = (st, id) => st.opts.diff.includes(id);
/** Every PP change logged since log index `from`: [{ text, pp, w }]. */
export function ppSince(st, from) {
    return st.log.slice(from).filter(l => l.pp).map(l => ({ text: l.text, pp: l.pp, w: l.w }));
}

/** Books, Vouchers and Banked Shifts gained during your turn wait beside the board. */
export function gain(st, item, n = 1) {
    if (n <= 0) return;
    if (item === 'speech') { for (let i = 0; i < n; i++) gainSpeech(st); return; }
    if (item === 'pp') { addPP(st, n); return; }
    const key = { shift: 'bank', book: 'books', voucher: 'vouchers' }[item];
    if (st.turn && st.turn.who === 'you') st.p.pend[item] += n;
    else st.p[key] += n;
    if (item === 'shift') capBank(st);
}
export function capBank(st) {
    const p = st.p;
    if (p.bank + p.pend.shift > D.SHIFT_BANK_MAX) {
        const over = p.bank + p.pend.shift - D.SHIFT_BANK_MAX;
        const fromPend = Math.min(over, p.pend.shift);
        p.pend.shift -= fromPend; p.bank -= over - fromPend;
    }
}
/** Gaining a Generic Speech token: one of yours goes onto an empty slot, else keep the generic. */
export function gainSpeech(st) {
    const p = st.p;
    if (p.sp < slotCap(st) && p.spSide > 0) { p.sp++; p.spSide--; }
    else p.gen++;
}
export function settlePending(st) {
    const p = st.p;
    p.bank += p.pend.shift; p.books += p.pend.book; p.vouchers += p.pend.voucher;
    p.pend = { shift: 0, book: 0, voucher: 0 };
    capBank(st);
}

// ================================================================ parts
/** Take a part from the supply (if any). */
export function fromSupply(st, part) {
    if (st.supply[part] <= 0) return false;
    st.supply[part]--; return true;
}
export function toSupply(st, part, n = 1) { st.supply[part] += n; }

// ================================================================ assembly rules
/** Can `part` go into Model m's assembly spaces now? Upgraded Parts first (unless ignore). */
export function canAssemble(st, m, part, ignoreUpgradeOrder = false) {
    const have = st.asm.sp[m];
    if (have.length >= D.ASM_SPACES[m]) return false;
    if (have.includes(part)) return false;
    if (ignoreUpgradeOrder) return true;
    const upgraded = st.upg[m].filter(Boolean);
    if (upgraded.includes(part)) return true;
    return upgraded.every(u => have.includes(u));
}
/** Return Parts of every Model whose assembly spaces are all full. */
export function cleanFullLines(st) {
    const out = [];
    for (const m of D.MODELS) if (st.asm.sp[m].length >= D.ASM_SPACES[m]) {
        st.asm.sp[m].forEach(pt => toSupply(st, pt));
        st.asm.sp[m] = []; out.push(m);
    }
    return out;
}

// ================================================================ designs
/** Slide Designs right in both rows, then refill from the row's First Office stack, then Central. */
export function refillDesigns(st) {
    const ds = st.design;
    for (let r = 0; r < 2; r++) {
        const row = ds.disp[r].filter(Boolean);
        ds.disp[r] = [...Array(4 - row.length).fill(null), ...row];
    }
    for (let r = 0; r < 2; r++) {
        for (let c = 3; c >= 0; c--) {
            if (ds.disp[r][c]) continue;
            const id = ds.fo[r].length ? ds.fo[r].shift() : ds.central.length ? ds.central.shift() : null;
            if (!id) break;
            ds.disp[r][c] = id;
        }
    }
}
/** Taking the last tile of a First Office stack refills it from the Central stack. */
export function takeFO(st, r) {
    const id = st.design.fo[r].shift();
    if (!st.design.fo[r].length && st.design.central.length) st.design.fo[r].push(st.design.central.shift());
    return id;
}

// ================================================================ test track
/** Advance the Pace Car n spaces; returns true if it reached or crossed a striped space. */
export function advancePace(st, n) {
    let stripe = false;
    for (let i = 0; i < n; i++) { st.pace = (st.pace + 1) % D.TRACK_LEN; if (st.pace % D.STRIPE_EVERY === 0) stripe = true; }
    if (stripe && !st.meetingDue) { st.meetingDue = true; log(st, 'sys', 'meeting', 'Pace Car on a stripe: Meeting tonight'); }
    st.track = st.track.filter(Boolean);
    return stripe;
}
/** A car rolls onto the test track. At most 4: the one behind the Pace Car leaves. */
export function toTestTrack(st, m) {
    st.track = st.track.filter(Boolean);
    st.track.push(m);
    if (st.track.length > D.TRACK_SLOTS) { const out = st.track.shift(); st.carSupply[out]++; return out; }
    return null;
}

// ================================================================ order
/** Certification track order, right to left: higher section first, then higher space. */
export function certOrder(st) {
    const c = { you: st.p.cert, L: st.bots.L.cert, T: st.bots.T.cert };
    return ['you', 'L', 'T'].sort((a, b) => (c[b][0] - c[a][0]) || (c[b][1] - c[a][1]));
}
/** Workstation order top to bottom (Sandra's desk last). */
export function wsOrder(st, who = ['you', 'L', 'T', 'S']) {
    return who.filter(k => st.pos[k] !== null).sort((a, b) => st.pos[a] - st.pos[b]);
}
export function certSpaceTaken(st, sec, sp, except) {
    return ['you', 'L', 'T'].some(k => k !== except && (k === 'you' ? st.p.cert : st.bots[k].cert)[0] === sec && (k === 'you' ? st.p.cert : st.bots[k].cert)[1] === sp);
}

// ================================================================ training-track leaders
/** Who is furthest ahead on a track (ties: most recent arrival). null if nobody trained. */
export function trackLeader(st, i) {
    const c = [['you', st.p.tr[i], st.p.ts[i]], ['L', st.bots.L.tr[i], st.bots.L.ts[i]], ['T', st.bots.T.tr[i], st.bots.T.ts[i]]];
    c.sort((a, b) => (b[1] - a[1]) || (b[2] - a[2]));
    return c[0];
}
/** Lowest (or highest, Nice Sandra) training on a track: everyone tied there. */
export function evaluated(st, i, most) {
    const v = { you: st.p.tr[i], L: st.bots.L.tr[i], T: st.bots.T.tr[i] };
    const target = most ? Math.max(...Object.values(v)) : Math.min(...Object.values(v));
    return Object.keys(v).filter(k => v[k] === target);
}

// ================================================================ performance goals
/** How many times you meet a Performance Goal right now. */
export function pgCount(st, id) {
    const c = D.pg(id), p = st.p;
    const cars = myCars(st);
    switch (c.c) {
        case 'cars': return cars.length;
        case 'models': return new Set(cars).size;
        case 'model': return cars.filter(m => m === c.x).length;
        case 'upgPart': return p.upgd.filter(id2 => D.dPart(id2) === c.x).length;
        case 'upg': return p.upgd.length;
        case 'tested': return tested(st).length;
        case 'parts2': return p.parts.filter(pt => c.x.includes(pt)).length;
        case 'garages': return c.x.filter(g => p.garages[g]?.car).length;
        case 'certIn': return isCert(st, 'you', c.x) ? 1 : 0;
        case 'designs': return p.desk.length;
        case 'books': return p.books + p.pend.book;
        case 'certs': return certCount(st);
        case 'vouchers': return p.vouchers + p.pend.voucher;
        case 'shifts': return p.bank + p.pend.shift;
        case 'speech': return p.sp;
        case 'chargers': return (p.chargers || []).filter(Boolean).length;
        case 'chargerAt': return p.chargers?.[c.x] ? 1 : 0;
    }
    return 0;
}
/** Next free speech icon on a table card: index into its multipliers, or -1 if full. */
export function pgSlot(st, id) {
    const used = (st.pg.tok[id] || []).length;
    return used < D.pg(id).m.length ? used : -1;
}

// ================================================================ final goals
export function finalMet(st, a) {
    const p = st.p, cars = myCars(st);
    const byModel = m => cars.filter(x => x === m).length;
    const upParts = p.upgd.map(D.dPart);
    switch (a.c) {
        case 'sameModel': return D.MODELS.some(m => byModel(m) >= a.n);
        case 'upgDiffParts': return new Set(upParts).size >= a.n;
        case 'certs': return certCount(st) >= a.n;
        case 'cars': return cars.length >= a.n;
        case 'upg': return p.upgd.length >= a.n;
        case 'diffModels': return new Set(cars).size >= a.n;
        case 'upgSamePart': return D.PARTS.some(pt => upParts.filter(x => x === pt).length >= a.n);
        case 'certBoth': return a.x.every(d => isCert(st, 'you', d));
        case 'shifts': return p.bank >= a.n;
        case 'books': return p.books >= a.n;
        case 'experts': return expertCount(st) >= a.n;
        case 'model': return byModel(a.x) >= a.n;
        case 'upgPart': return upParts.filter(x => x === a.x).length >= a.n;
        case 'tested': return tested(st).length >= a.n;
        case 'certsMax': return certCount(st) <= a.n;
        case 'testedDiffParts': return new Set(tested(st).map(D.dPart)).size >= a.n;
        case 'expertsMax': return expertCount(st) <= a.n;
        case 'chargers': return (p.chargers || []).filter(Boolean).length >= a.n;
        case 'certCharger': return isCert(st, 'you', a.x) && !!p.chargers?.[a.pos];
        case 'chargersAt': return a.x.every(i => p.chargers?.[i]);
        case 'vouchers': return p.vouchers >= a.n;
        case 'speech': return p.sp >= a.n;
    }
    return false;
}

// ================================================================ scoring
/** End-of-week PP for you: per car, upgrades to its Model plus your Tested Designs of it. */
export function weekScore(st) {
    const t = tested(st);
    return myCars(st).reduce((s, m) => s + upgCount(st, m) + t.filter(id => D.dModel(id) === m).length, 0);
}
/** Your final scoring, steps 2 to 6 plus expansions (step 1, the Final Goal, is spent separately). */
export function finalScore(st) {
    const p = st.p, cars = myCars(st);
    const sc = {
        shifts: p.bank,
        tokens: p.sp + p.gen + p.sgSpeech + p.books + p.vouchers,
        cars: cars.reduce((s, m) => s + D.CAR_VALUE[m], 0),
        training: D.DEPTS.reduce((s, d, i) => { const l = trackLeader(st, i); return s + (l[0] === 'you' && l[1] > 0 ? 5 : 0); }, 0),
        tested: tested(st).reduce((s, id) => s + partValue(st, D.dPart(id)), 0),
        chargers: (p.chargers || []).filter(Boolean).length * cars.length,
        special: p.sg?.tile === 'sgCarValue' && p.garages[4]?.car ? D.CAR_VALUE[p.garages[4].car] : 0,
    };
    return sc;
}
/** The Colleagues' final scoring (you lose this much). */
export function botFinalScore(st) {
    const b = st.bots;
    return {
        training: D.DEPTS.reduce((s, d, i) => { const l = trackLeader(st, i); return s + (l[0] !== 'you' && l[1] > 0 ? 5 : 0); }, 0),
        designs: 2 * (b.L.upgd.length + b.T.upgd.length + b.stack.length),
        cars: [...b.L.cars, ...b.T.cars].reduce((s, m) => s + D.CAR_VALUE[m], 0),
        parts: b.parts.reduce((s, pt) => s + Math.max(D.BOT_PART_MIN, partValue(st, pt)), 0),
    };
}
export const sum = o => Object.values(o).reduce((a, b) => a + b, 0);

/** Highest rank whose criteria you meet (null if none). */
export function rankOf(st) {
    const p = st.p, cars = myCars(st), t = tested(st), certs = certCount(st), pp = p.pp;
    const tv = t.reduce((s, id) => s + partValue(st, D.dPart(id)), 0);
    const byModel = m => cars.filter(x => x === m).length;
    const musk = (D.MODELS.some(m => byModel(m) >= 5 && t.filter(id => D.dModel(id) === m).length >= 6)
        || (new Set(cars).size >= 5 && D.MODELS.every(m => t.some(id => D.dModel(id) === m)))) && st.p.maxPP < 20 && pp >= 50;
    if (musk) return 1;
    if (pp >= 50 && new Set(cars).size >= 5 && tv >= 30 && p.bank >= 8 && certs >= 5) return 2;
    if (pp >= 30 && cars.length >= 3 && tv >= 12 && p.bank >= 5 && certs >= 4) return 3;
    if (pp >= 15 && t.length >= 2 && p.bank >= 2 && certs >= 2) return 4;
    if (pp >= 1 && t.length >= 2) return 5;
    return null;
}

// ================================================================ invariants (tests and sims)
export function partCount(st) {
    const n = {};
    D.PARTS.forEach(pt => n[pt] = st.supply[pt] + st.ware[pt]);
    st.recycle.forEach(pt => n[pt]++);
    st.p.parts.forEach(pt => n[pt]++);
    st.bots.parts.forEach(pt => n[pt]++);
    D.MODELS.forEach(m => { st.asm.sp[m].forEach(pt => n[pt]++); st.upg[m].forEach(pt => { if (pt) n[pt]++; }); });
    return n;
}
export function carCount(st) {
    const n = {};
    D.MODELS.forEach(m => n[m] = st.carSupply[m]);
    Object.values(st.asm.at).forEach(m => { if (m) n[m]++; });
    st.track.forEach(m => { if (m) n[m]++; });
    st.p.garages.forEach(g => { if (g.car) n[g.car]++; });
    [...st.bots.L.cars, ...st.bots.T.cars].forEach(m => n[m]++);
    st.stack.forEach(t => { if (t.t === 'roll' && t.mover) n[t.mover]++; }); // a bumped car waiting for your route
    return n;
}
export { shuffle, pick, rand };
