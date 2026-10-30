// @ts-check
// The AI: evaluation of a position as "expected final VP", and a beam search over the AI's turn.
// Design notes: v2/notes/02-AI-DESIGN.md

import { IND, ERA, LOCATIONS, LINKS, LINKS_AT, SPACES, SPACES_AT, CARDS, SELLABLE, tileDef, MERCHANT_LOCS } from './data.js';
import { clone, doAction, components, incomeLevel, nextLevel, networkLocs, rand } from './core.js';
import { generateActions } from './moves.js';

// ---------------------------------------------------------------------------
// Weights. Every persona starts from BASE and overrides a few values.
export const BASE = {
    // chance a tile flips this era
    pSellReady: 0.9, pRouteNoBeer: 0.45, pRailLater: 0.55,
    pByLinks: [0.9, 0.6, 0.4, 0.22, 0.1], // no route yet: chance by links still needed to reach a buyer
    coalRate: [0.4, 1.1], ironRate: [0.7, 0.6], // cubes/round a tile can expect to lose
    beerBase: [0.03, 0.25], // beer/round drunk from a brewery beyond known sale demand (rail: double links)
    // economy (VP per £); income is valued as money, slightly discounted
    moneyRate: [0.33, 0.25], incomeDiscount: 0.8, spendPerAction: 6,
    poorBoost: 0.25, poorLine: 20, // the first £20 is worth more (you need it to act)
    shortfallRate: 1.0, shortfallHorizon: 4, // VP per £ of projected shortfall over the next few income phases
    // potential
    matW: 0.55, interest: [1.0, 0.8, 0.8, 0.6, 0.5, 0.7], // Brewery, Goods, Cotton, Pottery, Coal, Iron
    handW: 0.12, orderW: 1.0, linkBias: 0,
    // denial: extra weight on rivals' pending sales, so taking their beer/route is worth a bit more
    // planning: count the actions a tile still needs to flip against actions left this era
    planFlips: 1, flipSlack: 3,
    // income: value future income along a projected climb (spaces/round), so early loans cost less
    incomeGrowth: 1.5,
    // lookahead: for the best few turns, imagine the next rival's best reply and my best follow-up
    lookahead: 6, laBlend: 0.5,
    denialW: 0.3, // mild by request (Tony 2026-10-29: "not aggressive but exists")
    // search
    beam: 10, temperature: 0,
};

export const PERSONAS = {
    balanced: {},
    cotton: { interest: [1.0, 0.4, 1.25, 0.3, 0.5, 0.7] },
    goods: { interest: [1.0, 1.25, 0.4, 0.3, 0.5, 0.7] },
    potter: { interest: [1.0, 0.5, 0.5, 1.3, 0.5, 0.7] },
    railBaron: { interest: [1.3, 0.7, 0.7, 0.5, 0.6, 0.6], linkBias: 0.15 },
    supplier: { interest: [0.9, 0.7, 0.7, 0.5, 1.0, 1.1] },
};

/** Names and blurbs for the setup screen (keys match PERSONAS). */
export const PERSONA_INFO = [
    { key: 'balanced', name: 'Balanced', blurb: 'Plays the board in front of her. No fixed plan.' },
    { key: 'cotton', name: 'Cotton Baron', blurb: 'Develops cotton early and sells it in bulk.' },
    { key: 'goods', name: 'Manufacturer', blurb: 'Climbs the manufactured goods ladder around Birmingham.' },
    { key: 'potter', name: 'Potter', blurb: 'High risk, high reward: chases the big pottery tiles.' },
    { key: 'railBaron', name: 'Rail Baron', blurb: 'Brews beer and spends it on double rail links.' },
    { key: 'supplier', name: 'Ironmaster', blurb: 'Coal and iron first, then cashes in.' },
];

export function weights(persona) {
    const p = typeof persona === 'string' ? PERSONAS[persona] || {} : persona || {};
    return { ...BASE, ...p };
}

// ---------------------------------------------------------------------------
// Timing helpers

