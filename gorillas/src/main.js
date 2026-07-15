// Bootstrap, RAF loop, wiring (SPEC §2.4). The only module that touches
// everything. Owns the fixed-step accumulator (Invariant 4), the DOM
// overlays, and the per-mode camera targeting — the simulation itself never
// reads the camera.

import * as C from './config.js';
import * as game from './game.js';
import * as camera from './camera.js';
import * as render from './render.js';
import * as input from './input.js';
import * as audio from './audio.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game');

// ------------------------------------------------------------ persistence --
// The game must run correctly with storage entirely unavailable (§15).

function loadStored() {
  try {
    return JSON.parse(localStorage.getItem('gorillas.v1')) || {};
  } catch {
    return {};
  }
}
function saveStored(patch) {
  try {
    localStorage.setItem('gorillas.v1', JSON.stringify({ ...loadStored(), ...patch }));
  } catch {
    /* private mode etc. — carry on */
  }
}

// ------------------------------------------------------------------ setup --

const stored = loadStored();
let pendingAi = false;
let paused = false;
const ui = { drag: null };

function readSetupForm() {
  const p1 = ($('f-p1').value || 'Player 1').slice(0, 10);
  const p2 = pendingAi
    ? 'The Machine'
    : ($('f-p2').value || 'Player 2').slice(0, 10);
  return {
    names: [p1, p2],
    ai: pendingAi,
    difficulty: $('f-diff').value,
    playTo: parseInt($('f-playto').value, 10),
    gravity: parseInt($('f-gravity').value, 10),
    windMode: $('f-wind').value,
  };
}

function showScreen(id) {
  for (const s of ['menu', 'setup', 'pause']) {
    $(s).classList.toggle('hidden', s !== id);
  }
}

function openSetup(aiMode) {
  pendingAi = aiMode;
  $('row-p2').classList.toggle('hidden', aiMode);
  $('row-diff').classList.toggle('hidden', !aiMode);
  $('setup-title').textContent = aiMode ? '1 PLAYER · VS THE MACHINE' : '2 PLAYERS · HOTSEAT';
  showScreen('setup');
}

function startMatch() {
  const settings = readSetupForm();
  saveStored({
    p1: settings.names[0],
    p2: pendingAi ? (stored.p2 || 'Player 2') : settings.names[1],
    difficulty: settings.difficulty,
    playTo: settings.playTo,
    gravity: settings.gravity,
    windMode: settings.windMode,
  });
  showScreen(null);
  hideBanner();
  audio.music(false);
  game.newMatch(settings);   // camera snaps on the roundStart event
}

function quitToMenu() {
  paused = false;
  showScreen('menu');
  hideBanner();
  $('aim').classList.add('hidden');
  audio.music(true);
  game.toMenu();
}

// ------------------------------------------------------------------ banner --

function showBanner(title, sub, withButtons) {
  $('banner').classList.remove('hidden');
  $('banner-title').textContent = title;
  $('banner-sub').textContent = sub || '';
  $('banner-buttons').classList.toggle('hidden', !withButtons);
}
function hideBanner() {
  $('banner').classList.add('hidden');
}

// --------------------------------------------------------------- aim panel --

function syncAimFields() {
  const st = game.getState();
  const aim = st.aim[st.turn];
  $('f-angle').value = Math.round(aim.angle);
  $('f-power').value = Math.round(aim.power);
}

function readAimFields() {
  // Mid-edit a field can be empty/invalid — hold the current aim rather than
  // snapping the arrow to a default.
  const st = game.getState();
  const cur = st.aim[st.turn];
  const angle = parseFloat($('f-angle').value);
  const power = parseFloat($('f-power').value);
  return {
    angle: Number.isFinite(angle) ? angle : cur.angle,
    power: Number.isFinite(power) ? power : cur.power,
  };
}

function applyAimFields() {
  if (!game.isHumanTurn()) return;
  const { angle, power } = readAimFields();
  game.setAim(game.activeIdx(), angle, power);
}

function fireCurrent() {
  if (!game.isHumanTurn()) return;
  applyAimFields();
  const st = game.getState();
  const aim = st.aim[st.turn];
  game.submitAim(aim.angle, aim.power);
}

// -------------------------------------------------------------- mode → DOM --

let lastMode = null;
let lastAimKey = '';

