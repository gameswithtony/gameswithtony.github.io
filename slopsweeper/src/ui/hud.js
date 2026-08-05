// @ts-check
// The DOM half of the game (SPEC §10.3, PLAN §11.8). Layout and text are the DOM's job;
// the board is canvas and lays itself out.
//
// The one rule that matters here: the action bar is fed by `legalActions()` and nothing
// else, so the UI can never offer a verb the reducer would reject — and the absence of
// Place next to unreviewed slop is how SPEC §4.1 teaches itself.

import { RULES } from '../core/rules.js';
import { legalActions } from '../core/reduce.js';
import { isFlagged, levelParams } from '../core/state.js';
import { gateOpen } from '../core/routing.js';
import { SHAPES } from '../core/shapes.js';
import { PALETTE } from './palette.js';
import { crisp } from './atlas.js';
import { blockingFlagSet, drawTray, endpointLetters, stencilDims, IMPATIENT_AT, patienceSpent } from './renderer.js';
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
 * @property {() => void} onRun        fast-forward toggle (PLAN §12.6)
 * @property {(steps: number) => void} onZoom   ±1 artPx, anchored at the viewport centre
 * @property {() => void} onRoster     the WAITING chip: open the user roster (roster.js)
 */

/**
 * `{left}` in a label or a title is the beta supply still on the shelf, substituted at build
 * time. A token rather than a second table because BETA is the one verb whose button has to
 * say how much of it is left — everything else in this game is metered in turns, and turns are
 * already in the cost badge.
 * @type {Partial<Record<ActionKind, { label: string, cost: string, title: string }>>}
 */
const VERBS = {
  place: { label: 'PLACE', cost: '1', title: 'Build one tile by hand (SPEC §4.1)' },
  beta: { label: 'BETA ×{left}', cost: '1', title: 'Ship a beta here — users walk out to it and wait there — {left} left' },
  analyze: { label: 'ANALYZE', cost: '1', title: 'Review this cell — a zero opens its neighbours too' },
  placeBlock: { label: 'COMMIT BLOCK', cost: '1', title: 'Commit the generated block here' },
  generate: { label: 'GENERATE', cost: '0', title: 'Draw a block — the turn is charged when you commit it' },
  flag: { label: 'FLAG', cost: '0', title: 'Mark a suspected defect — costs no turn, and users refuse to walk through it' },
  wait: { label: 'WAIT', cost: '1', title: 'Let a turn pass' },
};

/** Verbs that spend no turn. They get GENERATE's colouring, which is what "free" looks like here. */
const FREE_VERBS = new Set(['generate', 'flag']);

/**
 * Betas still on the shelf. The supply is the level's and the spend is the reducer's, so this
 * is arithmetic and not a second copy of the rule (`stats.betas` only ever goes up — a beta a
 * blast takes out is not refunded). Both reads are defended: a save written before the field
 * existed restores without one, and the HUD may not be the thing that crashes on it.
 * @param {GameState} s
 * @returns {number}
 */
function betaLeft(s) {
  const supply = levelParams(s).betaSupply ?? RULES.BETA_SUPPLY ?? 0;
  return Math.max(0, supply - (s.stats.betas ?? 0));
}

/**
 * @param {GameState} s
 * @param {number} cell  -1 when nothing is selected
 * @returns {boolean}
 */
function flaggedAt(s, cell) {
  return cell >= 0 && isFlagged(s.con[cell]);
}

/**
 * What the selected cell is offering, in one line. Unreviewed slop is the only cell that needs
 * saying out loud: the two verbs it carries do very different things and one of them is free,
 * and the cascade is the rule a new player will not guess from a button label.
 *
 * A flagged cell has a third line as of 2026-08-05, and it is the only one here that reports a
 * fact about the *board* rather than about the verbs. When core names this flag as the single
 * thing keeping somebody stuck, the tile is already wearing the alarm (renderer.js) — but the
 * tile can only say "something is wrong here", and the line has to say what and what to do
 * about it, because the answer is counter-intuitive: the fix for a flag that is costing you
 * users is to take your own guardrail away. The blocking set is asked for only on the branch
 * that can use it, so an ordinary selection never pays for the question.
 * @param {GameState} s
 * @param {number} cell
 * @returns {string} '' when the buttons already say everything
 */
