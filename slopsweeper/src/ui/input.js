// @ts-check
// Pointer Events → intents. This module never touches game state: it emits a cell, a
// rotate, a confirm, or a camera change, and `main.js` is the only thing that dispatches
// reducer actions — and only ever as `{ t, cell, rot? }` tuples (SPEC §10.9).
//
// Two-step select→act (SPEC §10.6): a tap on the board selects, and nothing on the board
// ever spends a turn. Only the action bar does. That kills the tap-vs-pan misfire class by
// construction, which matters when a misfire costs a scarce turn.

import { RULES } from '../core/rules.js';
import * as cam from './camera.js';

/** @typedef {import('../core/state.js').GameState} GameState */
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
 * @property {() => void} [onFlag]                  toggle the flag on the selected cell
 * @property {() => void} [wake]                    re-verify the backing store on activity
 */

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

  // Keyboard is a dev convenience, not the deferred accessibility layer (SPEC §10.9); the
  // guard is gorillas' — DOM fields keep their own keys.
  window.addEventListener('keydown', (e) => {
    const t = /** @type {HTMLElement | null} */ (e.target);
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.tagName === 'BUTTON')) return;
    const s = h.getState();
    const pan = 4 * cam.tilePx(camera);
    const center = { x: camera.cw / 2, y: camera.ch / 2 };
    switch (e.key) {
      case 'r': case 'R': h.onRotate(); break;
      // The one keyboard verb, and only because it is the one that costs nothing: every other
      // action spends a scarce turn and stays behind the two-step select→act rule (SPEC §10.6).
      // The handler re-checks legality — this path has no action bar in front of it.
      case 'f': case 'F': h.onFlag?.(); break;
      case 'Enter': h.onConfirm(); break;
      case 'Escape': h.onEscape(); break;
      case '+': case '=': if (cam.zoomBy(camera, s, 1, center.x, center.y)) h.onViewChange(); break;
      case '-': case '_': if (cam.zoomBy(camera, s, -1, center.x, center.y)) h.onViewChange(); break;
      case 'ArrowLeft': cam.panBy(camera, s, pan, 0); h.onViewChange(); break;
      case 'ArrowRight': cam.panBy(camera, s, -pan, 0); h.onViewChange(); break;
      case 'ArrowUp': cam.panBy(camera, s, 0, pan); h.onViewChange(); break;
      case 'ArrowDown': cam.panBy(camera, s, 0, -pan); h.onViewChange(); break;
      default: return;
    }
    e.preventDefault();
  });
}
