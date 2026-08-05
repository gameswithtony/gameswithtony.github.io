// @ts-check
// The reducer: init(level, seed), reduce(state, action) → { s, ev }, legalActions().
// Pure — the input state is never mutated; a draft is cloned and returned. The tick
// pipeline runs in the exact order of PLAN §7.1 and nothing here knows what a frame is.

import { LEVEL_DEFAULTS } from './rules.js';
import {
  CON_BETA, CON_HAND, CON_NONE, conCaps, destIndex, effectiveMask, everyDest, isEndpoint,
  isFlagged, isHandBuildable, levelParams, patienceLimit, setLevelParams, stopsBlast,
} from './state.js';
import { arrivalCount, castFor } from './casting.js';
import { emptyCon, n4, n8, parseMap } from './grid.js';
import { canProgress, gateOpen, stepCandidates, waypointFields } from './routing.js';
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
  const arrivals = def.arrivals ?? LEVEL_DEFAULTS.arrivals;
  /** @type {LevelParams} */
  const params = {
    arrivals,
    mineDensity: def.mineDensity ?? LEVEL_DEFAULTS.mineDensity,
    patience: def.patience ?? LEVEL_DEFAULTS.patience,
    betaSupply: def.betaSupply ?? LEVEL_DEFAULTS.betaSupply,
    itineraries: def.itineraries ?? LEVEL_DEFAULTS.itineraries,
    walkers: def.walkers ?? LEVEL_DEFAULTS.walkers,
    // THE DEAL, and the only line in `init` that is a function of the seed as well as the
    // level (owner decision 2026-08-05, SPEC §6.6). It draws on a private stream created and
    // dropped inside `casting.js`, so `s.rng` below is the pair it has always been and every
    // game that predates casting replays unchanged. It is re-derived rather than stored: a
    // restore boots the definition, re-associates these parameters (ui/main.js), and gets this
    // identical array back, because it is a pure function of two things a save already carries.
    cast: castFor(def, m.dests.length, arrivals, seed >>> 0),
    destRefill: def.destRefill ?? LEVEL_DEFAULTS.destRefill,
    shapePool: def.shapePool ?? LEVEL_DEFAULTS.shapePool,
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
    dests: m.dests,
    blocks: [],
    users: [],
    // THE SCHEDULE SHAPE DID NOT MOVE (owner decision 2026-08-05, SPEC §6.1). Explicit arrival
    // turns are a second way to *write* a schedule, not a second thing to store: `total` and
    // `nextTick` mean exactly what they meant, and `spawns` advances `nextTick` down the
    // authored list instead of by a cadence. `every` is 0 on that form and that is the honest
    // answer rather than a placeholder — a listed schedule has no cadence, nothing divides by
    // it, and a number that claimed one would be a lie the hash would then carry around.
    schedule: {
      total: arrivalCount(arrivals),
      spawned: 0,
      nextTick: arrivals.at ? arrivals.at[0] : arrivals.firstTick,
      every: arrivals.at ? 0 : arrivals.every,
    },
    phase: { k: 'play' },
    rng: initStreams(seed),
    stats: {
      placed: 0, generated: 0, analyzed: 0, waited: 0, detonations: 0, served: 0, lost: 0, betas: 0,
    },
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
    case 'beta': {
      // Ship a beta milestone (SPEC §4.7, user decision 2026-08-05). Mechanically this is a
      // hand tile with a different job: the same target rules, the same one turn, and then
      // the same tick pipeline — the difference is entirely in `routing.js`, where the cell
      // becomes somewhere users are willing to walk to and stop. Supply is the only new
      // rule, and it lives in `betaRejection` beside the rules it extends.
      const reason = betaRejection(s, a.cell);
      if (reason) return rejected(s, reason);
      const d = draft(s);
      d.con[a.cell] = CON_BETA;
      d.stats.betas++;
      /** @type {Ev[]} */
      const ev = [{ t: 'betaPlaced', cell: a.cell }];
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
      for (const c of cells) d.con[c] = { k: 'aiHidden', mine: mines.has(c), block, flagged: false };
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
      const target = /** @type {{ k: 'aiHidden', mine: boolean, block: number }} */ (d.con[a.cell]);
      d.stats.analyzed++;
      /** @type {Ev[]} */
      const ev = [];
      if (target.mine) {
        // IT GOES OFF (user decision 2026-08-04, superseding PLAN §3 ruling 1's no-blast
        // rationale). You pointed at it and clicked; that is minesweeper, and it is the same
        // incident as a user stepping on it — the identical `detonate()` below, so the same
        // events, the same crater, the same hit. `stats.analyzed` still counts the turn: the
        // review happened, it just went badly. No cascade, obviously.
        //
        // Ordering (PLAN §7.1): the blast is step 1, the player action. `runTick` then runs
        // departures and movement over a distance field computed after the ground moved, so
        // anyone the crater stranded stalls on this tick rather than the next one.
        detonate(d, ev, a.cell, new Set());
      } else {
        /** @type {number[]} */
        const revealed = [];
        revealTile(d, a.cell, revealed);
        cascade(d, a.cell, revealed);
        // `minesFound` can no longer be anything but empty — a found mine is a detonation,
        // not a discovery. The field stays in the event so the Ev shape (and the renderer
        // reading it) is unchanged; see PLAN §3 ruling 1.
        ev.push({ t: 'analyzed', revealed, minesFound: [] });
      }
      return { s: runTick(d, ev), ev };
    }
    case 'flag': {
      // The one free verb (SPEC §4.5). Like the generate *draw*, it changes the board
      // without running the tick pipeline: no movement, no spawn, no drain, no tick++.
      // Flagging is therefore never a tempo cost — its cost is that users refuse to walk
      // through the flag, which can close the gate you were relying on.
      const reason = flagRejection(s, a.cell);
      if (reason) return rejected(s, reason);
      const d = draft(s);
      const con = /** @type {{ k: 'aiHidden', mine: boolean, block: number, flagged: boolean }} */ (d.con[a.cell]);
      const on = !con.flagged;
      d.con[a.cell] = { k: 'aiHidden', mine: con.mine, block: con.block, flagged: on };
      return { s: d, ev: [{ t: 'flagged', cell: a.cell, on }] };
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
  // Wherever Place is legal, so is a beta while any supply is left — same target rules, same
  // cost, different job (SPEC §4.7). It is offered after Place because Place is the verb the
  // player reaches for on that cell nine times in ten.
  if (!betaRejection(s, cell)) out.push('beta');
  if (!analyzeRejection(s, cell)) out.push('analyze');
  if (!flagRejection(s, cell)) out.push('flag');
  return out;
}

/**
 * Revised 2026-08-04 (user decision, overriding SPEC §4.1): the branch test now accepts
 * **any** structure — unreviewed slop included, flagged or not. The target-cell rules are
 * untouched: ocean terrain, nothing built there, not an endpoint, 4-adjacent to the network.
 * The rule that a hand tile could not branch from `aiHidden` existed to teach AI dependency
 * by absence; risk now teaches it instead, and the player can always build a legal path.
 * @param {GameState} s
 * @param {number} cell
 * @returns {string} empty when the placement is legal (SPEC §4.1)
 */
export function placeRejection(s, cell) {
  if (s.phase.k !== 'play') return `cannot place during phase '${s.phase.k}'`;
  return handTargetRejection(s, cell);
}

/**
 * The target rules every hand-placed construction shares: ocean terrain, nothing built there,
 * not an endpoint, 4-adjacent to the network. Factored out on 2026-08-05 so `beta` (SPEC
 * §4.7) is placed by the *same code* as a hand tile rather than by a copy of it — "exactly
 * like a hand tile" is a rule that only stays true if there is one implementation of it.
 * Phase and per-verb costs stay with the verbs; this is the board's part of the question.
 * @param {GameState} s
 * @param {number} cell
 * @returns {string} empty when the cell can be built on
 */
function handTargetRejection(s, cell) {
  if (!Number.isInteger(cell) || cell < 0 || cell >= s.w * s.h) return `cell ${cell} is off the board`;
  if (isEndpoint(s, cell)) return 'endpoints are not buildable';
  if (!isHandBuildable(s.terrain[cell], s.con[cell])) {
    return conCaps(s.con[cell]).occupies ? 'cell is already built' : `cannot build on ${s.terrain[cell]}`;
  }
  for (const j of n4(s, cell)) {
    if (isEndpoint(s, j)) return '';
    if (conCaps(s.con[j]).handFrom) return '';
  }
  return 'must touch an endpoint or a tile that is already built';
}

/**
 * Ship a beta milestone (SPEC §4.7, user decision 2026-08-05). Identical target rules to
 * `placeRejection` — a beta lands on empty ocean touching the network, and occupancy is what
 * stops it landing on anything at all, another beta included. The one rule it adds is the
 * supply: `stats.betas` counts what has been shipped and never comes back down, so a beta a
 * blast takes out is spent, not returned. A level with `betaSupply: 0` simply never offers
 * the verb.
 * @param {GameState} s
 * @param {number} cell
 * @returns {string} empty when a beta can be shipped here
 */
export function betaRejection(s, cell) {
  if (s.phase.k !== 'play') return `cannot ship a beta during phase '${s.phase.k}'`;
  if (s.stats.betas >= levelParams(s).betaSupply) return 'no beta supply remaining';
  return handTargetRejection(s, cell);
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
  // Classic misclick protection: your own flag says "I believe this is a defect", so the
  // game makes you withdraw the claim before it will spend a turn testing it.
  if (isFlagged(s.con[cell])) return 'this tile is flagged — unflag it first';
  return '';
}

/**
 * @param {GameState} s
 * @param {number} cell
 * @returns {string} empty when the flag can be toggled (SPEC §4.5)
 */
export function flagRejection(s, cell) {
  if (s.phase.k !== 'play') return `cannot flag during phase '${s.phase.k}'`;
  if (!Number.isInteger(cell) || cell < 0 || cell >= s.w * s.h) return `cell ${cell} is off the board`;
  if (s.con[cell].k !== 'aiHidden') return 'only unreviewed AI tiles can be flagged';
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
    // One field set per movement phase, exactly where the plain distance field used to be
    // computed (PLAN §7.1.3). Since 2026-08-05 it is the *waypoint* field: users walk to the
    // nearest waypoint their component owns rather than to B unconditionally; and since the
    // itinerary revision later the same day there is one such field per distinct remaining
    // list among the live users, because "the nearest waypoint" is only a question once you
    // say nearest to *whom*. On a level with one destination that is one list, one field, one
    // computation — the distance field, cell for cell, as it always was.
    const fields = waypointFields(d);
    departures(d, ev, fields);
    movement(d, ev, fields);
    traversal(d, ev);
  }
  // Step 5 — stranding: users with no remaining path simply stall each tick and are
  // already counted as waiting below (SPEC §6.4). No extra state needed.
  spawns(d, ev);
  patience(d, ev);
  d.tick++;
  return d;
}