/** Actions player p still has this era (from the state's turn position). */
export function actionsLeftEra(s, p) {
    const idx = s.order.indexOf(p);
    let now = 0;
    if (idx === s.turn) now = s.acts;
    else if (idx > s.turn) now = s.firstTurnOfEra ? 1 : 2;
    return now + 2 * (s.rounds - s.round);
}
export function actionsLeftGame(s, p) { return actionsLeftEra(s, p) + (s.era === ERA.Canal ? 2 * s.rounds : 0); }
function roundsLeftEra(s) { return s.rounds - s.round + 0.6; }
function incomePhasesLeft(s) { return s.era === ERA.Canal ? (s.rounds - s.round + 1) + (s.rounds - 1) : s.rounds - s.round; }

// ---------------------------------------------------------------------------
// Card keep-values for the AI (used to pick which card to spend)
export function makeCardValue(w) {
    return function cardValue(s, p, card) {
        const c = CARDS[card];
        if (c.kind === 'wildLoc' || c.kind === 'wildInd') return 9;
        const inNet = networkLocs(s, p);
        if (c.kind === 'loc') {
            let fits = 0;
            for (const sp of SPACES_AT[c.loc]) {
                if (s.spaces[sp]) continue;
                for (const ind of SPACES[sp].types) if (nextLevel(s, p, ind)) fits += w.interest[ind];
            }
            return 1 + 0.6 * fits + (inNet[c.loc] ? 0 : 0.8);
        }
        let fits = 0;
        for (const loc of LOCATIONS) {
            if (!inNet[loc.id]) continue;
            for (const sp of SPACES_AT[loc.id]) if (!s.spaces[sp] && c.inds.some(i => SPACES[sp].types.includes(i) && nextLevel(s, p, i))) fits++;
        }
        const interest = Math.max(...c.inds.map(i => w.interest[i]));
        return 1 + 0.4 * fits * interest;
    };
}

// ---------------------------------------------------------------------------
// Evaluation

