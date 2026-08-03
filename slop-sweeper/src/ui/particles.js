// @ts-check
// The juice, and nothing else (SPEC §10.8, PLAN §11.6). Every effect in this file is view
// state: `Math.random` is free here because nothing here can ever reach the reducer, and
// core neither knows nor waits for any of it.
//
// Three rules run through the whole module:
//   · simulate in floating point, render QUANTIZED to the art grid — smooth physics, pixel
//     look (SPEC §10.8's stated default);
//   · fade by SWITCHING PALETTE ENTRIES, never by lowering alpha — there is no alpha in
//     world rendering, so a ramp of colours is what "fading" means here;
//   · debris dies on entering a cell whose terrain stops blasts. That is read from core's
//     capability table, not from a terrain name: if the mechanic stops a blast, the visual
//     stops with it (SPEC §5/§10.8), and a new terrain row gets the behaviour for free.

import { RULES } from '../core/rules.js';
import { stopsBlast } from '../core/state.js';
import { PALETTE } from './palette.js';
import { ART } from './atlas.js';

/** @typedef {import('../core/state.js').GameState} GameState */
/** @typedef {import('../core/state.js').Con} Con */
/** @typedef {import('./camera.js').Camera} Camera */

const STEP_S = RULES.STEP_TWEEN_MS / 1000;
const DISSOLVE_S = 0.3;         // PLAN §11.6: "staged dither-out over ~300 ms"
const FLASH_S = 0.07;           // the white frame at the head of the dissolve
const FLIP_S = 0.12;            // two frames, 60 ms each
const POP_S = 0.26;
const SHAKE_S = 0.38;

/** Ordered 8×8 Bayer thresholds, 0…63 — one per art pixel of a tile. */
const BAYER = [
  0, 32, 8, 40, 2, 34, 10, 42,
  48, 16, 56, 24, 50, 18, 58, 26,
  12, 44, 4, 36, 14, 46, 6, 38,
  60, 28, 52, 20, 62, 30, 54, 22,
  3, 35, 11, 43, 1, 33, 9, 41,
  51, 19, 59, 27, 49, 17, 57, 25,
  15, 47, 7, 39, 13, 45, 5, 37,
  63, 31, 55, 23, 61, 29, 53, 21,
];

/** The blast core: a spark cooling through the palette. */
const HOT_RAMP = [PALETTE.PAPER, PALETTE.USER, PALETTE.RED, PALETTE.HAND_DITHER, PALETTE.INK];

/** The pop at B — the one moment in the game that is unambiguously good news. */
const POP_RAMP = [PALETTE.PAPER, PALETTE.USER, PALETTE.HAND];

/** Screen shake never exceeds this many device px, however deep the zoom. */
const SHAKE_CAP_PX = 14;

/**
 * What a destroyed tile was made of, as a palette ramp. Debris fades along it and the
 * dissolve draws its first two entries.
 * @param {Con} con
 * @returns {string[]}
 */
function conRamp(con) {
  switch (con.k) {
    case 'hand': return [PALETTE.HAND, PALETTE.HAND_DITHER, PALETTE.INK];
    case 'aiHidden': return [PALETTE.AI_HIDDEN, PALETTE.AI_HIDDEN_DITHER, PALETTE.INK];
    case 'aiRevealed': return [PALETTE.AI_REVEALED, PALETTE.AI_HIDDEN_DITHER, PALETTE.INK];
    case 'mineConfirmed': return [PALETTE.RED, PALETTE.HAND_DITHER, PALETTE.INK];
    default: return [PALETTE.OCEAN_DITHER, PALETTE.OCEAN, PALETTE.INK];
  }
}

/**
 * @param {string[]} ramp
 * @param {number} p   0 at birth, 1 at death
 * @returns {string}
 */
function rampAt(ramp, p) {
  const i = Math.floor(p * ramp.length);
  return ramp[i < 0 ? 0 : i >= ramp.length ? ramp.length - 1 : i];
}

