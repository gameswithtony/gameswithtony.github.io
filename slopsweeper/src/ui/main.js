// @ts-check
// Boot and wiring. This is the only module that dispatches reducer actions, and it only
// ever dispatches `{ t, cell, rot? }` tuples (SPEC §10.9) — input produces intents, the
// HUD produces verbs, and everything meets here.
//
// Frame model (PLAN §11.4): there is no continuous RAF. The board is motionless between
// ticks, so drawing is on demand; a loop runs only while step tweens, particles, shake or
// the overscroll spring are alive, and then sleeps. Every wake re-verifies the canvas
// backing store (gorillas' self-heal).

import { RULES } from '../core/rules.js';
import { blastArea, init, legalActions, reduce } from '../core/reduce.js';
import { levelParams, setLevelParams } from '../core/state.js';
import { randomSeed } from '../core/rng.js';
import { getLevel, levelIds } from '../levels/index.js';
import * as cam from './camera.js';
import { createRenderer, dests, ghostCells } from './renderer.js';
import { createInput } from './input.js';
import { createHud } from './hud.js';
import { createRoster } from './roster.js';
import { createDrawer } from './drawer.js';
import { createEffects } from './particles.js';
import { PALETTE } from './palette.js';

/** @typedef {import('../core/state.js').GameState} GameState */
/** @typedef {import('../core/state.js').Action} Action */
/** @typedef {import('../core/state.js').Ev} Ev */
/** @typedef {import('../levels/index.js').LevelDef} LevelDef */
/** @typedef {import('./renderer.js').ViewOverlay} ViewOverlay */

const STORE_KEY = 'slop-sweeper.level';
const SAVE_KEY = 'slop-sweeper.save';

/**
 * BUMP THIS WHENEVER `GameState`'s SHAPE CHANGES — a new field, a renamed one, a changed
 * `Con` or `Phase` variant, anything. A save written by an older shape is discarded on sight
 * rather than half-read, which is the only cheap way to keep a persisted structure honest
 * against a core that is still moving. Costing a player one in-progress game at a version
 * bump is the right trade against reviving a state the reducer no longer understands.
 *
 * NOT BUMPED 2026-08-05 for `User.ordered`. Read the rule above precisely: it guards against
 * reviving a state the reducer would misread, and this field cannot produce one. It is
 * optional, an absent one reads as false everywhere it is read, and false is exactly what
 * every user in a v3 save already is — an itinerary walkable in any order. So a v3 save
 * revives correctly against the new shape and the player keeps the game they were mid-way
 * through. The bar is "could an old save be misunderstood", not "did a typedef gain a line":
 * a required field, a changed or renamed `Con` or `Phase` variant, or a field whose default
 * is not the old behaviour all still bump on sight.
 */
const SAVE_V = 3;   // 3: multi-destination — `dest` became `dests`, and a User gained `todo`

/** localStorage must never be load-bearing: the game runs with storage unavailable (PLAN §4). */
const store = {
  /** @param {string} k @returns {string | null} */
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  /** @param {string} k @param {string} v */
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode, or quota */ } },
  /** @param {string} k */
  del(k) { try { localStorage.removeItem(k); } catch { /* nothing to do about it */ } },
};

/**
 * @typedef {object} SaveFile
 * @property {number} v
 * @property {string} levelId
 * @property {LevelDef | null} labDef   embedded, because a pasted level is not in the registry
 * @property {GameState} state
 */

/**
 * Enough of a shape check to catch a save from another version, another game, or a corrupted
 * string. It is not a schema validator — `SAVE_V` is what guards shape drift — it is the
 * "never throw on a bad save" rule made concrete.
 * @param {unknown} raw
 * @returns {SaveFile | null}
 */
function parseSave(raw) {
  if (typeof raw !== 'string') return null;
  try {
    const save = JSON.parse(raw);
    if (!save || save.v !== SAVE_V || typeof save.levelId !== 'string') return null;
    const s = save.state;
    if (!s || typeof s !== 'object') return null;
    if (!Array.isArray(s.terrain) || !Array.isArray(s.con) || !Array.isArray(s.users)
      || !Array.isArray(s.blocks) || !Array.isArray(s.dests) || !s.phase || !s.stats
      || !s.schedule || !s.rng || !s.bbox
      || typeof s.w !== 'number' || typeof s.h !== 'number' || typeof s.seed !== 'number'
      || typeof s.tick !== 'number' || s.terrain.length !== s.w * s.h || s.con.length !== s.terrain.length
      // A user's itinerary is the one per-element check here, because it is the field the whole
      // walk is decided from: a user restored without one would queue at A forever and the
      // board would look correct while doing it.
      || !s.users.every((u) => u && Array.isArray(u.todo))) {
      return null;
    }
    if (save.labDef !== null && (typeof save.labDef !== 'object' || typeof save.labDef?.map !== 'string')) return null;
    return /** @type {SaveFile} */ (save);
  } catch {
    return null;                       // truncated, tampered with, or not ours at all
  }
}