/** Probability each tile on the board flips by the end of this era. Returns array indexed by space. */
export function flipChances(s, w, comp = components(s)) {
    const pf = new Array(SPACES.length).fill(0);
    const rL = roundsLeftEra(s);
    const timeF = Math.min(1, rL / 3);
    const era = s.era;
    // towns per connected component (coal demand)
    const compTowns = new Map();
    for (const loc of LOCATIONS) if (loc.kind !== 'merchant') compTowns.set(comp[loc.id], (compTowns.get(comp[loc.id]) || 0) + 1);
    const ct = []; for (const [k, v] of compTowns) ct[k] = v;
    const compTownsArr = ct;
    // beer pools
    const ownBeer = s.players.map(() => 0);
    const compBeer = new Map(); // comp -> [{o, res}]
    for (let sp = 0; sp < SPACES.length; sp++) {
        const t = s.spaces[sp];
        if (!t) continue;
        if (t.flip) { pf[sp] = 1; continue; }
        if (t.ind === IND.Brewery) {
            ownBeer[t.o] += t.res;
            const c = comp[SPACES[sp].loc];
            if (!compBeer.has(c)) compBeer.set(c, s.players.map(() => 0));
            compBeer.get(c)[t.o] += t.res;
        }
        if (t.ind === IND.IronWorks) {
            pf[sp] = t.res === 0 ? 1 : Math.min(1, (w.ironRate[era] * rL) / t.res) * 0.95;
        } else if (t.ind === IND.CoalMine) {
            // coal only leaves to builds/rail links connected to the mine: scale by the size of its network
            const conn = Math.min(1.5, Math.max(0.15, (compTownsArr[comp[SPACES[sp].loc]] - 1) / 4 + (era === ERA.Rail ? 0.3 : 0)));
            pf[sp] = t.res === 0 ? 1 : Math.min(1, (w.coalRate[era] * conn * rL) / t.res) * 0.95;
        }
    }
    // merchant beer per component and industry
    const merchBeer = new Map();
    for (const m of s.merch) {
        const c = comp[m.loc];
        for (const ind of m.accepts) {
            const k = c * 8 + ind;
            merchBeer.set(k, (merchBeer.get(k) || 0) + m.beer);
            if (!merchBeer.has(-k - 1)) merchBeer.set(-k - 1, 1); // route marker
        }
    }
    // sellable tiles: allocate beer greedily, most valuable tiles first
    for (const pl of s.players) {
        const o = pl.id;
        const aLeft = actionsLeftEra(s, o);
        const tiles = [];
        for (let sp = 0; sp < SPACES.length; sp++) {
            const t = s.spaces[sp];
            if (t && t.o === o && !t.flip && SELLABLE.includes(t.ind)) tiles.push(sp);
        }
        tiles.sort((a, b) => tileDef(s.spaces[b].ind, s.spaces[b].lvl).vp - tileDef(s.spaces[a].ind, s.spaces[a].lvl).vp);
        let own = ownBeer[o];
        // planFlips: tiles that still need links/beer compete for this era's remaining actions
        // (one Sell action is reserved; it can sell several tiles at once)
        let budget = aLeft - 1;
        const feasible = extra => {
            if (!w.planFlips) return timeF;
            const f = Math.max(0, Math.min(1, (budget - extra + 1) / w.flipSlack));
            if (f > 0) budget -= extra;
            return f;
        };
        for (const sp of tiles) {
            const t = s.spaces[sp];
            const def = tileDef(t.ind, t.lvl);
            const c = comp[SPACES[sp].loc];
            const route = merchBeer.has(-(c * 8 + t.ind) - 1);
            if (aLeft <= 0) { pf[sp] = 0; continue; }
            if (!route) {
                const d = routeDist(s, t.ind)[SPACES[sp].loc];
                const beerShort = own >= def.beer ? 0 : 1;
                const extra = Math.min(d, 9) + beerShort;
                pf[sp] = (w.pByLinks[Math.min(d, w.pByLinks.length - 1)] || 0) * feasible(extra) * (aLeft >= 2 ? 1 : 0.3);
                continue;
            }
            let need = def.beer;
            const mk = c * 8 + t.ind;
            const fromMerch = Math.min(need, merchBeer.get(mk) || 0);
            need -= fromMerch;
            const fromOwn = Math.min(need, own); need -= fromOwn;
            const cb = compBeer.get(c);
            let fromRival = 0;
            if (need > 0 && cb) for (let q = 0; q < cb.length && need > 0; q++) { if (q === o) continue; const n = Math.min(need, cb[q]); cb[q] -= n; need -= n; fromRival += n; }
            if (need === 0) {
                merchBeer.set(mk, (merchBeer.get(mk) || 0) - fromMerch);
                own -= fromOwn;
                pf[sp] = w.pSellReady * (aLeft >= 1 ? 1 : 0);
            } else {
                pf[sp] = w.pRouteNoBeer * feasible(1);
            }
        }
    }
    // breweries: beer only flips when someone drinks it. Demand = own unsold tiles' beer (drinkable from
    // anywhere) + connected rivals' unsold tiles + a base rate (rail double links).
    const demandOwn = s.players.map(() => 0);
    const demandComp = new Map(); // comp -> per player beer need
    for (let sp = 0; sp < SPACES.length; sp++) {
        const t = s.spaces[sp];
        if (!t || t.flip || !SELLABLE.includes(t.ind)) continue;
        const need = tileDef(t.ind, t.lvl).beer * Math.max(pf[sp], 0.3);
        demandOwn[t.o] += need;
        const c = comp[SPACES[sp].loc];
        if (!demandComp.has(c)) demandComp.set(c, s.players.map(() => 0));
        demandComp.get(c)[t.o] += need;
    }
    for (let sp = 0; sp < SPACES.length; sp++) {
        const t = s.spaces[sp];
        if (!t || t.flip || t.ind !== IND.Brewery) continue;
        if (t.res === 0) { pf[sp] = 1; continue; }
        const dc = demandComp.get(comp[SPACES[sp].loc]);
        let rival = 0;
        if (dc) dc.forEach((d, q) => { if (q !== t.o) rival += d; });
        const supply = Math.max(ownBeer[t.o], t.res);
        const own = demandOwn[t.o] * (t.res / supply);
        pf[sp] = Math.min(1, (own + 0.5 * rival + w.beerBase[era] * rL) / t.res) * 0.95;
    }
    return pf;
}