function syncUiToMode() {
  const st = game.getState();
  const aimKey = `${st.mode}:${st.turn}:${st.round}`;
  if (st.mode === lastMode && aimKey === lastAimKey) return;
  lastMode = st.mode;
  lastAimKey = aimKey;

  const humanAiming = st.mode === 'AIM' && st.players.length === 2 && !st.players[st.turn].isAI;
  $('aim').classList.toggle('hidden', !humanAiming);
  if (humanAiming) {
    $('aim').classList.toggle('side-right', st.turn === 1);
    $('aim-name').textContent = `${st.players[st.turn].name} ▶`;
    syncAimFields();
  }

  switch (st.mode) {
    case 'ROUND_INTRO':
      showBanner(`ROUND ${st.round}`, st.round === 1 ? 'go bananas' : 'fresh city · old grudge');
      break;
    case 'AIM':
    case 'FLIGHT':
    case 'RESOLVE':
    case 'MENU':
      hideBanner();
      break;
    default:
      break;
  }
}

function handleGameEvent(ev) {
  render.handleEvent(ev);
  const st = game.getState();
  switch (ev.type) {
    case 'roundStart':
      // New world every round — cut straight to its default framing rather
      // than panning from wherever the old city left the camera.
      if (st.players.length === 2) {
        camera.snap({
          mode: 'default',
          centerX: (st.players[0].x + st.players[1].x) / 2,
        });
      }
      break;
    case 'throw':
      audio.play('throw');
      break;
    case 'explode':
      audio.play('building');
      break;
    case 'gorillaHit':
      audio.play('gorilla');
      break;
    case 'roundEnd': {
      const w = st.players[ev.winner];
      showBanner(
        ev.selfHit ? 'SELF DESTRUCT!' : `${w.name.toUpperCase()} SCORES!`,
        ev.selfHit ? `the point goes to ${w.name}` : `${st.players[0].score} — ${st.players[1].score}`,
      );
      setTimeout(() => audio.play('dance'), 500);
      break;
    }
    case 'matchEnd': {
      const w = st.players[ev.winner];
      const wins = Array.isArray(stored.wins) ? stored.wins : [0, 0];
      wins[ev.winner]++;
      saveStored({ wins });
      showBanner(
        `${w.name.toUpperCase()} WINS THE MATCH!`,
        `${st.players[0].score} — ${st.players[1].score} · the city lies in ruins`,
        true,
      );
      setTimeout(() => audio.play('dance'), 500);
      break;
    }
    default:
      break;
  }
}

// ----------------------------------------------------------------- camera --

function cameraTarget(st, alpha, now) {
  if (st.mode === 'MENU') {
    // attract mode: drift across the skyline
    const cx = C.WORLD_W / 2 +
      Math.sin(now / 9000) * (C.WORLD_W / 2 - C.ARENA_W / 2 - 40);
    return { mode: 'default', centerX: cx };
  }
  if (st.mode === 'GAME_OVER') return { mode: 'full' };
  if (st.mode === 'FLIGHT' && st.banana) {
    const b = st.banana;
    if (b.escaped && b.boomerang) return { mode: 'full' };
    const bx = b.prev.x + (b.cur.x - b.prev.x) * alpha;
    const by = b.prev.y + (b.cur.y - b.prev.y) * alpha;
    const points = [
      { x: bx, y: by },
      { x: bx + b.vx * C.CAM_LOOKAHEAD, y: by + b.vy * C.CAM_LOOKAHEAD },
    ];
    for (const p of st.players) {
      points.push({ x: p.x - C.GORILLA_W / 2, y: p.feetY - C.GORILLA_H });
      points.push({ x: p.x + C.GORILLA_W / 2, y: p.feetY });
    }
    return { mode: 'points', points };
  }
  if (st.players.length === 2) {
    return {
      mode: 'default',
      centerX: (st.players[0].x + st.players[1].x) / 2,
    };
  }
  return { mode: 'default', centerX: C.WORLD_W / 2 };
}

// ------------------------------------------------------------------- loop --

let last = performance.now();
let acc = 0;

function frame(now) {
  const dtReal = Math.min((now - last) / 1000, 0.25);
  last = now;

  if (!paused) {
    acc += dtReal;
    while (acc >= C.DT) {
      game.tick(C.DT);
      acc -= C.DT;
    }
  }
  const alpha = acc / C.DT;

  for (const ev of game.drainEvents()) handleGameEvent(ev);
  syncUiToMode();

  const st = game.getState();
  camera.update(dtReal, cameraTarget(st, alpha, now));
  render.draw(st, ui, alpha, dtReal);

  requestAnimationFrame(frame);
}

