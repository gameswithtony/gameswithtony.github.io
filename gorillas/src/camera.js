// World-rect framing. Lives in the render layer only (Invariant 2) — nothing
// in physics/terrain/ai/game may read this module.
//
// camera.rect  — what world content is visible. Driven by game state.
// viewScale    — device pixels per world unit. Driven by window size.
// A bigger window draws the same content LARGER; it never reveals more (§9.1).

import {
  ARENA_W, WORLD_W, GROUND_Y, VIEW_ASPECT,
  CAM_PAD, CAM_K_OUT, CAM_K_IN, CAM_DEADZONE,
} from './config.js';

const st = {
  rect: { x: 0, y: GROUND_Y - ARENA_W / VIEW_ASPECT, w: ARENA_W, h: ARENA_W / VIEW_ASPECT },
  letterbox: { x: 0, y: 0, w: 1, h: 1 },   // CSS px
  cssW: 1,
  cssH: 1,
  dpr: 1,
  scale: 1,                                 // CSS px per world unit
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;

export function setViewport(cssW, cssH, dpr) {
  st.cssW = Math.max(1, cssW);
  st.cssH = Math.max(1, cssH);
  st.dpr = dpr;
  // Letterbox to a fixed aspect: an ultrawide window must not show more city
  // than a square one (§9.1).
  let lw = st.cssW;
  let lh = lw / VIEW_ASPECT;
  if (lh > st.cssH) {
    lh = st.cssH;
    lw = lh * VIEW_ASPECT;
  }
  st.letterbox = { x: (st.cssW - lw) / 2, y: (st.cssH - lh) / 2, w: lw, h: lh };
  st.scale = st.letterbox.w / st.rect.w;
}

function clampRect(r) {
  r.w = clamp(r.w, ARENA_W, WORLD_W);
  r.h = r.w / VIEW_ASPECT;
  r.x = clamp(r.x, 0, WORLD_W - r.w);
  // Ground never rises above the bottom 15% of the frame; sky is unclamped —
  // that's where the arc goes (§9.5).
  r.y = Math.min(r.y, GROUND_Y - 0.85 * r.h);
  return r;
}

function defaultRect(centerX) {
  const w = ARENA_W;
  const h = w / VIEW_ASPECT;
  return clampRect({ x: centerX - w / 2, y: GROUND_Y - h, w, h });
}

function fullRect() {
  const w = WORLD_W;
  const h = w / VIEW_ASPECT;
  return { x: 0, y: GROUND_Y - 0.9 * h, w, h };
}

// Fit a box; do not follow the banana (§9.2).
function pointsRect(points) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  minX -= CAM_PAD; maxX += CAM_PAD; minY -= CAM_PAD; maxY += CAM_PAD;
  let w = maxX - minX;
  let h = maxY - minY;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  if (w / h < VIEW_ASPECT) w = h * VIEW_ASPECT; else h = w / VIEW_ASPECT;
  return clampRect({ x: cx - w / 2, y: cy - h / 2, w, h });
}

function resolveTarget(target) {
  if (!target) return { ...st.rect };
  if (target.mode === 'points') return pointsRect(target.points);
  if (target.mode === 'full') return fullRect();
  return defaultRect(target.centerX ?? WORLD_W / 2);
}

export function snap(target) {
  const tr = resolveTarget(target);
  st.rect.x = tr.x; st.rect.y = tr.y; st.rect.w = tr.w; st.rect.h = tr.h;
  st.scale = st.letterbox.w / st.rect.w;
}

export function update(dt, target) {
  const tr = resolveTarget(target);
  const cur = st.rect;
  const curCx = cur.x + cur.w / 2;
  const curCy = cur.y + cur.h / 2;
  const tCx = tr.x + tr.w / 2;
  const tCy = tr.y + tr.h / 2;

  // Deadzone so the camera doesn't shimmer (§9.4).
  const moving = Math.abs(tr.w - cur.w) > CAM_DEADZONE ||
                 Math.abs(tCx - curCx) > CAM_DEADZONE ||
                 Math.abs(tCy - curCy) > CAM_DEADZONE;
  if (moving) {
    // Widening is snappy so the banana never leads the frame off; closing back
    // in is lazy. Width lerps in log space — framing scale is multiplicative.
    const k = tr.w > cur.w + 0.5 ? CAM_K_OUT : CAM_K_IN;
    const f = 1 - Math.pow(1 - k, dt * 60);
    const nw = Math.exp(lerp(Math.log(cur.w), Math.log(tr.w), f));
    const ncx = lerp(curCx, tCx, f);
    const ncy = lerp(curCy, tCy, f);
    cur.w = nw;
    cur.h = nw / VIEW_ASPECT;
    cur.x = ncx - cur.w / 2;
    cur.y = ncy - cur.h / 2;
    clampRect(cur);
  }
  st.scale = st.letterbox.w / st.rect.w;
}

export function getView() {
  return st;
}

export function worldToScreen(x, y) {
  return {
    x: st.letterbox.x + (x - st.rect.x) * st.scale,
    y: st.letterbox.y + (y - st.rect.y) * st.scale,
  };
}

export function screenToWorld(x, y) {
  return {
    x: st.rect.x + (x - st.letterbox.x) / st.scale,
    y: st.rect.y + (y - st.letterbox.y) / st.scale,
  };
}

export function applyWorld(ctx, shakeX = 0, shakeY = 0) {
  const s = st.scale * st.dpr;
  ctx.setTransform(
    s, 0, 0, s,
    st.dpr * st.letterbox.x - st.rect.x * s + shakeX * s,
    st.dpr * st.letterbox.y - st.rect.y * s + shakeY * s,
  );
}

export function applyHud(ctx) {
  ctx.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
}