/** Links still needed (in this era's lines) from each location to a merchant buying `ind`. */
const routeCache = new WeakMap();
export function routeDist(s, ind) {
    let cache = routeCache.get(s.links);
    if (!cache) { cache = []; routeCache.set(s.links, cache); }
    if (cache[ind]) return cache[ind];
    const dist = new Array(LOCATIONS.length).fill(Infinity);
    const dq = [];
    for (const m of s.merch) if (m.accepts.includes(ind) && dist[m.loc] !== 0) { dist[m.loc] = 0; dq.push(m.loc); }
    // 0-1 BFS: built links cost 0, open lines usable this era cost 1
    while (dq.length) {
        const a = dq.shift();
        for (const l of LINKS_AT[a]) {
            const def = LINKS[l];
            const built = s.links[l] >= 0;
            if (!built && !(s.era === ERA.Canal ? def.canal : def.rail)) continue;
            const c = built ? 0 : 1;
            for (const b of def.locs) if (dist[a] + c < dist[b]) { dist[b] = dist[a] + c; if (c) dq.push(b); else dq.unshift(b); }
        }
    }
    cache[ind] = dist;
    return dist;
}

/** Expected final VP for every player. */
export function evaluateAll(s, w) {
    const comp = components(s);
    const pf = flipChances(s, w, comp);
    const n = s.n;
    const v = new Array(n).fill(0);
    const sellPot = new Array(n).fill(0); // expected VP from rivals' unsold tiles (for denial)
    const canal = s.era === ERA.Canal;
    const phases = incomePhasesLeft(s);

    // tiles
    const locLink = new Array(LOCATIONS.length).fill(0);
    for (let sp = 0; sp < SPACES.length; sp++) {
        const t = s.spaces[sp];
        if (!t) continue;
        const def = tileDef(t.ind, t.lvl);
        const mult = canal && t.lvl >= 2 ? 2 : 1;
        const p = pf[sp];
        let val = p * def.vp * mult;
        if (!t.flip && canal && t.lvl >= 2) val += (1 - p) * w.pRailLater * def.vp;
        if (!t.flip) val += p * (def.inc / 2) * Math.max(0, phases - 1) * 0.6 * w.moneyRate[s.era] * w.incomeDiscount;
        v[t.o] += val;
        if (!t.flip && SELLABLE.includes(t.ind)) sellPot[t.o] += p * def.vp * mult;
        locLink[SPACES[sp].loc] += p * def.link;
    }
    for (const m of MERCHANT_LOCS) locLink[m] = 2;
    // links (this era)
    for (let l = 0; l < LINKS.length; l++) {
        const o = s.links[l];
        if (o < 0) continue;
        let lv = 0;
        for (const loc of LINKS[l].locs) lv += locLink[loc];
        v[o] += lv * (1 + w.linkBias);
    }
    // economy, mat, banked
    for (const pl of s.players) {
        const o = pl.id;
        const aLeft = actionsLeftGame(s, o);
        const fade = Math.min(1, aLeft / 6);
        v[o] += pl.vp;
        const lvl = incomeLevel(pl.inc);
        if (pl.money !== null) {
            const m = Math.min(pl.money, aLeft * w.spendPerAction);
            v[o] += (m + w.poorBoost * Math.min(m, w.poorLine)) * w.moneyRate[s.era] * fade;
            // negative income eats cash every round; a shortfall costs tiles or VP
            if (lvl < 0) {
                const low = pl.money + lvl * Math.min(phases, w.shortfallHorizon);
                if (low < 0) v[o] += low * w.shortfallRate;
            }
        }
        v[o] += projectedIncome(pl.inc, phases, w.incomeGrowth) * w.moneyRate[s.era] * w.incomeDiscount * fade;
        v[o] += matValue(s, o, w) * w.matW * fade;
    }
    v.sellPot = sellPot;
    return v;
}

