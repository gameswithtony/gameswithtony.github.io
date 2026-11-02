// @ts-check
// Game state, rule helpers and the task runner.
// Flow is a stack of plain-object tasks; a task handler either finishes (returns DONE),
// pushes sub-tasks, or asks the human a question (st.prompt). Everything is JSON, so a
// snapshot of the state is a complete save / undo point.
import * as D from './data.js';
import { HEXES, neighbors, dist, onMap, step, cardOrder } from './hex.js';
import { shuffle, pick } from './rng.js';

export const DONE = 'done';
export const YOU = 0, PF = 1;
/** @type {Record<string, (st:any, t:any, a?:{v:any}) => any>} task handlers */
export const H = {};

// ================================================================ new game
/**
 * @param {{seed?:number, difficulty?:'rookie'|'chief'|'legend', length?:'short'|'long', firstGame?:boolean}} opts
 */
export function newGame(opts = {}) {
    const st = {
        v: 1,
        rng: (opts.seed ?? Math.floor(Math.random() * 2 ** 31)) | 0,
        opts: { difficulty: opts.difficulty || 'rookie', length: opts.length || 'short', firstGame: !!opts.firstGame },
        round: 1, phase: 'setup', endTriggered: false, final: false, over: false,
        level: 1,
        lss: { gen: 1, water: 1, green: 1, oxy: 1 },
        lssTiles: [],
        hex: {}, bots: [], rover: null,
        stacks: {},
        p: [newPlayer('you'), newPlayer('pf')],
        slots: { blueprint: [], rnd: [], construct: [], upgrade: [], hire: [] },
        grid: [],
        ware: {},
        bpTop: [], bpBot: [], bpDeck: [],
        discStack: [], explore: [], pfDisc: { 3: [], 4: [], 5: [] },
        sciSlots: [], contractDeck: [], sciLoc: {}, radar: {},
        missions: [], remaining: 3,
        shuttle: { side: 'orbit', pos: 1, gone: false, finalTravel: false },
        solo: { deck: [], discard: [], card: null, exhausted: false },
        turn: null, stack: [], prompt: null, log: [], seq: 0, flash: [],
        result: null,
    };
    HEXES.forEach(h => st.hex[h] = { b: null, crystal: 0, disc: null, res: null });

    // starting buildings
    st.hex[D.CENTER].b = { type: 'mine', adv: null, col: null, start: true };
    const lssTypes = shuffle(st, [...D.LSS_TYPES]);
    D.START_LSS.forEach((h, i) => st.hex[h].b = { type: lssTypes[i], adv: null, col: null, start: true });
    st.hex[D.START_SHELTER.you].b = { type: 'shelter', o: YOU, adv: null, col: null };
    st.hex[D.START_SHELTER.pf].b = { type: 'shelter', o: PF, adv: null, col: null };
    st.p[YOU].shelterTiles = D.SHELTERS_PER_PLAYER - 1;
    st.p[PF].shelterTiles = D.SHELTERS_PER_PLAYER - 1;
    st.bots.push({ o: YOU, h: D.START_SHELTER.you }, { o: PF, h: D.START_SHELTER.pf });

    // research tiles, one type per corner
    const letters = shuffle(st, ['A', 'B', 'C', 'D']);
    Object.values(D.RESEARCH_SPOTS).forEach((spots, i) => spots.forEach((h, j) => st.hex[h].res = letters[i] + (j + 1)));

    // building stacks
    for (const t of ['mine', 'gen', 'water', 'green', 'oxy']) {
        const tiles = [];
        for (let i = 0; i < D.TILES_PER_TYPE; i++) tiles.push({ id: t + i, arrows: i < D.TILE_ARROWS_PER_TYPE });
        st.stacks[t] = shuffle(st, tiles);
    }

    // tech grid (one set in 2p) + shelter techs
    st.grid = shuffle(st, [...D.GRID_TECHS]);
    st.p[YOU].lab['2b'] = 'shelter';
    st.p[PF].lab['2b'] = 'shelter';

    D.WARE.forEach(w => st.ware[w] = D.WARE_FILL);

    // blueprints: L1 on top of L3; 6 face up in the bottom row
    const l1 = shuffle(st, D.BLUEPRINTS.filter(b => b.lvl === 1).map(b => b.id));
    const l3 = shuffle(st, D.BLUEPRINTS.filter(b => b.lvl === 3).map(b => b.id));
    st.bpDeck = [...l1, ...l3];
    st.bpBot = st.bpDeck.splice(0, 6);
    st.bpTop = [null, null, null, null, null, null];

    // discovery: Pathfinder's LSS tiles come from the 13 non-resource tiles
    const nonRes = shuffle(st, D.DISCOVERY.filter(d => !d.res).map(d => d.id));
    st.pfDisc[3] = nonRes.splice(0, 1);
    st.pfDisc[4] = nonRes.splice(0, 2);
    st.pfDisc[5] = nonRes.splice(0, 3);
    st.discStack = shuffle(st, [...nonRes, ...D.DISCOVERY.filter(d => d.res).map(d => d.id)]);
    st.explore = st.discStack.splice(0, 2);

    // scientists + contracts
    st.sciSlots = D.SCIENTISTS.map(s => ({ s: s.id, c: null }));
    st.contractDeck = D.CONTRACTS.map(c => c.id);

    // LSS reward tiles
    st.lssTiles = shuffle(st, D.LSS_TILES.map(t => t.k)).slice(0, 4);

    // missions
    const shorts = shuffle(st, D.MISSIONS.filter(m => m.short).map(m => m.id));
    const longs = shuffle(st, D.MISSIONS.filter(m => !m.short).map(m => m.id));
    let ids = st.opts.firstGame ? [6, 9, 7]
        : st.opts.length === 'long' ? [shorts[0], longs[0], longs[1]] : [shorts[0], shorts[1], longs[0]];
    ids = shuffle(st, ids);
    st.missions = ids.map((id, i) => ({ id, at: 'ABC'[i], left: D.mission(id).need, done: false }));

    // private goals: 3 for you
    st.p[YOU].goals = shuffle(st, D.GOALS.map(g => g.id)).slice(0, 3);

    // solo deck
    st.solo.deck = shuffle(st, D.SOLO.map(c => c.id));

    // Pathfinder's starting turn-order space; shuttle on its side
    const pfSpace = pick(st, D.FIRST_COLONIST_SPACES);
    st.p[PF].space = pfSpace;
    st.p[PF].side = pfSpace <= 4 ? 'orbit' : 'colony';
    st.shuttle.side = st.p[PF].side;

    log(st, 'sys', 'start', `Game start · Pathfinder on ${pfSpace}`);
    st.stack.push({ t: 'game', s: 'start' });
    run(st);
    return st;
}

