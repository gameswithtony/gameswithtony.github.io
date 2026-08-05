// @ts-check
// The board renderer: atlas blits at integer device offsets into a viewport-sized static
// cache, plus a dynamic layer on top (SPEC §10.8, PLAN §11.2–§11.5).
//
// Two rules run through everything here:
//   · the static cache is screen-sized, never board-sized, and is rebuilt only when the
//     state, the camera or artPx changed — the board is motionless between ticks;
//   · no alpha in world rendering. Every tint is a 50% checkerboard of a palette colour.
//
// Zoom tiers are derived from FONT_MIN_DEVICE_PX and the glyph height, and from nothing else
// (SPEC §10.8): a GLYPH_H-tall glyph needs GLYPH_H × artPx device px to clear the legibility
// floor, which is what fixes the mid threshold, and "twice legible" is what fixes near.

import { RULES } from '../core/rules.js';
import { blockMines, clue } from '../core/reduce.js';
import { isFlagged, levelParams } from '../core/state.js';
import { PALETTE } from './palette.js';
import { ART, bakeAtlas, crisp, variantOf } from './atlas.js';
import { drawText, drawTextCentered, textWidthArt, GLYPH_H, GLYPH_GAP } from './font.js';
import { cellRect, visibleCells } from './camera.js';

/** @typedef {import('../core/state.js').GameState} GameState */
/** @typedef {import('../core/state.js').Con} Con */
/** @typedef {import('./camera.js').Camera} Camera */
/** @typedef {import('./atlas.js').Atlas} Atlas */

/** @typedef {'far' | 'mid' | 'near'} Tier */

/**
 * @typedef {object} ViewOverlay
 * @property {number} selected           selected cell index, or -1
 * @property {number} rot                current rotation index during `placing`
 * @property {number[] | null} anchors   legal anchors for the current rotation (placing)
 * @property {{ cells: number[], valid: boolean } | null} ghost
 * @property {number[] | null} blast     blast preview for a selected confirmed mine
 */

/**
 * The view-only animation layer (particles.js), passed in rather than imported so the
 * renderer stays a pure function of state + camera + overlay and can be drawn without it.
 * @typedef {import('./particles.js').Effects} Effects
 */

/**
 * Mid tier starts where a glyph clears the legibility floor: GLYPH_H × artPx ≥
 * FONT_MIN_DEVICE_PX. At 7 art px and a 10 device-px floor that is artPx 2 — far is artPx 1,
 * mid is 2–3, near is 4 and up (ceiling ZOOM_MAX_ARTPX 6). Re-derived, never re-tuned: change
 * the glyph or the floor and the tiers move by themselves.
 */
export const MID_MIN_ARTPX = Math.max(2, Math.ceil(RULES.FONT_MIN_DEVICE_PX / GLYPH_H));
export const NEAR_MIN_ARTPX = MID_MIN_ARTPX * 2;

/**
 * Line weight for everything the renderer strokes on top of the atlas — block boundaries,
 * ghost outlines, the selection ring. Two of sixteen art pixels is the same eighth of a tile
 * the old one-of-eight was, so nothing got thinner or fatter when the grid got finer.
 */
const STROKE_ART = 2;

/**
 * The fraction of a user's patience that has to be gone before the board says so. Two thirds
 * is late enough that it means something and early enough to still be actionable — a warning
 * that fires at nine tenths is an obituary.
 *
 * Exported since 2026-08-05: the HUD's waiting countdown and the roster's per-user one turn
 * red at exactly this point. Three places, one number — a second threshold tuned separately
 * would mean the board and the list disagreeing about who is in trouble.
 */
export const IMPATIENT_AT = 2 / 3;

/**
 * How far through its patience a user is, 0…1. Reads `waited` and the level's own threshold
 * and nothing else — no core query the HUD does not already make. Defensive about both,
 * because a level with no patience configured must not make every user look doomed.
 * @param {GameState} s
 * @param {import('../core/state.js').User} u
 * @returns {number}
 */
export function patienceSpent(s, u) {
  const limit = levelParams(s).patience;
  if (!limit || limit <= 0) return 0;
  return Math.min(1, (u.waited ?? 0) / limit);
}

/**
 * @param {number} artPx
 * @returns {Tier}
 */
export function tierOf(artPx) {
  if (artPx >= NEAR_MIN_ARTPX) return 'near';
  if (artPx >= MID_MIN_ARTPX) return 'mid';
  return 'far';
}

