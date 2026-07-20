// hunt.js — THE HUNT (MOREFUN D7: Spot the Bug), replacing the whack-a-mole skin.
//
// A 45-second READING minigame that is a pure SKIN over the statistical
// resolution in src/sim/hunt.js. Boards of code panels come up one after
// another; at most one panel per board hides a genuinely flawed line, and you
// click the LINE. Wrong clicks waste ammo. Perception and knowledge, not
// reflexes.
//
// Atrophy is rendered as illegibility: huntParams.legibility (derived from
// hidden Debugging Understanding) sets how many panels you can even read — the
// rest are static. You are staring at your own system and cannot parse it.
//
// The skin contract is unchanged: it reads the sanctioned huntParams(state)
// projection (ammo, legibility, spawnBudget, provenance density) and writes
// back exactly one number — a clamped performance modifier in [-0.2, +0.2] —
// which the engine feeds to resolveManualHunt. Stats rule; reading nudges by
// at most 20%.
//
// Two phases, both rendered here:
//   'play'   — the interactive boards.
//   'result' — the deadpan exit line ("You fixed N bugs."), N being the
//              engine's statistical count, NOT the raw spotting tally.

const MODULES = [
  'auth', 'payments', 'cache', 'api', 'ui', 'db',
  'jobs', 'search', 'billing', 'notifications', 'reports', 'sync'
];

// Provenance buckets: buggy panels prefer names of UNREVIEWED modules.
const UNREVIEWED = new Set(['ai-raw', 'ai-hunt-regression', 'teammate']);

// Buggy snippets: four lines, ONE genuinely flawed. `flaw` is the line index;
// `kind` is the short diagnosis stamped on the panel when found. Keep lines
// under ~30 chars so they survive the narrow grid.
const BUGGY = [
  { kind: 'off-by-one', flaw: 2, lines: [
    'function sum(rows) {', '  let t = 0;', '  for (i=0; i<=rows.length; i++)', '    t += rows[i].amt;'] },
  { kind: 'assignment, not equality', flaw: 1, lines: [
    'function canWrite(u) {', '  if (u.role = "admin")', '    return true;', '  return acl.check(u);'] },
  { kind: 'missing await', flaw: 1, lines: [
    'async function load(id) {', '  const res = fetchUser(id);', '  return res.profile;', '}'] },
  { kind: 'swapped arguments', flaw: 2, lines: [
    '// transfer(from, to, amt)', 'function settle(inv) {', '  transfer(inv.payee,', '    inv.payer, inv.total);'] },
  { kind: 'lexicographic sort', flaw: 1, lines: [
    'function median(xs) {', '  xs.sort();', '  const m = xs.length >> 1;', '  return xs[m];'] },
  { kind: 'called, not passed', flaw: 2, lines: [
    'function debounce(fn) {', '  clearTimeout(t);', '  t = setTimeout(fn(), 250);', '}'] },
  { kind: 'precedence', flaw: 1, lines: [
    'function ttl(opts) {', '  if (opts.ttl || 0 > MAX)', '    throw new RangeError();', '  return opts.ttl ?? 3600;'] },
  { kind: 'undefined + number', flaw: 0, lines: [
    'let total;', 'for (const r of cart) {', '  total += r.price * r.qty;', '}'] },
  { kind: 'typo in the key', flaw: 2, lines: [
    'cache.set(userKey, user);', 'const hit =', '  cache.get(usrKey);', 'return hit ?? load(id);'] },
  { kind: 'mutating while iterating', flaw: 2, lines: [
    'for (const j of jobs) {', '  if (j.done)', '    jobs.splice(i, 1);', '}'] },
  { kind: 'getDay is the weekday', flaw: 2, lines: [
    '// bill on the 1st', 'const day =', '  new Date(ts).getDay();', 'if (day === 1) bill();'] },
  { kind: 'swallowed error', flaw: 3, lines: [
    'try {', '  await db.commit(tx);', '} catch (e) {', '  return true;'] }
];

