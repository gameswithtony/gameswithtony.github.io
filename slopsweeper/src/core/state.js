// @ts-check
// The frozen shapes of PLAN §6, plus the two capability tables that keep terrain and
// construction states data rather than logic. Adding a terrain feature (SPEC §2.3) must
// mean adding a row here; if it ever means editing a conditional, this file has failed.

import { LEVEL_DEFAULTS } from './rules.js';

/** @typedef {import('./rules.js').LevelParams} LevelParams */

// --- Layer 1: terrain (SPEC §2.1) -------------------------------------------------

/** @typedef {'ocean' | 'void' | 'volcano'} Terrain */

/**
 * @typedef {object} TerrainCaps
 * @property {boolean} handBuildable  hand tile may be placed here (SPEC §4.1)
 * @property {boolean} generatable    an AI block may cover it (SPEC §4.2)
 * @property {boolean} passable       terrain alone carries users (no current row does)
 * @property {boolean} knownEmpty     counts as zero for clues (SPEC §7.5)
 * @property {boolean} blastStops     stops the detonation flood fill (SPEC §5)
 */

/**
 * Keyed by Terrain. Typed over `string` only so defineTerrain() can add rows at runtime —
 * the authored rows are exactly the Terrain union.
 * @type {Record<string, TerrainCaps>}
 */
export const TERRAIN = {
  ocean:   { handBuildable: true,  generatable: true,  passable: false, knownEmpty: true, blastStops: false },
  void:    { handBuildable: false, generatable: false, passable: false, knownEmpty: true, blastStops: true },
  volcano: { handBuildable: false, generatable: false, passable: false, knownEmpty: true, blastStops: true },
};

const TERRAIN_CAP_KEYS = /** @type {const} */ ([
  'handBuildable', 'generatable', 'passable', 'knownEmpty', 'blastStops',
]);

/**
 * Add a terrain row. Every future feature in SPEC §2.3 is meant to arrive through here.
 * @param {string} name
 * @param {TerrainCaps} row
 * @returns {TerrainCaps}
 */
export function defineTerrain(name, row) {
  if (TERRAIN[name]) throw new Error(`terrain '${name}' is already defined`);
  for (const k of TERRAIN_CAP_KEYS) {
    if (typeof row[k] !== 'boolean') throw new Error(`terrain '${name}' is missing capability '${k}'`);
  }
  TERRAIN[name] = { ...row };
  return TERRAIN[name];
}

/**
 * @param {string} t
 * @returns {TerrainCaps}
 */
export function caps(t) {
  const row = TERRAIN[t];
  if (!row) throw new Error(`unknown terrain '${t}'`);
  return row;
}

// --- Layer 2: construction state (SPEC §2.2) --------------------------------------

/**
 * @typedef {{ k: 'none' }
 *   | { k: 'hand' }
 *   | { k: 'beta' }
 *   | { k: 'aiHidden', mine: boolean, block: number, flagged: boolean }
 *   | { k: 'aiRevealed', block: number }
 *   | { k: 'mineConfirmed', block: number }} Con
 */

/**
 * @typedef {object} ConCaps
 * @property {boolean} passable   users may enter (SPEC §6.2)
 * @property {boolean} handFrom   hand placement may branch from it (SPEC §4.1, rev. 2026-08-04:
 *                                true for everything that `occupies` — any structure will do)
 * @property {boolean} genFrom    an AI block may branch from it (SPEC §4.2)
 * @property {boolean} occupies   something is built here, so nothing else may be
 * @property {boolean} holdsMine  can carry a mine, so it counts toward clues (SPEC §7.5)
 */

