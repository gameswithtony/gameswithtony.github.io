// Canvas stack, compositing, LOD, particles (SPEC §13). Reads state passed in
// as an argument; mutates nothing in the simulation. All art is procedural —
// gorilla, banana and sun sprites are ported from GORILLA.BAS geometry and
// baked once (the original's GET/PUT, modernized).

import * as C from './config.js';
import * as camera from './camera.js';
import { createRng } from './rng.js';
import { getArt } from './terrain.js';

let canvas = null;
let ctx = null;

const sprites = { gorilla: {}, banana: [], sun: {} };
const SPR_SCALE = 3;         // gorilla bake scale
const GOR_UNITS = 32;        // sprite is 32×32 world units, head-top at y=2, feet at y=30

let parallax = [];           // [{depth, color, rects: [{x,w,h}]}]
let particles = [];
let floaters = [];           // screen-space transient texts
let shakeMag = 0;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// QBasic CIRCLE arcs are CCW in y-up math coordinates; canvas is y-down.
function qarc(c, cx, cy, r, s, e) {
  c.beginPath();
  c.arc(cx, cy, r, -s, -e, true);
  c.stroke();
}

// ---------------------------------------------------------------- sprites --

function bakeGorilla(pose) {
  const cv = document.createElement('canvas');
  cv.width = GOR_UNITS * SPR_SCALE;
  cv.height = GOR_UNITS * SPR_SCALE;
  const c = cv.getContext('2d');
  c.scale(SPR_SCALE, SPR_SCALE);
  c.lineWidth = 1.1;
  const x = 16, y = 2;
  const PI = Math.PI;

  // Direct port of DrawGorilla (gorilla.bas)
  c.fillStyle = C.GORILLA_BODY;
  c.strokeStyle = C.GORILLA_BODY;
  c.fillRect(x - 4, y, 7, 6);            // head
  c.fillRect(x - 5, y + 2, 9, 2);
  c.fillRect(x - 3, y + 7, 6, 1);        // neck
  c.fillRect(x - 8, y + 8, 15, 7);       // body
  c.fillRect(x - 6, y + 15, 11, 6);
  for (let i = 0; i <= 4; i++) {         // legs
    qarc(c, x + i, y + 25, 10, (3 * PI) / 4, (9 * PI) / 8);
    qarc(c, x - 6 + i - 0.1, y + 25, 10, (15 * PI) / 8, PI / 4);
  }
  for (let i = -5; i <= -1; i++) {       // arms
    const upL = pose === 'left';
    const upR = pose === 'right';
    qarc(c, x + i - 0.1, y + (upL ? 4 : 14), 9, (3 * PI) / 4, (5 * PI) / 4);
    qarc(c, x + 4.9 + i, y + (upR ? 4 : 14), 9, (7 * PI) / 4, PI / 4);
  }
  c.fillStyle = C.GORILLA_DETAIL;
  c.strokeStyle = C.GORILLA_DETAIL;
  c.fillRect(x - 3, y + 2, 6, 1);        // brow
  c.fillRect(x - 2, y + 4, 2, 1);        // nostrils
  c.fillRect(x + 1, y + 4, 2, 1);
  qarc(c, x - 4.9, y + 10, 4.9, (3 * PI) / 2, 2 * PI);   // chest lines
  qarc(c, x + 4.9, y + 10, 4.9, PI, (3 * PI) / 2);
  return cv;
}

function bakeBananaFrames() {
  // Frame order L, U, D, R with the original's rot = ⌊10t⌋ mod 4 timing.
  const offsets = [[2.4, 0], [0, -2.4], [0, 2.4], [-2.4, 0]];
  return offsets.map(([ox, oy]) => {
    const cv = document.createElement('canvas');
    cv.width = 16; cv.height = 16;
    const c = cv.getContext('2d');
    c.scale(2, 2);
    c.fillStyle = C.BANANA_COLOR;
    c.beginPath();
    c.arc(4, 4, 3.6, 0, Math.PI * 2);
    c.fill();
    c.globalCompositeOperation = 'destination-out';
    c.beginPath();
    c.arc(4 + ox, 4 + oy, 3.1, 0, Math.PI * 2);
    c.fill();
    return cv;
  });
}

