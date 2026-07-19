// main.js — boot + screen router (state machine) for The Token Trail (WP5).
//
// The UI is a thin shell over the pure sim. It mutates game state ONLY through
// initState (once, at run start) and applyDecision (every choice). The engine
// drives all month transitions internally (advanceMonth -> beginMonth live
// inside applyDecision), so the router just watches the returned state and picks
// the next screen. Books, the hunt result, and the event resolution beat are
// log-derived UI interstitials, not engine phases.
//
// Screens are pure: each exports render(ctx) -> HTML string and, optionally,
// after(ctx) for post-DOM wiring (typing, chart, auto-advance). They read only
// visibleState + pendingDecisions. The two exceptions (run end) get the full
// state for the postmortem chart and final reveals, exactly as PLAN.md permits.

import { config } from '../config.js';
import { initState } from './state.js';
import { rngFromState } from './sim/rng.js';
import { applyDecision, pendingDecisions } from './sim/engine.js';
import { huntParams } from './sim/hunt.js';
import { visibleState } from './sim/visible.js';
import * as Audio from './audio.js';

import { classes } from './data/classes.js';
import { events } from './data/events.js';
import { majors } from './data/majors.js';
import { incidents } from './data/incidents.js';

import * as Title from './screens/title.js';
import * as Profession from './screens/profession.js';
import * as Outfitting from './screens/outfitting.js';
import * as Store from './screens/store.js';
import * as Month from './screens/month.js';
import * as Assign from './screens/assign.js';
import * as Focus from './screens/focus.js';
import * as Hunt from './screens/hunt.js';
import * as Event from './screens/event.js';
import * as Books from './screens/books.js';
import * as GameOver from './screens/gameover.js';

const SAVE_KEY = 'tokentrail.save';
const TOPTEN_KEY = 'tokentrail.topten';

const HAS_DOM = typeof document !== 'undefined';
const stage = HAS_DOM ? document.getElementById('stage') : null;

const SCREENS = {
  title: Title, about: Title, topten: Title,
  profession: Profession, outfitting: Outfitting, store: Store,
  hub: Month, map: Month, assign: Assign, focus: Focus, hunt: Hunt,
  event: Event, eventResult: Event, books: Books, gameover: GameOver
};

// --- Application state (UI only; the authoritative model is app.gs) --------
const app = {
  view: 'title',
  gs: null,              // full gameState (opaque to screens except at run end)
  rng: null,
  setup: null,           // { classId, hires, model, seed } — for drift replay
  log: [],               // [{ decisionId, optionId }] recorded decision log
  // transient UI context
  draft: null,           // profession/outfitting in-progress selections
  currentEvent: null,    // { def, deck } for the event being shown
  eventResult: null,     // captured resolution beat data
  huntResult: null,      // captured manual-hunt report
  booksMonth: null,      // month whose ledger the Books screen shows
  afterBooks: null,      // 'gameover' | 'month'
  explain: '',           // tap-to-explain line
  timers: []
};

// ===========================================================================
// Helpers passed to every screen as ctx.h
// ===========================================================================
const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const SEASONS = ['WINTER','WINTER','SPRING','SPRING','SPRING','SUMMER','SUMMER','SUMMER','FALL','FALL','FALL','WINTER'];

function monthName(m) { return MONTHS[(m - 1) % 12] || `M${m}`; }
function seasonName(m) { return SEASONS[(m - 1) % 12] || ''; }
function money(n) { return (n < 0 ? '-$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US'); }

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// segmented bar: filled/total glyph meter
function bar(value, max, cells = 10) {
  const n = Math.max(0, Math.min(cells, Math.round((value / max) * cells)));
  return `<span class="bar"><span class="fill">${'▓'.repeat(n)}</span>`
    + `<span class="empty">${'░'.repeat(cells - n)}</span></span>`;
}
function pips(filled, total) {
  filled = Math.max(0, Math.min(total, filled));
  return `<span class="pips">${'▮'.repeat(filled)}${'▯'.repeat(total - filled)}</span>`;
}

// A numbered, tappable menu row. opt: { key, label, detail, axes, action attrs, disabled, empty }
function row(opt) {
  const cls = 'row' + (opt.disabled ? ' disabled' : '') + (opt.empty ? ' empty' : '');
  const attrs = opt.disabled || opt.empty ? '' : (opt.attrs || '');
  const tag = opt.disabled || opt.empty ? 'div' : 'button';
  const showKey = opt.key != null && opt.key !== 'enter';
  const key = showKey ? `<span class="key">${esc(String(opt.key))}</span>` : '';
  const det = opt.detail ? `<span class="det">${esc(opt.detail)}</span>` : '';
  const axes = opt.axes ? `<span class="axes">${opt.axes}</span>` : '';
  const dk = opt.key != null && !opt.disabled && !opt.empty ? ` data-key="${esc(String(opt.key))}"` : '';
  return `<${tag} class="${cls}"${dk} ${attrs}>`
    + `${key}<span class="lab">${opt.label}</span>${axes}${det}</${tag}>`;
}

