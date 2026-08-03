// @ts-check
// The reducer: init(level, seed), reduce(state, action) → { s, ev }, legalActions().
// Pure — the input state is never mutated; a draft is cloned and returned. The tick
// pipeline runs in the exact order of PLAN §7.1 and nothing here knows what a frame is.

import { RULES, LEVEL_DEFAULTS } from './rules.js';
import { CON_HAND, conCaps, isHandBuildable, levelParams, setLevelParams } from './state.js';
import { emptyCon, n4, parseMap } from './grid.js';
import { distField, gateOpen, stepCandidates } from './routing.js';
import { fromState, initStreams } from './rng.js';

/** @typedef {import('./state.js').GameState} GameState */
/** @typedef {import('./state.js').Action} Action */
/** @typedef {import('./state.js').ActionKind} ActionKind */
/** @typedef {import('./state.js').Ev} Ev */
/** @typedef {import('./state.js').User} User */
/** @typedef {import('./rules.js').LevelParams} LevelParams */
/** @typedef {import('../levels/index.js').LevelDef} LevelDef */

/**
 * @param {LevelDef} def   a LevelDef; missing optional fields fall back to LEVEL_DEFAULTS
 * @param {number} seed
 * @returns {GameState}
 */
export function init(def, seed) {
  const m = parseMap(def.map);
  /** @type {LevelParams} */
  const params = {
    arrivals: def.arrivals ?? LEVEL_DEFAULTS.arrivals,
    mineDensity: def.mineDensity ?? LEVEL_DEFAULTS.mineDensity,
    shapePool: def.shapePool ?? LEVEL_DEFAULTS.shapePool,
    analyzeReveals: def.analyzeReveals ?? LEVEL_DEFAULTS.analyzeReveals,
    userMoveEvery: def.userMoveEvery ?? LEVEL_DEFAULTS.userMoveEvery,
    blastRadius: def.blastRadius ?? LEVEL_DEFAULTS.blastRadius,
  };

  /** @type {GameState} */
  const s = {
    level: def.id,
    seed: seed >>> 0,
    tick: 0,
    w: m.w,
    h: m.h,
    terrain: m.terrain,
    con: emptyCon(m),
    bbox: m.bbox,
    origin: m.origin,
    dest: m.dest,
    blocks: [],
    users: [],
    schedule: {
      total: params.arrivals.count,
      spawned: 0,
      nextTick: params.arrivals.firstTick,
      every: params.arrivals.every,
    },
    confidence: RULES.CONFIDENCE_START,
    phase: { k: 'play' },
    rng: initStreams(seed),
    stats: { placed: 0, generated: 0, analyzed: 0, waited: 0, detonations: 0, served: 0 },
  };
  setLevelParams(s, params);
  return s;
}

/**
 * @param {GameState} s
 * @param {Action} a
 * @returns {{ s: GameState, ev: Ev[] }}
 */
export function reduce(s, a) {
  if (s.phase.k === 'won' || s.phase.k === 'lost') return rejected(s, `game is over ('${s.phase.k}')`);

  switch (a.t) {
    case 'place': {
      const reason = placeRejection(s, a.cell);
      if (reason) return rejected(s, reason);
      const d = draft(s);
      d.con[a.cell] = CON_HAND;
      d.stats.placed++;
      /** @type {Ev[]} */
      const ev = [{ t: 'placed', cells: [a.cell] }];
      return { s: runTick(d, ev), ev };
    }
    case 'wait': {
      const d = draft(s);
      d.stats.waited++;
      /** @type {Ev[]} */
      const ev = [];
      return { s: runTick(d, ev), ev };
    }
    // --- M2 extension point ------------------------------------------------------
    // 'generate' draws a shape and enters phase 'placing' without consuming a tick;
    // 'placeBlock' commits it (mine roll, then the pipeline); 'analyze' reveals.
    // Each becomes a case here that mutates the draft, then calls runTick.
    default:
      throw new Error(`reduce: unhandled action ${JSON.stringify(a)}`);
  }
}

/**
 * The single source of truth the action bar reads (SPEC §10.6), so the UI can never offer
 * something the reducer would reject. With a cell: the verbs legal on that cell. Without:
 * the global verbs.
 * @param {GameState} s
 * @param {number} [cell]
 * @returns {ActionKind[]}
 */
export function legalActions(s, cell) {
  /** @type {ActionKind[]} */
  const out = [];
  if (s.phase.k !== 'play') return out;   // M2: phase 'placing' offers only 'placeBlock'
  if (cell === undefined) {
    out.push('wait');                     // M2: 'generate' joins here
    return out;
  }
  if (!placeRejection(s, cell)) out.push('place');
  // M2: 'analyze' joins here, legal on aiHidden cells.
  return out;
}

/**
 * @param {GameState} s
 * @param {number} cell
 * @returns {string} empty when the placement is legal (SPEC §4.1)
 */
export function placeRejection(s, cell) {
  if (s.phase.k !== 'play') return `cannot place during phase '${s.phase.k}'`;
  if (!Number.isInteger(cell) || cell < 0 || cell >= s.w * s.h) return `cell ${cell} is off the board`;
  if (cell === s.origin || cell === s.dest) return 'endpoints are not buildable';
  if (!isHandBuildable(s.terrain[cell], s.con[cell])) {
    return conCaps(s.con[cell]).occupies ? 'cell is already built' : `cannot build on ${s.terrain[cell]}`;
  }
  for (const j of n4(s, cell)) {
    if (j === s.origin || j === s.dest) return '';
    if (conCaps(s.con[j]).handFrom) return '';
  }
  return 'must touch an endpoint, a hand tile, or a revealed tile';
}

