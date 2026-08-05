// @ts-check
// Pure view state: integer artPx zoom, device-pixel pan, and the transforms every pointer
// coordinate must route through (SPEC §10.5, the gorillas doctrine of PLAN §4). Nothing in
// `core` reads this module and none of it is ever serialized.
//
// Framing is derived from the PLAYABLE BBOX, never from array dimensions (SPEC §10.7): a
// diagonal channel is framed as a channel, not as the rectangle it happens to live in.

import { RULES } from '../core/rules.js';

/** @typedef {import('../core/state.js').GameState} GameState */

/**
 * @typedef {object} Camera
 * @property {number} cssW    container width in CSS px
 * @property {number} cssH
 * @property {number} dpr
 * @property {number} cw      backing store width in device px
 * @property {number} ch
 * @property {number} artPx   device px per art pixel — always a positive integer
 * @property {number} minArtPx  the fit() floor; recomputed on resize
 * @property {number} maxArtPx
 * @property {number} ox      device-px offset of cell (0,0)'s left edge — integer
 * @property {number} oy
 */

const clamp = (/** @type {number} */ v, /** @type {number} */ lo, /** @type {number} */ hi) =>
  Math.max(lo, Math.min(hi, v));

/** @returns {Camera} */
export function createCamera() {
  return {
    cssW: 1, cssH: 1, dpr: 1, cw: 1, ch: 1,
    artPx: 1, minArtPx: 1, maxArtPx: RULES.ZOOM_MAX_ARTPX,
    ox: 0, oy: 0,
  };
}

/**
 * @param {Camera} cam
 * @returns {number} tile edge in device px
 */
export function tilePx(cam) {
  return RULES.ART_PX_PER_TILE * cam.artPx;
}

/**
 * Backing store = CSS size × dpr (SPEC §10.4). The caller owns the canvas; this only
 * records what the camera must project into.
 * @param {Camera} cam
 * @param {number} cssW
 * @param {number} cssH
 * @param {number} dpr
 */
export function setViewport(cam, cssW, cssH, dpr) {
  cam.cssW = Math.max(1, cssW);
  cam.cssH = Math.max(1, cssH);
  cam.dpr = dpr > 0 ? dpr : 1;
  cam.cw = Math.max(1, Math.round(cam.cssW * cam.dpr));
  cam.ch = Math.max(1, Math.round(cam.cssH * cam.dpr));
}

/**
 * The largest integer artPx whose playable bbox fits the container — the zoom floor.
 * @param {Camera} cam
 * @param {GameState} s
 * @returns {number}
 */
export function fitArtPx(cam, s) {
  const bw = (s.bbox.x1 - s.bbox.x0 + 1) * RULES.ART_PX_PER_TILE;
  const bh = (s.bbox.y1 - s.bbox.y0 + 1) * RULES.ART_PX_PER_TILE;
  const fit = Math.floor(Math.min(cam.cw / bw, cam.ch / bh));
  return clamp(fit, 1, cam.maxArtPx);
}

/**
 * Frame the playable bbox and make that the floor.
 * @param {Camera} cam
 * @param {GameState} s
 */
export function fit(cam, s) {
  cam.minArtPx = fitArtPx(cam, s);
  cam.artPx = cam.minArtPx;
  centerOnBBox(cam, s);
}

/**
 * Re-derive the floor after a resize, keeping the view roughly where it was.
 *
 * fit() is the floor in BOTH directions. Clamping alone ratchets: growing the container
 * lifts artPx to the new (higher) floor, and shrinking it back only lowers the floor, so the
 * elevated zoom sticks and the board ends up clipped with no way back. A camera that was
 * sitting on the floor keeps sitting on it; only a zoom the player chose above the floor
 * survives a resize, and even then the pan is re-clamped so the board stays in view.
 * @param {Camera} cam
 * @param {GameState} s
 */
export function refit(cam, s) {
  const before = centerCell(cam, s);
  const wasAtFloor = cam.artPx <= cam.minArtPx;
  cam.minArtPx = fitArtPx(cam, s);
  cam.artPx = wasAtFloor ? cam.minArtPx : clamp(cam.artPx, cam.minArtPx, cam.maxArtPx);
  centerOnPoint(cam, before.x, before.y);
  clampPan(cam, s);
}

/**
 * @param {Camera} cam
 * @param {GameState} s
 */
export function centerOnBBox(cam, s) {
  centerOnPoint(cam, (s.bbox.x0 + s.bbox.x1 + 1) / 2, (s.bbox.y0 + s.bbox.y1 + 1) / 2);
  clampPan(cam, s);
}

