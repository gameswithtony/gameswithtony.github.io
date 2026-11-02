// @ts-check
// Task handlers: game flow and everything the human does.
import * as D from './data.js';
import {
    H, DONE, YOU, PF, push, ask, log, B, botAt, roverHex, hasPiece, isEmpty, canEnd, complexOf, buildingsOf,
    zoneOf, techTile, labCol, labSpace, devTargets, buildSpots, stackLeft, storageCap, depotCap, gain, canStore,
    addOP, payOptions, canPay, bagRank, SIDE_SLOTS, slotCost, placeOnSlot, canUseSlot, toLQ, contribute,
    updateRemaining, colonyRow, lssValue, colonyUpdateDue, contractMet, flash, otherSide, sideOf, spaceTaken,
    nextPlayer, HEXES, neighbors, dist, step, techCount, advHexes, progressCount, shelterCount, lqCap, scoreBreakdown,
} from './core.js';
import { shuffle } from './rng.js';
import * as AI from './pathfinder.js';

const you = st => st.p[YOU];

// ================================================================ game loop
H.game = (st, t) => {
    switch (t.s) {
        case 'start':
            t.s = 'round';
            push(st, { t: 'space', side: null, first: true });
            return;
        case 'round':
            st.phase = 'colony';
            st.p.forEach(p => p.done = false);
            log(st, 'sys', 'round', `Round ${st.round}${st.final ? ' · final' : ''}`);
            t.s = 'next';
            return;
        case 'next': {
            const i = nextPlayer(st);
            if (i < 0) { t.s = 'endColony'; return; }
            push(st, { t: i === YOU ? 'turn' : 'pfTurn', s: 0 });
            return;
        }
        case 'endColony':
            if (!st.endTriggered && (st.remaining <= 0 || st.level >= 5)) {
                st.endTriggered = true;
                log(st, 'sys', 'end', 'End of game triggered · one more round');
            }
            if (st.final) { t.s = 'over'; push(st, { t: 'final' }); return; }
            t.s = 'afterShuttle';
            push(st, { t: 'shuttle', s: 0 });
            return;
        case 'afterShuttle':
            if (st.endTriggered) st.final = true;
            st.round++;
            t.s = 'round';
            return;
        case 'over':
            return DONE;
    }
};

H.final = (st) => {
    st.over = true; st.phase = 'over';
    const a = scoreBreakdown(st, YOU, true), b = scoreBreakdown(st, PF, true);
    st.result = { you: a, pf: b, win: a.total >= b.total };
    log(st, 'sys', 'final', `Final: You ${a.total} · Pathfinder ${b.total}`);
    ask(st, { kind: 'over' });
    return DONE;
};

// ================================================================ turn
H.turn = (st, t, a) => {
    const p = you(st);
    if (t.s === 0) {
        st.turn = { p: YOU, main: false, exec: false, techUses: [], over: false };
        if (p.crP) {
            const room = depotCap(p) - p.cr;
            const n = Math.min(room, p.crP);
            p.cr += n; p.crP = 0;
        }
        t.s = 1;
    }
    if (t.s === 1) {
        if (st.turn.over) { t.s = 2; return; }
        if (!a) { ask(st, menuPrompt(st)); return; }
        const v = a.v;
        if (v.a === 'main') { st.turn.main = true; push(st, { t: 'act', k: v.k, s: 0 }); return; }
        if (v.a === 'exec') { st.turn.exec = true; push(st, { t: 'exec', i: v.i, s: 0 }); return; }
        if (v.a === 'goal') { push(st, { t: 'goal', id: v.id, s: 0 }); return; }
        if (v.a === 'deliver') { deliver(st, v.c, v.item); return; }
        if (v.a === 'end') { t.s = 2; return; }
        return;
    }
    if (t.s === 2) { t.s = 3; push(st, { t: 'endTurn', s: 0 }); return; }
    p.done = true;
    st.turn = null;
    return DONE;
};

function deliver(st, ci, item) {
    const p = you(st), c = p.contracts[ci];
    if (!c) return;
    if (item === 'crystal') { if (p.cr <= 0) return; p.cr--; }
    else { if (p.res[item] <= 0) return; p.res[item]--; }
    c.del[item] = (c.del[item] || 0) + 1;
    log(st, 'you', 'deliver', `Delivered ${item} to contract`);
}

/** Main menu for the human's turn. */
export function menuPrompt(st) {
    const p = you(st);
    const main = st.turn.main ? [] : (p.side === 'orbit' ? D.ACTIONS_ORBIT : D.ACTIONS_COLONY).map(k => ({ k, why: actionBlock(st, k) }));
    const exec = st.turn.exec ? [] : D.EXEC.map((e, i) => ({ i, k: e.k, cost: e.cost, covered: p.ships.includes(i), why: execBlock(st, i) }));
    const goals = p.goalDone ? [] : p.goals.filter(id => goalMet(st, id)).map(id => ({ id }));
    return { kind: 'menu', main, exec, goals, canEnd: st.turn.main };
}

// ================================================================ main actions
/** Why an action can't be taken right now ('' = it can). */
export function actionBlock(st, k) {
    const p = you(st);
    if (D.SLOT_ACTIONS.includes(k)) {
        if (!canUseSlot(st, k, YOU)) return 'busy';
        if (p.col.lq < 1) return 'colonist';
        const c = slotCost(st, k, YOU);
        if (p.cr + p.col.lq - 1 < c) return 'cost';
    }
    switch (k) {
        case 'pod': return '';
        case 'blueprint': return p.ab && bpCards(st).length ? '' : 'none';
        case 'tech': return techChoices(st).length ? '' : 'none';
        case 'rnd': return devChoices(st, true).length ? '' : 'none';
        case 'resupply': return D.WARE.some(w => st.ware[w] && canStore(st, YOU, w)) ? '' : 'none';
        case 'construct': return buildTypes(st, {}).length ? '' : 'none';
        case 'upgrade': return upgradeChoices(st, {}).length ? '' : 'none';
        case 'hire': return hireChoices(st, {}).length ? '' : 'none';
        case 'control': return '';
        case 'ship': return shipBlock(st, ['plant', 'water']);
    }
    return '';
}
function shipBlock(st, cost) {
    const p = you(st);
    if (!p.ships.length) return 'none';
    if (p.shipsOut >= st.level) return 'level';
    if (cost.length && !canPay(p, cost)) return 'cost';
    return '';
}

H.act = (st, t, a) => {
    const p = you(st);
    const k = t.k;
    if (t.s === 0) {
        log(st, 'you', k, actionName(k));
        t.s = 1;
        if (D.SLOT_ACTIONS.includes(k)) { push(st, { t: 'slot', k, s: 0 }); return; }
    }
    if (t.s === 1) {
        t.s = 2;
        if (D.BOOST_ACTIONS.includes(k) && p.col.lq > 0) {
            if (!a) {
                ask(st, { kind: 'num', q: 'boost', k, min: 0, max: p.col.lq, def: 0 });
                t.s = 1; return;
            }
            boost(st, a.v);
            t.boost = a.v;
        }
    }
    if (t.s === 2) {
        t.s = 3;
        const n = t.boost || 0;
        switch (k) {
            case 'pod': st.turn.over = true; push(st, { t: 'travel', to: 'colony', pod: true, s: 0 }); break;
            case 'blueprint': push(st, { t: 'takeBp', n: 1 + n }); break;
            case 'tech': push(st, { t: 'takeTech', n: 1 + n, s: 0 }); break;
            case 'rnd': push(st, { t: 'develop', n: 2 + n, pay: true, s: 0 }); break;
            case 'resupply': push(st, { t: 'ware', n: 1 + n }); break;
            case 'construct': push(st, { t: 'build', s: 0 }); break;
            case 'upgrade': push(st, { t: 'upgrade', n: 1, tech: true, s: 0 }); break;
            case 'hire': push(st, { t: 'hire', s: 0 }); break;
            case 'control': push(st, { t: 'move', bot: 2, rover: 2, cr: true, s: 0 }); break;
            case 'ship': push(st, { t: 'welcome', n: 1 + n, s: 0 }); break;
        }
        return;
    }
    return DONE;
};
export const actionName = k => ({
    pod: 'Landing Pod', blueprint: 'Obtain Blueprint', tech: 'Learn Tech', rnd: 'R&D', resupply: 'Resupply',
    construct: 'Construct', upgrade: 'Upgrade', hire: 'Hire / Contract', control: 'Control Center', ship: 'Welcome Ship',
})[k] || k;

