// @ts-check
// Static game data for On Mars (2-player: you vs Pathfinder).
// Values come from the TTS assets + reference book; see docs/COMPONENTS.md.

export const RES = ['mineral', 'battery', 'water', 'plant', 'oxygen'];
/** Things the Warehouse holds, left to right. */
export const WARE = ['crystal', 'battery', 'water', 'plant', 'oxygen'];
export const WARE_FILL = 2; // 2-player game

/** Building types. Shelters are per-player. */
export const BTYPES = ['mine', 'gen', 'water', 'green', 'oxy', 'shelter'];
export const LSS_TYPES = ['gen', 'water', 'green', 'oxy'];
export const BUILD_NAMES = { mine: 'Mine', gen: 'Generator', water: 'Water Extractor', green: 'Greenhouse', oxy: 'Oxygen Condenser', shelter: 'Shelter' };
/** What a building (and its advanced version) produces. */
export const PRODUCES = { mine: 'mineral', gen: 'battery', water: 'water', green: 'plant', oxy: 'oxygen', shelter: 'crystal' };
/** Resource paid to construct (mine costs a colonist instead). */
export const BUILD_COST = { gen: 'mineral', water: 'battery', green: 'water', oxy: 'plant', shelter: 'oxygen' };
export const RES_NAMES = { mineral: 'Mineral', battery: 'Battery', water: 'Water', plant: 'Plant', oxygen: 'Oxygen', crystal: 'Crystal' };

// ---------------------------------------------------------------- map
// Flat-top hexes, 13 columns (0..12), odd columns sit half a hex lower.
// COL_ROWS[c] = [firstRow, lastRow]
export const COL_ROWS = [[3, 5], [1, 6], [1, 7], [0, 7], [0, 8], [0, 7], [0, 8], [0, 7], [0, 8], [0, 7], [1, 7], [1, 6], [3, 5]];
export const CENTER = '6,4';
export const START_LSS = ['6,2', '4,4', '8,4', '6,6'];
/** 2-player shelter spots: Pathfinder above centre, you below. */
export const START_SHELTER = { pf: '6,3', you: '6,5' };
/** Research tile spots, two per corner. */
export const RESEARCH_SPOTS = { A: ['3,0', '1,1'], B: ['9,0', '11,1'], C: ['1,6', '3,7'], D: ['11,6', '9,7'] };

// ---------------------------------------------------------------- lab
// Lab spaces: col = tech level, y in half-hex steps (adjacent right = y±1).
export const LAB = [
    { k: '1a', col: 1, y: 1, ben: 'warehouse' }, { k: '1b', col: 1, y: 3, ben: 'crystal' },
    { k: '2a', col: 2, y: 0 }, { k: '2b', col: 2, y: 2 }, { k: '2c', col: 2, y: 4 },
    { k: '3a', col: 3, y: 1, ben: 'mineral' }, { k: '3b', col: 3, y: 3, ben: 'bots' },
    { k: '4a', col: 4, y: 0 }, { k: '4b', col: 4, y: 2 }, { k: '4c', col: 4, y: 4 },
    { k: '5a', col: 5, y: 1, ben: 'upgrade' }, { k: '5b', col: 5, y: 3, ben: 'blueprint' },
    { k: '6a', col: 6, y: 2 },
];
/** Cost to move a tile INTO a column ('any' = any non-crystal resource). */
export const LAB_COST = { 2: ['any'], 3: ['oxygen'], 4: ['oxygen'], 5: ['oxygen', 'any'], 6: ['oxygen', 'crystal'] };
/** End-game OP for a tile in each column. */
export const LAB_OP = [0, 1, 2, 3, 4, 5, 9];