/**
 * @typedef {object} Tween
 * @property {number} x0  fractional cell coordinates
 * @property {number} y0
 * @property {number} x1
 * @property {number} y1
 * @property {number} t
 * @property {number} dur
 */

/**
 * @typedef {object} Dissolve
 * @property {number} cell
 * @property {string} base
 * @property {string} dither
 * @property {number} t
 * @property {number} delay
 */

/**
 * @typedef {object} Flip
 * @property {number} cell
 * @property {string} color
 * @property {number} t
 * @property {number} delay
 */

/**
 * @typedef {object} Pop
 * @property {number} cell
 * @property {number} t
 * @property {number} delay
 */

/**
 * @typedef {object} Particle
 * @property {number} x    fractional cell coordinates — zoom-independent by construction
 * @property {number} y
 * @property {number} vx   cells per second
 * @property {number} vy
 * @property {number} t
 * @property {number} life
 * @property {number} size art pixels, 1–3
 * @property {string[]} ramp
 * @property {number} delay
 */

/**
 * @typedef {object} Shake
 * @property {number} t
 * @property {number} amp    art pixels
 * @property {number} phase
 * @property {number} delay
 */

/**
 * @typedef {object} Effects
 * @property {() => boolean} alive
 * @property {() => void} reset
 * @property {(dt: number) => void} update
 * @property {(id: number, s: GameState, from: number, to: number) => void} step
 * @property {(id: number) => number} remaining
 * @property {(id: number) => { x: number, y: number } | null} userPos
 * @property {(prev: GameState, at: number, destroyed: number[], area: number[], delay: number) => void} detonate
 * @property {(cell: number, color: string, delay: number) => void} flip
 * @property {(cell: number, delay: number) => void} pop
 * @property {(artPx: number) => { x: number, y: number }} shakeOffset
 * @property {(ctx: CanvasRenderingContext2D, s: GameState, cam: Camera) => void} drawUnder
 * @property {(ctx: CanvasRenderingContext2D, s: GameState, cam: Camera) => void} drawOver
 */

/**
 * @returns {Effects}
 */
