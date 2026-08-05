// @ts-check
// The constraint solver (SPEC §10.2, PLAN §7.4). Instrumentation only — nothing in the
// prototype's gameplay path calls it. Its job is to measure whether the board was ever
// deducible, which is the thing SPEC §8.3's ending is made of.
//
// It enumerates over `aiHidden` cells and nothing else, so ocean, void, volcano, hand and
// revealed tiles are known-empty by construction and irregular coastlines cost nothing
// (SPEC §10.7's warning about rectangular frontiers).
//
// Its constraints come from three places, all of them things a player can see: every
// displayed clue (revealed AI tiles and — since 2026-08-04 — hand tiles, see `showsClue`),
// and every live block's "this generation introduced N defects" total.

import { n4, n8 } from './grid.js';
import { isEndpoint } from './state.js';
import { passable } from './routing.js';
import { blockMines, cellHasMine, clue } from './reduce.js';

/** @typedef {import('./state.js').GameState} GameState */

/** PLAN §7.4: past this a component is marked bailed and its cells go to `unknown`. */
export const MAX_COMPONENT_CELLS = 24;

/** Backtracking nodes per component before giving up. Metrics-only, never gameplay. */
export const NODE_BUDGET = 2_000_000;

/**
 * Cells whose clue the player can actually read, which is the only thing the solver is
 * allowed to reason from.
 *
 * **Revised 2026-08-04 (user decision): hand tiles are clue sources too.** Structure you
 * built yourself senses defects next to it, so a hand tile adjacent to unreviewed slop
 * displays its count exactly as a reviewed tile does. That makes hand placement a *safe,
 * slow information source* — build alongside a generated block and read its edge instead of
 * clicking into it — and the solver has to see the same board the player does or the
 * `guessForced` metric measures a game nobody is playing.
 *
 * `clue()` itself never needed changing: it has always counted the mine set around any cell
 * index, with no opinion about what is built there (SPEC §7.4/§7.5, pinned by test). What
 * changed is only *which* cells put their count on screen.
 *
 * Endpoints are excluded: they display nothing. They are never `hand` anyway — placement
 * refuses them (PLAN §3.8) — but stating it here means the exclusion survives a future
 * change of mind about that. *(All of them, since 2026-08-05: a level may carry several
 * destinations and every one of them is as silent as B always was.)*
 *
 * *(Revised 2026-08-05, with beta blocks: `beta` joins the list, on the hand-tile argument
 * verbatim — a beta is player-built structure, the renderer draws its count, and the solver
 * has to read every number the player can.)*
 *
 * @param {GameState} s
 * @param {number} i
 * @returns {boolean}
 */
function showsClue(s, i) {
  if (isEndpoint(s, i)) return false;
  const k = s.con[i].k;
  return k === 'aiRevealed' || k === 'hand' || k === 'beta';
}

/**
 * @typedef {object} Constraint
 * @property {number[]} vars   positions into the component's cell list
 * @property {number} lo
 * @property {number} hi
 */

/**
 * @typedef {object} Solution
 * @property {number[]} safe          mined in no consistent assignment
 * @property {number[]} mines         mined in every consistent assignment
 * @property {number[]} unknown       neither, or inside a bailed component
 * @property {boolean} guessForced    users must cross ground nobody can prove safe
 * @property {boolean} bailed         some component exceeded the enumeration budget
 */

/**
 * @param {GameState} s
 * @returns {Solution}
 */
