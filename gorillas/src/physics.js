// Pure integrator + the ONE flight code path (SPEC §8, Invariant 5).
// No canvas, no camera, no globals, no randomness. solidAt and gorilla rects
// are injected so this module imports nothing but config.

import {
  DT, SWEEP_STEP, GROUND_Y, WORLD_W, MAX_SPEED, BANANA_DRAW_R,
} from './config.js';

export function launch(x, y, angleDeg, power) {
  const a = (angleDeg * Math.PI) / 180;
  const v = (Math.max(0, Math.min(100, power)) / 100) * MAX_SPEED;
  return { x, y, vx: Math.cos(a) * v, vy: -Math.sin(a) * v };
}

// Semi-implicit Euler at fixed DT. Never step by a variable frame delta.
export function step(s, wind, gravity, dt) {
  s.vx += wind * dt;
  s.vy += gravity * dt;
  s.x += s.vx * dt;
  s.y += s.vy * dt;
  return s;
}

function circleHitsRect(px, py, r, g) {
  const cx = Math.max(g.x0, Math.min(px, g.x1));
  const cy = Math.max(g.y0, Math.min(py, g.y1));
  const dx = px - cx;
  const dy = py - cy;
  return dx * dx + dy * dy <= r * r;
}

// GONE vs BOOMERANG, judged at the moment of lateral exit (§10.2) by
// fast-forwarding a clone through the same integrator — exact agreement with
// the discrete sim by construction (see PLAN.md §1.2).
function willReturn(s0, wind, gravity) {
  const s = { x: s0.x, y: s0.y, vx: s0.vx, vy: s0.vy };
  const maxSteps = Math.ceil(120 / DT);
  for (let i = 0; i < maxSteps; i++) {
    step(s, wind, gravity, DT);
    if (s.y > GROUND_Y) return false;
    if (s.x >= 0 && s.x <= WORLD_W) return true;
  }
  return false;
}

// gorillas: [{ player, x0, y0, x1, y1, alive }]
export function createFlight(opts) {
  const {
    x, y, angleDeg, power, wind, gravity, solidAt, gorillas = [], shooter = -1,
  } = opts;

  const cur = launch(x, y, angleDeg, power);
  const own = gorillas.find((g) => g.player === shooter) || null;

  const f = {
    cur,
    prev: { x: cur.x, y: cur.y },
    t: 0,
    escaped: false,
    boomerang: false,
    armed: false,
    done: false,
    outcome: null,
  };

  // The banana spawns at the hand; the shooter's own gorilla is fair game only
  // after the banana has cleared it once. Self-destruction stays legal (§8.2).
  function updateArmed() {
    if (f.armed || !own) { f.armed = true; return; }
    const m = BANANA_DRAW_R + 2;
    if (cur.x < own.x0 - m || cur.x > own.x1 + m ||
        cur.y < own.y0 - m || cur.y > own.y1 + m) {
      f.armed = true;
    }
  }
  updateArmed();

  function finish(outcome, events) {
    f.done = true;
    f.outcome = outcome;
    events.push({ type: 'impact', outcome });
    return events;
  }

  f.stepOnce = function stepOnce() {
    if (f.done) return [];
    const events = [];
    f.prev.x = cur.x;
    f.prev.y = cur.y;
    step(cur, wind, gravity, DT);
    f.t += DT;

    // Swept collision, every sample (§8.1). Samples outside the lateral bounds
    // are void — there is nothing out there to hit — but inside samples of a
    // boundary-crossing step still collide.
    const dx = cur.x - f.prev.x;
    const dy = cur.y - f.prev.y;
    const n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / SWEEP_STEP));
    for (let i = 1; i <= n; i++) {
      const sx = f.prev.x + (dx * i) / n;
      const sy = f.prev.y + (dy * i) / n;
      if (sx < 0 || sx > WORLD_W) continue;
      if (sy >= GROUND_Y) {
        return finish({ type: 'ground', x: sx, y: GROUND_Y }, events);
      }
      const b = solidAt(sx, sy);
      if (b) {
        return finish({ type: 'terrain', x: sx, y: sy, building: b }, events);
      }
      for (const g of gorillas) {
        if (g.alive === false) continue;
        if (g.player === shooter && !f.armed) continue;
        if (circleHitsRect(sx, sy, BANANA_DRAW_R, g)) {
          return finish({ type: 'gorilla', x: sx, y: sy, player: g.player }, events);
        }
      }
    }

    const inside = cur.x >= 0 && cur.x <= WORLD_W;
    if (!f.escaped && !inside) {
      f.escaped = true;
      f.boomerang = willReturn(cur, wind, gravity);
      events.push({ type: 'exit', boomerang: f.boomerang });
      if (!f.boomerang) {
        f.done = true;
        f.outcome = { type: 'gone', x: cur.x, y: cur.y };
        return events;
      }
    } else if (f.escaped && inside) {
      f.escaped = false;
      events.push({ type: 'reenter' });
    }

    // Safety net; the exit judgment should have caught these.
    if (f.t > 150 || cur.y > GROUND_Y + 8000) {
      f.done = true;
      f.outcome = { type: 'gone', x: cur.x, y: cur.y };
    }

    updateArmed();
    return events;
  };

  return f;
}

// Run a flight to completion instantly. The AI's whole world-model (§11.2):
// same integrator, same sweep, same terrain — never an approximation.
export function runFlight(opts) {
  const fl = createFlight(opts);
  const cap = Math.ceil(180 / DT);
  let steps = 0;
  while (!fl.done && steps++ < cap) fl.stepOnce();
  if (!fl.outcome) fl.outcome = { type: 'gone', x: fl.cur.x, y: fl.cur.y };
  return { outcome: fl.outcome, time: fl.t };
}
