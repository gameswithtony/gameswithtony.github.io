// @ts-check
// Legal action generation for a player with a known hand.
// Consumption choices are generated as a small number of variants ('own' first vs 'other' first),
// not every permutation: those are the choices that matter for play (help yourself vs help a rival).

import { IND, ERA, LOCATIONS, LINKS, SPACES, CARDS, WILD_LOC, WILD_IND, SELLABLE, tileDef } from './data.js';
import {
    currentPlayer, nextLevel, networkLocs, hasTilesOnBoard, buildSpacesAt, planBuild, planNetwork,
    linkAllowed, planDevelop, canDevelop, sellTargets, planSale, canLoan, canScout, components, clone,
} from './core.js';

/** Default card keep-values (higher = more valuable to keep). The AI can pass its own. */
export function defaultCardValue(s, p, card) {
    const c = CARDS[card];
    if (c.kind === 'wildLoc' || c.kind === 'wildInd') return 10;
    if (c.kind === 'ind') return 3;
    return 2;
}

/** Cards in hand ordered from least to most valuable. */
function cardsByValue(s, p, cardValue) {
    const hand = s.players[p].hand;
    if (hand === null) return [null];
    return [...new Set(hand)].sort((a, b) => cardValue(s, p, a) - cardValue(s, p, b));
}

