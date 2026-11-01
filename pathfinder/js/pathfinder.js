// @ts-check
// Pathfinder: the unofficial solo opponent, played exactly by its card rules.
// Rules: docs/PATHFINDER.md (incl. errata and the engine interpretations listed there).
import * as D from './data.js';
import {
    H, DONE, YOU, PF, push, ask, log, B, botAt, roverHex, isEmpty, canEnd, complexOf, techTile, labCol, labSpace,
    devTargets, buildSpots, stackLeft, addOP, colonyRow, lssValue, placeOnSlot, completeMission, HEXES, neighbors,
    dist, cardOrder, otherSide, spaceTaken, advHexes,
} from './core.js';
import { construct, upgradeBuilding, upgradeTargets, takeBlueprint, bpCards } from './tasks.js';
import { shuffle } from './rng.js';

const pf = st => st.p[PF];
const card = st => st.solo.card ? D.solo(st.solo.card) : { n: 1, x: false };
/** First hex in card order. */
export function cardPick(st, hexes) { return cardOrder(hexes, card(st))[0]; }
function say(st, t, k, text, extra) { log(st, 'pf', k, text, extra); t && t.sum.push(Object.assign({ k, text }, extra || {})); }

// ================================================================ turn
H.pfTurn = (st, t, a) => {
    const p = pf(st);
    if (t.s === 0) {
        st.turn = { p: PF, main: true, exec: true, techUses: [] };
        const s = st.solo;
        if (!s.deck.length) {
            s.deck = shuffle(st, s.discard); s.discard = []; s.exhausted = true;
            log(st, 'pf', 'shuffle', 'Solo deck reshuffled');
        }
        s.card = s.deck.shift();
        s.discard.push(s.card);
        const c = D.solo(s.card);
        t.sum = []; t.card = s.card;
        const acted = doAction(st, t, p.side, c.n);
        if (p.side === 'colony' || !acted) moveBots(st, t, st.level);
        if (s.exhausted) {
            const m = st.missions.find(m => m.at === c.m);
            if (m && !m.done) {
                m.left--;
                say(st, t, 'mission', `Mission ${c.m} −1`, { m: m.id });
                if (m.left <= 0) completeMission(st, m);
            }
        }
        t.s = 1;
        return;
    }
    if (t.s === 1) {
        if (!a) { ask(st, { kind: 'ack', q: 'pfTurn', card: t.card, side: p.side, sum: t.sum }); return; }
        t.s = 2;
        push(st, { t: 'endTurn', s: 0 });
        return;
    }
    p.done = true;
    st.turn = null;
    return DONE;
};

/** @returns {boolean} whether the card's action could be taken */
function doAction(st, t, side, n) {
    if (side === 'orbit') {
        if (n === 1) return obtainBlueprint(st, t, true);
        if (n === 2) return learnTech(st, t);
        return rnd(st, t, true);
    }
    if (n === 1) return pfConstruct(st, t, { action: true });
    if (n === 2) return pfUpgrade(st, t, 1, true);
    return pfHire(st, t);
}

// ================================================================ orbit actions
function obtainBlueprint(st, t, slot) {
    const p = pf(st);
    const cards = bpCards(st);
    if (!p.ab || !cards.length) return false;
    if (slot) placeOnSlot(st, 'blueprint', PF);
    const scored = new Set(p.scis.map(s => D.sci(s).scores));
    let cand = cards.filter(c => scored.has(D.bp(c.id).type));
    if (cand.length) {
        const owned = type => st.p.reduce((n, q) => n + q.bps.filter(b => D.bp(b.id).type === type).length, 0);
        const best = Math.max(...cand.map(c => owned(D.bp(c.id).type)));
        cand = cand.filter(c => owned(D.bp(c.id).type) === best);
    } else cand = cards;
    const topN = st.bpTop.filter(Boolean).length, botN = st.bpBot.filter(Boolean).length;
    const rows = botN >= topN ? ['bot', 'top'] : ['top', 'bot'];
    let ch = null;
    for (const r of rows) {
        const inRow = cand.filter(c => c.row === r).sort((x, y) => x.i - y.i);
        if (inRow.length) { ch = inRow[0]; break; }
    }
    takeBlueprint(st, PF, ch.id);
    say(st, t, 'bp', D.bp(ch.id).name, { bp: ch.id });
    return true;
}