export function createEffects() {
  /** @type {Map<number, Tween>} */
  const tweens = new Map();
  /** @type {Dissolve[]} */
  const dissolves = [];
  /** @type {Flip[]} */
  const flips = [];
  /** @type {Pop[]} */
  const pops = [];
  /** @type {Particle[]} */
  const debris = [];
  /** @type {Shake[]} */
  const shakes = [];

  /** @param {number} id @returns {{ x: number, y: number } | null} */
  function userPos(id) {
    const tw = tweens.get(id);
    if (!tw) return null;
    const p = tw.dur <= 0 ? 1 : Math.min(1, tw.t / tw.dur);
    return { x: tw.x0 + (tw.x1 - tw.x0) * p, y: tw.y0 + (tw.y1 - tw.y0) * p };
  }

  /**
   * Effects that follow a user — the reveal flip under their feet, the mine going off, the
   * pop at B — are held back by the walk they are the consequence of.
   * @param {number} id
   * @returns {number} seconds left on this user's step tween
   */
  function remaining(id) {
    const tw = tweens.get(id);
    return tw ? Math.max(0, tw.dur - tw.t) : 0;
  }

  /**
   * @param {number} id
   * @param {GameState} s
   * @param {number} from
   * @param {number} to
   */
  function step(id, s, from, to) {
    const fx0 = from % s.w;
    const fy0 = Math.floor(from / s.w);
    // A walk that carries on from where the last one was heading picks up from where the dot
    // is actually drawn, so two ticks inside one tween length do not jerk it backwards. A
    // step that starts somewhere else is a correction, not a walk — a user sent back to the
    // origin by a blast, say — and those snap (PLAN §12: queued corrections do not tween
    // across the board).
    const prev = tweens.get(id);
    const cur = prev && prev.x1 === fx0 && prev.y1 === fy0 ? userPos(id) : null;
    tweens.set(id, {
      x0: cur ? cur.x : fx0,
      y0: cur ? cur.y : fy0,
      x1: to % s.w,
      y1: Math.floor(to / s.w),
      t: 0,
      dur: STEP_S,
    });
  }

  /**
   * @param {GameState} prev   the state as it was BEFORE the blast — the only place the
   *                           destroyed tiles still exist to be drawn falling apart
   * @param {number} at
   * @param {number[]} destroyed  cells whose construction was removed
   * @param {number[]} area       the full visual extent (core's blastArea)
   * @param {number} delay
   */
  function detonate(prev, at, destroyed, area, delay) {
    shakes.push({ t: 0, amp: 1.7, phase: Math.random() * 6.283, delay });

    const gone = new Set(destroyed);
    for (const c of destroyed) {
      const ramp = conRamp(prev.con[c]);
      dissolves.push({ cell: c, base: ramp[0], dither: ramp[1], t: 0, delay });
      spawnDebris(prev, c, 7, ramp, 2.2, delay);
    }
    // The core of the blast throws further and hotter, and it fires from the trigger even
    // when the trigger's own tile was not one of the destroyed ones.
    spawnDebris(prev, at, 22, HOT_RAMP, 4.4, delay);
    // Cells the blast reached but did not change (bare ocean) still get a little spray, so
    // the footprint reads as the footprint.
    for (const c of area) {
      if (c === at || gone.has(c)) continue;
      spawnDebris(prev, c, 2, HOT_RAMP, 1.8, delay);
    }
  }

  /**
   * @param {GameState} s
   * @param {number} cell
   * @param {number} n
   * @param {string[]} ramp
   * @param {number} speed  cells/second
   * @param {number} delay
   */
  function spawnDebris(s, cell, n, ramp, speed, delay) {
    const cx = (cell % s.w) + 0.5;
    const cy = Math.floor(cell / s.w) + 0.5;
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.35 + Math.random() * 0.9);
      debris.push({
        x: cx,
        y: cy,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        t: 0,
        life: 0.34 + Math.random() * 0.42,
        size: 1 + Math.floor(Math.random() * 3),
        ramp,
        delay,
      });
    }
  }

  /**
   * @param {number} cell
   * @param {string} color
   * @param {number} delay
   */
  function flip(cell, color, delay) {
    flips.push({ cell, color, t: 0, delay });
  }

  /**
   * @param {number} cell
   * @param {number} delay
   */
  function pop(cell, delay) {
    pops.push({ cell, t: 0, delay });
  }

  /**
   * @template {{ t: number, delay: number }} T
   * @param {T[]} list
   * @param {number} dt
   * @param {number} dur
   */
  function age(list, dt, dur) {
    for (let i = list.length - 1; i >= 0; i--) {
      const e = list[i];
      if (e.delay > 0) { e.delay -= dt; continue; }
      e.t += dt;
      if (e.t >= dur) list.splice(i, 1);
    }
  }

  /** @type {GameState | null} the board the live particles are flying over */
  let world = null;

  return {
    alive() {
      return tweens.size > 0 || dissolves.length > 0 || flips.length > 0
        || pops.length > 0 || debris.length > 0 || shakes.length > 0;
    },

    reset() {
      tweens.clear();
      dissolves.length = 0;
      flips.length = 0;
      pops.length = 0;
      debris.length = 0;
      shakes.length = 0;
      world = null;
    },

    step(id, s, from, to) { world = s; step(id, s, from, to); },
    remaining,
    userPos,

    detonate(prev, at, destroyed, area, delay) {
      world = prev;
      detonate(prev, at, destroyed, area, delay);
    },

    flip,
    pop,

    update(dt) {
      for (const [id, tw] of tweens) {
        tw.t += dt;
        if (tw.t >= tw.dur) tweens.delete(id);
      }
      age(dissolves, dt, DISSOLVE_S);
      age(flips, dt, FLIP_S);
      age(pops, dt, POP_S);
      age(shakes, dt, SHAKE_S);

      const s = world;
      for (let i = debris.length - 1; i >= 0; i--) {
        const p = debris[i];
        if (p.delay > 0) { p.delay -= dt; continue; }
        p.t += dt;
        const drag = Math.exp(-dt * 2.6);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= drag;
        p.vy *= drag;
        if (p.t >= p.life || (s && blockedRect(s, p.x, p.y, p.size))) debris.splice(i, 1);
      }
    },

    shakeOffset(artPx) {
      let ax = 0, ay = 0;
      for (const sh of shakes) {
        if (sh.delay > 0) continue;
        const k = 1 - sh.t / SHAKE_S;
        const amp = sh.amp * artPx * k * k;
        ax += amp * Math.sin(sh.t * 62 + sh.phase);
        ay += amp * Math.sin(sh.t * 77 + sh.phase * 1.7);
      }
      return {
        x: Math.max(-SHAKE_CAP_PX, Math.min(SHAKE_CAP_PX, Math.round(ax))),
        y: Math.max(-SHAKE_CAP_PX, Math.min(SHAKE_CAP_PX, Math.round(ay))),
      };
    },

    /**
     * Under the users: the board itself coming apart, and the tiles turning over.
     * @param {CanvasRenderingContext2D} ctx
     * @param {GameState} s
     * @param {Camera} cam
     */
    drawUnder(ctx, s, cam) {
      const px = cam.artPx;
      const t = ART * px;

      // A held-back effect still has to *draw*, and it draws the world as it was. The
      // reducer changed the board the instant the action resolved, so without this the
      // tile would pop to open water 120 ms before the blast that removed it arrives — the
      // cause would follow the effect.
      for (const d of dissolves) {
        const r = cellOrigin(s, cam, d.cell, t);
        if (r.x + t < 0 || r.y + t < 0 || r.x > cam.cw || r.y > cam.ch) continue;
        if (d.delay > 0) {
          ditherCell(ctx, r, px, d.base, d.dither, 0);       // still standing
        } else if (d.t < FLASH_S) {
          ctx.fillStyle = PALETTE.PAPER;
          ctx.fillRect(r.x, r.y, t, t);
        } else {
          // Staged, not smooth: the threshold walks the Bayer matrix in chunks of four so
          // the tile comes apart in visible steps rather than dimming.
          const p = (d.t - FLASH_S) / (DISSOLVE_S - FLASH_S);
          ditherCell(ctx, r, px, d.base, d.dither, Math.floor((p * 64) / 4) * 4);
        }
      }

      for (const f of flips) {
        const r = cellOrigin(s, cam, f.cell, t);
        if (r.x + t < 0 || r.y + t < 0 || r.x > cam.cw || r.y > cam.ch) continue;
        if (f.delay > 0) {
          // Not reviewed yet as far as the eye is concerned: hold the hidden face until the
          // user who is walking there actually lands.
          ditherCell(ctx, r, px, PALETTE.AI_HIDDEN, PALETTE.AI_HIDDEN_DITHER, 0);
          continue;
        }
        // Two frames, and only two: edge-on in the old colour, half-open in the new one.
        const second = f.t >= FLIP_S / 2;
        const w = second ? 5 : 2;
        ctx.fillStyle = PALETTE.INK;
        ctx.fillRect(r.x, r.y, t, t);
        ctx.fillStyle = second ? f.color : PALETTE.AI_HIDDEN;
        ctx.fillRect(r.x + Math.floor((ART - w) / 2) * px, r.y, w * px, t);
      }
    },

    /**
     * Over the users: debris, and the pop at B.
     * @param {CanvasRenderingContext2D} ctx
     * @param {GameState} s
     * @param {Camera} cam
     */
    drawOver(ctx, s, cam) {
      const px = cam.artPx;
      const t = ART * px;

      for (const p of debris) {
        if (p.delay > 0) continue;
        // Centred on the particle and snapped to the art grid — floating-point physics,
        // whole-art-pixel rendering (SPEC §10.8).
        const half = (p.size * px) / 2;
        const dx = quantize(cam.ox + p.x * t - half, px);
        const dy = quantize(cam.oy + p.y * t - half, px);
        if (dx + p.size * px < 0 || dy + p.size * px < 0 || dx > cam.cw || dy > cam.ch) continue;
        ctx.fillStyle = rampAt(p.ramp, p.t / p.life);
        ctx.fillRect(dx, dy, p.size * px, p.size * px);
      }

      for (const o of pops) {
        if (o.delay > 0) continue;
        const r = cellOrigin(s, cam, o.cell, t);
        if (r.x + t < 0 || r.y + t < 0 || r.x > cam.cw || r.y > cam.ch) continue;
        const k = o.t / POP_S;
        const rad = Math.round(1 + k * 4);
        const cx = r.x + (ART / 2) * px;
        const cy = r.y + (ART / 2) * px;
        ctx.fillStyle = rampAt(POP_RAMP, k);
        for (let a = 0; a < 8; a++) {
          const th = (a / 8) * Math.PI * 2;
          const ox = Math.round(Math.cos(th) * rad) * px;
          const oy = Math.round(Math.sin(th) * rad) * px;
          ctx.fillRect(cx + ox - px, cy + oy - px, px, px);
        }
      }
    },
  };
}