// ---------------------------------------------------------------- techs
export const TECHS = {
    mine: { name: 'Mine Tech', kind: 'connect', b: 'mine' },
    gen: { name: 'Generator Tech', kind: 'connect', b: 'gen' },
    water: { name: 'Water Tech', kind: 'connect', b: 'water' },
    green: { name: 'Greenhouse Tech', kind: 'connect', b: 'green' },
    oxy: { name: 'Oxygen Tech', kind: 'connect', b: 'oxy' },
    rover: { name: 'Faster Rovers', kind: 'rover' },
    colonist: { name: 'Colonist Capacity', kind: 'colonist' },
    upgrade: { name: 'Efficient Upgrading', kind: 'upgrade' },
    shelter: { name: 'Shelter Tech', kind: 'connect', b: 'shelter' },
};
export const GRID_TECHS = ['mine', 'gen', 'water', 'green', 'oxy', 'rover', 'colonist', 'upgrade'];
/** Tech grid spaces: 0-2 top row, 3-5 middle, 6-7 bottom. */
export const GRID_COST = [['battery', 'any'], ['battery', 'any'], ['battery', 'any'], ['battery'], ['battery'], ['battery'], [], []];

// ---------------------------------------------------------------- player board
/** Executive actions next to the Depot, top to bottom. Ships cover 0-4 at start. */
export const EXEC = [
    { k: 'develop', cost: 4 }, { k: 'rover', cost: 4 }, { k: 'blueprint', cost: 3 }, { k: 'upgrade', cost: 3 },
    { k: 'mineral', cost: 3 }, { k: 'bots', cost: 2 }, { k: 'warehouse', cost: 2 }, { k: 'adv', cost: 2 },
];
export const LQ_TIERS = [3, 6, 10, 15, 21];
export const PROGRESS_OP = [0, 1, 2, 4, 7, 11];
export const SHIP_OP = 3;

/** Turn-order space benefits. 1-4 orbit, 5-8 colony. */
export const TURN_SPACES = { 1: null, 2: 'warehouse', 3: 'tech', 4: 'colonist', 5: null, 6: 'warehouse', 7: 'bots', 8: 'blueprint' };
export const FIRST_COLONIST_SPACES = [2, 3, 4, 6, 7, 8];

// ---------------------------------------------------------------- cards
/** Blueprints. ex = executive action key. */
export const BLUEPRINTS = [
    { id: 1, name: 'Construction Yard', lvl: 1, type: 'mine', ex: 'upgrade1' },
    { id: 2, name: 'Metal Deposit', lvl: 1, type: 'mine', ex: 'build' },
    { id: 3, name: 'Automated Production', lvl: 1, type: 'gen', ex: 'produce' },
    { id: 4, name: 'Wind Turbines', lvl: 1, type: 'gen', ex: 'build' },
    { id: 5, name: 'Private Ship', lvl: 1, type: 'water', ex: 'ship' },
    { id: 6, name: 'Moisture Vaporator', lvl: 1, type: 'water', ex: 'build' },
    { id: 7, name: 'Biomarket', lvl: 1, type: 'green', ex: 'warehouse' },
    { id: 8, name: 'Hydroponic Farm', lvl: 1, type: 'green', ex: 'build' },
    { id: 9, name: 'Oxygen Tank', lvl: 1, type: 'oxy', ex: 'tech' },
    { id: 10, name: 'Concentrator', lvl: 1, type: 'oxy', ex: 'build' },
    { id: 11, name: 'Casino', lvl: 1, type: 'shelter', ex: 'casino' },
    { id: 12, name: 'Gym', lvl: 1, type: 'shelter', ex: 'build' },
    { id: 13, name: 'Mineral Mine', lvl: 3, type: 'mine', ex: 'op2' },
    { id: 14, name: 'Biolab', lvl: 3, type: 'mine', ex: 'contract' },
    { id: 15, name: 'Radar', lvl: 3, type: 'gen', ex: 'radar' },
    { id: 16, name: 'Builder Drone AI600', lvl: 3, type: 'gen', ex: 'drone' },
    { id: 17, name: 'Research Lab', lvl: 3, type: 'water', ex: 'research' },
    { id: 18, name: 'Aqueduct', lvl: 3, type: 'water', ex: 'aqueduct' },
    { id: 19, name: 'Eco Resort', lvl: 3, type: 'green', ex: 'resort' },
    { id: 20, name: 'Trade Market', lvl: 3, type: 'green', ex: 'trade' },
    { id: 21, name: 'Recycling Bots', lvl: 3, type: 'oxy', ex: 'recycle' },
    { id: 22, name: 'Aerial Elevator', lvl: 3, type: 'oxy', ex: 'elevator' },
    { id: 23, name: 'Library', lvl: 3, type: 'shelter', ex: 'library' },
    { id: 24, name: 'Command Center', lvl: 3, type: 'shelter', ex: 'command' },
];
export const bp = (/** @type {number} */ id) => BLUEPRINTS[id - 1];
/** Executive actions that accept a colonist boost. */
export const EX_BOOST = { upgrade1: 1, produce: 1, ship: 1, warehouse: 1, tech: 1, casino: 1, research: 1, trade: 1, library: 1, build: 1 };