/**
 * All queued users with an open path depart at once — the flush when a path completes is
 * the feedback (PLAN §3.9). Users spawned this tick gate next tick.
 *
 * "An open path" now means "somewhere worth walking to" (SPEC §6.2, rev. 2026-08-05): B, or
 * a beta staged between here and B. Which is the same sentence when there is no beta.
 *
 * The gate is asked once **per queued user** since itineraries (rev. 2026-08-05), against
 * that user's own field, because two users at the same origin on the same tick may owe
 * different destinations and the route to one of them can be open while the other is not. On
 * a level where everyone carries the same list this is one question, asked N times, with one
 * answer — the flush, unchanged.
 *
 * "That user's own field" is `effectiveMask(u)`'s field since ordered itineraries (rev.
 * 2026-08-05), which is where enforcement starts: an ordered user whose next stop is walled off
 * stays at the origin **even when a later stop on its list is wide open**, because the later
 * stop is not on the mask and the gate never hears about it. It burns patience standing there,
 * exactly like anybody else the board is not ready for.
 * @param {GameState} d
 * @param {Ev[]} ev
 * @param {import('./routing.js').FieldSet} fields
 */
function departures(d, ev, fields) {
  for (const u of d.users) {
    if (u.state !== 'queued') continue;
    if (!gateOpen(d, fields.for(effectiveMask(u)))) continue;
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
 * @param {import('./routing.js').FieldSet} fields
 */
function movement(d, ev, fields) {
  const move = fromState(d.rng.move);
  const { destRefill } = levelParams(d);
  for (const u of d.users) {
    if (u.state !== 'moving') continue;
    const wf = fields.for(effectiveMask(u));
    u.stalled = false;
    // The progress guard is asked BEFORE the move stream is touched, and the ordering is
    // load-bearing rather than tidy: a user held in place by it must draw no random number,
    // or a board with a beta on it would consume the movement stream at a different rate
    // from one without and every no-beta replay would diverge (PLAN §7.5). A user standing
    // on its own target beta fails here, which is what "camping" is made of.
    if (!canProgress(d, wf, u.at)) {
      u.stalled = true;
      continue;
    }
    let options = stepCandidates(d, wf.dist, u.at, u.visited);
    if (options.length === 0 && wf.hasBeta) {
      // RETRY ON A FRESH TRIP. The no-revisit trail (SPEC §6.3.3) exists to stop a user
      // looping inside one trip. When the guard says progress is available and the trail is
      // the only thing in the way, the trip the trail belongs to is over: the waypoint set
      // moved under the walker — a beta was shipped, one was destroyed, a road reached a
      // better one — and it is starting a new walk to a new place. So it forgets where it
      // has been and goes.
      //
      // It cannot oscillate. Every step still strictly decreases the current field, and only
      // a player turn can change that field, so a user can never be handed back a target it
      // just left by its own movement.
      //
      // SCOPED TO BOARDS THAT CARRY A BETA, deliberately, and this is the one place the beta
      // work touches a rule that predates it. A trail can go stale without any beta in sight
      // — finish a road behind a walker and the gradient reverses under it, and today that
      // user stalls where it stands until its patience runs out. Letting the retry loose on
      // those boards measurably changes games with no beta in them (it costs `plain`/genRush
      // its remaining `gaveUp` and buys `killed` instead), and a no-beta game must play
      // exactly as it played before this feature existed. Relaxing §6.3.3 in general is a
      // real and probably good change; it is a different one, and it is the spec owner's.
      //
      // Itineraries (2026-08-05) did not widen the scope, and did not need to: the one way a
      // multi-destination walker's own waypoint set moves under it is by reaching a stop, and
      // `visit` starts the fresh trail there and then. A stale trail from any *other* cause
      // still strands a walker on a beta-free board, exactly as it always did.
      options = stepCandidates(d, wf.dist, u.at, [u.at]);
      if (options.length > 0) u.visited = [u.at];
    }
    if (options.length === 0) {
      u.stalled = true;
      continue;
    }
    const to = options.length === 1 ? options[0] : options[Math.floor(move() * options.length)];
    ev.push({ t: 'step', user: u.id, from: u.at, to });
    u.at = to;
    u.visited.push(to);
    visit(d, ev, u, to, destRefill);
  }
  d.rng.move = move.getState();
}

/**
 * **Visit on contact** (user decision 2026-08-05, SPEC §6). Stepping onto a destination that
 * is still on the walker's list ticks it off *there and then* — whether or not it was the
 * waypoint the field was steering toward. A user routed to C that happens to cross B on the
 * way has been to B, and pretending otherwise would mean walking it back later to stand on a
 * cell it has already stood on, which nobody would believe.
 *
 * Stepping onto a destination that is **not** on the list does nothing at all: no event, no
 * refill, no bookkeeping. It is a passable cell, and that is the whole of its behaviour.
 *
 * The last stop is arrival, priced exactly as arrival always was — `arrived`, `stats.served++`
 * — so a one-destination level reaches this function on its one and only visit and leaves it
 * having done precisely what the old two lines did. Everything else here is unreachable
 * without a second destination on the board.
 *
 * The intermediate case pays the patience refill (RULES.DEST_REFILL) and starts a fresh trail.
 * The trail reset is the no-revisit rule (SPEC §6.3.3) read correctly rather than a special
 * case: that rule stops a user looping **inside one trip**, and reaching a destination is the
 * end of a trip. Without it a user that walks A→B would be forbidden from retracing any of it
 * on the way to C, which on most geometries means it stands on B until its patience runs out.
 *
 * **ORDERED ITINERARIES ARE ENFORCED HERE** (owner decision 2026-08-05, SPEC §6.5), and this is
 * the one line of the feature that is not just a mask. For an ordered user only `todo[0]` is a
 * stop; a later one on its own list is a cell it walks over and nothing more — no tick-off, no
 * refill, no trail reset, no event. That is what ordering *means*: a user told to see B, then C,
 * then D does not get credit for wandering past D on the way to B, and it will have to come
 * back. Contact with a destination it never owed is unchanged and was already nothing.
 *
 * **HALF A BAR MEANS HALF OF *THIS WALKER'S* BAR** (owner decision 2026-08-05, SPEC §6.6). The
 * refill is `round(limit × destRefill)` and `limit` is now `patienceLimit(d, u)` rather than the
 * level's number: a walker cast with a twelve-tick bar gets six back at a stop, not thirteen.
 * Any other reading makes the refill a bigger fraction of a short bar than of a long one, which
 * would hand the impatient walkers — the ones a cast writes *because* they are fragile — the
 * largest relief in the game. On a level whose cast sets no override the two expressions are the
 * same number, so nothing measured before today moves.
 * @param {GameState} d
 * @param {Ev[]} ev
 * @param {User} u
 * @param {number} cell   the cell just stepped onto
 * @param {number} refill the level's destRefill
 */
function visit(d, ev, u, cell, refill) {
  const di = destIndex(d, cell);
  if (di < 0) return;
  const k = u.todo.indexOf(di);
  if (k < 0) return;
  if (u.ordered && k !== 0) return;

  u.todo.splice(k, 1);
  if (u.todo.length === 0) {
    u.state = 'arrived';
    d.stats.served++;
    ev.push({ t: 'arrived', user: u.id });
    return;
  }
  u.waited = Math.max(0, u.waited - Math.round(patienceLimit(d, u) * refill));
  u.visited = [cell];
  ev.push({ t: 'visited', user: u.id, dest: cell });
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
  // PLAN §7.1.3: the field is stale the moment ground disappears. Recompute it and re-mark
  // anyone the crater stranded after they had already stepped, so SPEC §6.4's waiting count
  // is right on the tick of the blast rather than the tick after.
  //
  // The stall test is the general one (rev. 2026-08-05): a user is stranded when it cannot
  // progress, which is now three things at once — nothing to walk to (`dist` -1), standing on
  // the thing it was walking to (`dist` 0, i.e. a beta whose blast-mates are gone), or a
  // target that is no longer ahead of it. With no beta the first case is the only reachable
  // one, which is the `fresh[u.at] < 0` test this replaces.
  //
  // Asked per user against that user's own remaining list, and against a *freshly* built field
  // set, because a user that ticked a destination off earlier in this same tick is carrying a
  // list nobody was carrying when the tick began. (The old `u.at === d.dest` skip went with
  // it: a user standing on a destination is either arrived — and not `moving` — or standing on
  // one it has already visited, which is a passable cell and gets the general test like any
  // other.)
  const fresh = waypointFields(d);
  for (const u of d.users) {
    if (u.state !== 'moving') continue;
    const wf = fresh.for(effectiveMask(u));
    if (wf.dist[u.at] <= 0 || !canProgress(d, wf, u.at)) u.stalled = true;
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
    if (isEndpoint(d, c)) continue;                 // endpoints are indestructible (PLAN §3.8)
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

  // Everyone standing in the hole is KILLED, the triggerer included (PLAN §3 ruling 4,
  // revised 2026-08-04: they used to re-queue). The trigger cell is inside `blastArea`, so
  // the triggerer is covered by the same set as the bystanders — no special case. Users
  // elsewhere whose route was severed simply stall, and their patience runs down (§6.4).
  for (const u of d.users) {
    if (u.state !== 'moving' || !lost.has(u.at)) continue;
    u.state = 'gone';
    u.stalled = false;
    d.stats.lost++;
    ev.push({ t: 'userLost', user: u.id, at: u.at, reason: 'detonation' });
  }

  d.stats.detonations++;
  ev.push({ t: 'detonate', at, destroyed: gone, minesLost });
}

/**
 * @param {GameState} d
 * @param {Ev[]} ev
 */
function spawns(d, ev) {
  const sc = d.schedule;
  const { arrivals, cast } = levelParams(d);
  while (sc.spawned < sc.total && d.tick >= sc.nextTick) {
    const { todo, ordered } = itineraryFor(d, cast[d.users.length]);
    /** @type {User} */
    const u = {
      id: d.users.length,
      at: d.origin,
      state: 'queued',
      todo,
      visited: [],
      stalled: false,
      waited: 0,
      // Written explicitly, `false` included, so a state this build produced always states its
      // answer rather than implying it. Reads never rely on that — `ordered` is optional and
      // absent means false, which is what lets a save from before the feature revive as itself
      // (state.js, PLAN §11.10).
      ordered,
    };
    d.users.push(u);
    sc.spawned++;
    // Two schedules, two ways to find the next turn, and the cadence branch is character for
    // character the line it always was — the explicit form reads the turn straight off the
    // list it was authored as. Past the end of the list `nextTick` is left where it stands,
    // which nothing observes: the loop guard `spawned < total` has already closed.
    sc.nextTick = arrivals.at ? (arrivals.at[sc.spawned] ?? sc.nextTick) : sc.nextTick + sc.every;
    ev.push({ t: 'spawned', user: u.id });
  }
}

/**
 * Which destinations this user was born owing (user decision 2026-08-05, SPEC §6).
 *
 * **Cast, not cycled** (owner decision 2026-08-05, SPEC §6.6 — supersedes the round-robin this
 * function was written for). The level's roles are dealt against the arrival count once, at
 * `init`, on a private stream; `casting.js` owns that entirely and this function is handed the
 * one entry belonging to this spawn. So the demand is still fixed and forecastable from turn
 * one — the whole cast exists before the first user walks — and it is no longer the *same* hand
 * every game, which is the change: a level replayed is a level that asks in a different order,
 * and on an oversized cast sometimes asks different questions altogether.
 *
 * **No entry means the whole map.** An empty cast is what `LEVEL_DEFAULTS` hands back for a
 * state whose parameters were never associated, and it means what the empty itinerary list
 * always meant: every destination, ascending, loose. On a one-destination level that is "this
 * user owes B", which is the game every level shipped before any of this existed.
 *
 * **Two shapes, one deal** (owner decision 2026-08-05, SPEC §6.5). A cast entry's `stops` is
 * either a set of obligations, taken in whatever order the walk finds them and stored ascending
 * because the order carries no meaning — or, with `ordered: true`, a **sequence**: stored in the
 * order the author wrote it, because now the order is the whole content, and `todo[0]` is the
 * only stop that is live. The deal is blind to which shape it just handed out; a level may mix
 * the two freely, which `delta` does.
 *
 * @param {GameState} d
 * @param {import('./rules.js').WalkerDef} [entry]  this spawn's cast entry, if there is one
 * @returns {{ todo: number[], ordered: boolean }} indexes into `d.dests`: ascending when the
 *   list is loose, authored order when it is ordered
 */
function itineraryFor(d, entry) {
  if (!entry) return { todo: everyDest(d), ordered: false };
  const todo = entry.stops.map((ch) => ch.charCodeAt(0) - 'B'.charCodeAt(0));
  if (entry.ordered !== true) return { todo: todo.sort((a, b) => a - b), ordered: false };
  return { todo, ordered: true };
}

/**
 * Step 7 — patience, and the end of the game. Replaces the confidence meter entirely (user
 * decision 2026-08-04; SPEC §8, PLAN §3 rulings 3/4/11).
 *
 * **Waiting is not moving.** Gated at the origin, stalled mid-route, or stranded behind a
 * crater are the same thing to the person standing there, exactly as SPEC §6.4 always said —
 * what changed is what it costs. `waited` is cumulative and never resets, so a route that
 * keeps stalling bleeds the same user out over the whole game rather than forgiving them
 * every time it briefly clears. At `patience` the user gives up and is gone for good; there
 * is no way to get them back.
 *
 * Stranding needs no special case any more, which is the tidiest thing about this design: a
 * stranded user is a blocked user, blocked is waiting, and patience resolves it.
 *
 * **The bar is per walker since casting** (owner decision 2026-08-05, SPEC §6.6): the limit is
 * asked of `patienceLimit(d, u)` inside the loop rather than hoisted out of it, because it is
 * now a property of the person and not of the level. On a level whose cast sets no override the
 * helper returns `levelParams(d).patience` for everybody and this is the same loop it was.
 * @param {GameState} d
 * @param {Ev[]} ev
 */
function patience(d, ev) {
  for (const u of d.users) {
    if (u.state !== 'queued' && !(u.state === 'moving' && u.stalled)) continue;
    u.waited++;
    if (u.waited < patienceLimit(d, u)) continue;
    u.state = 'gone';
    u.stalled = false;
    d.stats.lost++;
    ev.push({ t: 'userLost', user: u.id, at: u.at, reason: 'gaveUp' });
  }

  // The level ends when every scheduled user has resolved one way or the other. Score is
  // the arrivals; one is enough to call it a win, and the goal is all of them.
  if (d.schedule.spawned < d.schedule.total) return;
  if (!d.users.every((u) => u.state === 'arrived' || u.state === 'gone')) return;
  const served = d.stats.served;
  const total = d.schedule.total;
  d.phase = served >= 1 ? { k: 'won' } : { k: 'lost' };
  ev.push({ t: served >= 1 ? 'won' : 'lost', served, total });
}

// --- helpers ------------------------------------------------------------------------

/**
 * Flip one unmined `aiHidden` tile to `aiRevealed` and book it.
 * @param {GameState} d
 * @param {number} cell
 * @param {number[]} revealed
 */
function revealTile(d, cell, revealed) {
  const con = /** @type {{ k: 'aiHidden', mine: boolean, block: number }} */ (d.con[cell]);
  d.con[cell] = { k: 'aiRevealed', block: con.block };
  revealed.push(cell);
}

/**
 * The classic minesweeper zero-cascade (SPEC §4.3, revised 2026-08-04).
 *
 * Analyze is now one click on one tile. If that tile's clue is exactly zero it has no mined
 * 8-neighbour *by definition of the clue*, so every hidden neighbour is provably safe and
 * may be opened for free; a neighbour that is itself a zero repeats the argument. That is
 * the entire proof, and it is why the cascade needs no solver and can never blow up: it is
 * a closure over cells whose safety is a theorem, not a guess.
 *
 * Flagged tiles are skipped, exactly as minesweeper does — the flag is the player's claim
 * that the tile is a defect, and the cascade honours it rather than overruling it. (A flag
 * on a safe tile therefore *stops* a cascade that would have opened it. That is the player's
 * mistake to make; unflag and click again.)
 *
 * Frontiers are walked in ascending cell order so the reveal list is a pure function of the
 * board. The cascade never leaves the contiguous hidden region because it only ever steps
 * onto `aiHidden` cells.
 *
 * @param {GameState} d
 * @param {number} from  a tile already revealed this turn
 * @param {number[]} revealed
 */
function cascade(d, from, revealed) {
  if (clue(d, from).hi !== 0) return;
  /** @type {Set<number>} */
  const opened = new Set([from]);
  let frontier = [from];
  while (frontier.length) {
    /** @type {number[]} */
    const found = [];
    for (const c of frontier) {
      for (const j of n8(d, c)) {
        const con = d.con[j];
        if (opened.has(j) || con.k !== 'aiHidden' || isFlagged(con)) continue;
        // The theorem above, enforced rather than trusted: a zero clue cannot neighbour a
        // mine, so reaching one here means the clue and the mine set have diverged.
        if (con.mine) throw new Error(`cascade: cell ${j} is mined but neighbours the zero clue at ${c}`);
        opened.add(j);
        found.push(j);
      }
    }
    found.sort((a, b) => a - b);
    /** @type {number[]} */
    const next = [];
    for (const j of found) {
      // Revealing an unmined tile cannot change any clue — it held no mine before and holds
      // none after — so the zero test below is stable no matter when it runs.
      revealTile(d, j, revealed);
      if (clue(d, j).hi === 0) next.push(j);
    }
    frontier = next;
  }
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
    users: s.users.map((u) => ({ ...u, todo: u.todo.slice(), visited: u.visited.slice() })),
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