function learnTech(st, t) {
    const p = pf(st);
    const pos = ['1a', '1b'].find(k => !p.lab[k]);
    if (!pos) return false;
    const owned = new Set(Object.values(p.lab));
    const order = [6, 7, 3, 4, 5, 0, 1, 2]; // cheapest first, leftmost within a row
    const i = order.find(i => st.grid[i] && !owned.has(st.grid[i]));
    if (i === undefined) return false;
    const tech = st.grid[i];
    st.grid[i] = null;
    p.lab[pos] = tech;
    say(st, t, 'tech', D.TECHS[tech].name, { tech });
    labBenefit(st, t, pos);
    return true;
}

/** R&D: most-developed first, then least-developed; ties → bottom-most. */
function rnd(st, t, slot) {
    const p = pf(st);
    const movable = () => Object.keys(p.lab).filter(pos => devTargets(p, pos).length);
    if (!movable().length) return false;
    if (slot) placeOnSlot(st, 'rnd', PF);
    for (const most of [true, false]) {
        const m = movable();
        if (!m.length) break;
        m.sort((a, b) => most ? (labCol(b) - labCol(a)) || (labSpace(b).y - labSpace(a).y) : (labCol(a) - labCol(b)) || (labSpace(b).y - labSpace(a).y));
        developTile(st, t, m[0]);
    }
    return true;
}
/** Move a tile right-and-down, else right-and-up; take its benefit. */
function developTile(st, t, pos) {
    const p = pf(st);
    const s = labSpace(pos);
    const tg = devTargets(p, pos);
    const to = (tg.find(d => d.y === s.y + 1) || tg.find(d => d.y === s.y - 1)).k;
    const tech = p.lab[pos];
    delete p.lab[pos]; p.lab[to] = tech;
    say(st, t, 'develop', `${D.TECHS[tech].name} → ${labCol(to)}`, { tech });
    labBenefit(st, t, to);
}
function labBenefit(st, t, pos) {
    switch (labSpace(pos).ben) {
        case 'warehouse': resupply(st, t); break;
        case 'bots': moveBots(st, t, 2); break;
        case 'upgrade': pfUpgrade(st, t, 1, false); break;
        case 'blueprint': obtainBlueprint(st, t, false); break;
        // crystal & mineral benefits are ignored
    }
}

/** Resupply: the item your Advanced Buildings produce least. */
export function resupply(st, t) {
    const items = D.WARE.filter(w => st.ware[w] > 0);
    if (!items.length) return false;
    const prodOf = w => Object.keys(D.PRODUCES).filter(b => D.PRODUCES[b] === w);
    const built = w => advHexes(st, YOU).filter(h => prodOf(w).includes(B(st, h).type)).length;
    const potential = w => st.p[YOU].bps.filter(b => prodOf(w).includes(D.bp(b.id).type)).length;
    items.sort((a, b) => (built(a) - built(b)) || (potential(a) - potential(b)) || (D.WARE.indexOf(a) - D.WARE.indexOf(b)));
    st.ware[items[0]]--;
    say(st, t, 'ware', `Resupply: ${items[0]}`, { item: items[0] });
    return true;
}

// ================================================================ colony actions
/**
 * Construct the largest complex possible.
 * opts.type forces a type (discovery tile / shelter); opts.action = Action 1 (types below the colony marker).
 */