function newPlayer(/** @type {'you'|'pf'} */ who) {
    return {
        who, side: 'orbit', space: 0, done: false,
        res: who === 'you' ? { mineral: 1, battery: 1, water: 1, plant: 1, oxygen: 1 } : { mineral: 0, battery: 0, water: 0, plant: 0, oxygen: 0 },
        cr: who === 'you' ? 1 : 0, crP: 0,
        lab: /** @type {Record<string,string>} */ ({}),
        col: { lq: 3, wa: 0, sup: 9 },
        ships: [0, 1, 2, 3, 4], hangar: 0, shipsOut: 0,
        shelterTiles: 4, botsOff: 3, ab: 8,
        bps: /** @type {{id:number, h:string|null}[]} */ ([]),
        scis: /** @type {string[]} */ ([]),
        contracts: /** @type {{id:number, del:Record<string,number>, done:boolean}[]} */ ([]),
        goals: /** @type {number[]} */ ([]), goalDone: /** @type {number|null} */ (null),
        progress: /** @type {Record<string,boolean>} */ ({}),
        discs: /** @type {number[]} */ ([]), researches: /** @type {string[]} */ ([]),
        op: 0, opLog: /** @type {Record<string,number>} */ ({}),
    };
}

// ================================================================ runner
export function top(st) { return st.stack[st.stack.length - 1]; }