function boost(st, n) {
    const p = you(st);
    n = Math.max(0, Math.min(n | 0, p.col.lq));
    p.col.lq -= n; p.col.wa += n;
}

/** Place a colonist on an action slot, paying the extra cost. */
H.slot = (st, t, a) => {
    const p = you(st);
    const cost = slotCost(st, t.k, YOU);
    if (cost > 0 && t.s === 0) {
        const opts = [];
        for (let c = 0; c <= cost; c++) {
            const col = cost - c;
            if (c <= p.cr && col <= p.col.lq - 1) opts.push({ v: { cr: c, col }, cr: c, col });
        }
        if (opts.length > 1 && !a) { ask(st, { kind: 'pick', q: 'slotCost', k: t.k, opts }); return; }
        const ch = a ? a.v : opts[0].v;
        p.cr -= ch.cr; p.col.lq -= ch.col; p.col.wa += ch.col;
    }
    placeOnSlot(st, t.k, YOU);
    return DONE;
};

// ---------------------------------------------------------------- blueprints
export function bpCards(st) {
    const out = [];
    st.bpTop.forEach((id, i) => id && out.push({ id, row: 'top', i }));
    st.bpBot.forEach((id, i) => id && out.push({ id, row: 'bot', i }));
    return out;
}
export function takeBlueprint(st, pi, id) {
    const p = st.p[pi];
    const ti = st.bpTop.indexOf(id), bi = st.bpBot.indexOf(id);
    if (ti >= 0) st.bpTop[ti] = null; else if (bi >= 0) st.bpBot[bi] = null;
    p.bps.push({ id, h: null });
    p.ab--;
    gain(st, pi, D.PRODUCES[D.bp(id).type], 1);
}
H.takeBp = (st, t, a) => {
    const p = you(st);
    if (a) {
        if (a.v === 'done') return DONE;
        takeBlueprint(st, YOU, a.v);
        contribute(st, YOU, 'blueprint');
        log(st, 'you', 'bp', D.bp(a.v).name, { bp: a.v });
        t.n--;
    }
    if (t.n <= 0 || !p.ab || !bpCards(st).length) return DONE;
    ask(st, { kind: 'pick', q: 'blueprint', cards: bpCards(st), left: t.n, skip: true });
};

// ---------------------------------------------------------------- tech
export function techChoices(st, pay = true) {
    const p = you(st);
    if (p.lab['1a'] && p.lab['1b']) return [];
    return st.grid.map((tech, i) => ({ tech, i })).filter(x => x.tech && !Object.values(p.lab).includes(x.tech)
        && (!pay || canPay(p, D.GRID_COST[x.i])));
}
H.takeTech = (st, t, a) => {
    const p = you(st);
    if (t.s === 0) {
        if (a) {
            if (a.v === 'done') return DONE;
            t.i = a.v; t.s = 1;
            if (t.pay !== false) { push(st, { t: 'pay', cost: D.GRID_COST[t.i], s: 0 }); return; }
        } else {
            const ch = techChoices(st, t.pay !== false);
            if (t.n <= 0 || !ch.length) return DONE;
            ask(st, { kind: 'pick', q: 'tech', techs: ch, left: t.n, skip: true });
            return;
        }
    }
    if (t.s === 1) {
        const free = ['1a', '1b'].filter(k => !p.lab[k]);
        if (free.length > 1 && !a) { ask(st, { kind: 'pick', q: 'labSpace', spaces: free, tech: st.grid[t.i] }); return; }
        const pos = a && free.includes(a.v) ? a.v : free[0];
        const tech = st.grid[t.i];
        st.grid[t.i] = null;
        p.lab[pos] = tech;
        contribute(st, YOU, 'tech');
        log(st, 'you', 'tech', D.TECHS[tech].name, { tech });
        t.n--; t.s = 0;
        push(st, { t: 'labBen', pos, s: 0 });
        return;
    }
};

// ---------------------------------------------------------------- develop
/** Tiles that can move right (and pay, if paying). */
export function devChoices(st, pay, pi = YOU) {
    const p = st.p[pi];
    return Object.keys(p.lab).filter(pos => devTargets(p, pos).some(d => !pay || canPay(p, D.LAB_COST[d.col])));
}
H.develop = (st, t, a) => {
    const p = you(st);
    if (t.s === 0) {
        if (a) {
            if (a.v === 'done') return DONE;
            t.pos = a.v; t.s = 1; a = undefined;
        } else {
            const ch = devChoices(st, !!t.pay);
            if (t.n <= 0 || !ch.length) return DONE;
            ask(st, { kind: 'pick', q: 'develop', tiles: ch, left: t.n, skip: true, free: !t.pay });
            return;
        }
    }
    if (t.s === 1) {
        const tg = devTargets(p, t.pos).filter(d => !t.pay || canPay(p, D.LAB_COST[d.col]));
        if (tg.length > 1 && !a) { ask(st, { kind: 'pick', q: 'devTo', from: t.pos, to: tg.map(d => d.k) }); return; }
        t.to = a ? a.v : tg[0].k;
        t.s = 2;
        if (t.pay) { push(st, { t: 'pay', cost: D.LAB_COST[labCol(t.to)], s: 0 }); return; }
    }
    if (t.s === 2) {
        const tech = p.lab[t.pos];
        delete p.lab[t.pos];
        p.lab[t.to] = tech;
        log(st, 'you', 'develop', `${D.TECHS[tech].name} → ${labCol(t.to)}`, { tech });
        t.n--; t.s = 0;
        push(st, { t: 'labBen', pos: t.to, s: 0 });
        return;
    }
};

/** Benefit printed on a lab space. */
H.labBen = (st, t, a) => {
    const ben = labSpace(t.pos).ben;
    const p = you(st);
    if (!ben) return DONE;
    switch (ben) {
        case 'warehouse': push(st, { t: 'ware', n: 1 }); return DONE;
        case 'crystal': gain(st, YOU, 'crystal'); return DONE;
        case 'mineral': gain(st, YOU, 'mineral'); return DONE;
        case 'bots': push(st, { t: 'move', bot: 2, rover: 0, cr: true, s: 0 }); return DONE;
        case 'upgrade': case 'blueprint': {
            if (t.s === 0 && p.col.lq > 0 && !a) { ask(st, { kind: 'num', q: 'boost', k: ben, min: 0, max: p.col.lq, def: 0 }); return; }
            const n = a ? a.v : 0;
            boost(st, n);
            push(st, ben === 'upgrade' ? { t: 'upgrade', n: 1 + n, tech: true, s: 0 } : { t: 'takeBp', n: 1 + n });
            return DONE;
        }
    }
    return DONE;
};

// ---------------------------------------------------------------- warehouse
H.ware = (st, t, a) => {
    if (a) {
        if (a.v === 'done') return DONE;
        st.ware[a.v]--;
        gain(st, YOU, a.v);
        log(st, 'you', 'ware', `Warehouse: ${a.v}`, { item: a.v });
        t.n--;
    }
    const items = D.WARE.filter(w => st.ware[w] > 0 && canStore(st, YOU, w));
    if (t.n <= 0 || !items.length) return DONE;
    ask(st, { kind: 'pick', q: 'warehouse', items, left: t.n, skip: true });
};

