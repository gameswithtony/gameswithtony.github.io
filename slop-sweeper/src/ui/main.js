// @ts-check
// Boot and wiring. This is the only module that dispatches reducer actions, and it only
// ever dispatches `{ t, cell, rot? }` tuples (SPEC §10.9) — input produces intents, the
// HUD produces verbs, and everything meets here.
//
// Frame model (PLAN §11.4): there is no continuous RAF. The board is motionless between
// ticks, so drawing is on demand; a loop runs only while the overscroll spring is alive and
// then sleeps. Every wake re-verifies the canvas backing store (gorillas' self-heal).

import { blastArea, init, reduce } from '../core/reduce.js';
import { randomSeed } from '../core/rng.js';
import { getLevel, levelIds } from '../levels/index.js';
import * as cam from './camera.js';
import { createRenderer, ghostCells } from './renderer.js';
import { createInput } from './input.js';
import { createHud } from './hud.js';

/** @typedef {import('../core/state.js').GameState} GameState */
/** @typedef {import('../core/state.js').Action} Action */
/** @typedef {import('../core/state.js').Ev} Ev */
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

  let s = init(getLevel(levelId), pinnedSeed ?? randomSeed());
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
    onLevel: (id) => newGame(id, pinnedSeed ?? randomSeed()),
    onRestart: () => newGame(levelId, pinnedSeed ?? randomSeed()),
    onMinimapJump: (cell) => { cam.centerOnCell(camera, s, cell); renderer.invalidate(); refresh(); },
    onCopySeed: copySeed,
  });
  hud.setLevels(ids, levelId);

  createInput(board, camera, {
    getState: () => s,
    onTap: select,
    onViewChange: () => { renderer.invalidate(); requestDraw(); },
    onGestureEnd: settle,
    onRotate: rotate,
    onConfirm: confirmBlock,
    onEscape: () => select(-1),
    wake: selfHeal,
  });

  // --- game flow ------------------------------------------------------------------

  /**
   * @param {string} id
   * @param {number} seed
   */
  function newGame(id, seed) {
    levelId = id;
    store.set(STORE_KEY, id);
    s = init(getLevel(id), seed);
    view.selected = -1;
    view.rot = 0;
    hud.hideBanner();
    hud.setLevels(ids, id);
    const url = new URL(location.href);
    url.searchParams.set('level', id);
    if (pinnedSeed !== null) url.searchParams.set('seed', String(seed));
    history.replaceState(null, '', url);
    cam.setViewport(camera, canvas.clientWidth, canvas.clientHeight, window.devicePixelRatio || 1);
    cam.fit(camera, s);
    renderer.invalidate();
    refresh();
  }

  /** @param {Action} a */
  function dispatch(a) {
    if (s.phase.k === 'won' || s.phase.k === 'lost') return;
    const out = reduce(s, a);
    s = out.s;
    bus.drain(out.ev);
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

  bus.on('blockPlaced', (/** @type {{ mines: number }} */ ev) => {
    hud.toast(ev.mines === 0 ? 'GOT AWAY WITH IT — 0 DEFECTS' : `INTRODUCED ${ev.mines} DEFECT${ev.mines === 1 ? '' : 'S'}`);
  });
  bus.on('generateRefunded', () => hud.notice('NOWHERE LEGAL TO PUT IT — TURN REFUNDED'));
  bus.on('analyzed', (/** @type {{ revealed: number[], minesFound: number[] }} */ ev) => {
    hud.toast(`REVIEWED ${ev.revealed.length} · CONFIRMED ${ev.minesFound.length}`);
  });
  // Never says which destroyed cells held mines — they go silently (SPEC §5).
  bus.on('detonate', (/** @type {{ destroyed: number[] }} */ ev) => {
    hud.notice(`DETONATION — ${ev.destroyed.length} TILES LOST`);
  });
  bus.on('rejected', (/** @type {{ reason: string }} */ ev) => {
    // The action bar reads legalActions(), so this should be unreachable. Say so loudly.
    console.warn('slop-sweeper: reducer rejected an action —', ev.reason);
    hud.notice(`REJECTED: ${ev.reason.toUpperCase()}`);
  });
  bus.on('won', () => hud.banner('SHIPPED', `${s.stats.served} users served in ${s.tick} ticks · ${s.stats.detonations} detonations`));
  bus.on('lost', () => hud.banner('CONFIDENCE GONE', `${s.stats.served}/${s.schedule.total} served · ${s.tick} ticks`));

  // --- frame model ------------------------------------------------------------------

  let drawPending = false;
  function requestDraw() {
    if (drawPending) return;
    drawPending = true;
    requestAnimationFrame(() => {
      drawPending = false;
      selfHeal();
      renderer.draw(s, camera, view);
      hud.minimap(s, camera);           // keeps the viewport rectangle honest while panning
    });
  }

  let settling = false;
  function settle() {
    if (settling || !cam.needsSettle(camera, s)) return;
    settling = true;
    let last = performance.now();
    const step = (/** @type {number} */ now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const more = cam.settleStep(camera, s, dt);
      renderer.draw(s, camera, view);      // the static key carries ox/oy: no invalidation needed
      hud.minimap(s, camera);
      if (more) requestAnimationFrame(step);
      else { settling = false; refresh(); }
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