/**
 * The full §2.2 union. The predicates below never grow a special case (PLAN §2).
 *
 * `mineConfirmed` is kept deliberately although **no action produces it any more** (user
 * decision 2026-08-04: analyzing a mine detonates it, it does not confirm it). The row, its
 * clue arithmetic (it still `holdsMine`), the hash token and the renderer's `mine` tile all
 * stay, on the same reasoning PLAN §2 gives for implementing the full §2.2 union: it costs a
 * few lines and keeps the schema honest, and a defuse verb — the obvious future move that
 * turns a known defect into a permanent wall instead of a crater — would produce it on day
 * one. Direct construction in tests is the only thing that reaches it today.
 *
 * Revised 2026-08-04 (user decision): the standalone `flagged` state is gone. A flag is an
 * *annotation on an unreviewed AI tile*, not a construction state of its own — it has to
 * remember the tile's mine and block, and it has to keep counting for clues exactly as the
 * unflagged tile did (flagging is a claim, not knowledge). Making it a separate row would
 * have duplicated that payload and quietly changed clue arithmetic. It lives as
 * `aiHidden.flagged` and masks exactly one capability, below.
 *
 * Revised 2026-08-05 (user decision): `beta` joins the union — a shipped beta milestone, one
 * cell, hand-placed on open water exactly like a `hand` tile. Its row is `hand`'s row: safe
 * ground you built, walkable, buildable-from, holding no defect. The whole of what makes it
 * different lives in `routing.js`, where it is a **waypoint** — an intermediate destination
 * users will depart for and camp on — and none of that is a capability, so none of it is
 * here. It is a construction state of its own rather than a flag on `hand` because a beta
 * occupies the cell for good: you cannot ship one on top of anything, including another one,
 * and `occupies` is what says so.
 * @type {Record<Con['k'], ConCaps>}
 */
export const CON = {
  none:          { passable: false, handFrom: false, genFrom: false, occupies: false, holdsMine: false },
  hand:          { passable: true,  handFrom: true,  genFrom: true,  occupies: true,  holdsMine: false },
  beta:          { passable: true,  handFrom: true,  genFrom: true,  occupies: true,  holdsMine: false },
  aiHidden:      { passable: true,  handFrom: true,  genFrom: true,  occupies: true,  holdsMine: true },
  aiRevealed:    { passable: true,  handFrom: true,  genFrom: true,  occupies: true,  holdsMine: false },
  mineConfirmed: { passable: false, handFrom: true,  genFrom: false, occupies: true,  holdsMine: true },   // unreachable today; see above
};

// Read the `handFrom` column and it is now exactly the `occupies` column: **hand placement
// branches from any structure at all** (user decision 2026-08-04, overriding SPEC §4.1).
// `aiHidden` flipped false → true, which is the decision; `mineConfirmed` flipped with it so
// the column stays a single coherent rule rather than a rule plus an exception. `genFrom`
// deliberately did *not* move — a generated block still refuses to branch off a confirmed
// mine — so the two columns are no longer the same shape, which is the point of having two.
//
// The flag mask below touches `passable` only, so a flagged tile is still buildable-from: a
// flag restricts walkers, never builders.

/**
 * What a flag changes, and the complete list of it: users refuse to enter a flagged tile,
 * which is the whole mechanic (SPEC §4.5 — flags steer traffic). Everything else about the
 * tile is untouched, so a flag still counts for clues, still anchors generation, and is
 * still destroyed by a blast. Written as a table rather than a branch so `routing.js` never
 * learns the word "flag" — it asks `isPassable` like it asks about everything else.
 * @type {Partial<ConCaps>}
 */
const FLAG_MASK = Object.freeze({ passable: false });

/** One frozen masked row per maskable kind, built once. */
const FLAGGED_CAPS = Object.freeze(
  Object.fromEntries(Object.entries(CON).map(([k, row]) => [k, Object.freeze({ ...row, ...FLAG_MASK })])),
);

/** Shared immutable singletons: Con values are replaced, never mutated. */
export const CON_NONE = /** @type {Con} */ (Object.freeze({ k: 'none' }));
export const CON_HAND = /** @type {Con} */ (Object.freeze({ k: 'hand' }));
export const CON_BETA = /** @type {Con} */ (Object.freeze({ k: 'beta' }));

/**
 * @param {Con} con
 * @returns {boolean} the player has marked this tile as a suspected defect
 */
export function isFlagged(con) {
  return con.k === 'aiHidden' && con.flagged;
}

/**
 * @param {Con} con
 * @returns {ConCaps}
 */
export function conCaps(con) {
  const row = CON[con.k];
  if (!row) throw new Error(`unknown construction state '${/** @type {any} */ (con).k}'`);
  return isFlagged(con) ? FLAGGED_CAPS[con.k] : row;
}

// --- Two-layer predicates: the only readers of the tables above -------------------

/**
 * @param {string} terrain
 * @param {Con} con
 * @returns {boolean}
 */
export function isPassable(terrain, con) {
  return caps(terrain).passable || conCaps(con).passable;
}

/**
 * @param {string} terrain
 * @param {Con} con
 * @returns {boolean}
 */
export function isHandBuildable(terrain, con) {
  return caps(terrain).handBuildable && !conCaps(con).occupies;
}

