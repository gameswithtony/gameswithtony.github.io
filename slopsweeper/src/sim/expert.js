// @ts-check
// The EXPERT bot (2026-11-02). The four original policies never flag, so every number they
// print is a floor, and a floor cannot answer the questions level design actually asks: does
// this level need a beta, do the opening placements matter, is level 7 harder than level 6.
// Those need a ceiling-ish player, and this is it.
//
// What it does that the others do not:
//
//   · **Reads the board like a minesweeper player.** `mineOdds` turns every visible clue and
//     every block's live defect badge into a per-tile mine probability (exact enumeration over
//     the clue frontier, combinatorial weights for the unread interior). Proven defects get
//     flagged for free; proven-safe tiles are probed at no risk.
//   · **Protects walkers, not blocks.** Unread slop costs nothing until a user is about to stand
//     on it. The bot computes where each walker can step next (`walkRisk`) and spends turns on
//     review only for tiles a walker will reach in the next couple of steps, or that the turn's
//     own build would expose.
//   · **Builds toward demand.** The next destination is chosen by who is waiting for it and who
//     is about to arrive (the cast is public: the HUD forecasts it), divided by build cost.
//   · **Ships betas.** When users are stuck and the network already reaches well toward their
//     stop, it stages them at the farthest legal cell.
//
// INFORMATION DISCIPLINE is the same as policies.js: everything read here is on screen. Mines
// are only ever read through `clue()` (the digits) and `blockMines()` (the badge the renderer
// draws on every block). No `.mine`. test/sim.test.js greps this file too.

import { n4, n8 } from '../core/grid.js';
import { betaRejection, blastArea, blockMines, clue, placeRejection } from '../core/reduce.js';
import { effectiveMask, isEndpoint, isHandBuildable, levelParams, patienceLimit } from '../core/state.js';
import { canProgress, compositePotential, passable, pathComplete, waypointFields } from '../core/routing.js';
import { legalPlacements, placementCells } from '../core/generate.js';
import { resolvePool } from '../core/shapes.js';
import { anchorCounts, buildCost } from './policies.js';

/** @typedef {import('../core/state.js').GameState} GameState */
/** @typedef {import('../core/state.js').Action} Action */
/** @typedef {import('../core/state.js').Ev} Ev */
/** @typedef {import('./policies.js').Bot} Bot */

const INF = 0x3fffffff;
const EPS = 1e-9;
/** Enumeration budget per frontier group before falling back to block density. */
const NODE_BUDGET = 60_000;
/** Below this many tiles left to build, finish by hand (see policies.js HAND_FINISH). */
const HAND_FINISH = 2;

/**
 * @typedef {object} ExpertOpts
 * @property {number} urgent     a risky tile this many steps ahead of a walker gets handled now
 * @property {number} flagAt     flag a risky tile at or above this probability instead of probing
 * @property {number} betaGain   minimum steps of progress a beta must buy a stuck user
 * @property {number} scatter    the first N blocks are placed at a random legal anchor
 * @property {number} slack      ghost may give up this much route progress for legibility
 * @property {boolean} betas     ship betas at all
 * @property {number} sloppy    chance per turn of not looking: no flags, no protecting walkers
 * @property {number} handProbe  probe a doubtful tile with a hand tile beside it from this odds up
 * @property {boolean} [holds]   flag doubtful tiles in front of walkers while reading one;
 *                               undefined means only where blasts spread
 */

/** @type {ExpertOpts} */
export const EXPERT_DEFAULTS = Object.freeze({
  urgent: 2, flagAt: 0.4, betaGain: 4, scatter: 0, slack: 1, betas: true, sloppy: 0, handProbe: -1, holds: undefined,
});

// --- the odds ---------------------------------------------------------------------------

/**
 * @param {GameState} s
 * @param {number} i
 */
function showsClue(s, i) {
  if (isEndpoint(s, i)) return false;
  const k = s.con[i].k;
  return k === 'aiRevealed' || k === 'hand' || k === 'beta';
}

const BINOM = (() => {
  const t = [];
  for (let n = 0; n <= 64; n++) {
    t[n] = [1];
    for (let k = 1; k <= n; k++) t[n][k] = (t[n - 1][k - 1] ?? 0) + (t[n - 1][k] ?? 0);
  }
  return t;
})();
/** @param {number} n @param {number} k */
const binom = (n, k) => (k < 0 || k > n ? 0 : (BINOM[n]?.[k] ?? 0));

/**
 * Per-tile mine probability for every `aiHidden` tile; -1 elsewhere. Exact wherever the
 * frontier group fits the budget: clue constraints are enumerated, each block's unread interior
 * is counted combinatorially, and every assignment is weighted by how many interiors complete it.
 * @param {GameState} s
 * @returns {Float64Array}
 */
