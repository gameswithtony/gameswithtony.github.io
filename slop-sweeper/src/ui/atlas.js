// @ts-check
// Procedural tiles, baked once per artPx into an offscreen atlas (SPEC §10.8). Drawing is
// procedural; blitting is sprite-fast. Nothing here reads game state: variant *selection*
// is a pure function of (x, y, levelSeed) done at blit time, so a cell's texture never
// changes and panning shows zero shimmer.

import { RULES } from '../core/rules.js';
import { mulberry32 } from '../core/rng.js';
import { PALETTE } from './palette.js';

/**
 * Art pixels per tile edge. SPEC §10.8 recommends 8; revised to 16 on 2026-08-04 by user
 * decision — a finer art grid per tile is what lets a tile be mostly flat and still carry a
 * crisp one-pixel cell border and a large clue digit, instead of reading as chunky noise.
 */
export const ART = RULES.ART_PX_PER_TILE;

/**
 * Coastline stroke weight in art pixels. Two of sixteen is the same eighth of a tile the
 * one-of-eight stroke was, so the coast reads exactly as heavy as it did.
 */
const COAST_W = 2;

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
  names.push('flag', 'flagFar');
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
    case 'flag': return paintFlag(p);
    case 'flagFar': return paintFlagFar(p);
    case 'tintOk': return paintTint(p, PALETTE.OK);
    case 'tintRed': return paintTint(p, PALETTE.RED);
    case 'tintSelect': return paintTint(p, PALETTE.SELECT);
    case 'tintUser': return paintTint(p, PALETTE.USER);
    default: throw new Error(`atlas: no painter for tile '${name}'`);
  }
}

/** @typedef {(ax: number, ay: number, color: string, w?: number, h?: number) => void} Pen */

/**
 * The one-art-pixel inset border every *constructed* cell wears (PLAN §11 revision
 * 2026-08-04). It is the whole reason a block of AI slop reads as a grid of discrete
 * minesweeper cells rather than as one purple blob: open water has no border, anything
 * anybody built has one.
 * @param {Pen} p
 * @param {string} color
 */
function border(p, color) {
  p(0, 0, color, ART, 1);
  p(0, ART - 1, color, ART, 1);
  p(0, 0, color, 1, ART);
  p(ART - 1, 0, color, 1, ART);
}

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
 * Open water: flat, with two or three short wave dashes and nothing else — about 4% of the
 * tile against the old 18%. Water is the calm surface the built cells read against, so the
 * texture is there to stop a dead flat field, not to be looked at.
 * @param {Pen} p
 * @param {number} v
 */
function paintOcean(p, v) {
  p(0, 0, PALETTE.OCEAN, ART, ART);
  const r = variantRng(v, 11);
  // One to three, not a fixed three: some variants come out flat, and it is the *empty* tiles
  // scattered through the field that stop a whole ocean of them reading as static.
  const n = r.int(1, 3);
  for (let k = 0; k < n; k++) {
    const len = r.int(3, 4);
    p(2 + r.int(0, ART - len - 4), 2 + r.int(0, ART - 5), PALETTE.OCEAN_DITHER, len, 1);
  }
}

/**
 * Dark rock with a few embers. Blobs are 2×2 so a speck is the same physical size it was on
 * the eight-pixel grid rather than a quarter of it.
 * @param {Pen} p
 * @param {number} v
 */
function paintVolcano(p, v) {
  p(0, 0, PALETTE.VOLCANO, ART, ART);
  const r = variantRng(v, 23);
  for (let k = 0; k < 3; k++) p(r.int(1, ART - 3), r.int(1, ART - 3), PALETTE.INK, 2, 2);
  for (let k = 0; k < 2; k++) p(r.int(2, ART - 4), r.int(2, ART - 4), PALETTE.RED, 2, 2);
}

/**
 * @param {Pen} p
 * @param {number} v
 */
function paintHand(p, v) {
  p(0, 0, PALETTE.HAND, ART, ART);
  border(p, PALETTE.HAND_DITHER);
  const r = variantRng(v, 37);
  for (let k = 0; k < 2; k++) p(3 + r.int(0, ART - 7), 3 + r.int(0, ART - 7), PALETTE.HAND_DITHER, 2, 2);
}

/**
 * Unreviewed slop. Flat, bordered, and near-textureless: with generated blocks running to two
 * dozen cells the player reads this tile one cell at a time, and the old 25% ordered dither
 * made a block of them a field of static.
 * @param {Pen} p
 * @param {number} v
 */
function paintHidden(p, v) {
  p(0, 0, PALETTE.AI_HIDDEN, ART, ART);
  border(p, PALETTE.AI_HIDDEN_DITHER);
  const r = variantRng(v, 53);
  for (let k = 0; k < 3; k++) p(3 + r.int(0, ART - 7), 3 + r.int(0, ART - 7), PALETTE.AI_HIDDEN_DITHER);
}

/** @param {Pen} p */
function paintRevealed(p) {
  // Flat by design: the clue digit is composited on top and must stay legible.
  p(0, 0, PALETTE.AI_REVEALED, ART, ART);
  border(p, PALETTE.AI_HIDDEN_DITHER);
}

