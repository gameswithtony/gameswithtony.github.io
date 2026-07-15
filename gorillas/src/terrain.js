// City generation, mask ownership, carve/query (SPEC §6, §7).
// The mask is truth; art is a projection of the mask (Invariant 7).
// No connectivity analysis, no collapse, no support checks — ever (§7.3).

import { createRng } from './rng.js';
import {
  WORLD_W, GROUND_Y,
  BUILDING_W_MIN, BUILDING_W_MAX, BUILDING_H_MIN, BUILDING_H_MAX,
  BUILDING_GAP_MIN, BUILDING_GAP_MAX,
  BUILDING_PALETTE, WINDOW_LIT, WINDOW_DARK,
} from './config.js';

const W = WORLD_W;
const H = GROUND_Y + 1;

const mask = new Uint8Array(W * H);   // 0 = empty, 1..N = building index + 1
let buildings = [];
let art = null;
let actx = null;

export function getArt() { return art; }
export function getBuildings() { return buildings; }

function shade(hex, amt) {
  // amt in [-1, 1]: negative darkens, positive lightens toward white
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (amt >= 0) {
    r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt;
  } else {
    r *= 1 + amt; g *= 1 + amt; b *= 1 + amt;
  }
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

function paintBuilding(b, rng) {
  const grad = actx.createLinearGradient(0, b.top, 0, GROUND_Y);
  grad.addColorStop(0, shade(b.color, 0.10));
  grad.addColorStop(1, shade(b.color, -0.22));
  actx.fillStyle = grad;
  actx.fillRect(b.x, b.top, b.w, b.h);
  // right-edge shading + roof highlight
  actx.fillStyle = 'rgba(0,0,0,0.28)';
  actx.fillRect(b.x + b.w - 3, b.top, 3, b.h);
  actx.fillStyle = 'rgba(255,255,255,0.20)';
  actx.fillRect(b.x, b.top, b.w, 2);
  // window grid, each randomly lit or dark (§6)
  const margin = 5, ww = 5, wh = 8, sx = 12, sy = 16;
  for (let wx = b.x + margin; wx + ww <= b.x + b.w - margin; wx += sx) {
    for (let wy = b.top + 7; wy + wh <= GROUND_Y - 4; wy += sy) {
      actx.fillStyle = rng.chance(0.72) ? WINDOW_LIT : WINDOW_DARK;
      actx.fillRect(wx, wy, ww, wh);
    }
  }
}

// Rooftop by raycasting the mask downward — correct against any skyline,
// intact or ruined (§6). Reuses solidAt; never reads building records.
function rooftopSpawn(x) {
  let y = 0;
  while (y <= GROUND_Y && !solidAt(x, y)) y++;
  return { x, feetY: Math.min(y, GROUND_Y) };
}

export function generate(seed) {
  const rng = createRng(seed);
  mask.fill(0);
  buildings = [];
  if (!art) {
    art = document.createElement('canvas');
    art.width = W;
    art.height = H;
    actx = art.getContext('2d');
  }
  actx.setTransform(1, 0, 0, 1, 0, 0);
  actx.globalCompositeOperation = 'source-over';
  actx.clearRect(0, 0, W, H);

  // One city, one code path, everything equally destructible (§6).
  let x = 4;
  while (x < W - BUILDING_W_MIN - 4 && buildings.length < 255) {
    let bw = rng.int(BUILDING_W_MIN, BUILDING_W_MAX);
    if (x + bw > W - 4) bw = W - 4 - x;
    const bh = rng.int(BUILDING_H_MIN, BUILDING_H_MAX);
    const top = GROUND_Y - bh;
    const b = {
      i: buildings.length + 1,
      x, w: bw, h: bh, top,
      color: BUILDING_PALETTE[rng.int(0, BUILDING_PALETTE.length - 1)],
    };
    buildings.push(b);
    for (let yy = top; yy <= GROUND_Y; yy++) {
      mask.fill(b.i, yy * W + x, yy * W + x + bw);
    }
    paintBuilding(b, rng);
    x += bw + rng.int(BUILDING_GAP_MIN, BUILDING_GAP_MAX);
  }

  // Gorilla placement, once per match (§6): middle third, 2–4 buildings apart.
  const lo = W / 3;
  const hi = (2 * W) / 3;
  const mid = buildings.filter((b) => b.x >= lo && b.x + b.w <= hi);
  const sep = rng.int(3, 5);                       // index gap → 2–4 buildings between
  const maxStart = Math.max(0, mid.length - 1 - sep);
  const s = rng.int(0, maxStart);
  const b1 = mid[s];
  const b2 = mid[Math.min(s + sep, mid.length - 1)];
  const gorillaSpawns = [
    rooftopSpawn(Math.round(b1.x + b1.w / 2)),
    rooftopSpawn(Math.round(b2.x + b2.w / 2)),
  ].sort((a, b) => a.x - b.x);

  return { buildings, gorillaSpawns };
}

// Hot loop: bounds check + one array read. No allocation (§7.6).
export function solidAt(x, y) {
  if (x < 0 || y < 0 || x >= W || y > GROUND_Y) return 0;
  return mask[(y | 0) * W + (x | 0)];
}

export function buildingColorAt(x, y) {
  const v = solidAt(x, y);
  return v ? buildings[v - 1].color : null;
}

// Explosions are pure circles subtracted from a static mask (§7.2).
// Mask and art update in lockstep (§7.4). Carved is carved.
export function carve(cx, cy, r) {
  const x0 = Math.max(0, Math.floor(cx - r));
  const x1 = Math.min(W - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r));
  const y1 = Math.min(H - 1, Math.ceil(cy + r));
  const r2 = r * r;
  for (let yy = y0; yy <= y1; yy++) {
    const dy = yy - cy;
    const row = yy * W;
    for (let xx = x0; xx <= x1; xx++) {
      const dx = xx - cx;
      if (dx * dx + dy * dy <= r2) mask[row + xx] = 0;
    }
  }

  // Scorch the surviving rim first (source-atop can only darken what exists —
  // no floating scorch in the sky), then punch the feathered hole.
  actx.globalCompositeOperation = 'source-atop';
  const sr = r * 1.35;
  const sg = actx.createRadialGradient(cx, cy, r * 0.5, cx, cy, sr);
  sg.addColorStop(0, 'rgba(8,5,2,0.9)');
  sg.addColorStop(0.6, 'rgba(12,8,3,0.5)');
  sg.addColorStop(1, 'rgba(0,0,0,0)');
  actx.fillStyle = sg;
  actx.beginPath();
  actx.arc(cx, cy, sr, 0, Math.PI * 2);
  actx.fill();

  actx.globalCompositeOperation = 'destination-out';
  const eg = actx.createRadialGradient(cx, cy, r * 0.55, cx, cy, r);
  eg.addColorStop(0, 'rgba(0,0,0,1)');
  eg.addColorStop(0.8, 'rgba(0,0,0,1)');
  eg.addColorStop(1, 'rgba(0,0,0,0)');
  actx.fillStyle = eg;
  actx.beginPath();
  actx.arc(cx, cy, r, 0, Math.PI * 2);
  actx.fill();

  actx.globalCompositeOperation = 'source-over';
}
