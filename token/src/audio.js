// audio.js — WebAudio square-wave beeps for The Token Trail (WP6).
//
// PLAN.md §2 guardrails: NO sound files, ever — synthesized square waves only,
// behind a mute toggle, initialized on the FIRST user gesture (browsers block
// AudioContext until then). The mute preference persists in localStorage.
//
// Node-safe: nothing here touches `window` / `AudioContext` at import time (only
// inside functions), and every storage access is guarded, so importing this
// module under Node (or anywhere non-browser) is a harmless no-op.

const KEY = 'tokentrail.muted';

let ctx = null;         // the (lazily created) AudioContext
let master = null;      // master gain, so mute is instant
let started = false;    // has a user gesture unlocked audio yet
let muted = loadMuted();

function loadMuted() {
  try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; }
}
function persist() {
  try { localStorage.setItem(KEY, muted ? '1' : '0'); } catch (e) { /* ignore */ }
}

// Call from the first real user gesture (click / keydown). Idempotent.
export function ensureStarted() {
  if (started) { resumeIfNeeded(); return; }
  started = true;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ctx.destination);
  } catch (e) { ctx = null; master = null; }
}

function resumeIfNeeded() {
  if (ctx && ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
}

export function isMuted() { return muted; }

export function setMuted(v) {
  muted = !!v;
  persist();
  if (master) master.gain.value = muted ? 0 : 1;
}

export function toggleMute() { setMuted(!muted); return muted; }

// One square-wave blip with a short percussive envelope.
function tone(freq, dur, when = 0, peak = 0.06, type = 'square') {
  if (!ctx || !master || muted) return;
  resumeIfNeeded();
  const t0 = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

// ---- The five named cues (PLAN.md §6 WP6) ---------------------------------
export function tick()       { tone(520, 0.035, 0, 0.035); }               // menu tick
export function bugFixed()   { tone(880, 0.045, 0, 0.05); tone(1320, 0.05, 0.035, 0.045); } // squash
export function eventSting() { tone(330, 0.09, 0, 0.06); tone(494, 0.10, 0.075, 0.055); tone(392, 0.13, 0.16, 0.05); }
export function pagerAlarm() { [0, 0.16, 0.32].forEach((t) => tone(1046, 0.09, t, 0.055)); tone(784, 0.16, 0.5, 0.05); } // the 2am page
export function monthStamp() { tone(196, 0.14, 0, 0.08); tone(147, 0.20, 0.06, 0.07); }      // ledger stamp
export function deathDirge() { [349, 294, 262, 196].forEach((f, i) => tone(f, 0.34, i * 0.30, 0.07)); }

export default {
  ensureStarted, isMuted, setMuted, toggleMute,
  tick, bugFixed, eventSting, monthStamp, deathDirge
};
