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
//
// Revised again 2026-08-05 (user decision — multi-destination itineraries, SPEC §6/§9.2.2).
// A level may mark several destinations and each user carries its own list of the ones it
// still has to visit, in any order. That turns every field above from a property of the board
// into a property of the board **and a walker's remaining list**, and the generalization is
// one idea applied three times:
//
//   1. `potentialField` is per-destination and cached per destination, because "how far along
//      is this cell" is only a question once you say along the way to *what*.
//   2. A walker's own potential is the **minimum** over its remaining destinations' fields —
//      "how far am I from the nearest thing I still owe somebody". Call it the composite.
//   3. `waypointField` is per **mask**: one field per distinct remaining-set among the users
//      alive this tick, each running the same component scan the betas introduced, with the
//      mask's own destinations in the waypoint set and the mask's own composite in the guard.
//
// A single-destination level produces exactly one mask, whose composite potential IS the field
// this file computed before any of it existed, so `waypointField` reduces to the previous
// function line for line. That is not left as an argument: `destOnly` and `withWaypoints`
// below both take the mask's destination cells where they used to take `[s.dest]` and are
// otherwise untouched, and `test/itinerary.test.js` asserts the equivalence against the
// pre-itinerary field directly.

import { n4 } from './grid.js';
import { caps, everyDest, isEndpoint, isPassable } from './state.js';

/** @typedef {import('./state.js').GameState} GameState */
/** @typedef {import('./state.js').Terrain} Terrain */

/**
 * Endpoints — the origin and every destination — are always passable and never buildable
 * (PLAN §3.8).
 * @param {GameState} s
 * @param {number} i
 * @returns {boolean}
 */