function samePlan(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

/**
 * All candidate actions for the current player.
 * @param {any} s
 * @param {{cardValue?:Function, freeDev?:Function, doubles?:boolean, player?:number}} [opts]
 */
export function generateActions(s, opts = {}) {
    const p = opts.player ?? currentPlayer(s);
    const cardValue = opts.cardValue || defaultCardValue;
    const hand = s.players[p].hand;
    const cards = cardsByValue(s, p, cardValue);
    const worst = cards[0];
    const out = [];

    // ---- BUILD
    const inNet = networkLocs(s, p);
    const noTiles = !hasTilesOnBoard(s, p);
    for (let ind = 0; ind < 6; ind++) {
        if (!nextLevel(s, p, ind)) continue;
        for (const loc of LOCATIONS) {
            if (loc.kind === 'merchant') continue;
            const spaces = buildSpacesAt(s, p, ind, loc.id);
            if (!spaces.length) continue;
            // cheapest card that allows this build
            let card = null, plan = null;
            for (const c of cards) {
                const pl = planBuild(s, p, c, ind, spaces[0]);
                if (pl) { card = c; break; }
                if (c === null) break;
            }
            if (card === null && hand !== null) {
                // no card worked for the first space; still try the others below with all cards
            }
            for (const sp of spaces) {
                for (const c of (card !== null ? [card] : cards)) {
                    plan = planBuild(s, p, c, ind, sp, 'own');
                    if (!plan) continue;
                    out.push(plan);
                    const other = planBuild(s, p, c, ind, sp, 'other');
                    if (other && !samePlan(other.coal, plan.coal) || other && !samePlan(other.iron, plan.iron)) out.push(other);
                    break;
                }
            }
        }
    }

    // ---- NETWORK
    if (s.players[p].links > 0) {
        const singles = [];
        for (let l = 0; l < LINKS.length; l++) {
            if (!linkAllowed(s, p, l, inNet, noTiles)) continue;
            const a = planNetwork(s, p, worst, [l]);
            if (a) { out.push(a); singles.push(l); }
        }
        if (s.era === ERA.Rail && opts.doubles !== false && s.players[p].links >= 2) {
            for (const l1 of singles) {
                for (let l2 = 0; l2 < LINKS.length; l2++) {
                    if (l2 === l1 || (singles.includes(l2) && l2 < l1)) continue; // unordered when both are placeable first
                    const a = planNetwork(s, p, worst, [l1, l2]);
                    if (a) out.push(a);
                }
            }
        }
    }

    // ---- DEVELOP
    const devs = [];
    for (let ind = 0; ind < 6; ind++) if (canDevelop(s, p, ind)) devs.push(ind);
    for (let i = 0; i < devs.length; i++) {
        const a = planDevelop(s, p, worst, [devs[i]]);
        if (a) out.push(a);
        for (let j = i; j < devs.length; j++) {
            const b = planDevelop(s, p, worst, [devs[i], devs[j]]);
            if (b) out.push(b);
        }
    }

    // ---- SELL
    for (const a of generateSells(s, p, worst, opts.freeDev)) out.push(a);

    // ---- LOAN / SCOUT / PASS
    if (canLoan(s, p)) out.push({ t: 'loan', card: worst, cost: 0 });
    if (hand !== null && canScout(s, p)) {
        const sorted = hand.slice().sort((a, b) => cardValue(s, p, a) - cardValue(s, p, b));
        out.push({ t: 'scout', card: sorted[0], extra: [sorted[1], sorted[2]], cost: 0 });
    }
    out.push({ t: 'pass', card: worst, cost: 0 });
    return out;
}

/** Unflipped sellable tiles of p that currently have a merchant to sell to. */
export function sellableTiles(s, p) {
    const comp = components(s);
    const out = [];
    for (let sp = 0; sp < SPACES.length; sp++) {
        const t = s.spaces[sp];
        if (!t || t.o !== p || t.flip || !SELLABLE.includes(t.ind)) continue;
        if (sellTargets(s, sp, comp).length) out.push(sp);
    }
    return out;
}

/**
 * Sell actions: every subset of sellable tiles (up to 5 tiles), each planned greedily.
 * Merchant choice prefers one with beer (bonus); beer prefers merchant, then own, then other;
 * a second variant prefers rival breweries over own.
 */
export function generateSells(s, p, card, freeDevFn) {
    const tiles = sellableTiles(s, p).slice(0, 5);
    const out = [];
    const n = tiles.length;
    for (let mask = 1; mask < (1 << n); mask++) {
        const subset = tiles.filter((_, i) => mask & (1 << i));
        for (const pref of ['merchant-own', 'merchant-other']) {
            const a = planSellSequence(s, p, card, subset, pref, freeDevFn);
            if (a && !out.some(o => samePlan(o.sales, a.sales))) out.push(a);
        }
    }
    return out;
}

function planSellSequence(s, p, card, subset, pref, freeDevFn) {
    // sell tiles needing more beer first while merchant beer is plentiful
    const order = subset.slice().sort((a, b) => tileDef(s.spaces[b].ind, s.spaces[b].lvl).beer - tileDef(s.spaces[a].ind, s.spaces[a].lvl).beer);
    const w = clone(s);
    w.log = null;
    const sales = [];
    for (const sp of order) {
        const targets = sellTargets(w, sp);
        // merchants with beer first (the bonus)
        targets.sort((a, b) => w.merch[b].beer - w.merch[a].beer);
        let sale = null;
        for (const mi of targets) { sale = planSale(w, p, sp, mi, pref); if (sale) break; }
        if (!sale) return null;
        applySaleToWork(w, p, sale);
        sales.push(sale);
    }
    const a = { t: 'sell', card, sales, freeDev: [], cost: 0 };
    const gloucester = sales.filter(x => x.beer.some(b => b.m !== undefined) && LOCATIONS[s.merch[x.mi].loc].bonus.type === 'develop').length;
    if (gloucester) a.freeDev = freeDevFn ? freeDevFn(s, p, gloucester) : defaultFreeDev(s, p, gloucester);
    return a;
}

function applySaleToWork(w, p, sale) {
    for (const b of sale.beer) {
        if (b.m !== undefined) w.merch[b.m].beer--;
        else w.spaces[b.sp].res--;
    }
    w.spaces[sale.sp].flip = true;
}

/** Default free develop: drop the lowest-level tile among industries the player is developing past. */
export function defaultFreeDev(s, p, count) {
    const picks = [];
    const mat = s.players[p].mat.map(a => a.slice());
    for (let k = 0; k < count; k++) {
        let best = -1, bestLvl = 99;
        for (let ind = 0; ind < 6; ind++) {
            const i = mat[ind].findIndex(c => c > 0);
            if (i < 0 || tileDef(ind, i + 1).noDev) continue;
            // prefer removing obsolete canal-only tiles in the rail era, then the lowest level
            const lvl = (s.era === ERA.Rail && tileDef(ind, i + 1).canalOnly) ? 0 : i + 1;
            if (lvl < bestLvl) { bestLvl = lvl; best = ind; }
        }
        if (best < 0) break;
        picks.push(best);
        mat[best][mat[best].findIndex(c => c > 0)]--;
    }
    return picks;
}