// Axis-icon derivation from a raw choice def (PLAN.md §1 effect-key -> axis map).
const AXIS_ORDER = ['\u{1F4B0}', '⚡', '\u{1F9E0}', '\u{1F69A}', '\u{1F91D}', '⏱', '\u{1F480}'];
function axisScan(effects, set) {
  if (!effects) return;
  for (const k of Object.keys(effects)) {
    if (k === 'money' || k === 'tokensCostMult') set.add('\u{1F4B0}');
    else if (k === 'energy') set.add('⚡');
    else if (k === 'member') set.add('⚡');
    else if (k === 'skill' || k === 'cd' || k === 'conf') set.add('\u{1F9E0}');
    else if (k === 'defects') { set.add('\u{1F91D}'); set.add('⏱'); }
    else if (k === 'client') set.add('\u{1F91D}');
    else if (k === 'removeMember') { set.add('⚡'); set.add('\u{1F69A}'); }
    else if (k === 'capacityDelta') set.add('\u{1F69A}');
    else if (k === 'endRun') set.add('\u{1F480}');
  }
}
function deriveAxes(choice) {
  if (!choice) return '';
  const set = new Set();
  axisScan(choice.cost, set);
  axisScan(choice.effects, set);
  if (choice.check) set.add('\u{1F9E0}');            // a check puts Understanding at stake
  if (choice.success) axisScan(choice.success.effects, set);
  if (choice.fail) axisScan(choice.fail.effects, set);
  return AXIS_ORDER.filter((i) => set.has(i)).join(' ');
}
function targetLabel(target) {
  if (target == null || target === 'you') return '(you)';
  if (target === 'team') return '(anyone)';
  return `(${target})`;
}

const H = {
  monthName, seasonName, money, esc, bar, pips, row, deriveAxes, targetLabel,
  config, classes,
  strip: statusStrip
};

// ===========================================================================
// Status strip — visible stats only; tap-to-explain. The client face IS the
// relationship readout; one mood face per hire. Understanding appears nowhere.
// ===========================================================================
function statusStrip(vs) {
  if (!vs) return '';
  const cap = vs.capacity || { total: 0, spent: 0 };
  const remaining = Math.max(0, cap.total - cap.spent);
  const cdMax = 10;
  const items = [];
  items.push(`<span class="item" data-action="explain" data-explain="Month ${vs.month} of ${vs.months}. The year runs Jan through Dec." tabindex="0"><span class="lbl">M${vs.month} ·</span> ${monthName(vs.month)}</span>`);
  items.push(`<span class="item money" data-action="explain" data-explain="Cash on hand. Below zero at the books ends the run: Bankruptcy." tabindex="0">${money(vs.money)}</span>`);
  items.push(`<span class="item" data-action="explain" data-explain="Your energy. Hits zero and you burn out. Rest restores it." tabindex="0">⚡${Math.round(vs.energy)}</span>`);
  items.push(`<span class="item" data-action="explain" data-explain="Review capacity left this month. Spent on AI+review and hunt ammo." tabindex="0"><span class="lbl">REV</span> ${pips(remaining, cap.total)}</span>`);
  items.push(`<span class="item" data-action="explain" data-explain="Cognitive Debt: work no one here understands. Multiplies incident damage." tabindex="0"><span class="lbl">CD</span> ${bar(vs.cd, cdMax, 5)} ${Math.round(vs.cd)}</span>`);
  items.push(`<span class="item" data-action="explain" data-explain="Client happiness. The face is the relationship; the ledger itemizes the dollars. Zero means Fired." tabindex="0"><span class="lbl">\u{1F91D}</span>${vs.clientMood}</span>`);
  const faces = [];
  for (const role of ['junior', 'qa', 'senior']) {
    const m = vs.team[role];
    if (m) faces.push(`<span class="item" data-action="explain" data-explain="${esc(m.name)} — ${esc(role)} (${esc(m.trait)}). The face mirrors morale; the number stays hidden." tabindex="0">${m.mood}</span>`);
  }
  if (faces.length) items.push(faces.join(''));
  return `<div class="strip">${items.join('')}</div>`
    + `<div class="explain">${app.explain ? esc(app.explain) : ''}</div>`;
}