export const SCIENTISTS = [
    { id: 'geo', name: 'Geologist', cost: { colonists: 2 }, works: 'mine', scores: 'gen' },
    { id: 'rnd', name: 'R&D Engineer', cost: { mineral: 2 }, works: 'gen', scores: 'water' },
    { id: 'hyd', name: 'Hydrologist', cost: { battery: 2 }, works: 'water', scores: 'green' },
    { id: 'bio', name: 'Biochemist', cost: { water: 2 }, works: 'green', scores: 'oxy' },
    { id: 'gch', name: 'Geochemist', cost: { plant: 2 }, works: 'oxy', scores: 'shelter' },
    { id: 'sys', name: 'Systems Engineer', cost: { oxygen: 2 }, works: 'shelter', scores: 'mine' },
];
export const sci = (/** @type {string} */ id) => SCIENTISTS.find(s => s.id === id);

/** Earth contracts. up = upgrade-type (advanced marker on a complex of 4+). */
export const CONTRACTS = [
    { id: 1, up: 'gen', win: 12, lose: 6 }, { id: 2, up: 'water', win: 12, lose: 6 },
    { id: 3, up: 'green', win: 12, lose: 6 }, { id: 4, up: 'oxy', win: 12, lose: 6 },
    { id: 5, up: 'shelter', win: 12, lose: 6 }, { id: 6, up: 'mine', win: 12, lose: 6 },
    { id: 7, need: { mineral: 4 }, win: 9, lose: 4 },
    { id: 8, need: { battery: 3, mineral: 2 }, win: 9, lose: 4 },
    { id: 9, need: { water: 3, mineral: 2 }, win: 9, lose: 4 },
    { id: 10, need: { oxygen: 3, mineral: 2 }, win: 9, lose: 4 },
    { id: 11, need: { plant: 3, mineral: 2 }, win: 9, lose: 4 },
    { id: 12, need: { crystal: 3, mineral: 2 }, win: 9, lose: 4 },
];
export const contract = (/** @type {number} */ id) => CONTRACTS[id - 1];

/** Missions. need = 2-player target, gain = crystals per contribution. */
export const MISSIONS = [
    { id: 1, k: 'research', need: 5, gain: 2, short: false, name: 'Research tiles taken' },
    { id: 2, k: 'adv', need: 8, gain: 1, short: false, name: 'Advanced Buildings' },
    { id: 3, k: 'discovery', need: 5, gain: 1, short: false, name: 'Discovery tiles taken' },
    { id: 4, k: 'progress', need: 8, gain: 1, short: false, name: 'Progress cubes' },
    { id: 5, k: 'contract', need: 2, gain: 2, short: false, name: 'Contracts completed' },
    { id: 6, k: 'blueprint', need: 10, gain: 1, short: true, name: 'Blueprints taken' },
    { id: 7, k: 'bot', need: 3, gain: 2, short: true, name: 'Bots placed' },
    { id: 8, k: 'tech', need: 8, gain: 1, short: true, name: 'Techs taken' },
    { id: 9, k: 'scientist', need: 4, gain: 2, short: true, name: 'Scientists hired' },
];
export const mission = (/** @type {number} */ id) => MISSIONS[id - 1];

