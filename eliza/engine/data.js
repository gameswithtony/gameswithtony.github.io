// @ts-check
// Static game data for Brass: Birmingham.
// Sources of truth: images/board.jpg, images/playerboard.webp, images/birmingham_card_counts.webp.
// Location ids match the v1 data.js so "Space N" references stay the same.

export const IND = { Brewery: 0, Manufacturer: 1, CottonMill: 2, Pottery: 3, CoalMine: 4, IronWorks: 5 };
export const IND_NAMES = ['Brewery', 'Manufactured Goods', 'Cotton Mill', 'Pottery', 'Coal Mine', 'Iron Works'];
export const IND_SHORT = ['Brewery', 'Goods', 'Cotton', 'Pottery', 'Coal', 'Iron'];
export const SELLABLE = [IND.Manufacturer, IND.CottonMill, IND.Pottery];

export const ERA = { Canal: 0, Rail: 1 };

// ---- Locations -------------------------------------------------------------
// kind: 'town' (industry location), 'farm' (unnamed farm brewery), 'merchant'
// group: card colour group (decides which cards are in the deck)
// slots: industry icons per space, in reading order (left-to-right, top-to-bottom)

const B = IND.Brewery, M = IND.Manufacturer, C = IND.CottonMill, P = IND.Pottery, K = IND.CoalMine, I = IND.IronWorks;

/** @typedef {{id:number, name:string, kind:'town'|'farm'|'merchant', group?:string, slots?:number[][], merchantSlots?:number, minPlayers?:number, bonus?:{type:string, amount:number}}} Location */

/** @type {Location[]} */
export const LOCATIONS = [
    { id: 0, name: 'Warrington', kind: 'merchant', merchantSlots: 2, minPlayers: 3, bonus: { type: 'money', amount: 5 } },
    { id: 1, name: 'Stoke-on-Trent', kind: 'town', group: 'blue', slots: [[C, M], [P, I], [M]] },
    { id: 2, name: 'Leek', kind: 'town', group: 'blue', slots: [[C, M], [C, K]] },
    { id: 3, name: 'Belper', kind: 'town', group: 'teal', slots: [[C, M], [K], [P]] },
    { id: 4, name: 'Stone', kind: 'town', group: 'blue', slots: [[C, B], [M, K]] },
    { id: 5, name: 'Uttoxeter', kind: 'town', group: 'blue', slots: [[M, B], [C, B]] },
    { id: 6, name: 'Derby', kind: 'town', group: 'teal', slots: [[C, B], [C, M], [I]] },
    { id: 7, name: 'Nottingham', kind: 'merchant', merchantSlots: 2, minPlayers: 4, bonus: { type: 'vp', amount: 3 } },
    { id: 8, name: 'Stafford', kind: 'town', group: 'red', slots: [[M, B], [P]] },
    { id: 9, name: 'Burton-on-Trent', kind: 'town', group: 'red', slots: [[M, K], [B]] },
    { id: 10, name: 'Farm Brewery (Cannock)', kind: 'farm', slots: [[B]] },
    { id: 11, name: 'Cannock', kind: 'town', group: 'red', slots: [[M, K], [K]] },
    { id: 12, name: 'Tamworth', kind: 'town', group: 'red', slots: [[C, K], [C, K]] },
    { id: 13, name: 'Shrewsbury', kind: 'merchant', merchantSlots: 1, minPlayers: 2, bonus: { type: 'vp', amount: 4 } },
    { id: 14, name: 'Coalbrookdale', kind: 'town', group: 'yellow', slots: [[I, B], [I], [K]] },
    { id: 15, name: 'Wolverhampton', kind: 'town', group: 'yellow', slots: [[M], [M, K]] },
    { id: 16, name: 'Walsall', kind: 'town', group: 'red', slots: [[I, M], [M, B]] },
    { id: 17, name: 'Nuneaton', kind: 'town', group: 'purple', slots: [[M, B], [C, K]] },
    { id: 18, name: 'Dudley', kind: 'town', group: 'yellow', slots: [[K], [I]] },
    { id: 19, name: 'Birmingham', kind: 'town', group: 'purple', slots: [[C, M], [M], [I], [M]] },
    { id: 20, name: 'Coventry', kind: 'town', group: 'purple', slots: [[P], [M, K], [I, M]] },
    { id: 21, name: 'Kidderminster', kind: 'town', group: 'yellow', slots: [[C, K], [C]] },
    { id: 22, name: 'Farm Brewery (Kidderminster)', kind: 'farm', slots: [[B]] },
    { id: 23, name: 'Redditch', kind: 'town', group: 'purple', slots: [[M, K], [I]] },
    { id: 24, name: 'Oxford', kind: 'merchant', merchantSlots: 2, minPlayers: 2, bonus: { type: 'income', amount: 2 } },
    { id: 25, name: 'Worcester', kind: 'town', group: 'yellow', slots: [[C], [C]] },
    { id: 26, name: 'Gloucester', kind: 'merchant', merchantSlots: 2, minPlayers: 2, bonus: { type: 'develop', amount: 1 } },
];