function cellHint(s, cell) {
  if (cell < 0 || s.phase.k !== 'play') return '';
  if (s.con[cell].k !== 'aiHidden') return '';
  if (!flaggedAt(s, cell)) {
    return 'ANALYZE REVEALS THIS CELL · A ZERO CASCADES · A MINE DETONATES · FLAG IS FREE';
  }
  return blockingFlagSet(s).has(cell)
    ? 'THIS FLAG IS THE ROADBLOCK: USERS ARE STUCK BEHIND IT · UNFLAG OR BUILD AROUND'
    : 'FLAGGED — USERS REFUSE TO ENTER · UNFLAG TO ANALYZE';
}

/**
 * The box the footer already reserves for the stencil, in CSS px, per the two footer layouts
 * in styles.css. Narrow: the 46px grid row less 2px of tray border and 8px of tray padding
 * leaves 36. Wide: --hud-h 82 less 14px of footer padding, less that same 12, leaves 56. `cap`
 * is the cell size the tray has always drawn at, kept as a ceiling so the shapes that fit
 * before still look exactly as they did.
 * @returns {{ w: number, h: number, cap: number }}
 */
function trayBudget() {
  try {
    return window.matchMedia('(max-width: 899px)').matches
      ? { w: 46, h: 36, cap: 8 }
      : { w: 64, h: 56, cap: 11 };
  } catch {
    return { w: 64, h: 56, cap: 11 };
  }
}

/**
 * CSS px per tray cell, derived from the stencil actually being placed. Blocks are generated
 * now, not drawn from a table of tetromino-sized stencils, so a rotation can be six cells
 * tall; the footer row cannot grow (board geometry is a pure function of the viewport — see
 * styles.css), so the cell shrinks instead. Nothing here caps the shape's size: it reads the
 * bounds and divides.
 * @param {[number, number][]} offsets
 * @returns {number}
 */