// ---------------------------------------------------------------- payment
H.pay = (st, t, a) => {
    const p = you(st);
    if (!t.cost.length) return DONE;
    if (t.s === 0) {
        const opts = payOptions(p, t.cost).sort((x, y) => bagRank(x) - bagRank(y));
        if (!opts.length) { log(st, 'sys', 'err', 'Could not pay'); return DONE; }
        if (opts.length > 1 && !a) { ask(st, { kind: 'pick', q: 'pay', bags: opts }); return; }
        t.bag = a ? a.v : opts[0];
        t.s = 1; a = undefined;
    }
    if (t.s === 1) {
        for (const k in t.bag) {
            if (k === 'crystal') p.cr -= t.bag[k];
            else if (k !== 'goal') p.res[k] -= t.bag[k];
        }
        t.goals = t.bag.goal || 0;
        t.s = 2;
    }
    if (t.s === 2) {
        if (t.goals <= 0) return DONE;
        if (p.goals.length > 1 && !a) { ask(st, { kind: 'pick', q: 'goalCrystal', goals: p.goals }); return; }
        const id = a ? a.v : p.goals[0];
        p.goals = p.goals.filter(g => g !== id);
        log(st, 'you', 'goal', 'Goal card spent as crystal');
        t.goals--;
        return;
    }
};

// ---------------------------------------------------------------- construct
/** Building types the human can construct now. */
export function buildTypes(st, t) {
    const p = you(st);
    const types = t.type ? [t.type] : ['mine', 'gen', 'water', 'green', 'oxy', 'shelter'];
    return types.filter(type => {
        if (!stackLeft(st, YOU, type)) return false;
        if (type === 'mine' && p.col.lq < 1) return false; // a mine always needs its miner
        if (!t.free && type !== 'mine' && !canPay(p, [D.BUILD_COST[type]])) return false;
        return buildSpots(st, YOU, type, { techBoost: boostBudget(st, t, type) }).length > 0;
    });
}
/** Colonists that may stand in for tech levels (a mine keeps one back for its miner). */
function boostBudget(st, t, type) {
    if (!t.colBoost) return 0;
    return Math.max(0, you(st).col.lq - (type === 'mine' ? 1 : 0));
}
H.build = (st, t, a) => {
    const p = you(st);
    if (t.s === 0) {
        const types = buildTypes(st, t);
        if (!types.length) { log(st, 'you', 'none', 'Nothing to construct'); return DONE; }
        if (!a && (types.length > 1 || !t.type)) {
            ask(st, { kind: 'pick', q: 'buildType', types: types.map(type => ({ type, cost: type === 'mine' ? 'colonist' : D.BUILD_COST[type], arrows: type !== 'shelter' && st.stacks[type][0]?.arrows })), skip: !!t.optional });
            return;
        }
        if (a && a.v === 'done') return DONE;
        t.type = a ? a.v : types[0]; t.s = 1; a = undefined;
    }
    if (t.s === 1) {
        const spots = buildSpots(st, YOU, t.type, { techBoost: boostBudget(st, t, t.type), anywhere: !!t.anywhere });
        if (!a) {
            const tech = techTile(st, t.type, YOU);
            ask(st, { kind: 'hex', q: 'buildHex', type: t.type, hexes: spots.map(s => ({ h: s.h, size: s.size, need: s.need })), tech: tech && { o: tech.o, level: tech.level }, back: true });
            return;
        }
        if (a.v === 'back') { t.s = 0; t.type = t.fixed; return; }
        t.spot = spots.find(s => s.h === a.v);
        t.s = 2; a = undefined;
    }
    if (t.s === 2) {
        // tech use
        if (t.spot.need > 0) {
            const tech = techTile(st, t.type, YOU);
            st.turn?.techUses.push({ o: tech.o, type: t.type });
            if (tech.level < t.spot.need) boost(st, t.spot.need - tech.level);
        }
        t.s = 3;
        if (t.type === 'mine') { p.col.lq--; t.minerCol = true; }
        else if (!t.free) { push(st, { t: 'pay', cost: [D.BUILD_COST[t.type]], s: 0 }); return; }
    }
    if (t.s === 3) {
        t.s = 4;
        construct(st, YOU, t.type, t.spot.h, { miner: t.minerCol });
        return;
    }
    if (t.s === 4) return DONE;
};

/**
 * Put a building on the map and resolve everything that follows.
 * Pushes prompts for the human (displacement, LSS benefit) when needed.
 */
export function construct(st, pi, type, h, { miner = false } = {}) {
    const x = st.hex[h];
    // displacement
    if (x.crystal) x.crystal = 0;
    x.disc = null; x.res = null;
    const displaced = [];
    const bot = botAt(st, h);
    if (bot) displaced.push(bot.o === YOU ? { kind: 'bot', o: YOU, from: h } : { kind: 'bot', o: PF, from: h });
    if (st.rover === h) displaced.push({ kind: 'rover', o: YOU, from: h });
    // tile
    let arrows = false;
    if (type === 'shelter') st.p[pi].shelterTiles--;
    else arrows = st.stacks[type].shift().arrows;
    x.b = { type, adv: null, col: null };
    if (type === 'shelter') x.b.o = pi;
    if (type === 'mine' && (miner || pi === PF)) x.b.col = pi;
    flash(st, h);
    displaced.forEach(d => relocate(st, d));
    if (arrows) {
        for (const d of /** @type {const} */(['n', 'sw', 'se'])) {
            const n = step(h, d);
            if (n && isEmpty(st, n)) st.hex[n].crystal = 1;
        }
    }
    const size = complexOf(st, h).length;
    const who = pi === YOU ? 'you' : 'pf';
    log(st, who, 'build', `${D.BUILD_NAMES[type]} · complex ${size}`, { h, type, size });
    gain(st, pi, D.PRODUCES[type], size);
    // progress cube
    const p = st.p[pi];
    if (size >= 2 && type !== 'shelter' && !p.progress[type]) {
        p.progress[type] = true;
        if (pi === YOU) contribute(st, YOU, 'progress');
        log(st, who, 'progress', `Progress cube: ${D.BUILD_NAMES[type]}`);
    }
    // LSS
    if (D.LSS_TYPES.includes(type)) {
        const before = st.lss[type];
        if (before < 6) st.lss[type]++;
        if (before === 1) addOP(st, pi, 2, 'lss');
        if (before < colonyRow(st)) {
            const tk = st.lssTiles[D.LSS_TYPES.indexOf(type)];
            const op = lssValue(st, pi, tk);
            addOP(st, pi, op, 'lss');
            log(st, who, 'lss', `LSS reward +${op}`, { op });
            if (pi === YOU) push(st, { t: 'lssBen', s: 0 });
            else AI.pfLssBenefit(st);
        }
    }
}

/** Displace a piece to the closest available hex. Human pieces may need a choice. */
export function relocate(st, d) {
    const near = nearestFree(st, d.from);
    if (d.o === PF || near.length === 1) { movePiece(st, d, AI.cardPick(st, near)); return; }
    push(st, { t: 'displace', d });
}
/** Closest hexes that are empty or hold a building with no piece. */
function nearestFree(st, from) {
    const free = h => !B(st, h) ? isFreeOfPieces(st, h) : (isFreeOfPieces(st, h) && !B(st, h).adv && (B(st, h).col === null || B(st, h).col === undefined));
    const cands = HEXES.filter(h => h !== from && free(h));
    const best = Math.min(...cands.map(h => dist(h, from)));
    return cands.filter(h => dist(h, from) === best);
}
function isFreeOfPieces(st, h) { return !botAt(st, h) && st.rover !== h; }
function movePiece(st, d, h) {
    if (d.kind === 'rover') st.rover = h;
    else { const b = st.bots.find(b => b.h === d.from && b.o === d.o); if (b) b.h = h; }
}
H.displace = (st, t, a) => {
    const near = nearestFree(st, t.d.from);
    if (near.length === 1) a = { v: near[0] };
    if (!a) { ask(st, { kind: 'hex', q: 'displace', piece: t.d.kind, from: t.d.from, hexes: near.map(h => ({ h })) }); return; }
    movePiece(st, t.d, a.v);
    return DONE;
};