export function passable(s, i) {
  if (isEndpoint(s, i)) return true;
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
 * BFS from the destinations over passable cells; -1 where unreachable. `seeds` exists so a
 * caller can ask the same question of a different target set; it defaults to **every**
 * destination, which on a one-destination level is the one target the game had before betas —
 * which is why every existing caller reads unchanged.
 * @param {GameState} s
 * @param {Iterable<number>} [seeds]
 * @returns {Int32Array}
 */
export function distField(s, seeds) {
  return bfs(s, seeds ?? s.dests, (i) => passable(s, i));
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
  if (isEndpoint(s, i)) return true;
  const row = caps(s.terrain[i]);
  return row.handBuildable || row.generatable || row.passable;
}

/**
 * Terrain is immutable after load and is shared by reference across every clone of a state
 * (see `draft` in reduce.js), so the potential fields are computed once per level and hung off
 * it — the same trick `state.js` uses for level params, and `grid.js` for the neighbour
 * tables. Keyed by destination cell inside that, because a level with three destinations has
 * three of these and they are each as constant as the terrain is.
 * @type {WeakMap<Terrain[], Map<number, Int32Array>>}
 */
const POTENTIAL = new WeakMap();

/**
 * Steps to one destination over ground that could ever carry a user — construction blind, so
 * it does not move when the board does. Read it as "how far along the route to that
 * destination is this cell", which is the question "is that beta actually ahead of me" reduces
 * to. Callers must not mutate it.
 * @param {GameState} s
 * @param {number} destCell  a cell in `s.dests`
 * @returns {Int32Array} -1 where the destination could never be reached from the cell at all
 */
export function potentialField(s, destCell) {
  let byDest = POTENTIAL.get(s.terrain);
  if (!byDest) POTENTIAL.set(s.terrain, byDest = new Map());
  let field = byDest.get(destCell);
  if (!field) byDest.set(destCell, field = bfs(s, [destCell], (i) => everPassable(s, i)));
  return field;
}

/**
 * Composites are pure functions of terrain and a destination set, so they cache exactly like
 * the fields they are built from. Keyed by the destination *cells* rather than by the mask
 * indexes: two masks that name the same cells are the same field.
 * @type {WeakMap<Terrain[], Map<string, Int32Array>>}
 */
const COMPOSITE = new WeakMap();

/**
 * **A walker's own potential**: distance to the nearest destination it still owes, over ground
 * that could ever be built on. The minimum, not the sum — the user may visit its list in any
 * order, so the thing it is measurably closer to is whichever one is nearest, and progress
 * toward that one is progress.
 *
 * The single-destination case returns the cached field itself rather than a copy of it, which
 * is not just an optimisation: it means the guard on a one-destination level compares against
 * the identical array it compared against before itineraries existed.
 *
 * @param {GameState} s
 * @param {number[]} mask  ascending indexes into `s.dests`; must not be empty
 * @returns {Int32Array} -1 where no destination in the mask is reachable even in principle
 */
export function compositePotential(s, mask) {
  if (mask.length === 1) return potentialField(s, s.dests[mask[0]]);

  const cells = mask.map((m) => s.dests[m]);
  const key = cells.join(',');
  let byMask = COMPOSITE.get(s.terrain);
  if (!byMask) COMPOSITE.set(s.terrain, byMask = new Map());
  const cached = byMask.get(key);
  if (cached) return cached;

  const n = s.w * s.h;
  const out = new Int32Array(n).fill(-1);
  for (const cell of cells) {
    const field = potentialField(s, cell);
    for (let i = 0; i < n; i++) {
      const v = field[i];
      if (v < 0) continue;
      if (out[i] < 0 || v < out[i]) out[i] = v;
    }
  }
  byMask.set(key, out);
  return out;
}

/**
 * @typedef {object} WaypointField
 * @property {Int32Array} dist       steps to the walker's own component's target; -1 for none
 * @property {Int32Array} targetPot  that target's potential, per cell; -1 where there is none
 * @property {Int32Array} pot        the mask's composite potential — the guard's other half
 * @property {boolean} hasBeta       a beta is standing somewhere on the board right now
 */

/**
 * Where a user carrying `mask` is currently walking to (SPEC §6.2, revised 2026-08-05).
 *
 * Passable ground splits into connected components; a component's waypoints are its cells
 * that are a destination **still on the mask** or a beta, and its **target** is the waypoint
 * with the smallest composite potential — the one nearest the nearest thing left to do. Every
 * component is seeded into one shared BFS, which is sound precisely because the components are
 * disjoint: no cell can be reached from two targets, so one array serves them all.
 *
 * `targetPot` is the other half and is not a convenience. A user needs to know whether the
 * thing it is being sent to is *ahead of it*, and that comparison is against the target's
 * potential, not against the walking distance — see `canProgress`.
 *
 * Components with no waypoint, or whose every waypoint is walled off from the mask even in
 * principle, are skipped: their cells keep `dist` -1 and `targetPot` -1, which is exactly
 * how a user with nowhere to go used to read.
 *
 * A destination that is *not* on the mask is not a waypoint and gets no special treatment at
 * all: it is a passable cell a user walks over on its way somewhere else, which is precisely
 * the rule the owner wrote (a stop you have already made, or never owed, does nothing).
 *
 * @param {GameState} s
 * @param {number[]} [mask]  ascending indexes into `s.dests`; default: every destination
 * @returns {WaypointField}
 */
export function waypointField(s, mask) {
  const m = mask ?? everyDest(s);
  const n = s.w * s.h;
  for (let i = 0; i < n; i++) if (s.con[i].k === 'beta') return withWaypoints(s, m, n);
  return destOnly(s, m, n);
}

/**
 * The no-beta case, written out rather than left to fall out of the general path — because it
 * is the regression guarantee, and a guarantee is worth being able to read.
 *
 * With no beta standing the only waypoints are the mask's own destinations, and each of those
 * sits at composite potential 0 (a destination is zero steps from itself, and the composite is
 * a minimum), so they all tie and they are all seeds. The answer is therefore the multi-source
 * `distField` over exactly those cells with a 0/-1 mask beside it — for one destination,
 * `distField(s)` and nothing else. `withWaypoints` below computes exactly that, in three
 * passes over the board to reach what one pass already has. Correctness and cost agree here,
 * which is the pleasant kind of short circuit.
 * @param {GameState} s
 * @param {number[]} mask
 * @param {number} n
 * @returns {WaypointField}
 */
function destOnly(s, mask, n) {
  const dist = distField(s, mask.map((m) => s.dests[m]));
  const targetPot = new Int32Array(n);
  for (let i = 0; i < n; i++) targetPot[i] = dist[i] < 0 ? -1 : 0;
  return { dist, targetPot, pot: compositePotential(s, mask), hasBeta: false };
}

/**
 * @param {GameState} s
 * @param {number[]} mask
 * @param {number} n
 * @returns {WaypointField}
 */
function withWaypoints(s, mask, n) {
  const pot = compositePotential(s, mask);
  const wanted = new Set(mask.map((m) => s.dests[m]));
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
      if (!isWaypoint(s, wanted, c) || pot[c] < 0) continue;
      if (best < 0 || pot[c] < best) best = pot[c];
    }
    if (best < 0) continue;
    for (const c of comp) {
      targetPot[c] = best;
      if (isWaypoint(s, wanted, c) && pot[c] === best) seeds.push(c);
    }
  }

  return { dist: bfs(s, seeds, (i) => passable(s, i)), targetPot, pot, hasBeta: true };
}