export function mineOdds(s) {
  const n = s.con.length;
  const p = new Float64Array(n).fill(-1);

  /** @type {Map<number, { cells: number[], rem: number }>} */
  const blocks = new Map();
  /** @type {Int32Array} */
  const blockOf = new Int32Array(n).fill(-1);
  for (const b of s.blocks) {
    const cells = b.cells.filter((c) => s.con[c].k === 'aiHidden');
    if (!cells.length) continue;
    blocks.set(b.id, { cells, rem: blockMines(s, b.id) });
    for (const c of cells) blockOf[c] = b.id;
  }

  /** @type {{ cells: number[], k: number }[]} */
  const cons = [];
  const isFront = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (!showsClue(s, i)) continue;
    const cells = n8(s, i).filter((j) => s.con[j].k === 'aiHidden');
    if (!cells.length) continue;
    cons.push({ cells, k: clue(s, i).lo });
    for (const c of cells) isFront[c] = 1;
  }

  // Groups: frontier tiles joined by a shared clue or a shared block (the badge couples a
  // block's whole frontier).
  const parent = new Int32Array(n).map((_, i) => i);
  /** @param {number} i */
  const find = (i) => { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
  /** @param {number} a @param {number} b */
  const union = (a, b) => { const x = find(a), y = find(b); if (x !== y) parent[x] = y; };
  for (const c of cons) for (let k = 1; k < c.cells.length; k++) union(c.cells[0], c.cells[k]);
  for (const b of blocks.values()) {
    const f = b.cells.filter((c) => isFront[c]);
    for (let k = 1; k < f.length; k++) union(f[0], f[k]);
  }

  /** @type {Map<number, number[]>} */
  const groups = new Map();
  for (let i = 0; i < n; i++) {
    if (!isFront[i]) continue;
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    /** @type {number[]} */ (groups.get(r)).push(i);
  }

  /** @type {Set<number>} blocks whose odds a group has already written */
  const solved = new Set();
  for (const vars of groups.values()) {
    const ok = solveGroup(s, vars, cons, blocks, blockOf, isFront, p);
    const touched = new Set(vars.map((c) => blockOf[c]));
    if (ok) { for (const b of touched) solved.add(b); continue; }
    // Over budget: fall back to the trivially certain clues and block density.
    for (const c of vars) p[c] = densityOf(blocks, blockOf[c]);
    for (const c of cons) {
      if (c.k === 0) for (const x of c.cells) p[x] = 0;
      else if (c.k === c.cells.length) for (const x of c.cells) p[x] = 1;
    }
    for (const b of touched) solved.add(b);
  }

  for (const [id, b] of blocks) {
    if (solved.has(id)) continue;
    const d = b.cells.length ? b.rem / b.cells.length : 0;
    for (const c of b.cells) p[c] = d;
  }
  return p;
}

/**
 * @param {Map<number, { cells: number[], rem: number }>} blocks
 * @param {number} id
 */
function densityOf(blocks, id) {
  const b = blocks.get(id);
  return b && b.cells.length ? b.rem / b.cells.length : 0;
}

/**
 * Enumerate one frontier group, writing odds for its frontier and its blocks' interiors.
 * @returns {boolean} false when the budget ran out
 */
function solveGroup(s, vars, cons, blocks, blockOf, isFront, p) {
  // Order variables by BFS over shared constraints so pruning bites early.
  const inGroup = new Set(vars);
  const myCons = cons.filter((c) => inGroup.has(c.cells[0]));
  /** @type {Map<number, number[]>} */
  const consOf = new Map(vars.map((v) => [v, []]));
  myCons.forEach((c, ci) => c.cells.forEach((x) => /** @type {number[]} */ (consOf.get(x)).push(ci)));
  /** @type {number[]} */
  const order = [];
  const seen = new Set();
  for (const start of vars) {
    if (seen.has(start)) continue;
    seen.add(start);
    const q = [start];
    while (q.length) {
      const v = /** @type {number} */ (q.shift());
      order.push(v);
      for (const ci of /** @type {number[]} */ (consOf.get(v))) {
        for (const x of myCons[ci].cells) if (!seen.has(x)) { seen.add(x); q.push(x); }
      }
    }
  }

  const blockIds = [...new Set(order.map((v) => blockOf[v]))];
  const bSlot = new Map(blockIds.map((b, i) => [b, i]));
  const interior = blockIds.map((b) => (blocks.get(b)?.cells ?? []).filter((c) => !isFront[c]).length);
  const remB = blockIds.map((b) => blocks.get(b)?.rem ?? 0);
  const frontLeftB = blockIds.map(() => 0);
  for (const v of order) frontLeftB[/** @type {number} */ (bSlot.get(blockOf[v]))]++;

  const N = order.length;
  const slotB = order.map((v) => /** @type {number} */ (bSlot.get(blockOf[v])));
  const touch = order.map((v) => /** @type {number[]} */ (consOf.get(v)));
  const sum = new Int32Array(myCons.length);
  const left = Int32Array.from(myCons.map((c) => c.cells.length));
  const mB = new Int32Array(blockIds.length);
  const assign = new Uint8Array(N);
  const wMine = new Float64Array(N);
  const wInt = new Float64Array(blockIds.length);
  let W = 0;
  let nodes = 0;
  let bailed = false;

  /** @param {number} i */
  function step(i) {
    if (bailed) return;
    if (++nodes > NODE_BUDGET) { bailed = true; return; }
    if (i === N) {
      let w = 1;
      for (let b = 0; b < blockIds.length; b++) w *= binom(interior[b], remB[b] - mB[b]);
      if (w === 0) return;
      W += w;
      for (let k = 0; k < N; k++) if (assign[k]) wMine[k] += w;
      for (let b = 0; b < blockIds.length; b++) {
        if (interior[b]) wInt[b] += w * (remB[b] - mB[b]) / interior[b];
      }
      return;
    }
    const b = slotB[i];
    for (let v = 0; v <= 1; v++) {
      assign[i] = v;
      mB[b] += v;
      frontLeftB[b]--;
      let ok = mB[b] <= remB[b] && mB[b] + frontLeftB[b] + interior[b] >= remB[b];
      for (const ci of touch[i]) {
        sum[ci] += v;
        left[ci]--;
        if (sum[ci] > myCons[ci].k || sum[ci] + left[ci] < myCons[ci].k) ok = false;
      }
      if (ok) step(i + 1);
      for (const ci of touch[i]) { sum[ci] -= v; left[ci]++; }
      mB[b] -= v;
      frontLeftB[b]++;
      if (bailed) return;
    }
  }
  step(0);
  if (bailed || W === 0) return false;

  for (let k = 0; k < N; k++) p[order[k]] = wMine[k] / W;
  blockIds.forEach((b, bi) => {
    for (const c of blocks.get(b)?.cells ?? []) if (!isFront[c]) p[c] = wInt[bi] / W;
  });
  return true;
}

