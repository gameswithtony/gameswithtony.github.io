// @ts-check
// Passability, the distance field, the departure gate and step choice (SPEC §6.2/§6.3).
// Every question here is answered by the capability tables in state.js — nothing in this
// file knows the name of a terrain feature or a construction state.

import { n4 } from './grid.js';
import { isPassable } from './state.js';

/** @typedef {import('./state.js').GameState} GameState */

/**
 * Endpoints are always passable and never buildable (PLAN §3.8).
 * @param {GameState} s
 * @param {number} i
 * @returns {boolean}
 */
export function passable(s, i) {
  if (i === s.origin || i === s.dest) return true;
  return isPassable(s.terrain[i], s.con[i]);
}

/**
 * BFS from the destination over passable cells; -1 where unreachable.
 * @param {GameState} s
 * @returns {Int32Array}
 */
export function distField(s) {
  const dist = new Int32Array(s.w * s.h).fill(-1);
  dist[s.dest] = 0;
  let frontier = [s.dest];
  while (frontier.length) {
    /** @type {number[]} */
    const next = [];
    for (const i of frontier) {
      const d = dist[i] + 1;
      for (const j of n4(s, i)) {
        if (dist[j] !== -1 || !passable(s, j)) continue;
        dist[j] = d;
        next.push(j);
      }
    }
    frontier = next;
  }
  return dist;
}

/**
 * Topological, not safe: AI_HIDDEN counts as passable, so users depart down mined
 * corridors and only refuse routes that go nowhere (SPEC §6.2).
 * @param {GameState} s
 * @param {Int32Array} [dist]  reuse the field the tick already computed
 * @returns {boolean}
 */
export function gateOpen(s, dist) {
  return (dist ?? distField(s))[s.origin] >= 0;
}

/**
 * Moves that strictly reduce distance to the destination and were not already visited on
 * this trip (SPEC §6.3). A finite dist already implies passable — the field is only
 * expanded over passable cells — so passability is not re-tested here.
 * @param {GameState} s
 * @param {Int32Array} dist
 * @param {number} at
 * @param {number[]} visited
 * @returns {number[]}
 */
export function stepCandidates(s, dist, at, visited) {
  /** @type {number[]} */
  const out = [];
  const here = dist[at];
  if (here < 0) return out;
  for (const j of n4(s, at)) {
    if (dist[j] < 0 || dist[j] >= here) continue;
    if (visited.includes(j)) continue;
    out.push(j);
  }
  return out;
}