/**
 * @param {Camera} cam
 * @param {number} cellX  fractional cell coordinates
 * @param {number} cellY
 */
export function centerOnPoint(cam, cellX, cellY) {
  const t = tilePx(cam);
  cam.ox = Math.round(cam.cw / 2 - cellX * t);
  cam.oy = Math.round(cam.ch / 2 - cellY * t);
}

/**
 * @param {Camera} cam
 * @param {GameState} s
 * @param {number} cell
 */
export function centerOnCell(cam, s, cell) {
  centerOnPoint(cam, (cell % s.w) + 0.5, Math.floor(cell / s.w) + 0.5);
  clampPan(cam, s);
}

/**
 * @param {Camera} cam
 * @param {GameState} s
 * @returns {{ x: number, y: number }} the fractional cell at the viewport centre
 */
export function centerCell(cam, s) {
  const t = tilePx(cam);
  return { x: (cam.cw / 2 - cam.ox) / t, y: (cam.ch / 2 - cam.oy) / t };
}

/**
 * Pan limits, in device px, derived from the playable bbox. When the bbox is smaller than
 * the viewport the range collapses to a single centred value — that is the letterbox.
 * @param {Camera} cam
 * @param {GameState} s
 * @returns {{ minX: number, maxX: number, minY: number, maxY: number }}
 */
export function panRange(cam, s) {
  const t = tilePx(cam);
  const bx0 = s.bbox.x0 * t, bx1 = (s.bbox.x1 + 1) * t;
  const by0 = s.bbox.y0 * t, by1 = (s.bbox.y1 + 1) * t;
  const bw = bx1 - bx0, bh = by1 - by0;

  let minX, maxX, minY, maxY;
  if (bw <= cam.cw) {
    minX = maxX = Math.round((cam.cw - bw) / 2 - bx0);
  } else {
    minX = cam.cw - bx1;
    maxX = -bx0;
  }
  if (bh <= cam.ch) {
    minY = maxY = Math.round((cam.ch - bh) / 2 - by0);
  } else {
    minY = cam.ch - by1;
    maxY = -by0;
  }
  return { minX, maxX, minY, maxY };
}

/**
 * @param {Camera} cam
 * @param {GameState} s
 */
export function clampPan(cam, s) {
  const r = panRange(cam, s);
  cam.ox = Math.round(clamp(cam.ox, r.minX, r.maxX));
  cam.oy = Math.round(clamp(cam.oy, r.minY, r.maxY));
}

/**
 * Drag pan. With `rubber` the camera may run past the clamp, damped — `settleStep` springs
 * it back when the gesture ends (SPEC §10.5).
 * @param {Camera} cam
 * @param {GameState} s
 * @param {number} dx  device px
 * @param {number} dy
 * @param {boolean} [rubber]
 */
export function panBy(cam, s, dx, dy, rubber = false) {
  if (!rubber) {
    cam.ox = Math.round(cam.ox + dx);
    cam.oy = Math.round(cam.oy + dy);
    clampPan(cam, s);
    return;
  }
  const r = panRange(cam, s);
  cam.ox = Math.round(rubberAxis(cam.ox, dx, r.minX, r.maxX));
  cam.oy = Math.round(rubberAxis(cam.oy, dy, r.minY, r.maxY));
}

/**
 * @param {number} v
 * @param {number} d
 * @param {number} lo
 * @param {number} hi
 * @returns {number}
 */
function rubberAxis(v, d, lo, hi) {
  const next = v + d;
  if (next < lo) return lo - (lo - next) * 0.35;
  if (next > hi) return hi + (next - hi) * 0.35;
  return next;
}

/**
 * @param {Camera} cam
 * @param {GameState} s
 * @returns {boolean}
 */
export function needsSettle(cam, s) {
  const r = panRange(cam, s);
  return cam.ox < r.minX - 0.5 || cam.ox > r.maxX + 0.5 || cam.oy < r.minY - 0.5 || cam.oy > r.maxY + 0.5;
}

/**
 * One frame of the overscroll spring. The pan offset stays a whole number of device pixels
 * throughout, so the step is forced to at least 1px — an exponential approach that rounds
 * would stall a couple of pixels short and never arrive.
 * @param {Camera} cam
 * @param {GameState} s
 * @param {number} dt  seconds
 * @returns {boolean} still settling
 */