// ---- Links -----------------------------------------------------------------
// One entry per line on the board. canal/rail say which eras may use it.
// The Kidderminster-Worcester line also joins the southern Farm Brewery (3 locations, 1 link).
/** @typedef {{id:number, locs:number[], canal:boolean, rail:boolean}} LinkDef */
const L = (a, b, canal, rail, extra) => ({ locs: extra === undefined ? [a, b] : [a, b, extra], canal, rail });
const linkList = [
    L(0, 1, true, true), L(1, 2, true, true), L(1, 4, true, true), L(2, 3, false, true),
    L(3, 6, true, true), L(4, 5, false, true), L(4, 8, true, true), L(4, 9, true, true),
    L(5, 6, false, true), L(6, 7, true, true), L(6, 9, true, true), L(8, 11, true, true),
    L(9, 11, false, true), L(9, 12, true, true), L(9, 16, true, false), L(10, 11, true, true),
    L(11, 15, true, true), L(11, 16, true, true), L(12, 16, false, true), L(12, 17, true, true),
    L(12, 19, true, true), L(13, 14, true, true), L(14, 15, true, true), L(14, 21, true, true),
    L(15, 16, true, true), L(15, 18, true, true), L(17, 19, false, true), L(17, 20, false, true),
    L(18, 19, true, true), L(18, 21, true, true), L(19, 20, true, true), L(19, 23, false, true),
    L(19, 24, true, true), L(19, 25, true, true), L(21, 25, true, true, 22), L(23, 24, true, true),
    L(23, 26, true, true), L(25, 26, true, true),
];
/** @type {LinkDef[]} */
export const LINKS = linkList.map((l, id) => ({ id, ...l }));

/** Links touching each location. */
export const LINKS_AT = LOCATIONS.map(loc => LINKS.filter(l => l.locs.includes(loc.id)).map(l => l.id));

// ---- Spaces ----------------------------------------------------------------
/** @typedef {{id:number, loc:number, idx:number, types:number[]}} Space */
/** @type {Space[]} */
export const SPACES = [];
for (const loc of LOCATIONS) {
    if (!loc.slots) continue;
    loc.slots.forEach((types, idx) => SPACES.push({ id: SPACES.length, loc: loc.id, idx, types }));
}
export const SPACES_AT = LOCATIONS.map(loc => SPACES.filter(s => s.loc === loc.id).map(s => s.id));