/** Private goals (16). reward: two choices; the first is always "develop x2 free". */
export const GOALS = [
    { id: 1, k: 'blueprints4', r: 'upgrade2' },
    { id: 2, k: 'shelters3', r: 'colonists2' },
    { id: 3, k: 'mines3', r: 'minerals3' },
    { id: 4, k: 'discovery3', r: 'rover5' },
    { id: 5, k: 'advComplex4', r: 'colonists2' },
    { id: 6, k: 'sameRes4', r: 'contract' },
    { id: 7, k: 'adv3', r: 'res3' },
    { id: 8, k: 'level3', r: 'rover5' },
    { id: 9, k: 'colonists7', r: 'ship' },
    { id: 10, k: 'techs5', r: 'retrieve2' },
    { id: 11, k: 'ships3', r: 'travel' },
    { id: 12, k: 'research2', r: 'scientist' },
    { id: 13, k: 'sciContract', r: 'contract' },
    { id: 14, k: 'labSpaces', r: 'crystals3' },
    { id: 15, k: 'progress3', r: 'retrieve2' },
    { id: 16, k: 'adv2Complex3', r: 'upgrade2' },
];
/** Lab spaces marked on goal 14: middle of column 4 and both column-5 spaces. */
export const GOAL14_SPACES = ['4b', '5a', '5b'];

/** Discovery tiles (19). res = specific-resource tiles Pathfinder's LSS pile excludes. */
export const DISCOVERY = [
    { id: 1, k: 'build', b: 'mine' }, { id: 2, k: 'build', b: 'gen' }, { id: 3, k: 'build', b: 'water' },
    { id: 4, k: 'build', b: 'green' }, { id: 5, k: 'build', b: 'oxy' }, { id: 6, k: 'build', b: 'shelter' },
    { id: 7, k: 'buildAny' }, { id: 8, k: 'develop2' }, { id: 9, k: 'blueprints2' }, { id: 10, k: 'tech1' },
    { id: 11, k: 'upgrade2' }, { id: 12, k: 'hire' }, { id: 13, k: 'warehouse2' },
    { id: 14, k: 'gain', g: 'crystal', n: 3, res: true }, { id: 15, k: 'gain', g: 'mineral', n: 3, res: true },
    { id: 16, k: 'gain', g: 'battery', n: 3, res: true }, { id: 17, k: 'gain', g: 'water', n: 3, res: true },
    { id: 18, k: 'gain', g: 'plant', n: 3, res: true }, { id: 19, k: 'gain', g: 'oxygen', n: 3, res: true },
];
export const disc = (/** @type {number} */ id) => DISCOVERY[id - 1];

export const RESEARCH = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'D1', 'D2'];

/** LSS reward tiles (8, 4 used). */
export const LSS_TILES = [
    { k: 'techLevel', per: 1 }, { k: 'ships', per: 2 }, { k: 'advMarkers', per: 2 }, { k: 'mines', per: 2 },
    { k: 'bots', per: 2 }, { k: 'discovery', per: 2 }, { k: 'shelters', per: 2 }, { k: 'colonists', per: 1 },
];
export const LSS_BENEFITS = ['bots', 'mineral', 'crystal', 'retrieve'];

/** Pathfinder solo deck. n = action number, x = no-travel X, m = mission letter. */
export const SOLO = [
    { id: 1, m: 'B', x: true, n: 3 }, { id: 2, m: 'A', x: true, n: 2 }, { id: 3, m: 'A', x: false, n: 3 },
    { id: 4, m: 'C', x: false, n: 3 }, { id: 5, m: 'B', x: false, n: 1 }, { id: 6, m: 'C', x: true, n: 1 },
    { id: 7, m: 'C', x: false, n: 2 }, { id: 8, m: 'C', x: false, n: 1 }, { id: 9, m: 'A', x: false, n: 2 },
    { id: 10, m: 'B', x: false, n: 2 }, { id: 11, m: 'B', x: false, n: 1 }, { id: 12, m: 'A', x: false, n: 1 },
];
export const solo = (/** @type {number} */ id) => SOLO[id - 1];

/** Building tile stacks: 6 per type; 3 with crystal arrows (unverified split, see docs). */
export const TILE_ARROWS_PER_TYPE = 3;
export const TILES_PER_TYPE = 6;
export const SHELTERS_PER_PLAYER = 5;

export const ACTIONS_ORBIT = ['pod', 'blueprint', 'tech', 'rnd', 'resupply'];
export const ACTIONS_COLONY = ['construct', 'upgrade', 'hire', 'control', 'ship'];
/** Actions that need a colonist on an action slot. */
export const SLOT_ACTIONS = ['blueprint', 'rnd', 'construct', 'upgrade', 'hire'];
export const BOOST_ACTIONS = ['blueprint', 'tech', 'rnd', 'resupply', 'ship'];