function bakeSun(shocked) {
  const cv = document.createElement('canvas');
  cv.width = 96; cv.height = 96;
  const c = cv.getContext('2d');
  c.scale(2, 2);
  const x = 24, y = 24;
  c.strokeStyle = C.SUN_COLOR;
  c.fillStyle = C.SUN_COLOR;
  c.lineWidth = 1.4;
  const rays = [
    [-20, 0, 20, 0], [0, -15, 0, 15],
    [-15, -10, 15, 10], [-15, 10, 15, -10],
    [-8, -13, 8, 13], [-8, 13, 8, -13],
    [-18, -5, 18, 5], [-18, 5, 18, -5],
  ];
  for (const [a, b, d, e] of rays) {
    c.beginPath(); c.moveTo(x + a, y + b); c.lineTo(x + d, y + e); c.stroke();
  }
  c.beginPath(); c.arc(x, y, 12, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#7a4a00';
  c.strokeStyle = '#7a4a00';
  c.beginPath(); c.arc(x - 3.5, y - 3, 1.4, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(x + 3.5, y - 3, 1.4, 0, Math.PI * 2); c.fill();
  if (shocked) {
    c.beginPath(); c.arc(x, y + 4.5, 3, 0, Math.PI * 2); c.fill();
  } else {
    c.lineWidth = 1.3;
    qarc(c, x, y, 8, (210 * Math.PI) / 180, (330 * Math.PI) / 180);
  }
  return cv;
}

export function init(cnv) {
  canvas = cnv;
  ctx = canvas.getContext('2d');
  sprites.gorilla.down = bakeGorilla('down');
  sprites.gorilla.left = bakeGorilla('left');
  sprites.gorilla.right = bakeGorilla('right');
  sprites.banana = bakeBananaFrames();
  sprites.sun.happy = bakeSun(false);
  sprites.sun.shock = bakeSun(true);
}

// ------------------------------------------------------------- parallax ----

export function onNewCity(seed) {
  const rng = createRng((seed ^ 0x51ab7e3d) >>> 0);
  parallax = C.PARALLAX_LAYERS.map((def) => {
    const rects = [];
    let x = -C.WORLD_W;
    while (x < C.WORLD_W * 2) {
      const w = rng.int(50, 120);
      rects.push({ x, w, h: rng.int(40, def.hMax) });
      x += w + rng.int(4, 14);
    }
    return { ...def, rects };
  });
  particles = [];
  floaters = [];
  shakeMag = 0;
}

// -------------------------------------------------------------- effects ----

function spawnExplosion(x, y, color, big) {
  const n = big ? 54 : 34;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 50 + Math.random() * (big ? 320 : 240);
    particles.push({
      type: 'debris',
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 60,
      ttl: 0.7 + Math.random() * 0.8,
      age: 0,
      size: 1.2 + Math.random() * 2.4,
      color: color || '#8a7a55',
    });
  }
  for (let i = 0; i < (big ? 14 : 9); i++) {
    particles.push({
      type: 'smoke',
      x: x + (Math.random() - 0.5) * 14,
      y: y + (Math.random() - 0.5) * 14,
      vx: (Math.random() - 0.5) * 26,
      vy: -12 - Math.random() * 22,
      ttl: 1.1 + Math.random() * 1.1,
      age: 0,
      size: 5 + Math.random() * 9,
    });
  }
  particles.push({
    type: 'flash', x, y, vx: 0, vy: 0,
    ttl: 0.22, age: 0,
    size: C.EXPLOSION_R * (big ? 1.9 : 1.35),
  });
  if (particles.length > 900) particles.splice(0, particles.length - 900);
  shakeMag = Math.max(shakeMag, big ? 1.7 : 1.0);
}

export function handleEvent(ev) {
  switch (ev.type) {
    case 'explode':
      spawnExplosion(ev.x, ev.y, ev.color, false);
      break;
    case 'gorillaHit':
      spawnExplosion(ev.x, ev.y, '#ffa851', true);
      break;
    case 'exit':
      if (ev.boomerang) addFloater('BOOMERANG!');
      break;
    case 'gone':
      addFloater('GONE.');
      break;
    case 'cityChange':
      onNewCity(ev.seed);
      break;
    default:
      break;
  }
}

function addFloater(text) {
  floaters.push({ text, ttl: 1.6, age: 0 });
}

// ------------------------------------------------------------ main draw ----

export function draw(state, ui, alpha, dt) {
  const view = camera.getView();
  const lb = view.letterbox;
  const rect = view.rect;
  const dpr = view.dpr;
  const lodW = rect.w / C.ARENA_W;

  // Sky — full bleed, letterbox margins included (§13.1)
  camera.applyHud(ctx);
  const sky = ctx.createLinearGradient(0, 0, 0, view.cssH);
  sky.addColorStop(0, C.SKY_TOP);
  sky.addColorStop(0.62, C.SKY_MID);
  sky.addColorStop(1, C.SKY_HORIZON);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, view.cssW, view.cssH);
  // Below the letterbox the bright horizon reads oddly — ground it.
  const lbBottom = lb.y + lb.h;
  if (view.cssH > lbBottom + 1) {
    ctx.fillStyle = '#060c20';
    ctx.fillRect(0, lbBottom, view.cssW, view.cssH - lbBottom);
  }

  // Everything world-space clips to the letterbox rect
  ctx.save();
  ctx.beginPath();
  ctx.rect(lb.x, lb.y, lb.w, lb.h);
  ctx.clip();

  // decaying screen shake — render-layer only
  let shX = 0, shY = 0;
  if (shakeMag > 0.01) {
    shX = (Math.random() * 2 - 1) * shakeMag * 4;
    shY = (Math.random() * 2 - 1) * shakeMag * 4;
    shakeMag *= Math.pow(0.0025, dt);
  } else {
    shakeMag = 0;
  }
  camera.applyWorld(ctx, shX, shY);

  drawParallax(rect, lodW);
  drawGround(rect);
  drawSun(state);
  const art = getArt();                       // one blit; mask is truth (§7.4)
  if (art) ctx.drawImage(art, 0, 0);
  drawAimIndicator(state, ui);
  drawGorillas(state, ui);
  drawBanana(state, alpha, lodW);
  if (lodW <= C.LOD_NO_PARTICLES) {
    drawParticles(dt);
  } else {
    updateParticlesOnly(dt);
  }

  ctx.restore();

  // HUD — identity transform, never pans or scales with the camera (§13.3)
  camera.applyHud(ctx);
  drawHud(state, ui, alpha, dt, view);
}

