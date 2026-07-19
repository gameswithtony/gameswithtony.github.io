// hunt.js — THE HUNT (WP6 whack-a-mole skin), replacing the WP5 placeholder.
//
// A 45-second twitch minigame that is a pure SKIN over the statistical resolution
// in src/sim/hunt.js. It NEVER touches sim state directly: it reads its pacing
// from the sanctioned huntParams(state) projection (spawn rate, window, ammo,
// provenance density) and writes back exactly one number — a clamped performance
// modifier in [-0.2, +0.2] — which the engine feeds to resolveManualHunt. Stats
// rule; twitch nudges by at most 20%.
//
// Two phases, both rendered here:
//   'play'   — the interactive grid of code panels with bugs on timed windows.
//   'result' — the deadpan exit line ("You fixed N bugs."), N being the engine's
//              statistical count, NOT the raw squash tally.
//
// prefers-reduced-motion: the 45s timer and the bug windows stay (they're the
// game), but shake/flash cosmetics drop. Playable by touch AND mouse: bugs are
// full <button>s, ≥44px, driven by click (which fires for both).

const MODULES = [
  'auth', 'payments', 'cache', 'api', 'ui', 'db',
  'jobs', 'search', 'billing', 'notifications', 'reports', 'sync'
];

// Provenance buckets: bugs cluster in panels named after UNREVIEWED modules.
const UNREVIEWED = new Set(['ai-raw', 'ai-hunt-regression', 'teammate']);

const CODE_LINES = [
  'function retry(req){', '  if (!ctx.valid) return;', '  const t = tokens.pop();',
  'await db.commit(tx)', 'cache.set(key, val, ttl)', 'for (const row of rows) {',
  '  emit("done", row.id)', 'return memo[hash] ?? calc()', 'if (queue.length > max)',
  '  throttle(next, 250)', 'const res = model.run(p)', 'catch (e) { log.warn(e) }',
  'state = reduce(state, a)', '  flush(buffer); buffer=[]', 'guard(user, "write")',
  '} // TODO: verify path', 'schedule(job, cron)', '  return early(false)'
];

// A chunky cartoon ladybug (SVG group), sized to fill its button.
function bugSvg() {
  return `<svg viewBox="0 0 40 40" aria-hidden="true" focusable="false">
    <line x1="9"  y1="16" x2="2"  y2="12" stroke="var(--ink)" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="9"  y1="24" x2="2"  y2="26" stroke="var(--ink)" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="31" y1="16" x2="38" y2="12" stroke="var(--ink)" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="31" y1="24" x2="38" y2="26" stroke="var(--ink)" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="16" y1="5"  x2="13" y2="1"  stroke="var(--ink)" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="24" y1="5"  x2="27" y2="1"  stroke="var(--ink)" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="13" cy="1" r="1.6" fill="var(--ink)"/>
    <circle cx="27" cy="1" r="1.6" fill="var(--ink)"/>
    <ellipse cx="20" cy="22" rx="11" ry="13" fill="var(--coral)" stroke="var(--ink)" stroke-width="2.5"/>
    <line x1="20" y1="10" x2="20" y2="34" stroke="var(--ink)" stroke-width="2.5"/>
    <circle cx="20" cy="10" r="5.5" fill="var(--ink)"/>
    <circle cx="18" cy="9" r="1.1" fill="#ffffff"/>
    <circle cx="22" cy="9" r="1.1" fill="#ffffff"/>
    <circle cx="15" cy="19" r="2" fill="var(--ink)"/>
    <circle cx="25" cy="19" r="2" fill="var(--ink)"/>
    <circle cx="17" cy="28" r="2" fill="var(--ink)"/>
    <circle cx="23" cy="28" r="2" fill="var(--ink)"/>
  </svg>`;
}

// Build the panel descriptors: N panels, some flagged "hot" (unreviewed) so bugs
// cluster there. Deterministic layout from the density map (visual only).
function buildPanels(params, n) {
  const density = params.density || {};
  let unreviewed = 0, total = 0;
  for (const p of Object.keys(density)) {
    total += density[p];
    if (UNREVIEWED.has(p)) unreviewed += density[p];
  }
  const frac = total > 0 ? unreviewed / total : 0.4;
  const hotCount = Math.max(1, Math.min(n - 1, Math.round(frac * n)));
  const panels = [];
  for (let i = 0; i < n; i++) {
    const hot = i < hotCount;                     // first `hotCount` panels are hot
    panels.push({ idx: i, module: MODULES[i % MODULES.length], hot });
  }
  return panels;
}