/**
 * @param {GameState} s
 * @param {number} x
 * @param {number} y
 * @returns {boolean} VOID or outside the array — both are "not board" (SPEC §10.7)
 */
function isVoid(s, x, y) {
  if (x < 0 || y < 0 || x >= s.w || y >= s.h) return true;
  return s.terrain[y * s.w + x] === 'void';
}

/**
 * @param {Con} con
 * @returns {number} the owning block id, or -1
 */
function blockOf(con) {
  return con.k === 'aiHidden' || con.k === 'aiRevealed' || con.k === 'mineConfirmed' ? con.block : -1;
}

/**
 * @param {GameState} s
 * @param {number} i
 * @param {number} x
 * @param {number} y
 * @param {Tier} tier
 * @returns {string} atlas tile name
 */
function tileName(s, i, x, y, tier) {
  if (i === s.origin) return 'origin';
  if (i === s.dest) return 'dest';
  const v = variantOf(x, y, s.seed);
  switch (s.con[i].k) {
    case 'hand': return `hand${v}`;
    // A beta is the only tile whose ART changes with the tier rather than just gaining detail
    // on top of it: the pennant that says "shipped" is unreadable at one device pixel per art
    // pixel, and what has to survive zoomed out is *where the betas are*. Same call the flag
    // overlay makes, and the same two names.
    case 'beta': return tier === 'far' ? 'betaFar' : 'beta';
    case 'aiHidden': return `hidden${v}`;
    case 'aiRevealed': return 'revealed';
    case 'mineConfirmed': return 'mine';
    default: break;
  }
  return s.terrain[i] === 'volcano' ? `volcano${v}` : `ocean${v}`;
}

/**
 * A digit chip centred on the art grid inside one tile, used for block mine badges and user
 * stacks. The box is padded until the slack is equal on both sides: an odd-width glyph run
 * cannot centre inside an even-width tile, and the leftover sliver of the cell underneath is
 * exactly what reads as misaligned.
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {number} x     tile origin in device px
 * @param {number} y
 * @param {number} px    artPx
 * @param {string} color glyph colour; the backing is always INK
 */
function drawBadge(ctx, text, x, y, px, color) {
  const glyph = textWidthArt(text);
  let w = glyph + 4;                 // two art pixels of INK either side of the glyph
  let h = GLYPH_H + 4;
  if ((ART - w) % 2 !== 0 && w < ART) w += 1;
  if ((ART - h) % 2 !== 0 && h < ART) h += 1;
  const bx = x + Math.max(0, Math.round((ART - w) / 2)) * px;
  const by = y + Math.max(0, Math.round((ART - h) / 2)) * px;
  ctx.fillStyle = PALETTE.INK;
  ctx.fillRect(bx, by, w * px, h * px);
  drawText(ctx, text, bx + Math.floor((w - glyph) / 2) * px, by + Math.floor((h - GLYPH_H) / 2) * px, px, color);
}

/**
 * @param {HTMLCanvasElement} canvas
 */