/** Sum of income levels over the remaining income phases, assuming the marker climbs `growth` spaces a round. */
export function projectedIncome(space, phases, growth) {
    if (!growth) return incomeLevel(space) * phases;
    let total = 0;
    for (let t = 0; t < phases; t++) total += incomeLevel(Math.min(99, Math.round(space + growth * t)));
    return total;
}

/** How good the next tiles on a player's mat are, weighted by interest in each industry. */
export function matValue(s, p, w) {
    let total = 0;
    for (let ind = 0; ind < 6; ind++) {
        const lvl = nextLevel(s, p, ind);
        if (!lvl) continue;
        const def = tileDef(ind, lvl);
        let q;
        if (s.era === ERA.Rail && def.canalOnly) q = -3;
        else {
            const mult = s.era === ERA.Canal ? (lvl >= 2 ? 1.6 : 0.8) : 1;
            q = def.vp * mult + def.link * 1.5 + def.inc * 0.3 - def.cost * 0.12 - (def.coal + def.iron) * 0.8;
        }
        total += w.interest[ind] * q;
    }
    return total;
}

/** Relative value for player p: own estimate minus the strongest rivals. */
export function relValue(s, p, w) {
    const v = evaluateAll(s, w);
    let max = -Infinity, sum = 0;
    for (let q = 0; q < s.n; q++) if (q !== p) { const vq = v[q] + w.denialW * v.sellPot[q]; max = Math.max(max, vq); sum += vq; }
    const rival = s.n === 2 ? max : 0.5 * max + 0.5 * (sum / (s.n - 1));
    let r = v[p] - rival;
    // hand (own only; rivals' hands are hidden)
    const hand = s.players[p].hand;
    if (hand) { const cv = makeCardValue(w); for (const c of hand) r += cv(s, p, c) * w.handW; }
    r += turnOrderValue(s, p, w);
    return r;
}

/** Estimated value of next round's turn position (spend less -> go earlier). */
function turnOrderValue(s, p, w) {
    if (s.n < 2 || (s.era === ERA.Rail && s.round >= s.rounds)) return 0;
    const proj = s.players.map(pl => {
        const idx = s.order.indexOf(pl.id);
        let still = 0;
        if (idx > s.turn) still = s.firstTurnOfEra ? 1 : 2;
        else if (idx === s.turn) still = pl.id === p ? 0 : s.acts;
        return pl.spent + still * 8;
    });
    // stable rank: earlier in current order wins ties
    let rank = 0;
    for (const q of s.order) { if (q === p) break; }
    for (let q = 0; q < s.n; q++) {
        if (q === p) continue;
        if (proj[q] < proj[p] || (proj[q] === proj[p] && s.order.indexOf(q) < s.order.indexOf(p))) rank++;
    }
    return w.orderW * (1 - rank / (s.n - 1));
}

// ---------------------------------------------------------------------------
// Search

function tryApply(s, a, p) {
    const w = clone(s);
    w.log = null;
    try { doAction(w, a, p); } catch (e) { return null; }
    if (p === undefined) w.acts--;
    return w;
}

/** Best single action for player q in state s by q's relative value (q's own hand, or any card if hidden). */
function greedyAction(s, q, w, genOpts) {
    let best = null;
    for (const a of generateActions(s, { ...genOpts, player: q })) {
        const st = tryApply(s, a, q);
        if (!st) continue;
        const v = relValue(st, q, w);
        if (!best || v > best.v) best = { a, st, v };
    }
    return best;
}

/**
 * Lookahead: after my turn, the next rival makes its best reply (we can't see its hand, so it may use any card),
 * then I make my best follow-up with the cards I have left. Returns my relative value after that, or null.
 */
