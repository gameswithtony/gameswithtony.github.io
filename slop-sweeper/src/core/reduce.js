// @ts-check
// The reducer: init(level, seed), reduce(state, action) → { s, ev }, legalActions().
// Pure — the input state is never mutated; a draft is cloned and returned. The tick
// pipeline runs in the exact order of PLAN §7.1 and nothing here knows what a frame is.

import { RULES, LEVEL_DEFAULTS } from './rules.js';
import {
  CON_HAND, CON_NONE, conCaps, isHandBuildable, levelParams, setLevelParams, stopsBlast,
} from './state.js';
import { emptyCon, n4, n8, parseMap } from './grid.js';
import { distField, gateOpen, stepCandidates } from './routing.js';
import { drawShape, legalPlacements, placementCells, rollMines } from './generate.js';
import { fromState, initStreams } from './rng.js';
import { assertValidLevel } from './validate.js';

/** @typedef {import('./state.js').GameState} GameState */
/** @typedef {import('./state.js').Action} Action */
/** @typedef {import('./state.js').ActionKind} ActionKind */
/** @typedef {import('./state.js').Con} Con */
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
  assertValidLevel(def);
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
    case 'generate': {
      // Not turn-consuming by itself: the turn charges at placeBlock, and an empty legal
      // set refunds outright (SPEC §4.2). A refund returns the input state untouched — the
      // generation stream does not advance — so pressing Generate again on a boxed-in board
      // offers the same shape rather than a free reroll.
      if (s.phase.k !== 'play') return rejected(s, `cannot generate during phase '${s.phase.k}'`);
      const gen = fromState(s.rng.gen);
      const shape = drawShape(gen, levelParams(s).shapePool);
      // Every distinct rotation is kept, anchors or not, so `rot` stays both an index into
      // `phase.rots` and the quarter-turn count a renderer draws (see shapes.rotationsOf).
      // A rotation that fits nowhere simply highlights nothing.
      const rots = legalPlacements(s, shape);
      if (rots.every((r) => r.anchors.length === 0)) return { s, ev: [{ t: 'generateRefunded' }] };
      const d = draft(s);
      d.rng.gen = gen.getState();
      d.phase = { k: 'placing', shape, rots };
      return { s: d, ev: [{ t: 'blockDrawn', shape, rots }] };
    }
    case 'placeBlock': {
      if (s.phase.k !== 'placing') return rejected(s, `nothing has been generated (phase '${s.phase.k}')`);
      const rots = s.phase.rots;
      if (!Number.isInteger(a.rot) || a.rot < 0 || a.rot >= rots.length) return rejected(s, `rotation ${a.rot} was not drawn`);
      const rot = rots[a.rot];
      if (!rot.anchors.includes(a.cell)) return rejected(s, `cell ${a.cell} is not a legal anchor for rotation ${a.rot}`);
      const cells = placementCells(s, a.cell, rot.cells);
      if (!cells) return rejected(s, `cell ${a.cell} is not a legal anchor for rotation ${a.rot}`);

      const d = draft(s);
      const gen = fromState(d.rng.gen);
      const mines = rollMines(gen, cells, levelParams(d).mineDensity);
      d.rng.gen = gen.getState();
      const block = d.blocks.length;
      for (const c of cells) d.con[c] = { k: 'aiHidden', mine: mines.has(c), block };
      d.blocks.push({ id: block, cells: cells.slice() });
      d.phase = { k: 'play' };
      d.stats.generated++;
      /** @type {Ev[]} */
      const ev = [
        { t: 'placed', cells: cells.slice() },
        { t: 'blockPlaced', block, cells: cells.slice(), mines: mines.size },
      ];
      return { s: runTick(d, ev), ev };
    }
    case 'analyze': {
      const reason = analyzeRejection(s, a.cell);
      if (reason) return rejected(s, reason);
      const d = draft(s);
      /** @type {number[]} */
      const revealed = [];
      /** @type {number[]} */
      const minesFound = [];
      for (const c of analyzeOrder(d, a.cell, levelParams(d).analyzeReveals)) {
        const con = /** @type {{ k: 'aiHidden', mine: boolean, block: number }} */ (d.con[c]);
        if (con.mine) {
          // A mined tile can never become AI_REVEALED (SPEC §2.2 defines that state safe),
          // and skipping it silently would leak by omission — so it is confirmed, and it
          // does not blast (PLAN §3.1).
          d.con[c] = { k: 'mineConfirmed', block: con.block };
          minesFound.push(c);
        } else {
          d.con[c] = { k: 'aiRevealed', block: con.block };
          revealed.push(c);
        }
      }
      d.stats.analyzed++;
      /** @type {Ev[]} */
      const ev = [{ t: 'analyzed', revealed, minesFound }];
      return { s: runTick(d, ev), ev };
    }
    case 'wait': {
      // Not even waiting is on offer once a block is drawn (SPEC §4.2: no decline).
      if (s.phase.k !== 'play') return rejected(s, `cannot wait during phase '${s.phase.k}'`);
      const d = draft(s);
      d.stats.waited++;
      /** @type {Ev[]} */
      const ev = [];
      return { s: runTick(d, ev), ev };
    }
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
  if (s.phase.k === 'placing') {
    // No preview, no decline, no reroll — a state-machine property, not a UI courtesy
    // (SPEC §4.2). Once a block is drawn the only verb in the game is placing it.
    if (cell === undefined || s.phase.rots.some((r) => r.anchors.includes(cell))) out.push('placeBlock');
    return out;
  }
  if (s.phase.k !== 'play') return out;
  if (cell === undefined) {
    out.push('generate', 'wait');
    return out;
  }
  if (!placeRejection(s, cell)) out.push('place');
  if (!analyzeRejection(s, cell)) out.push('analyze');
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

