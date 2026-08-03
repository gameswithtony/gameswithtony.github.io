// @ts-check
// The DOM half of the game (SPEC §10.3, PLAN §11.8). Layout and text are the DOM's job;
// the board is canvas and lays itself out.
//
// The one rule that matters here: the action bar is fed by `legalActions()` and nothing
// else, so the UI can never offer a verb the reducer would reject — and the absence of
// Place next to unreviewed slop is how SPEC §4.1 teaches itself.

import { RULES } from '../core/rules.js';
import { legalActions } from '../core/reduce.js';
import { SHAPES } from '../core/shapes.js';
import { PALETTE } from './palette.js';
import { crisp } from './atlas.js';
import { drawTray } from './renderer.js';
import * as cam from './camera.js';

/** @typedef {import('../core/state.js').GameState} GameState */
/** @typedef {import('../core/state.js').ActionKind} ActionKind */
/** @typedef {import('./camera.js').Camera} Camera */
/** @typedef {import('./renderer.js').ViewOverlay} ViewOverlay */

/**
 * @typedef {object} HudHandlers
 * @property {(kind: ActionKind) => void} onAction
 * @property {() => void} onRotate
 * @property {() => void} onConfirm
 * @property {(id: string) => void} onLevel
 * @property {() => void} onRestart
 * @property {(cell: number) => void} onMinimapJump
 * @property {() => void} onCopySeed
 */

/** @type {Partial<Record<ActionKind, { label: string, cost: string, title: string }>>} */
const VERBS = {
  place: { label: 'PLACE', cost: '1', title: 'Build one tile by hand (SPEC §4.1)' },
  analyze: { label: 'ANALYZE', cost: '1', title: 'Review this module' },
  placeBlock: { label: 'COMMIT BLOCK', cost: '1', title: 'Commit the generated block here' },
  generate: { label: 'GENERATE', cost: '0', title: 'Draw a block — the turn is charged when you commit it' },
  wait: { label: 'WAIT', cost: '1', title: 'Let a tick pass' },
};

/**
 * CSS px per tray cell. Mirrors the ≤899px breakpoint in styles.css, where the footer's
 * first row is 44px tall: four cells at 8px plus the tray's own border and padding fit it.
 * @returns {number}
 */
function trayCellPx() {
  try {
    return window.matchMedia('(max-width: 899px)').matches ? 8 : 11;
  } catch {
    return 11;
  }
}

/** @param {string} id @returns {HTMLElement} */
function el(id) {
  const node = document.getElementById(id);
  if (!node) throw new Error(`hud: missing #${id}`);
  return node;
}

/**
 * @param {HudHandlers} h
 */