// ===========================================================================
// Save / load
// ===========================================================================
function saveGame() {
  if (!app.gs) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      v: 1, setup: app.setup, decisionLog: app.log, state: app.gs
    }));
  } catch (e) { /* storage full / disabled — game still playable in-memory */ }
}
function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }
function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
function hasSave() { const s = loadSave(); return !!(s && s.state && !s.state.ending); }

export function getTopTen() {
  try { return JSON.parse(localStorage.getItem(TOPTEN_KEY)) || []; } catch (e) { return []; }
}
export function saveTopTen(list) {
  try { localStorage.setItem(TOPTEN_KEY, JSON.stringify(list.slice(0, 10))); } catch (e) {}
}

// ===========================================================================
// Run lifecycle
// ===========================================================================
function newRun(setup) {
  clearSave();
  app.setup = setup;
  app.log = [];
  app.gs = initState(setup.classId, setup.hires, setup.model, setup.seed);
  app.rng = rngFromState(app.gs.seed, app.gs.rngState);
  saveGame();
  app.view = 'hub';
  render();
}

function resumeRun() {
  const s = loadSave();
  if (!s || !s.state) { app.view = 'title'; return render(); }
  app.setup = s.setup;
  app.log = s.decisionLog || [];
  app.gs = s.state;
  app.rng = rngFromState(app.gs.seed, app.gs.rngState);
  if (app.gs.ending) { enterGameOver(); return; }
  if (app.gs.phase === 'event') { openEvent(); return; }
  if (app.gs.phase === 'store') { app.view = 'store'; return render(); }
  app.view = 'hub';
  render();
}

// The one path that changes game state.
function dispatch(decisionId, optionId) {
  if (!app.gs || app.gs.ending) return;
  // Manual hunt: play the whack-a-mole minigame FIRST, so the player's
  // performance becomes the clamped skinModifier, THEN resolve the month with it.
  if (decisionId === 'focus' && optionId === 'hunt') {
    return startHuntMinigame();
  }
  commitDecision(decisionId, optionId);
}

// Actually apply a decision through the pure engine and route to the next screen.
function commitDecision(decisionId, optionId) {
  if (!app.gs || app.gs.ending) return;
  const prevMonth = app.gs.month;
  const wasEvent = app.gs.phase === 'event';
  app.log.push({ decisionId, optionId });
  app.gs = applyDecision(app.gs, decisionId, optionId, app.rng);
  saveGame();
  app.explain = '';

  // Manual hunt just resolved: show the result phase (swing tally + engine count).
  if (decisionId === 'focus' && optionId === 'hunt') {
    app.huntResult = latestLog('hunt', prevMonth);
    app.huntPhase = 'result';
    app.pendingProceed = { prevMonth, wasEvent };
    app.view = 'hunt';
    return render();
  }
  proceed(prevMonth, wasEvent);
}

// Launch the interactive hunt (WP6). huntParams(app.gs) is the sanctioned pacing
// projection — the ONLY channel the skin's difficulty comes through.
function startHuntMinigame() {
  app.huntPhase = 'play';
  app.huntParams = huntParams(app.gs);
  app.huntTally = null;
  app.view = 'hunt';
  render();
}

// Called by the hunt screen when the 45s session ends (naturally or via Leave).
// result.modifier is the clamped performance number — the skin's one write-back.
function finishHuntMinigame(result) {
  app.huntTally = result || {};
  const clamp = config.hunt.skinModifierClamp;
  const mod = Math.max(-clamp, Math.min(clamp, (result && result.modifier) || 0));
  app.gs._huntSkinModifier = mod;         // transient; resolveManualHunt consumes it
  commitDecision('focus', 'hunt');
}

function proceed(prevMonth, wasEvent) {
  if (wasEvent) {                       // an event choice was just resolved
    app.eventResult = captureEventResult(prevMonth);
    app.view = 'eventResult';
    app.afterBooks = app.gs.ending ? 'gameover' : 'month';
    app.booksMonth = prevMonth;
    return render();
  }
  if (app.gs.phase === 'event') { openEvent(); return; }
  if (app.gs.ending) { app.booksMonth = prevMonth; app.afterBooks = 'gameover'; return openBooks(); }
  if (app.gs.month > prevMonth) { app.booksMonth = prevMonth; app.afterBooks = 'month'; return openBooks(); }
  // quarter store still open (a hire/model-switch keeps it up; skip dismisses it)
  if (app.gs.phase === 'store') { app.view = 'store'; return render(); }
  // still mid-plan: stay on the working sub-screen while it has work, else hub
  const dec = pendingDecisions(app.gs);
  if (app.view === 'assign' && dec.some((d) => d.kind === 'route')) return render();
  if (app.view === 'focus' && dec.some((d) => d.kind === 'focus')) return render();
  app.view = 'hub';
  render();
}