export function run(st) {
    let guard = 0;
    while (!st.prompt && st.stack.length) {
        if (++guard > 20000) throw new Error('runaway task loop at ' + JSON.stringify(top(st)));
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
    st.flash = [];
    if (H[t.t](st, t, { v }) === DONE) remove(st, t);
    return run(st);
}

function remove(st, t) {
    const i = st.stack.lastIndexOf(t);
    if (i >= 0) st.stack.splice(i, 1);
}

/** Push a task; returns undefined so handlers can `return push(...)`. */
export function push(st, task) { st.stack.push(task); }

/**
 * Ask the human. kind: pick | hex | num | ack | menu
 * @param {any} st @param {any} p
 */
export function ask(st, p) {
    st.prompt = Object.assign({ id: ++st.seq }, p);
}

export function log(st, who, k, text, extra) {
    st.log.push(Object.assign({ r: st.round, w: who, k, text }, extra || {}));
}

// ================================================================ map queries
export const B = (st, h) => st.hex[h].b;
export const botAt = (st, h) => st.bots.find(b => b.h === h);
export const roverHex = st => st.rover || D.CENTER;

/** Is there any piece (bot, rover, colonist, advanced marker) on this hex? */
export function hasPiece(st, h) {
    const b = B(st, h);
    return !!(botAt(st, h) || st.rover === h || (b && (b.adv || b.col !== null && b.col !== undefined)));
}
/** Completely empty hex (nothing at all). */
export function isEmpty(st, h) {
    const x = st.hex[h];
    return !x.b && !x.crystal && !x.disc && !x.res && !botAt(st, h) && st.rover !== h;
}
/** Bots/rovers may end here. */
export function canEnd(st, h, ignore) {
    const b = B(st, h);
    if (b && (b.adv || (b.col !== null && b.col !== undefined))) return false;
    const bot = botAt(st, h);
    if (bot && bot !== ignore) return false;
    if (st.rover === h && ignore !== 'rover') return false;
    return true;
}
/** Same building "type key": shelters are per player. */
export const tkey = b => b.type === 'shelter' ? 'shelter' + b.o : b.type;

/** Connected complex containing hex h (list of hexes). */
export function complexOf(st, h) {
    const b0 = B(st, h);
    if (!b0) return [];
    const k = tkey(b0), seen = new Set([h]), q = [h];
    while (q.length) {
        const c = q.pop();
        for (const n of neighbors(c)) {
            const b = B(st, n);
            if (b && !seen.has(n) && tkey(b) === k) { seen.add(n); q.push(n); }
        }
    }
    return [...seen];
}
export function buildingsOf(st, type, owner) {
    return HEXES.filter(h => { const b = B(st, h); return b && b.type === type && (type !== 'shelter' || b.o === owner); });
}
export function countType(st, type) { return HEXES.filter(h => B(st, h)?.type === type).length; }

/** Building zone of a player's bots. */
export function zoneOf(st, pi) {
    const z = new Set();
    st.bots.filter(b => b.o === pi).forEach(b => { z.add(b.h); neighbors(b.h).forEach(n => z.add(n)); });
    return z;
}

// ================================================================ techs
/** Find a tech tile: {o, pos, level}. Shelter tech is per owner. */
export function techTile(st, type, owner) {
    for (let o = 0; o < 2; o++) {
        if (type === 'shelter' && o !== owner) continue;
        const lab = st.p[o].lab;
        for (const pos in lab) if (lab[pos] === type) return { o, pos, level: labCol(pos) };
    }
    return null;
}
export const labCol = pos => +pos[0];
export const labSpace = pos => D.LAB.find(l => l.k === pos);
/** Empty lab spaces to the right of pos. */
export function devTargets(p, pos) {
    const s = labSpace(pos);
    return D.LAB.filter(l => l.col === s.col + 1 && Math.abs(l.y - s.y) === 1 && !p.lab[l.k]);
}
export const techCount = p => Object.keys(p.lab).length;
export function maxTechLevel(p) { return Math.max(0, ...Object.keys(p.lab).map(labCol)); }

// ================================================================ build legality
/**
 * Legal places to construct `type` for player pi.
 * @returns {{h:string, size:number, need:number}[]} need = tech level required (0 = none)
 */
export function buildSpots(st, pi, type, { anywhere = false, techBoost = 0, noPieces = false } = {}) {
    const zone = anywhere ? null : zoneOf(st, pi);
    const tech = techTile(st, type, pi);
    const techLvl = tech ? tech.level + techBoost : -1;
    const isMine = b => b && b.type === type && (type !== 'shelter' || b.o === pi);
    const out = [];
    for (const h of HEXES) {
        if (B(st, h)) continue;
        if (zone && !zone.has(h)) continue;
        if (noPieces && hasPiece(st, h)) continue;
        const adj = neighbors(h).filter(n => isMine(B(st, n)));
        if (adj.length) {
            const set = new Set();
            adj.forEach(a => complexOf(st, a).forEach(x => set.add(x)));
            const need = set.size;
            if (tech && techLvl >= need) out.push({ h, size: need + 1, need });
        } else {
            const two = HEXES.some(x => isMine(B(st, x)) && dist(x, h) === 2);
            if (two) out.push({ h, size: 1, need: 0 });
        }
    }
    return out;
}

/** Can the type be built at all right now (tiles left, cost payable)? */
export function stackLeft(st, pi, type) {
    return type === 'shelter' ? st.p[pi].shelterTiles : st.stacks[type].length;
}

// ================================================================ resources
export const storageCap = (st, pi) => shelterCount(st, pi) + 1;
export const depotCap = p => 8 - p.ships.length;
export const shelterCount = (st, pi) => buildingsOf(st, 'shelter', pi).length;
export const lqCap = (st, pi) => 4 + 2 * (shelterCount(st, pi) - 1);

/** Gain items. Crystals go below the depot. Overflow returns to supply. Pathfinder keeps nothing. */
export function gain(st, pi, item, n = 1) {
    if (pi === PF || n <= 0) return 0;
    const p = st.p[pi];
    if (item === 'crystal') { p.crP += n; return n; }
    const room = storageCap(st, pi) - p.res[item];
    const got = Math.max(0, Math.min(room, n));
    p.res[item] += got;
    return got;
}
export function canStore(st, pi, item) {
    const p = st.p[pi];
    if (item === 'crystal') return p.cr + p.crP < depotCap(p);
    return p.res[item] < storageCap(st, pi);
}
export function addOP(st, pi, n, why) {
    st.p[pi].op += n;
    st.p[pi].opLog[why] = (st.p[pi].opLog[why] || 0) + n;
}

/**
 * Enumerate distinct ways to pay a cost list. Tokens: resource names, 'any', 'crystal'.
 * Minerals substitute for any resource; goal cards substitute for crystals.
 * @returns {Record<string,number>[]} each a bag of what gets spent (incl. 'goal')
 */
export function payOptions(p, tokens) {
    let bags = [{}];
    for (const tk of tokens) {
        const alts = tk === 'crystal' ? ['crystal', 'goal']
            : tk === 'any' ? ['battery', 'water', 'plant', 'oxygen', 'mineral']
                : tk === 'mineral' ? ['mineral'] : [tk, 'mineral'];
        const next = [];
        for (const bag of bags) for (const a of alts) {
            const nb = Object.assign({}, bag);
            nb[a] = (nb[a] || 0) + 1;
            if (affordBag(p, nb)) next.push(nb);
        }
        const seen = new Set();
        bags = next.filter(b => { const k = JSON.stringify(Object.keys(b).sort().map(x => [x, b[x]])); return seen.has(k) ? false : (seen.add(k), true); });
        if (!bags.length) return [];
    }
    return bags;
}
function affordBag(p, bag) {
    for (const k in bag) {
        const have = k === 'crystal' ? p.cr : k === 'goal' ? p.goals.length : p.res[k];
        if (have < bag[k]) return false;
    }
    return true;
}
export const canPay = (p, tokens) => payOptions(p, tokens).length > 0;
/** Prefer bags that don't burn goal cards or minerals. */
export function bagRank(bag) { return (bag.goal || 0) * 100 + (bag.mineral || 0) * 10; }

// ================================================================ colonists & slots
export const SIDE_SLOTS = { orbit: ['blueprint', 'rnd'], colony: ['construct', 'upgrade', 'hire'] };

/** Extra cost to place a colonist on an action (2p: one per colonist already there). */
export function slotCost(st, k, pi) {
    const s = st.slots[k];
    if (k === 'hire') return s.filter(o => o !== pi).length;
    if (s.length >= 3) {
        const c = [0, 0]; s.forEach(o => c[o]++);
        const mx = Math.max(...c);
        return s.filter(o => c[o] !== mx).length;
    }
    return s.length;
}
/** Clear full slots (players with most colonists go to their working area) then place. */
export function placeOnSlot(st, k, pi) {
    const s = st.slots[k];
    if (k !== 'hire' && s.length >= 3) {
        const c = [0, 0]; s.forEach(o => c[o]++);
        const mx = Math.max(...c);
        const keep = s.filter(o => c[o] !== mx);
        s.filter(o => c[o] === mx).forEach(o => { if (o === YOU) st.p[YOU].col.wa++; });
        st.slots[k] = keep;
        log(st, 'sys', 'clear', `Slots cleared: ${k}`);
    }
    st.slots[k].push(pi);
    if (pi === YOU) st.p[YOU].col.lq--;
}
export function canUseSlot(st, k, pi) {
    if (k === 'hire' && st.slots.hire.includes(pi)) return false;
    return true;
}
/** Send colonists back to Living Quarters (overflow to supply). */
export function toLQ(st, pi, n) {
    if (pi !== YOU) return;
    const p = st.p[pi];
    const room = lqCap(st, pi) - p.col.lq;
    const inn = Math.min(room, n);
    p.col.lq += inn; p.col.sup += n - inn;
}

// ================================================================ missions
export function contribute(st, pi, k, times = 1) {
    for (let i = 0; i < times; i++) {
        const m = st.missions.find(m => !m.done && D.mission(m.id).k === k);
        if (!m) return;
        m.left--;
        gain(st, pi, 'crystal', D.mission(m.id).gain);
        if (m.left <= 0) completeMission(st, m);
    }
}
export function completeMission(st, m) {
    m.done = true; m.left = 0;
    log(st, 'sys', 'mission', `Mission ${m.at} complete`, { m: m.id });
    updateRemaining(st);
}
export function updateRemaining(st) {
    const done = st.missions.filter(m => m.done).length;
    st.remaining = Math.max(0, 3 - done - (st.level >= 3 ? 1 : 0) - (st.level >= 4 ? 1 : 0));
}

// ================================================================ LSS
export const colonyRow = st => st.level + 1;
export function lssValue(st, pi, k) {
    const p = st.p[pi];
    switch (k) {
        case 'techLevel': return maxTechLevel(p);
        case 'ships': return 2 * p.hangar;
        case 'advMarkers': return 2 * advHexes(st, pi).length;
        case 'mines': return 2 * HEXES.filter(h => { const b = B(st, h); return b && b.type === 'mine' && (b.col === pi || b.adv?.o === pi); }).length;
        case 'bots': return 2 * st.bots.filter(b => b.o === pi).length;
        case 'discovery': return 2 * p.discs.length;
        case 'shelters': return 2 * shelterCount(st, pi);
        case 'colonists': return pi === PF ? lqCap(st, pi) : p.col.lq;
    }
    return 0;
}
export const advHexes = (st, pi) => HEXES.filter(h => B(st, h)?.adv?.o === pi);
export function colonyUpdateDue(st) {
    return st.level < 5 && D.LSS_TYPES.every(t => st.lss[t] >= colonyRow(st));
}

// ================================================================ scoring
export function lqScore(n) {
    if (n <= 0) return 0;
    return D.LQ_TIERS[n <= 4 ? 0 : Math.min(4, Math.ceil((n - 4) / 2))];
}
export const progressCount = p => Object.values(p.progress).filter(Boolean).length;

/** Live/final score breakdown. final=true applies end-of-game colonist return. */
export function scoreBreakdown(st, pi, final = false) {
    const p = st.p[pi];
    const isPF = pi === PF;
    let lq = p.col.lq;
    if (!isPF && final) {
        const back = SIDE_SLOTS[p.side].reduce((n, k) => n + st.slots[k].filter(o => o === YOU).length, 0) + p.col.wa;
        lq = Math.min(lqCap(st, pi), lq + back);
    }
    if (isPF) lq = lqCap(st, pi);
    const sc = {
        game: p.op,
        progress: D.PROGRESS_OP[progressCount(p)],
        ships: D.SHIP_OP * p.hangar,
        colonists: lqScore(lq),
        tech: Object.keys(p.lab).reduce((s, pos) => s + D.LAB_OP[labCol(pos)], 0),
        blueprints: p.bps.reduce((s, b) => s + (b.h ? (D.bp(b.id).lvl === 3 ? 5 : 3) : isPF ? 0 : (D.bp(b.id).lvl === 3 ? -5 : -3)), 0),
        scientists: p.scis.reduce((s, id) => s + 3 * HEXES.filter(h => { const b = B(st, h); return b && b.adv && b.type === D.sci(id).scores; }).length, 0),
        contracts: p.contracts.reduce((s, c) => s + (isPF || c.done || contractMet(st, pi, c) ? D.contract(c.id).win : -D.contract(c.id).lose), 0),
    };
    sc.total = Object.values(sc).reduce((a, b) => a + b, 0);
    return sc;
}
export function contractMet(st, pi, c) {
    const def = D.contract(c.id);
    if (def.up) return advHexes(st, pi).some(h => B(st, h).type === def.up && complexOf(st, h).length >= 4);
    return Object.entries(def.need).every(([k, n]) => (c.del[k] || 0) >= n);
}

// ================================================================ misc
export function flash(st, ...hexes) { st.flash.push(...hexes); }
export const otherSide = s => s === 'orbit' ? 'colony' : 'orbit';
export const sideOf = space => space <= 4 ? 'orbit' : 'colony';
export function spaceTaken(st, n) { return st.p.some(p => p.space === n); }
export function nextPlayer(st) {
    const live = st.p.map((p, i) => ({ p, i })).filter(x => !x.p.done).sort((a, b) => a.p.space - b.p.space);
    return live.length ? live[0].i : -1;
}
export { HEXES, neighbors, dist, onMap, step, cardOrder };