// --- where walkers are about to step ------------------------------------------------------

/**
 * Every hidden tile some walker can reach by strictly-descending steps of its own field, with
 * the fewest steps it would take to get there. Queued users count only when their gate is open:
 * they depart and step on the same tick.
 * @param {GameState} s
 * @returns {Map<number, number>} cell → eta (1 = the next tick's step)
 */
export function walkRisk(s) {
  /** @type {Map<number, number>} */
  const out = new Map();
  const fields = waypointFields(s);
  for (const u of s.users) {
    if (u.state !== 'queued' && u.state !== 'moving') continue;
    const wf = fields.for(effectiveMask(u));
    const dist = wf.dist;
    if (dist[u.at] <= 0 || !canProgress(s, wf, u.at)) continue;
    // Descend the field; eta is steps taken.
    /** @type {Map<number, number>} */
    const eta = new Map([[u.at, 0]]);
    let frontier = [u.at];
    for (let d = 1; frontier.length && d <= 40; d++) {
      /** @type {number[]} */
      const next = [];
      for (const c of frontier) {
        for (const j of n4(s, c)) {
          if (dist[j] < 0 || dist[j] >= dist[c] || eta.has(j)) continue;
          eta.set(j, d);
          next.push(j);
        }
      }
      frontier = next;
    }
    for (const [c, d] of eta) {
      if (d === 0 || s.con[c].k !== 'aiHidden') continue;
      if (!out.has(c) || /** @type {number} */ (out.get(c)) > d) out.set(c, d);
    }
  }
  return out;
}

// --- building ---------------------------------------------------------------------------

/**
 * Which unconnected destination to build toward: demand over cost. Demand is everyone alive
 * whose next obligation includes it (stuck users count double) plus a half share for each
 * walker still to arrive, whose itinerary the forecast already shows.
 * @param {GameState} s
 * @param {Int32Array} fromOrigin
 * @returns {number} a destination cell, or -1 when every destination is connected
 */
export function demandDest(s, fromOrigin) {
  const demand = demandOf(s);
  let best = -1;
  let bestScore = -1;
  s.dests.forEach((d, di) => {
    const cost = fromOrigin[d];
    if (cost <= 0 || cost >= INF) return;
    const score = (demand[di] + 0.01) / cost;
    if (score > bestScore) { bestScore = score; best = d; }
  });
  return best;
}

/**
 * Who needs each destination: everyone alive whose next obligation includes it (stuck users
 * count double) plus a half share for each walker still to arrive, whose itinerary the
 * forecast already shows.
 * @param {GameState} s
 * @returns {Float64Array} indexed like `s.dests`
 */
function demandOf(s) {
  const demand = new Float64Array(s.dests.length);
  for (const u of s.users) {
    if (u.state !== 'queued' && u.state !== 'moving') continue;
    const w = u.state === 'queued' || u.stalled ? 2 : 1;
    for (const di of effectiveMask(u)) demand[di] += w;
  }
  const { cast } = levelParams(s);
  for (let k = s.users.length; k < (cast?.length ?? 0); k++) {
    const e = cast[k];
    const stops = e.ordered ? [e.stops[0]] : e.stops;
    for (const ch of stops) demand[ch.charCodeAt(0) - 66] += 0.5;
  }
  return demand;
}