// --- tick pipeline (PLAN §7.1) ------------------------------------------------------

/**
 * @param {GameState} d  a draft, already cloned by the caller
 * @param {Ev[]} ev
 * @returns {GameState}
 */
function runTick(d, ev) {
  // Departures ride the movement cadence: on a non-moving tick the queue simply keeps
  // waiting, which is what it would look like anyway (OPEN #1; default 1 = every tick).
  const { userMoveEvery } = levelParams(d);
  if (d.tick % userMoveEvery === 0) {
    const dist = distField(d);
    departures(d, ev, dist);
    movement(d, ev, dist);
    // M2 step 4 — traversal resolution: reveal or detonate the aiHidden cells now
    // occupied, in cell-index order; recompute `dist` after a detonation and let the
    // remaining users step. Deliberately a no-op until blocks exist.
  }
  // Step 5 — stranding: users with no remaining path simply stall each tick and are
  // already counted as waiting below (SPEC §6.4). No extra state needed.
  spawns(d, ev);
  meters(d, ev);
  d.tick++;
  return d;
}

/**
 * All queued users with an open path depart at once — the flush when a path completes is
 * the feedback (PLAN §3.9). Users spawned this tick gate next tick.
 * @param {GameState} d
 * @param {Ev[]} ev
 * @param {Int32Array} dist
 */
function departures(d, ev, dist) {
  if (!gateOpen(d, dist)) return;
  for (const u of d.users) {
    if (u.state !== 'queued') continue;
    u.state = 'moving';
    u.at = d.origin;
    u.visited = [d.origin];
    u.stalled = false;
    ev.push({ t: 'departed', user: u.id });
  }
}

/**
 * @param {GameState} d
 * @param {Ev[]} ev
 * @param {Int32Array} dist
 */
function movement(d, ev, dist) {
  const move = fromState(d.rng.move);
  for (const u of d.users) {
    if (u.state !== 'moving') continue;
    u.stalled = false;
    const options = stepCandidates(d, dist, u.at, u.visited);
    if (options.length === 0) {
      u.stalled = true;
      continue;
    }
    const to = options.length === 1 ? options[0] : options[Math.floor(move() * options.length)];
    ev.push({ t: 'step', user: u.id, from: u.at, to });
    u.at = to;
    u.visited.push(to);
    if (to === d.dest) {
      u.state = 'arrived';
      d.stats.served++;
      d.confidence += RULES.SERVED_BONUS;   // 0 by default; no event, the Ev union has no reason for it
      ev.push({ t: 'arrived', user: u.id });
    }
  }
  d.rng = { gen: d.rng.gen, move: move.getState() };
}

/**
 * @param {GameState} d
 * @param {Ev[]} ev
 */
function spawns(d, ev) {
  const sc = d.schedule;
  while (sc.spawned < sc.total && d.tick >= sc.nextTick) {
    /** @type {User} */
    const u = { id: d.users.length, at: d.origin, state: 'queued', visited: [], stalled: false };
    d.users.push(u);
    sc.spawned++;
    sc.nextTick += sc.every;
    ev.push({ t: 'spawned', user: u.id });
  }
}

/**
 * Gated at origin, stalled mid-route or stranded by a blast all count identically
 * (SPEC §6.4). Win/loss per PLAN §3.3.
 * @param {GameState} d
 * @param {Ev[]} ev
 */
function meters(d, ev) {
  let waiting = 0;
  for (const u of d.users) {
    if (u.state === 'queued' || (u.state === 'moving' && u.stalled)) waiting++;
  }
  if (waiting > 0) {
    const delta = -RULES.WAIT_DRAIN_PER_USER * waiting;
    d.confidence += delta;
    ev.push({ t: 'confidence', delta, reason: 'waiting' });
  }

  // Win first: a level whose users all arrived is finished, even if the same tick emptied
  // the meter. The two can only collide via a detonation (M2).
  if (d.schedule.spawned >= d.schedule.total && d.users.every((u) => u.state === 'arrived')) {
    d.phase = { k: 'won' };
    ev.push({ t: 'won' });
  } else if (d.confidence <= 0) {
    d.confidence = 0;
    d.phase = { k: 'lost' };
    ev.push({ t: 'lost' });
  }
}

// --- helpers ------------------------------------------------------------------------

/**
 * Clone exactly what a tick can change; terrain and bbox are load-time constants and stay
 * shared by reference (which is also what keeps the neighbour tables cached).
 * @param {GameState} s
 * @returns {GameState}
 */
function draft(s) {
  return {
    ...s,
    con: s.con.slice(),
    blocks: s.blocks.map((b) => ({ id: b.id, cells: b.cells.slice() })),
    users: s.users.map((u) => ({ ...u, visited: u.visited.slice() })),
    schedule: { ...s.schedule },
    stats: { ...s.stats },
    rng: { ...s.rng },
  };
}

/**
 * A rejected action leaves the state untouched and never advances the tick (SPEC §3).
 * @param {GameState} s
 * @param {string} reason
 * @returns {{ s: GameState, ev: Ev[] }}
 */
function rejected(s, reason) {
  return { s, ev: [{ t: 'rejected', reason }] };
}