/**
 * The event drain, as a registry rather than a switch: M4 subscribes particles to
 * `detonate`, step tweens to `step`, and the reveal flip to `reveal` without touching this
 * file's dispatch path. `'*'` sees everything, in emission order.
 */
function createBus() {
  /** @type {Map<string, ((ev: any) => void)[]>} */
  const map = new Map();
  return {
    /**
     * @param {string} type  an `Ev['t']`, or '*' for every event
     * @param {(ev: any) => void} fn
     */
    on(type, fn) {
      const list = map.get(type);
      if (list) list.push(fn);
      else map.set(type, [fn]);
    },
    /** @param {Ev[]} events */
    drain(events) {
      for (const ev of events) {
        for (const fn of map.get(ev.t) ?? []) fn(ev);
        for (const fn of map.get('*') ?? []) fn(ev);
      }
    },
  };
}

function boot() {
  const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('game'));
  const board = /** @type {HTMLElement} */ (document.getElementById('board'));
  if (!canvas || !board) throw new Error('main: the page is missing #game / #board');

  const params = new URLSearchParams(location.search);
  const ids = levelIds();
  const labParam = params.get('lab');
  const isLab = labParam !== null && labParam !== '0';
  const pinnedSeed = params.has('seed') ? (Number(params.get('seed')) >>> 0) : null;
  const wanted = params.get('level') ?? store.get(STORE_KEY) ?? ids[0];
  let levelId = ids.includes(wanted) ? wanted : ids[0];

  const camera = cam.createCamera();
  const renderer = createRenderer(canvas);
  const bus = createBus();
  const fx = createEffects();

  /**
   * The save, if there is one this URL agrees with (PLAN §11.10). Resolved before anything is
   * built, because it decides which level boots, which state it boots into, and whether the
   * title card is shown at all.
   *
   * THE RULE, and why each clause is there:
   *   · `?lab` absent — the Lab boots definitions by hand and must never have one restored
   *     underneath it.
   *   · `?seed=` present — restore only when it is the seed we saved, and only when `?level=`
   *     (if present) agrees too. A share link REFRESHED MID-PLAY is the same game and has to
   *     resume; a share link for a *different* game is repro intent and boots fresh.
   *   · `?level=` present — must match. The game writes this parameter into the URL itself on
   *     every start, so an ordinary refresh always agrees and always resumes; choosing a
   *     different level from the URL is a request for that level, not for the saved one.
   * @returns {SaveFile | null}
   */
  function loadSave() {
    if (params.has('lab')) return null;
    const save = parseSave(store.get(SAVE_KEY));
    if (!save) return null;
    const level = params.get('level');
    if (level !== null && level !== save.levelId) return null;
    if (pinnedSeed !== null && pinnedSeed !== (save.state.seed >>> 0)) return null;
    // A registered level must still be registered; a Lab save carries its own definition.
    if (!save.labDef && !ids.includes(save.levelId)) return null;
    try {
      // `levelParams` is keyed on the terrain ARRAY's identity (a WeakMap in core), so a state
      // that came back through JSON has none — it would silently fall back to the defaults and
      // play at the wrong patience and the wrong mine density. Booting the definition once and
      // copying its parameters across re-associates them using core's own defaulting rather
      // than a second copy of it here, and doubles as a check that the level still loads.
      const def = save.labDef ?? getLevel(save.levelId);
      setLevelParams(save.state, levelParams(init(def, save.state.seed)));
      return save;
    } catch {
      return null;                     // the level no longer loads: the save is unplayable
    }
  }

  const restored = loadSave();
  if (restored) levelId = restored.levelId;

  /** @type {LevelDef} */
  let levelDef = restored?.labDef ?? getLevel(levelId);
  /**
   * Non-null while the Level Lab's definition is the one being played (PLAN §9.2).
   * @type {LevelDef | null}
   */
  let labDef = restored?.labDef ?? null;

  let s = restored ? restored.state : init(levelDef, pinnedSeed ?? randomSeed());
  /**
   * The state as it was before the action currently being drained — the only place a
   * destroyed tile still exists to be drawn coming apart (PLAN §11.6).
   * @type {GameState}
   */
  let prev = s;
  /** @type {ViewOverlay} */
  const view = { selected: -1, rot: 0, anchors: null, ghost: null, blast: null };

  /**
   * The overlay layer (PLAN §11.9), once its lazy module has landed. Null until then, which is
   * why every call site uses `?.`.
   * @type {import('./start.js').Overlays | null}
   */
  let endScreen = null;
  /** @type {import('./start.js').EndFacts | null} a result that finished before the module did */
  let pendingEnd = null;

  /**
   * Hand the end screen plain numbers rather than the state: it is shown after the game is
   * over and must not be able to ask the board anything.
   * @param {boolean} won
   * @param {{ served: number, total: number }} ev
   */
  function showEnd(won, ev) {
    /** @type {import('./start.js').EndFacts} */
    const facts = {
      won,
      levelId,
      mapName: levelDef.name ?? levelId,
      served: ev.served,
      total: ev.total,
      lost: s.stats.lost ?? 0,
      detonations: s.stats.detonations,
      ticks: s.tick,
      seed: s.seed,
      placed: s.stats.placed,
      generated: s.stats.generated,
      analyzed: s.stats.analyzed,
      waited: s.stats.waited,
    };
    // The roster is a live view of a game in progress; this one is over, and an end screen is
    // a decision that must not have a list arguing with it from underneath.
    roster.close();
    if (endScreen) endScreen.end(facts);
    else pendingEnd = facts;
  }

  // The roster (PLAN §11.9's neighbour): a DOM list of everyone in the run, opened from the
  // WAITING chip. Statically imported rather than lazy like the start screen — it is one of
  // the two things the chip does, and a control that is dead for the first second of the page
  // is worse than one that costs a few hundred bytes up front.
  const roster = createRoster({
    // The same centring the minimap taps use, and deliberately the same one: two ways to say
    // "show me that cell" that framed it differently would be two features.
    onJump: (cell) => jumpTo(cell),
  });

  // The menu drawer (drawer.js): the level, the seed link, the turn counter and the remaining
  // count, moved off the walker-first top bar on 2026-08-05.
  const drawer = createDrawer();

  /**
   * Is some panel holding the keyboard? Asked before every keystroke (input.js). The list is
   * every layer that can be over the board, and it is a list rather than a flag because each of
   * them owns its own open state and none of them should have to tell the others.
   * `body.starting` is on it for the frame or two before start.js lands: the board is covered
   * then, and a covered board must not be playable.
   * @returns {boolean}
   */
  function panelOpen() {
    return document.body.classList.contains('starting')
      || roster.isOpen() || drawer.isOpen() || !!endScreen?.isOpen();
  }

  /**
   * One verb, whatever pressed it — a button in the action bar, a global, or a letter key.
   * Both paths meet HERE and go on as the same `{ t, cell, rot? }` tuple, which is SPEC §10.9's
   * rule kept honestly: the keyboard adds a way to name an intent, not a way to reach the
   * reducer.
   *
   * The legality gate is why this is one function. The action bar only ever draws verbs
   * `legalActions()` returned, so on that path the check below is dead code — but the keyboard
   * has no bar in front of it, and a `rejected` event is treated as a UI bug in this file (it
   * console.warns). So the guard sits in front of the dispatch, and a hotkey can only ever do
   * what the bar would have offered for that cell.
   * @param {import('../core/state.js').ActionKind} kind
   */
  function act(kind) {
    const cell = view.selected;
    switch (kind) {
      case 'generate': return legalActions(s).includes('generate') ? dispatch({ t: 'generate' }) : undefined;
      case 'wait': return legalActions(s).includes('wait') ? dispatch({ t: 'wait' }) : undefined;
      case 'place':
        return cell >= 0 && legalActions(s, cell).includes('place') ? dispatch({ t: 'place', cell }) : undefined;
      case 'beta':
        return cell >= 0 && legalActions(s, cell).includes('beta') ? dispatch({ t: 'beta', cell }) : undefined;
      case 'analyze':
        return cell >= 0 && legalActions(s, cell).includes('analyze') ? dispatch({ t: 'analyze', cell }) : undefined;
      case 'flag': return toggleFlag();
      // Its own gate: the ghost must be valid, not merely some rotation of it (confirmBlock).
      case 'placeBlock': return confirmBlock();
      default: return undefined;
    }
  }

  const hud = createHud({
    onAction: act,
    onRotate: rotate,
    onConfirm: confirmBlock,
    onLevel: (id) => { if (ids.includes(id)) newGame(id, pinnedSeed ?? randomSeed()); else restart(); },
    onRestart: restart,
    onMinimapJump: jumpTo,
    onCopySeed: copySeed,
    onRun: toggleRun,
    onZoom: zoomStep,
    // The two panels are mutually exclusive by construction. Neither has to know how to layer
    // itself against the other, which is a cheaper guarantee than any z-index argument, and it
    // means a tap on a scrim is never ambiguous about which sheet it is dismissing.
    onRoster: () => { drawer.close(); roster.toggle(s); },
    onMenu: () => { roster.close(); drawer.toggle(); },
  });
  // Same union `startWith` builds: a restored Lab game boots straight past `startWith`, and
  // without this its own level would be missing from the dropdown, which would then display
  // some other level's name over the board actually on screen.
  hud.setLevels(labDef ? [...new Set([...ids, labDef.id])] : ids, levelId);

  createInput(board, camera, {
    getState: () => s,
    onTap: select,
    // Pinch and wheel land here. The zoom buttons describe the camera, so they are updated on
    // the event rather than on the frame it schedules — a control that tells you what it will
    // do next must not be a frame behind the thing it is describing.
    onViewChange: () => { renderer.invalidate(); hud.zoom(camera); requestDraw(); },
    onGestureEnd: () => startLoop(),
    onRotate: rotate,
    onConfirm: confirmBlock,
    onEscape: () => select(-1),
    // The keyboard half (2026-08-05). It reaches nothing the pointer does not: `onCursor` is
    // `select` with the camera made to follow, and `onVerb` is the same `act` the buttons call.
    getSelected: () => view.selected,
    onCursor: moveCursor,
    onVerb: act,
    onRun: runKey,
    isBlocked: panelOpen,
    wake: selfHeal,
  });

  // --- game flow ------------------------------------------------------------------

  /**
   * @param {string} id  a registered level
   * @param {number} seed
   */
  function newGame(id, seed) {
    levelId = id;
    levelDef = getLevel(id);
    labDef = null;
    store.set(STORE_KEY, id);
    start(seed);
  }

  /**
   * Boot a definition the Lab is holding, with no registry write — `init()` takes a
   * LevelDef, so a pasted level boots down exactly the same path as a registered one
   * (PLAN §9.2). Throws exactly what the validator would throw; the Lab prints it.
   * @param {LevelDef} def
   * @param {number} [seed]
   */
  function playDef(def, seed) {
    const next = init(def, (seed ?? s.seed) >>> 0);      // validate before touching anything
    labDef = def;
    levelDef = def;
    levelId = def.id;
    startWith(next);
  }

  /** @param {number} seed */
  function start(seed) {
    startWith(init(levelDef, seed));
  }

  /** @param {GameState} next */
  function startWith(next) {
    stopRun();
    fx.reset();
    s = next;
    prev = next;
    view.selected = -1;
    view.rot = 0;
    roster.close();          // a new game's roster is a new set of people; open it yourself
    drawer.close();          // and a level switch is made FROM the drawer: it has done its job
    endScreen?.close();
    hud.setLevels(labDef ? [...new Set([...ids, labDef.id])] : ids, levelId);
    const url = new URL(location.href);
    if (labDef) url.searchParams.delete('level');
    else url.searchParams.set('level', levelId);
    if (pinnedSeed !== null) url.searchParams.set('seed', String(s.seed));
    history.replaceState(null, '', url);
    cam.setViewport(camera, canvas.clientWidth, canvas.clientHeight, window.devicePixelRatio || 1);
    cam.fit(camera, s);
    renderer.invalidate();
    refresh();
    saveGame();
  }

  /**
   * Persist the reducer's state and nothing else (PLAN §11.10). Camera, selection, ghost and
   * the run toggle are all deliberately absent: they are view state, they are cheap to
   * re-derive, and serializing the camera would put a zoom level inside a saved game, which
   * is exactly the coupling SPEC §10.5 exists to prevent.
   */
  function saveGame() {
    store.set(SAVE_KEY, JSON.stringify({ v: SAVE_V, levelId, labDef, state: s }));
  }

  function restart() {
    start(pinnedSeed ?? randomSeed());
  }

  /** @param {Action} a */
  function dispatch(a) {
    if (s.phase.k === 'won' || s.phase.k === 'lost') return;
    const out = reduce(s, a);
    prev = s;
    s = out.s;
    stepInto.clear();
    bus.drain(out.ev);
    renderer.invalidate();
    refresh();
    saveGame();
    startLoop();
  }

  /**
   * Put a cell in the middle of the viewport. The minimap's tap and the roster's rows are the
   * two callers, and they share this rather than each centring their own way.
   * @param {number} cell
   */
  function jumpTo(cell) {
    cam.centerOnCell(camera, s, cell);
    renderer.invalidate();
    refresh();
  }

  /** @param {number} cell  -1 deselects */
  function select(cell) {
    view.selected = cell;
    // Tapping an anchor that only fits at another rotation turns the ghost to that rotation
    // instead of showing a dead RED footprint: the player never hunts for fits (SPEC §4.2).
    // Explicit rotate is untouched — it cycles freely, valid selection or not.
    if (s.phase.k === 'placing' && cell >= 0 && !s.phase.rots[view.rot]?.anchors.includes(cell)) {
      const fits = s.phase.rots.findIndex((r) => r.anchors.includes(cell));
      if (fits >= 0) view.rot = fits;
    }
    renderer.invalidate();
    refresh();
  }

  /**
   * The keyboard cursor landing on a cell: the same selection a tap makes, plus the one thing a
   * tap never needs — the camera has to go and find it. A finger can only select what is already
   * on screen, so `select` has never had to move the view and must not start; an arrow key can
   * walk the cursor straight off the edge of the viewport, and a selection you cannot see is a
   * turn about to be spent somewhere you are not looking.
   * @param {number} cell
   */
  function moveCursor(cell) {
    select(cell);
    ensureVisible(cell);
  }

  /**
   * Centre on a cell, but ONLY when it is at or past the edge of the viewport. The margin is one
   * whole tile, so the cursor is re-centred a step before it leaves rather than the moment it
   * has: a cursor that only recentres once it is already gone spends every step at the very edge
   * of the screen, which is the worst place to read a board from.
   *
   * When it is comfortably visible nothing happens at all. A camera that recentred on every
   * arrow press would make the board slide under a player who was only looking around, and
   * `centerOnCell` clamps to the pan range anyway, so on a board that fits the viewport this is
   * a no-op however the cursor moves.
   * @param {number} cell
   */
  function ensureVisible(cell) {
    const r = cam.cellRect(camera, s, cell);
    const t = cam.tilePx(camera);
    if (r.x < t || r.y < t || r.x + r.size > camera.cw - t || r.y + r.size > camera.ch - t) {
      jumpTo(cell);          // the minimap's and the roster's own centring path, deliberately
    }
  }

  /**
   * The zoom buttons, which are just another caller of the camera the pinch and the wheel
   * already use — anchored at the viewport centre, because a button has no gesture point to
   * anchor to and the centre is the thing the player is looking at. `zoomBy` clamps to
   * [minArtPx, maxArtPx] itself and reports whether anything moved, so the bounds need no
   * checking here; the buttons show their own disabled state off the same two numbers.
   * @param {number} steps  +1 zooms in
   */
  function zoomStep(steps) {
    selfHeal();
    if (cam.zoomBy(camera, s, steps, camera.cw / 2, camera.ch / 2)) renderer.invalidate();
    hud.zoom(camera);
    refresh();
  }

  function rotate() {
    if (s.phase.k !== 'placing') return;
    view.rot = (view.rot + 1) % s.phase.rots.length;
    renderer.invalidate();
    refresh();
  }

  function confirmBlock() {
    if (s.phase.k !== 'placing' || view.selected < 0) return;
    const rot = s.phase.rots[view.rot];
    if (!rot || !rot.anchors.includes(view.selected)) return;
    dispatch({ t: 'placeBlock', cell: view.selected, rot: /** @type {0|1|2|3} */ (rot.rot) });
  }

  /**
   * Toggle the flag on the selected cell. The selection deliberately survives: UNFLAG exists
   * because you changed your mind about a cell, and the next thing you want on that same cell
   * is ANALYZE — `dispatch` never touches `view.selected`, so this is a promise kept by not
   * writing code rather than by writing it.
   *
   * Asks `legalActions` first because this is also the keyboard path, and the keyboard has no
   * action bar filtering it. A `rejected` event here would be a genuine UI bug, and main.js
   * treats it as one (it console.warns), so the guard has to sit in front of the dispatch and
   * not behind it.
   */
  function toggleFlag() {
    if (view.selected < 0) return;
    if (!legalActions(s, view.selected).includes('flag')) return;
    dispatch({ t: 'flag', cell: view.selected });
  }

  /** Derived overlay state — recomputed from the reducer's data, never accumulated. */
  function syncView() {
    if (s.phase.k === 'placing') {
      if (view.rot >= s.phase.rots.length) view.rot = 0;
      const rot = s.phase.rots[view.rot];
      view.anchors = rot.anchors;
      view.ghost = view.selected >= 0
        ? { cells: ghostCells(s, view.selected, rot.cells), valid: rot.anchors.includes(view.selected) }
        : null;
      view.blast = null;
    } else {
      view.rot = 0;
      view.anchors = null;
      view.ghost = null;
      // Selecting a confirmed mine previews what taking it out would cost (SPEC §10.6).
      view.blast = view.selected >= 0 && s.con[view.selected].k === 'mineConfirmed'
        ? blastArea(s, view.selected)
        : null;
    }
  }

  function refresh() {
    syncView();
    hud.update(s, view, camera);
    // Patience moves every turn, so an open roster has to be redrawn on every update or it is
    // showing countdowns that expired. It costs one boolean test while it is closed.
    roster.update(s);
    requestDraw();
  }

  function copySeed() {
    const url = new URL(location.href);
    url.searchParams.set('level', levelId);
    url.searchParams.set('seed', String(s.seed));
    const text = url.toString();
    try {
      navigator.clipboard?.writeText(text);
      hud.toast('SEED URL COPIED');
    } catch {
      hud.notice(text);
    }
  }

  // --- event drain ------------------------------------------------------------------

  /**
   * Cell → the user who walked into it during the action currently being drained. The
   * traversal consequences of a step (the tile flipping over, the mine going off, the pop
   * at B) are held back by the walk that caused them, so the effect lands under the dot
   * rather than ahead of it. Steps are always emitted before traversal (PLAN §7.1).
   * @type {Map<number, number>}
   */
  const stepInto = new Map();

  bus.on('step', (/** @type {{ user: number, from: number, to: number }} */ ev) => {
    fx.step(ev.user, s, ev.from, ev.to);
    stepInto.set(ev.to, ev.user);
  });

  /** @param {number} cell @returns {number} seconds to hold an effect back */
  const walkDelay = (cell) => {
    const user = stepInto.get(cell);
    return user === undefined ? 0 : fx.remaining(user);
  };

  bus.on('reveal', (/** @type {{ cell: number }} */ ev) => {
    fx.flip(ev.cell, PALETTE.AI_REVEALED, walkDelay(ev.cell));
  });
  // A flag changes the board's appearance and its routing, so it invalidates the static cache
  // like any other board mutation. `dispatch` already does that for the player's own toggle;
  // this subscription is what makes it true for a `flagged` emitted as a CONSEQUENCE of some
  // other action — a blast clearing the flag off a cell it destroyed, say — which arrives on
  // the same drain but is nobody's button press.
  bus.on('flagged', () => { renderer.invalidate(); requestDraw(); });
  /**
   * Where a stop happened, for the pop that marks it. The events name the user rather than the
   * tile, and the user is standing on the stop by the time the drain runs — so their own cell
   * is the answer, and it stays the answer however many destinations a level grows. `visited`
   * carries the cell too; it is preferred when it is one of ours, and disagreeing with the
   * walker is not a thing this is willing to do silently.
   * @param {{ user: number, dest?: number }} ev
   * @returns {number} -1 when the user is already off the board
   */
  function stopCell(ev) {
    if (typeof ev.dest === 'number' && dests(s).includes(ev.dest)) return ev.dest;
    const u = s.users.find((x) => x.id === ev.user);
    return u ? u.at : -1;
  }

  bus.on('arrived', (/** @type {{ user: number, dest?: number }} */ ev) => {
    const at = stopCell(ev);
    if (at >= 0) fx.pop(at, fx.remaining(ev.user));
  });
  // A stop that is not the last one: the walk continues, and the reason the countdown in the
  // HUD just got better is not visible anywhere else on the board. The pop says a stop landed,
  // the toast says what it bought — a beta's toast names its consequence the same way.
  bus.on('visited', (/** @type {{ user: number, dest?: number }} */ ev) => {
    const at = stopCell(ev);
    if (at >= 0) fx.pop(at, fx.remaining(ev.user));
    hud.toast('STOP REACHED — PATIENCE RESTORED');
  });

  // Every generated block ships at least two defects now, so the old "got away with it"
  // branch and the singular form are both unreachable.
  bus.on('blockPlaced', (/** @type {{ mines: number }} */ ev) => {
    hud.toast(`INTRODUCED ${ev.mines} DEFECTS`);
  });
  // Shipping a beta changes where users are walking, which is a bigger deal than the one tile
  // that appeared says. The toast names the consequence rather than the tile.
  bus.on('betaPlaced', () => hud.toast('BETA SHIPPED — USERS WILL WALK TO IT'));
  bus.on('generateRefunded', () => hud.notice('NOWHERE LEGAL TO PUT IT — TURN REFUNDED'));
  bus.on('analyzed', (/** @type {{ revealed: number[], minesFound: number[] }} */ ev) => {
    hud.toast(`REVIEWED ${ev.revealed.length} CELL${ev.revealed.length === 1 ? '' : 'S'}`);
    for (const c of ev.revealed) fx.flip(c, PALETTE.AI_REVEALED, 0);
  });
  // Never says which destroyed cells held mines — they go silently (SPEC §5). `destroyed`
  // is only the cells whose construction was removed, so the visual extent comes from
  // core's own blastArea() over the pre-blast state.
  bus.on('detonate', (/** @type {{ at: number, destroyed: number[] }} */ ev) => {
    hud.notice(`DETONATION — ${ev.destroyed.length} TILES LOST`);
    fx.detonate(prev, ev.at, ev.destroyed, blastArea(prev, ev.at), walkDelay(ev.at));
    stopRun();     // no second notice: a blast announces itself louder than a line of text
  });
  bus.on('rejected', (/** @type {{ reason: string }} */ ev) => {
    // The action bar reads legalActions(), so this should be unreachable. Say so loudly.
    console.warn('slop-sweeper: reducer rejected an action —', ev.reason);
    hud.notice(`REJECTED: ${ev.reason.toUpperCase()}`);
  });
  // A user leaving for good is the loudest thing that happens without an explosion, and it is
  // the one loss the player can still do something about next time — so it is named, and it
  // says which of the two ways it happened.
  bus.on('userLost', (/** @type {{ reason: 'gaveUp' | 'detonation' }} */ ev) => {
    hud.notice(ev.reason === 'gaveUp' ? 'A USER GAVE UP WAITING' : 'A USER WAS CAUGHT IN THE BLAST');
    stopRun();
  });
  // The end screens are overlays (PLAN §11.9), so they are held back until the module lands;
  // in practice it has loaded long before anybody finishes a game.
  bus.on('won', (/** @type {{ served: number, total: number }} */ ev) => { stopRun(); showEnd(true, ev); });
  bus.on('lost', (/** @type {{ served: number, total: number }} */ ev) => { stopRun(); showEnd(false, ev); });

  // --- fast-forward (PLAN §12.6) ------------------------------------------------------
  // Pure UI sugar over the same `wait` the button next to it dispatches. It stops the
  // moment anything is worth looking at, and the definition of "worth looking at" is
  // deliberately wide: a blast, a user who could not move, the end of the game, or the
  // player touching anything at all.

  /** @type {number | undefined} */
  let ffTimer;
  let running = false;
  /** Set by the drain while a fast-forward tick is resolving. */
  let ffSteps = 0;
  let ffHalt = '';

  bus.on('step', () => { ffSteps++; });
  bus.on('userLost', () => { ffHalt = ffHalt || 'A USER IS GONE'; });

  function toggleRun() {
    if (running) stopRun();
    else startRun();
  }

  /**
   * Space. The gate is the BUTTON'S OWN disabled flag rather than a second copy of the rule
   * that sets it — hud.js decides when fast-forward is worth offering (there has to be somebody
   * who could move, PLAN §12.6), and asking it that way means the key and the button can never
   * drift apart. Pressing a disabled button does nothing; so does this.
   */
  function runKey() {
    if (/** @type {HTMLButtonElement} */ (hud.runButton()).disabled) return;
    toggleRun();
  }

  function startRun() {
    if (running || s.phase.k !== 'play') return;
    running = true;
    hud.setRun(true);
    tickRun();
  }

  /** @param {string} [reason] shown as a notice when the stop was not the player's doing */
  function stopRun(reason) {
    if (!running) return;
    running = false;
    clearTimeout(ffTimer);
    ffTimer = undefined;
    hud.setRun(false);
    if (reason) hud.notice(`STOPPED — ${reason}`);
  }

  function tickRun() {
    if (!running) return;
    if (s.phase.k !== 'play') return stopRun();
    const moving = s.users.some((u) => u.state === 'moving');
    ffSteps = 0;
    ffHalt = '';
    dispatch({ t: 'wait' });
    if (!running) return;                    // a drained event already stopped us
    if (s.phase.k !== 'play') return stopRun();
    if (ffHalt) return stopRun(ffHalt);
    // A tick where somebody who was walking did not walk is a stall or a strand — the two
    // cases SPEC §6.4 counts as waiting, and both are things the player has to answer.
    if (moving && ffSteps === 0) return stopRun('NOBODY COULD MOVE');
    ffTimer = setTimeout(tickRun, RULES.FF_INTERVAL_MS);
  }

  // Any input at all stops it, and "any" is enforced at the document rather than per
  // control, so a button added later cannot forget to opt in. The Run button itself is the
  // one exception — pressing it is how you start.
  const runBtn = hud.runButton();
  /** @param {EventTarget | null} t */
  const isRunBtn = (t) => t instanceof Node && runBtn.contains(t);
  document.addEventListener('pointerdown', (e) => { if (!isRunBtn(e.target)) stopRun(); }, true);
  document.addEventListener('click', (e) => { if (!isRunBtn(e.target)) stopRun(); }, true);
  // Space is the Run button's key, so it is spared here for exactly the reason the button is:
  // pressing it is how you start, and a rule that stopped the run on any input would make the
  // toggle unable to toggle. Every other key still stops it, arrows included — looking around
  // mid-fast-forward is precisely the moment you wanted it to stop.
  window.addEventListener('keydown', (e) => { if (e.key !== ' ') stopRun(); }, true);

  // --- frame model ------------------------------------------------------------------

  let drawPending = false;
  function requestDraw() {
    if (drawPending) return;
    drawPending = true;
    requestAnimationFrame(() => {
      drawPending = false;
      selfHeal();
      renderer.draw(s, camera, view, fx);
      hud.minimap(s, camera);           // keeps the viewport rectangle honest while panning
    });
  }

  /**
   * The one animation loop: the overscroll spring and the view-only effects share it, and
   * it exits the moment neither has anything left to say. Nothing else in the game asks for
   * a frame, so at rest the page requests zero (SPEC §10.8).
   */
  let looping = false;
  function startLoop() {
    if (looping) return;
    if (!cam.needsSettle(camera, s) && !fx.alive()) return;
    looping = true;
    let last = performance.now();
    const step = (/** @type {number} */ now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const more = cam.needsSettle(camera, s) ? cam.settleStep(camera, s, dt) : false;
      fx.update(dt);
      renderer.draw(s, camera, view, fx);   // the static key carries ox/oy: no invalidation needed
      hud.minimap(s, camera);
      if (more || fx.alive()) requestAnimationFrame(step);
      else { looping = false; refresh(); }
    };
    requestAnimationFrame(step);
  }

  // --- resize discipline (SPEC §10.4, PLAN §4) --------------------------------------

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    cam.setViewport(camera, w, h, dpr);
    cam.refit(camera, s);
    renderer.invalidate();
    // Full refresh, not just a redraw: crossing a CSS breakpoint changes the minimap's box
    // and the tray's cell size, and both are the HUD's to re-derive.
    refresh();
  }

  function selfHeal() {
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.max(1, Math.round(canvas.clientWidth * dpr)) ||
        canvas.height !== Math.max(1, Math.round(canvas.clientHeight * dpr))) {
      resize();
    }
  }

  // dpr changes (external monitor, browser zoom) do not fire ResizeObserver; the media
  // query has to be re-armed at the new ratio each time it trips.
  function armDprWatch() {
    try {
      const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      const onChange = () => { resize(); armDprWatch(); };
      if (mq.addEventListener) mq.addEventListener('change', onChange, { once: true });
      else if (/** @type {any} */ (mq).addListener) /** @type {any} */ (mq).addListener(onChange);
    } catch { /* no matchMedia: the observer and visualViewport still cover the common cases */ }
  }

  new ResizeObserver(resize).observe(board);
  window.visualViewport?.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { selfHeal(); requestDraw(); } });
  armDprWatch();

  resize();
  cam.fit(camera, s);
  refresh();
  console.info(`slop-sweeper: '${s.level}' seed ${s.seed} — ?level=${levelId}&seed=${s.seed} replays it exactly`);

  // The start screen and How to Play (PLAN §11.9). Loaded lazily like the Lab, but always
  // loaded rather than gated: the "?" in the HUD reopens the rules mid-game, so the module is
  // part of the shipped game even on the loads where the title card is skipped. The skip rule
  // itself, and why `?seed=` is on it, lives in start.js.
  //
  // `body.starting` is set synchronously so the board is covered for the frame or two the
  // dynamic import takes — otherwise a slow load flashes the game before the title card.
  // A refresh that lands back in a game must not land on the title card — that would be the
  // door in front of the repro link all over again, one screen further in. That holds however
  // the restored game ended: a finished one shows its END screen, derived below from the phase
  // alone, exactly as if the final action had just resolved. Opening the title card first and
  // letting the end screen replace it would be a visible flash of the wrong thing.
  const wantStart = !isLab && !params.has('seed') && !restored;
  if (wantStart) document.body.classList.add('starting');
  if (restored && (s.phase.k === 'won' || s.phase.k === 'lost')) {
    showEnd(s.phase.k === 'won', { served: s.stats.served, total: s.schedule.total });
  }
  import('./start.js')
    .then(({ createStart }) => {
      endScreen = createStart({
        levels: ids,
        getLevel: () => levelId,
        onLevel: (id) => { if (ids.includes(id)) newGame(id, pinnedSeed ?? randomSeed()); },
        onRestart: restart,
      });
      hud.onHelp(endScreen.help);
      if (wantStart) endScreen.open();
      // A game short enough to finish before this module lands is not a real possibility, but
      // if it happened the result would otherwise be swallowed.
      if (pendingEnd) { endScreen.end(pendingEnd); pendingEnd = null; }
    })
    .catch((err) => {
      document.body.classList.remove('starting');
      console.error('slop-sweeper: the start screen failed to load', err);
    });

  // The Level Lab is a dev tool (PLAN §9.2): loaded only when asked for, so the shipped
  // page never fetches it and core never learns it exists.
  if (isLab) {
    import('./lab.js')
      .then(({ createLab }) => createLab({
        getSeed: () => s.seed,
        getLevel: () => labDef ?? levelDef,
        onPlay: playDef,
      }))
      .catch((err) => console.error('slop-sweeper: the Level Lab failed to load', err));
  }
}

// Importing this module in Node (the ui import check) must not throw: it boots a page only
// when there is a page to boot.
if (typeof document !== 'undefined') {
  try {
    boot();
  } catch (err) {
    console.error('slop-sweeper: boot failed', err);
  }
}
