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
 * @type {Record<Con['k'], ConCaps>}
 */
export const CON = {
  none:          { passable: false, handFrom: false, genFrom: false, occupies: false, holdsMine: false },
  hand:          { passable: true,  handFrom: true,  genFrom: true,  occupies: true,  holdsMine: false },
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
 * @property {number[]} visited  current-trip no-revisit set (SPEC §6.3)
 * @property {boolean} stalled   no legal move this tick → counts as waiting (SPEC §6.4)
 * @property {number} waited     CUMULATIVE ticks spent unable to move; at `patience`, gone
 */

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
 * @property {number} dest
 * @property {Block[]} blocks      live cells; badge counts derived, never stored
 * @property {User[]} users
 * @property {{ total: number, spawned: number, nextTick: number, every: number }} schedule
 * @property {Phase} phase
 * @property {{ gen: number, move: number }} rng   mulberry32 states (PLAN §7.5)
 * @property {{ placed: number, generated: number, analyzed: number, waited: number,
 *              detonations: number, served: number, lost: number }} stats
 */

/**
 * `flag` is the one action that costs nothing: it toggles an annotation and no tick runs
 * (SPEC §4.5, revised 2026-08-04). Everything else here consumes the turn.
 * @typedef {{ t: 'place', cell: number }
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
 *   | { t: 'generateRefunded' }
 *   | { t: 'placed', cells: number[] }
 *   | { t: 'blockPlaced', block: number, cells: number[], mines: number }
 *   | { t: 'analyzed', revealed: number[], minesFound: number[] }   // minesFound is always
 *                                                                   // empty since 2026-08-04:
 *                                                                   // a found mine detonates
 *   | { t: 'flagged', cell: number, on: boolean }
 *   | { t: 'reveal', cell: number }
 *   | { t: 'detonate', at: number, destroyed: number[], minesLost: number[] }
 *   | { t: 'step', user: number, from: number, to: number }
 *   | { t: 'departed', user: number }
 *   | { t: 'arrived', user: number }
 *   | { t: 'spawned', user: number }
 *   | { t: 'userLost', user: number, at: number, reason: 'gaveUp' | 'detonation' }
 *   | { t: 'won', served: number, total: number }
 *   | { t: 'lost', served: number, total: number }} Ev
 */

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