// Clean decoys: four lines of plausible, correct code.
const CLEAN = [
  ['function retry(fn, n) {', '  if (n <= 0) throw last;', '  return fn()', '    .catch(() => retry(fn, n-1));'],
  ['const key = hash(req.url);', 'const hit = cache.get(key);', 'if (hit) return hit;', 'return fill(key, req);'],
  ['for (const row of rows) {', '  emit("row", row.id);', '  seen.add(row.id);', '}'],
  ['function clamp(x, lo, hi) {', '  if (x < lo) return lo;', '  if (x > hi) return hi;', '  return x;'],
  ['const q = jobs', '  .filter((j) => !j.done)', '  .sort((a, b) => a.at - b.at)', '  .slice(0, MAX_BATCH);'],
  ['async function save(doc) {', '  const tx = await db.begin();', '  await tx.put(doc);', '  return tx.commit();'],
  ['guard(user, "write");', 'audit.log(user.id, "write");', 'return store.update(id,', '  patch);'],
  ['if (queue.length > max) {', '  throttle(next, 250);', '  metrics.inc("backoff");', '}'],
  ['const cfg = {', '  ttl: env.TTL ?? 3600,', '  retries: 3,', '};'],
  ['function* pages(res) {', '  yield res.items;', '  if (res.next)', '    yield* pages(res.next);']
];

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function pipStr(filled, total) {
  filled = Math.max(0, Math.min(total, filled));
  return '▮'.repeat(filled) + '▯'.repeat(Math.max(0, total - filled));
}