/**
 * @param {string} terrain
 * @param {Con} con
 * @returns {boolean}
 */
export function isGeneratable(terrain, con) {
  return caps(terrain).generatable && !conCaps(con).occupies;
}

/**
 * Counts as zero for clue purposes (SPEC §7.5). M2 uses it; the table already decides it.
 * @param {string} terrain
 * @param {Con} con
 * @returns {boolean}
 */
export function isKnownEmpty(terrain, con) {
  return caps(terrain).knownEmpty && !conCaps(con).holdsMine;
}

/**
 * @param {string} terrain
 * @returns {boolean}
 */
export function stopsBlast(terrain) {
  return caps(terrain).blastStops;
}

// --- Users, state, actions, events (PLAN §6) --------------------------------------

/**
 * @typedef {object} User
 * @property {number} id
 * @property {number} at
 * @property {'queued' | 'moving' | 'arrived' | 'gone'} state  gone = left or killed, for good
 * @property {number[]} todo     indexes into `GameState.dests` still to visit (rev. 2026-08-05)
 * @property {number[]} visited  current-trip no-revisit set (SPEC §6.3)
 * @property {boolean} stalled   no legal move this tick → counts as waiting (SPEC §6.4)
 * @property {number} waited     CUMULATIVE ticks spent unable to move; at `patience`, gone
 * @property {boolean} [ordered] visit `todo` in list order, so the only live stop is `todo[0]`
 */
// `todo` is the user's ITINERARY, assigned once at spawn and never re-ordered: the order
// within it carries no meaning (destinations may be visited in any order) and it is kept
// ascending purely so every iteration over it is in a defined order. It is indexes rather
// than cell indices because that is what the routing masks are keyed on, and because it makes
// `todo` meaningless on any board but its own — which is honest, since it is.
//
// Revised 2026-08-05 (owner decision — opt-in ordered visitation, SPEC §6.5). `ordered` is the
// exception to the paragraph above, and it is **optional on purpose**: absent means false,
// everywhere, without a single `?? false` at a read site — `u.ordered` is falsy when it is not
// there. That is not laziness about a default, it is the save contract (PLAN §11.10). A v3 save
// written before this feature existed carries users with no `ordered` key, and it has to revive
// as the game it was; making the field required would have meant a save version and a migration
// for a bit that is false in every game those saves came from. `spawns` writes it explicitly
// anyway, so a state this build produced always states its answer.
//
// When it IS true, `todo` is in the order the level authored and only `todo[0]` is live — see
// `effectiveMask`.

/**
 * @typedef {object} BBox
 * @property {number} x0
 * @property {number} y0
 * @property {number} x1
 * @property {number} y1
 */

/**
 * Legal anchors for one rotation of a drawn block, enumerated before the turn commits
 * (SPEC §4.2). M2 fills it; the shape is frozen now so `phase.placing` never changes.
 * @typedef {object} RotAnchors
 * @property {0 | 1 | 2 | 3} rot
 * @property {[number, number][]} cells  normalized offsets for this rotation
 * @property {number[]} anchors          cell indices where the offsets all land legally
 */

/**
 * @typedef {{ id: number, cells: number[] }} Block
 */

/**
 * @typedef {{ k: 'play' }
 *   | { k: 'placing', shape: number, rots: RotAnchors[] }
 *   | { k: 'won' }
 *   | { k: 'lost' }} Phase
 */

/**
 * @typedef {object} GameState
 * @property {string} level
 * @property {number} seed
 * @property {number} tick
 * @property {number} w
 * @property {number} h
 * @property {Terrain[]} terrain   dense, row-major, never mutated after load (SPEC §2.1)
 * @property {Con[]} con           dense, parallel to terrain
 * @property {BBox} bbox           playable bounding box (SPEC §10.7)
 * @property {number} origin
 * @property {number[]} dests      destination cells, 'B' first (SPEC §2.4, rev. 2026-08-05)
 * @property {Block[]} blocks      live cells; badge counts derived, never stored
 * @property {User[]} users
 * @property {{ total: number, spawned: number, nextTick: number, every: number }} schedule
 * @property {Phase} phase
 * @property {{ gen: number, move: number }} rng   mulberry32 states (PLAN §7.5)
 * @property {{ placed: number, generated: number, analyzed: number, waited: number,
 *              detonations: number, served: number, lost: number, betas: number }} stats
 */