function trayCellPx(offsets) {
  const { cols, rows } = stencilDims(offsets);
  const b = trayBudget();
  return Math.max(3, Math.min(b.cap, Math.floor(Math.min(b.w / cols, b.h / rows))));
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
    scServed: el('sc-served'),
    scLost: el('sc-lost'),
    remaining: el('fc-remaining'),
    next: el('fc-next'),
    waiting: el('fc-waiting'),
    soonest: el('fc-soonest'),
    roster: /** @type {HTMLButtonElement} */ (el('btn-roster')),
    actionbar: el('actionbar'),
    generate: /** @type {HTMLButtonElement} */ (el('btn-generate')),
    wait: /** @type {HTMLButtonElement} */ (el('btn-wait')),
    run: /** @type {HTMLButtonElement} */ (el('btn-run')),
    tray: el('tray'),
    trayCanvas: /** @type {HTMLCanvasElement} */ (el('tray-canvas')),
    rotate: /** @type {HTMLButtonElement} */ (el('btn-rotate')),
    confirm: /** @type {HTMLButtonElement} */ (el('btn-confirm')),
    rotLabel: el('rot-label'),
    trayHint: el('tray-hint'),
    minimap: /** @type {HTMLCanvasElement} */ (el('minimap')),
    zoomIn: /** @type {HTMLButtonElement} */ (el('btn-zoom-in')),
    zoomOut: /** @type {HTMLButtonElement} */ (el('btn-zoom-out')),
    help: /** @type {HTMLButtonElement} */ (el('btn-help')),
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
  dom.run.addEventListener('click', () => h.onRun());
  dom.zoomIn.addEventListener('click', () => h.onZoom(1));
  dom.zoomOut.addEventListener('click', () => h.onZoom(-1));
  dom.roster.addEventListener('click', () => h.onRoster());
  // How to Play is a lazily-imported overlay, so the button is dead until that module lands
  // and registers itself. Disabled rather than silently inert: a control that does nothing
  // when tapped is worse than one that says it is not ready.
  dom.help.disabled = true;
  dom.help.addEventListener('click', () => helpFn?.());
  /** @type {(() => void) | null} */
  let helpFn = null;
  dom.rotate.addEventListener('click', () => h.onRotate());
  dom.confirm.addEventListener('click', () => h.onConfirm());
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

    // The score. `lost` goes red the moment it is non-zero: it is the one number in the HUD
    // that can only ever get worse, and it is what separates a good run from a shipped one.
    dom.scServed.textContent = `${s.stats.served}/${s.schedule.total}`;
    dom.scLost.textContent = String(s.stats.lost ?? 0);
    dom.scLost.style.color = (s.stats.lost ?? 0) > 0 ? PALETTE.RED : '';

    // The forecast trio is persistent, not optional polish (SPEC §6.1).
    dom.remaining.textContent = String(s.schedule.total - s.stats.served);
    // Counting down to the ACTION that produces the spawn, not to the tick counter. The
    // pipeline spawns before `tick++` (PLAN §7.1), so a user scheduled for tick N appears
    // during the action taken while the counter still reads N — "1" means "your next move
    // brings one", and the display never sits on 0 for a whole turn.
    dom.next.textContent = s.schedule.spawned >= s.schedule.total
      ? '—'
      : String(Math.max(1, s.schedule.nextTick - s.tick + 1));
    // WAITING is two numbers now: how many are waiting, and how many turns the least patient
    // of them has left. The count says you are behind; the countdown says how long you have
    // to stop being behind, which is the half a player can still answer. Campers on a beta
    // are in both numbers — a beta stages the walk, it does not stop the clock.
    let waiting = 0;
    let soonest = 0;
    /** @type {import('../core/state.js').User | null} */
    let worst = null;
    const patience = levelParams(s).patience;
    for (const u of s.users) {
      if (u.state !== 'queued' && !(u.state === 'moving' && u.stalled)) continue;
      waiting++;
      const left = Math.max(0, patience - (u.waited ?? 0));
      if (!worst || left < soonest) { worst = u; soonest = left; }
    }
    dom.waiting.textContent = String(waiting);
    // Nobody waiting means there is no countdown to show — not a zero, which would read as
    // "somebody leaves this turn", the exact opposite of what an empty queue means.
    dom.soonest.textContent = worst ? `·${soonest}` : '';
    dom.soonest.classList.toggle('urgent', !!worst && patienceSpent(s, worst) >= IMPATIENT_AT);

    // Action bar — rebuilt only when what it offers changes, so buttons stay clickable.
    // The flag state is part of the key: FLAG and UNFLAG are the same verb wearing different
    // words, and a toggle that leaves the old word on the button is a toggle nobody trusts.
    const flagged = flaggedAt(s, view.selected);
    const hintText = cellHint(s, view.selected);
    // The beta count is part of the key for the same reason the flag state is: BETA ×3 and
    // BETA ×2 are the same verb wearing different words, and a button that keeps yesterday's
    // number is a button that lies about a resource you cannot get back.
    const betas = betaLeft(s);
    const key = `${offered.join(',')}|${view.selected >= 0}|${flagged}|${betas}|${hintText}`;
    if (key !== barKey) {
      barKey = key;
      dom.actionbar.innerHTML = '';
      for (const kind of offered) {
        const v = VERBS[kind];
        if (!v) continue;
        const b = document.createElement('button');
        b.className = FREE_VERBS.has(kind) ? 'verb free' : `verb${kind === 'beta' ? ' beta' : ''}`;
        b.title = v.title.replaceAll('{left}', String(betas));
        const label = kind === 'flag' && flagged ? 'UNFLAG' : v.label.replaceAll('{left}', String(betas));
        b.innerHTML = `${label} <i>${v.cost}</i>`;
        b.addEventListener('click', () => h.onAction(kind));
        dom.actionbar.append(b);
      }
      if (offered.length === 0) {
        const hint = document.createElement('span');
        hint.className = 'hint';
        hint.textContent = view.selected >= 0 ? 'NO LEGAL ACTION HERE' : 'TAP A CELL';
        dom.actionbar.append(hint);
      } else if (hintText) {
        // Rides after the buttons and takes the leftover width. styles.css hides it below
        // 900px, by the same reasoning that hides the tray's hint there: the narrow footer
        // row has no prose budget, and the verbs must never be squeezed to make room for one.
        const hint = document.createElement('span');
        hint.className = 'hint cell-hint';
        hint.textContent = hintText;
        dom.actionbar.append(hint);
      }
    }

    dom.generate.disabled = !globals.includes('generate');
    dom.wait.disabled = !globals.includes('wait');       // always visible, per spec owner
    // Run is Wait on a timer, offered only once there is something to watch: before the
    // departure gate opens, fast-forwarding is just spending the meter (PLAN §12.6).
    // "Something to watch" grew a second clause with itineraries (2026-08-05): gateOpen
    // counts queued and stalled users who could progress, and on a multi-destination board
    // the crowd can be split — four walkers mid-route to C while the B-and-D people wait at
    // A with nowhere to go. The walkers are exactly what fast-forward is for, so anyone
    // actually moving keeps the button live even while the gate itself reads shut.
    const anyWalking = s.users.some((u) => u.state === 'moving' && !u.stalled);
    dom.run.disabled = !globals.includes('wait') || (!gateOpen(s) && !anyWalking);

    // Block tray (SPEC §10.6): fixed CSS size, legible whatever the board zoom is doing.
    // Lets the narrow-screen stylesheet give the tray the room the minimap was using,
    // without either of them changing the footer's fixed height.
    if (s.phase.k === 'placing') dom.hud.classList.add('placing');
    else dom.hud.classList.remove('placing');

    if (s.phase.k === 'placing') {
      const rots = s.phase.rots;                    // the reducer's own rotation data
      const rot = Math.min(view.rot ?? 0, rots.length - 1);
      const dpr = window.devicePixelRatio || 1;
      const cell = trayCellPx(rots[rot].cells);
      dom.tray.classList.remove('hidden');
      const trayNext = `${s.phase.shape}|${rot}|${dpr}|${cell}`;
      if (trayNext !== trayKey) {
        trayKey = trayNext;
        // The cell size already absorbed however tall this rotation is, so the canvas fits
        // the row whatever was generated. The tray never changes the footer's size, only
        // what is inside it.
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
    syncZoom(camera);
    drawMinimap(dom.minimap, s, camera);
  }

  /**
   * The zoom buttons are the fourth caller of the same camera — pinch, wheel and the keyboard
   * got there first — so their disabled state cannot live where they are clicked or it would
   * go stale the moment somebody pinched instead. It tracks the camera, on the one path every
   * zoom already takes: the redraw.
   * @param {Camera} camera
   */
  function syncZoom(camera) {
    dom.zoomOut.disabled = camera.artPx <= camera.minArtPx;
    dom.zoomIn.disabled = camera.artPx >= camera.maxArtPx;
  }

  return {
    setLevels,
    update,

    /**
     * Hand the "?" button something to open, once the overlay module has loaded.
     * @param {() => void} fn
     */
    onHelp(fn) {
      helpFn = fn;
      dom.help.disabled = false;
    },

    /**
     * The camera moved. Called synchronously from every zoom path rather than left to the
     * next repaint: the buttons describe the camera, and the camera has already changed by
     * the time the frame is requested.
     * @param {Camera} camera
     */
    zoom(camera) { syncZoom(camera); },

    /**
     * Camera-only refresh: the viewport rectangle has to track a pan, but a pan changes
     * nothing else in the HUD.
     * @param {GameState} s
     * @param {Camera} camera
     */
    minimap(s, camera) {
      lastMinimap = { s, cam: camera };
      syncZoom(camera);
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
     * @param {boolean} on
     */
    setRun(on) {
      dom.run.classList.toggle('on', on);
      dom.run.textContent = on ? 'STOP' : 'RUN';
    },

    /** @returns {HTMLElement} the Run button, so the shell can spare it from "any input stops". */
    runButton() { return dom.run; },
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
 * The minimap is the topology view of the topology view: every endpoint is RED and none of them
 * is lettered, because at one to six device pixels a cell there is nowhere to put a letter and
 * nothing to gain by trying. Which red dot is which is a question the board answers.
 * @param {GameState} s
 * @param {number} i
 * @param {Map<number, string>} ends  origin + destinations, built once per draw
 * @returns {string | null}
 */
function minimapColor(s, i, ends) {
  if (ends.has(i)) return PALETTE.RED;
  switch (s.con[i].k) {
    case 'hand': return PALETTE.HAND;
    case 'beta': return PALETTE.OK;      // the tile's own green: betas are findable zoomed out
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
  const ends = endpointLetters(s);
  for (let y = s.bbox.y0; y <= s.bbox.y1; y++) {
    for (let x = s.bbox.x0; x <= s.bbox.x1; x++) {
      const color = minimapColor(s, y * s.w + x, ends);
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