H.lssBen = (st, t, a) => {
    const p = you(st);
    if (!a) {
        const opts = ['bots', 'mineral', 'crystal'];
        if (p.col.wa || Object.values(st.slots).some(s => s.includes(YOU))) opts.push('retrieve');
        ask(st, { kind: 'pick', q: 'lssBen', opts });
        return;
    }
    switch (a.v) {
        case 'bots': push(st, { t: 'move', bot: 2, rover: 0, cr: true, s: 0 }); break;
        case 'mineral': gain(st, YOU, 'mineral'); break;
        case 'crystal': gain(st, YOU, 'crystal'); break;
        case 'retrieve': push(st, { t: 'retrieve', n: 1 }); break;
    }
    return DONE;
};

H.retrieve = (st, t, a) => {
    const p = you(st);
    if (a) {
        if (a.v === 'done') return DONE;
        if (a.v === 'wa') p.col.wa--;
        else { const s = st.slots[a.v]; s.splice(s.indexOf(YOU), 1); }
        toLQ(st, YOU, 1);
        t.n--;
    }
    const src = Object.keys(st.slots).filter(k => st.slots[k].includes(YOU));
    if (p.col.wa) src.push('wa');
    if (t.n <= 0 || !src.length) return DONE;
    ask(st, { kind: 'pick', q: 'retrieve', src, left: t.n, skip: true });
};

// ---------------------------------------------------------------- upgrade
/** Pairs of (blueprint, building) the human can upgrade. */
export function upgradeChoices(st, t, pi = YOU) {
    const p = st.p[pi];
    const zone = t.anywhere || pi === PF ? null : zoneOf(st, pi);
    if (!t.free && pi === YOU && !canPay(p, ['mineral'])) return [];
    const out = [];
    for (const b of p.bps.filter(b => !b.h)) {
        const def = D.bp(b.id);
        for (const h of upgradeTargets(st, pi, def)) if (!zone || zone.has(h)) out.push({ id: b.id, h });
    }
    return out;
}
export function upgradeTargets(st, pi, def) {
    return HEXES.filter(h => {
        const b = B(st, h);
        if (!b || b.adv || b.type !== def.type) return false;
        if (def.type === 'shelter' && b.o !== pi) return false;
        if (def.lvl === 3 && complexOf(st, h).length < 3) return false;
        return true;
    });
}
H.upgrade = (st, t, a) => {
    const p = you(st);
    if (t.s === 0) {
        t.s = 1;
        if (t.tech) {
            const tech = techTile(st, 'upgrade', YOU);
            if (tech && upgradeChoices(st, t).length) {
                if (tech.o === YOU) { t.n += tech.level; st.turn?.techUses.push({ o: YOU, type: 'upgrade' }); }
                else if (!a) { t.s = 0; ask(st, { kind: 'pick', q: 'useTech', tech: 'upgrade', level: tech.level, opts: ['yes', 'no'] }); return; }
                else if (a.v === 'yes') { t.n += tech.level; st.turn?.techUses.push({ o: PF, type: 'upgrade' }); }
                a = undefined;
            }
        }
    }
    if (t.s === 1) {
        if (a) {
            if (a.v === 'done') return DONE;
            t.id = a.v; t.s = 2; a = undefined;
        } else {
            const ch = upgradeChoices(st, t);
            if (t.n <= 0 || !ch.length) return DONE;
            const ids = [...new Set(ch.map(c => c.id))];
            ask(st, { kind: 'pick', q: 'upgradeBp', ids, left: t.n, skip: true });
            return;
        }
    }
    if (t.s === 2) {
        const hs = upgradeChoices(st, t).filter(c => c.id === t.id).map(c => c.h);
        if (!a) { ask(st, { kind: 'hex', q: 'upgradeHex', id: t.id, hexes: hs.map(h => ({ h })), back: true }); return; }
        if (a.v === 'back') { t.s = 1; return; }
        t.h = a.v; t.s = 3;
        if (!t.free) { push(st, { t: 'pay', cost: ['mineral'], s: 0 }); return; }
    }
    if (t.s === 3) {
        upgradeBuilding(st, YOU, t.id, t.h);
        contribute(st, YOU, 'adv');
        t.n--; t.s = 1;
        return;
    }
};
export function upgradeBuilding(st, pi, id, h) {
    const b = B(st, h);
    const bpe = st.p[pi].bps.find(x => x.id === id);
    bpe.h = h;
    // colonist on a mine goes home
    if (b.col !== null && b.col !== undefined) { toLQ(st, b.col, 1); b.col = null; }
    b.adv = { o: pi, bp: id };
    const disp = [];
    const bot = botAt(st, h);
    if (bot) disp.push({ kind: 'bot', o: bot.o, from: h });
    if (st.rover === h && !(h === D.CENTER)) disp.push({ kind: 'rover', o: YOU, from: h });
    disp.forEach(d => relocate(st, d));
    flash(st, h);
    log(st, pi === YOU ? 'you' : 'pf', 'upgrade', `${D.bp(id).name}`, { h, bp: id });
}

// ---------------------------------------------------------------- hire
export function hireChoices(st, t) {
    const p = you(st);
    const out = [];
    st.sciSlots.forEach((s, i) => {
        if (s.s && !t.contractOnly) {
            const c = D.sci(s.s).cost;
            const ok = t.free || (c.colonists ? p.col.lq >= c.colonists : canPay(p, Object.entries(c).flatMap(([k, n]) => Array(n).fill(k))));
            if (ok) out.push({ i, sci: s.s });
        } else if (s.c) {
            if (t.free || canPay(p, ['crystal'])) out.push({ i, contract: s.c });
        }
    });
    return out;
}
H.hire = (st, t, a) => {
    const p = you(st);
    if (t.s === 0) {
        const ch = hireChoices(st, t);
        if (!ch.length) return DONE;
        if (!a) { ask(st, { kind: 'pick', q: 'hire', choices: ch, skip: !!t.optional }); return; }
        if (a.v === 'done') return DONE;
        t.i = a.v; t.s = 1;
        const slot = st.sciSlots[t.i];
        if (!t.free) {
            if (slot.s) {
                const c = D.sci(slot.s).cost;
                if (c.colonists) { p.col.lq -= 2; p.col.wa += 2; }
                else { push(st, { t: 'pay', cost: Object.entries(c).flatMap(([k, n]) => Array(n).fill(k)), s: 0 }); return; }
            } else { push(st, { t: 'pay', cost: ['crystal'], s: 0 }); return; }
        }
        a = undefined;
    }
    if (t.s === 1) {
        const slot = st.sciSlots[t.i];
        if (slot.s) {
            p.scis.push(slot.s); st.sciLoc[slot.s] = null;
            contribute(st, YOU, 'scientist');
            log(st, 'you', 'sci', D.sci(slot.s).name, { sci: slot.s });
            slot.s = null;
        } else {
            p.contracts.push({ id: slot.c, del: {}, done: false });
            log(st, 'you', 'contract', `Contract #${slot.c}`, { c: slot.c });
            slot.c = null;
        }
        t.s = 2;
    }
    if (t.s === 2) {
        if (!st.contractDeck.length) return DONE;
        if (!a) { ask(st, { kind: 'pick', q: 'refill', contracts: [...st.contractDeck] }); return; }
        st.sciSlots[t.i].c = a.v;
        st.contractDeck = st.contractDeck.filter(c => c !== a.v);
        return DONE;
    }
};

// ---------------------------------------------------------------- control center / movement
/**
 * Movement for bots and the rover.
 * t: {bot, rover, cr (may spend crystals), asRover (bots act as rovers), noTech, sel, pickedTile}
 */