export function pfConstruct(st, t, opts) {
    const types = opts.type ? [opts.type] : D.LSS_TYPES.filter(ty => st.lss[ty] < colonyRow(st));
    let cands = [];
    for (const type of types) {
        if (!stackLeft(st, PF, type)) continue;
        for (const s of buildSpots(st, PF, type, { anywhere: true, noPieces: true })) cands.push({ type, ...s });
    }
    if (!cands.length) return false;
    const max = Math.max(...cands.map(c => c.size));
    cands = cands.filter(c => c.size === max);
    if (st.opts.difficulty === 'legend' && !opts.type) {
        const opNow = ty => (st.lss[ty] === 1 ? 2 : 0) + (st.lss[ty] < colonyRow(st) ? lssValue(st, PF, st.lssTiles[D.LSS_TYPES.indexOf(ty)]) : 0);
        const tys = [...new Set(cands.map(c => c.type))];
        const best = Math.max(...tys.map(opNow));
        const ty = tys.filter(x => opNow(x) === best).sort((a, b) => D.LSS_TYPES.indexOf(a) - D.LSS_TYPES.indexOf(b))[0];
        cands = cands.filter(c => c.type === ty);
    }
    const h = cardPick(st, [...new Set(cands.map(c => c.h))]);
    const ch = cands.filter(c => c.h === h).sort((a, b) => D.BTYPES.indexOf(a.type) - D.BTYPES.indexOf(b.type))[0];
    if (opts.action) placeOnSlot(st, 'construct', PF);
    if (ch.need > 0) {
        const tech = techTile(st, ch.type, PF);
        st.turn?.techUses.push({ o: tech.o, type: ch.type });
    }
    construct(st, PF, ch.type, ch.h);
    t && t.sum.push({ k: 'build', text: `${D.BUILD_NAMES[ch.type]} · ${ch.size}`, h: ch.h, type: ch.type, size: ch.size });
    return true;
}
/** Second LSS benefit: retrieve its colonist from Hire, otherwise nothing. */
export function pfLssBenefit(st) {
    const i = st.slots.hire.indexOf(PF);
    if (i >= 0) { st.slots.hire.splice(i, 1); log(st, 'pf', 'retrieve', 'Retrieves Hire colonist'); }
}

/** Upgrade: blueprints scored by its scientists first, else oldest; targets by card order. */
export function pfUpgrade(st, t, n, slot) {
    const p = pf(st);
    const usable = () => p.bps.filter(b => !b.h && upgradeTargets(st, PF, D.bp(b.id)).length);
    if (!usable().length) return false;
    if (slot) placeOnSlot(st, 'upgrade', PF);
    const tech = techTile(st, 'upgrade', PF);
    if (tech && usable().length > n) {
        n += tech.level;
        st.turn?.techUses.push({ o: tech.o, type: 'upgrade' });
    }
    const scored = new Set(p.scis.map(s => D.sci(s).scores));
    for (let i = 0; i < n; i++) {
        const u = usable();
        if (!u.length) break;
        const b = u.find(b => scored.has(D.bp(b.id).type)) || u[0];
        const h = cardPick(st, upgradeTargets(st, PF, D.bp(b.id)));
        upgradeBuilding(st, PF, b.id, h);
        t && t.sum.push({ k: 'upgrade', text: D.bp(b.id).name, h, bp: b.id });
    }
    return true;
}