function drawParallax(rect, lodW) {
  const cx = rect.x + rect.w / 2;
  const layers = lodW > C.LOD_NO_PARALLAX_DETAIL ? parallax.slice(0, 1) : parallax;
  for (const layer of layers) {
    ctx.save();
    ctx.translate(cx, C.GROUND_Y);
    ctx.scale(1 / layer.depth, 1 / layer.depth);
    ctx.translate(-cx, -C.GROUND_Y);
    ctx.fillStyle = layer.color;
    for (const r of layer.rects) {
      ctx.fillRect(r.x, C.GROUND_Y - r.h, r.w, r.h + 40);
    }
    ctx.restore();
  }
}

function drawGround(rect) {
  const bottom = rect.y + rect.h;
  if (bottom <= C.GROUND_Y) return;
  ctx.fillStyle = C.GROUND_COLOR;
  ctx.fillRect(rect.x - 60, C.GROUND_Y, rect.w + 120, bottom - C.GROUND_Y + 60);
  ctx.fillStyle = C.GROUND_EDGE;
  ctx.fillRect(rect.x - 60, C.GROUND_Y, rect.w + 120, 2);
}

function drawSun(state) {
  const s = state.sun;
  if (!s) return;
  const spr = s.shocked ? sprites.sun.shock : sprites.sun.happy;
  ctx.drawImage(spr, s.x - 24, s.y - 24, 48, 48);
}

