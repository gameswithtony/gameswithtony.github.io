// @ts-check
// Procedural tiles, baked once per artPx into an offscreen atlas (SPEC §10.8). Drawing is
// procedural; blitting is sprite-fast. Nothing here reads game state: variant *selection*
// is a pure function of (x, y, levelSeed) done at blit time, so a cell's texture never
// changes and panning shows zero shimmer.

import { RULES } from '../core/rules.js';
import { mulberry32 } from '../core/rng.js';
import { PALETTE } from './palette.js';

/** Art pixels per tile edge (SPEC §10.8 recommends 8). */
export const ART = RULES.ART_PX_PER_TILE;

/** How many baked variants each dithered tile kind gets. Power of two: selection is a mask. */
const VARIANTS = 8;
const VARIANT_MASK = VARIANTS - 1;

/**
 * The per-cell texture hash. Pure in (x, y, seed) — SPEC §10.8's anti-shimmer rule is this
 * function and nothing else.
 * @param {number} x
 * @param {number} y
 * @param {number} seed
 * @returns {number} uint32
 */
export function cellHash(x, y, seed) {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (x + 0x85ebca6b), 0xcc9e2d51) >>> 0;
  h = Math.imul(h ^ (y + 0xc2b2ae35), 0x1b873593) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  return h >>> 0;
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} seed
 * @returns {number} 0…VARIANTS-1
 */
export function variantOf(x, y, seed) {
  return cellHash(x, y, seed) & VARIANT_MASK;
}

/**
 * @typedef {object} Atlas
 * @property {number} artPx
 * @property {number} tile              tile edge in device px (ART × artPx)
 * @property {HTMLCanvasElement} canvas
 * @property {(ctx: CanvasRenderingContext2D, name: string, dx: number, dy: number) => void} blit
 * @property {(name: string) => boolean} has
 */

/**
 * @param {number} w
 * @param {number} h
 * @returns {HTMLCanvasElement}
 */
function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, w);
  c.height = Math.max(1, h);
  return c;
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @returns {CanvasRenderingContext2D}
 */
export function crisp(ctx) {
  ctx.imageSmoothingEnabled = false;
  return ctx;
}

/**
 * Every tile the renderer can ask for, in bake order. Names are the renderer's vocabulary.
 * @returns {string[]}
 */
function tileNames() {
  /** @type {string[]} */
  const names = [];
  for (const kind of ['ocean', 'volcano', 'hand', 'hidden']) {
    for (let v = 0; v < VARIANTS; v++) names.push(`${kind}${v}`);
  }
  names.push('revealed', 'mine', 'origin', 'dest', 'tintOk', 'tintRed', 'tintSelect', 'tintUser');
  for (let m = 0; m < 16; m++) names.push(`coastS${m}`);
  for (let m = 0; m < 16; m++) names.push(`coastC${m}`);
  return names;
}

/**
 * Bake the whole tile set at one art-pixel size. Called on load and on every artPx change,
 * never per frame (SPEC §10.8).
 * @param {number} artPx  positive integer device px per art pixel
 * @returns {Atlas}
 */
export function bakeAtlas(artPx) {
  const px = Math.max(1, Math.round(artPx));
  const tile = ART * px;
  const names = tileNames();
  const cols = 10;
  const rows = Math.ceil(names.length / cols);
  const canvas = makeCanvas(cols * tile, rows * tile);
  const ctx = crisp(/** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d')));

  /** @type {Map<string, { sx: number, sy: number }>} */
  const index = new Map();
  names.forEach((name, k) => {
    const sx = (k % cols) * tile;
    const sy = Math.floor(k / cols) * tile;
    index.set(name, { sx, sy });
    paint(ctx, name, sx, sy, px);
  });

  return {
    artPx: px,
    tile,
    canvas,
    has: (name) => index.has(name),
    blit(dst, name, dx, dy) {
      const at = index.get(name);
      if (!at) return;
      dst.drawImage(canvas, at.sx, at.sy, tile, tile, dx, dy, tile, tile);
    },
  };
}

// --- painters ---------------------------------------------------------------------
// All of them work in art-pixel coordinates inside one tile; `p` is the only thing that
// ever converts to device px, so nothing can land off the art grid.

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} ox  tile origin, device px
 * @param {number} oy
 * @param {number} px  artPx
 * @returns {(ax: number, ay: number, color: string, w?: number, h?: number) => void}
 */
