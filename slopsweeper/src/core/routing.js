// @ts-check
// Passability, the distance fields, the departure gate and step choice (SPEC §6.2/§6.3).
// Every question here is answered by the capability tables in state.js — nothing in this
// file knows the name of a terrain feature or a construction state.
//
// Revised 2026-08-05 (user decision — beta blocks, SPEC §4.7/§6.2). Users no longer walk to
// B and only B: they walk to the nearest **waypoint**, and a waypoint is either B or a
// shipped beta. Three fields do the work and it is worth naming what each is for, because
// they answer three different questions:
//
//   distField      steps to B over ground that is passable *now* — the classic field, still
//                  exported under its own name and still what the old gate meant.
//   potentialField steps to B over ground that could EVER be passable. Terrain is fixed at
//                  load, so this never changes during a game: it is the level's opinion of
//                  "how far along the route is this cell", and it is the only honest way to
//                  ask whether one waypoint is *ahead of* another.
//   waypointField  steps to whatever waypoint the walker's own component owns, plus that
//                  waypoint's potential — which is what the progress guard compares against.
//
// With no beta on the board the only waypoint is B, every component that has a target has
// `targetPot` 0, and all three collapse back to "is there a complete path": the field equals
// `distField` and the guard is trivially true. That equivalence is the whole safety argument
// for the change, and `test/beta.test.js` asserts it directly rather than assuming it.

import { n4 } from './grid.js';
import { caps, isPassable } from './state.js';

/** @typedef {import('./state.js').GameState} GameState */
/** @typedef {import('./state.js').Terrain} Terrain */

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
 * Multi-source BFS: every seed starts at distance 0, so the result is a pure function of the
 * seed *set* and not of the order it was handed over; -1 where unreached. One private helper
 * behind all three fields, because the only thing that ever differs between them is which
 * cells they start from and which cells they may cross.
 * @param {GameState} s
 * @param {Iterable<number>} seeds
 * @param {(i: number) => boolean} ok
 * @returns {Int32Array}
 */
function bfs(s, seeds, ok) {
  const dist = new Int32Array(s.w * s.h).fill(-1);
  /** @type {number[]} */
  let frontier = [];
  for (const i of seeds) {
    if (dist[i] === 0) continue;
    dist[i] = 0;
    frontier.push(i);
  }
  while (frontier.length) {
    /** @type {number[]} */
    const next = [];
    for (const i of frontier) {
      const d = dist[i] + 1;
      for (const j of n4(s, i)) {
        if (dist[j] !== -1 || !ok(j)) continue;
        dist[j] = d;
        next.push(j);
      }
    }
    frontier = next;
  }
  return dist;
}

/**
 * BFS from the destination over passable cells; -1 where unreachable. `seeds` exists so a
 * caller can ask the same question of a different target set; it defaults to the one target
 * the game had before betas, which is why every existing caller reads unchanged.
 * @param {GameState} s
 * @param {Iterable<number>} [seeds]
 * @returns {Int32Array}
 */
export function distField(s, seeds) {
  return bfs(s, seeds ?? [s.dest], (i) => passable(s, i));
}

/**
 * Cells a route could ever run through: an endpoint, or terrain whose capability row says it
 * can be built on, generated on, or walked on as it stands. Classified by row and never by
 * name (SPEC §2.1) — ocean qualifies because it is buildable, volcano and void qualify on no
 * column at all, and a future terrain feature is included or excluded by its row alone.
 * @param {GameState} s
 * @param {number} i
 * @returns {boolean}
 */
function everPassable(s, i) {
  if (i === s.origin || i === s.dest) return true;
  const row = caps(s.terrain[i]);
  return row.handBuildable || row.generatable || row.passable;
}

/**
 * Terrain is immutable after load and is shared by reference across every clone of a state
 * (see `draft` in reduce.js), so the potential field is computed once per level and hung off
 * it — the same trick `state.js` uses for level params, and `grid.js` for the neighbour
 * tables. `dest` rides in the entry because a level could in principle be re-pointed.
 * @type {WeakMap<Terrain[], { dest: number, field: Int32Array }>}
 */
const POTENTIAL = new WeakMap();

/**
 * Steps to the destination over ground that could ever carry a user — construction blind, so
 * it does not move when the board does. Read it as "how far along is this cell", which is the
 * question "is that beta actually ahead of me" reduces to. Callers must not mutate it.
 * @param {GameState} s
 * @returns {Int32Array} -1 where B could never be reached from the cell at all
 */
export function potentialField(s) {
  const cached = POTENTIAL.get(s.terrain);
  if (cached && cached.dest === s.dest) return cached.field;
  const field = bfs(s, [s.dest], (i) => everPassable(s, i));
  POTENTIAL.set(s.terrain, { dest: s.dest, field });
  return field;
}

/**
 * @typedef {object} WaypointField
 * @property {Int32Array} dist       steps to the walker's own component's target; -1 for none
 * @property {Int32Array} targetPot  that target's potential, per cell; -1 where there is none
 * @property {boolean} hasBeta       a beta is standing somewhere on the board right now
 */