/**
 * @param {GameState} s
 * @param {Set<number>} wanted  the mask's destination cells
 * @param {number} i
 * @returns {boolean} somewhere a user carrying this mask is willing to walk to and stop
 */
function isWaypoint(s, wanted, i) {
  return wanted.has(i) || s.con[i].k === 'beta';
}

/**
 * @typedef {object} FieldSet
 * @property {(mask: number[]) => WaypointField} for   the field for one remaining-set
 */

/**
 * **One tick's worth of routing.** Users no longer share a field, so something has to decide
 * how many get computed, and the answer is: one per *distinct* remaining-set among the users
 * alive this tick. Two users owing {B, C} walk the same board and ask the same question; a
 * third owing {D} asks a different one and gets its own field. A single-destination level has
 * exactly one live mask and therefore computes exactly one field — the same one, once per
 * movement phase, in the same place as before.
 *
 * The distinct masks are collected in user order and their keys computed in sorted order, so
 * the set of fields built is a pure function of the state rather than of the order anyone
 * happened to ask. (Which fields exist cannot affect an outcome — each is a pure function of
 * `(s, mask)` — but "cannot affect an outcome" is a claim that ages badly, and sorting costs
 * nothing.) A mask nobody was carrying when the tick began is still answered, computed on
 * demand: `movement` can retire a destination from under a user, and the post-blast recompute
 * then has to ask about the list it is left with.
 *
 * @param {GameState} s
 * @returns {FieldSet}
 */
export function waypointFields(s) {
  /** @type {Map<string, number[]>} */
  const live = new Map();
  for (const u of s.users) {
    if (u.state !== 'queued' && u.state !== 'moving') continue;
    const key = maskKey(u.todo);
    if (!live.has(key)) live.set(key, u.todo);
  }

  /** @type {Map<string, WaypointField>} */
  const fields = new Map();
  for (const key of [...live.keys()].sort()) {
    const mask = /** @type {number[]} */ (live.get(key));
    if (mask.length) fields.set(key, waypointField(s, mask));
  }

  return {
    for(mask) {
      const key = maskKey(mask);
      let f = fields.get(key);
      if (!f) fields.set(key, f = waypointField(s, mask.length ? mask : everyDest(s)));
      return f;
    },
  };
}

/**
 * @param {number[]} mask
 * @returns {string}
 */
function maskKey(mask) {
  return mask.join(',');
}

/**
 * THE PROGRESS GUARD. A user may walk only when its component has a target *and* that target
 * stands genuinely closer to the walker's remaining destinations than the ground under its
 * feet.
 *
 * Without it a beta shipped onto a backwards spur would drag every user on the board away
 * from B, because the waypoint field points at whatever waypoint its component owns and has
 * no opinion about direction. It also does a second job for free: a user standing on its own
 * target fails the test (the target's potential is its own), so arriving at a beta *is*
 * camping, with no separate rule to write.
 *
 * With no beta on the board the only waypoints are the mask's destinations, `targetPot` is 0
 * wherever it is set at all, and the test is true everywhere the field is finite — today's
 * behaviour exactly.
 *
 * A cell from which nothing on the list is reachable even in principle reads as +Infinity
 * rather than as -1, so it can never look *closer* than a real target. That branch is
 * unreachable while the fields agree (a passable cell that can reach a finite-potential target
 * can reach that destination over ever-passable ground by the same walk), and is written out
 * because relying on that argument silently is how a sentinel becomes a bug.
 *
 * Note the arity did not change with itineraries and that is deliberate: the composite the
 * guard measures against rides on the field, so a caller that already has the right field for
 * this walker cannot accidentally ask the question against somebody else's list.
 *
 * @param {GameState} s
 * @param {WaypointField} wf
 * @param {number} at
 * @returns {boolean}
 */