function pen(ctx, ox, oy, px) {
  return (ax, ay, color, w = 1, h = 1) => {
    ctx.fillStyle = color;
    ctx.fillRect(ox + ax * px, oy + ay * px, w * px, h * px);
  };
}

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} name
 * @param {number} ox
 * @param {number} oy
 * @param {number} px
 */
function paint(ctx, name, ox, oy, px) {
  const p = pen(ctx, ox, oy, px);
  const variant = Number(name.slice(-1));

  if (name.startsWith('ocean')) return paintOcean(p, variant);
  if (name.startsWith('volcano')) return paintVolcano(p, variant);
  if (name.startsWith('hand')) return paintHand(p, variant);
  if (name.startsWith('hidden')) return paintHidden(p, variant);
  if (name.startsWith('coastS')) return paintCoastSide(p, Number(name.slice(6)));
  if (name.startsWith('coastC')) return paintCoastCorner(p, Number(name.slice(6)));

  switch (name) {
    case 'revealed': return paintRevealed(p);
    case 'mine': return paintMine(p);
    case 'origin': return paintEndpoint(p, true);
    case 'dest': return paintEndpoint(p, false);
    case 'tintOk': return paintTint(p, PALETTE.OK);
    case 'tintRed': return paintTint(p, PALETTE.RED);
    case 'tintSelect': return paintTint(p, PALETTE.SELECT);
    case 'tintUser': return paintTint(p, PALETTE.USER);
    default: throw new Error(`atlas: no painter for tile '${name}'`);
  }
}

/** @typedef {(ax: number, ay: number, color: string, w?: number, h?: number) => void} Pen */

/**
 * Deterministic per-variant noise. Independent of the level seed on purpose: the seed picks
 * *which* variant a cell gets, so the bake survives a level change untouched.
 * @param {number} variant
 * @param {number} salt
 */
function variantRng(variant, salt) {
  return mulberry32((0x5bf03635 + variant * 0x9e3779b9 + salt) >>> 0);
}

/**
 * @param {Pen} p
 * @param {number} v
 */
function paintOcean(p, v) {
  p(0, 0, PALETTE.OCEAN, ART, ART);
  const r = variantRng(v, 11);
  for (let k = 0; k < 3; k++) {
    const len = r.int(2, 3);
    p(r.int(0, ART - len), r.int(0, ART - 1), PALETTE.OCEAN_DITHER, len, 1);
  }
  for (let k = 0; k < 4; k++) p(r.int(0, ART - 1), r.int(0, ART - 1), PALETTE.OCEAN_DITHER);
}

/**
 * @param {Pen} p
 * @param {number} v
 */
function paintVolcano(p, v) {
  p(0, 0, PALETTE.VOLCANO, ART, ART);
  const r = variantRng(v, 23);
  for (let k = 0; k < 7; k++) p(r.int(0, ART - 1), r.int(0, ART - 1), PALETTE.INK);
  for (let k = 0; k < 4; k++) p(r.int(1, ART - 2), r.int(1, ART - 2), PALETTE.RED);
}

/**
 * @param {Pen} p
 * @param {number} v
 */
function paintHand(p, v) {
  p(0, 0, PALETTE.HAND, ART, ART);
  const r = variantRng(v, 37);
  for (let k = 0; k < 8; k++) p(r.int(0, ART - 1), r.int(0, ART - 1), PALETTE.HAND_DITHER);
  p(0, ART - 1, PALETTE.HAND_DITHER, ART, 1);
  p(ART - 1, 0, PALETTE.HAND_DITHER, 1, ART);
}

