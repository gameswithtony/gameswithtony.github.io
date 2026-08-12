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
//
// SPEC NAMES: a spec is `base[-modifier…][:p]`. The base is one of POLICY_NAMES. The
// modifiers are order-free and compose:
//
//   -greedy  ghost placement maximises route progress (the default)
//   -edge    ghost placement gives up EDGE_SLACK turns of progress for legibility
//   -beta    ship beta milestones under pressure (2026-08-05) — see `betaMove`
//
// So `careful:0.4`, `balanced-edge:0.4`, `careful-beta:0.4` and `balanced-edge-beta:0.4` are
// all well-formed. `-beta` exists to answer one question and only that one: at what patience
// do betas stop being a nicety and start being necessary (SPEC §4.7)? The baseline sweep
// (DEFAULT_SWEEP) deliberately does not include it, so `--all` keeps measuring the game the
// corpus was tuned against.

import { mulberry32 } from '../core/rng.js';
import { everyDest, isHandBuildable, isKnownEmpty, levelParams } from '../core/state.js';
import { n4, n8 } from '../core/grid.js';
import { compositePotential, distField, passable, pathComplete } from '../core/routing.js';
import { betaRejection, clue, legalActions, placeRejection } from '../core/reduce.js';
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

/**
 * Safety net *and* the bots' budget discipline: turns are the whole economy, and a policy
 * that reads a block to the last cell has spent more than the block was worth. Four clicks
 * into fresh ground usually cascade most of a block open; past that the marginal tile costs
 * a full turn for one square of information.
 */
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
 * `handOnRoute` false means the cheapest hand tile on offer is not on a cheapest completion
 * — the frontier has nothing useful to build onto. *(Until 2026-08-04 this was the signature
 * of SPEC §4.1 biting: unreviewed slop was walkable but not buildable-from, so a block could
 * wall the frontier off and only a review could unlock it. The user decision that let hand
 * placement branch from any structure removed that failure mode entirely — slop is now
 * buildable-from — so this flag fires far more rarely, and when it does it means something
 * duller: void, volcano or already-built cells boxing the frontier in. The Analyze fallback
 * below is kept because the flag still exists, not because §4.1 still does.)*
 *
 * `plan` marks every cell lying on *some* cheapest completion — the corridor the bot intends
 * its users to walk. It is the answer to the question single-click Analyze made urgent:
 * *which* slop is worth a turn. Slop off the plan is scenery; slop on it is what a user is
 * about to stand on. Before the gate opens there is no live route to measure, so this is
 * built from build cost rather than from the distance field, and it is legal information —
 * it reads terrain, construction kinds and nothing else.
 *
 * *(Revised 2026-08-05 with itineraries: the survey is taken toward **one** destination at a
 * time — see `nextDest` — because "the cheapest completion" is only a number once there is a
 * single thing being completed. A bot therefore closes the routes one after another, in the
 * order the board makes cheapest, which is the least clever competent thing to do and is
 * deliberately no more than that: the harness measures levels, and a bot with opinions about
 * multi-destination strategy would be measuring its own.)*
 *
 * @param {GameState} s
 * @returns {{ remaining: number, handCell: number, handOnRoute: boolean, plan: Uint8Array }}
 */
export function survey(s) {
  const fromOrigin = buildCost(s, s.origin);
  const toDest = buildCost(s, nextDest(s, fromOrigin));
  const remaining = toDest[s.origin];
  let handCell = -1;
  let bestCost = INF;
  const plan = new Uint8Array(s.con.length);
  for (let i = 0; i < s.con.length; i++) {
    const cost = toDest[i] >= INF || fromOrigin[i] >= INF ? INF : toDest[i] + fromOrigin[i];
    if (cost <= remaining + 1) plan[i] = 1;
    if (cost >= bestCost) continue;
    if (placeRejection(s, i)) continue;
    bestCost = cost;
    handCell = i;
  }
  return { remaining, handCell, handOnRoute: handCell >= 0 && bestCost <= remaining + 1, plan };
}

/**
 * **The destination the bot is currently building toward** (added 2026-08-05 with itineraries).
 *
 * The nearest one it has not yet connected — nearest by build cost, so "nearest" means turns
 * of work rather than tiles of map — and when every destination is already connected, 'B', at
 * which point `survey` reports `remaining: 0` and the policies stop building. Ties break on
 * destination order, so the choice is a pure function of the board.
 *
 * On a one-destination level this is `s.dests[0]` unconditionally and every caller reads
 * exactly as it read before: connected or not, there is nowhere else to point.
 *
 * @param {GameState} s
 * @param {Int32Array} fromOrigin  build cost from the origin, which the caller already has
 * @returns {number} a cell in `s.dests`
 */