/**
 * The legal hand tile on the cheapest completion toward `dest`, and how much is left.
 * @param {GameState} s
 * @param {number} dest
 */
function planToward(s, dest) {
  const fromOrigin = buildCost(s, s.origin);
  const toDest = buildCost(s, dest);
  const remaining = toDest[s.origin];
  let handCell = -1;
  let best = INF;
  for (let i = 0; i < s.con.length; i++) {
    if (toDest[i] >= INF || fromOrigin[i] >= INF) continue;
    const cost = toDest[i] + fromOrigin[i];
    if (cost >= best || placeRejection(s, i)) continue;
    best = cost;
    handCell = i;
  }
  return { remaining, handCell, fromOrigin, toDest };
}

/**
 * @typedef {object} Goal   one destination a block could help toward
 * @property {number} remaining   tiles left to connect it
 * @property {Int32Array} toDest  build cost from each cell to it
 * @property {number} bonus       0 for the current target, -1 for the others
 */

/**
 * The goals a block is scored against: the target first, then every other destination users
 * still need. A shape that does not fit toward the target can still be worth its turn on
 * another branch, which is how a player uses a draw they did not ask for.
 * @param {GameState} s
 * @param {Int32Array} fromOrigin
 * @param {number} target
 * @returns {Goal[]}
 */
function goalsFor(s, fromOrigin, target) {
  const demand = demandOf(s);
  /** @type {Goal[]} */
  const out = [];
  s.dests.forEach((d, di) => {
    if (fromOrigin[d] <= 0 || fromOrigin[d] >= INF) return;
    if (d !== target && demand[di] <= 0) return;
    const toDest = buildCost(s, d);
    out.push({ remaining: toDest[s.origin], toDest, bonus: d === target ? 0 : -1 });
  });
  return out;
}

/**
 * Best route tiles one placement saves, over every goal.
 * @param {number[]} cells
 * @param {Int32Array} fromOrigin
 * @param {Goal[]} goals
 */
function placementGain(cells, fromOrigin, goals) {
  let near = INF;
  for (const c of cells) if (fromOrigin[c] < near) near = fromOrigin[c];
  if (near >= INF) return -INF;
  let best = -INF;
  for (const g of goals) {
    let far = INF;
    for (const c of cells) if (g.toDest[c] < far) far = g.toDest[c];
    if (far >= INF) continue;
    const gain = g.remaining - (near + far) + g.bonus;
    if (gain > best) best = gain;
  }
  return best;
}

/**
 * Is a Generate worth a turn here? The draw is random, so the question is about the pool:
 * the mean, over shapes that fit somewhere, of the best route tiles one placement saves on any
 * branch users need. A narrow passage no block can enter reads low, and the bot builds by hand.
 * @param {GameState} s
 * @param {Int32Array} fromOrigin
 * @param {Goal[]} goals
 */
function genGain(s, fromOrigin, goals) {
  let sum = 0;
  let fits = 0;
  for (const shape of resolvePool(levelParams(s).shapePool)) {
    let best = -1;
    for (const r of legalPlacements(s, shape)) {
      for (const a of r.anchors) {
        const cells = placementCells(s, a, r.cells);
        if (!cells) continue;
        const gain = placementGain(cells, fromOrigin, goals);
        if (gain > best) best = gain;
      }
    }
    if (best < 0) continue;
    fits++;
    sum += best;
  }
  return fits ? sum / fits : 0;
}

/**
 * Ghost placement: the most route saved on any branch users need (the target wins ties),
 * within `slack` of the best; then not beside somebody standing and waiting (a block that
 * opens their route would be the first thing they step on), then ground users can already
 * reach, then legibility.
 * @param {GameState} s
 * @param {number} target
 * @param {number} slack
 * @param {() => number} rng
 * @param {boolean} scatter
 */
function chooseGhostToward(s, target, slack, rng, scatter) {
  if (s.phase.k !== 'placing') throw new Error('not placing');
  const fromOrigin = buildCost(s, s.origin);
  const goals = goalsFor(s, fromOrigin, target);
  const anchors = anchorCounts(s);
  const standing = new Set();
  for (const u of s.users) {
    if (u.state === 'queued' || (u.state === 'moving' && u.stalled)) standing.add(u.at);
  }
  const walkable = new Set(component(s, s.origin));
  /** @type {{ cell: number, rot: 0|1|2|3, gain: number, legible: number, near: number, attached: number }[]} */
  const cand = [];
  let maxGain = -INF;
  for (const r of s.phase.rots) {
    for (const a of r.anchors) {
      const cells = placementCells(s, a, r.cells);
      if (!cells) continue;
      let legible = 0, touch = 0, attached = 1;
      for (const c of cells) {
        legible += anchors[c];
        if (standing.size) for (const j of n4(s, c)) if (standing.has(j)) touch = 1;
        if (attached) for (const j of n4(s, c)) if (walkable.has(j)) attached = 0;
      }
      const gain = goals.length ? placementGain(cells, fromOrigin, goals) : 0;
      if (gain > maxGain) maxGain = gain;
      cand.push({ cell: a, rot: r.rot, gain, legible, near: touch, attached });
    }
  }
  if (scatter) {
    const c = cand[Math.floor(rng() * cand.length)];
    return { cell: c.cell, rot: c.rot };
  }
  let best = cand[0];
  /** @type {number[]} */
  let bestKey = [INF];
  for (const c of cand) {
    const key = [c.gain >= maxGain - slack ? 0 : 1, c.near, c.attached, -c.gain, -c.legible, c.cell * 4 + c.rot];
    if (less(key, bestKey)) { bestKey = key; best = c; }
  }
  return { cell: best.cell, rot: best.rot };
}