function pfHire(st, t) {
    const p = pf(st);
    if (st.slots.hire.includes(PF)) return false;
    const slots = st.sciSlots.map((s, i) => ({ ...s, i }));
    const contracts = slots.filter(s => s.c);
    let i;
    if (contracts.length) {
        const best = Math.max(...contracts.map(s => D.contract(s.c).win));
        const s = contracts.find(s => D.contract(s.c).win === best);
        i = s.i;
        p.contracts.push({ id: s.c, del: {}, done: true });
        say(st, t, 'contract', `Contract #${s.c}`, { c: s.c });
        st.sciSlots[i].c = null;
    } else {
        const scis = slots.filter(s => s.s);
        if (!scis.length) return false;
        const owned = type => st.p.reduce((n, q) => n + q.bps.filter(b => D.bp(b.id).type === type).length, 0);
        const best = Math.max(...scis.map(s => owned(D.sci(s.s).scores)));
        let tied = scis.filter(s => owned(D.sci(s.s).scores) === best);
        if (tied.length > 1) {
            for (const b of p.bps) {
                const m = tied.find(s => D.sci(s.s).scores === D.bp(b.id).type);
                if (m) { tied = [m]; break; }
            }
        }
        const s = tied[0];
        i = s.i;
        p.scis.push(s.s); st.sciLoc[s.s] = null;
        say(st, t, 'sci', D.sci(s.s).name, { sci: s.s });
        st.sciSlots[i].s = null;
    }
    placeOnSlot(st, 'hire', PF);
    if (st.contractDeck.length) {
        st.contractDeck = shuffle(st, st.contractDeck);
        st.sciSlots[i].c = st.contractDeck.shift();
    }
    return true;
}

// ================================================================ bots
/** Move one bot (card order) toward the nearest tile/crystal. */
export function moveBots(st, t, mp) {
    const mine = st.bots.filter(b => b.o === PF);
    if (!mine.length) return;
    const bot = mine.find(b => b.h === cardPick(st, mine.map(b => b.h)));
    const targets = HEXES.filter(h => { const x = st.hex[h]; return (x.disc || x.res || x.crystal) && h !== bot.h; });
    if (!targets.length) { say(st, t, 'bots', 'Bots idle'); return; }
    const near = Math.min(...targets.map(h => dist(h, bot.h)));
    const goal = cardPick(st, targets.filter(h => dist(h, bot.h) === near));
    const path = [];
    let cur = bot.h;
    while (cur !== goal && path.length < mp) {
        const opts = neighbors(cur).filter(n => dist(n, goal) === dist(cur, goal) - 1);
        cur = cardPick(st, opts);
        path.push(cur);
    }
    while (path.length && !canEnd(st, path[path.length - 1], bot)) path.pop();
    if (!path.length) { say(st, t, 'bots', 'Bot blocked'); return; }
    const from = bot.h;
    bot.h = path[path.length - 1];
    st.flash.push(bot.h);
    const x = st.hex[bot.h];
    let took = '';
    if (x.disc) { x.disc = null; took = 'disc'; }
    if (x.res) { x.res = null; took = 'res'; }
    if (x.crystal) { x.crystal = 0; took = took || 'crystal'; }
    say(st, t, 'bots', `Bot moves ${path.length}${took ? ' · clears ' + took : ''}`, { from, h: bot.h, took });
}

// ================================================================ tech owner reward
export function pfDevelopUsed(st, type) {
    const p = pf(st);
    const pos = Object.keys(p.lab).find(k => p.lab[k] === type);
    if (pos && devTargets(p, pos).length) developTile(st, null, pos);
}