function lookaheadValue(st, p, w, genOpts) {
    const order = st.order;
    const pos = order.indexOf(p);
    if (st.round >= st.rounds && pos === order.length - 1) return null; // nothing left this era
    const q = order[(pos + 1) % order.length] === p ? order[(pos + 2) % order.length] : order[(pos + 1) % order.length];
    if (q === undefined || q === p) return null;
    const r = clone(st);
    r.log = null;
    r.players[q] = { ...r.players[q], hand: null }; // hidden information: model the rival as holding any card
    const reply = greedyAction(r, q, w, { ...genOpts, cardValue: undefined });
    const afterReply = reply ? reply.st : r;
    if (!afterReply.players[p].hand || !afterReply.players[p].hand.length) return relValue(afterReply, p, w);
    const mine = greedyAction(afterReply, p, w, genOpts);
    return mine ? mine.v : relValue(afterReply, p, w);
}

function applyLookahead(list, p, w, genOpts, counter) {
    if (!w.lookahead || !list.length) return list;
    const top = list.slice(0, w.lookahead);
    for (const c of top) {
        const la = lookaheadValue(c.st, p, w, genOpts);
        counter.n++;
        if (la !== null) c.v = (1 - w.laBlend) * c.v + w.laBlend * la;
    }
    top.sort((x, y) => y.v - x.v);
    return top.concat(list.slice(w.lookahead).filter(x => x.v < top[top.length - 1].v));
}

/**
 * Choose the current player's whole turn (1 or 2 actions).
 * @returns {{actions:any[], value:number, considered:number}}
 */
export function chooseTurn(s, persona) {
    const w = weights(persona);
    const p = s.order[s.turn];
    const root = clone(s);
    root.log = null;
    const genOpts = { cardValue: makeCardValue(w) };
    const firsts = [];
    let considered = 0;
    for (const a of generateActions(root, genOpts)) {
        const st = tryApply(root, a);
        if (!st) continue;
        considered++;
        firsts.push({ a, st, v: relValue(st, p, w) });
    }
    firsts.sort((x, y) => y.v - x.v);
    const counter = { n: 0 };
    if (root.acts <= 1 || !firsts.length) {
        const singles = applyLookahead(firsts.map(f => ({ actions: [f.a], st: f.st, v: f.v })), p, w, genOpts, counter);
        return pick(singles, w, root, considered);
    }

    // beam: top K plus the best of each action type
    const beam = firsts.slice(0, w.beam);
    const seen = new Set(beam.map(f => f.a.t));
    for (const f of firsts) if (!seen.has(f.a.t)) { beam.push(f); seen.add(f.a.t); }

    let pairs = [];
    for (const f of beam) {
        let best = null;
        for (const b of generateActions(f.st, genOpts)) {
            const st2 = tryApply(f.st, b);
            if (!st2) continue;
            considered++;
            const v = relValue(st2, p, w);
            if (!best || v > best.v) best = { actions: [f.a, b], st: st2, v };
            if (w.temperature > 0) pairs.push({ actions: [f.a, b], st: st2, v });
        }
        if (best && w.temperature === 0) pairs.push(best);
    }
    pairs.sort((x, y) => y.v - x.v);
    pairs = applyLookahead(pairs, p, w, genOpts, counter);
    return pick(pairs, w, root, considered);
}

function pick(list, w, s, considered) {
    if (!list.length) throw new Error('AI found no legal action');
    if (w.temperature <= 0 || list.length === 1) return { actions: list[0].actions, value: list[0].v, considered };
    const top = list.slice(0, 12);
    const max = top[0].v;
    const ws = top.map(x => Math.exp((x.v - max) / w.temperature));
    let r = rand(s) * ws.reduce((a, b) => a + b, 0);
    for (let i = 0; i < top.length; i++) { r -= ws[i]; if (r <= 0) return { actions: top[i].actions, value: top[i].v, considered }; }
    return { actions: top[0].actions, value: top[0].v, considered };
}