export function solve(s) {
  /** @type {number[]} */
  const hidden = [];
  for (let i = 0; i < s.con.length; i++) if (s.con[i].k === 'aiHidden') hidden.push(i);

  /** @type {Map<number, number>} cell → variable index */
  const varOf = new Map(hidden.map((c, i) => [c, i]));

  /** @type {{ cells: number[], lo: number, hi: number }[]} */
  const raw = [];

  // A visible clue bounds the mines among its *hidden* 8-neighbours; the mines it can
  // already see (confirmed ones) come off both ends of the range.
  for (let i = 0; i < s.con.length; i++) {
    if (!showsClue(s, i)) continue;
    /** @type {number[]} */
    const cells = [];
    let known = 0;
    for (const j of n8(s, i)) {
      if (s.con[j].k === 'aiHidden') cells.push(j);
      else if (cellHasMine(s, j)) known++;
    }
    if (cells.length === 0) continue;
    const { lo, hi } = clue(s, i);
    raw.push({ cells, lo: lo - known, hi: hi - known });
  }

  // "This generation introduced N defects" (SPEC §4.2) is an exact total over the block's
  // surviving cells, minus the ones already confirmed.
  for (const b of s.blocks) {
    /** @type {number[]} */
    const cells = [];
    let confirmed = 0;
    for (const c of b.cells) {
      if (s.con[c].k === 'aiHidden') cells.push(c);
      else if (s.con[c].k === 'mineConfirmed') confirmed++;
    }
    if (cells.length === 0) continue;
    const total = blockMines(s, b.id) - confirmed;
    raw.push({ cells, lo: total, hi: total });
  }

  // Split into independent components: two hidden cells are connected when a constraint
  // mentions both. Enumerating each separately is what keeps the state space sane.
  const parent = hidden.map((_, i) => i);
  /** @param {number} i @returns {number} */
  const find = (i) => {
    while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; }
    return i;
  };
  /** @param {number} a @param {number} b */
  const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent[ra] = rb; };

  /** @type {Constraint[]} */
  const constraints = raw.map((c) => {
    const vars = c.cells.map((cell) => /** @type {number} */ (varOf.get(cell)));
    for (let k = 1; k < vars.length; k++) union(vars[0], vars[k]);
    return { vars, lo: c.lo, hi: c.hi };
  });

  /** @type {Map<number, { vars: number[], constraints: Constraint[] }>} */
  const components = new Map();
  for (let v = 0; v < hidden.length; v++) {
    const r = find(v);
    let comp = components.get(r);
    if (!comp) components.set(r, comp = { vars: [], constraints: [] });
    comp.vars.push(v);
  }
  for (const c of constraints) {
    if (c.vars.length === 0) continue;
    /** @type {{ vars: number[], constraints: Constraint[] }} */ (components.get(find(c.vars[0]))).constraints.push(c);
  }

  /** @type {number[]} */
  const safe = [];
  /** @type {number[]} */
  const mines = [];
  /** @type {number[]} */
  const unknown = [];
  let bailed = false;

  for (const comp of components.values()) {
    // A cell no constraint mentions is pure guesswork — nothing is known about it.
    if (comp.constraints.length === 0 || comp.vars.length > MAX_COMPONENT_CELLS) {
      if (comp.vars.length > MAX_COMPONENT_CELLS) bailed = true;
      for (const v of comp.vars) unknown.push(hidden[v]);
      continue;
    }
    const r = enumerate(comp.vars, comp.constraints);
    if (r.bailed || r.solutions === 0) {
      bailed = bailed || r.bailed;
      for (const v of comp.vars) unknown.push(hidden[v]);
      continue;
    }
    for (const v of comp.vars) {
      const cell = hidden[v];
      if (!r.everMine.has(v)) safe.push(cell);
      else if (!r.everSafe.has(v)) mines.push(cell);
      else unknown.push(cell);
    }
  }

  safe.sort((a, b) => a - b);
  mines.sort((a, b) => a - b);
  unknown.sort((a, b) => a - b);

  return { safe, mines, unknown, guessForced: guessForced(s, safe), bailed };
}

/**
 * Backtracking over one component with interval pruning: a partial assignment dies as soon
 * as a constraint's running sum passes its ceiling or cannot still reach its floor.
 * @param {number[]} vars
 * @param {Constraint[]} constraints
 * @returns {{ solutions: number, everMine: Set<number>, everSafe: Set<number>, bailed: boolean }}
 */
