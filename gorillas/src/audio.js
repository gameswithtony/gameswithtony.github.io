// Event-driven sound (PLAN.md §1.1 — the one external-asset exception).
// Imported by main.js only; the simulation never knows audio exists.
// Everything is best-effort: if loading or playback fails, the game plays
// identically, silently. No loading state — decode happens after the first
// user gesture, which browsers require for audio anyway.

const FILES = {
  throw: 'sounds/throw-banana.mp3',
  building: 'sounds/hit-building.mp3',
  gorilla: 'sounds/hit-gorilla.mp3',
  dance: 'sounds/chest-thump.mp3',
  intro: 'sounds/intro-music.mp3',
};

let actx = null;
let buffers = {};
let muted = false;
let unlocked = false;
let musicSource = null;
let musicWanted = false;

export function setMuted(m) {
  muted = m;
  if (muted) stopMusic();
  else if (musicWanted) startMusicNow();
}

export function isMuted() {
  return muted;
}

export async function unlock() {
  if (unlocked) return;
  unlocked = true;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    actx = new Ctx();
    if (actx.state === 'suspended') await actx.resume().catch(() => {});
    await Promise.all(Object.entries(FILES).map(async ([name, url]) => {
      try {
        const res = await fetch(url);
        const data = await res.arrayBuffer();
        buffers[name] = await actx.decodeAudioData(data);
      } catch {
        /* missing or undecodable file — play on without it */
      }
    }));
    if (musicWanted && !muted) startMusicNow();
  } catch {
    actx = null;
  }
}

export function play(name, volume = 1) {
  if (muted || !actx || !buffers[name]) return;
  try {
    const src = actx.createBufferSource();
    src.buffer = buffers[name];
    const gain = actx.createGain();
    gain.gain.value = volume;
    src.connect(gain).connect(actx.destination);
    src.start();
  } catch {
    /* best effort */
  }
}

function startMusicNow() {
  if (musicSource || !actx || !buffers.intro || muted) return;
  try {
    const src = actx.createBufferSource();
    src.buffer = buffers.intro;   // plays once — no loop
    const gain = actx.createGain();
    gain.gain.value = 0.4;
    src.connect(gain).connect(actx.destination);
    src.onended = () => { if (musicSource === src) musicSource = null; };
    src.start();
    musicSource = src;
  } catch {
    musicSource = null;
  }
}

export function music(on) {
  musicWanted = on;
  if (on) startMusicNow();
  else stopMusic();
}

function stopMusic() {
  if (musicSource) {
    try { musicSource.stop(); } catch { /* already stopped */ }
    musicSource = null;
  }
}