// `stats.betas` counts betas *shipped*, which is also what meters the supply: remaining is
// `levelParams(s).betaSupply - stats.betas`. It never comes back down, so a beta a blast
// takes out is not refunded — you shipped it, and it is gone (2026-08-05). Live beta sites
// need no field of their own: they are the cells whose `con` is `{ k: 'beta' }`, derived from
// the board like every other question about what is standing.
//
// Revised 2026-08-05 (user decision — multi-destination itineraries, SPEC §2.4/§6, §9.2.2):
// `dest: number` became `dests: number[]`. There is no `s.dest` any more, deliberately and
// everywhere: a singular field that happened to hold the first of several is the shape that
// lets a single-destination assumption survive unnoticed in a corner of the code, and there
// were nine such corners. `dests[i]` is the cell marked with `String.fromCharCode(66 + i)`, so
// `dests[0]` is 'B', `dests[1]` is 'C', and a one-element `dests` is the game as it was.
// `origin` did not move: 'A' is still the only spawn.

// --- Endpoints: origin plus every destination -------------------------------------
// Endpoints are always passable, never buildable, indestructible in blasts, display no clue
// and are invisible to the solver (PLAN §3.8). Every one of those rules used to be written as
// `i === s.origin || i === s.dest` at the site that needed it; with several destinations that
// idiom stops being writable, so it is a predicate now — the same move `isPassable` made for
// terrain. Structural typing keeps it usable from `validate.js`, which asks the question of a
// freshly parsed map that is not a GameState yet.

/** @typedef {{ origin: number, dests: number[] }} Endpoints */

/**
 * @param {Endpoints} e
 * @param {number} i
 * @returns {number} which destination this cell is (0 = 'B'), or -1
 */
export function destIndex(e, i) {
  return e.dests.indexOf(i);
}

/**
 * @param {Endpoints} e
 * @param {number} i
 * @returns {boolean}
 */
export function isDest(e, i) {
  return e.dests.includes(i);
}

/**
 * @param {Endpoints} e
 * @param {number} i
 * @returns {boolean}
 */
export function isEndpoint(e, i) {
  return i === e.origin || e.dests.includes(i);
}

/**
 * The full itinerary: every destination, ascending. It is what a user gets when the level
 * lists no itineraries at all, and what the departure gate falls back to when it is asked
 * about a board with nobody standing on it.
 * @param {Endpoints} e
 * @returns {number[]}
 */
export function everyDest(e) {
  return e.dests.map((_, i) => i);
}

/**
 * **What a user is actually asking the board for**, which since ordered itineraries is not
 * always its whole `todo` (owner decision 2026-08-05, SPEC §6.5).
 *
 * An unordered user owes every stop on its list and is routed to whichever is nearest, so its
 * mask is `todo` — the identical array, by reference, so nothing downstream can tell this
 * function was called. An **ordered** user owes exactly one thing, `todo[0]`, and the rest of
 * its list is not a routing question yet; its mask is that one element. Enforcement is then not
 * a rule anybody has to remember at a routing site: a later stop is simply not on the mask, so
 * it is not a waypoint, so nothing walks toward it.
 *
 * Every site that used to hand `u.todo` to the field machinery hands it this instead —
 * departures, movement, the post-blast recompute, and the HUD's `gateOpen(s)`. That is the
 * whole of the change on the routing side, and it is one call each, which is the point of
 * having a helper rather than a branch four times.
 *
 * An empty `todo` returns the empty array unchanged (an arrived user has no mask); the field
 * machinery's own fallback to every destination still covers callers that ask anyway.
 * @param {{ todo: number[], ordered?: boolean }} u
 * @returns {number[]} indexes into `dests` — the destinations this user is currently walking to
 */
export function effectiveMask(u) {
  return u.ordered && u.todo.length > 0 ? [u.todo[0]] : u.todo;
}

/**
 * `flag` is the one action that costs nothing: it toggles an annotation and no tick runs
 * (SPEC §4.5, revised 2026-08-04). Everything else here consumes the turn — `beta` included
 * (SPEC §4.7, added 2026-08-05): shipping a beta milestone is a turn spent building, priced
 * exactly like the hand tile it is placed like.
 * @typedef {{ t: 'place', cell: number }
 *   | { t: 'beta', cell: number }
 *   | { t: 'generate' }
 *   | { t: 'placeBlock', cell: number, rot: 0 | 1 | 2 | 3 }
 *   | { t: 'analyze', cell: number }
 *   | { t: 'flag', cell: number }
 *   | { t: 'wait' }} Action
 */