/** @param {number[]} a @param {number[]} b */
function less(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] ?? -INF, y = b[i] ?? -INF;
    if (x !== y) return x < y;
  }
  return false;
}

/**
 * Cells of the passable component containing `from`.
 * @param {GameState} s
 * @param {number} from
 */
function component(s, from) {
  const seen = new Uint8Array(s.con.length);
  seen[from] = 1;
  const out = [from];
  for (let k = 0; k < out.length; k++) {
    for (const j of n4(s, out[k])) {
      if (seen[j] || !passable(s, j)) continue;
      seen[j] = 1;
      out.push(j);
    }
  }
  return out;
}

/**
 * Where a beta would do the most good right now, if anywhere. Gain is measured in potential
 * (steps toward the user's next stop over ever-buildable ground), summed over stuck users.
 * @param {GameState} s
 * @param {number} minGain
 * @returns {Action | null}
 */
function betaMove(s, minGain) {
  const p = levelParams(s);
  if (p.betaSupply - s.stats.betas <= 0) return null;
  const fields = waypointFields(s);
  /** @type {{ at: number, pot: Int32Array | number[], mask: number[] }[]} */
  const stuck = [];
  for (const u of s.users) {
    const waiting = u.state === 'queued' || (u.state === 'moving' && u.stalled);
    if (!waiting) continue;
    const mask = effectiveMask(u);
    const wf = fields.for(mask);
    if (wf.dist[u.at] > 0 && canProgress(s, wf, u.at)) continue;   // about to walk anyway
    // A user near the end of its rope cannot be saved by staging; skip it.
    if (u.waited >= patienceLimit(s, u) - 1) continue;
    stuck.push({ at: u.at, pot: compositePotential(s, mask), mask });
  }
  // About to arrive with no route: stage them before they start burning patience.
  if (!stuck.length && s.schedule.spawned < s.schedule.total && s.schedule.nextTick - s.tick <= 1) {
    const e = p.cast?.[s.users.length];
    const mask = e ? (e.ordered ? [e.stops[0].charCodeAt(0) - 66] : e.stops.map((c) => c.charCodeAt(0) - 66).sort((a, b) => a - b))
      : s.dests.map((_, i) => i);
    stuck.push({ at: s.origin, pot: compositePotential(s, mask), mask });
  }
  if (!stuck.length) return null;

  /** @type {Map<number, number>} candidate → summed gain */
  const gain = new Map();
  const comps = new Map();
  // A beta two tiles from a destination is a wasted beta: closing the route costs the same.
  /** @type {Map<number, Int32Array>} */
  const toDest = new Map();
  for (const d of s.dests) toDest.set(d, buildCost(s, d));
  /** @param {number} j @param {number[]} mask */
  const nearlyThere = (j, mask) => mask.some((di) => /** @type {Int32Array} */ (toDest.get(s.dests[di]))[j] <= 3);
  for (const st of stuck) {
    if (!comps.has(st.at)) comps.set(st.at, component(s, st.at));
    // Measure from the best waypoint this user can already reach, not from where it stands:
    // a second beta beside the first buys nothing.
    let here = st.pot[st.at];
    for (const c of comps.get(st.at)) {
      if (s.con[c].k === 'beta' && st.pot[c] >= 0 && st.pot[c] < here) here = st.pot[c];
    }
    for (const c of comps.get(st.at)) {
      for (const j of n4(s, c)) {
        if (gain.has(j) && gain.get(j) === -1) continue;
        if (betaRejection(s, j)) { gain.set(j, -1); continue; }
        const g = st.pot[j] >= 0 && here >= 0 && !nearlyThere(j, st.mask) ? here - st.pot[j] : 0;
        if (g > 0) gain.set(j, (gain.get(j) ?? 0) + g);
      }
    }
  }
  let best = -1;
  let bestG = 0;
  for (const [c, g] of gain) if (g > bestG || (g === bestG && c < best)) { bestG = g; best = c; }
  if (best < 0) return null;
  // Spend a beta early only if somebody is about to quit; otherwise hold it until it buys a
  // fair share of the remaining walk, so a single beta is not wasted two tiles from the door.
  const left = p.betaSupply - s.stats.betas;
  const far = Math.max(...stuck.map((st) => st.pot[st.at]));
  const desperate = s.users.some((u) => (u.state === 'queued' || (u.state === 'moving' && u.stalled))
    && patienceLimit(s, u) - u.waited <= 2);
  const want = desperate ? minGain : Math.max(minGain, Math.floor(far / (left + 1)));
  if (bestG / stuck.length < want) return null;
  return { t: 'beta', cell: best };
}