function drawAimIndicator(state, ui) {
  if (state.mode !== 'AIM' || state.players.length < 2) return;
  const idx = state.turn;
  const p = state.players[idx];
  if (p.isAI) return;
  const aim = ui.drag || state.aim[idx];
  const worldAngle = p.facing === 1 ? aim.angle : 180 - aim.angle;
  const rad = (worldAngle * Math.PI) / 180;
  const ox = p.x + p.facing * 8;
  const oy = p.feetY - C.GORILLA_H - 6;
  const len = 26 + (aim.power / 100) * 46;
  const tx = ox + Math.cos(rad) * len;
  const ty = oy - Math.sin(rad) * len;
  ctx.strokeStyle = ui.drag ? 'rgba(255,230,90,0.95)' : 'rgba(255,230,90,0.45)';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(ox, oy);
  ctx.lineTo(tx, ty);
  ctx.stroke();
  // arrowhead
  ctx.fillStyle = ctx.strokeStyle;
  ctx.save();
  ctx.translate(tx, ty);
  ctx.rotate(-rad);
  ctx.beginPath();
  ctx.moveTo(6, 0); ctx.lineTo(-3, -4); ctx.lineTo(-3, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function gorillaPose(state, idx, ui) {
  const p = state.players[idx];
  const dancing =
    (state.mode === 'ROUND_END' && idx === state.roundWinner) ||
    (state.mode === 'GAME_OVER' && idx === state.matchWinner);
  if (dancing) return Math.floor(state.time / 0.22) % 2 ? 'left' : 'right';
  if (state.time < p.throwPoseUntil) return p.facing === 1 ? 'right' : 'left';
  if (state.mode === 'AIM' && idx === state.turn && ui.drag) {
    return p.facing === 1 ? 'right' : 'left';
  }
  return 'down';
}

function drawGorillas(state, ui) {
  for (let i = 0; i < state.players.length; i++) {
    const p = state.players[i];
    if (!p.alive) continue;
    const spr = sprites.gorilla[gorillaPose(state, i, ui)];
    ctx.drawImage(spr, p.x - 16, p.feetY - 30, GOR_UNITS, GOR_UNITS);
  }
}

function drawBanana(state, alpha, lodW) {
  const b = state.banana;
  if (!b) return;
  const x = b.prev.x + (b.cur.x - b.prev.x) * alpha;
  const y = b.prev.y + (b.cur.y - b.prev.y) * alpha;
  if (lodW > C.LOD_SIMPLE_BANANA) {
    ctx.fillStyle = C.BANANA_COLOR;
    ctx.beginPath();
    ctx.arc(x, y, C.BANANA_DRAW_R, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.drawImage(sprites.banana[b.rot], x - 4, y - 4, 8, 8);
  }
}

function updateParticlesOnly(dt) {
  for (const p of particles) {
    p.age += dt;
    if (p.type === 'debris') {
      p.vy += 500 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    } else if (p.type === 'smoke') {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }
  particles = particles.filter((p) => p.age < p.ttl);
}

function drawParticles(dt) {
  updateParticlesOnly(dt);
  for (const p of particles) {
    const k = 1 - p.age / p.ttl;
    if (p.type === 'flash') {
      const r = p.size * (0.4 + 0.6 * (p.age / p.ttl));
      ctx.fillStyle = `rgba(255,240,190,${(k * 0.85).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.type === 'debris') {
      ctx.globalAlpha = clamp(k * 1.4, 0, 1);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = `rgba(150,160,175,${(k * 0.3).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 + p.age * 0.7), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ------------------------------------------------------------------ HUD ----

function drawHud(state, ui, alpha, dt, view) {
  const lb = view.letterbox;
  if (state.players.length < 2) return;

  const fs = clamp(lb.h * 0.038, 12, 26);
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = 4;

  // Names + scores in the top corners, like the original — the sun owns
  // top-center.
  const p0 = state.players[0];
  const p1 = state.players[1];
  const cy = lb.y + fs * 1.2;
  const pad = fs * 0.9;
  ctx.font = `bold ${fs}px Consolas, 'Courier New', monospace`;
  ctx.fillStyle = state.turn === 0 && state.mode === 'AIM' ? '#ffe14d' : '#e8ecf5';
  ctx.textAlign = 'left';
  ctx.fillText(`${p0.name}  ${p0.score}`, lb.x + pad, cy);
  ctx.fillStyle = state.turn === 1 && state.mode === 'AIM' ? '#ffe14d' : '#e8ecf5';
  ctx.textAlign = 'right';
  ctx.fillText(`${p1.score}  ${p1.name}`, lb.x + lb.w - pad, cy);
  ctx.textAlign = 'center';

  // Bottom-center panel: round info (or AI status) with the wind gauge
  // beneath it (§12 — screen space so it doesn't shrink when the camera
  // widens). Both lines share one translucent backdrop — they float over
  // buildings of any hue (gray/maroon/teal, lit windows), so they need
  // their own ground to stay readable. Sky-family navy keeps it in scene.
  const wcx = lb.x + lb.w / 2;
  const wy = lb.y + lb.h - fs * 0.9;
  const subY = wy - fs * 1.1;
  let sub = `ROUND ${state.round} · FIRST TO ${state.settings.playTo}`;
  if (state.mode === 'AIM' && state.players[state.turn].isAI) {
    sub = `${state.players[state.turn].name.toUpperCase()} IS AIMING…`;
  }
  const subFont = `${fs * 0.62}px Consolas, 'Courier New', monospace`;
  const windFont = `${fs * 0.6}px Consolas, 'Courier New', monospace`;
  ctx.font = subFont;
  const subW = ctx.measureText(sub).width;

  const calm = Math.abs(state.wind) < 1;
  const wdir = Math.sign(state.wind);
  const wlen = calm ? 0 : Math.abs(state.wind / C.WIND_MAX) * lb.w * 0.13;
  ctx.font = windFont;
  const label = calm ? 'WIND · CALM' : 'WIND';
  const labelW = ctx.measureText(label).width;
  const gap = fs * 0.5;
  const tipLen = 7;
  const groupW = calm ? labelW : labelW + gap + wlen * 2 + tipLen;

  const padX = fs * 0.7;
  const panelW = Math.max(subW, groupW) + padX * 2;
  const panelT = subY - fs * 0.55;
  const panelB = wy + fs * 0.55;
  ctx.save();
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(5, 13, 36, 0.72)';
  ctx.strokeStyle = 'rgba(154, 173, 214, 0.22)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(wcx - panelW / 2, panelT, panelW, panelB - panelT, fs * 0.5);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.font = subFont;
  ctx.fillStyle = '#8a93a8';
  ctx.fillText(sub, wcx, subY);

  ctx.font = windFont;
  ctx.fillStyle = '#8a93a8';
  if (calm) {
    ctx.fillText(label, wcx, wy);
  } else {
    // Label on the tail side, arrow pointing with the wind; the whole
    // group is laid out from its left edge so it centers as one unit.
    const gx = wcx - groupW / 2;
    const lineL = wdir > 0 ? gx + labelW + gap : gx + tipLen;
    const lineR = lineL + wlen * 2;
    ctx.textAlign = 'left';
    ctx.fillText(label, wdir > 0 ? gx : lineR + gap, wy);
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#ff6a4d';
    ctx.fillStyle = '#ff6a4d';
    ctx.lineWidth = Math.max(1.5, fs * 0.12);
    ctx.beginPath();
    ctx.moveTo(lineL, wy);
    ctx.lineTo(lineR, wy);
    ctx.stroke();
    const hx = wdir > 0 ? lineR : lineL;
    ctx.beginPath();
    ctx.moveTo(hx + wdir * tipLen, wy);
    ctx.lineTo(hx - wdir * 4, wy - 5);
    ctx.lineTo(hx - wdir * 4, wy + 5);
    ctx.closePath();
    ctx.fill();
  }

  // Turn marker over the active gorilla
  if (state.mode === 'AIM') {
    const p = state.players[state.turn];
    const bounce = Math.sin(state.time * 6) * 4;
    const sp = camera.worldToScreen(p.x, p.feetY - C.GORILLA_H - 18 + bounce);
    ctx.fillStyle = '#ffe14d';
    ctx.beginPath();
    ctx.moveTo(sp.x, sp.y + 6);
    ctx.lineTo(sp.x - 6, sp.y - 4);
    ctx.lineTo(sp.x + 6, sp.y - 4);
    ctx.closePath();
    ctx.fill();
  }

  // Off-screen banana indicator (§13.4)
  if (state.banana) {
    const b = state.banana;
    const bx = b.prev.x + (b.cur.x - b.prev.x) * alpha;
    const by = b.prev.y + (b.cur.y - b.prev.y) * alpha;
    const r = view.rect;
    if (bx < r.x || bx > r.x + r.w || by < r.y) {
      const sp = camera.worldToScreen(bx, by);
      const inset = fs * 1.6;
      const ix = clamp(sp.x, lb.x + inset, lb.x + lb.w - inset);
      const iy = clamp(sp.y, lb.y + inset, lb.y + lb.h - inset);
      const ang = Math.atan2(sp.y - iy, sp.x - ix);
      const distWorld = Math.round(
        Math.hypot(sp.x - ix, sp.y - iy) / view.scale,
      );
      ctx.save();
      ctx.translate(ix, iy);
      ctx.rotate(ang);
      ctx.fillStyle = '#ffe14d';
      ctx.beginPath();
      ctx.moveTo(fs * 0.8, 0);
      ctx.lineTo(-fs * 0.4, -fs * 0.5);
      ctx.lineTo(-fs * 0.4, fs * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      ctx.font = `bold ${fs * 0.6}px Consolas, 'Courier New', monospace`;
      ctx.fillStyle = '#ffe14d';
      ctx.fillText(`${distWorld}`, ix, iy + fs * 1.1);
    }
  }

  // Floating notices ("BOOMERANG!", "GONE.")
  for (const f of floaters) {
    f.age += dt;
    const k = 1 - f.age / f.ttl;
    if (k <= 0) continue;
    ctx.font = `bold ${fs * 1.4}px Consolas, 'Courier New', monospace`;
    ctx.fillStyle = `rgba(255,225,77,${(k * 0.9).toFixed(3)})`;
    ctx.fillText(f.text, lb.x + lb.w / 2, lb.y + lb.h * 0.3 - f.age * 18);
  }
  floaters = floaters.filter((f) => f.age < f.ttl);

  ctx.shadowBlur = 0;
}