H.move = (st, t, a) => {
    const p = you(st);
    if (t.s === 0) {
        t.s = 1; t.techUsed = false;
        t.crAvail = p.cr; // only crystals in depot before the action
        if (t.roverMode === undefined) t.roverMode = t.rover > 0;
        if (t.botMode === undefined) t.botMode = t.bot > 0;
    }
    if (t.s === 1) {
        if (a) {
            const v = a.v;
            if (v === 'done') { t.s = 3; }
            else if (v === 'crBot') { p.cr--; t.crAvail--; t.bot++; return; }
            else if (v === 'crRover') { p.cr--; t.crAvail--; t.rover++; return; }
            else if (v === 'tech') {
                const tech = techTile(st, 'rover', YOU);
                t.rover += tech.level; t.techUsed = true;
                st.turn?.techUses.push({ o: tech.o, type: 'rover' });
                return;
            } else { t.sel = v; t.s = 2; a = undefined; }
        }
        if (t.s === 1) {
            const pieces = [];
            if (t.bot > 0) st.bots.filter(b => b.o === YOU).forEach(b => pieces.push({ h: b.h, v: b.h, piece: 'bot' }));
            if (t.rover > 0) pieces.push({ h: roverHex(st), v: 'rover', piece: 'rover' });
            const tech = t.roverMode ? techTile(st, 'rover', YOU) : null;
            const btns = ['done'];
            if (t.cr && t.crAvail > 0 && p.cr > 0) { if (t.botMode) btns.unshift('crBot'); if (t.roverMode) btns.unshift('crRover'); }
            if (tech && !t.techUsed && !t.noTech) btns.unshift('tech');
            ask(st, { kind: 'hex', q: 'movePick', hexes: pieces, bot: t.bot, rover: t.rover, btns, botMode: t.botMode, roverMode: t.roverMode, techLevel: tech?.level, techOwner: tech?.o, asRover: !!t.asRover });
            return;
        }
    }
    if (t.s === 2) {
        const isRover = t.sel === 'rover';
        const from = isRover ? roverHex(st) : t.sel;
        const mp = isRover ? t.rover : t.bot;
        const self = isRover ? 'rover' : botAt(st, from);
        const dests = HEXES.filter(h => h !== from && dist(h, from) <= mp && canEnd(st, h, self) && (!isRover || roverMayEnd(st, h)));
        if (!a) { ask(st, { kind: 'hex', q: 'moveTo', from, piece: isRover ? 'rover' : 'bot', mp, hexes: dests.map(h => ({ h, d: dist(h, from) })), back: true }); return; }
        if (a.v === 'back') { t.s = 1; return; }
        const to = a.v, d = dist(from, to);
        if (isRover) {
            collectAlong(st, from, to);
            st.rover = to; t.rover -= d; t.roverMoved = true;
        } else {
            const bot = botAt(st, from);
            if (t.asRover) collectAlong(st, from, to, true);
            bot.h = to; t.bot -= d;
            (t.moved ||= []).includes(to) || t.moved.push(to);
        }
        flash(st, to);
        t.s = 1;
        return;
    }
    if (t.s === 3) {
        // end of movement: bots clear what they stand on; rover takes its tile
        t.s = 4;
        for (const b of st.bots.filter(b => b.o === YOU)) {
            const x = st.hex[b.h];
            if (t.asRover && (x.disc || x.res) && !t.pickedTile) {
                t.pickedTile = true;
                push(st, { t: 'tile', h: b.h, s: 0 });
                continue;
            }
            if (x.crystal && !t.asRover) x.crystal = 0;
            if (x.disc || x.res) { x.disc = null; x.res = null; }
        }
        if (t.roverMoved && st.rover) {
            const x = st.hex[st.rover];
            if (x.disc || x.res) push(st, { t: 'tile', h: st.rover, s: 0 });
        }
        return;
    }
    return DONE;
};
/** Rover collects crystals along the best shortest path (most crystals). */
function collectAlong(st, from, to, isBot = false) {
    let path = bestPath(st, from, to);
    for (const h of path) if (st.hex[h].crystal) { st.hex[h].crystal = 0; gain(st, YOU, 'crystal'); }
}
function bestPath(st, from, to) {
    // DP over shortest paths, maximising crystals
    const d = dist(from, to);
    let layer = new Map([[from, { c: 0, path: [] }]]);
    for (let i = 0; i < d; i++) {
        const next = new Map();
        for (const [h, v] of layer) for (const n of neighbors(h)) {
            if (dist(n, to) !== d - i - 1) continue;
            const c = v.c + st.hex[n].crystal;
            if (!next.has(n) || next.get(n).c < c) next.set(n, { c, path: [...v.path, n] });
        }
        layer = next;
    }
    return layer.get(to)?.path || [to];
}
function roverMayEnd(st, h) {
    const x = st.hex[h];
    if (x.res) return !you(st).researches.some(r => r[0] === x.res[0]);
    if (x.disc) return discUsable(st, x.disc);
    return true;
}
export function discUsable(st, id) {
    const d = D.disc(id), p = you(st);
    switch (d.k) {
        case 'build': return buildTypes(st, { type: d.b }).length > 0;
        case 'buildAny': return buildTypes(st, {}).length > 0;
        case 'develop2': return devChoices(st, true).length > 0;
        case 'blueprints2': return p.ab > 0 && bpCards(st).length > 0;
        case 'tech1': return techChoices(st).length > 0;
        case 'upgrade2': return upgradeChoices(st, {}).length > 0;
        case 'hire': return hireChoices(st, {}).length > 0;
        case 'warehouse2': return D.WARE.some(w => st.ware[w] && canStore(st, YOU, w));
        case 'gain': return canStore(st, YOU, d.g);
    }
    return true;
}

/** Take the tile on hex h (rover, or Recycling Bots). */
H.tile = (st, t) => {
    const x = st.hex[t.h], p = you(st);
    if (x.res) {
        const r = x.res; x.res = null;
        p.researches.push(r);
        contribute(st, YOU, 'research');
        log(st, 'you', 'research', `Research tile ${r[0]}`, { r });
        push(st, { t: 'develop', n: 2, pay: false, s: 0 });
        return DONE;
    }
    if (x.disc) {
        const id = x.disc; x.disc = null;
        p.discs.push(id);
        contribute(st, YOU, 'discovery');
        log(st, 'you', 'disc', `Discovery tile`, { disc: id });
        discBenefit(st, id);
    }
    return DONE;
};
export function discBenefit(st, id) {
    const d = D.disc(id);
    switch (d.k) {
        case 'build': push(st, { t: 'build', type: d.b, fixed: d.b, optional: true, s: 0 }); break;
        case 'buildAny': push(st, { t: 'build', optional: true, s: 0 }); break;
        case 'develop2': push(st, { t: 'develop', n: 2, pay: true, s: 0 }); break;
        case 'blueprints2': push(st, { t: 'takeBp', n: 2 }); break;
        case 'tech1': push(st, { t: 'takeTech', n: 1, s: 0 }); break;
        case 'upgrade2': push(st, { t: 'upgrade', n: 2, tech: true, s: 0 }); break;
        case 'hire': push(st, { t: 'hire', optional: true, s: 0 }); break;
        case 'warehouse2': push(st, { t: 'ware', n: 2 }); break;
        case 'gain': gain(st, YOU, d.g, d.n); break;
    }
}

