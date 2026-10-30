// @ts-check
// Brass: Birmingham rules engine. Pure-ish functions over a plain JSON state.
// Mutating functions change the state passed in; callers clone first when they need to (see clone()).
// Rules reference: eliza/v2/notes/01-RULES-MODEL.md

import {
    IND, ERA, LOCATIONS, LINKS, LINKS_AT, SPACES, SPACES_AT, MERCHANT_SLOTS, MERCHANT_TILES, MERCHANT_LOCS,
    TILES, tileDef, CARDS, WILD_LOC, WILD_IND, WILDS_EACH, deckFor, ROUNDS_PER_ERA, START_MONEY,
    START_INCOME_SPACE, LINKS_PER_PLAYER, HAND_SIZE, COAL_MARKET, IRON_MARKET, SELLABLE,
} from './data.js';

// ---------------------------------------------------------------------------
// RNG (mulberry32), state kept in s.rng so games replay from a seed.
export function rand(s) {
    let t = (s.rng = (s.rng + 0x6D2B79F5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export function shuffle(s, arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rand(s) * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// ---------------------------------------------------------------------------
// Income track
export function incomeLevel(space) {
    if (space <= 10) return space - 10;
    if (space <= 30) return Math.ceil((space - 10) / 2);
    if (space <= 60) return 10 + Math.ceil((space - 30) / 3);
    return Math.min(30, 20 + Math.ceil((space - 60) / 4));
}
export function topSpaceOfLevel(level) {
    if (level <= 0) return level + 10;
    if (level <= 10) return 10 + 2 * level;
    if (level <= 20) return 30 + 3 * (level - 10);
    return Math.min(99, 60 + 4 * (level - 20));
}

// ---------------------------------------------------------------------------
// Setup

/**
 * @param {{players:{name:string, kind:'ai'|'human', persona?:string, color?:string}[], seed?:number, mode?:'phone'|'physical', firstPlayer?:number}} cfg
 */
export function newGame(cfg) {
    const n = cfg.players.length;
    if (n < 2 || n > 4) throw new Error('2-4 players');
    const mode = cfg.mode || 'phone';
    /** @type {any} */
    const s = {
        v: 2, mode, n, era: ERA.Canal, round: 1, rounds: ROUNDS_PER_ERA[n],
        rng: (cfg.seed ?? Math.floor(Math.random() * 2 ** 32)) >>> 0,
        players: cfg.players.map((p, i) => ({
            id: i, name: p.name, kind: p.kind, persona: p.persona || null, color: p.color || null,
            money: START_MONEY, // tracked for everyone, both modes (physical humans report loans)
            inc: START_INCOME_SPACE, vp: 0,
            hand: [], discard: [], pile: null, // pile: private draw pile (physical mode AIs)
            mat: TILES.map(levels => levels.map(t => t.n)),
            links: LINKS_PER_PLAYER, spent: 0,
            score: { canalLinks: 0, canalTiles: 0, railLinks: 0, railTiles: 0, bonus: 0 },
        })),
        order: [], turn: 0, acts: 1, firstTurnOfEra: true,
        deck: [], wilds: [WILDS_EACH, WILDS_EACH],
        spaces: SPACES.map(() => null),
        links: LINKS.map(() => -1),
        coal: COAL_MARKET.start, iron: IRON_MARKET.start,
        merch: [],
        over: false,
        log: [],
    };
    // physical-mode human: hand unknown
    for (const p of s.players) if (s.mode === 'physical' && p.kind === 'human') p.hand = null;

    // merchant tiles
    const slots = MERCHANT_SLOTS.filter(m => m.minPlayers <= n);
    const tiles = shuffle(s, MERCHANT_TILES.filter(t => t.minPlayers <= n).map(t => t.accepts.slice()));
    s.merch = slots.map((slot, i) => ({ slot: slot.id, loc: slot.loc, accepts: tiles[i], beer: tiles[i].length ? 1 : 0 }));

    // turn order
    const order = shuffle(s, [...Array(n).keys()]);
    if (cfg.firstPlayer !== undefined) { order.splice(order.indexOf(cfg.firstPlayer), 1); order.unshift(cfg.firstPlayer); }
    s.order = order;
    dealEra(s, true);
    emit(s, { t: 'start', order: s.order.slice(), merch: s.merch.map(m => ({ loc: m.loc, accepts: m.accepts })) });
    return s;
}

/** Deal cards at the start of an era. */
function dealEra(s, canal) {
    const full = deckFor(s.n);
    if (s.mode === 'phone') {
        s.deck = shuffle(s, full.slice());
        for (const p of s.players) {
            p.hand = s.deck.splice(0, HAND_SIZE);
            p.discard = canal ? s.deck.splice(0, 1) : [];
        }
    } else {
        // physical: each AI gets its own share of a virtual shuffled deck; shares never overlap.
        const share = 2 * s.rounds;
        const virt = shuffle(s, full.slice());
        let at = 0;
        s.deck = [];
        for (const p of s.players) {
            if (p.kind === 'human') { p.hand = null; p.pile = null; p.discard = []; continue; }
            const mine = virt.slice(at, at + share); at += share;
            p.hand = mine.splice(0, HAND_SIZE);
            p.discard = canal ? mine.splice(0, 1) : [];
            p.pile = mine;
        }
    }
}

// ---------------------------------------------------------------------------
// Cloning (fast, for search)
export function clone(s) {
    return {
        ...s,
        players: s.players.map(p => ({
            ...p, hand: p.hand && p.hand.slice(), discard: p.discard.slice(), pile: p.pile && p.pile.slice(),
            mat: p.mat.map(a => a.slice()), score: { ...p.score },
        })),
        order: s.order.slice(), deck: s.deck.slice(), wilds: s.wilds.slice(),
        spaces: s.spaces.map(t => t && { ...t }),
        links: s.links.slice(),
        merch: s.merch.map(m => ({ ...m })),
        log: s.log ? [] : null,
    };
}

export function emit(s, ev) {
    if (s.log) { ev.era = s.era; ev.round = s.round; s.log.push(ev); }
}

// ---------------------------------------------------------------------------
// Queries
export const currentPlayer = s => s.order[s.turn];
export const isAI = (s, p) => s.players[p].kind === 'ai';

/** Lowest remaining level of an industry on a player's mat (0 if none). */
export function nextLevel(s, p, ind) {
    const m = s.players[p].mat[ind];
    for (let i = 0; i < m.length; i++) if (m[i] > 0) return i + 1;
    return 0;
}

export function hasTilesOnBoard(s, p) {
    for (const t of s.spaces) if (t && t.o === p) return true;
    for (const o of s.links) if (o === p) return true;
    return false;
}

/** Locations in p's network (bool array). */
export function networkLocs(s, p) {
    const inNet = new Array(LOCATIONS.length).fill(false);
    for (let i = 0; i < SPACES.length; i++) { const t = s.spaces[i]; if (t && t.o === p) inNet[SPACES[i].loc] = true; }
    for (let l = 0; l < LINKS.length; l++) if (s.links[l] === p) for (const loc of LINKS[l].locs) inNet[loc] = true;
    return inNet;
}

/** Link-count distance from a set of locations over built links (any owner). */
export function distances(s, fromLocs) {
    const dist = new Array(LOCATIONS.length).fill(Infinity);
    const q = [];
    for (const f of fromLocs) { if (dist[f] !== 0) { dist[f] = 0; q.push(f); } }
    while (q.length) {
        const a = q.shift();
        for (const l of LINKS_AT[a]) {
            if (s.links[l] < 0) continue;
            for (const b of LINKS[l].locs) if (dist[b] === Infinity) { dist[b] = dist[a] + 1; q.push(b); }
        }
    }
    return dist;
}

/** Connected-component id per location over built links. */
export function components(s) {
    const comp = new Array(LOCATIONS.length).fill(-1);
    let c = 0;
    for (let i = 0; i < LOCATIONS.length; i++) {
        if (comp[i] >= 0) continue;
        const q = [i]; comp[i] = c;
        while (q.length) {
            const a = q.pop();
            for (const l of LINKS_AT[a]) {
                if (s.links[l] < 0) continue;
                for (const b of LINKS[l].locs) if (comp[b] < 0) { comp[b] = c; q.push(b); }
            }
        }
        c++;
    }
    return comp;
}

export function connectedToAnyMerchant(s, locs, comp = components(s)) {
    for (const loc of locs) for (const m of MERCHANT_LOCS) if (comp[m] === comp[loc]) return true;
    return false;
}

export function totalCubes(s, ind) {
    let n = ind === IND.CoalMine ? s.coal : s.iron;
    for (const t of s.spaces) if (t && t.ind === ind) n += t.res;
    return n;
}

// ---------------------------------------------------------------------------
// Markets
function buyPrice(count, mk) { return count > 0 ? Math.floor((mk.size - count) / 2) + 1 : mk.emptyPrice; }
function sellPrice(count, mk) { return Math.floor((mk.size - count - 1) / 2) + 1; }

/** Cost to buy k cubes from a market holding `count`. */
export function marketCost(count, k, mk) {
    let cost = 0;
    for (let i = 0; i < k; i++) { cost += buyPrice(count, mk); if (count > 0) count--; }
    return cost;
}
export const coalCost = (s, k) => marketCost(s.coal, k, COAL_MARKET);
export const ironCost = (s, k) => marketCost(s.iron, k, IRON_MARKET);

// ---------------------------------------------------------------------------
// Resource plans. A plan: { take: [[spaceId, n], ...], mkt: n, cost: £ }
// prefer: 'own' (default) or 'other' - only breaks ties between equally valid choices.

/** Coal sources reachable from locs, grouped by distance. */
export function coalSources(s, locs) {
    const dist = distances(s, locs);
    const src = [];
    for (let i = 0; i < SPACES.length; i++) {
        const t = s.spaces[i];
        if (t && t.ind === IND.CoalMine && t.res > 0 && dist[SPACES[i].loc] < Infinity) src.push({ sp: i, d: dist[SPACES[i].loc], res: t.res, o: t.o });
    }
    const market = MERCHANT_LOCS.some(m => dist[m] < Infinity);
    return { src, market };
}

function tieKey(p, o, prefer) { return prefer === 'other' ? (o === p ? 1 : 0) : (o === p ? 0 : 1); }

export function planCoal(s, p, locs, need, prefer = 'own') {
    if (need <= 0) return { take: [], mkt: 0, cost: 0 };
    const { src, market } = coalSources(s, locs);
    src.sort((a, b) => a.d - b.d || tieKey(p, a.o, prefer) - tieKey(p, b.o, prefer) || b.res - a.res);
    const take = [];
    let left = need;
    for (const c of src) { if (!left) break; const n = Math.min(left, c.res); take.push([c.sp, n]); left -= n; }
    if (left > 0 && !market) return null;
    return { take, mkt: left, cost: coalCost(s, left) };
}

export function planIron(s, p, need, prefer = 'own') {
    if (need <= 0) return { take: [], mkt: 0, cost: 0 };
    const src = [];
    for (let i = 0; i < SPACES.length; i++) { const t = s.spaces[i]; if (t && t.ind === IND.IronWorks && t.res > 0) src.push({ sp: i, res: t.res, o: t.o }); }
    src.sort((a, b) => tieKey(p, a.o, prefer) - tieKey(p, b.o, prefer) || b.res - a.res);
    const take = [];
    let left = need;
    for (const c of src) { if (!left) break; const n = Math.min(left, c.res); take.push([c.sp, n]); left -= n; }
    return { take, mkt: left, cost: ironCost(s, left) };
}

/** Is a given coal plan legal (closest-first)? */
export function coalPlanValid(s, locs, need, plan) {
    const { src, market } = coalSources(s, locs);
    const bySp = new Map(src.map(c => [c.sp, c]));
    let total = plan.mkt;
    const used = new Map();
    for (const [sp, n] of plan.take) {
        const c = bySp.get(sp);
        if (!c || n < 1 || n > c.res) return false;
        used.set(sp, (used.get(sp) || 0) + n); total += n;
    }
    if (total !== need) return false;
    // every source closer than the farthest used one must be emptied
    let maxD = -1;
    for (const sp of used.keys()) maxD = Math.max(maxD, bySp.get(sp).d);
    if (plan.mkt > 0) { if (!market) return false; maxD = Infinity; }
    for (const c of src) if (c.d < maxD && (used.get(c.sp) || 0) < c.res) return false;
    return true;
}

/** Beer sources for selling a tile at `loc` to merchant entry index `mi` (or for a double rail link when mi === -1). */
export function beerSources(s, p, locs, mi) {
    const dist = distances(s, locs);
    const src = [];
    for (let i = 0; i < SPACES.length; i++) {
        const t = s.spaces[i];
        if (!t || t.ind !== IND.Brewery || t.res <= 0) continue;
        if (t.o === p || dist[SPACES[i].loc] < Infinity) src.push({ sp: i, res: t.res, o: t.o });
    }
    const merchBeer = mi >= 0 && s.merch[mi].beer > 0 ? s.merch[mi].beer : 0;
    return { src, merchBeer };
}

// ---------------------------------------------------------------------------
// Card helpers
export function cardAllowsBuild(s, p, card, ind, loc, inNet) {
    const L = LOCATIONS[loc];
    if (card === null || card === undefined) return true; // unknown hand (physical-mode human)
    const c = CARDS[card];
    const noTiles = !hasTilesOnBoard(s, p);
    if (c.kind === 'loc') return c.loc === loc;
    if (c.kind === 'wildLoc') return L.kind === 'town';
    if (c.kind === 'ind' || c.kind === 'wildInd') {
        if (c.kind === 'ind' && !c.inds.includes(ind)) return false;
        return inNet[loc] || noTiles;
    }
    return false;
}

export function hasCard(s, p, card) {
    const h = s.players[p].hand;
    if (h === null) return true;
    return h.includes(card);
}

function discardCard(s, p, card) {
    const pl = s.players[p];
    if (pl.hand === null || card === null || card === undefined) return;
    const i = pl.hand.indexOf(card);
    if (i < 0) throw new Error(`${pl.name} does not hold card ${CARDS[card].name}`);
    pl.hand.splice(i, 1);
    if (card === WILD_LOC) s.wilds[0]++;
    else if (card === WILD_IND) s.wilds[1]++;
    else pl.discard.push(card);
}

// ---------------------------------------------------------------------------
// Money and income
function pay(s, p, amount) {
    const pl = s.players[p];
    if (amount <= 0) return;
    if (pl.money !== null) {
        if (pl.money < amount) throw new Error(`${pl.name} cannot afford £${amount} (has £${pl.money})`);
        pl.money -= amount;
    }
    pl.spent += amount;
}
export function canAfford(s, p, amount) { const m = s.players[p].money; return m === null || m >= amount; }

function gainIncome(s, p, spaces) { const pl = s.players[p]; pl.inc = Math.min(99, pl.inc + spaces); }

// ---------------------------------------------------------------------------
// Resource consumption (applies a plan)
function flipIfEmpty(s, sp, by) {
    const t = s.spaces[sp];
    if (t.res === 0 && !t.flip && (t.ind === IND.CoalMine || t.ind === IND.IronWorks || t.ind === IND.Brewery)) {
        t.flip = true;
        gainIncome(s, t.o, tileDef(t.ind, t.lvl).inc);
        emit(s, { t: 'flip', p: t.o, by, sp, ind: t.ind, lvl: t.lvl });
    }
}

function takeFromTiles(s, p, take, res) {
    for (const [sp, n] of take) {
        const t = s.spaces[sp];
        if (!t || t.res < n) throw new Error('resource plan out of date');
        t.res -= n;
        emit(s, { t: 'consume', p, res, from: t.o, sp, n });
        flipIfEmpty(s, sp, p);
    }
}

function applyCoal(s, p, plan) {
    takeFromTiles(s, p, plan.take, 'coal');
    if (plan.mkt > 0) {
        const cost = coalCost(s, plan.mkt);
        pay(s, p, cost);
        emit(s, { t: 'market', p, res: 'coal', n: plan.mkt, cost, before: s.coal });
        s.coal = Math.max(0, s.coal - plan.mkt);
    }
}
function applyIron(s, p, plan) {
    takeFromTiles(s, p, plan.take, 'iron');
    if (plan.mkt > 0) {
        const cost = ironCost(s, plan.mkt);
        pay(s, p, cost);
        emit(s, { t: 'market', p, res: 'iron', n: plan.mkt, cost, before: s.iron });
        s.iron = Math.max(0, s.iron - plan.mkt);
    }
}

// ---------------------------------------------------------------------------
// BUILD

/** Spaces where p may place industry `ind` at `loc` (ignoring card/cost). Includes overbuilds. */
export function buildSpacesAt(s, p, ind, loc) {
    const lvl = nextLevel(s, p, ind);
    if (!lvl) return [];
    const def = tileDef(ind, lvl);
    if (s.era === ERA.Rail && def.canalOnly) return [];
    if (s.era === ERA.Canal && def.railOnly) return [];
    const spaces = SPACES_AT[loc];
    const out = [];
    const emptyOnly = spaces.filter(sp => !s.spaces[sp] && SPACES[sp].types.length === 1 && SPACES[sp].types[0] === ind);
    const emptyMixed = spaces.filter(sp => !s.spaces[sp] && SPACES[sp].types.length > 1 && SPACES[sp].types.includes(ind));
    const mineHere = s.era === ERA.Canal ? spaces.filter(sp => s.spaces[sp] && s.spaces[sp].o === p) : [];
    const canalOk = sp => s.era !== ERA.Canal || mineHere.length === 0 || (mineHere.length === 1 && mineHere[0] === sp);
    for (const sp of (emptyOnly.length ? emptyOnly : emptyMixed)) if (canalOk(sp)) out.push(sp);
    // overbuild
    for (const sp of spaces) {
        const t = s.spaces[sp];
        if (!t || t.ind !== ind || t.lvl >= lvl || !SPACES[sp].types.includes(ind)) continue;
        if (t.o !== p) {
            if (ind !== IND.CoalMine && ind !== IND.IronWorks) continue;
            if (totalCubes(s, ind) > 0) continue;
        }
        if (canalOk(sp)) out.push(sp);
    }
    return out;
}

/**
 * Work out a full build action (resource plans and total cost) or return null if not possible.
 * @returns {null | {t:'build', card:any, ind:number, lvl:number, sp:number, coal:any, iron:any, cost:number}}
 */
export function planBuild(s, p, card, ind, sp, prefer = 'own') {
    const loc = SPACES[sp].loc;
    const lvl = nextLevel(s, p, ind);
    if (!lvl) return null;
    if (!buildSpacesAt(s, p, ind, loc).includes(sp)) return null;
    const inNet = networkLocs(s, p);
    if (!cardAllowsBuild(s, p, card, ind, loc, inNet)) return null;
    if (LOCATIONS[loc].kind === 'farm' && card !== null && card !== undefined) {
        const c = CARDS[card];
        if (!(c.kind === 'wildInd' || (c.kind === 'ind' && c.inds.includes(IND.Brewery)))) return null;
    }
    const def = tileDef(ind, lvl);
    // the tile being overbuilt is removed first, so its cubes are not available
    const work = s.spaces[sp] ? withoutTile(s, sp) : s;
    const coal = planCoal(work, p, [loc], def.coal, prefer);
    if (!coal) return null;
    const iron = planIron(work, p, def.iron, prefer);
    const cost = def.cost + coal.cost + iron.cost;
    if (!canAfford(s, p, cost)) return null;
    return { t: 'build', card, ind, lvl, sp, coal, iron, cost };
}

function withoutTile(s, sp) {
    const w = { ...s, spaces: s.spaces.slice() };
    w.spaces[sp] = null;
    return w;
}

function doBuild(s, p, a) {
    const loc = SPACES[a.sp].loc;
    const def = tileDef(a.ind, a.lvl);
    const old = s.spaces[a.sp];
    if (old) {
        emit(s, { t: 'overbuild', p, sp: a.sp, victim: old.o, ind: old.ind, lvl: old.lvl });
        s.spaces[a.sp] = null;
    }
    pay(s, p, def.cost);
    applyCoal(s, p, a.coal);
    applyIron(s, p, a.iron);
    s.players[p].mat[a.ind][a.lvl - 1]--;
    const tile = { o: p, ind: a.ind, lvl: a.lvl, res: 0, flip: false };
    s.spaces[a.sp] = tile;
    emit(s, { t: 'build', p, sp: a.sp, loc, ind: a.ind, lvl: a.lvl, cost: a.cost });
    if (a.ind === IND.CoalMine) {
        tile.res = def.res;
        if (connectedToAnyMerchant(s, [loc])) sellToMarket(s, p, a.sp, 'coal');
    } else if (a.ind === IND.IronWorks) {
        tile.res = def.res;
        sellToMarket(s, p, a.sp, 'iron');
    } else if (a.ind === IND.Brewery) {
        tile.res = s.era === ERA.Canal ? 1 : 2;
    }
    flipIfEmpty(s, a.sp, p);
}

function sellToMarket(s, p, sp, res) {
    const t = s.spaces[sp];
    const mk = res === 'coal' ? COAL_MARKET : IRON_MARKET;
    let earned = 0, n = 0;
    while (t.res > 0 && s[res] < mk.size) {
        earned += sellPrice(s[res], mk);
        s[res]++; t.res--; n++;
    }
    if (n) {
        if (s.players[p].money !== null) s.players[p].money += earned;
        emit(s, { t: 'toMarket', p, res, n, earned, sp });
    }
}

// ---------------------------------------------------------------------------
// NETWORK

export function linkAllowed(s, p, l, inNet, noTiles) {
    if (s.links[l] >= 0) return false;
    const def = LINKS[l];
    if (s.era === ERA.Canal ? !def.canal : !def.rail) return false;
    if (noTiles) return true;
    return def.locs.some(loc => inNet[loc]);
}

/** Plan a network action with 1 or 2 links. Returns null if impossible. */
export function planNetwork(s, p, card, links, prefer = 'own') {
    const pl = s.players[p];
    if (links.length < 1 || links.length > 2) return null;
    if (s.era === ERA.Canal && links.length !== 1) return null;
    if (pl.links < links.length) return null;
    if (links.length === 2 && links[0] === links[1]) return null;
    let work = s;
    const coal = [];
    let cost = s.era === ERA.Canal ? 3 : links.length === 2 ? 15 : 5;
    let coalUsed = 0;
    for (const l of links) {
        const inNet = networkLocs(work, p);
        if (!linkAllowed(work, p, l, inNet, !hasTilesOnBoard(work, p))) return null;
        work = { ...work, links: work.links.slice() };
        work.links[l] = p;
        if (s.era === ERA.Rail) {
            // coal for this link (after it is placed); account for coal already taken by the first link
            const c = planCoal(work, p, LINKS[l].locs, 1, prefer);
            if (!c) return null;
            coal.push(c);
            if (c.take.length) {
                work = { ...work, spaces: work.spaces.slice() };
                for (const [sp, n] of c.take) work.spaces[sp] = { ...work.spaces[sp], res: work.spaces[sp].res - n };
            }
            if (c.mkt) { cost += coalCost(work, c.mkt); work = { ...work, coal: Math.max(0, work.coal - c.mkt) }; }
            coalUsed++;
        }
    }
    let beer = null;
    if (links.length === 2) {
        const { src } = beerSources(work, p, LINKS[links[1]].locs, -1);
        if (!src.length) return null;
        src.sort((a, b) => tieKey(p, a.o, prefer) - tieKey(p, b.o, prefer));
        beer = src[0].sp;
    }
    if (!canAfford(s, p, cost)) return null;
    return { t: 'network', card, links: links.slice(), coal, beer, cost };
}

function doNetwork(s, p, a) {
    const pl = s.players[p];
    pay(s, p, s.era === ERA.Canal ? 3 : a.links.length === 2 ? 15 : 5);
    a.links.forEach((l, i) => {
        s.links[l] = p;
        pl.links--;
        emit(s, { t: 'link', p, link: l });
        if (s.era === ERA.Rail) applyCoal(s, p, a.coal[i]);
    });
    if (a.links.length === 2) {
        const t = s.spaces[a.beer];
        if (!t || t.ind !== IND.Brewery || t.res < 1) throw new Error('double link beer missing');
        t.res--;
        emit(s, { t: 'consume', p, res: 'beer', from: t.o, sp: a.beer, n: 1 });
        flipIfEmpty(s, a.beer, p);
    }
}

// ---------------------------------------------------------------------------
// DEVELOP
export function canDevelop(s, p, ind) {
    const lvl = nextLevel(s, p, ind);
    return lvl > 0 && !tileDef(ind, lvl).noDev;
}

export function planDevelop(s, p, card, inds, prefer = 'own') {
    if (inds.length < 1 || inds.length > 2) return null;
    const pl = s.players[p];
    const mat = pl.mat.map(a => a.slice());
    for (const ind of inds) {
        const i = mat[ind].findIndex(c => c > 0);
        if (i < 0 || tileDef(ind, i + 1).noDev) return null;
        mat[ind][i]--;
    }
    const iron = planIron(s, p, inds.length, prefer);
    if (!canAfford(s, p, iron.cost)) return null;
    return { t: 'develop', card, inds: inds.slice(), iron, cost: iron.cost };
}

function removeFromMat(s, p, ind) {
    const lvl = nextLevel(s, p, ind);
    if (!lvl) throw new Error('nothing to develop');
    s.players[p].mat[ind][lvl - 1]--;
    return lvl;
}

function doDevelop(s, p, a) {
    applyIron(s, p, a.iron);
    for (const ind of a.inds) {
        const lvl = removeFromMat(s, p, ind);
        emit(s, { t: 'develop', p, ind, lvl });
    }
}

// ---------------------------------------------------------------------------
// SELL

/** Merchant entries (indices into s.merch) a tile on space sp could sell to. */
export function sellTargets(s, sp, comp = components(s)) {
    const t = s.spaces[sp];
    if (!t || t.flip || !SELLABLE.includes(t.ind)) return [];
    const loc = SPACES[sp].loc;
    const out = [];
    s.merch.forEach((m, i) => { if (m.accepts.includes(t.ind) && comp[m.loc] === comp[loc]) out.push(i); });
    return out;
}

/** Beer available for a sale: own breweries, connected opposing breweries, merchant beer. */
export function saleBeerOptions(s, p, sp, mi) {
    return beerSources(s, p, [SPACES[sp].loc], mi);
}

/**
 * Plan one sale step: tile sp, merchant mi. Beer choice is an array of sources:
 * {sp} for a brewery, {m: mi} for merchant beer.
 * prefer: 'merchant-own' (default), 'merchant-other', 'own', 'other'
 */
export function planSale(s, p, sp, mi, prefer = 'merchant-own') {
    const t = s.spaces[sp];
    if (!t || t.o !== p || t.flip) return null;
    if (!sellTargets(s, sp).includes(mi)) return null;
    const need = tileDef(t.ind, t.lvl).beer;
    const beer = [];
    if (need > 0) {
        const { src, merchBeer } = saleBeerOptions(s, p, sp, mi);
        const useMerch = prefer.startsWith('merchant') && merchBeer > 0;
        let left = need;
        if (useMerch) { beer.push({ m: mi }); left--; }
        const tie = prefer.endsWith('other') ? 'other' : 'own';
        src.sort((a, b) => tieKey(p, a.o, tie) - tieKey(p, b.o, tie));
        for (const b of src) { while (left > 0 && b.res > 0) { beer.push({ sp: b.sp }); b.res--; left--; } }
        if (left > 0 && !useMerch && merchBeer > 0) { beer.push({ m: mi }); left--; }
        if (left > 0) return null;
    }
    return { sp, mi, beer };
}

/** Apply one sale (used by doSell and by step-by-step UIs). Returns bonus info. */
function doSale(s, p, sale, freeDev) {
    const t = s.spaces[sale.sp];
    const def = tileDef(t.ind, t.lvl);
    let usedMerch = false;
    for (const b of sale.beer) {
        if (b.m !== undefined) {
            const m = s.merch[b.m];
            if (m.beer < 1 || b.m !== sale.mi) throw new Error('merchant beer unavailable');
            m.beer--; usedMerch = true;
            emit(s, { t: 'consume', p, res: 'beer', from: 'merchant', loc: m.loc, n: 1 });
        } else {
            const bt = s.spaces[b.sp];
            if (!bt || bt.ind !== IND.Brewery || bt.res < 1) throw new Error('brewery beer unavailable');
            if (bt.o !== p && components(s)[SPACES[b.sp].loc] !== components(s)[SPACES[sale.sp].loc]) throw new Error('brewery not connected');
            bt.res--;
            emit(s, { t: 'consume', p, res: 'beer', from: bt.o, sp: b.sp, n: 1 });
            flipIfEmpty(s, b.sp, p);
        }
    }
    if (def.beer !== sale.beer.length) throw new Error('wrong beer amount');
    t.flip = true;
    gainIncome(s, p, def.inc);
    const m = s.merch[sale.mi];
    emit(s, { t: 'sell', p, sp: sale.sp, ind: t.ind, lvl: t.lvl, loc: m.loc, merchBeer: usedMerch });
    emit(s, { t: 'flip', p, by: p, sp: sale.sp, ind: t.ind, lvl: t.lvl });
    if (usedMerch) {
        const bonus = LOCATIONS[m.loc].bonus;
        if (bonus.type === 'money') { if (s.players[p].money !== null) s.players[p].money += bonus.amount; }
        else if (bonus.type === 'vp') { s.players[p].vp += bonus.amount; s.players[p].score.bonus += bonus.amount; }
        else if (bonus.type === 'income') gainIncome(s, p, bonus.amount);
        else if (bonus.type === 'develop') {
            const ind = freeDev ? freeDev.shift() : undefined;
            if (ind !== undefined && ind !== null && canDevelop(s, p, ind)) {
                const lvl = removeFromMat(s, p, ind);
                emit(s, { t: 'develop', p, ind, lvl, free: true });
            }
        }
        emit(s, { t: 'bonus', p, loc: m.loc, type: bonus.type, amount: bonus.amount });
    }
}

function doSell(s, p, a) {
    if (!a.sales.length) throw new Error('sell needs at least one tile');
    const freeDev = (a.freeDev || []).slice();
    for (const sale of a.sales) doSale(s, p, sale, freeDev);
}

// ---------------------------------------------------------------------------
// LOAN / SCOUT / PASS
export function canLoan(s, p) { return incomeLevel(s.players[p].inc) - 3 >= -10; }
function doLoan(s, p) {
    const pl = s.players[p];
    if (!canLoan(s, p)) throw new Error('loan would take income below -10');
    if (pl.money !== null) pl.money += 30;
    pl.inc = topSpaceOfLevel(incomeLevel(pl.inc) - 3);
    emit(s, { t: 'loan', p });
}
export function canScout(s, p) {
    const h = s.players[p].hand;
    if (h === null) return true;
    return h.length >= 3 && !h.includes(WILD_LOC) && !h.includes(WILD_IND) && s.wilds[0] > 0 && s.wilds[1] > 0;
}
function doScout(s, p, a) {
    const pl = s.players[p];
    if (pl.hand !== null) {
        for (const c of a.extra || []) discardCard(s, p, c);
        pl.hand.push(WILD_LOC, WILD_IND);
        s.wilds[0]--; s.wilds[1]--;
    }
    emit(s, { t: 'scout', p });
}

// ---------------------------------------------------------------------------
// Action entry points

/**
 * Apply an action's effects for the current player and discard its card. Does not advance the turn.
 * Action shapes: see planBuild / planNetwork / planDevelop, and
 * {t:'sell', card, sales:[{sp, mi, beer}], freeDev:[ind]} {t:'loan', card} {t:'scout', card, extra:[c,c]} {t:'pass', card}
 */
export function doAction(s, a, p = currentPlayer(s)) {
    if (s.over) throw new Error('game over');
    if (s.players[p].hand !== null && a.card !== null && a.card !== undefined && !s.players[p].hand.includes(a.card)) throw new Error('card not in hand');
    if (s.players[p].hand !== null && (a.card === null || a.card === undefined)) throw new Error('action needs a card');
    const spentBefore = s.players[p].spent;
    switch (a.t) {
        case 'build': doBuild(s, p, a); break;
        case 'network': doNetwork(s, p, a); break;
        case 'develop': doDevelop(s, p, a); break;
        case 'sell': doSell(s, p, a); break;
        case 'loan': doLoan(s, p); break;
        case 'scout': doScout(s, p, a); break;
        case 'pass': emit(s, { t: 'pass', p }); break;
        default: throw new Error('unknown action ' + a.t);
    }
    discardCard(s, p, a.card);
    emit(s, { t: 'action', p, a: a.t, spent: s.players[p].spent - spentBefore, money: s.players[p].money });
}

/** Finish one action: count it down, end turn / round / era as needed. */
export function finishAction(s) {
    s.acts--;
    if (s.acts > 0) return;
    const p = currentPlayer(s);
    refillHand(s, p);
    s.turn++;
    if (s.turn < s.n) { s.acts = s.firstTurnOfEra ? 1 : 2; return; }
    endRound(s);
}

/** Convenience: doAction + finishAction. */
export function applyAction(s, a) { doAction(s, a); finishAction(s); }

function refillHand(s, p) {
    const pl = s.players[p];
    if (pl.hand === null) return;
    const src = pl.pile !== null ? pl.pile : s.deck;
    while (pl.hand.length < HAND_SIZE && src.length) pl.hand.push(src.shift());
}

// ---------------------------------------------------------------------------
// Round / era flow

function endRound(s) {
    // turn order: least spent first, ties keep relative order (stable sort)
    const before = s.order.slice();
    const spent = s.players.map(p => p.spent);
    s.order = before.slice().sort((a, b) => spent[a] - spent[b]);
    emit(s, { t: 'turnOrder', before, after: s.order.slice(), spent });
    for (const pl of s.players) pl.spent = 0;

    const lastRoundOfGame = s.era === ERA.Rail && s.round >= s.rounds;
    if (!lastRoundOfGame) for (const pl of s.players) payIncome(s, pl.id);

    s.turn = 0;
    s.firstTurnOfEra = false;
    s.acts = 2;
    if (s.round >= s.rounds) { endEra(s); return; }
    s.round++;
    emit(s, { t: 'round', round: s.round });
}

function payIncome(s, p) {
    const pl = s.players[p];
    const lvl = incomeLevel(pl.inc);
    emit(s, { t: 'income', p, amount: lvl });
    if (pl.money === null) return;
    pl.money += lvl;
    if (pl.money >= 0) return;
    // shortfall: sell own tiles for half cost (cheapest-to-lose first)
    while (pl.money < 0) {
        let best = -1, bestScore = Infinity;
        for (let i = 0; i < SPACES.length; i++) {
            const t = s.spaces[i];
            if (!t || t.o !== p) continue;
            const def = tileDef(t.ind, t.lvl);
            const loss = (t.flip ? def.vp + def.link : def.vp * 0.5) - Math.floor(def.cost / 2) * 0.1;
            if (loss < bestScore) { bestScore = loss; best = i; }
        }
        if (best < 0) break;
        const t = s.spaces[best];
        pl.money += Math.floor(tileDef(t.ind, t.lvl).cost / 2);
        s.spaces[best] = null;
        emit(s, { t: 'shortfallSell', p, sp: best, ind: t.ind, lvl: t.lvl });
    }
    if (pl.money < 0) {
        const lose = Math.min(pl.vp, -pl.money);
        pl.vp -= lose; pl.money = 0;
        if (lose) emit(s, { t: 'shortfallVP', p, vp: lose });
    }
}

/** Link value of a location for end-of-era scoring. */
export function locationLinkValue(s, loc) {
    if (LOCATIONS[loc].kind === 'merchant') return 2;
    let v = 0;
    for (const sp of SPACES_AT[loc]) { const t = s.spaces[sp]; if (t && t.flip) v += tileDef(t.ind, t.lvl).link; }
    return v;
}

export function scoreEra(s) {
    const result = s.players.map(() => ({ links: 0, tiles: 0, fromRivals: 0 }));
    for (let l = 0; l < LINKS.length; l++) {
        const o = s.links[l];
        if (o < 0) continue;
        for (const loc of LINKS[l].locs) {
            result[o].links += locationLinkValue(s, loc);
            for (const sp of SPACES_AT[loc]) { const t = s.spaces[sp]; if (t && t.flip && t.o !== o) result[o].fromRivals += tileDef(t.ind, t.lvl).link; }
        }
    }
    for (const t of s.spaces) if (t && t.flip) result[t.o].tiles += tileDef(t.ind, t.lvl).vp;
    return result;
}

function endEra(s) {
    const res = scoreEra(s);
    res.forEach((r, p) => {
        const pl = s.players[p];
        pl.vp += r.links + r.tiles;
        if (s.era === ERA.Canal) { pl.score.canalLinks = r.links; pl.score.canalTiles = r.tiles; }
        else { pl.score.railLinks = r.links; pl.score.railTiles = r.tiles; }
    });
    emit(s, { t: 'eraEnd', scores: res, vp: s.players.map(p => p.vp) });
    s.links = LINKS.map(() => -1);
    if (s.era === ERA.Rail) { s.over = true; emit(s, { t: 'gameOver', vp: s.players.map(p => p.vp) }); return; }
    // canal -> rail
    for (let i = 0; i < SPACES.length; i++) if (s.spaces[i] && s.spaces[i].lvl === 1) s.spaces[i] = null;
    for (const m of s.merch) m.beer = m.accepts.length ? 1 : 0;
    for (const pl of s.players) pl.links = LINKS_PER_PLAYER;
    s.era = ERA.Rail;
    s.round = 1;
    s.firstTurnOfEra = false;
    s.acts = 2;
    s.turn = 0;
    for (const pl of s.players) pl.discard = [];
    dealEra(s, false);
    emit(s, { t: 'round', round: 1 });
}

/** Final ranking: VP, then income level, then money. */
export function ranking(s) {
    return s.players.map(p => p.id).sort((a, b) => {
        const A = s.players[a], B = s.players[b];
        return B.vp - A.vp || incomeLevel(B.inc) - incomeLevel(A.inc) || (B.money ?? 0) - (A.money ?? 0);
    });
}