export function canProgress(s, wf, at) {
  const target = wf.targetPot[at];
  if (target < 0) return false;
  const here = wf.pot[at];
  return here < 0 || target < here;
}

/**
 * Topological, not safe: AI_HIDDEN counts as passable, so users depart down mined corridors
 * and only refuse routes that go nowhere (SPEC §6.2).
 *
 * Revised 2026-08-05: the queue departs when the origin can reach *a waypoint* that is ahead
 * of it — B, or a beta staged between here and B. With no beta that is the old sentence with
 * different words: the only waypoint is B, so `dist[origin] > 0` is "a complete path exists"
 * (the origin is never a destination, so the field is never 0 there) and the guard holds
 * wherever the field is finite.
 *
 * Revised again 2026-08-05 with itineraries, in the two-argument form and the one-argument
 * form separately, because they are asked by different callers for different reasons:
 *
 * - **With a field** it is unchanged and it is per-walker: "can a user carrying *this* list
 *   leave the origin". `departures` asks it once per queued user against that user's own
 *   field, which on a one-itinerary level is one question asked N times with one answer.
 * - **Without a field** it is the HUD's question (PLAN §11.8): is the Run button worth
 *   pressing — *can anybody who is currently stuck get unstuck*. So it asks the users: every
 *   queued user about leaving the origin, every stalled user about the ground it is standing
 *   on. On a board with nobody on it there is nobody to ask and it falls back to the queue's
 *   question with the full itinerary, which is what it always answered at tick 0.
 *
 * @param {GameState} s
 * @param {WaypointField} [wf]  reuse the field the tick already computed
 * @returns {boolean}
 */
export function gateOpen(s, wf) {
  if (wf) return wf.dist[s.origin] > 0 && canProgress(s, wf, s.origin);

  const fields = waypointFields(s);
  let asked = false;
  let open = false;
  for (const u of s.users) {
    const queued = u.state === 'queued';
    if (!queued && !(u.state === 'moving' && u.stalled)) continue;
    asked = true;
    const f = fields.for(u.todo);
    if (queued ? gateOpen(s, f) : canProgress(s, f, u.at)) open = true;
  }
  return asked ? open : gateOpen(s, waypointField(s, everyDest(s)));
}

/**
 * **Is the job finished** — every destination reachable from the origin over ground that is
 * passable now. Not a routing question: nothing in the tick pipeline calls it. It is what the
 * sim bots mean by "there is nothing left to build", and it is stated here beside the gate
 * rather than in `policies.js` because it is a fact about the board, and because a bot that
 * measured completeness its own way would be measuring a different game (PLAN §13).
 *
 * On one destination it is `gateOpen`'s old topological reading exactly. On several it is
 * strictly stronger than the gate: users can be walking to B while C is still unbuilt, and a
 * bot that downed tools at the first open route would strand every itinerary that included C.
 *
 * @param {GameState} s
 * @returns {boolean}
 */
export function pathComplete(s) {
  const seen = new Uint8Array(s.w * s.h);
  seen[s.origin] = 1;
  let frontier = [s.origin];
  while (frontier.length) {
    /** @type {number[]} */
    const next = [];
    for (const i of frontier) {
      for (const j of n4(s, i)) {
        if (seen[j] || !passable(s, j)) continue;
        seen[j] = 1;
        next.push(j);
      }
    }
    frontier = next;
  }
  return s.dests.every((d) => seen[d] === 1);
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
