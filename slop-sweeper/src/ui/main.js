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
import { blastArea, init, reduce } from '../core/reduce.js';
import { randomSeed } from '../core/rng.js';
import { getLevel, levelIds } from '../levels/index.js';
import * as cam from './camera.js';
import { createRenderer, ghostCells } from './renderer.js';
import { createInput } from './input.js';
import { createHud } from './hud.js';
import { createEffects } from './particles.js';
import { PALETTE } from './palette.js';

/** @typedef {import('../core/state.js').GameState} GameState */
/** @typedef {import('../core/state.js').Action} Action */
/** @typedef {import('../core/state.js').Ev} Ev */
/** @typedef {import('../levels/index.js').LevelDef} LevelDef */
/** @typedef {import('./renderer.js').ViewOverlay} ViewOverlay */

const STORE_KEY = 'slop-sweeper.level';

/** localStorage must never be load-bearing: the game runs with storage unavailable (PLAN §4). */
const store = {
  /** @param {string} k @returns {string | null} */
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  /** @param {string} k @param {string} v */
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

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
  const pinnedSeed = params.has('seed') ? (Number(params.get('seed')) >>> 0) : null;
  const wanted = params.get('level') ?? store.get(STORE_KEY) ?? ids[0];
  let levelId = ids.includes(wanted) ? wanted : ids[0];

  const camera = cam.createCamera();
  const renderer = createRenderer(canvas);
  const bus = createBus();
  const fx = createEffects();

  /** @type {LevelDef} */
  let levelDef = getLevel(levelId);
  /**
   * Non-null while the Level Lab's definition is the one being played (PLAN §9.2).
   * @type {LevelDef | null}
   */
  let labDef = null;

  let s = init(levelDef, pinnedSeed ?? randomSeed());
  /**
   * The state as it was before the action currently being drained — the only place a
   * destroyed tile still exists to be drawn coming apart (PLAN §11.6).
   * @type {GameState}
   */
  let prev = s;
  /** @type {ViewOverlay} */
  const view = { selected: -1, rot: 0, anchors: null, ghost: null, blast: null };

  const hud = createHud({
    onAction: (kind) => {
      switch (kind) {
        case 'generate': return dispatch({ t: 'generate' });
        case 'wait': return dispatch({ t: 'wait' });
        case 'place': return view.selected >= 0 && dispatch({ t: 'place', cell: view.selected });
        case 'analyze': return view.selected >= 0 && dispatch({ t: 'analyze', cell: view.selected });
        case 'placeBlock': return confirmBlock();
        default: return undefined;
      }
    },
    onRotate: rotate,
    onConfirm: confirmBlock,
    onLevel: (id) => { if (ids.includes(id)) newGame(id, pinnedSeed ?? randomSeed()); else restart(); },
    onRestart: restart,
    onMinimapJump: (cell) => { cam.centerOnCell(camera, s, cell); renderer.invalidate(); refresh(); },
    onCopySeed: copySeed,
    onRun: toggleRun,
  });
  hud.setLevels(ids, levelId);

  createInput(board, camera, {
    getState: () => s,
    onTap: select,
    onViewChange: () => { renderer.invalidate(); requestDraw(); },
    onGestureEnd: () => startLoop(),
    onRotate: rotate,
    onConfirm: confirmBlock,
    onEscape: () => select(-1),
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
    hud.hideBanner();
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
    startLoop();
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
  bus.on('arrived', (/** @type {{ user: number }} */ ev) => {
    fx.pop(s.dest, fx.remaining(ev.user));
  });

  bus.on('blockPlaced', (/** @type {{ mines: number }} */ ev) => {
    hud.toast(ev.mines === 0 ? 'GOT AWAY WITH IT — 0 DEFECTS' : `INTRODUCED ${ev.mines} DEFECT${ev.mines === 1 ? '' : 'S'}`);
  });
  bus.on('generateRefunded', () => hud.notice('NOWHERE LEGAL TO PUT IT — TURN REFUNDED'));
  bus.on('analyzed', (/** @type {{ revealed: number[], minesFound: number[] }} */ ev) => {
    hud.toast(`REVIEWED ${ev.revealed.length} · CONFIRMED ${ev.minesFound.length}`);
    for (const c of ev.revealed) fx.flip(c, PALETTE.AI_REVEALED, 0);
    for (const c of ev.minesFound) fx.flip(c, PALETTE.RED, 0);
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
  bus.on('won', () => { stopRun(); hud.endScreen(s, 'SHIPPED', `${s.level} · seed ${s.seed}`); });
  bus.on('lost', () => { stopRun(); hud.endScreen(s, 'CONFIDENCE GONE', `${s.level} · seed ${s.seed}`); });

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
  bus.on('requeued', () => { ffHalt = ffHalt || 'A USER WENT BACK'; });

  function toggleRun() {
    if (running) stopRun();
    else startRun();
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
  window.addEventListener('keydown', () => stopRun(), true);

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

  // The Level Lab is a dev tool (PLAN §9.2): loaded only when asked for, so the shipped
  // page never fetches it and core never learns it exists.
  const labParam = params.get('lab');
  if (labParam !== null && labParam !== '0') {
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