export function createHud(h) {
  const dom = {
    hud: el('hud'),
    level: /** @type {HTMLSelectElement} */ (el('f-level')),
    restart: el('btn-restart'),
    seed: el('seed'),
    tick: el('tick'),
    confFill: el('confidence-fill'),
    confLabel: el('confidence-label'),
    remaining: el('fc-remaining'),
    next: el('fc-next'),
    waiting: el('fc-waiting'),
    actionbar: el('actionbar'),
    generate: /** @type {HTMLButtonElement} */ (el('btn-generate')),
    wait: /** @type {HTMLButtonElement} */ (el('btn-wait')),
    tray: el('tray'),
    trayCanvas: /** @type {HTMLCanvasElement} */ (el('tray-canvas')),
    rotate: /** @type {HTMLButtonElement} */ (el('btn-rotate')),
    confirm: /** @type {HTMLButtonElement} */ (el('btn-confirm')),
    rotLabel: el('rot-label'),
    trayHint: el('tray-hint'),
    minimap: /** @type {HTMLCanvasElement} */ (el('minimap')),
    banner: el('banner'),
    bannerTitle: el('banner-title'),
    bannerSub: el('banner-sub'),
    bannerBtn: el('banner-btn'),
    toast: el('toast'),
    notice: el('notice'),
  };

  let barKey = '';
  let trayKey = '';
  /** @type {number | undefined} */
  let toastTimer;
  /** @type {number | undefined} */
  let noticeTimer;
  /** @type {{ s: GameState, cam: Camera } | null} */
  let lastMinimap = null;

  dom.level.addEventListener('change', () => h.onLevel(dom.level.value));
  dom.restart.addEventListener('click', () => h.onRestart());
  dom.seed.addEventListener('click', () => h.onCopySeed());
  dom.generate.addEventListener('click', () => h.onAction('generate'));
  dom.wait.addEventListener('click', () => h.onAction('wait'));
  dom.rotate.addEventListener('click', () => h.onRotate());
  dom.confirm.addEventListener('click', () => h.onConfirm());
  dom.bannerBtn.addEventListener('click', () => h.onRestart());
  dom.minimap.addEventListener('pointerdown', (e) => {
    if (!lastMinimap) return;
    const cell = minimapCell(dom.minimap, lastMinimap.s, e);
    if (cell >= 0) h.onMinimapJump(cell);
    e.preventDefault();
  });

  /**
   * @param {string[]} ids
   * @param {string} current
   */
  function setLevels(ids, current) {
    dom.level.innerHTML = '';
    for (const id of ids) {
      const opt = document.createElement('option');
      opt.value = id;
      opt.textContent = id;
      opt.selected = id === current;
      dom.level.append(opt);
    }
  }

  /**
   * @param {GameState} s
   * @param {ViewOverlay} view
   * @param {Camera} camera
   */
  function update(s, view, camera) {
    const globals = legalActions(s);
    const cellActions = view.selected >= 0 ? legalActions(s, view.selected) : [];
    // `placeBlock` from legalActions() means "some rotation fits this anchor". The board
    // shows the ghost at exactly one rotation, so commit is offered only for the pair the
    // UI would actually dispatch — a strict subset of what the reducer accepts, never a
    // superset, and the ghost you can see is always the thing that will be built.
    const canCommit = !!view.ghost?.valid;
    const offered = cellActions.filter((k) => k !== 'placeBlock' || canCommit);

    dom.seed.textContent = `SEED ${s.seed}`;
    dom.tick.textContent = String(s.tick);

    const pct = Math.max(0, Math.min(100, (s.confidence / RULES.CONFIDENCE_START) * 100));
    dom.confFill.style.width = `${pct}%`;
    dom.confFill.style.background = pct <= 25 ? PALETTE.RED : pct <= 50 ? PALETTE.HAND : PALETTE.OK;
    dom.confLabel.textContent = String(Math.round(s.confidence));

    // The forecast trio is persistent, not optional polish (SPEC §6.1).
    dom.remaining.textContent = String(s.schedule.total - s.stats.served);
    // Counting down to the ACTION that produces the spawn, not to the tick counter. The
    // pipeline spawns before `tick++` (PLAN §7.1), so a user scheduled for tick N appears
    // during the action taken while the counter still reads N — "1" means "your next move
    // brings one", and the display never sits on 0 for a whole turn.
    dom.next.textContent = s.schedule.spawned >= s.schedule.total
      ? '—'
      : String(Math.max(1, s.schedule.nextTick - s.tick + 1));
    let waiting = 0;
    for (const u of s.users) if (u.state === 'queued' || (u.state === 'moving' && u.stalled)) waiting++;
    dom.waiting.textContent = String(waiting);

    // Action bar — rebuilt only when what it offers changes, so buttons stay clickable.
    const key = `${offered.join(',')}|${view.selected >= 0}`;
    if (key !== barKey) {
      barKey = key;
      dom.actionbar.innerHTML = '';
      for (const kind of offered) {
        const v = VERBS[kind];
        if (!v) continue;
        const b = document.createElement('button');
        b.className = 'verb';
        b.title = v.title;
        b.innerHTML = `${v.label} <i>${v.cost}</i>`;
        b.addEventListener('click', () => h.onAction(kind));
        dom.actionbar.append(b);
      }
      if (offered.length === 0) {
        const hint = document.createElement('span');
        hint.className = 'hint';
        hint.textContent = view.selected >= 0 ? 'NO LEGAL ACTION HERE' : 'TAP A CELL';
        dom.actionbar.append(hint);
      }
    }

    dom.generate.disabled = !globals.includes('generate');
    dom.wait.disabled = !globals.includes('wait');       // always visible, per spec owner

    // Block tray (SPEC §10.6): fixed CSS size, legible whatever the board zoom is doing.
    // Lets the narrow-screen stylesheet give the tray the room the minimap was using,
    // without either of them changing the footer's fixed height.
    if (s.phase.k === 'placing') dom.hud.classList.add('placing');
    else dom.hud.classList.remove('placing');

    if (s.phase.k === 'placing') {
      const rots = s.phase.rots;                    // the reducer's own rotation data
      const rot = Math.min(view.rot ?? 0, rots.length - 1);
      const dpr = window.devicePixelRatio || 1;
      const cell = trayCellPx();
      dom.tray.classList.remove('hidden');
      const trayNext = `${s.phase.shape}|${rot}|${dpr}|${cell}`;
      if (trayNext !== trayKey) {
        trayKey = trayNext;
        // The tallest rotation is 4 cells, and the footer row is cut to fit exactly that.
        // The tray never changes the footer's size, only what is inside it.
        drawTray(dom.trayCanvas, rots[rot].cells, cell, dpr);
      }
      dom.rotLabel.textContent = `${rot + 1}/${rots.length}`;
      dom.rotate.disabled = rots.length < 2;
      dom.confirm.disabled = !canCommit;
      dom.trayHint.textContent = canCommit
        ? `${SHAPES[s.phase.shape].id} · READY TO COMMIT`
        : `${SHAPES[s.phase.shape].id} · TAP A HIGHLIGHTED ANCHOR`;
    } else {
      dom.tray.classList.add('hidden');
      trayKey = '';
    }

    lastMinimap = { s, cam: camera };
    drawMinimap(dom.minimap, s, camera);
  }

  return {
    setLevels,
    update,

    /**
     * Camera-only refresh: the viewport rectangle has to track a pan, but a pan changes
     * nothing else in the HUD.
     * @param {GameState} s
     * @param {Camera} camera
     */
    minimap(s, camera) {
      lastMinimap = { s, cam: camera };
      drawMinimap(dom.minimap, s, camera);
    },

    /** @param {string} text */
    toast(text) {
      dom.toast.textContent = text;
      dom.toast.classList.remove('hidden');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => dom.toast.classList.add('hidden'), 1900);
    },

    /** @param {string} text */
    notice(text) {
      dom.notice.textContent = text;
      dom.notice.classList.remove('hidden');
      clearTimeout(noticeTimer);
      noticeTimer = setTimeout(() => dom.notice.classList.add('hidden'), 2400);
    },

    /**
     * @param {string} title
     * @param {string} sub
     * @param {string} [button]
     */
    banner(title, sub, button = 'PLAY AGAIN') {
      dom.bannerTitle.textContent = title;
      dom.bannerSub.textContent = sub;
      dom.bannerBtn.textContent = button;
      dom.banner.classList.remove('hidden');
    },

    hideBanner() { dom.banner.classList.add('hidden'); },
  };
}

