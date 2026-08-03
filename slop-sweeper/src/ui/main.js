// @ts-check
// Stub. The real UI — camera, renderer, atlas, input, HUD — arrives in M3 (PLAN §14).
// For now this boots the headless core in the browser and fills the HUD skeleton, which
// is enough to prove the module graph loads over HTTP. It must never throw.

import { init } from '../core/reduce.js';
import { getLevel, levelIds } from '../levels/index.js';

/** @param {string} id */
const el = (id) => document.getElementById(id);

try {
  const params = new URLSearchParams(location.search);
  const id = params.get('level') ?? levelIds()[0];
  const seed = Number(params.get('seed')) >>> 0 || 1;
  const s = init(getLevel(id), seed);

  const select = /** @type {HTMLSelectElement | null} */ (el('f-level'));
  if (select) {
    select.innerHTML = '';
    for (const lid of levelIds()) {
      const opt = document.createElement('option');
      opt.value = opt.textContent = lid;
      opt.selected = lid === id;
      select.append(opt);
    }
  }

  const set = (/** @type {string} */ target, /** @type {string|number} */ text) => {
    const node = el(target);
    if (node) node.textContent = String(text);
  };
  set('seed', `seed ${s.seed}`);
  set('tick', s.tick);
  set('confidence-label', s.confidence);
  set('fc-remaining', s.schedule.total - s.stats.served);
  set('fc-next', Math.max(0, s.schedule.nextTick - s.tick));
  set('fc-waiting', 0);

  const banner = el('banner');
  if (banner) {
    banner.classList.remove('hidden');
    set('banner-title', 'M2 — HEADLESS CORE');
    set('banner-sub', `${s.w}×${s.h} · ${s.schedule.total} users · the board arrives in M3`);
  }
  console.info(`slop-sweeper: core booted level '${s.level}' at seed ${s.seed}. UI arrives in M3.`);
} catch (err) {
  console.error('slop-sweeper: boot failed', err);
}