/**
 * @param {GameState} s
 * @param {number} cell
 * @returns {string} empty when the cell can be analyzed (SPEC §4.3)
 */
export function analyzeRejection(s, cell) {
  if (s.phase.k !== 'play') return `cannot analyze during phase '${s.phase.k}'`;
  if (!Number.isInteger(cell) || cell < 0 || cell >= s.w * s.h) return `cell ${cell} is off the board`;
  if (s.con[cell].k !== 'aiHidden') return 'only unreviewed AI tiles can be analyzed';
  return '';
}

// --- derived information: nothing clue-shaped is ever stored (PLAN §3.5) --------------

/**
 * @param {GameState} s
 * @param {number} i
 * @returns {boolean}
 */
export function cellHasMine(s, i) {
  const con = s.con[i];
  if (!conCaps(con).holdsMine) return false;
  return con.k === 'mineConfirmed' ? true : /** @type {{ mine: boolean }} */ (con).mine;
}

/**
 * Mines in the 8-neighbourhood (SPEC §7.4), counted from the current mine set every time it
 * is asked — so a blast that silently deletes mines lowers the clues around it, and the
 * never-wrong rule (SPEC §7.2) holds without any invalidation logic. Ocean, void, volcano,
 * hand, revealed and the endpoints all contribute zero by capability (SPEC §7.5).
 * Exact tier for the prototype, hence `lo === hi`; the [lo, hi] plumbing ships now so the
 * skill tiers of SPEC §7.2 are purely additive later.
 * @param {GameState} s
 * @param {number} i
 * @returns {{ lo: number, hi: number }}
 */
export function clue(s, i) {
  let n = 0;
  for (const j of n8(s, i)) if (cellHasMine(s, j)) n++;
  return { lo: n, hi: n };
}

/**
 * The live mine count behind a block's badge (PLAN §3.5) — derived, never stored, so it
 * drops when a blast takes cells away.
 * @param {GameState} s
 * @param {number} blockId
 * @returns {number}
 */
export function blockMines(s, blockId) {
  const b = s.blocks[blockId];
  if (!b) return 0;
  let n = 0;
  for (const c of b.cells) if (cellHasMine(s, c)) n++;
  return n;
}

/**
 * The detonation footprint: a `blastRadius`-step 4-way flood fill from the trigger through
 * terrain whose caps allow blast (SPEC §5). VOLCANO and VOID stop it through the same table
 * lookup as every other feature — there is no special case here to remove. Exported because
 * the UI previews it on a selected mine (SPEC §10.6).
 * @param {GameState} s
 * @param {number} i
 * @returns {number[]} ascending cell indices, trigger included
 */
export function blastArea(s, i) {
  const radius = levelParams(s).blastRadius;
  /** @type {Set<number>} */
  const seen = new Set([i]);
  let frontier = [i];
  for (let step = 0; step < radius && frontier.length; step++) {
    /** @type {number[]} */
    const next = [];
    for (const c of frontier) {
      for (const j of n4(s, c)) {
        if (seen.has(j) || stopsBlast(s.terrain[j])) continue;
        seen.add(j);
        next.push(j);
      }
    }
    frontier = next;
  }
  return [...seen].sort((a, b) => a - b);
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
    traversal(d, ev);
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
  d.rng.move = move.getState();
}