/**
 * A confirmed defect: one bold X, two art pixels thick, on the same bordered cell as the slop
 * it replaces — not the edge-to-edge diagonal scribble it used to be.
 * @param {Pen} p
 */
function paintMine(p) {
  p(0, 0, PALETTE.RED, ART, ART);
  border(p, PALETTE.INK);
  const a = 4;                       // the X spans the middle half of the tile
  const n = ART - 2 * a - 2;
  for (let k = 0; k <= n; k++) {
    p(a + k, a + k, PALETTE.INK, 2, 2);
    p(ART - 2 - a - k, a + k, PALETTE.INK, 2, 2);
  }
}

/**
 * The two endpoints, at a size that reads without zooming: A is a solid source block, B is a
 * bullseye. The pair has to be distinguishable at a glance on a 50×30 board, which is what
 * the sixteen-pixel grid is for.
 * @param {Pen} p
 * @param {boolean} isOrigin
 */
function paintEndpoint(p, isOrigin) {
  p(0, 0, PALETTE.RED, ART, ART);
  border(p, PALETTE.INK);
  const c = ART >> 1;
  if (isOrigin) {
    p(c - 3, c - 3, PALETTE.PAPER, 6, 6);              // A: a solid source
  } else {
    p(c - 4, c - 4, PALETTE.PAPER, 8, 8);              // B: a target — what users fall into
    p(c - 2, c - 2, PALETTE.RED, 4, 4);
    p(c - 1, c - 1, PALETTE.PAPER, 2, 2);
  }
}

/**
 * The flag a player plants on a cell they believe holds a defect (SPEC §4.3). Both flag tiles
 * are OVERLAYS — they paint only their own pixels and leave the rest of the tile transparent,
 * so a flagged cell keeps the hidden tile's own variant and its inset border underneath and
 * still reads as the same discrete minesweeper cell it was before it was marked.
 *
 * A pennant: two-art-pixel INK pole with a foot, and a stepped RED triangle. Diagonals are
 * runs of rects, never anti-aliased strokes (SPEC §10.8).
 * @param {Pen} p
 */
function paintFlag(p) {
  p(5, 3, PALETTE.INK, 2, 10);          // pole
  p(3, 12, PALETTE.INK, 6, 2);          // foot — without it the pole reads as a stray line
  for (let k = 0; k < 6; k++) p(7, 3 + k, PALETTE.RED, 6 - k, 1);
}

/**
 * The far tier cannot render a pennant — at one device pixel per art pixel the pole is a hair
 * and the triangle is mush. What has to survive zoomed out is *where the flags are*: a line of
 * them along a route is a read of the board. So far tier gets a bold chip instead, on the same
 * art grid, in the same RED.
 * @param {Pen} p
 */
function paintFlagFar(p) {
  p(4, 4, PALETTE.INK, 8, 8);
  p(5, 5, PALETTE.RED, 6, 6);
}

/**
 * 50% checkerboard, transparent between: a tint with no alpha blending (PLAN §11.1). The
 * checker is one art pixel, so at sixteen art pixels per tile it is four times finer than it
 * was and reads as a smooth wash rather than as a coarse grid laid over the board — which is
 * exactly why no alpha deviation was needed here.
 * @param {Pen} p
 * @param {string} color
 */
function paintTint(p, color) {
  for (let ay = 0; ay < ART; ay++) {
    // One fillRect per lit pixel is unavoidable (they alternate), but this is bake-time work:
    // 128 rects per tint tile, four tint tiles, once per artPx change.
    for (let ax = ay & 1; ax < ART; ax += 2) p(ax, ay, color);
  }
}

/**
 * Coastline stroke drawn *inside* the playable cell along each VOID-facing edge, so VOID is
 * never filled as board (SPEC §10.7). Mask bits: 1 N · 2 E · 4 S · 8 W.
 * @param {Pen} p
 * @param {number} mask
 */
function paintCoastSide(p, mask) {
  if (mask & 1) p(0, 0, PALETTE.COAST, ART, COAST_W);
  if (mask & 2) p(ART - COAST_W, 0, PALETTE.COAST, COAST_W, ART);
  if (mask & 4) p(0, ART - COAST_W, PALETTE.COAST, ART, COAST_W);
  if (mask & 8) p(0, 0, PALETTE.COAST, COAST_W, ART);
}

/**
 * The diagonal case: a VOID cell touching only at a corner would otherwise leave the stroke
 * with a notch. Mask bits: 1 NW · 2 NE · 4 SE · 8 SW.
 * @param {Pen} p
 * @param {number} mask
 */
function paintCoastCorner(p, mask) {
  const w = COAST_W;
  if (mask & 1) p(0, 0, PALETTE.COAST, w, w);
  if (mask & 2) p(ART - w, 0, PALETTE.COAST, w, w);
  if (mask & 4) p(ART - w, ART - w, PALETTE.COAST, w, w);
  if (mask & 8) p(0, ART - w, PALETTE.COAST, w, w);
}