// ================================================================ colony status update
export function pfColonyUpdate(st) {
    const p = pf(st);
    const row = st.level + 1;
    const tiles = st.pfDisc[row] || [];
    st.pfDisc[row] = [];
    for (const id of tiles) {
        log(st, 'pf', 'disc', `LSS discovery`, { disc: id });
        discBenefit(st, id);
    }
    // shelter + bot on it
    let shelter = null;
    if (p.shelterTiles > 0) {
        const before = new Set(HEXES.filter(h => B(st, h)?.type === 'shelter' && B(st, h).o === PF));
        if (pfConstruct(st, null, { type: 'shelter' })) shelter = HEXES.find(h => B(st, h)?.type === 'shelter' && B(st, h).o === PF && !before.has(h));
    }
    if (shelter && p.botsOff > 0 && !botAt(st, shelter)) {
        st.bots.push({ o: PF, h: shelter }); p.botsOff--;
        log(st, 'pf', 'bot', 'New bot');
    }
    if (p.ships.length) { p.ships.shift(); p.hangar++; p.shipsOut++; log(st, 'pf', 'ship', 'Ship welcomed'); }
    resupply(st, null);
}
function discBenefit(st, id) {
    const d = D.disc(id);
    switch (d.k) {
        case 'build': pfConstruct(st, null, { type: d.b }); break;
        case 'buildAny': pfConstruct(st, null, {}); break;
        case 'develop2': rnd(st, null, false); break;
        case 'blueprints2': obtainBlueprint(st, null, false); obtainBlueprint(st, null, false); break;
        case 'tech1': learnTech(st, null); break;
        case 'upgrade2': pfUpgrade(st, null, 2, false); break;
        case 'hire': pfHireFree(st); break;
        case 'warehouse2': resupply(st, null); resupply(st, null); break;
    }
}
function pfHireFree(st) {
    // like Action 3 but as a benefit: no action slot
    const had = st.slots.hire.includes(PF);
    if (had) st.slots.hire.splice(st.slots.hire.indexOf(PF), 1);
    const ok = pfHire(st, null);
    if (ok) st.slots.hire.splice(st.slots.hire.lastIndexOf(PF), 1);
    if (had) st.slots.hire.push(PF);
}

// ================================================================ shuttle phase
/** Turn-order space from the card: 1→1/5, 2→2/6, 3→3/7, X→4/8; taken → left, else right. */
function cardSpace(st, side) {
    const c = card(st);
    const base = side === 'orbit' ? 0 : 4;
    const want = base + (c.x ? 4 : c.n);
    const free = n => n > base && n <= base + 4 && !st.p.some((q, i) => i !== PF && q.space === n);
    if (free(want)) return want;
    if (free(want - 1)) return want - 1;
    return want + 1;
}
/** @returns {boolean} travel? (an X card instead moves it to 4/8 on its side) */
export function pfShuttleDecision(st, traveled, from) {
    const p = pf(st);
    if (card(st).x) {
        const sp = cardSpace(st, p.side);
        if (sp !== p.space) { p.space = sp; log(st, 'pf', 'space', `Stays · space ${sp}`); }
        return false;
    }
    return traveled && p.side === from;
}
H.pfTravel = (st, t) => {
    const p = pf(st);
    log(st, 'pf', 'travel', `Travels → ${t.to}`);
    p.space = 0;
    if (t.to === 'colony') placeDiscovery(st);
    p.side = t.to;
    p.space = cardSpace(st, t.to);
    log(st, 'pf', 'space', `Turn order ${p.space}`);
    if (t.to === 'colony' && st.opts.difficulty !== 'rookie') {
        st.turn = { p: PF, techUses: [] };
        pfConstruct(st, null, { action: false });
        push(st, { t: 'endTurn', s: 0 });
    }
    return DONE;
};
function placeDiscovery(st) {
    if (!st.explore.length) return;
    const mine = st.bots.filter(b => b.o === PF).map(b => b.h);
    if (!mine.length) return;
    const chosen = cardPick(st, mine);
    const others = mine.filter(h => h !== chosen);
    let spots = HEXES.filter(h => isEmpty(st, h) && dist(h, chosen) === 3 && others.every(o => dist(o, h) >= 3));
    if (!spots.length) { log(st, 'pf', 'disc', 'No room for discovery tile'); return; }
    const far = Math.max(...spots.map(h => dist(h, roverHex(st))));
    const h = cardPick(st, spots.filter(x => dist(x, roverHex(st)) === far));
    const id = st.explore.shift();
    st.hex[h].disc = id;
    if (st.discStack.length) st.explore.push(st.discStack.shift());
    st.flash.push(h);
    log(st, 'pf', 'disc', 'Places discovery tile', { h, disc: id });
}