// ---- Merchant slots and tiles ----------------------------------------------
/** @typedef {{id:number, loc:number, minPlayers:number}} MerchantSlot */
/** @type {MerchantSlot[]} */
export const MERCHANT_SLOTS = [];
for (const loc of LOCATIONS) {
    if (loc.kind !== 'merchant') continue;
    for (let i = 0; i < (loc.merchantSlots || 0); i++) MERCHANT_SLOTS.push({ id: MERCHANT_SLOTS.length, loc: loc.id, minPlayers: loc.minPlayers || 2 });
}
// accepts: industries this tile buys; empty = blank tile
export const MERCHANT_TILES = [
    { minPlayers: 2, accepts: [] },
    { minPlayers: 2, accepts: [] },
    { minPlayers: 2, accepts: [C] },
    { minPlayers: 2, accepts: [M] },
    { minPlayers: 2, accepts: [M, C, P] },
    { minPlayers: 3, accepts: [] },
    { minPlayers: 3, accepts: [P] },
    { minPlayers: 4, accepts: [M] },
    { minPlayers: 4, accepts: [C] },
];
export const MERCHANT_LOCS = LOCATIONS.filter(l => l.kind === 'merchant').map(l => l.id);

// ---- Industry tiles (player mat) ---------------------------------------------
// n: copies; cost £; coal/iron to build; beer to sell; vp; link: link VP icons; inc: income spaces on flip;
// res: cubes produced (coal/iron) or beer per era handled in rules; canalOnly / railOnly / noDev (lightbulb)
/** @typedef {{ind:number, level:number, n:number, cost:number, coal:number, iron:number, beer:number, vp:number, link:number, inc:number, res:number, canalOnly?:boolean, railOnly?:boolean, noDev?:boolean}} TileDef */
const T = (ind, level, n, cost, coal, iron, beer, vp, link, inc, res, flags = {}) => ({ ind, level, n, cost, coal, iron, beer, vp, link, inc, res, ...flags });

/** TILES[ind][level-1] */
/** @type {TileDef[][]} */
export const TILES = [];
TILES[B] = [
    T(B, 1, 2, 5, 0, 1, 0, 4, 2, 4, 1, { canalOnly: true }),
    T(B, 2, 2, 7, 0, 1, 0, 5, 2, 5, 1),
    T(B, 3, 2, 9, 0, 1, 0, 7, 2, 5, 1),
    T(B, 4, 1, 9, 0, 1, 0, 10, 2, 5, 1, { railOnly: true }),
];
TILES[M] = [
    T(M, 1, 1, 8, 1, 0, 1, 3, 2, 5, 0, { canalOnly: true }),
    T(M, 2, 2, 10, 0, 1, 1, 5, 1, 0, 0),
    T(M, 3, 1, 12, 2, 0, 0, 4, 0, 4, 0),
    T(M, 4, 1, 14, 0, 1, 1, 3, 1, 7, 0),
    T(M, 5, 2, 16, 1, 0, 2, 8, 2, 2, 0),
    T(M, 6, 1, 20, 0, 0, 1, 7, 1, 6, 0),
    T(M, 7, 1, 16, 1, 1, 0, 9, 0, 4, 0),
    T(M, 8, 2, 20, 0, 2, 1, 11, 1, 1, 0),
];
TILES[C] = [
    T(C, 1, 3, 12, 0, 0, 1, 5, 1, 5, 0, { canalOnly: true }),
    T(C, 2, 2, 14, 1, 0, 1, 5, 2, 4, 0),
    T(C, 3, 3, 16, 1, 1, 1, 9, 1, 3, 0),
    T(C, 4, 3, 18, 1, 1, 1, 12, 1, 2, 0),
];
TILES[P] = [
    T(P, 1, 1, 17, 0, 1, 1, 10, 1, 5, 0, { noDev: true }),
    T(P, 2, 1, 0, 1, 0, 1, 1, 1, 1, 0),
    T(P, 3, 1, 22, 2, 0, 2, 11, 1, 5, 0, { noDev: true }),
    T(P, 4, 1, 0, 1, 0, 1, 1, 1, 1, 0),
    T(P, 5, 1, 24, 2, 0, 2, 20, 1, 5, 0, { railOnly: true }),
];
TILES[K] = [
    T(K, 1, 1, 5, 0, 0, 0, 1, 2, 4, 2, { canalOnly: true }),
    T(K, 2, 2, 7, 0, 0, 0, 2, 1, 7, 3),
    T(K, 3, 2, 8, 0, 1, 0, 3, 1, 6, 4),
    T(K, 4, 2, 10, 0, 1, 0, 4, 1, 5, 5),
];
TILES[I] = [
    T(I, 1, 1, 5, 1, 0, 0, 3, 1, 3, 4, { canalOnly: true }),
    T(I, 2, 1, 7, 1, 0, 0, 5, 1, 3, 4),
    T(I, 3, 1, 9, 1, 0, 0, 7, 1, 2, 5),
    T(I, 4, 1, 12, 1, 0, 0, 9, 1, 1, 6),
];