/**
 * The occlusion rule, table-driven: a particle dies the moment it enters a cell whose
 * terrain stops blasts, or leaves the board. VOID and VOLCANO both stop blasts, so both
 * stop debris — through the same lookup the flood fill uses, with no terrain named here.
 * @param {GameState} s
 * @param {number} x  fractional cell coordinates
 * @param {number} y
 * @returns {boolean}
 */
function blocked(s, x, y) {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  if (cx < 0 || cy < 0 || cx >= s.w || cy >= s.h) return true;
  return stopsBlast(s.terrain[cy * s.w + cx]);
}

/**
 * The occlusion test is on the particle's *drawn rectangle*, not on its centre: a three-art-
 * pixel chip whose centre is still in open water paints most of itself into the next cell,
 * and "most of a chip" over a volcano is exactly the bug SPEC §10.8 is describing. Half the
 * chip plus half an art pixel of quantization rounding is the margin.
 * @param {GameState} s
 * @param {number} x
 * @param {number} y
 * @param {number} size  art pixels
 * @returns {boolean}
 */
function blockedRect(s, x, y, size) {
  const h = (size / 2 + 0.5) / ART;
  return blocked(s, x - h, y - h) || blocked(s, x + h, y - h)
      || blocked(s, x - h, y + h) || blocked(s, x + h, y + h);
}