export function nextDest(s, fromOrigin) {
  let best = -1;
  let bestCost = INF;
  for (const d of s.dests) {
    const cost = fromOrigin[d];
    if (cost <= 0 || cost >= bestCost) continue;   // 0 = already connected, nothing left to do
    bestCost = cost;
    best = d;
  }
  return best < 0 ? s.dests[0] : best;
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
  const fromOrigin = buildCost(s, s.origin);
  const toDest = buildCost(s, nextDest(s, fromOrigin));
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
 * @property {boolean} refunded                the last Generate found nowhere to land — since
 *                                             2026-08-12 that means the *whole pool* fits
 *                                             nowhere, so backing off is even more right
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
    // Nothing on the frontier advances the route by hand (see `survey`). Dosage does not
    // apply: push on with generation, or spend a review, or place wherever is legal. Before
    // the 2026-08-04 §4.1 override this was the common case and it was slop's doing; now it
    // is the rare one, and terrain's.
    if (canGenerate && v.remaining > HAND_FINISH) return { t: 'generate' };
    const cell = analyzeTarget(s, null, v.plan);
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
      case 'placed': case 'detonate': case 'analyzed': case 'betaPlaced': mem.refunded = false; break;
      default: break;
    }
  }
}

/**
 * Blocks still worth reviewing: the toast said they carried defects, not all of them have
 * surfaced, and — the rule single-click Analyze forced — **the planned route runs through
 * the block**. Reading slop nobody will walk on used to be merely wasteful; at one turn per
 * tile it is how a policy loses. Everything read here is on screen.
 * @param {GameState} s
 * @param {Memory} mem
 * @param {Uint8Array} plan  cells on some cheapest completion (see survey)
 * @returns {number[]} block ids
 */
function suspectBlocks(s, mem, plan) {
  /** @type {number[]} */
  const out = [];
  for (const b of s.blocks) {
    const announced = mem.announced.get(b.id);
    if (announced === undefined || announced === 0) continue;
    if ((mem.analyzed.get(b.id) ?? 0) >= MAX_ANALYZES_PER_BLOCK) continue;
    let hidden = 0;
    let confirmed = 0;
    let onPlan = false;
    for (const c of b.cells) {
      if (s.con[c].k === 'aiHidden') { hidden++; if (plan[c]) onPlan = true; }
      else if (s.con[c].k === 'mineConfirmed') confirmed++;
    }
    if (onPlan && hidden > 0 && confirmed < announced) out.push(b.id);
  }
  return out;
}

/**
 * The tile to review. Analyze is one minesweeper click now (SPEC §4.3, revised
 * 2026-08-04), so the choice of *which* tile is the whole skill of the verb, and the bots
 * approximate what a competent player does:
 *
 * 1. **On the planned route first.** A tile users will never cross is not worth a turn.
 * 2. **Away from anything that says "mine".** A tile touching a confirmed mine, or touching
 *    a revealed tile whose clue is positive, is both likelier to kill the click and certain
 *    not to cascade — its own clue cannot be zero. Avoiding those is the single biggest
 *    difference between a good click and a bad one, and it is all legal information.
 * 3. **Deep in unread ground.** Among the tiles left, the one with the most hidden
 *    8-neighbours: the interior of a fresh block is where a zero pays off biggest.
 * 4. **Early in the trip.** Largest distance-to-destination among route tiles — a defect
 *    found near the origin costs a shorter re-walk than one found near B.
 *
 * Ties fall through to cell index, so the choice stays a pure function of the board.
 * Restricted to `block` when the caller has one in mind.
 *
 * The bots never flag. Flagging is free and purely defensive — it steers users away from a
 * tile a *human* suspects — and modelling that well needs the solver, which the information
 * discipline at the top of this file forbids. The sim therefore measures the game as played
 * by someone who never flags, which is the pessimistic end of the range.
 *
 * @param {GameState} s
 * @param {number | null} block
 * @param {Uint8Array} plan
 * @returns {number} cell index, or -1
 */
function analyzeTarget(s, block, plan) {
  const dist = distField(s);
  let best = -1;
  let bestKey = [INF, INF, INF, INF, INF];
  for (let i = 0; i < s.con.length; i++) {
    const con = s.con[i];
    if (con.k !== 'aiHidden' || con.flagged) continue;
    if (block !== null && con.block !== block) continue;
    let risky = 0;
    let unread = 0;
    for (const j of n8(s, i)) {
      const nb = s.con[j];
      if (nb.k === 'aiHidden') unread++;
      else if (nb.k === 'mineConfirmed') risky = 1;
      else if (nb.k === 'aiRevealed' && clue(s, j).hi > 0) risky = 1;
    }
    const onRoute = plan[i] ? 0 : 1;
    const key = [onRoute, risky, -unread, dist[i] >= 0 ? -dist[i] : 0, i];
    if (less(key, bestKey)) { bestKey = key; best = i; }
  }
  return best;
}

// --- the policies ---------------------------------------------------------------------