/**
 * When flags seal every unconnected destination off, the flagged tile on the cheapest way
 * through (a flagged tile costs two turns: blow it up, build over it), nearest the origin.
 * @param {GameState} s
 * @returns {number} a flagged cell, or -1
 */
function sealingFlag(s) {
  /** @param {number} source */
  const cost = (source) => {
    const out = new Int32Array(s.w * s.h).fill(INF);
    /** @type {number[][]} */
    const buckets = [[source]];
    out[source] = 0;
    for (let d = 0; d < buckets.length; d++) {
      for (const i of buckets[d] ?? []) {
        if (out[i] !== d) continue;
        for (const j of n4(s, i)) {
          const con = s.con[j];
          const flagged = con.k === 'aiHidden' && con.flagged;
          const st = passable(s, j) ? 0 : flagged ? 2 : placeRejectionLike(s, j) ? -1 : 1;
          if (st < 0) continue;
          const nd = d + st;
          if (nd >= out[j]) continue;
          out[j] = nd;
          (buckets[nd] ??= []).push(j);
        }
      }
    }
    return out;
  };
  const fromA = cost(s.origin);
  let best = -1;
  let bestKey = INF;
  for (const d of s.dests) {
    if (fromA[d] <= 0 || fromA[d] >= INF) continue;
    const toD = cost(d);
    for (let i = 0; i < s.con.length; i++) {
      const con = s.con[i];
      if (con.k !== 'aiHidden' || !con.flagged) continue;
      if (fromA[i] + toD[i] - 2 > fromA[d]) continue;
      const key = fromA[d] * 1000 + fromA[i];
      if (key < bestKey) { bestKey = key; best = i; }
    }
  }
  return best;
}

/**
 * Could a hand tile ever stand here (ignoring adjacency)? Ocean-class terrain, nothing built.
 * @param {GameState} s
 * @param {number} j
 * @returns {boolean} true when it could NOT
 */
function placeRejectionLike(s, j) {
  return isEndpoint(s, j) || s.con[j].k !== 'none' || !isHandBuildable(s.terrain[j], s.con[j]);
}

/**
 * A walker stalled somewhere that is not a beta has had its road cut, by a flag or a crater.
 * Hand-build the cheapest bypass from where it stands toward its next stop, if one is short.
 * @param {GameState} s
 * @returns {Action | null}
 */
function rescue(s) {
  const fields = waypointFields(s);
  /** @type {number[]} */
  const betas = [];
  for (let i = 0; i < s.con.length; i++) if (s.con[i].k === 'beta') betas.push(i);
  let best = -1;
  let bestKey = INF;
  /** @type {Map<number, Int32Array>} */
  const costTo = new Map();
  /** @param {number} c */
  const toCell = (c) => { if (!costTo.has(c)) costTo.set(c, buildCost(s, c)); return /** @type {Int32Array} */ (costTo.get(c)); };
  for (const u of s.users) {
    const waiting = u.state === 'queued' || (u.state === 'moving' && u.stalled);
    if (!waiting) continue;
    const mask = effectiveMask(u);
    const wf = fields.for(mask);
    if (wf.dist[u.at] > 0 && canProgress(s, wf, u.at)) continue;
    const pot = compositePotential(s, mask);
    const fromU = buildCost(s, u.at);
    const left = patienceLimit(s, u) - u.waited;
    // Waypoints ahead of this walker: betas closer to its stops, and the stops themselves.
    const ahead = [...betas.filter((b) => pot[b] >= 0 && pot[b] < pot[u.at]), ...mask.map((di) => s.dests[di])];
    for (const w of ahead) {
      const need = fromU[w];
      if (need <= 0 || need >= INF || need > 4) continue;
      const toW = toCell(w);
      for (let i = 0; i < s.con.length; i++) {
        if (fromU[i] >= INF || toW[i] >= INF || fromU[i] + toW[i] > need + 1) continue;
        if (placeRejection(s, i)) continue;
        const key = left * 100 + need * 10 + fromU[i];
        if (key < bestKey) { bestKey = key; best = i; }
      }
    }
  }
  return best < 0 ? null : { t: 'place', cell: best };
}

// --- the bot ----------------------------------------------------------------------------

/**
 * @param {Partial<ExpertOpts>} opts
 * @param {number} seed
 * @param {() => number} rng
 * @returns {Bot}
 */