export function settleStep(cam, s, dt) {
  const r = panRange(cam, s);
  const k = 1 - Math.exp(-dt / 0.06);
  const tx = clamp(cam.ox, r.minX, r.maxX);
  const ty = clamp(cam.oy, r.minY, r.maxY);
  cam.ox = approach(cam.ox, tx, k);
  cam.oy = approach(cam.oy, ty, k);
  return cam.ox !== tx || cam.oy !== ty;
}

/**
 * @param {number} v
 * @param {number} target
 * @param {number} k
 * @returns {number}
 */
function approach(v, target, k) {
  const gap = target - v;
  if (Math.abs(gap) <= 1) return target;
  const step = gap * k;
  return Math.round(v + (Math.abs(step) < 1 ? Math.sign(step) : step));
}

/**
 * Zoom to an exact integer artPx, keeping the world point under (anchorDevX, anchorDevY)
 * fixed. Anchoring is non-negotiable for pinch (SPEC §10.5) and free for wheel.
 * @param {Camera} cam
 * @param {GameState} s
 * @param {number} artPx
 * @param {number} anchorDevX
 * @param {number} anchorDevY
 * @returns {boolean} whether the zoom actually changed
 */
export function setArtPx(cam, s, artPx, anchorDevX, anchorDevY) {
  const next = clamp(Math.round(artPx), cam.minArtPx, cam.maxArtPx);
  if (next === cam.artPx) return false;
  const before = tilePx(cam);
  const cellX = (anchorDevX - cam.ox) / before;
  const cellY = (anchorDevY - cam.oy) / before;
  cam.artPx = next;
  const after = tilePx(cam);
  cam.ox = Math.round(anchorDevX - cellX * after);
  cam.oy = Math.round(anchorDevY - cellY * after);
  clampPan(cam, s);
  return true;
}

/**
 * @param {Camera} cam
 * @param {GameState} s
 * @param {number} steps  +1 zooms in
 * @param {number} anchorDevX
 * @param {number} anchorDevY
 * @returns {boolean}
 */
export function zoomBy(cam, s, steps, anchorDevX, anchorDevY) {
  return setArtPx(cam, s, cam.artPx + steps, anchorDevX, anchorDevY);
}

// --- transforms: the only way a pointer coordinate becomes a cell ------------------

/**
 * @param {Camera} cam
 * @param {number} cssX  relative to the canvas' top-left
 * @param {number} cssY
 * @returns {{ x: number, y: number }} device px inside the backing store
 */
export function screenToDevice(cam, cssX, cssY) {
  return { x: cssX * cam.dpr, y: cssY * cam.dpr };
}

/**
 * @param {Camera} cam
 * @param {number} cssX
 * @param {number} cssY
 * @returns {{ x: number, y: number }} fractional cell coordinates
 */
export function screenToWorld(cam, cssX, cssY) {
  const d = screenToDevice(cam, cssX, cssY);
  const t = tilePx(cam);
  return { x: (d.x - cam.ox) / t, y: (d.y - cam.oy) / t };
}

/**
 * @param {Camera} cam
 * @param {GameState} s
 * @param {number} cssX
 * @param {number} cssY
 * @returns {number} cell index, or -1 for VOID / off-board — playability decides, not bounds
 */
export function screenToCell(cam, s, cssX, cssY) {
  const w = screenToWorld(cam, cssX, cssY);
  const x = Math.floor(w.x), y = Math.floor(w.y);
  if (x < 0 || y < 0 || x >= s.w || y >= s.h) return -1;
  const i = y * s.w + x;
  return s.terrain[i] === 'void' ? -1 : i;
}

/**
 * @param {Camera} cam
 * @param {GameState} s
 * @param {number} cell
 * @returns {{ x: number, y: number, size: number }} device px
 */
export function cellRect(cam, s, cell) {
  const t = tilePx(cam);
  return { x: cam.ox + (cell % s.w) * t, y: cam.oy + Math.floor(cell / s.w) * t, size: t };
}

/**
 * The visible cell window, clamped to the array. Consumers still test playability per cell.
 * @param {Camera} cam
 * @param {GameState} s
 * @returns {{ x0: number, y0: number, x1: number, y1: number }}
 */
export function visibleCells(cam, s) {
  const t = tilePx(cam);
  return {
    x0: clamp(Math.floor((0 - cam.ox) / t), 0, s.w - 1),
    y0: clamp(Math.floor((0 - cam.oy) / t), 0, s.h - 1),
    x1: clamp(Math.floor((cam.cw - 1 - cam.ox) / t), 0, s.w - 1),
    y1: clamp(Math.floor((cam.ch - 1 - cam.oy) / t), 0, s.h - 1),
  };
}
