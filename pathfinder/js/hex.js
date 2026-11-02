// @ts-check
// Hex grid helpers. Ids are "col,row"; flat-top, odd columns shifted down.
import { COL_ROWS } from './data.js';

/** @type {string[]} every hex on the map, column by column, top to bottom */
export const HEXES = [];
COL_ROWS.forEach(([a, b], c) => { for (let r = a; r <= b; r++) HEXES.push(c + ',' + r); });
const ON_MAP = new Set(HEXES);

export const parse = (/** @type {string} */ id) => id.split(',').map(Number);
export const key = (/** @type {number} */ c, /** @type {number} */ r) => c + ',' + r;
export const onMap = (/** @type {string} */ id) => ON_MAP.has(id);

/** @param {string} id */
function cube(id) {
    const [c, r] = parse(id);
    const x = c, z = r - (c - (c & 1)) / 2;
    return [x, -x - z, z];
}

/** Hex distance. */
export function dist(/** @type {string} */ a, /** @type {string} */ b) {
    const p = cube(a), q = cube(b);
    return Math.max(Math.abs(p[0] - q[0]), Math.abs(p[1] - q[1]), Math.abs(p[2] - q[2]));
}

/** Neighbour offsets by direction for even / odd columns. */
const DIRS = {
    n: [[0, -1], [0, -1]], s: [[0, 1], [0, 1]],
    ne: [[1, -1], [1, 0]], se: [[1, 0], [1, 1]],
    nw: [[-1, -1], [-1, 0]], sw: [[-1, 0], [-1, 1]],
};
/** @param {string} id @param {keyof DIRS} d */
export function step(id, d) {
    const [c, r] = parse(id);
    const [dc, dr] = DIRS[d][c & 1];
    const k = key(c + dc, r + dr);
    return onMap(k) ? k : null;
}
/** @returns {string[]} on-map neighbours */
export function neighbors(/** @type {string} */ id) {
    return /** @type {(keyof DIRS)[]} */(['n', 'ne', 'se', 's', 'sw', 'nw']).map(d => step(id, d)).filter(Boolean);
}
export function within(/** @type {string} */ id, /** @type {number} */ n) {
    return HEXES.filter(h => dist(h, id) <= n);
}

/** Pixel centre for a unit hex radius of 1 (flat-top). */
export function center(/** @type {string} */ id) {
    const [c, r] = parse(id);
    return { x: c * 1.5, y: (r + (c & 1) * 0.5) * Math.sqrt(3) };
}

/**
 * Pathfinder "card order" sweep through hexes.
 * 1: columns left→right, each top→bottom.  2: right→left, top→bottom.
 * 3: left→right, bottom→top.  X: right→left, bottom→top.
 * @param {string[]} ids @param {{n:number,x:boolean}} card
 */
export function cardOrder(ids, card) {
    const mode = card.x ? 'X' : card.n;
    const leftToRight = mode === 1 || mode === 3;
    const topToBottom = mode === 1 || mode === 2;
    return [...ids].sort((a, b) => {
        const [ca, ra] = parse(a), [cb, rb] = parse(b);
        const ya = ra + (ca & 1) * 0.5, yb = rb + (cb & 1) * 0.5;
        if (ca !== cb) return leftToRight ? ca - cb : cb - ca;
        return topToBottom ? ya - yb : yb - ya;
    });
}