// Continue button out of the hunt placeholder.
function huntContinue() {
  const { prevMonth, wasEvent } = app.pendingProceed || {};
  app.pendingProceed = null;
  proceed(prevMonth, wasEvent);
}

function openEvent() {
  const pe = app.gs.pendingEvent;
  const deck = pe.deck === 'major' ? majors : pe.deck === 'incident' ? incidents : events;
  const def = deck.find((e) => e.id === pe.id) || null;
  const dec = pendingDecisions(app.gs).find((d) => d.kind === 'event');
  app.currentEvent = { def, deck: pe.deck, prompt: dec ? dec.prompt : (def ? safeText(def) : '') };
  Audio.eventSting();
  app.view = 'event';
  render();
}
function safeText(def) { try { return def.text(app.gs); } catch (e) { return def.id; } }

function openBooks() { Audio.monthStamp(); app.view = 'books'; render(); }

function afterBooks() {
  if (app.afterBooks === 'gameover') return enterGameOver();
  // entering a new month: quarter store opens at the start of months 3/6/9
  if (config.majorMonths.includes(app.gs.month) && app.gs.month !== config.months) {
    app.view = 'store';
    return render();
  }
  app.view = 'hub';
  render();
}

function enterGameOver() {
  clearSave();                          // finishing a run clears the save
  Audio.deathDirge();
  app.scoreSaved = false;
  app.savedInitials = '';
  app.view = 'gameover';
  render();
}

// Record initials + score into the Top Ten (localStorage). Score reads hidden
// Understanding — sanctioned at run end (PLAN.md §1: the ending is a mirror).
function recordScore(rawInitials) {
  if (app.scoreSaved) return;
  const initials = String(rawInitials || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3) || 'YOU';
  const { score, title } = GameOver.computeScore(app.gs);
  const list = getTopTen();
  list.push({ initials, score, title, ending: app.gs.ending, month: app.gs.month });
  list.sort((x, y) => y.score - x.score);
  saveTopTen(list);
  app.scoreSaved = true;
  app.savedInitials = initials;
  render();
}

// ---- log helpers ----------------------------------------------------------
function latestLog(type, month) {
  const hits = app.gs.log.filter((l) => l.type === type && l.month === month);
  return hits.length ? hits[hits.length - 1] : null;
}
function captureEventResult(month) {
  const def = app.currentEvent && app.currentEvent.def;
  const reveal = latestLog('reveal', month);
  const check = latestLog('check', month);
  const evLine = [...app.gs.log].reverse().find((l) => l.type === 'event' && l.month === month);
  let choice = null;
  if (def && evLine) choice = def.choices.find((c) => c.id === evLine.choice) || null;
  return {
    def, choice, reveal, check,
    deck: app.currentEvent ? app.currentEvent.deck : 'event',
    prompt: app.currentEvent ? app.currentEvent.prompt : '',
    month
  };
}

// ===========================================================================
// Render
// ===========================================================================
function clearTimers() { app.timers.forEach(clearTimeout); app.timers = []; }
function later(fn, ms) { const id = setTimeout(fn, ms); app.timers.push(id); return id; }

function ctx() {
  const vs = app.gs ? visibleState(app.gs) : null;
  const decisions = app.gs && !app.gs.ending ? pendingDecisions(app.gs) : [];
  return {
    vs, decisions, h: H, app,
    view: app.view,
    gs: app.gs,                          // full state — screens use it only at run end
    draft: app.draft,
    event: app.currentEvent,
    eventResult: app.eventResult,
    huntResult: app.huntResult,
    huntParams: app.huntParams,
    huntPhase: app.huntPhase,
    huntTally: app.huntTally,
    onHuntDone: finishHuntMinigame,
    audio: Audio,
    booksMonth: app.booksMonth,
    hasSave: hasSave(),
    topten: getTopTen(),
    schedule: later
  };
}

function render() {
  // Kill any running hunt rAF loop before rebuilding the stage (defensive: the
  // hunt is the only rAF in the app, and it self-stops, but never leak one).
  if (app.huntStop) { app.huntStop(); app.huntStop = null; }
  app.huntFinishNow = null;
  clearTimers();
  const c = ctx();
  const mod = SCREENS[app.view];
  stage.innerHTML = mod.render(c);
  if (typeof mod.after === 'function') mod.after(c);
  fitStage();
}