// Static for a panel you can't parse. Deterministic-ish shapes, purely visual.
function garbledLines(seed) {
  const out = [];
  for (let i = 0; i < 4; i++) {
    const a = 3 + ((seed + i * 7) % 5);
    const b = 2 + ((seed * 3 + i) % 6);
    const c = 3 + ((seed + i * 11) % 4);
    out.push(`${'▒'.repeat(a)} ${'▒'.repeat(b)} ${'▒'.repeat(c)}`);
  }
  return out;
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
  const params = (c.app && c.app.huntParams) || { ammo: 0, spawnBudget: 0, density: {} };
  const ammo = Math.max(0, Math.floor(params.ammo || 0));

  // The grid starts empty; after() deals the first board and every one after it.
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
      <div class="dim small" style="flex:0 0 auto">One of these diffs may be wrong. Click the flawed <span class="hi">line</span>.</div>
      <div class="hunt-grid" style="--hunt-cols:${cols}"></div>
      <div class="hunt-foot">
        <span class="hunt-tally">Found: <b>0</b></span>
        <button class="row hunt-next" data-hunt-next="1"><span class="lab">Looks clean — next diff ▶</span></button>
        <button class="row hunt-leave" data-action="hunt-leave"><span class="lab">Leave</span></button>
      </div>
    </div>`;
}

function renderResult(c) {
  const { h, vs, huntResult } = c;
  const fixed = huntResult ? huntResult.fixed : 0;
  const tally = (c.app && c.app.huntTally) || {};
  const found = tally.found || 0;
  const presented = tally.presented || 0;
  const wrong = tally.wrong || 0;
  const unread = tally.unreadable || 0;
  return `
    <div class="screen center">
      ${h.strip(vs)}
      <div class="spacer"></div>
      <h2 class="sub">The Hunt</h2>
      <div class="card" style="max-width:460px;text-align:left">
        <div class="hi" style="font-size:1.25em">You fixed ${fixed} ${fixed === 1 ? 'bug' : 'bugs'}.</div>
        <div class="small dim" style="margin-top:6px">You spotted ${found} of the ${presented} flawed
        ${presented === 1 ? 'diff' : 'diffs'} that came up${wrong ? `, with ${wrong} false alarm${wrong === 1 ? '' : 's'}` : ''}.${
          unread ? ` ${unread} panel${unread === 1 ? '' : 's'} you couldn't parse at all.` : ''}
        What surfaces scales with your hidden Debugging Understanding; your review capacity capped what
        you could carry. What it doesn't say: how many were down there.</div>
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
  const spawnBudget = Math.max(0, params.spawnBudget || 0);
  const legibility = Math.max(0, Math.min(1, params.legibility ?? 0.8));
  const startAmmo = Math.max(0, Math.floor(params.ammo || 0));
  const cols = Number(root.dataset.cols) || 3;
  const panelCount = cols * 2;                       // 2x2 mobile, 3x2 desktop

  const grid = root.querySelector('.hunt-grid');
  const timerFill = root.querySelector('.hunt-timer-fill');
  const pipsEl = root.querySelector('.hunt-pips');
  const tallyEl = root.querySelector('.hunt-tally b');
  const nextBtn = root.querySelector('.hunt-next');

  // Hot fraction: how much of the pool lives in unreviewed modules (visual only).
  const density = params.density || {};
  let hotSum = 0, allSum = 0;
  for (const p of Object.keys(density)) {
    allSum += density[p];
    if (UNREVIEWED.has(p)) hotSum += density[p];
  }
  const hotFrac = allSum > 0 ? hotSum / allSum : 0.4;

  // session state
  let ammo = startAmmo;
  let found = 0;              // flawed lines correctly clicked
  let wrong = 0;              // false alarms (clean lines clicked)
  let presented = 0;          // boards WITH a bug shown so far
  let unreadable = 0;         // garbled panels dealt (for the exit line)
  let bugsDealt = 0;          // buggy panels dealt (vs spawnBudget)
  let board = null;           // { hasBug, bugPanel, flawLine, kind, solved }
  let boardLock = false;      // input freeze during the advance beat
  let elapsed = 0;
  let last = performance.now();
  let stopped = false;
  let raf = 0;

  const bugPool = shuffled(BUGGY);
  let bugCursor = 0;

  function shuffled(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function dealBoard() {
    if (!grid) return;
    boardLock = false;
    const hasBug = bugsDealt < spawnBudget;
    const garbledCount = Math.max(0, Math.min(panelCount - 1, Math.round((1 - legibility) * panelCount)));

    // slots: shuffle indexes; garbled take the tail, the bug takes a random
    // readable slot.
    const order = shuffled(Array.from({ length: panelCount }, (_, i) => i));
    const garbledSet = new Set(order.slice(0, garbledCount));
    const readable = order.slice(garbledCount);
    const bugSlot = hasBug ? readable[Math.floor(Math.random() * readable.length)] : -1;

    const snippet = hasBug ? bugPool[bugCursor++ % bugPool.length] : null;
    const cleanPool = shuffled(CLEAN);
    let cleanCursor = 0;
    const mods = shuffled(MODULES);

    const cells = [];
    for (let i = 0; i < panelCount; i++) {
      const module = mods[i % mods.length];
      if (garbledSet.has(i)) {
        const lines = garbledLines(i + bugsDealt * 7).map((l) => `<span class="hunt-cl">${l}</span>`).join('');
        cells.push(`<div class="hunt-panel garbled" title="You can't parse this one.">
          <span class="hunt-mod">▒▒▒▒▒▒.js</span>
          <div class="hunt-code" aria-label="Unreadable code">${lines}</div>
        </div>`);
        continue;
      }
      const isBug = i === bugSlot;
      const lines = isBug ? snippet.lines : cleanPool[cleanCursor++ % cleanPool.length];
      // the buggy diff tends to live in an unreviewed module
      const hot = isBug ? Math.random() < Math.max(0.5, hotFrac) : Math.random() < hotFrac * 0.4;
      const tag = hot
        ? `<span class="hunt-mod hot">${module} · unreviewed</span>`
        : `<span class="hunt-mod">${module}</span>`;
      const lineHtml = lines.map((l, li) =>
        `<button type="button" class="hunt-line" data-panel="${i}" data-line="${li}"
           aria-label="Line: ${escapeHtml(l.trim() || '(blank)')}">${escapeHtml(l)}</button>`).join('');
      cells.push(`<div class="hunt-panel" data-panel="${i}">
        ${tag}
        <div class="hunt-code">${lineHtml}</div>
      </div>`);
    }

    grid.innerHTML = cells.join('');
    unreadable += garbledCount;
    if (hasBug) {
      bugsDealt++;
      presented++;
      board = { hasBug, bugPanel: bugSlot, flawLine: snippet.flaw, kind: snippet.kind, solved: false };
    } else {
      board = { hasBug: false, bugPanel: -1, flawLine: -1, kind: '', solved: false };
    }
  }

  function advance(delayMs) {
    boardLock = true;
    const go = () => {
      if (stopped) return;
      // out of bugs to show and this board is done -> nothing left to find
      if (bugsDealt >= spawnBudget && (board == null || board.solved || !board.hasBug)) { finish(); return; }
      dealBoard();
    };
    if (typeof c.schedule === 'function') c.schedule(go, delayMs); else setTimeout(go, delayMs);
  }

  function onGridClick(e) {
    if (stopped || boardLock) return;
    const btn = e.target.closest('.hunt-line');
    if (!btn || !grid.contains(btn)) return;
    if (ammo <= 0) return;
    const panel = Number(btn.dataset.panel);
    const line = Number(btn.dataset.line);
    const isFlaw = board && board.hasBug && !board.solved
      && panel === board.bugPanel && line === board.flawLine;

    ammo--;
    if (isFlaw) {
      found++;
      board.solved = true;
      btn.classList.add('found');
      const panelEl = grid.querySelector(`.hunt-panel[data-panel="${panel}"]`);
      if (panelEl) {
        panelEl.classList.add('caught');
        const badge = document.createElement('span');
        badge.className = 'hunt-kind';
        badge.textContent = `✓ ${board.kind}`;
        panelEl.appendChild(badge);
      }
      if (audio.bugFixed) audio.bugFixed();
      updateHud();
      if (ammo <= 0) { finishSoon(650); return; }
      advance(reduce ? 250 : 650);
      return;
    }
    // false alarm: the line stays marked; the board stays up
    wrong++;
    btn.classList.add('wrong');
    btn.disabled = true;
    if (audio.tick) audio.tick();
    updateHud();
    if (ammo <= 0) finishSoon(500);
  }

  function onNext() {
    if (stopped || boardLock) return;
    advance(0);                      // an unfound bug simply escapes
  }

  function updateHud() {
    if (pipsEl) pipsEl.textContent = pipStr(ammo, startAmmo);
    if (tallyEl) tallyEl.textContent = String(found);
  }

  function frame(now) {
    if (stopped) return;
    if (!document.body.contains(root)) { stopped = true; return; }
    const dt = now - last; last = now;
    elapsed += dt;
    const timeLeft = Math.max(0, durationMs - elapsed);
    if (timerFill) timerFill.style.width = (100 * timeLeft / durationMs).toFixed(1) + '%';
    if (timeLeft <= 0) { finish(); return; }
    raf = requestAnimationFrame(frame);
  }

  function finishSoon(ms) {
    boardLock = true;
    if (typeof c.schedule === 'function') c.schedule(finish, ms); else setTimeout(finish, ms);
  }

  function finish() {
    if (stopped) return;
    stopped = true;
    if (raf) cancelAnimationFrame(raf);

    // Performance -> clamped modifier. Neutral is spotting HALF the flawed
    // diffs that came up: modifier 0. A clean sweep caps at +0.2, a blind
    // session at -0.2. The clamp is what keeps stats in charge.
    const hitRate = presented > 0 ? found / presented : 0.5;
    const modifier = clampMod((hitRate - 0.5) * 0.4);
    if (typeof c.onHuntDone === 'function') {
      c.onHuntDone({ found, presented, wrong, unreadable, modifier });
    }
  }

  // Expose a canceller (router cleanup, no resolve) and an early-finisher (the
  // "Leave" button — resolves with whatever was found so far).
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
  grid.addEventListener('click', onGridClick);
  if (nextBtn) nextBtn.addEventListener('click', onNext);
  dealBoard();
  raf = requestAnimationFrame(frame);
}

function clampMod(m) {
  return Math.max(-0.2, Math.min(0.2, m));
}
