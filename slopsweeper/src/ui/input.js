// @ts-check
// Pointer Events and the keyboard → intents. This module never touches game state: it emits a
// cell, a rotate, a confirm, a verb, or a camera change, and `main.js` is the only thing that
// dispatches reducer actions — and only ever as `{ t, cell, rot? }` tuples (SPEC §10.9).
//
// Two-step select→act (SPEC §10.6): a tap on the board selects, and nothing on the board
// ever spends a turn. Only the action bar does. That kills the tap-vs-pan misfire class by
// construction, which matters when a misfire costs a scarce turn.
//
// THE KEYBOARD IS THE SAME GAME (owner decision 2026-08-05). It stopped being the dev
// convenience it was and became a full second way to play, and it did that without a second
// code path: an arrow key produces a CELL INDEX and hands it to the same sink a tap does, and
// a letter key produces an ActionKind and hands it to the same sink the action bar's buttons
// do. That is SPEC §10.9's rule read forwards rather than as a promise — input is coordinates,
// not clicks, so a keyboard is just another way to name a coordinate. Nothing about the
// keyboard reaches the reducer that the pointer did not already reach.

import { RULES } from '../core/rules.js';
import * as cam from './camera.js';

/** @typedef {import('../core/state.js').GameState} GameState */
/** @typedef {import('../core/state.js').ActionKind} ActionKind */
/** @typedef {import('./camera.js').Camera} Camera */

/**
 * @typedef {object} InputHandlers
 * @property {() => GameState} getState
 * @property {(cell: number) => void} onTap         cell index, or -1 for empty space
 * @property {() => void} onViewChange              camera moved: redraw
 * @property {() => void} onGestureEnd              release: settle any rubber-band
 * @property {() => void} onRotate
 * @property {() => void} onConfirm
 * @property {() => void} onEscape
 * @property {() => number} getSelected             the one selection, so arrows can step it
 * @property {(cell: number) => void} onCursor      arrow-key select: same cell, camera follows
 * @property {(kind: ActionKind) => void} onVerb    a hotkey, gated by legalActions() in main
 * @property {() => void} onRun                     Space: the fast-forward toggle
 * @property {() => boolean} isBlocked              an overlay owns the keyboard right now
 * @property {() => void} [wake]                    re-verify the backing store on activity
 */

/**
 * The letter keys, and the whole of the mapping: each one is the verb whose button wears that
 * letter in its badge (hud.js VERBS, index.html for the globals). Two-way by construction —
 * there is one table, the buttons read their badge from it, and a key that is not in it is a
 * key the UI never claimed to have.
 * @type {Record<string, ActionKind>}
 */
const HOTKEYS = {
  p: 'place',
  a: 'analyze',
  f: 'flag',
  b: 'beta',
  g: 'generate',
  w: 'wait',
};

/**
 * One step of the keyboard cursor, in cell coordinates.
 *
 * The two rules that are not "add one to x" are the ones that make a keyboard playable on
 * these boards:
 *   · VOID is SKIPPED, not stopped at. A level like `delta` is several lobes of ocean with
 *     nothing between them, and a cursor that halted at the first void cell could not reach
 *     half its own map. So the scan keeps going in the same direction until it finds real
 *     terrain — which is exactly what a player means by "over there" when they look at a gap.
 *   · The scan stops at the PLAYABLE BBOX (SPEC §10.7), never at the array's edges. The array
 *     is a rectangle the level happens to live in; the bbox is the level.
 * Returns -1 when there is nothing that way, and the caller does not move — a cursor that
 * silently wrapped to the far side would be a cursor you had to watch instead of the board.
 * @param {GameState} s
 * @param {number} from
 * @param {number} dx  -1, 0 or 1
 * @param {number} dy
 * @returns {number} the cell to select, or -1
 */
function stepCell(s, from, dx, dy) {
  let x = (from % s.w) + dx;
  let y = Math.floor(from / s.w) + dy;
  while (x >= s.bbox.x0 && x <= s.bbox.x1 && y >= s.bbox.y0 && y <= s.bbox.y1) {
    const i = y * s.w + x;
    if (s.terrain[i] !== 'void') return i;
    x += dx;
    y += dy;
  }
  return -1;
}

/**
 * @param {HTMLElement} el        the board container (touch-action: none)
 * @param {Camera} camera
 * @param {InputHandlers} h
 */