// ---------------------------------------------------------------- welcome ship
H.welcome = (st, t, a) => {
    const p = you(st);
    if (t.s === 0) {
        if (t.n <= 0 || shipBlock(st, t.free ? [] : ['plant', 'water'])) return DONE;
        if (!a) { ask(st, { kind: 'pick', q: 'ship', slots: [...p.ships], left: t.n, skip: t.done !== undefined }); return; }
        if (a.v === 'done') return DONE;
        t.slot = a.v; t.done = (t.done || 0); t.s = 1;
        if (!t.free) { push(st, { t: 'pay', cost: ['plant', 'water'], s: 0 }); return; }
        a = undefined;
    }
    if (t.s === 1) {
        p.ships = p.ships.filter(i => i !== t.slot);
        p.hangar++; p.shipsOut++;
        log(st, 'you', 'ship', 'Ship welcomed');
        t.s = 2;
    }
    if (t.s === 2) {
        const big = t.variant === 'private';
        const canBot = p.botsOff > 0;
        if (!a) { ask(st, { kind: 'pick', q: 'shipGain', opts: canBot ? ['bot', 'col'] : ['col'], big }); return; }
        let cols = (a.v === 'bot' ? 1 : 2) + (big ? 1 : 0);
        t.bot = a.v === 'bot';
        t.cols = cols; t.s = 3; a = undefined;
    }
    if (t.s === 3) {
        const tech = techTile(st, 'colonist', YOU);
        if (tech && !t.techAsked) {
            if (tech.o === YOU) { t.cols += tech.level; st.turn?.techUses.push({ o: YOU, type: 'colonist' }); t.techAsked = true; }
            else if (!a) { ask(st, { kind: 'pick', q: 'useTech', tech: 'colonist', level: tech.level, opts: ['yes', 'no'] }); return; }
            else { if (a.v === 'yes') { t.cols += tech.level; st.turn?.techUses.push({ o: PF, type: 'colonist' }); } t.techAsked = true; a = undefined; }
        }
        const n = Math.min(t.cols, p.col.sup);
        p.col.sup -= n; toLQ(st, YOU, n);
        t.s = 4;
        if (t.bot) { push(st, { t: 'placeBot', s: 0 }); return; }
    }
    t.n--; t.s = 0; t.done++; t.techAsked = false;
};
/** Put a new bot on an empty shelter of yours, else the closest free hex to one. */
H.placeBot = (st, t, a) => {
    const p = you(st);
    if (!a) {
        const shel = buildingsOf(st, 'shelter', YOU).filter(h => !botAt(st, h) && st.rover !== h && !B(st, h).adv);
        let opts = shel;
        if (!opts.length) {
            const free = HEXES.filter(h => !B(st, h) && !botAt(st, h) && st.rover !== h);
            const sh = buildingsOf(st, 'shelter', YOU);
            const dd = h => Math.min(...sh.map(s => dist(s, h)));
            const best = Math.min(...free.map(dd));
            opts = free.filter(h => dd(h) === best);
        }
        if (opts.length === 1) { a = { v: opts[0] }; }
        else { ask(st, { kind: 'hex', q: 'placeBot', hexes: opts.map(h => ({ h })) }); return; }
    }
    st.bots.push({ o: YOU, h: a.v });
    p.botsOff--;
    contribute(st, YOU, 'bot');
    flash(st, a.v);
    return DONE;
};

// ================================================================ executive actions
export function execBlock(st, i) {
    const p = you(st);
    if (p.ships.includes(i)) return 'ship';
    const e = D.EXEC[i];
    if (e.k === 'adv') return advChoices(st).length ? '' : 'none';
    if (p.cr + p.goals.length < e.cost) return 'cost';
    switch (e.k) {
        case 'develop': return devChoices(st, false).length ? '' : 'none';
        case 'blueprint': return p.ab && bpCards(st).length ? '' : 'none';
        case 'upgrade': return upgradeChoices(st, {}).length ? '' : 'none';
        case 'mineral': return canStore(st, YOU, 'mineral') ? '' : 'full';
        case 'warehouse': return D.WARE.some(w => st.ware[w] && canStore(st, YOU, w)) ? '' : 'none';
    }
    return '';
}
H.exec = (st, t) => {
    const e = D.EXEC[t.i];
    if (t.s === 0) {
        t.s = 1;
        log(st, 'you', 'exec', execName(e.k));
        if (e.k !== 'adv') { push(st, { t: 'pay', cost: Array(e.cost).fill('crystal'), s: 0 }); return; }
    }
    switch (e.k) {
        case 'develop': push(st, { t: 'develop', n: 1, pay: false, s: 0 }); break;
        case 'rover': push(st, { t: 'move', bot: 0, rover: 2, cr: true, roverMode: true, botMode: false, s: 0 }); break;
        case 'blueprint': push(st, { t: 'takeBp', n: 1 }); break;
        case 'upgrade': push(st, { t: 'upgrade', n: 1, tech: true, s: 0 }); break;
        case 'mineral': gain(st, YOU, 'mineral'); break;
        case 'bots': push(st, { t: 'move', bot: 2, rover: 0, cr: true, s: 0 }); break;
        case 'warehouse': push(st, { t: 'ware', n: 1 }); break;
        case 'adv': push(st, { t: 'adv', s: 0 }); break;
    }
    return DONE;
};
export const execName = k => ({ develop: 'Develop', rover: 'Rover', blueprint: 'Blueprint', upgrade: 'Upgrade', mineral: 'Mineral', bots: 'Bots', warehouse: 'Warehouse', adv: 'Advanced Building' })[k];

/** Advanced buildings the human can activate, with how it would be paid. */
export function advChoices(st) {
    const p = you(st);
    const out = [];
    for (const pi of [YOU, PF]) {
        for (const b of st.p[pi].bps.filter(b => b.h)) {
            const def = D.bp(b.id);
            const sciHere = Object.keys(st.sciLoc).find(s => st.sciLoc[s] === b.id);
            const sciOwner = sciHere ? (you(st).scis.includes(sciHere) ? YOU : PF) : -1;
            const free = sciHere && (sciOwner === YOU || pi === YOU);
            const mySci = p.scis.find(s => D.sci(s).works === def.type);
            const ways = [];
            if (free) ways.push('free');
            if (!free && mySci) ways.push('sci');
            if (!free && pi === YOU && p.cr + p.goals.length >= 2) ways.push('pay');
            if (ways.length && advUsable(st, b.id)) out.push({ id: b.id, o: pi, ways, sci: mySci });
        }
    }
    return out;
}
function advUsable(st, id) {
    const p = you(st);
    switch (D.bp(id).ex) {
        case 'upgrade1': case 'drone': return upgradeChoices(st, { anywhere: D.bp(id).ex === 'drone' }).length > 0;
        case 'build': return buildTypes(st, { type: D.bp(id).type, colBoost: true }).length > 0;
        case 'ship': return !shipBlock(st, ['plant', 'water']);
        case 'tech': return techChoices(st).length > 0;
        case 'contract': return hireChoices(st, { contractOnly: true }).length > 0;
        case 'research': return devChoices(st, true).length > 0;
        case 'aqueduct': return p.col.wa > 0;
        case 'resort': return Object.values(st.slots).some(s => s.includes(YOU));
        case 'trade': return Object.values(p.res).some(n => n > 0);
        case 'elevator': return p.side === 'colony';
        case 'radar': return st.radar[id] ? true : st.explore.length > 0;
    }
    return true;
}
H.adv = (st, t, a) => {
    const p = you(st);
    if (t.s === 0) {
        if (!a) { ask(st, { kind: 'pick', q: 'adv', choices: advChoices(st) }); return; }
        t.id = a.v.id; t.way = a.v.way; t.s = 1; a = undefined;
        if (t.way === 'sci') { const s = p.scis.find(s => D.sci(s).works === D.bp(t.id).type); st.sciLoc[s] = t.id; }
        if (t.way === 'pay') { push(st, { t: 'pay', cost: ['crystal', 'crystal'], s: 0 }); return; }
    }
    if (t.s === 1) {
        const ex = D.bp(t.id).ex;
        log(st, 'you', 'adv', D.bp(t.id).name, { bp: t.id });
        if (D.EX_BOOST[ex] && p.col.lq > 0 && !a && ex !== 'build') { ask(st, { kind: 'num', q: 'boost', k: ex, min: 0, max: p.col.lq, def: 0 }); return; }
        const n = a ? a.v : 0;
        boost(st, n);
        t.s = 2;
        switch (ex) {
            case 'upgrade1': push(st, { t: 'upgrade', n: 1 + n, tech: true, s: 0 }); break;
            case 'drone': push(st, { t: 'upgrade', n: 1, tech: true, anywhere: true, s: 0 }); break;
            case 'build': push(st, { t: 'build', type: D.bp(t.id).type, fixed: D.bp(t.id).type, colBoost: true, s: 0 }); break;
            case 'produce': production(st, YOU); if (n) push(st, { t: 'produceExtra', n }); break;
            case 'ship': push(st, { t: 'welcome', n: 1 + n, variant: 'private', s: 0 }); break;
            case 'warehouse': push(st, { t: 'ware', n: 1 + n }); break;
            case 'tech': push(st, { t: 'takeTech', n: 1 + n, s: 0 }); break;
            case 'casino': gain(st, YOU, 'crystal', 2 + n); break;
            case 'op2': addOP(st, YOU, 2, 'mineralMine'); break;
            case 'contract': push(st, { t: 'hire', contractOnly: true, s: 0 }); break;
            case 'research': push(st, { t: 'develop', n: 2 + n, pay: true, s: 0 }); break;
            case 'aqueduct': { const k = Math.min(2, p.col.wa); p.col.wa -= k; toLQ(st, YOU, k); break; }
            case 'resort': push(st, { t: 'resort' }); break;
            case 'trade': push(st, { t: 'trade', n: 2 + n, s: 0 }); break;
            case 'recycle': push(st, { t: 'move', bot: 2, rover: 0, cr: true, asRover: true, s: 0 }); break;
            case 'elevator': push(st, { t: 'travel', to: 'orbit', s: 0 }); break;
            case 'library': push(st, { t: 'takeBp', n: 1 + n }); break;
            case 'command': {
                const lv = Math.max(0, ...[YOU, PF].map(o => { const x = techTile(st, 'rover', o); return x && x.o === o ? x.level : 0; }));
                push(st, { t: 'move', bot: 0, rover: lv, cr: true, roverMode: true, botMode: false, noTech: true, s: 0 });
                break;
            }
            case 'radar': push(st, { t: 'radar', id: t.id, s: 0 }); break;
        }
        return;
    }
    return DONE;
};
export function production(st, pi) {
    for (const h of HEXES) {
        const b = B(st, h);
        if (!b) continue;
        if (b.adv?.o === pi) gain(st, pi, D.PRODUCES[b.type]);
        if (b.type === 'mine' && b.col === pi) gain(st, pi, 'mineral');
    }
}
H.produceExtra = (st, t, a) => {
    if (a) { gain(st, YOU, D.PRODUCES[B(st, a.v).type]); t.n--; }
    const hs = HEXES.filter(h => B(st, h)?.adv?.o === YOU || (B(st, h)?.type === 'mine' && B(st, h).col === YOU));
    if (t.n <= 0 || !hs.length) return DONE;
    ask(st, { kind: 'hex', q: 'produceExtra', hexes: hs.map(h => ({ h })), left: t.n });
};
H.resort = (st, t, a) => {
    if (!a) {
        const sides = ['orbit', 'colony'].filter(s => SIDE_SLOTS[s].some(k => st.slots[k].includes(YOU)));
        if (sides.length === 1) a = { v: sides[0] };
        else { ask(st, { kind: 'pick', q: 'side', opts: sides }); return; }
    }
    let n = 0;
    for (const k of SIDE_SLOTS[a.v]) { const c = st.slots[k].filter(o => o === YOU).length; n += c; st.slots[k] = st.slots[k].filter(o => o !== YOU); }
    toLQ(st, YOU, n);
    return DONE;
};
H.trade = (st, t, a) => {
    const p = you(st);
    if (t.s === 0) {
        if (!a) { ask(st, { kind: 'pick', q: 'tradeOut', items: D.RES.filter(r => p.res[r] > 0) }); return; }
        p.res[a.v]--; t.s = 1; a = undefined;
    }
    if (a) {
        if (a.v === 'done') return DONE;
        gain(st, YOU, a.v); t.n--;
    }
    if (t.n <= 0) return DONE;
    ask(st, { kind: 'pick', q: 'tradeIn', items: ['battery', 'water', 'plant', 'oxygen'], left: t.n, skip: true });
};
H.radar = (st, t, a) => {
    if (st.radar[t.id]) { discBenefit(st, st.radar[t.id]); return DONE; }
    if (!a) { ask(st, { kind: 'pick', q: 'radar', discs: [...st.explore] }); return; }
    st.radar[t.id] = a.v;
    st.explore = st.explore.filter(x => x !== a.v);
    if (st.discStack.length) st.explore.push(st.discStack.shift());
    discBenefit(st, a.v);
    return DONE;
};