/** @typedef {Action['t']} ActionKind */

/**
 * @typedef {{ t: 'rejected', reason: string }
 *   | { t: 'blockDrawn', shape: number, rots: RotAnchors[] }
 *   | { t: 'generateRefunded' }                                     // since 2026-08-12: no
 *                                                                   // shape in the pool fits
 *                                                                   // anywhere — the draw
 *                                                                   // redraws past a bad roll
 *   | { t: 'placed', cells: number[] }
 *   | { t: 'betaPlaced', cell: number }                             // rev. 2026-08-05
 *   | { t: 'blockPlaced', block: number, cells: number[], mines: number }
 *   | { t: 'analyzed', revealed: number[], minesFound: number[] }   // minesFound is always
 *                                                                   // empty since 2026-08-04:
 *                                                                   // a found mine detonates
 *   | { t: 'flagged', cell: number, on: boolean }
 *   | { t: 'reveal', cell: number }
 *   | { t: 'detonate', at: number, destroyed: number[], minesLost: number[] }
 *   | { t: 'step', user: number, from: number, to: number }
 *   | { t: 'departed', user: number }
 *   | { t: 'visited', user: number, dest: number }                  // rev. 2026-08-05
 *   | { t: 'arrived', user: number }
 *   | { t: 'spawned', user: number }
 *   | { t: 'userLost', user: number, at: number, reason: 'gaveUp' | 'detonation' }
 *   | { t: 'won', served: number, total: number }
 *   | { t: 'lost', served: number, total: number }} Ev
 */
// `visited` is the *intermediate* stop (rev. 2026-08-05): a user stepped onto a destination
// that was still on its list and has more to visit, so it ticked that stop off and carried on.
// `dest` is the cell, not the index, because every consumer of an event is drawing on a board.
// The last stop does not emit it — it emits `arrived`, exactly as it always did, because the
// last stop *is* arrival and a UI that had to reconstruct that from two events would get it
// wrong on the single-destination levels where the two coincide.

// --- Level parameters ride beside the state, not inside it ------------------------
// GameState (§6) is frozen and carries only the level id, but the tick pipeline needs the
// level's numbers. They are load-time constants, so they hang off the one field a level
// owns for its whole life and that reduce() never clones: the terrain array.

/** @type {WeakMap<Terrain[], LevelParams>} */
const PARAMS = new WeakMap();

/**
 * @param {GameState} s
 * @param {LevelParams} p
 */
export function setLevelParams(s, p) {
  PARAMS.set(s.terrain, Object.freeze({ ...p }));
}

/**
 * @param {GameState} s
 * @returns {LevelParams}
 */
export function levelParams(s) {
  return PARAMS.get(s.terrain) ?? LEVEL_DEFAULTS;
}

/**
 * **How long THIS user will wait** (owner decision 2026-08-05 — the walker cast list, SPEC §6.6).
 *
 * Patience used to be one number a level set, and every reader in the game asked
 * `levelParams(s).patience` for it. A cast may now give a walker its own bar — an impatient
 * stakeholder who leaves in twelve where the level's own bar is twenty-six — and the moment that
 * is true, `levelParams(s).patience` stops being the answer to "how long will this person wait"
 * and becomes the answer to "what does this level default to". Those are different questions and
 * four places in the codebase were asking the first one with the second one's expression.
 *
 * So: **one helper, and every reader asks it.** The reducer's patience step, the intermediate-stop
 * refill, the board's impatience shading, the roster's LEAVES IN countdown and its gave-up-versus-
 * killed derivation, and the HUD's worst-case countdown. A second implementation of this lookup
 * anywhere would mean a user the board says is fine and the reducer has already given up on.
 *
 * **The override rides in the cast, which is why nothing was stored.** `u.id` is the casting slot
 * — spawn k is cast entry k, by construction (`reduce.spawns`) — so the walker's own numbers are
 * re-derivable from `(LevelDef, seed)` at any moment, which is exactly what a restore does. No
 * field on `User`, no save version, no migration.
 *
 * Defensive on the way in, like every other params read: a state whose parameters were never
 * associated falls back to `LEVEL_DEFAULTS`, whose cast is empty, and an empty cast means the
 * level's bar for everybody — the game as it was.
 * @param {GameState} s
 * @param {{ id: number }} u
 * @returns {number}
 */
export function patienceLimit(s, u) {
  const p = levelParams(s);
  return p.cast?.[u.id]?.patience ?? p.patience;
}