// ----------------------------------------------------------------- resize --
// Backing store = CSS size × devicePixelRatio. Affects sharpness only —
// never what is visible (§9.1).

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = Math.max(1, Math.round(w * dpr));
  canvas.height = Math.max(1, Math.round(h * dpr));
  camera.setViewport(w, h, dpr);
}

// ------------------------------------------------------------------- wire --

function wireDom() {
  $('btn-1p').addEventListener('click', () => openSetup(true));
  $('btn-2p').addEventListener('click', () => openSetup(false));
  $('btn-back').addEventListener('click', () => showScreen('menu'));
  $('btn-start').addEventListener('click', startMatch);
  $('btn-again').addEventListener('click', () => { hideBanner(); game.rematch(); });
  $('btn-menu').addEventListener('click', quitToMenu);
  $('btn-resume').addEventListener('click', () => { paused = false; showScreen(null); });
  $('btn-quit').addEventListener('click', quitToMenu);
  $('btn-throw').addEventListener('click', fireCurrent);

  // 'input' fires per keystroke/spinner click so the aim arrow tracks the
  // fields live; 'change' still commits the clamped value on blur.
  for (const id of ['f-angle', 'f-power']) {
    $(id).addEventListener('input', applyAimFields);
    $(id).addEventListener('change', applyAimFields);
  }
  $('f-angle').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('f-power').focus();
  });
  $('f-power').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') fireCurrent();
  });

  const muteBtn = $('mute');
  const applyMute = () => { muteBtn.textContent = audio.isMuted() ? '🔇' : '🔊'; };
  muteBtn.addEventListener('click', () => {
    audio.setMuted(!audio.isMuted());
    saveStored({ muted: audio.isMuted() });
    applyMute();
  });
  audio.setMuted(!!stored.muted);
  applyMute();

  window.addEventListener('keydown', (e) => {
    if (e.key === 'm' || e.key === 'M') {
      const tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'BUTTON') return;
      muteBtn.click();
    }
    if (e.key === 'Escape') {
      const mode = game.getState().mode;
      if (mode === 'MENU') return;
      paused = !paused;
      showScreen(paused ? 'pause' : null);
    }
  });

  // Audio can only start after a user gesture; unlock once, on the first.
  const unlockOnce = () => {
    audio.unlock();
    window.removeEventListener('pointerdown', unlockOnce);
    window.removeEventListener('keydown', unlockOnce);
  };
  window.addEventListener('pointerdown', unlockOnce);
  window.addEventListener('keydown', unlockOnce);

  // setup defaults from storage
  $('f-p1').value = stored.p1 || 'Player 1';
  $('f-p2').value = stored.p2 || 'Player 2';
  if (stored.difficulty) $('f-diff').value = stored.difficulty;
  if (stored.playTo) $('f-playto').value = String(stored.playTo);
  if (stored.gravity) $('f-gravity').value = String(stored.gravity);
  if (stored.windMode) $('f-wind').value = stored.windMode;
}

function wireInput() {
  input.init(canvas, {
    canAim: () => !paused && game.isHumanTurn(),
    activeGorilla: () => {
      const st = game.getState();
      if (st.players.length < 2) return null;
      const p = st.players[st.turn];
      return { x: p.x, feetY: p.feetY, facing: p.facing };
    },
    onDrag: (aim) => {
      ui.drag = aim ? { angle: aim.angle, power: aim.power } : null;
      if (aim) {
        game.setAim(game.activeIdx(), Math.round(aim.angle), Math.round(aim.power));
        syncAimFields();
      }
    },
    onFire: (angle, power) => {
      game.submitAim(Math.round(angle), Math.round(power));
    },
    onNudge: (dA, dP) => {
      const st = game.getState();
      const aim = st.aim[st.turn];
      game.setAim(st.turn, aim.angle + dA, aim.power + dP);
      syncAimFields();
    },
    onFireCurrent: fireCurrent,
  });
}

// ------------------------------------------------------------------- boot --

render.init(canvas);
resize();
new ResizeObserver(resize).observe(canvas);
wireDom();
wireInput();
game.toMenu();
for (const ev of game.drainEvents()) handleGameEvent(ev);
showScreen('menu');
audio.music(true);   // starts once audio is unlocked by the first gesture
camera.snap({ mode: 'default', centerX: C.WORLD_W / 2 });
requestAnimationFrame((t) => { last = t; requestAnimationFrame(frame); });