// ================================================================ private goals
export function goalMet(st, id) {
    const p = you(st);
    const k = D.GOALS[id - 1].k;
    const adv = advHexes(st, YOU);
    switch (k) {
        case 'blueprints4': return p.bps.length >= 4;
        case 'shelters3': return shelterCount(st, YOU) >= 3;
        case 'mines3': return HEXES.filter(h => { const b = B(st, h); return b && b.type === 'mine' && (b.col === YOU || b.adv?.o === YOU); }).length >= 3;
        case 'discovery3': return p.discs.length >= 3;
        case 'advComplex4': return adv.some(h => complexOf(st, h).length >= 4);
        case 'sameRes4': return ['battery', 'water', 'plant', 'oxygen'].some(r => p.res[r] >= 4);
        case 'adv3': return adv.length >= 3;
        case 'level3': return st.level >= 3;
        case 'colonists7': return p.col.lq >= 7;
        case 'techs5': return techCount(p) >= 5;
        case 'ships3': return p.hangar >= 3;
        case 'research2': return p.researches.length >= 2;
        case 'sciContract': return p.scis.length >= 1 && p.contracts.some(c => c.done || contractMet(st, YOU, c));
        case 'labSpaces': return D.GOAL14_SPACES.every(s => p.lab[s]);
        case 'progress3': return progressCount(p) >= 3;
        case 'adv2Complex3': {
            const big = adv.filter(h => complexOf(st, h).length >= 3).map(h => complexOf(st, h).sort().join('|'));
            return new Set(big).size >= 2;
        }
    }
    return false;
}
H.goal = (st, t, a) => {
    const p = you(st);
    const g = D.GOALS[t.id - 1];
    if (!a) { ask(st, { kind: 'pick', q: 'goalReward', id: t.id, opts: ['develop2', g.r] }); return; }
    p.goals = p.goals.filter(x => x !== t.id);
    p.goalDone = t.id;
    log(st, 'you', 'goal', `Private goal complete`, { goal: t.id });
    switch (a.v) {
        case 'develop2': push(st, { t: 'develop', n: 2, pay: false, s: 0 }); break;
        case 'upgrade2': push(st, { t: 'upgrade', n: 2, tech: false, free: true, s: 0 }); break;
        case 'colonists2': { const n = Math.min(2, p.col.sup); p.col.sup -= n; toLQ(st, YOU, n); break; }
        case 'minerals3': gain(st, YOU, 'mineral', 3); break;
        case 'rover5': push(st, { t: 'move', bot: 0, rover: 5, cr: true, roverMode: true, botMode: false, s: 0 }); break;
        case 'contract': push(st, { t: 'hire', contractOnly: true, free: true, s: 0 }); break;
        case 'res3': push(st, { t: 'trade', n: 3, s: 1 }); break;
        case 'ship': push(st, { t: 'welcome', n: 1, free: true, s: 0 }); break;
        case 'retrieve2': push(st, { t: 'retrieve', n: 2 }); break;
        case 'travel': push(st, { t: 'travel', to: otherSide(p.side), s: 0 }); break;
        case 'scientist': push(st, { t: 'hire', free: true, s: 0 }); break;
        case 'crystals3': gain(st, YOU, 'crystal', 3); break;
    }
    return DONE;
};