/**
 * Step 4 — traversal resolution. Every `aiHidden` cell a user is now standing on either
 * reveals or detonates, processed in cell-index order so stacked users can never make the
 * outcome depend on user ids (SPEC §5).
 * @param {GameState} d
 * @param {Ev[]} ev
 */
function traversal(d, ev) {
  /** @type {Set<number>} */
  const occupied = new Set();
  for (const u of d.users) {
    if (u.state === 'moving' && d.con[u.at].k === 'aiHidden') occupied.add(u.at);
  }
  if (occupied.size === 0) return;

  /** @type {Set<number>} cells already taken out this tick — later blasts skip them (§7.1.4) */
  const destroyed = new Set();
  let blew = false;
  for (const c of [...occupied].sort((a, b) => a - b)) {
    const con = d.con[c];
    if (con.k !== 'aiHidden') continue;         // an earlier blast this tick already took it
    if (!con.mine) {
      d.con[c] = { k: 'aiRevealed', block: con.block };
      ev.push({ t: 'reveal', cell: c });
      continue;
    }
    detonate(d, ev, c, destroyed);
    blew = true;
  }

  if (!blew) return;
  // PLAN §7.1.3: the distance field is stale the moment ground disappears. Recompute it and
  // re-mark anyone whose route was severed after they had already stepped, so SPEC §6.4's
  // waiting count is right on the tick of the blast rather than the tick after.
  const fresh = distField(d);
  for (const u of d.users) {
    if (u.state === 'moving' && fresh[u.at] < 0) u.stalled = true;
  }
}

/**
 * @param {GameState} d
 * @param {Ev[]} ev
 * @param {number} at
 * @param {Set<number>} destroyed
 */
function detonate(d, ev, at, destroyed) {
  /** @type {number[]} */
  const gone = [];
  /** @type {number[]} */
  const minesLost = [];
  for (const c of blastArea(d, at)) {
    if (c === d.origin || c === d.dest) continue;   // endpoints are indestructible (PLAN §3.8)
    if (destroyed.has(c)) continue;
    if (!conCaps(d.con[c]).occupies) continue;
    // Other mines in the area go silently: one user, one incident, no chains (SPEC §5).
    if (cellHasMine(d, c)) minesLost.push(c);
    d.con[c] = CON_NONE;
    destroyed.add(c);
    gone.push(c);
  }

  const lost = new Set(gone);
  for (const b of d.blocks) {
    if (b.cells.some((c) => lost.has(c))) b.cells = b.cells.filter((c) => !lost.has(c));
  }

  // Everyone standing in the hole goes back to the start, the triggerer included
  // (PLAN §3.4). Users elsewhere whose route was severed stay put and strand (SPEC §6.4).
  for (const u of d.users) {
    if (u.state !== 'moving' || !lost.has(u.at)) continue;
    u.state = 'queued';
    u.at = d.origin;
    u.visited = [];
    u.stalled = false;
    ev.push({ t: 'requeued', user: u.id });
  }

  d.stats.detonations++;
  d.confidence -= RULES.DETONATE_HIT;
  ev.push({ t: 'detonate', at, destroyed: gone, minesLost });
  ev.push({ t: 'confidence', delta: -RULES.DETONATE_HIT, reason: 'detonation' });
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
  // the meter.
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
 * BFS 4-way from the chosen target across the contiguous `aiHidden` region only — "you
 * review this module", never the one next door (PLAN §3.2). Each frontier is walked in
 * ascending cell order so the budget cuts the same way every time. The region is fixed
 * before any tile changes, so a mine confirmed mid-walk does not wall off the rest of it.
 * @param {GameState} s
 * @param {number} target
 * @param {number} budget
 * @returns {number[]}
 */
function analyzeOrder(s, target, budget) {
  /** @type {number[]} */
  const order = [];
  /** @type {Set<number>} */
  const seen = new Set([target]);
  let frontier = [target];
  while (frontier.length && order.length < budget) {
    for (const c of frontier) {
      if (order.length >= budget) break;
      order.push(c);
    }
    /** @type {number[]} */
    const next = [];
    for (const c of frontier) {
      for (const j of n4(s, c)) {
        if (seen.has(j) || s.con[j].k !== 'aiHidden') continue;
        seen.add(j);
        next.push(j);
      }
    }
    next.sort((a, b) => a - b);
    frontier = next;
  }
  return order;
}

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
