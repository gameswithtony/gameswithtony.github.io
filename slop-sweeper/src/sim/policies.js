// @ts-check
// Policy bots for the tuning harness (PLAN §13).
//
// INFORMATION DISCIPLINE — the whole point of the harness. A bot plays with exactly what a
// player can see: terrain, `con[].k`, block boundaries, `clue()` on revealed tiles, and the
// "this generation introduced N defects" toast it saw at commit (`blockPlaced.mines`, kept
// in policy memory). A bot must NEVER read `con[].mine`, never call the solver, and never
// consult a block's *live* badge — a live badge would leak which cells a blast took mines
// from. There is a standing test that greps this file for `.mine` accesses.
//
// Randomness comes from the policy's own seeded stream, never from the core streams, so
// changing a bot can never perturb block draws or movement tie-breaks.

import { mulberry32 } from '../core/rng.js';
import { isHandBuildable, isKnownEmpty } from '../core/state.js';
import { n4, n8 } from '../core/grid.js';
import { distField, gateOpen, passable } from '../core/routing.js';
import { legalActions, placeRejection } from '../core/reduce.js';
import { placementCells } from '../core/generate.js';

/** @typedef {import('../core/state.js').GameState} GameState */
/** @typedef {import('../core/state.js').Action} Action */
/** @typedef {import('../core/state.js').Ev} Ev */

/**
 * @typedef {object} Bot
 * @property {string} name
 * @property {(evs: Ev[]) => void} observe
 * @property {(s: GameState) => Action} act
 */

const INF = 0x3fffffff;

/** Turns between analyses for `balanced` — a tuning lever, not a rule. */
export const ANALYZE_EVERY = 3;

/**
 * How much route progress edge-hugging will give up to buy legibility. This number *is* the
 * thesis of SPEC §1: the wise play often places worse in order to stay readable.
 */
export const EDGE_SLACK = 2;

/** Safety net; the natural loop always terminates because analyze consumes hidden cells. */
const MAX_ANALYZES_PER_BLOCK = 4;

/**
 * Below this many remaining tiles, every bot finishes by hand.
 *
 * This is not a bot convenience, it is a property of the game and it took a sim run to
 * surface: placement is all-or-nothing (SPEC §4.2), so a five-cell block needs five free
 * adjacent cells. The last gap in a route almost never has them, and a pure-generate bot
 * gets the route to "one tile short" and then thrashes forever. **No level in the corpus is
 * winnable with AI alone** — the closing tiles are hand work by construction. That mirrors
 * SPEC §9.1's "not winnable with zero" from the other side, and it is free: nobody wrote a
 * rule for it.
 */
const HAND_FINISH = 2;

// --- shared board reading (legal information only) ------------------------------------

/**
 * Tiles that must still be built to connect each cell to `source` over water: already
 * passable ground is free, unbuilt ocean costs one turn, everything else is unreachable.
 * 0-1 BFS by cost bucket.
 * @param {GameState} s
 * @param {number} source
 * @returns {Int32Array}
 */
export function buildCost(s, source) {
  const cost = new Int32Array(s.w * s.h).fill(INF);
  /** @type {number[][]} */
  const buckets = [];
  cost[source] = 0;
  buckets[0] = [source];
  for (let d = 0; d < buckets.length; d++) {
    const bucket = buckets[d];
    if (!bucket) continue;
    for (const i of bucket) {
      if (cost[i] !== d) continue;
      for (const j of n4(s, i)) {
        const step = passable(s, j) ? 0 : (isHandBuildable(s.terrain[j], s.con[j]) ? 1 : -1);
        if (step < 0) continue;
        const nd = d + step;
        if (nd >= cost[j]) continue;
        cost[j] = nd;
        (buckets[nd] ??= []).push(j);
      }
    }
  }
  return cost;
}

/**
 * How many of a cell's eight neighbours are deduction anchors — coastline, volcano, open
 * water, hand tiles, revealed tiles (SPEC §7.5). Precomputed per turn because edge-hugging
 * asks it of every candidate placement.
 * @param {GameState} s
 * @returns {Int32Array}
 */
export function anchorCounts(s) {
  const out = new Int32Array(s.w * s.h);
  for (let i = 0; i < s.con.length; i++) {
    let n = 0;
    for (const j of n8(s, i)) if (isKnownEmpty(s.terrain[j], s.con[j])) n++;
    // A cell on the map edge has fewer than eight neighbours at all, which is itself the
    // coastline signal — count the missing ones as anchors too (SPEC §7.5).
    out[i] = n + (8 - n8(s, i).length);
  }
  return out;
}