/**
 * The `-beta` modifier's whole decision (SPEC §4.7, added 2026-08-05).
 *
 * **When.** Somebody is suffering: a user that is queued or stalled has burnt half its
 * patience. Before that a beta is a wasted turn — the route is young and everyone is fresh —
 * and after the users are dead the supply is worth nothing. Half is the crudest reading of
 * "this is going badly and I still have time to act on it", which is what the modifier is
 * for; a human would read the board instead.
 *
 * **Where.** The legal beta cell closest to B by the potential field — the field that measures
 * route progress over ground that could ever be walked, which is exactly "how far along is
 * this". Ties by ascending index, so the choice is a pure function of the board. With several
 * destinations it is the composite over all of them (rev. 2026-08-05): the bot does not know
 * whose beta it is shipping, so it stages toward whichever destination is nearest, which is
 * the best a policy with no model of the itineraries can honestly do.
 *
 * All legal information: the supply and the patience limit are printed rules, the field is
 * terrain, and the waiting is on screen in the forecast (SPEC §6.1).
 *
 * @param {GameState} s
 * @returns {Action | null}
 */
function betaMove(s) {
  const { patience } = levelParams(s);
  const pressed = s.users.some(
    (u) => (u.state === 'queued' || (u.state === 'moving' && u.stalled)) && u.waited * 2 >= patience,
  );
  if (!pressed) return null;

  const pot = compositePotential(s, everyDest(s));
  let best = -1;
  let bestPot = INF;
  for (let i = 0; i < s.con.length; i++) {
    if (pot[i] < 0 || pot[i] >= bestPot) continue;
    if (betaRejection(s, i)) continue;
    bestPot = pot[i];
    best = i;
  }
  return best < 0 ? null : { t: 'beta', cell: best };
}

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
  let betas = false;
  let base = head;
  // Strip modifiers off the tail until none is left, so they compose in any order and a
  // future one is a case rather than a rewrite.
  for (let more = true; more;) {
    more = false;
    if (base.endsWith('-edge')) { style = 'edge'; base = base.slice(0, -'-edge'.length); more = true; }
    else if (base.endsWith('-greedy')) { style = 'coverage'; base = base.slice(0, -'-greedy'.length); more = true; }
    else if (base.endsWith('-beta')) { betas = true; base = base.slice(0, -'-beta'.length); more = true; }
  }
  const p = param === undefined ? 0.5 : Number(param);
  if (!Number.isFinite(p) || p < 0 || p > 1) throw new Error(`policy '${text}': parameter must be in [0, 1]`);

  const rng = mulberry32(seed >>> 0);
  const mem = freshMemory();

  // Every base opens with the same line: **build until the job is done, then wait**. It used
  // to read `gateOpen(s)` and now reads `pathComplete(s)` (rev. 2026-08-05). On one
  // destination those are the same question — the gate was topological and the job was one
  // route — and on several they are not: users can be walking to B while C is still open
  // water, and a bot that downed tools when *somebody* could move would abandon every
  // itinerary that named C. Only the arity-1 `gateOpen` moved meaning; this is the caller that
  // never wanted it.
  /** @param {GameState} s @returns {Action} */
  let decide;
  switch (base) {
    case 'handOnly':
      decide = (s) => {
        if (pathComplete(s)) return { t: 'wait' };
        return handStep(survey(s)) ?? { t: 'wait' };
      };
      break;
    case 'genRush':
      decide = (s) => {
        if (pathComplete(s)) return { t: 'wait' };
        const v = survey(s);
        bookProgress(mem, v.remaining);
        // It never reviews. Before the 2026-08-04 §4.1 override that meant a walled-off gap
        // sent it hand-building a whole parallel route; now it simply builds along the slop.
        const finish = v.handOnRoute && v.remaining <= HAND_FINISH;
        if (!mem.refunded && !finish && mem.genStalls < 3) return { t: 'generate' };
        return handStep(v) ?? { t: 'wait' };
      };
      break;
    case 'balanced':
      decide = (s) => {
        if (pathComplete(s)) return { t: 'wait' };
        const v = survey(s);
        bookProgress(mem, v.remaining);
        // Cadence, but only against generations that admitted to defects. Reviewing clean
        // ground is a turn spent on nothing, and turns are the whole economy.
        if (mem.sinceAnalyze >= ANALYZE_EVERY) {
          for (const id of suspectBlocks(s, mem, v.plan)) {
            const cell = analyzeTarget(s, id, v.plan);
            if (cell >= 0) return review(s, mem, cell);
          }
        }
        mem.sinceAnalyze++;
        return dose(s, mem, v, rng() < p);
      };
      break;
    case 'careful':
      decide = (s) => {
        if (pathComplete(s)) return { t: 'wait' };
        const v = survey(s);
        bookProgress(mem, v.remaining);
        // Review every generation that admitted to defects before building past it.
        for (const id of suspectBlocks(s, mem, v.plan)) {
          const cell = analyzeTarget(s, id, v.plan);
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
      // The beta call sits ahead of every base's own decision rather than inside them: it is
      // a response to the *users*, not to the build, so it should preempt whatever the base
      // was going to spend the turn on. Off unless the spec asked for it, which is what keeps
      // every baseline row identical to the one it printed before betas existed.
      const action = (betas ? betaMove(s) : null) ?? decide(s);
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