// --- minimap (PLAN §11.7) -----------------------------------------------------------

/**
 * @param {HTMLCanvasElement} canvas
 * @param {GameState} s
 * @returns {{ px: number, ox: number, oy: number }}
 */
function minimapLayout(canvas, s) {
  const bw = s.bbox.x1 - s.bbox.x0 + 1;
  const bh = s.bbox.y1 - s.bbox.y0 + 1;
  const px = Math.max(1, Math.min(6, Math.floor(Math.min(canvas.width / bw, canvas.height / bh))));
  return {
    px,
    ox: Math.floor((canvas.width - bw * px) / 2) - s.bbox.x0 * px,
    oy: Math.floor((canvas.height - bh * px) / 2) - s.bbox.y0 * px,
  };
}

/**
 * @param {GameState} s
 * @param {number} i
 * @returns {string | null}
 */
function minimapColor(s, i) {
  if (i === s.origin || i === s.dest) return PALETTE.RED;
  switch (s.con[i].k) {
    case 'hand': return PALETTE.HAND;
    case 'aiHidden': return PALETTE.AI_HIDDEN;
    case 'aiRevealed': return PALETTE.AI_REVEALED;
    case 'mineConfirmed': return PALETTE.RED;
    default: break;
  }
  if (s.terrain[i] === 'volcano') return PALETTE.VOLCANO;
  if (s.terrain[i] === 'ocean') return PALETTE.OCEAN;
  return null;    // VOID is never drawn as board (SPEC §10.7)
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {GameState} s
 * @param {Camera} camera
 */
function drawMinimap(canvas, s, camera) {
  const dpr = window.devicePixelRatio || 1;
  if (canvas.clientWidth === 0 || canvas.clientHeight === 0) return;   // hidden: nothing to draw
  const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
  const hpx = Math.max(1, Math.round(canvas.clientHeight * dpr));
  if (canvas.width !== w || canvas.height !== hpx) { canvas.width = w; canvas.height = hpx; }
  const ctx = crisp(/** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d')));
  ctx.fillStyle = PALETTE.VOID;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const { px, ox, oy } = minimapLayout(canvas, s);
  for (let y = s.bbox.y0; y <= s.bbox.y1; y++) {
    for (let x = s.bbox.x0; x <= s.bbox.x1; x++) {
      const color = minimapColor(s, y * s.w + x);
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(ox + x * px, oy + y * px, px, px);
    }
  }
  ctx.fillStyle = PALETTE.USER;
  for (const u of s.users) {
    if (u.state === 'arrived') continue;
    ctx.fillRect(ox + (u.at % s.w) * px, oy + Math.floor(u.at / s.w) * px, px, px);
  }

  // Viewport rectangle, drawn as four fillRects — no strokes anywhere in this game.
  const t = cam.tilePx(camera);
  const vx = Math.round(ox + (-camera.ox / t) * px);
  const vy = Math.round(oy + (-camera.oy / t) * px);
  const vw = Math.max(2, Math.round((camera.cw / t) * px));
  const vh = Math.max(2, Math.round((camera.ch / t) * px));
  ctx.fillStyle = PALETTE.SELECT;
  ctx.fillRect(vx, vy, vw, 1);
  ctx.fillRect(vx, vy + vh - 1, vw, 1);
  ctx.fillRect(vx, vy, 1, vh);
  ctx.fillRect(vx + vw - 1, vy, 1, vh);
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {GameState} s
 * @param {PointerEvent} e
 * @returns {number} cell index, or -1
 */
function minimapCell(canvas, s, e) {
  const r = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const { px, ox, oy } = minimapLayout(canvas, s);
  const x = Math.floor((((e.clientX - r.left) * dpr) - ox) / px);
  const y = Math.floor((((e.clientY - r.top) * dpr) - oy) / px);
  if (x < 0 || y < 0 || x >= s.w || y >= s.h) return -1;
  return y * s.w + x;
}