function panelHtml(p) {
  const lines = [];
  const start = (p.idx * 3) % CODE_LINES.length;
  for (let i = 0; i < 4; i++) lines.push(CODE_LINES[(start + i) % CODE_LINES.length]);
  const tag = p.hot
    ? `<span class="hunt-mod hot">${p.module} · unreviewed</span>`
    : `<span class="hunt-mod">${p.module}</span>`;
  const code = lines.map((l) => `<span class="hunt-cl">${escapeHtml(l)}</span>`).join('');
  return `<div class="hunt-panel" data-panel="${p.idx}" data-hot="${p.hot ? 1 : 0}">
    ${tag}
    <div class="hunt-code">${code}</div>
    <div class="hunt-slot"></div>
  </div>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ---------------------------------------------------------------------------
// render
// ---------------------------------------------------------------------------
export function render(c) {
  const phase = (c.app && c.app.huntPhase) || 'play';
  const { h, vs } = c;
  if (phase === 'result') return renderResult(c);

  const narrow = typeof window !== 'undefined' && window.innerWidth < 620;
  const cols = narrow ? 2 : 3;
  const n = cols * 3;                              // 2x3 mobile, 3x3 desktop
  const params = (c.app && c.app.huntParams) || { ammo: 0, spawnBudget: 0, density: {} };
  const panels = buildPanels(params, n).map(panelHtml).join('');
  const ammo = Math.max(0, Math.floor(params.ammo || 0));

  return `
    <div class="screen hunt" data-cols="${cols}">
      ${h.strip(vs)}
      <div class="hunt-hud">
        <div class="hunt-ammo" aria-label="Ammo remaining">
          <span class="lbl">AMMO</span> <span class="hunt-pips">${pipStr(ammo, ammo)}</span>
        </div>
        <div class="hunt-timer" aria-label="Time remaining">
          <div class="hunt-timer-fill"></div>
        </div>
      </div>
      <div class="hunt-grid" style="--hunt-cols:${cols}">${panels}</div>
      <div class="hunt-foot">
        <span class="hunt-tally">Squashed: <b>0</b></span>
        <button class="row hunt-leave" data-action="hunt-leave"><span class="lab">Leave the hunt</span></button>
      </div>
    </div>`;
}

function pipStr(filled, total) {
  filled = Math.max(0, Math.min(total, filled));
  return '▮'.repeat(filled) + '▯'.repeat(Math.max(0, total - filled));
}

function renderResult(c) {
  const { h, vs, huntResult } = c;
  const fixed = huntResult ? huntResult.fixed : 0;
  const tally = (c.app && c.app.huntTally) || {};
  const squashed = tally.squashed || 0;
  return `
    <div class="screen center">
      ${h.strip(vs)}
      <div class="spacer"></div>
      <h2 class="sub">The Hunt</h2>
      <div class="card" style="max-width:460px;text-align:left">
        <div class="hi" style="font-size:1.25em">You fixed ${fixed} ${fixed === 1 ? 'bug' : 'bugs'}.</div>
        <div class="small dim" style="margin-top:6px">You swung at ${squashed}. What surfaces scales with
        your hidden Debugging Understanding; your review capacity capped what you could carry. What it
        doesn't say: how many were down there.</div>
      </div>
      <div class="spacer"></div>
      <div class="menu" style="width:100%;max-width:420px">
        ${h.row({ key: 'enter', label: '▶ Continue', attrs: 'data-action="hunt-continue"' })}
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// after: wire the live minigame (the ONLY rAF loop in the app, PLAN.md §2)
// ---------------------------------------------------------------------------
export function after(c) {
  const phase = (c.app && c.app.huntPhase) || 'play';
  if (phase !== 'play') return;
  if (typeof document === 'undefined' || typeof requestAnimationFrame === 'undefined') return;

  const root = document.querySelector('#stage .hunt');
  if (!root) return;

  const params = (c.app && c.app.huntParams) || {};
  const audio = c.audio || {};
  const reduce = typeof window !== 'undefined' && window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const durationMs = params.durationMs || 45000;
  const windowMs = params.windowMs || 1200;
  const spawnEveryMs = params.spawnEveryMs || 900;
  const spawnBudget = Math.max(0, params.spawnBudget || 0);
  const startAmmo = Math.max(0, Math.floor(params.ammo || 0));

  const panelEls = Array.from(root.querySelectorAll('.hunt-panel'));
  const timerFill = root.querySelector('.hunt-timer-fill');
  const pipsEl = root.querySelector('.hunt-pips');
  const tallyEl = root.querySelector('.hunt-tally b');

  // live state
  let ammo = startAmmo;
  let squashed = 0;
  let spawnedTotal = 0;
  let catchable = 0;              // bugs that appeared while ammo remained
  const active = new Map();       // panelIdx -> { el, born }
  let elapsed = 0;
  let spawnAcc = 0;
  let last = performance.now();
  let stopped = false;
  let raf = 0;

  // Spawn-weight: hot (unreviewed) panels draw 3x the bugs.
  const weights = panelEls.map((el) => (el.dataset.hot === '1' ? 3 : 1));

  function pickPanel() {
    const free = [];
    let sum = 0;
    for (let i = 0; i < panelEls.length; i++) {
      if (!active.has(i)) { free.push(i); sum += weights[i]; }
    }
    if (!free.length) return -1;
    let r = Math.random() * sum;
    for (const i of free) { r -= weights[i]; if (r <= 0) return i; }
    return free[free.length - 1];
  }

  function spawnBug() {
    const idx = pickPanel();
    if (idx < 0) return;
    const slot = panelEls[idx].querySelector('.hunt-slot');
    if (!slot) return;
    const btn = document.createElement('button');
    btn.className = 'hunt-bug' + (reduce ? '' : ' pop');
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Fix bug');
    btn.innerHTML = bugSvg();
    btn.addEventListener('click', (e) => { e.preventDefault(); squash(idx, btn); });
    slot.appendChild(btn);
    active.set(idx, { el: btn, born: performance.now() });
    spawnedTotal++;
    if (ammo > 0) catchable++;   // only count bugs you had ammo to catch
  }

  function squash(idx, btn) {
    if (stopped) return;
    const rec = active.get(idx);
    if (!rec || rec.el !== btn) return;
    if (ammo <= 0) return;                 // out of capacity: can't fix more
    ammo--;
    squashed++;
    active.delete(idx);
    if (audio.bugFixed) audio.bugFixed();
    if (reduce) { btn.remove(); }
    else {
      btn.classList.add('squashed');
      const b = btn;
      setTimeout(() => { if (b.parentNode) b.remove(); }, 140);
      panelEls[idx].classList.add('flash');
      const p = panelEls[idx];
      setTimeout(() => p.classList.remove('flash'), 160);
    }
    updateHud();
    if (ammo <= 0) finish();               // capacity spent -> hunt's over
  }

  function expireBugs(now) {
    for (const [idx, rec] of active) {
      if (now - rec.born >= windowMs) {
        if (rec.el.parentNode) rec.el.remove();
        active.delete(idx);                // escaped: a catchable miss
      }
    }
  }

  function updateHud() {
    if (pipsEl) pipsEl.textContent = pipStr(ammo, startAmmo);
    if (tallyEl) tallyEl.textContent = String(squashed);
  }

  function frame(now) {
    if (stopped) return;
    if (!document.body.contains(root)) { stopped = true; return; }
    const dt = now - last; last = now;
    elapsed += dt;
    const timeLeft = Math.max(0, durationMs - elapsed);
    if (timerFill) timerFill.style.width = (100 * timeLeft / durationMs).toFixed(1) + '%';

    expireBugs(now);

    spawnAcc += dt;
    if (spawnAcc >= spawnEveryMs) {
      spawnAcc = 0;
      if (spawnedTotal < spawnBudget && ammo > 0) spawnBug();
    }

    const budgetDone = spawnedTotal >= spawnBudget && active.size === 0;
    if (timeLeft <= 0 || budgetDone || (ammo <= 0 && active.size === 0)) { finish(); return; }
    raf = requestAnimationFrame(frame);
  }

  function finish() {
    if (stopped) return;
    stopped = true;
    if (raf) cancelAnimationFrame(raf);
    for (const [, rec] of active) if (rec.el.parentNode) rec.el.remove();
    active.clear();

    // Performance -> clamped modifier. Neutral hit-rate is 50%: catching half the
    // bugs you had ammo for is "as statistically expected" (modifier 0); flawless
    // play caps at +0.2, whiffing at -0.2. The clamp is what keeps stats in charge.
    const hitRate = catchable > 0 ? squashed / catchable : 0.5;
    const modifier = clampMod((hitRate - 0.5) * 0.4);
    if (typeof c.onHuntDone === 'function') {
      c.onHuntDone({ squashed, spawned: spawnedTotal, catchable, modifier });
    }
  }

  // Expose a canceller (router cleanup, no resolve) and an early-finisher (the
  // "Leave the hunt" button — resolves with whatever was squashed so far).
  if (c.app) {
    c.app.huntStop = () => { stopped = true; if (raf) cancelAnimationFrame(raf); };
    c.app.huntFinishNow = finish;
  }

  updateHud();
  if (startAmmo <= 0 || spawnBudget <= 0) {
    // Nothing to hunt (no ammo, or a clean pool): resolve neutrally (modifier 0),
    // deferred one tick so this render finishes before the result screen renders.
    const done = () => finish();
    if (typeof c.schedule === 'function') c.schedule(done, 0); else setTimeout(done, 0);
    return;
  }
  raf = requestAnimationFrame(frame);
}

function clampMod(m) {
  return Math.max(-0.2, Math.min(0.2, m));
}