/**
 * What the board says about finishing the job, all of it legal information.
 *
 * `handCell` is the legal hand placement lying on the cheapest remaining A→B completion.
 * Scoring by `toDest` alone is not enough — every cell touching the network scores 1, so
 * the tie-break would wander. `fromOrigin + toDest` is the total build a route through this
 * cell still costs, which is the gradient that actually points at B; a cell *on* a cheapest
 * completion scores exactly `remaining + 1`, because it is counted from both ends.
 *
 * `handOnRoute` false is the signature of SPEC §4.1 biting: the gap is walled in by
 * unreviewed slop, which is walkable but not buildable-from, so the only hand tiles on offer
 * are somewhere else entirely. A policy that reads this and reaches for Analyze is paying
 * down comprehension debt exactly as SPEC §9.3 describes.
 *
 * @param {GameState} s
 * @returns {{ remaining: number, handCell: number, handOnRoute: boolean }}
 */
export function survey(s) {
  const toDest = buildCost(s, s.dest);
  const fromOrigin = buildCost(s, s.origin);
  const remaining = toDest[s.origin];
  let handCell = -1;
  let bestCost = INF;
  for (let i = 0; i < s.con.length; i++) {
    const cost = toDest[i] >= INF || fromOrigin[i] >= INF ? INF : toDest[i] + fromOrigin[i];
    if (cost >= bestCost) continue;
    if (placeRejection(s, i)) continue;
    bestCost = cost;
    handCell = i;
  }
  return { remaining, handCell, handOnRoute: handCell >= 0 && bestCost <= remaining + 1 };
}

/**
 * Ghost placement (PLAN §13). `coverage` maximises progress toward B; `edge` gives up to
 * EDGE_SLACK turns of that progress to land against coastline and known ground instead.
 * The delta between them is the measurement the corpus exists to take.
 * @param {GameState} s
 * @param {'coverage' | 'edge'} style
 * @returns {{ cell: number, rot: 0 | 1 | 2 | 3 }}
 */
export function chooseGhost(s, style) {
  if (s.phase.k !== 'placing') throw new Error('chooseGhost: not placing');
  const toDest = buildCost(s, s.dest);
  const fromOrigin = buildCost(s, s.origin);
  const anchors = anchorCounts(s);

  /** @type {{ cell: number, rot: 0|1|2|3, cover: number, legible: number }[]} */
  const candidates = [];
  let minCover = INF;
  for (const r of s.phase.rots) {
    for (const anchor of r.anchors) {
      const cells = placementCells(s, anchor, r.cells);
      if (!cells) continue;
      let near = INF;
      let far = INF;
      let legible = 0;
      for (const c of cells) {
        if (fromOrigin[c] < near) near = fromOrigin[c];
        if (toDest[c] < far) far = toDest[c];
        legible += anchors[c];
      }
      // A block is free to walk once it lands, so the route through it costs roughly
      // "reach it from A" + "leave it for B". Lower closes the path sooner.
      const cover = near >= INF || far >= INF ? INF : near + far;
      if (cover < minCover) minCover = cover;
      candidates.push({ cell: anchor, rot: r.rot, cover, legible });
    }
  }
  if (candidates.length === 0) throw new Error('chooseGhost: no anchors in a placing phase');

  const ceiling = style === 'edge' ? minCover + EDGE_SLACK : minCover;
  let best = candidates[0];
  let bestKey = [INF, -INF, INF, INF];
  for (const c of candidates) {
    const eligible = c.cover <= ceiling ? 0 : 1;
    /** primary keys differ by style; ties always fall through to the board order */
    const key = style === 'edge'
      ? [eligible, -c.legible, c.cover, c.cell * 4 + c.rot]
      : [eligible, c.cover, -c.legible, c.cell * 4 + c.rot];
    if (less(key, bestKey)) { bestKey = key; best = c; }
  }
  return { cell: best.cell, rot: best.rot };
}

/**
 * @param {number[]} a
 * @param {number[]} b
 * @returns {boolean}
 */
function less(a, b) {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] < b[i];
  }
  return false;
}

// --- policy memory --------------------------------------------------------------------

/**
 * @typedef {object} Memory
 * @property {Map<number, number>} announced   block id → defects stated at commit
 * @property {Map<number, number>} analyzed    block id → how many times we reviewed it
 * @property {boolean} refunded                the last Generate found nowhere to land
 * @property {number} sinceAnalyze
 * @property {number} lastRemaining            tiles left to close the route, last turn
 * @property {number} genStalls                consecutive turns that bought no progress
 */