// ================================================================ end of turn
H.endTurn = (st, t, a) => {
    const cur = st.turn?.p ?? YOU;
    if (t.s === 0) {
        t.uses = (st.turn?.techUses || []).filter(u => u.o !== cur);
        t.s = 1;
    }
    if (t.s === 1) {
        // tech owners: Pathfinder develops, you choose oxygen or develop
        while (t.uses.length) {
            const u = t.uses[0];
            if (u.o === PF) { AI.pfDevelopUsed(st, u.type); t.uses.shift(); continue; }
            const p = you(st);
            const pos = Object.keys(p.lab).find(k => p.lab[k] === u.type);
            const can = pos && devTargets(p, pos).length > 0;
            if (!can) { gain(st, YOU, 'oxygen'); t.uses.shift(); continue; }
            if (!a) { ask(st, { kind: 'pick', q: 'techReward', tech: u.type, opts: ['oxygen', 'develop'] }); return; }
            t.uses.shift();
            if (a.v === 'oxygen') { gain(st, YOU, 'oxygen'); a = undefined; continue; }
            push(st, { t: 'freeDev', pos }); return;
        }
        t.s = 2;
    }
    if (t.s === 2) {
        // contracts completed when their requirement is met
        for (const c of you(st).contracts) if (!c.done && contractMet(st, YOU, c)) {
            c.done = true; contribute(st, YOU, 'contract');
            log(st, 'you', 'contract', `Contract #${c.id} complete`);
        }
        t.s = 3;
    }
    if (t.s === 3) {
        if (colonyUpdateDue(st)) { push(st, { t: 'colonyUpdate', s: 0 }); return; }
        return DONE;
    }
};
/** Develop a specific tile once for free (tech-owner reward). */
H.freeDev = (st, t, a) => {
    const p = you(st);
    const tg = devTargets(p, t.pos);
    if (!tg.length) return DONE;
    if (tg.length > 1 && !a) { ask(st, { kind: 'pick', q: 'devTo', from: t.pos, to: tg.map(d => d.k) }); return; }
    const to = a ? a.v : tg[0].k;
    const tech = p.lab[t.pos]; delete p.lab[t.pos]; p.lab[to] = tech;
    log(st, 'you', 'develop', `${D.TECHS[tech].name} → ${labCol(to)}`);
    push(st, { t: 'labBen', pos: to, s: 0 });
    return DONE;
};

// ================================================================ colony status update
H.colonyUpdate = (st, t) => {
    if (t.s === 0) {
        st.level++;
        log(st, 'sys', 'level', `Colony level ${st.level}`);
        // blueprints
        if (st.level === 2) { st.bpBot = st.bpDeck.splice(0, 6); st.bpTop = st.bpDeck.splice(0, 6); }
        if (st.level === 3) { st.bpBot = st.bpDeck.splice(0, 6); while (st.bpBot.length < 6) st.bpBot.push(null); }
        // (2p: no tech refill) warehouse refill
        D.WARE.forEach(w => st.ware[w] = Math.max(st.ware[w], D.WARE_FILL));
        // progress scoring
        if (st.level === 2 || st.level === 3) [YOU, PF].forEach(pi => addOP(st, pi, D.PROGRESS_OP[progressCount(st.p[pi])], 'progress'));
        updateRemaining(st);
        if (st.level >= 5) st.endTriggered = true;
        t.s = 1;
        AI.pfColonyUpdate(st);
        return;
    }
    if (colonyUpdateDue(st)) { t.s = 0; return; }
    return DONE;
};

// ================================================================ shuttle phase & travel
H.shuttle = (st, t, a) => {
    const sh = st.shuttle;
    if (t.s === 0) {
        st.phase = 'shuttle';
        t.traveled = false; t.from = sh.side;
        if (!sh.gone) {
            if (st.level >= 5 && !sh.finalTravel) { sh.finalTravel = true; travelShuttle(st, t); sh.gone = true; }
            else if (st.level === 4) { /* stopped */ }
            else if (sh.pos <= 1) travelShuttle(st, t);
            else sh.pos--;
        }
        t.order = [0, 1].sort((x, y) => st.p[x].space - st.p[y].space);
        t.i = 0; t.s = 1;
    }
    while (t.i < t.order.length) {
        const pi = t.order[t.i];
        const p = st.p[pi];
        if (pi === PF) {
            t.i++;
            const go = AI.pfShuttleDecision(st, t.traveled, t.from);
            if (go) { push(st, { t: 'pfTravel', to: otherSide(p.side) }); return; }
            continue;
        }
        const free = t.traveled && p.side === t.from;
        const canShip = p.hangar > 0;
        if (!free && !canShip) { t.i++; continue; }
        if (!a) { ask(st, { kind: 'pick', q: 'travel', free, to: otherSide(p.side), opts: ['go', 'stay'] }); return; }
        t.i++;
        if (a.v === 'go') {
            if (!free) { p.hangar--; log(st, 'you', 'ship', 'Ship used to travel'); }
            push(st, { t: 'travel', to: otherSide(p.side), s: 0 });
            return;
        }
        a = undefined;
    }
    return DONE;
};
function travelShuttle(st, t) {
    const sh = st.shuttle;
    sh.side = otherSide(sh.side);
    sh.pos = Math.min(3, st.level);
    t.traveled = true;
    log(st, 'sys', 'shuttle', `Shuttle → ${sh.side}`);
}

/** Human travel steps. */
H.travel = (st, t, a) => {
    const p = you(st);
    if (t.s === 0) {
        log(st, 'you', 'travel', `Travel → ${t.to}`);
        t.s = 1;
        if (t.to === 'colony' && !t.pod && st.explore.length) { push(st, { t: 'placeDisc', s: 0 }); return; }
        if (t.to === 'orbit') production(st, YOU);
    }
    if (t.s === 1) {
        // retrieve colonists from the destination side + working area
        let n = p.col.wa; p.col.wa = 0;
        for (const k of SIDE_SLOTS[t.to]) { n += st.slots[k].filter(o => o === YOU).length; st.slots[k] = st.slots[k].filter(o => o !== YOU); }
        toLQ(st, YOU, n);
        p.side = t.to; p.space = 0;
        t.s = 2;
        push(st, { t: 'space', side: t.to });
        return;
    }
    return DONE;
};
H.placeDisc = (st, t, a) => {
    if (t.s === 0) {
        if (st.explore.length > 1 && !a) { ask(st, { kind: 'pick', q: 'discPick', discs: [...st.explore] }); return; }
        t.id = a ? a.v : st.explore[0]; t.s = 1; a = undefined;
    }
    const spots = HEXES.filter(h => dist(h, roverHex(st)) === 3 && isEmpty(st, h));
    if (!spots.length) return DONE;
    if (!a) { ask(st, { kind: 'hex', q: 'discHex', disc: t.id, hexes: spots.map(h => ({ h })) }); return; }
    st.hex[a.v].disc = t.id;
    st.explore = st.explore.filter(x => x !== t.id);
    if (st.discStack.length) st.explore.push(st.discStack.shift());
    flash(st, a.v);
    return DONE;
};

/** Choose a turn-order space (and gain its benefit). */
H.space = (st, t, a) => {
    const p = you(st);
    if (!a) {
        const range = t.side === 'orbit' ? [1, 2, 3, 4] : t.side === 'colony' ? [5, 6, 7, 8] : [1, 2, 3, 4, 5, 6, 7, 8];
        ask(st, { kind: 'pick', q: 'space', spaces: range.filter(n => !spaceTaken(st, n)), first: !!t.first });
        return;
    }
    p.space = a.v; p.side = sideOf(a.v);
    log(st, 'you', 'space', `Turn order ${a.v}`);
    const ben = D.TURN_SPACES[a.v];
    if (ben) push(st, { t: 'spaceBen', ben, s: 0 });
    return DONE;
};
H.spaceBen = (st, t, a) => {
    const p = you(st);
    switch (t.ben) {
        case 'warehouse': push(st, { t: 'ware', n: 1 }); return DONE;
        case 'tech': push(st, { t: 'takeTech', n: 1, s: 0 }); return DONE;
        case 'bots': push(st, { t: 'move', bot: 2, rover: 0, cr: true, s: 0 }); return DONE;
        case 'blueprint': push(st, { t: 'takeBp', n: 1 }); return DONE;
        case 'colonist': {
            if (!p.col.sup || p.col.lq >= lqCap(st, YOU)) return DONE;
            const opts = payOptions(p, ['water']).concat(payOptions(p, ['plant']));
            const uniq = opts.filter((b, i) => opts.findIndex(x => JSON.stringify(x) === JSON.stringify(b)) === i);
            if (!uniq.length) return DONE;
            if (!a) { ask(st, { kind: 'pick', q: 'pay', bags: uniq, skip: true, why: 'colonist' }); return; }
            if (a.v === 'done') return DONE;
            for (const k in a.v) p.res[k] -= a.v[k];
            p.col.sup--; toLQ(st, YOU, 1);
            return DONE;
        }
    }
    return DONE;
};