function enumerate(vars, constraints) {
  /** @type {Map<number, number>} variable index → position in `vars` */
  const slot = new Map(vars.map((v, i) => [v, i]));
  const n = vars.length;

  /** constraints touching each slot */
  /** @type {number[][]} */
  const touching = vars.map(() => []);
  const local = constraints.map((c, ci) => {
    const slots = c.vars.map((v) => /** @type {number} */ (slot.get(v)));
    for (const sl of slots) touching[sl].push(ci);
    return { slots, lo: c.lo, hi: c.hi };
  });

  const sum = new Int32Array(local.length);
  const left = Int32Array.from(local.map((c) => c.slots.length));
  const assign = new Uint8Array(n);

  /** @type {Set<number>} */
  const everMine = new Set();
  /** @type {Set<number>} */
  const everSafe = new Set();
  let solutions = 0;
  let nodes = 0;
  let bailed = false;

  /** @param {number} i @returns {void} */
  function step(i) {
    if (bailed) return;
    if (++nodes > NODE_BUDGET) { bailed = true; return; }
    if (i === n) {
      solutions++;
      for (let k = 0; k < n; k++) (assign[k] ? everMine : everSafe).add(vars[k]);
      return;
    }
    for (let value = 0; value <= 1; value++) {
      assign[i] = value;
      let ok = true;
      for (const ci of touching[i]) {
        sum[ci] += value;
        left[ci] -= 1;
        if (sum[ci] > local[ci].hi || sum[ci] + left[ci] < local[ci].lo) ok = false;
      }
      if (ok) step(i + 1);
      for (const ci of touching[i]) { sum[ci] -= value; left[ci] += 1; }
      if (bailed) return;
    }
  }

  step(0);
  return { solutions, everMine, everSafe, bailed };
}

/**
 * Instrumentation, not gameplay — so the definition is pragmatic and stated here rather
 * than implied. The board is `guessForced` when the departure gate is open (users *are*
 * walking) and no route from A to every destination exists that avoids every cell nobody can
 * prove safe. In other words: every remaining route makes a user cross ground that deduction
 * cannot clear, so somebody is guessing. Hidden cells that are provably safe do not count
 * against it; a closed gate is not a forced guess, it is an unfinished build.
 *
 * *(Revised 2026-08-05 with itineraries: "every destination" rather than "B". The metric is
 * about the level's demand rather than any one user's, so it asks for all of them however the
 * itineraries happen to divide them up — a level where C can only be reached by guessing is a
 * level that forces a guess. On one destination it is the sentence it always was.)*
 * @param {GameState} s
 * @param {number[]} safe
 * @returns {boolean}
 */
function guessForced(s, safe) {
  const proven = new Set(safe);
  /** @param {number} i */
  const ok = (i) => passable(s, i) && (s.con[i].k !== 'aiHidden' || proven.has(i));

  // The gate itself is topological (SPEC §6.2); if it is shut nobody is crossing anything.
  if (!reachesAll(s, (i) => passable(s, i))) return false;
  return !reachesAll(s, ok);
}

/**
 * @param {GameState} s
 * @param {(i: number) => boolean} ok
 * @returns {boolean} whether every destination is reachable from origin over cells satisfying
 *   `ok` — endpoints always satisfy it, since `passable` says so and they hold no slop
 */
function reachesAll(s, ok) {
  /** @type {Set<number>} */
  const seen = new Set([s.origin]);
  let frontier = [s.origin];
  while (frontier.length) {
    /** @type {number[]} */
    const next = [];
    for (const i of frontier) {
      for (const j of n4(s, i)) {
        if (seen.has(j) || !ok(j)) continue;
        seen.add(j);
        next.push(j);
      }
    }
    frontier = next;
  }
  return s.dests.every((d) => seen.has(d));
}