/**
 * Where each user is currently walking to (SPEC §6.2, revised 2026-08-05).
 *
 * Passable ground splits into connected components; a component's waypoints are its cells
 * that are B or a beta, and its **target** is the waypoint with the smallest potential — the
 * one nearest the finish. Every component is seeded into one shared BFS, which is sound
 * precisely because the components are disjoint: no cell can be reached from two targets, so
 * one array serves them all.
 *
 * `targetPot` is the other half and is not a convenience. A user needs to know whether the
 * thing it is being sent to is *ahead of it*, and that comparison is against the target's
 * potential, not against the walking distance — see `canProgress`.
 *
 * Components with no waypoint, or whose every waypoint is walled off from B even in
 * principle, are skipped: their cells keep `dist` -1 and `targetPot` -1, which is exactly
 * how a user with nowhere to go used to read.
 *
 * @param {GameState} s
 * @returns {WaypointField}
 */
export function waypointField(s) {
  const n = s.w * s.h;
  for (let i = 0; i < n; i++) if (s.con[i].k === 'beta') return withWaypoints(s, n);
  return destOnly(s, n);
}

/**
 * The no-beta case, written out rather than left to fall out of the general path — because it
 * is the regression guarantee, and a guarantee is worth being able to read.
 *
 * With no beta standing the only waypoint is B. So the one component that holds B has target
 * B at potential 0, every other component has no target at all, and the answer is `distField`
 * with a 0/-1 mask beside it. `withWaypoints` below computes exactly that, in three passes
 * over the board to reach what one pass already has. Correctness and cost agree here, which
 * is the pleasant kind of short circuit.
 * @param {GameState} s
 * @param {number} n
 * @returns {WaypointField}
 */
function destOnly(s, n) {
  const dist = distField(s);
  const targetPot = new Int32Array(n);
  for (let i = 0; i < n; i++) targetPot[i] = dist[i] < 0 ? -1 : 0;
  return { dist, targetPot, hasBeta: false };
}

/**
 * @param {GameState} s
 * @param {number} n
 * @returns {WaypointField}
 */
function withWaypoints(s, n) {
  const pot = potentialField(s);
  const targetPot = new Int32Array(n).fill(-1);
  const seen = new Uint8Array(n);
  /** @type {number[]} */
  const seeds = [];

  // Ascending scan order, like every other outcome-affecting loop in core, so the components
  // are enumerated identically on every machine and every replay.
  for (let i = 0; i < n; i++) {
    if (seen[i] || !passable(s, i)) continue;
    /** @type {number[]} */
    const comp = [i];
    seen[i] = 1;
    for (let head = 0; head < comp.length; head++) {
      for (const j of n4(s, comp[head])) {
        if (seen[j] || !passable(s, j)) continue;
        seen[j] = 1;
        comp.push(j);
      }
    }

    let best = -1;
    for (const c of comp) {
      if (!isWaypoint(s, c) || pot[c] < 0) continue;
      if (best < 0 || pot[c] < best) best = pot[c];
    }
    if (best < 0) continue;
    for (const c of comp) {
      targetPot[c] = best;
      if (isWaypoint(s, c) && pot[c] === best) seeds.push(c);
    }
  }

  return { dist: bfs(s, seeds, (i) => passable(s, i)), targetPot, hasBeta: true };
}

/**
 * @param {GameState} s
 * @param {number} i
 * @returns {boolean} somewhere a user is willing to walk to and stop
 */
function isWaypoint(s, i) {
  return i === s.dest || s.con[i].k === 'beta';
}

/**
 * THE PROGRESS GUARD. A user may walk only when its component has a target *and* that target
 * stands genuinely closer to the destination than the ground under its feet.
 *
 * Without it a beta shipped onto a backwards spur would drag every user on the board away
 * from B, because the waypoint field points at whatever waypoint its component owns and has
 * no opinion about direction. It also does a second job for free: a user standing on its own
 * target fails the test (the target's potential is its own), so arriving at a beta *is*
 * camping, with no separate rule to write.
 *
 * With no beta on the board the only waypoint is B, `targetPot` is 0 wherever it is set at
 * all, and the test is true everywhere the field is finite — today's behaviour exactly.
 *
 * A cell from which B is unreachable even in principle reads as +Infinity rather than as -1,
 * so it can never look *closer* than a real target. That branch is unreachable while the
 * fields agree (a passable cell that can reach a finite-potential target can reach B over
 * ever-passable ground by the same walk), and is written out because relying on that
 * argument silently is how a sentinel becomes a bug.
 *
 * @param {GameState} s
 * @param {WaypointField} wf
 * @param {number} at
 * @returns {boolean}
 */
export function canProgress(s, wf, at) {
  const target = wf.targetPot[at];
  if (target < 0) return false;
  const here = potentialField(s)[at];
  return here < 0 || target < here;
}

/**
 * Topological, not safe: AI_HIDDEN counts as passable, so users depart down mined corridors
 * and only refuse routes that go nowhere (SPEC §6.2).
 *
 * Revised 2026-08-05: the queue departs when the origin can reach *a waypoint* that is ahead
 * of it — B, or a beta staged between here and B. With no beta that is the old sentence with
 * different words: the only waypoint is B, so `dist[origin] > 0` is "a complete path exists"
 * (the origin is never the destination, so the field is never 0 there) and the guard holds
 * wherever the field is finite.
 * @param {GameState} s
 * @param {WaypointField} [wf]  reuse the field the tick already computed
 * @returns {boolean}
 */
export function gateOpen(s, wf) {
  const field = wf ?? waypointField(s);
  return field.dist[s.origin] > 0 && canProgress(s, field, s.origin);
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
