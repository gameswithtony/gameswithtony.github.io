// @ts-check
// Charmap parsing and THE neighbour accessors. SPEC §10.7 forbids treating array bounds as
// playability anywhere in the codebase: n4/n8 are precomputed VOID-filtered adjacency lists,
// and every consumer — routing, clue counting, blast fill, placement legality — goes through
// them. A VOID cell has no neighbours at all, so adjacency stays symmetric.

import { CON_NONE } from './state.js';

/** @typedef {import('./state.js').Terrain} Terrain */
/** @typedef {import('./state.js').BBox} BBox */
/** @typedef {import('./state.js').GameState} GameState */

/**
 * Anything carrying the immutable grid layer: a parseMap result or a GameState.
 * @typedef {object} Grid
 * @property {number} w
 * @property {number} h
 * @property {Terrain[]} terrain
 */

/**
 * @typedef {object} ParsedMap
 * @property {number} w
 * @property {number} h
 * @property {Terrain[]} terrain
 * @property {number} origin
 * @property {number[]} dests
 * @property {BBox} bbox
 */

/**
 * Destination letters, in order, starting at 'B' (SPEC §2.4, rev. 2026-08-05). The cap is not
 * arithmetic shyness: seven destinations is already far past the point where a player can hold
 * the itineraries in their head, and a letter past 'H' in a charmap is much more likely to be
 * a typo than a level. Reaching the cap should be a design conversation, so it is an error.
 */
const LAST_DEST = 'H';

/** @type {Record<string, Terrain>} */
const LEGEND = {
  '.': 'void',
  ' ': 'void',
  '#': 'ocean',
  '^': 'volcano',
  'A': 'ocean',   // endpoints sit on ocean terrain (SPEC §10.7)
};
// 'B'…'H' are destinations and all sit on ocean too, so the legend rows are generated rather
// than typed out — one row per letter is exactly the same row, and writing seven of them by
// hand is how the eighth ends up different.
for (let c = 'B'.charCodeAt(0); c <= LAST_DEST.charCodeAt(0); c++) LEGEND[String.fromCharCode(c)] = 'ocean';

/**
 * Forgiving by design (PLAN §9.1): space is an alias of '.', rows are right-padded to the
 * widest row, and blank leading/trailing lines are dropped — invisible whitespace can never
 * break a level. Any other character is a hard error naming its row and column.
 * @param {string} text
 * @returns {ParsedMap}
 */
export function parseMap(text) {
  if (typeof text !== 'string') throw new Error('parseMap: map must be a string');

  const lines = text.split('\n').map((l) => l.replace(/\s+$/, ''));
  while (lines.length && lines[0] === '') lines.shift();
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  if (!lines.length) throw new Error('parseMap: map is empty');

  const h = lines.length;
  const w = lines.reduce((m, l) => Math.max(m, l.length), 0);
  if (w === 0) throw new Error('parseMap: map is empty');

  /** @type {Terrain[]} */
  const terrain = new Array(w * h).fill('void');
  let origin = -1;
  /** @type {Map<string, number>} destination letter → cell, so gaps can be named */
  const marked = new Map();

  for (let y = 0; y < h; y++) {
    const line = lines[y];
    for (let x = 0; x < line.length; x++) {
      const ch = line[x];
      const t = LEGEND[ch];
      if (!t) {
        throw new Error(
          `parseMap: unknown map character '${ch}' at row ${y + 1}, column ${x + 1} (1-based)`,
        );
      }
      const i = y * w + x;
      terrain[i] = t;
      if (ch === 'A') {
        if (origin !== -1) throw new Error(`parseMap: more than one 'A' (row ${y + 1}, column ${x + 1})`);
        origin = i;
      } else if (ch >= 'B' && ch <= LAST_DEST) {
        if (marked.has(ch)) throw new Error(`parseMap: more than one '${ch}' (row ${y + 1}, column ${x + 1})`);
        marked.set(ch, i);
      }
    }
  }

  if (origin === -1) throw new Error("parseMap: map has no origin 'A'");
  if (!marked.has('B')) throw new Error("parseMap: map has no destination 'B'");

  // Contiguous from 'B', so `dests[i]` and `String.fromCharCode(66 + i)` are the same fact read
  // two ways and nothing downstream has to carry a letter around. A map with 'B' and 'D' but no
  // 'C' is refused rather than silently renumbered: renumbering would move the level's own
  // itineraries onto different cells than the author drew.
  /** @type {number[]} */
  const dests = [];
  for (let c = 'B'.charCodeAt(0); c <= LAST_DEST.charCodeAt(0); c++) {
    const letter = String.fromCharCode(c);
    const cell = marked.get(letter);
    if (cell === undefined) {
      const later = [...marked.keys()].filter((k) => k > letter).sort();
      if (later.length) {
        throw new Error(`parseMap: map has '${later[0]}' but no '${letter}' — destinations run B, C, D… with no gaps`);
      }
      break;
    }
    dests.push(cell);
  }

  return { w, h, terrain, origin, dests, bbox: playableBBox(w, h, terrain) };
}