/**
 * One tile of two-colour checkerboard, thinned by an ordered-dither threshold: 0 paints the
 * whole tile, 64 paints nothing.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{ x: number, y: number }} r  tile origin in device px
 * @param {number} px    artPx
 * @param {string} a
 * @param {string} b
 * @param {number} threshold  0…64
 */
function ditherCell(ctx, r, px, a, b, threshold) {
  for (let ay = 0; ay < ART; ay++) {
    for (let ax = 0; ax < ART; ax++) {
      if (BAYER[ay * ART + ax] < threshold) continue;
      ctx.fillStyle = ((ax + ay) & 1) ? a : b;
      ctx.fillRect(r.x + ax * px, r.y + ay * px, px, px);
    }
  }
}

/**
 * @param {number} v   device px
 * @param {number} px  artPx
 * @returns {number} snapped to the art grid
 */
function quantize(v, px) {
  return Math.round(v / px) * px;
}

/**
 * @param {GameState} s
 * @param {Camera} cam
 * @param {number} cell
 * @param {number} t   tile edge in device px
 * @returns {{ x: number, y: number }}
 */
function cellOrigin(s, cam, cell, t) {
  return { x: cam.ox + (cell % s.w) * t, y: cam.oy + Math.floor(cell / s.w) * t };
}