/** @returns {Memory} */
function freshMemory() {
  return {
    announced: new Map(), analyzed: new Map(), refunded: false, sinceAnalyze: 0,
    lastRemaining: INF, genStalls: 0,
  };
}

/**
 * Book the turn's progress so a policy can notice it is getting nowhere.
 * @param {Memory} mem
 * @param {number} remaining
 */
function bookProgress(mem, remaining) {
  mem.genStalls = remaining >= mem.lastRemaining ? mem.genStalls + 1 : 0;
  mem.lastRemaining = remaining;
}

/**
 * The shared build decision for the reviewing policies: generate at the policy's dosage,
 * except in the two places where the rules say a turn of AI cannot help.
 * @param {GameState} s
 * @param {Memory} mem
 * @param {{ remaining: number, handCell: number, handOnRoute: boolean }} v
 * @param {boolean} wantsAi
 * @returns {Action}
 */
function dose(s, mem, v, wantsAi) {
  const canGenerate = !mem.refunded && mem.genStalls < 3;
  if (!v.handOnRoute) {
    // SPEC §4.1 has walled the frontier off: the route now runs through unreviewed slop, so
    // no hand tile advances it. Dosage does not apply here — the only ways forward are more
    // generation or a review that turns the slop back into ground you can build from. This
    // is the sim's clearest sighting of SPEC §9.3, and it is why a naive p-mix stalls: hand
    // and AI cannot take turns at the same frontier.
    if (canGenerate && v.remaining > HAND_FINISH) return { t: 'generate' };
    const cell = analyzeTarget(s, null);
    if (cell >= 0) return review(s, mem, cell);
    return handStep(v) ?? { t: 'wait' };
  }
  // The gap is small enough that no block fits it (HAND_FINISH) — finish by hand.
  if (v.remaining <= HAND_FINISH) return { t: 'place', cell: v.handCell };
  if (canGenerate && wantsAi) return { t: 'generate' };
  return handStep(v) ?? (mem.refunded ? { t: 'wait' } : { t: 'generate' });
}

/**
 * @param {Memory} mem
 * @param {Ev[]} evs
 */
function remember(mem, evs) {
  for (const e of evs) {
    switch (e.t) {
      case 'blockPlaced': mem.announced.set(e.block, e.mines); mem.refunded = false; break;
      case 'generateRefunded': mem.refunded = true; break;
      // Any change to the board changes the legal set, so a past refusal stops applying.
      case 'placed': case 'detonate': case 'analyzed': mem.refunded = false; break;
      default: break;
    }
  }
}

/**
 * Blocks still worth reviewing: the toast said they carried defects and not all of them
 * have surfaced yet. Everything read here is on screen.
 * @param {GameState} s
 * @param {Memory} mem
 * @returns {number[]} block ids
 */
function suspectBlocks(s, mem) {
  /** @type {number[]} */
  const out = [];
  for (const b of s.blocks) {
    const announced = mem.announced.get(b.id);
    if (announced === undefined || announced === 0) continue;
    if ((mem.analyzed.get(b.id) ?? 0) >= MAX_ANALYZES_PER_BLOCK) continue;
    let hidden = 0;
    let confirmed = 0;
    for (const c of b.cells) {
      if (s.con[c].k === 'aiHidden') hidden++;
      else if (s.con[c].k === 'mineConfirmed') confirmed++;
    }
    if (hidden > 0 && confirmed < announced) out.push(b.id);
  }
  return out;
}

/**
 * The tile to review: unreviewed slop on the route users are about to walk, hit as early in
 * their trip as possible. Restricted to `block` when the caller has one in mind.
 * @param {GameState} s
 * @param {number | null} block
 * @returns {number} cell index, or -1
 */
function analyzeTarget(s, block) {
  const dist = distField(s);
  let best = -1;
  let bestKey = [INF, INF];
  for (let i = 0; i < s.con.length; i++) {
    const con = s.con[i];
    if (con.k !== 'aiHidden') continue;
    if (block !== null && con.block !== block) continue;
    // On a live route first (users cross it), then whatever they reach soonest.
    const key = dist[i] >= 0 ? [0, -dist[i]] : [1, i];
    if (less(key, bestKey)) { bestKey = key; best = i; }
  }
  return best;
}

// --- the policies ---------------------------------------------------------------------

/**
 * @param {{ handCell: number }} v
 * @returns {Action | null} a hand tile toward B, or null when there is nowhere legal
 */