/**
 * Framing comes from the playable cells, never from array dimensions (SPEC §10.7).
 * @param {number} w
 * @param {number} h
 * @param {Terrain[]} terrain
 * @returns {BBox}
 */
function playableBBox(w, h, terrain) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let i = 0; i < terrain.length; i++) {
    if (terrain[i] === 'void') continue;
    const x = i % w, y = (i / w) | 0;
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  if (x1 < 0) throw new Error('parseMap: map has no playable cells');
  return { x0, y0, x1, y1 };
}

/**
 * Adjacency lists are a pure function of the terrain layer, which is fixed at load and
 * shared by every clone of a state — so they are built once and cached against it.
 * @type {WeakMap<Terrain[], { n4: number[][], n8: number[][] }>}
 */
const TABLES = new WeakMap();

const D4 = [[0, -1], [-1, 0], [1, 0], [0, 1]];
const D8 = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];

/**
 * @param {Grid} g
 */
function tables(g) {
  let t = TABLES.get(g.terrain);
  if (!t) {
    t = { n4: build(g, D4), n8: build(g, D8) };
    TABLES.set(g.terrain, t);
  }
  return t;
}

/**
 * @param {Grid} g
 * @param {number[][]} deltas
 * @returns {number[][]}
 */
function build(g, deltas) {
  const { w, h, terrain } = g;
  /** @type {number[][]} */
  const out = new Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (terrain[i] === 'void') { out[i] = []; continue; }
    const x = i % w, y = (i / w) | 0;
    /** @type {number[]} */
    const list = [];
    for (const [dx, dy] of deltas) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx;
      if (terrain[j] === 'void') continue;
      list.push(j);
    }
    out[i] = list;
  }
  return out;
}

/**
 * Orthogonal neighbours, VOID filtered. Movement and build adjacency use this (SPEC §2.4).
 * @param {Grid} g
 * @param {number} i
 * @returns {number[]}
 */
export function n4(g, i) {
  return tables(g).n4[i] ?? [];
}

/**
 * All eight neighbours, VOID filtered. Clue counting uses this (SPEC §7.4).
 * @param {Grid} g
 * @param {number} i
 * @returns {number[]}
 */
export function n8(g, i) {
  return tables(g).n8[i] ?? [];
}

/**
 * @param {Grid} g
 * @param {number} x
 * @param {number} y
 * @returns {number}
 */
export function cellAt(g, x, y) {
  if (x < 0 || y < 0 || x >= g.w || y >= g.h) return -1;
  return y * g.w + x;
}

/**
 * @param {Grid} g
 * @param {number} i
 * @returns {{ x: number, y: number }}
 */
export function cellXY(g, i) {
  return { x: i % g.w, y: (i / g.w) | 0 };
}

/**
 * A fresh construction layer for a parsed map.
 * @param {ParsedMap} m
 * @returns {import('./state.js').Con[]}
 */
export function emptyCon(m) {
  return new Array(m.w * m.h).fill(CON_NONE);
}