export const tileDef = (ind, level) => TILES[ind][level - 1];

// ---- Cards -----------------------------------------------------------------
// Card type ids 0-24 match v1 data.js ids. 25/26 are the wilds.
/** @typedef {{id:number, name:string, kind:'loc'|'ind'|'wildLoc'|'wildInd', loc?:number, inds?:number[], counts:number[]}} CardDef */
const LC = (id, loc, name, c2, c3, c4) => ({ id, name, kind: 'loc', loc, counts: [c2, c3, c4] });
const IC = (id, inds, name, c2, c3, c4) => ({ id, name, kind: 'ind', inds, counts: [c2, c3, c4] });
/** @type {CardDef[]} */
export const CARDS = [
    LC(0, 3, 'Belper', 0, 0, 2),
    LC(1, 6, 'Derby', 0, 0, 3),
    LC(2, 2, 'Leek', 0, 2, 2),
    LC(3, 1, 'Stoke-on-Trent', 0, 3, 3),
    LC(4, 4, 'Stone', 0, 2, 2),
    LC(5, 5, 'Uttoxeter', 0, 1, 2),
    LC(6, 8, 'Stafford', 2, 2, 2),
    LC(7, 9, 'Burton-on-Trent', 2, 2, 2),
    LC(8, 11, 'Cannock', 2, 2, 2),
    LC(9, 12, 'Tamworth', 1, 1, 1),
    LC(10, 16, 'Walsall', 1, 1, 1),
    LC(11, 14, 'Coalbrookdale', 3, 3, 3),
    LC(12, 18, 'Dudley', 2, 2, 2),
    LC(13, 21, 'Kidderminster', 2, 2, 2),
    LC(14, 15, 'Wolverhampton', 2, 2, 2),
    LC(15, 25, 'Worcester', 2, 2, 2),
    LC(16, 19, 'Birmingham', 3, 3, 3),
    LC(17, 20, 'Coventry', 3, 3, 3),
    LC(18, 17, 'Nuneaton', 1, 1, 1),
    LC(19, 23, 'Redditch', 1, 1, 1),
    IC(20, [I], 'Iron Works', 4, 4, 4),
    IC(21, [K], 'Coal Mine', 2, 2, 3),
    IC(22, [M, C], 'Man. Goods / Cotton Mill', 0, 6, 8),
    IC(23, [P], 'Pottery', 2, 2, 3),
    IC(24, [B], 'Brewery', 5, 5, 5),
    { id: 25, name: 'Wild Location', kind: 'wildLoc', counts: [0, 0, 0] },
    { id: 26, name: 'Wild Industry', kind: 'wildInd', counts: [0, 0, 0] },
];
export const WILD_LOC = 25, WILD_IND = 26;
export const WILDS_EACH = 4;

/** Full deck (card type ids) for a player count. */
export function deckFor(nPlayers) {
    const col = nPlayers - 2;
    const deck = [];
    for (const c of CARDS) for (let i = 0; i < c.counts[col]; i++) deck.push(c.id);
    return deck;
}

export const ROUNDS_PER_ERA = { 2: 10, 3: 9, 4: 8 };
export const START_MONEY = 17;
export const START_INCOME_SPACE = 10;
export const LINKS_PER_PLAYER = 14;
export const HAND_SIZE = 8;

// ---- Markets ---------------------------------------------------------------
export const COAL_MARKET = { size: 14, start: 13, emptyPrice: 8 };
export const IRON_MARKET = { size: 10, start: 8, emptyPrice: 6 };

export const PLAYER_COLORS = ['purple', 'red', 'yellow', 'gray'];