export function makeExpert(opts, seed, rng) {
  const o = { ...EXPERT_DEFAULTS, ...opts };
  let blocksPlaced = 0;
  let refunded = false;
  let genStalls = 0;
  let lastRemaining = INF;
  /** @type {number} the destination this bot chose when it last generated */
  let target = -1;
  /** Flagged tiles the bot has decided to blow up because they seal the only way through. */
  const burn = new Set();
  /**
   * HOLD FLAGS. Flags are free, so a doubtful tile a walker would step on next turn, and that
   * this turn's action cannot resolve, gets a flag: the crowd stops or reroutes instead of
   * walking into it. A hold stays until nobody is near it or the bot resolves it on purpose
   * (`resolving`): lifting and replacing flags every turn would move the walking field under the
   * crowd each tick and send it wandering.
   */
  const holds = new Set();
  /** The held tile being resolved this turn: unflagged, and next in line for a click. */
  let resolving = -1;

  /**
   * Handle the riskiest tile in `risk` (ascending eta). Returns an action, or null if nothing
   * there needs a turn.
   * @param {GameState} s
   * @param {Float64Array} odds
   * @param {Map<number, number>} risk
   * @param {number} horizon
   * @returns {Action | null}
   */
  function protect(s, odds, risk, horizon) {
    if (resolving >= 0) {
      const c = resolving;
      const con = s.con[c];
      resolving = -1;
      if (con.k === 'aiHidden' && !con.flagged && odds[c] > EPS) return { t: 'analyze', cell: c };
    }
    const danger = [...risk].filter(([c, d]) => d <= horizon && odds[c] > EPS)
      .sort((a, b) => a[1] - b[1] || odds[a[0]] - odds[b[0]] || a[0] - b[0]);
    if (!danger.some(([, d]) => d <= Math.min(horizon, o.urgent)) && holds.size) {
      // Nothing urgent on open ground: resolve a hold, so the crowd can move again.
      const [c] = [...holds].sort((a, b) => odds[a] - odds[b]);
      for (const j of n8(s, c)) {
        const con = s.con[j];
        if (con.k === 'aiHidden' && !con.flagged && odds[j] <= EPS) return { t: 'analyze', cell: j };
      }
      const standing = s.users.filter((u) => u.state === 'moving').map((u) => u.at);
      if (!blastArea(s, c).some((x) => x !== c && standing.includes(x))) {
        holds.delete(c);
        resolving = c;
        return { t: 'flag', cell: c };
      }
    }
    if (!danger.length) return null;
    const standing = new Set(s.users.filter((u) => u.state === 'moving').map((u) => u.at));
    for (const [c] of danger) {
      const con = s.con[c];
      if (con.k !== 'aiHidden' || con.flagged || burn.has(c)) continue;
      if (odds[c] >= o.flagAt) return { t: 'flag', cell: c };
    }
    const [c] = danger[0];
    // A free look first: a proven-safe hidden tile touching the danger reads it for nothing.
    let probe = -1;
    let probeScore = -1;
    for (const j of n8(s, c)) {
      const con = s.con[j];
      if (con.k !== 'aiHidden' || con.flagged || odds[j] > EPS) continue;
      const score = n8(s, j).filter((x) => s.con[x].k === 'aiHidden').length;
      if (score > probeScore) { probeScore = score; probe = j; }
    }
    if (probe >= 0) return hold(s, odds, danger, -1) ?? { t: 'analyze', cell: probe };
    // The owner's trick: build a hand tile beside the doubtful tile. It is safe, it shows the
    // defect count around it, and it is road. Worth it whenever the click is a real gamble.
    // Default (-1): probe by hand only where blasts spread; a radius-0 click costs one tile.
    const probeAt = o.handProbe >= 0 ? o.handProbe : (levelParams(s).blastRadius > 0 ? 0.15 : 2);
    if (odds[c] >= probeAt) {
      let hp = -1;
      let hpScore = -1;
      for (const j of n8(s, c)) {
        if (placeRejection(s, j)) continue;
        const score = n8(s, j).filter((x) => s.con[x].k === 'aiHidden' && odds[x] > EPS && odds[x] < 1 - EPS).length;
        if (score > hpScore) { hpScore = score; hp = j; }
      }
      if (hp >= 0) return hold(s, odds, danger, -1) ?? { t: 'place', cell: hp };
    }
    // Otherwise click it, unless the blast would take a walker with it — then flag it.
    const hits = blastArea(s, c).some((x) => standing.has(x) && x !== c);
    if (hits) return { t: 'flag', cell: c };
    return hold(s, odds, danger, c) ?? { t: 'analyze', cell: c };
  }

  /**
   * Before spending the turn on `chosen` (-1 when the turn reads a neighbour instead of the
   * tile itself), hold every other doubtful tile a walker reaches next.
   * @param {GameState} s
   * @param {Float64Array} odds
   * @param {[number, number][]} danger
   * @param {number} chosen
   * @returns {Action | null}
   */
  function hold(s, odds, danger, chosen) {
    // Default: hold only where a blast spreads. At radius 0 a held crowd loses more patience
    // than the one walker a missed defect would cost.
    if (!(o.holds ?? levelParams(s).blastRadius > 0)) return null;
    for (const [c, d] of danger) {
      if (d > 1 || c === chosen || c === resolving || odds[c] < 0.02) continue;
      const con = s.con[c];
      if (con.k !== 'aiHidden' || con.flagged || burn.has(c)) continue;
      holds.add(c);
      return { t: 'flag', cell: c };
    }
    return null;
  }

  /** @param {GameState} s @returns {Action} */
  function play(s) {
    // Lift holds nobody is near any more; forget ones the board already settled.
    for (const c of holds) {
      const con = s.con[c];
      if (con.k !== 'aiHidden' || !con.flagged) { holds.delete(c); continue; }
      const cx = c % s.w, cy = (c / s.w) | 0;
      const near = s.users.some((u) => (u.state === 'moving' || u.state === 'queued')
        && Math.abs((u.at % s.w) - cx) + Math.abs(((u.at / s.w) | 0) - cy) <= 3);
      if (!near) { holds.delete(c); return { t: 'flag', cell: c }; }
    }
    const odds = mineOdds(s);
    // The middling player: some turns it simply does not look before it builds.
    const looks = !(o.sloppy > 0 && rng() < o.sloppy);
    // Free bookkeeping: flag certainties, lift flags the board has disproved.
    for (let i = 0; looks && i < s.con.length; i++) {
      const con = s.con[i];
      if (con.k !== 'aiHidden') continue;
      if (!con.flagged && odds[i] >= 1 - EPS && !burn.has(i)) return { t: 'flag', cell: i };
      if (con.flagged && odds[i] <= EPS) return { t: 'flag', cell: i };
    }
    // Free look anywhere a walker is headed: proven-safe tiles on a live walk.
    const risk = walkRisk(s);
    const urgent = looks ? protect(s, odds, risk, o.urgent) : null;
    if (urgent) return urgent;

    if (o.betas) {
      const b = betaMove(s, o.betaGain);
      if (b) return b;
    }

    const r = rescue(s);
    if (r) return r;

    // Burn it down: a flagged tile that seals the only way through gets unflagged and clicked.
    // On a radius-0 level that turns a known defect into open water for one turn.
    for (const c of burn) {
      const con = s.con[c];
      if (con.k !== 'aiHidden') { burn.delete(c); continue; }
      return con.flagged ? { t: 'flag', cell: c } : { t: 'analyze', cell: c };
    }

    if (!pathComplete(s)) {
      const fromOrigin = buildCost(s, s.origin);
      const dest = demandDest(s, fromOrigin);
      if (dest < 0) {
        const f = sealingFlag(s);
        if (f >= 0) { burn.add(f); return { t: 'flag', cell: f }; }
      }
      if (dest >= 0) {
        target = dest;
        const plan = planToward(s, dest);
        genStalls = plan.remaining >= lastRemaining ? genStalls + 1 : 0;
        lastRemaining = plan.remaining;
        if (plan.remaining <= HAND_FINISH && plan.handCell >= 0) {
          // Closing a route: make sure the first steps it opens are not on a coin flip.
          const hyp = { ...s, con: s.con.slice() };
          hyp.con[plan.handCell] = { k: 'hand' };
          const pre = looks ? protect(s, odds, walkRiskHypo(hyp, s), 1) : null;
          if (pre) return pre;
          return { t: 'place', cell: plan.handCell };
        }
        if (!refunded && genStalls < 3 && genGain(s, plan.fromOrigin, goalsFor(s, plan.fromOrigin, dest)) >= 2) {
          return { t: 'generate' };
        }
        if (plan.handCell >= 0) return { t: 'place', cell: plan.handCell };
      }
    }
    // Nothing left to build: spend the turn reading whatever walkers will cross later.
    const later = protect(s, odds, risk, INF);
    return later ?? { t: 'wait' };
  }

  return {
    name: 'expert',
    observe(evs) {
      for (const e of evs) {
        if (e.t === 'generateRefunded') refunded = true;
        else if (e.t === 'placed' || e.t === 'detonate' || e.t === 'analyzed' || e.t === 'betaPlaced') refunded = false;
      }
    },
    act(s) {
      if (s.phase.k === 'placing') {
        const scatter = blocksPlaced < o.scatter;
        blocksPlaced++;
        const dest = target >= 0 ? target : s.dests[0];
        const g = chooseGhostToward(s, dest, o.slack, rng, scatter);
        return { t: 'placeBlock', cell: g.cell, rot: g.rot };
      }
      return play(s);
    },
  };
}

/**
 * walkRisk on a hypothetical board (one more hand tile), with queued users treated as departing.
 * Only the con array differs, so the field caches keyed on terrain stay valid.
 * @param {GameState} hyp
 * @param {GameState} _real
 */
function walkRiskHypo(hyp, _real) {
  return walkRisk(hyp);
}