/**
 * @param {Pen} p
 * @param {number} v
 */
function paintHidden(p, v) {
  p(0, 0, PALETTE.AI_HIDDEN, ART, ART);
  // A 25% ordered dither reads as machine texture; the scatter breaks up the regularity.
  for (let ay = 0; ay < ART; ay++) {
    for (let ax = 0; ax < ART; ax++) {
      if (((ax + ay) & 3) === 0) p(ax, ay, PALETTE.AI_HIDDEN_DITHER);
    }
  }
  const r = variantRng(v, 53);
  for (let k = 0; k < 5; k++) p(r.int(0, ART - 1), r.int(0, ART - 1), PALETTE.AI_HIDDEN_DITHER);
}

/** @param {Pen} p */
function paintRevealed(p) {
  // Flat by design: the clue digit is composited on top and must stay legible.
  p(0, 0, PALETTE.AI_REVEALED, ART, ART);
  p(0, ART - 1, PALETTE.AI_HIDDEN_DITHER, ART, 1);
  p(ART - 1, 0, PALETTE.AI_HIDDEN_DITHER, 1, ART);
}

/** @param {Pen} p */
function paintMine(p) {
  p(0, 0, PALETTE.RED, ART, ART);
  for (let k = 1; k < ART - 1; k++) {
    p(k, k, PALETTE.INK);
    p(ART - 1 - k, k, PALETTE.INK);
  }
}

/**
 * @param {Pen} p
 * @param {boolean} isOrigin
 */
function paintEndpoint(p, isOrigin) {
  p(0, 0, PALETTE.RED, ART, ART);
  p(0, 0, PALETTE.INK, ART, 1);
  p(0, ART - 1, PALETTE.INK, ART, 1);
  p(0, 0, PALETTE.INK, 1, ART);
  p(ART - 1, 0, PALETTE.INK, 1, ART);
  if (isOrigin) {
    p(2, 2, PALETTE.PAPER, 4, 4);           // A: a solid source
  } else {
    p(2, 2, PALETTE.PAPER, 4, 1);           // B: a ring — the thing users fall into
    p(2, 5, PALETTE.PAPER, 4, 1);
    p(2, 3, PALETTE.PAPER, 1, 2);
    p(5, 3, PALETTE.PAPER, 1, 2);
  }
}

/**
 * 50% checkerboard, transparent between: a tint with no alpha blending (PLAN §11.1).
 * @param {Pen} p
 * @param {string} color
 */
function paintTint(p, color) {
  for (let ay = 0; ay < ART; ay++) {
    for (let ax = 0; ax < ART; ax++) {
      if (((ax + ay) & 1) === 0) p(ax, ay, color);
    }
  }
}

/**
 * Coastline stroke drawn *inside* the playable cell along each VOID-facing edge, so VOID is
 * never filled as board (SPEC §10.7). Mask bits: 1 N · 2 E · 4 S · 8 W.
 * @param {Pen} p
 * @param {number} mask
 */
function paintCoastSide(p, mask) {
  if (mask & 1) p(0, 0, PALETTE.COAST, ART, 1);
  if (mask & 2) p(ART - 1, 0, PALETTE.COAST, 1, ART);
  if (mask & 4) p(0, ART - 1, PALETTE.COAST, ART, 1);
  if (mask & 8) p(0, 0, PALETTE.COAST, 1, ART);
}

/**
 * The diagonal case: a VOID cell touching only at a corner would otherwise leave the stroke
 * with a notch. Mask bits: 1 NW · 2 NE · 4 SE · 8 SW.
 * @param {Pen} p
 * @param {number} mask
 */
function paintCoastCorner(p, mask) {
  if (mask & 1) p(0, 0, PALETTE.COAST);
  if (mask & 2) p(ART - 1, 0, PALETTE.COAST);
  if (mask & 4) p(ART - 1, ART - 1, PALETTE.COAST);
  if (mask & 8) p(0, ART - 1, PALETTE.COAST);
}