function handStep(v) {
  return v.handCell < 0 ? null : { t: 'place', cell: v.handCell };
}

/**
 * Book the review and return the action, so every policy counts analyses the same way.
 * @param {GameState} s
 * @param {Memory} mem
 * @param {number} cell
 * @returns {Action}
 */
function review(s, mem, cell) {
  const block = /** @type {{ block: number }} */ (/** @type {unknown} */ (s.con[cell])).block;
  mem.analyzed.set(block, (mem.analyzed.get(block) ?? 0) + 1);
  mem.sinceAnalyze = 0;
  return { t: 'analyze', cell };
}

/**
 * @param {string} spec
 * @param {number} seed
 * @returns {Bot}
 */
export function makePolicy(spec, seed) {
  const text = String(spec);
  const [head, param] = text.split(':');
  let style = /** @type {'coverage' | 'edge'} */ ('coverage');
  let base = head;
  if (head.endsWith('-edge')) { style = 'edge'; base = head.slice(0, -'-edge'.length); }
  else if (head.endsWith('-greedy')) { style = 'coverage'; base = head.slice(0, -'-greedy'.length); }
  const p = param === undefined ? 0.5 : Number(param);
  if (!Number.isFinite(p) || p < 0 || p > 1) throw new Error(`policy '${text}': parameter must be in [0, 1]`);

  const rng = mulberry32(seed >>> 0);
  const mem = freshMemory();

  /** @param {GameState} s @returns {Action} */
  let decide;
  switch (base) {
    case 'handOnly':
      decide = (s) => {
        if (gateOpen(s)) return { t: 'wait' };
        return handStep(survey(s)) ?? { t: 'wait' };
      };
      break;
    case 'genRush':
      decide = (s) => {
        if (gateOpen(s)) return { t: 'wait' };
        const v = survey(s);
        bookProgress(mem, v.remaining);
        // It never reviews, so when §4.1 walls the last gap off it has no way to unlock it
        // and ends up hand-building a whole parallel route. That is the policy, not a bug.
        const finish = v.handOnRoute && v.remaining <= HAND_FINISH;
        if (!mem.refunded && !finish && mem.genStalls < 3) return { t: 'generate' };
        return handStep(v) ?? { t: 'wait' };
      };
      break;
    case 'balanced':
      decide = (s) => {
        if (gateOpen(s)) return { t: 'wait' };
        const v = survey(s);
        bookProgress(mem, v.remaining);
        // Cadence, but only against generations that admitted to defects. Reviewing clean
        // ground is a turn spent on nothing, and turns are the whole economy.
        if (mem.sinceAnalyze >= ANALYZE_EVERY) {
          for (const id of suspectBlocks(s, mem)) {
            const cell = analyzeTarget(s, id);
            if (cell >= 0) return review(s, mem, cell);
          }
        }
        mem.sinceAnalyze++;
        return dose(s, mem, v, rng() < p);
      };
      break;
    case 'careful':
      decide = (s) => {
        if (gateOpen(s)) return { t: 'wait' };
        const v = survey(s);
        bookProgress(mem, v.remaining);
        // Review every generation that admitted to defects before building past it.
        for (const id of suspectBlocks(s, mem)) {
          const cell = analyzeTarget(s, id);
          if (cell >= 0) return review(s, mem, cell);
        }
        return dose(s, mem, v, rng() < p);
      };
      break;
    default:
      throw new Error(`unknown policy '${text}' (have: ${POLICY_NAMES.join(', ')})`);
  }

  return {
    name: text,
    observe: (evs) => remember(mem, evs),
    act: (s) => {
      if (s.phase.k === 'placing') {
        const g = chooseGhost(s, style);
        return { t: 'placeBlock', cell: g.cell, rot: g.rot };
      }
      const action = decide(s);
      // A bot that asks for something illegal has a bug; waiting keeps the batch honest
      // rather than deadlocking on it, and batch.js counts the rejection.
      const cell = /** @type {{ cell?: number }} */ (action).cell;
      const kinds = cell === undefined ? legalActions(s) : legalActions(s, cell);
      return kinds.includes(action.t) ? action : { t: 'wait' };
    },
  };
}

export const POLICY_NAMES = ['handOnly', 'genRush', 'balanced', 'careful'];

/** The sweep `--all` runs, chosen so each PLAN §13 gate has a column that measures it. */
export const DEFAULT_SWEEP = [
  'handOnly',
  'genRush',
  'balanced:0.4',
  'balanced:0.7',
  'balanced-edge:0.4',
  'careful:0.4',
];
