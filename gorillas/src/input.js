// Pointer + keyboard → aim intents (SPEC §14). Never mutates simulation
// state; everything goes through the injected handlers. Every pointer
// coordinate routes through camera.screenToWorld — never reason in pixels.

import * as camera from './camera.js';
import { DRAG_FULL, GRAB_RADIUS, GORILLA_H } from './config.js';

let handlers = null;
let drag = null;   // { pointerId }

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function aimFromPointer(cssX, cssY) {
  const g = handlers.activeGorilla();
  if (!g) return null;
  const w = camera.screenToWorld(cssX, cssY);
  const cx = g.x;
  const cy = g.feetY - GORILLA_H / 2;
  // Slingshot: drag back, throw opposite
  const dx = cx - w.x;
  const dy = cy - w.y;
  const len = Math.hypot(dx, dy);
  const power = clamp((len / DRAG_FULL) * 100, 1, 100);
  // Throw velocity is the pull-back vector (dx, dy); launch() takes the angle
  // as atan2(-vy, vx) since world y is down.
  const worldAngle = (Math.atan2(-dy, dx) * 180) / Math.PI;
  // convert to facing-relative (what the type-in fields show)
  let angle = g.facing === 1 ? worldAngle : 180 - worldAngle;
  angle = ((angle % 360) + 360) % 360;
  return { angle, power };
}

export function init(canvas, h) {
  handlers = h;

  canvas.addEventListener('pointerdown', (e) => {
    if (!handlers.canAim()) return;
    const g = handlers.activeGorilla();
    if (!g) return;
    const w = camera.screenToWorld(e.offsetX, e.offsetY);
    const cy = g.feetY - GORILLA_H / 2;
    if (Math.hypot(w.x - g.x, w.y - cy) > GRAB_RADIUS) return;
    drag = { pointerId: e.pointerId };
    try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
    e.preventDefault();
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (!handlers.canAim()) { drag = null; handlers.onDrag(null); return; }
    const aim = aimFromPointer(e.offsetX, e.offsetY);
    if (aim) handlers.onDrag(aim);
    e.preventDefault();
  });

  const finish = (e, fire) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    drag = null;
    handlers.onDrag(null);
    if (!fire || !handlers.canAim()) return;
    const aim = aimFromPointer(e.offsetX, e.offsetY);
    if (aim && aim.power >= 3) handlers.onFire(aim.angle, aim.power);
  };
  canvas.addEventListener('pointerup', (e) => finish(e, true));
  canvas.addEventListener('pointercancel', (e) => finish(e, false));

  window.addEventListener('keydown', (e) => {
    const t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'BUTTON')) {
      return; // let DOM fields own their keys
    }
    if (!handlers.canAim()) return;
    const big = e.shiftKey ? 5 : 1;
    switch (e.key) {
      case 'ArrowUp': handlers.onNudge(big, 0); e.preventDefault(); break;
      case 'ArrowDown': handlers.onNudge(-big, 0); e.preventDefault(); break;
      case 'ArrowRight': handlers.onNudge(0, big); e.preventDefault(); break;
      case 'ArrowLeft': handlers.onNudge(0, -big); e.preventDefault(); break;
      case 'Enter': handlers.onFireCurrent(); e.preventDefault(); break;
      default: break;
    }
  });
}