export function createRenderer(canvas) {
  const ctx = crisp(/** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d', { alpha: false })));
  const cache = document.createElement('canvas');
  const cctx = crisp(/** @type {CanvasRenderingContext2D} */ (cache.getContext('2d')));

  /** @type {Atlas | null} */
  let atlas = null;
  let version = 0;          // bumped by invalidate(): the state changed under us
  let staticKey = '';

  /**
   * @param {number} artPx
   * @returns {Atlas}
   */
  function atlasFor(artPx) {
    if (!atlas || atlas.artPx !== artPx) atlas = bakeAtlas(artPx);
    return atlas;
  }

  /**
   * @param {GameState} s
   * @param {Camera} cam
   * @param {Atlas} at
   */
  function buildStatic(s, cam, at) {
    if (cache.width !== cam.cw || cache.height !== cam.ch) {
      cache.width = cam.cw;
      cache.height = cam.ch;
      crisp(cctx);
    }
    const tier = tierOf(cam.artPx);
    const t = at.tile;
    const px = cam.artPx;

    cctx.fillStyle = PALETTE.VOID;
    cctx.fillRect(0, 0, cam.cw, cam.ch);

    const win = visibleCells(cam, s);
    // Rectangular *iteration* over the visible window is fine; playability is decided by the
    // VOID test below, never by the loop bounds (SPEC §10.7).
    for (let y = win.y0; y <= win.y1; y++) {
      for (let x = win.x0; x <= win.x1; x++) {
        const i = y * s.w + x;
        if (s.terrain[i] === 'void') continue;
        const dx = cam.ox + x * t;
        const dy = cam.oy + y * t;
        at.blit(cctx, tileName(s, i, x, y, tier), dx, dy);

        let side = 0;
        if (isVoid(s, x, y - 1)) side |= 1;
        if (isVoid(s, x + 1, y)) side |= 2;
        if (isVoid(s, x, y + 1)) side |= 4;
        if (isVoid(s, x - 1, y)) side |= 8;
        if (side) at.blit(cctx, `coastS${side}`, dx, dy);

        let corner = 0;
        if (!(side & 1) && !(side & 8) && isVoid(s, x - 1, y - 1)) corner |= 1;
        if (!(side & 1) && !(side & 2) && isVoid(s, x + 1, y - 1)) corner |= 2;
        if (!(side & 4) && !(side & 2) && isVoid(s, x + 1, y + 1)) corner |= 4;
        if (!(side & 4) && !(side & 8) && isVoid(s, x - 1, y + 1)) corner |= 8;
        if (corner) at.blit(cctx, `coastC${corner}`, dx, dy);

        // The player's own mark, over the cell rather than instead of it. Present at EVERY
        // tier — a flag is a decision the player made and it may not vanish when they zoom
        // out to look at the route (SPEC §4.3); only its drawing changes.
        if (isFlagged(s.con[i])) at.blit(cctx, tier === 'far' ? 'flagFar' : 'flag', dx, dy);
      }
    }

    // Block boundaries: edges between differing block ids. State-dependent, so it is drawn
    // here rather than baked (PLAN §11.2). Present at every tier — it is the topology view.
    const wgt = STROKE_ART * px;
    cctx.fillStyle = PALETTE.INK;
    for (let y = win.y0; y <= win.y1; y++) {
      for (let x = win.x0; x <= win.x1; x++) {
        const i = y * s.w + x;
        const b = blockOf(s.con[i]);
        if (b < 0) continue;
        const dx = cam.ox + x * t;
        const dy = cam.oy + y * t;
        if (neighborBlock(s, x, y - 1) !== b) cctx.fillRect(dx, dy, t, wgt);
        if (neighborBlock(s, x, y + 1) !== b) cctx.fillRect(dx, dy + t - wgt, t, wgt);
        if (neighborBlock(s, x - 1, y) !== b) cctx.fillRect(dx, dy, wgt, t);
        if (neighborBlock(s, x + 1, y) !== b) cctx.fillRect(dx + t - wgt, dy, wgt, t);
      }
    }

    if (tier === 'far') return;

    // Clue digits (mid and near). Derived live from the mine set on every rebuild, so the
    // never-wrong rule holds with no invalidation logic of its own (PLAN §3.5). Nothing here
    // is cached per cell and the static key carries no cell data, so a hand tile built before
    // the block that surrounds it starts reading the moment that block lands, and every
    // number drops on its own when a blast takes the mines away.
    //
    // Hand tiles carry clues too (2026-08-04 user decision): code you wrote yourself can see
    // the interface errors, so building a causeway alongside a generated block is a real way
    // to solve it. They differ from revealed AI cells in one deliberate way — see below.
    //
    // Beta blocks are hand tiles for this purpose (2026-08-05): you shipped that cell, so it
    // reads its neighbours exactly as anything else you shipped does. Anything else would be a
    // hole in the deduction surface at precisely the tile you were counting on standing next
    // to, and the player would have to remember which of their own tiles can see.
    for (let y = win.y0; y <= win.y1; y++) {
      for (let x = win.x0; x <= win.x1; x++) {
        const i = y * s.w + x;
        const kind = s.con[i].k;
        if (kind !== 'aiRevealed' && kind !== 'hand' && kind !== 'beta') continue;
        const { lo, hi } = clue(s, i);
        // A hand tile with nothing next to it stays blank. Inside a block, "0" is information
        // — it is the difference between a cell that was opened and one that was not — but a
        // hand tile is visibly a hand tile whether it is drawn on or not, so a causeway of
        // zeros would be a row of noise the eye has to filter past to find the real numbers.
        // Same rule, same reasoning, for a beta.
        if (kind !== 'aiRevealed' && hi < 1) continue;
        const text = lo === hi ? String(lo) : `${lo}-${hi}`;
        // A range is three glyphs — 17 art px at the default gap, one wider than the tile.
        // Tighten to gap 0 (15) rather than let a clue bleed onto the cell next door; the
        // hyphen is drawn with blank columns either side so the three marks stay separate.
        // INK on both bases, checked rather than assumed: it is 6.5:1 on HAND and 6.1:1 on
        // AI_REVEALED, so the warm tile is if anything the easier read of the two. (PAPER on
        // HAND is 2.4:1 — it looks plausible and is the wrong answer.)
        const gap = textWidthArt(text) > ART ? 0 : GLYPH_GAP;
        drawTextCentered(cctx, text, cam.ox + x * t + t / 2, cam.oy + y * t + t / 2, px, PALETTE.INK, gap);
      }
    }

    if (tier !== 'near') return;

    // Per-block mine badges at block centroids, live counts (PLAN §11.3).
    for (const b of s.blocks) {
      if (b.cells.length === 0) continue;
      const at2 = centroidCell(s, b.cells);
      const x = at2 % s.w, y = Math.floor(at2 / s.w);
      if (x < win.x0 || x > win.x1 || y < win.y0 || y > win.y1) continue;
      drawBadge(cctx, String(blockMines(s, b.id)), cam.ox + x * t, cam.oy + y * t, px, PALETTE.PAPER);
    }
  }

  /**
   * @param {GameState} s
   * @param {number} x
   * @param {number} y
   * @returns {number}
   */
  function neighborBlock(s, x, y) {
    if (x < 0 || y < 0 || x >= s.w || y >= s.h) return -1;
    return blockOf(s.con[y * s.w + x]);
  }

  /**
   * @param {GameState} s
   * @param {number[]} cells
   * @returns {number} the live cell nearest the centroid
   */
  function centroidCell(s, cells) {
    let sx = 0, sy = 0;
    for (const c of cells) { sx += c % s.w; sy += Math.floor(c / s.w); }
    const cx = sx / cells.length, cy = sy / cells.length;
    let best = cells[0], bestD = Infinity;
    for (const c of cells) {
      const d = (c % s.w - cx) ** 2 + (Math.floor(c / s.w) - cy) ** 2;
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  /**
   * @param {GameState} s
   * @param {Camera} cam
   * @param {Atlas} at
   * @param {ViewOverlay} view
   * @param {Effects | null} fx
   */
  function drawDynamic(s, cam, at, view, fx) {
    const tier = tierOf(cam.artPx);
    const t = at.tile;
    const px = cam.artPx;

    /** @param {number} cell @param {string} name */
    const tint = (cell, name) => {
      const r = cellRect(cam, s, cell);
      if (r.x + t < 0 || r.y + t < 0 || r.x > cam.cw || r.y > cam.ch) return;
      at.blit(ctx, name, r.x, r.y);
    };

    if (view.anchors) for (const c of view.anchors) tint(c, 'tintOk');
    if (view.blast) for (const c of view.blast) tint(c, 'tintRed');

    if (view.ghost) {
      const name = view.ghost.valid ? 'tintOk' : 'tintRed';
      const wgt = STROKE_ART * px;
      ctx.fillStyle = view.ghost.valid ? PALETTE.OK : PALETTE.RED;
      for (const c of view.ghost.cells) {
        tint(c, name);
        const r = cellRect(cam, s, c);
        ctx.fillRect(r.x, r.y, t, wgt);
        ctx.fillRect(r.x, r.y + t - wgt, t, wgt);
        ctx.fillRect(r.x, r.y, wgt, t);
        ctx.fillRect(r.x + t - wgt, r.y, wgt, t);
      }
    }

    // The board coming apart goes under the users; the debris goes over them (PLAN §11.6).
    fx?.drawUnder(ctx, s, cam);

    // Users last but one: they are the thing the player is watching (PLAN §11.5).
    drawUsers(s, cam, at, tier, fx);

    if (view.selected >= 0) {
      const r = cellRect(cam, s, view.selected);
      // Two art pixels at every tier — which is already "fatter at near" in device px (2 at
      // far, 12 at near) while staying an eighth of the tile, so the cell's own content, the
      // thing you selected it to read, is never hidden by the ring.
      const wgt = STROKE_ART * px;
      ctx.fillStyle = PALETTE.SELECT;
      ctx.fillRect(r.x, r.y, t, wgt);
      ctx.fillRect(r.x, r.y + t - wgt, t, wgt);
      ctx.fillRect(r.x, r.y, wgt, t);
      ctx.fillRect(r.x + t - wgt, r.y, wgt, t);
    }

    fx?.drawOver(ctx, s, cam);
  }

  /**
   * Users are drawn at their tweened positions when a step is in flight (PLAN §11.5), so
   * stacking is by *drawn* position rather than by cell: a queued pile and a column of
   * walkers mid-step are both "one place with N users in it", and neither needs the
   * reducer to know a frame happened.
   * @param {GameState} s
   * @param {Camera} cam
   * @param {Atlas} at
   * @param {Tier} tier
   * @param {Effects | null} fx
   */
  function drawUsers(s, cam, at, tier, fx) {
    const t = at.tile;
    const px = cam.artPx;

    /** @type {Map<string, { x: number, y: number, n: number, spent: number }>} */
    const stacks = new Map();
    for (const u of s.users) {
      const tw = fx ? fx.userPos(u.id) : null;
      // Arrived and gone are both off the board — unless a last step is still in the air.
      if ((u.state === 'arrived' || u.state === 'gone') && !tw) continue;
      const cx = tw ? tw.x : u.at % s.w;
      const cy = tw ? tw.y : Math.floor(u.at / s.w);
      const x = Math.round((cam.ox + cx * t) / px) * px;
      const y = Math.round((cam.oy + cy * t) / px) * px;
      const key = `${x},${y}`;
      const spent = patienceSpent(s, u);
      const cur = stacks.get(key);
      // A pile takes its worst member's patience, not an average: the queue at the origin is
      // where patience usually runs out, and one user about to walk away from it is the thing
      // the player needs to see — averaging that away is how a pile looks fine until it isn't.
      if (cur) { cur.n++; cur.spent = Math.max(cur.spent, spent); }
      else stacks.set(key, { x, y, n: 1, spent });
    }
    if (stacks.size === 0) return;

    // Three eighths of the tile below near, half at near — the same proportions the dot had
    // on the eight-art-pixel grid, restated for sixteen.
    const dotArt = Math.round(tier === 'near' ? ART / 2 : (ART * 3) / 8);
    const dot = dotArt * px;
    const ring = STROKE_ART * px;      // the INK outline that keeps a dot off its own tile

    for (const { x, y, n, spent } of stacks.values()) {
      const r = { x, y };
      if (r.x + t < 0 || r.y + t < 0 || r.x > cam.cw || r.y > cam.ch) continue;

      // About to give up. The warning is a colour swap and nothing else — no blink, because a
      // blink would mean a running RAF and the board is meant to be motionless between ticks
      // (PLAN §11.4), and no extra mark, because this has to read as "that one is in trouble"
      // rather than as a new kind of object. Mid and near only: at far the dot is three device
      // pixels of topology and a red one would just be noise.
      const impatient = tier !== 'far' && spent >= IMPATIENT_AT;

      // A stack becomes the count itself rather than a dot wearing a badge: one tile cannot
      // hold both at a readable size, and the pile at the origin is the "you have not
      // shipped" signal (SPEC §6.2) — it has to read as a number the moment there is more
      // than one.
      if (n > 1 && tier !== 'far') {
        const text = n <= 9 ? String(n) : '+';         // exact count lives in the HUD forecast
        drawBadge(ctx, text, r.x, r.y, px, impatient ? PALETTE.RED : PALETTE.USER);
        continue;
      }

      const cx = r.x + Math.round((t - dot) / (2 * px)) * px;
      const cy = r.y + Math.round((t - dot) / (2 * px)) * px;
      // The ring carries the warning and the dot keeps its colour: a user about to leave is
      // still a user, and swapping the fill would make it read as some other thing entirely.
      ctx.fillStyle = impatient ? PALETTE.RED : PALETTE.INK;
      ctx.fillRect(cx - ring, cy - ring, dot + 2 * ring, dot + 2 * ring);
      ctx.fillStyle = PALETTE.USER;
      ctx.fillRect(cx, cy, dot, dot);
      if (n > 1) {
        ctx.fillStyle = PALETTE.PAPER;              // far tier: a corner pip is all that fits
        ctx.fillRect(cx + dot - ring, cy - ring, ring, ring);
      }
    }
  }

  return {
    /** The state changed: the static cache no longer describes it. */
    invalidate() { version++; },

    /** @param {number} artPx */
    atlasFor,

    /**
     * @param {GameState} s
     * @param {Camera} cam
     * @param {ViewOverlay} view
     * @param {Effects | null} [fx]
     */
    draw(s, cam, view, fx = null) {
      const at = atlasFor(cam.artPx);
      const key = `${version}|${cam.artPx}|${cam.ox}|${cam.oy}|${cam.cw}|${cam.ch}`;
      if (key !== staticKey) {
        buildStatic(s, cam, at);
        staticKey = key;
      }
      // The composite is the one place the screen shake exists: the whole frame — cache,
      // overlays, users, debris — moves together by a whole number of device pixels, so
      // nothing lands off the art grid and no layer can shear away from another.
      const shake = fx ? fx.shakeOffset(cam.artPx) : { x: 0, y: 0 };
      ctx.save();
      if (shake.x || shake.y) {
        ctx.fillStyle = PALETTE.VOID;      // the strip the shake uncovers is not board
        ctx.fillRect(0, 0, cam.cw, cam.ch);
        ctx.translate(shake.x, shake.y);
      }
      ctx.drawImage(cache, 0, 0);
      drawDynamic(s, cam, at, view, fx);
      ctx.restore();
    },
  };
}

/**
 * Ghost cells for an anchor + rotation offsets, including the illegal case — the renderer
 * needs somewhere to draw the RED ghost, which `placementCells()` (rightly) refuses to
 * compute. Off-array offsets are dropped; they simply do not draw.
 * @param {GameState} s
 * @param {number} anchor
 * @param {[number, number][]} offsets
 * @returns {number[]}
 */
export function ghostCells(s, anchor, offsets) {
  const ax = anchor % s.w, ay = Math.floor(anchor / s.w);
  /** @type {number[]} */
  const out = [];
  for (const [dx, dy] of offsets) {
    const x = ax + dx, y = ay + dy;
    if (x < 0 || y < 0 || x >= s.w || y >= s.h) continue;
    out.push(y * s.w + x);
  }
  return out;
}

/**
 * The stencil's bounding box in cells. Rotations arrive normalized to a zero minimum, so the
 * maxima are the dimensions — but this reads them off the offsets rather than assuming a
 * maximum size, because the shape table is not this module's to hold still.
 * @param {[number, number][]} offsets
 * @returns {{ cols: number, rows: number }}
 */
export function stencilDims(offsets) {
  let cols = 1, rows = 1;
  for (const [dx, dy] of offsets) {
    cols = Math.max(cols, dx + 1);
    rows = Math.max(rows, dy + 1);
  }
  return { cols, rows };
}

/**
 * The block tray (PLAN §11.8): the drawn shape at a caller-chosen CSS cell size, legible no
 * matter what the board zoom is doing. Same palette, same fillRect discipline, its own little
 * canvas. The cell size is the caller's to pick because the tray's budget is a fixed footer
 * row, and a six-by-six stencil has to fit the same row a two-by-two one does — `trayCellPx()`
 * in hud.js does that arithmetic. Drawn flat with a hard border, which is what the atlas'
 * hidden tile now looks like.
 * @param {HTMLCanvasElement} canvas
 * @param {[number, number][]} offsets
 * @param {number} cssCell
 * @param {number} dpr
 */
export function drawTray(canvas, offsets, cssCell, dpr) {
  const { cols, rows } = stencilDims(offsets);
  const cell = Math.max(3, Math.round(cssCell * dpr));
  canvas.width = cols * cell;
  canvas.height = rows * cell;
  canvas.style.width = `${cols * cell / dpr}px`;
  canvas.style.height = `${rows * cell / dpr}px`;
  const ctx = crisp(/** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d')));
  // One art pixel of border at whatever a tray cell's art pixel would be — the same
  // one-of-sixteen the board's hidden tile wears, so the tray reads as the thing you are
  // about to commit rather than as a different material.
  const bw = Math.max(1, Math.round(cell / ART));
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (const [dx, dy] of offsets) {
    const x = dx * cell, y = dy * cell;
    ctx.fillStyle = PALETTE.AI_HIDDEN;
    ctx.fillRect(x, y, cell, cell);
    ctx.fillStyle = PALETTE.INK;
    ctx.fillRect(x, y, cell, bw);
    ctx.fillRect(x, y + cell - bw, cell, bw);
    ctx.fillRect(x, y, bw, cell);
    ctx.fillRect(x + cell - bw, y, bw, cell);
  }
}