export function createInput(el, camera, h) {
  /** @type {Map<number, { x: number, y: number, sx: number, sy: number, t: number }>} */
  const pointers = new Map();
  /** @type {'none' | 'pan' | 'pinch'} */
  let mode = 'none';
  let tapCandidate = false;
  /** @type {{ dist: number, artPx: number } | null} */
  let pinchBase = null;
  /** @type {{ x: number, y: number } | null} */
  let lastMid = null;
  let rect = { left: 0, top: 0 };
  let wheelAcc = 0;

  const wake = () => h.wake?.();
  const refreshRect = () => { const r = el.getBoundingClientRect(); rect = { left: r.left, top: r.top }; };

  /**
   * DOM laid over the board — the end screen's buttons (PLAN §11.8) — owns its own pointers.
   * The board's `preventDefault` on pointerdown suppresses the compatibility mouse events,
   * and with them the `click` the button is waiting for, so an overlay control would look
   * pressed and do nothing. Asking whether the target is interactive keeps that decision
   * out of this module's knowledge of the page.
   * @param {Event} e
   * @returns {boolean}
   */
  const overlayOwns = (e) =>
    e.target instanceof Element && e.target.closest('button, a, select, input, textarea') !== null;
  /** @param {PointerEvent | WheelEvent} e */
  const css = (e) => ({ x: e.clientX - rect.left, y: e.clientY - rect.top });

  /** @returns {{ x: number, y: number, dist: number } | null} */
  function twoFinger() {
    const list = [...pointers.values()];
    if (list.length < 2) return null;
    const [a, b] = list;
    return {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
    };
  }

  el.addEventListener('pointerdown', (e) => {
    if (overlayOwns(e)) return;
    // Touching the board reclaims the keyboard. The canvas is not focusable, so a click here
    // never moves focus on its own — whatever control had it (the level select, after picking
    // a map) KEEPS it, and the next hotkey lands in that control instead of the game: P was
    // jumping the selector to 'plain' (owner bug report 2026-08-05). Blurring on the way in
    // makes the guard in the keydown path ("keys are dead while a form control has focus")
    // mean what it was always meant to mean: dead while you are USING the control, not dead
    // forever because you once had.
    const focused = document.activeElement;
    if (focused instanceof HTMLElement && focused !== document.body) focused.blur();
    wake();
    refreshRect();
    const p = css(e);
    pointers.set(e.pointerId, { x: p.x, y: p.y, sx: p.x, sy: p.y, t: performance.now() });
    try { el.setPointerCapture(e.pointerId); } catch { /* synthetic pointers throw */ }
    if (pointers.size === 1) {
      mode = 'pan';
      tapCandidate = true;
    } else if (pointers.size === 2) {
      mode = 'pinch';
      tapCandidate = false;
      const two = twoFinger();
      if (two) {
        pinchBase = { dist: two.dist, artPx: camera.artPx };
        lastMid = { x: two.x, y: two.y };
      }
    }
    e.preventDefault();
  });

  el.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const c = css(e);
    const dx = c.x - p.x;
    const dy = c.y - p.y;
    p.x = c.x;
    p.y = c.y;

    if (mode === 'pan' && pointers.size === 1) {
      if (Math.hypot(c.x - p.sx, c.y - p.sy) > RULES.TAP_SLOP_CSS) tapCandidate = false;
      if (!tapCandidate) {
        cam.panBy(camera, h.getState(), dx * camera.dpr, dy * camera.dpr, true);
        h.onViewChange();
      }
    } else if (mode === 'pinch') {
      const two = twoFinger();
      if (two && pinchBase) {
        // Zoom is anchored at the gesture midpoint — non-negotiable (SPEC §10.5) — and the
        // midpoint's own movement pans at the same time.
        applyPinchZoom(two.dist, two.x, two.y);
        if (lastMid) {
          cam.panBy(camera, h.getState(), (two.x - lastMid.x) * camera.dpr, (two.y - lastMid.y) * camera.dpr, true);
        }
        lastMid = { x: two.x, y: two.y };
        h.onViewChange();
      }
    }
    e.preventDefault();
  });

  /**
   * Integer artPx with hysteresis (PLAN §12.3): the switch happens 0.6 of a step past the
   * boundary, so a finger hovering on a threshold cannot flicker the tier. Every rest state
   * — and every frame — is a whole number of device pixels per art pixel.
   * @param {number} dist
   * @param {number} midX  CSS px
   * @param {number} midY
   */
  function applyPinchZoom(dist, midX, midY) {
    if (!pinchBase) return;
    const desired = pinchBase.artPx * (dist / pinchBase.dist);
    const anchor = cam.screenToDevice(camera, midX, midY);
    let changed = false;
    while (desired >= camera.artPx + 0.6 && camera.artPx < camera.maxArtPx) {
      if (!cam.zoomBy(camera, h.getState(), 1, anchor.x, anchor.y)) break;
      changed = true;
    }
    while (desired <= camera.artPx - 0.6 && camera.artPx > camera.minArtPx) {
      if (!cam.zoomBy(camera, h.getState(), -1, anchor.x, anchor.y)) break;
      changed = true;
    }
    return changed;
  }

  /**
   * @param {PointerEvent} e
   * @param {boolean} allowTap
   */
  function release(e, allowTap) {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    pointers.delete(e.pointerId);
    try { el.releasePointerCapture(e.pointerId); } catch { /* already gone */ }

    const quick = performance.now() - p.t <= RULES.TAP_MS;
    const still = Math.hypot(p.x - p.sx, p.y - p.sy) <= RULES.TAP_SLOP_CSS;
    if (allowTap && tapCandidate && quick && still) {
      h.onTap(cam.screenToCell(camera, h.getState(), p.x, p.y));
    }

    if (pointers.size === 1) {
      // Dropping from pinch to one finger: re-baseline so the board does not jump.
      mode = 'pan';
      tapCandidate = false;
      pinchBase = null;
      lastMid = null;
    } else if (pointers.size === 0) {
      mode = 'none';
      tapCandidate = false;
      pinchBase = null;
      lastMid = null;
      h.onGestureEnd();
    }
  }

  el.addEventListener('pointerup', (e) => { release(e, true); e.preventDefault(); });
  el.addEventListener('pointercancel', (e) => { release(e, false); });        // abort, never a tap
  el.addEventListener('lostpointercapture', (e) => { if (pointers.has(e.pointerId)) release(e, false); });

  el.addEventListener('wheel', (e) => {
    if (overlayOwns(e)) return;
    wake();
    refreshRect();
    e.preventDefault();
    // ctrl+wheel is what a trackpad pinch sends; both do the same thing here.
    wheelAcc += e.deltaY;
    const step = 50;
    let steps = 0;
    while (wheelAcc <= -step) { wheelAcc += step; steps++; }
    while (wheelAcc >= step) { wheelAcc -= step; steps--; }
    if (steps === 0) return;
    const c = css(e);
    const anchor = cam.screenToDevice(camera, c.x, c.y);
    if (cam.zoomBy(camera, h.getState(), steps, anchor.x, anchor.y)) h.onViewChange();
  }, { passive: false });

  // iOS Safari page zoom and double-tap zoom would otherwise steal the board (PLAN §16).
  for (const t of ['gesturestart', 'gesturechange', 'gestureend']) {
    el.addEventListener(t, (e) => e.preventDefault());
  }
  el.addEventListener('dblclick', (e) => e.preventDefault());
  el.addEventListener('contextmenu', (e) => e.preventDefault());

  // The keyboard. Three guards stand in front of every key, and each one is a promise:
  //   · A DOM FIELD KEEPS ITS OWN KEYS. The Level Lab's fields are the live case since the
  //     level dropdown became a button (2026-08-20) — 'p' typed into a Lab input is a letter
  //     of a level id, and must not also place a tile. BUTTON is
  //     deliberately NOT on this list any more: clicking GENERATE leaves the focus on it, and a
  //     keyboard that went dead the moment you touched a button would not be a way to play.
  //     `preventDefault` below is what stops a focused button firing on its own Space/Enter.
  //   · BROWSER SHORTCUTS WIN. Any of ctrl/alt/meta and this module has no opinion at all.
  //   · AN OPEN PANEL OWNS THE KEYBOARD. While the start card, the rules, an end screen, the
  //     roster or the drawer is up, nothing here fires — including Escape, which those panels
  //     take in capture (start.js, roster.js, drawer.js) and never let reach us anyway.
  window.addEventListener('keydown', (e) => {
    const t = /** @type {HTMLElement | null} */ (e.target);
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA')) return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (h.isBlocked()) return;
    const s = h.getState();
    const center = { x: camera.cw / 2, y: camera.ch / 2 };
    switch (e.key) {
      // The cursor. ONE selection concept: this produces the same cell index a tap does and
      // hands it to the same handler, so the action bar, the ghost, the blast preview and the
      // selection ring all update without knowing which device moved it. With nothing selected
      // the first arrow lands on A, because A is the one cell every board has and the one place
      // every run starts — hunting for the cursor is not a puzzle this game is offering.
      case 'ArrowLeft': case 'ArrowRight': case 'ArrowUp': case 'ArrowDown': {
        const dx = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
        const dy = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
        const from = h.getSelected();
        const next = from < 0 ? s.origin : stepCell(s, from, dx, dy);
        if (next >= 0) h.onCursor(next);
        break;
      }
      case 'r': case 'R': h.onRotate(); break;
      case 'Enter': h.onConfirm(); break;
      case 'Escape': h.onEscape(); break;
      // Space is RUN, and the preventDefault at the bottom is load-bearing twice over: it stops
      // the page scrolling, and it stops a HUD button that happens to hold focus activating
      // itself underneath the toggle.
      case ' ': h.onRun(); break;
      case '+': case '=': if (cam.zoomBy(camera, s, 1, center.x, center.y)) h.onViewChange(); break;
      case '-': case '_': if (cam.zoomBy(camera, s, -1, center.x, center.y)) h.onViewChange(); break;
      default: {
        // A verb. It is handed on by NAME, not dispatched: main.js asks legalActions() the same
        // question the action bar asks before it draws a button, so a key can never spend a
        // turn on something the bar would not have offered (SPEC §10.6).
        const verb = HOTKEYS[e.key.toLowerCase()];
        if (!verb) return;
        h.onVerb(verb);
      }
    }
    e.preventDefault();
  });
}