// ===========================================================================
// Stage fitting: letterboxed scaled stage on desktop/landscape; single-column
// reflow on portrait phones.
// ===========================================================================
function fitStage() {
  const vw = window.innerWidth, vh = window.innerHeight;
  const portrait = vw < 700 && vh >= vw;
  document.body.classList.toggle('portrait', portrait);
  if (portrait) {
    document.documentElement.style.setProperty('--scale', 1);
  } else {
    const scale = Math.min(vw / 640, vh / 400);
    document.documentElement.style.setProperty('--scale', scale);
  }
}
// ===========================================================================
// Input: one delegated click listener + number-key / Enter selection.
// (All DOM wiring + boot lives in wireAndBoot(), called only in a browser, so
// this module imports cleanly under Node for headless checks.)
// ===========================================================================
function onStageClick(e) {
  Audio.ensureStarted();                 // first user gesture unlocks WebAudio
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const a = el.dataset;
  if (a.action !== 'explain') Audio.tick();   // menu tick (bug squashes beep on their own)
  switch (a.action) {
    case 'explain':
      app.explain = (app.explain === a.explain) ? '' : a.explain;
      // re-render just the explain line without rebuilding the screen
      { const line = stage.querySelector('.explain'); if (line) line.textContent = app.explain; }
      return;
    case 'hunt-leave':
      if (app.huntFinishNow) app.huntFinishNow();
      return;
    case 'nav': app.view = a.view; return render();
    case 'dispatch': return dispatch(a.decision, a.option);
    case 'new-run': app.draft = { classId: null, hires: {}, model: 'standard', seed: makeSeed() };
      app.view = 'profession'; return render();
    case 'resume': return resumeRun();
    case 'title': app.view = 'title'; return render();
    case 'pick-class': app.draft.classId = a.class; app.view = 'outfitting';
      Outfitting.prepare(app.draft, app.rng); return render();
    case 'toggle-hire': Outfitting.toggleHire(app.draft, a.role, a.cand); return render();
    case 'pick-model': app.draft.model = a.model; return render();
    case 'set-out': return newRun(Outfitting.finalize(app.draft));
    case 'store-continue': app.view = 'hub'; return render();
    case 'books-skip': afterBooks(); return;
    case 'hunt-continue': return huntContinue();
    case 'event-continue': return openBooks();
    case 'save-initials': {
      const inp = stage.querySelector('.initials input');
      return recordScore(inp ? inp.value : '');
    }
    case 'quit-title': clearSave(); app.gs = null; app.view = 'title'; return render();
    default: return;
  }
}

function onKeyDown(e) {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
  Audio.ensureStarted();                 // first user gesture unlocks WebAudio
  if (e.key === 'Enter') {
    const primary = stage.querySelector('[data-key="enter"]') || stage.querySelector('.row[data-key]');
    if (primary) { e.preventDefault(); primary.click(); }
    return;
  }
  if (/^[1-9]$/.test(e.key)) {
    const el = stage.querySelector(`[data-key="${e.key}"]`);
    if (el) { e.preventDefault(); el.click(); }
  }
}

function makeSeed() { return (Math.floor(Math.random() * 0x7fffffff)) >>> 0; }

// Expose a few things screens/GameOver need without import cycles.
// (_onStageClick / _render are test hooks for headless harnesses.)
export { app, dispatch, hasSave, clearSave, H, render as rerender,
  onStageClick as _onStageClick, render as _render };

// ===========================================================================
// Boot — browser only.
// ===========================================================================
function wireAndBoot() {
  window.addEventListener('resize', fitStage);
  stage.addEventListener('click', onStageClick);
  document.addEventListener('keydown', onKeyDown);

  // Persistent mute toggle (outside #stage, so re-renders never disturb it).
  const muteBtn = document.getElementById('mute');
  if (muteBtn) {
    const paint = () => {
      muteBtn.textContent = Audio.isMuted() ? '\u{1F507}' : '\u{1F50A}';
      muteBtn.setAttribute('aria-pressed', String(Audio.isMuted()));
      muteBtn.setAttribute('aria-label', Audio.isMuted() ? 'Unmute sound' : 'Mute sound');
    };
    paint();
    muteBtn.addEventListener('click', () => { Audio.ensureStarted(); Audio.toggleMute(); paint(); });
  }

  app.view = 'title';
  render();
}
if (HAS_DOM && stage) wireAndBoot();
