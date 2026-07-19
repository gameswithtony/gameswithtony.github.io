// gameover.js — GAME OVER / POSTMORTEM.
//
// This is one of the two sanctioned places that read hidden state (PLAN.md §1:
// "the ending is always a mirror"): the postmortem chart plots Confidence vs.
// true Understanding, and the score sums hidden Understanding. Everything else
// in the game keeps Understanding dark.
//
//  - Deaths (and deck-authored endRun causes): a LinkedUp parody post — original
//    wordmark, class-portrait avatar, name + title, "Month N" timestamp, a body
//    that types itself in, a clinical deadpan cause line, a small reactions row.
//    Copy comes from data/linkedup.js (WP2, authored concurrently); this screen
//    loads it defensively and falls back to built-in copy if it is absent or
//    shaped differently.
//  - Qualified: the win card. Impostor: the horror-deadpan card.
//  - Every ending then gets the postmortem chart, the score, and the Top Ten.

import { config } from '../../config.js';

const SKILLS = ['coding', 'debugging', 'judgment'];
const CLASS_AVATAR = { vibe: '🧑‍💻', bootcamp: '🎓', greybeard: '🧔', craftsperson: '🛠️' };

// ---- LinkedUp copy (defensive load) --------------------------------------
let LU = null;            // resolved data/linkedup.js module, or null
let LU_TRIED = false;
async function loadLinkedup() {
  if (LU_TRIED) return LU;
  LU_TRIED = true;
  try { LU = await import('../data/linkedup.js'); } catch (e) { LU = null; }
  return LU;
}

const FALLBACK_POSTS = {
  bankruptcy: { body: "Thrilled to share I'm exploring new opportunities after an incredible journey building the impossible on an unforgiving timeline!", cause: 'Cause: the money ran out.' },
  burnout: { body: "Grateful for the lessons, the late nights, and the friends I made along the way. Time to prioritize what matters. 🙏", cause: 'Cause: burnout. You were the load-bearing wall.' },
  fired: { body: "Every ending is a new beginning. Proud of the work, and excited for whatever comes next!", cause: 'Cause: the client stopped believing.' },
  impostor: { body: "Delighted to announce the contract renewed! The system runs beautifully. I could not tell you how.", cause: 'Cause: cognitive surrender.' },
  default: { body: "Thrilled to share I'm exploring new opportunities. Open to work!", cause: 'Cause: shipped to production.' }
};

// Pull { body, cause } for a cause from whatever shape linkedup.js exports.
function resolvePost(mod, cause) {
  const fb = FALLBACK_POSTS[cause] || FALLBACK_POSTS.default;
  if (!mod) return fb;
  const src = mod.linkedup || mod.posts || mod.default || mod;
  let entry = null;
  try {
    if (typeof mod.getPost === 'function') entry = mod.getPost(cause);
    else if (typeof src === 'function') entry = src(cause);
    else if (src && typeof src === 'object') entry = src[cause] || src.default;
  } catch (e) { entry = null; }
  if (!entry) return fb;
  if (typeof entry === 'string') return { body: entry, cause: fb.cause };
  return {
    body: entry.body || entry.post || entry.text || fb.body,
    cause: entry.cause || entry.causeLine || entry.reason || fb.cause
  };
}

// ---- Score ----------------------------------------------------------------
function calibration(gs) {
  const gap = SKILLS.reduce((a, k) => a + Math.abs(gs.skills[k].conf - gs.skills[k].und), 0) / SKILLS.length;
  return Math.round(100 - gap);
}
function retained(gs) {
  return ['junior', 'qa', 'senior'].filter((r) => gs.team[r]).length;
}
export function computeScore(gs) {
  const S = config.scoring;
  const hiddenUnd = SKILLS.reduce((a, k) => a + gs.skills[k].und, 0);
  const calBonus = calibration(gs);
  const endingBonus = (S.endingBonus && S.endingBonus[gs.ending]) || 0;
  const raw = gs.money / S.moneyDivisor
    + hiddenUnd
    + S.teamRetainedBonus * retained(gs)
    + calBonus
    + gs.client / S.clientDivisor
    + endingBonus;
  const mult = (gs.class && gs.class.multiplier) || 1;
  return { score: Math.max(0, Math.round(raw * mult)), title: endingTitle(gs), calBonus, hiddenUnd };
}

function endingTitle(gs) {
  const avgUnd = SKILLS.reduce((a, k) => a + gs.skills[k].und, 0) / SKILLS.length;
  switch (gs.ending) {
    case 'qualified': return 'The Qualified Human';
    case 'impostor': return 'The Impostor';
    case 'bankruptcy': return avgUnd >= 60 ? 'The Purist' : 'Bankruptcy';
    case 'burnout': return 'Burnout';
    case 'fired': return 'Fired';
    default: return String(gs.ending || 'The End').replace(/[-_]/g, ' ');
  }
}

// ---- Postmortem chart -----------------------------------------------------
function chart(gs, h) {
  const W = 320, Hh = 150, pad = 22;
  const months = config.months;
  const x = (m) => pad + (m - 1) / Math.max(1, months - 1) * (W - 2 * pad);
  const y = (v) => Hh - pad - (Math.max(0, Math.min(100, v)) / 100) * (Hh - 2 * pad);

  // history holds averaged conf/und per month; append the final (ending) point
  const pts = gs.history.map((s) => ({ m: s.month, conf: s.conf, und: s.und, client: s.client }));
  const finalConf = SKILLS.reduce((a, k) => a + gs.skills[k].conf, 0) / SKILLS.length;
  const finalUnd = SKILLS.reduce((a, k) => a + gs.skills[k].und, 0) / SKILLS.length;
  pts.push({ m: gs.month, conf: Math.round(finalConf * 10) / 10, und: Math.round(finalUnd * 10) / 10, client: gs.client });

  const path = (key) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.m).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ');
  // gap shading between conf and und
  const gapPts = pts.map((p) => `${x(p.m).toFixed(1)},${y(p.conf).toFixed(1)}`)
    .concat(pts.slice().reverse().map((p) => `${x(p.m).toFixed(1)},${y(p.und).toFixed(1)}`)).join(' ');
  const lostX = x(gs.month).toFixed(1);

  return `
    <div class="chart">
      <svg viewBox="0 0 ${W} ${Hh}" role="img" aria-label="Confidence versus Understanding across the year">
        <line x1="${pad}" y1="${Hh - pad}" x2="${W - pad}" y2="${Hh - pad}" stroke="var(--dim)" stroke-width="1"/>
        <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${Hh - pad}" stroke="var(--dim)" stroke-width="1"/>
        <polygon points="${gapPts}" fill="var(--ega-brown)" fill-opacity="0.28"/>
        <path d="${path('client')}" fill="none" stroke="var(--ega-brightmagenta)" stroke-width="1.5" stroke-dasharray="3 2"/>
        <path d="${path('und')}" fill="none" stroke="var(--warn)" stroke-width="2"/>
        <path d="${path('conf')}" fill="none" stroke="var(--accent)" stroke-width="2"/>
        <line x1="${lostX}" y1="${pad}" x2="${lostX}" y2="${Hh - pad}" stroke="var(--gold)" stroke-width="1.5" stroke-dasharray="2 2"/>
        <text x="${lostX}" y="${pad - 6}" font-size="8" fill="var(--gold)" text-anchor="middle">month ${gs.month}</text>
        <text x="${pad}" y="${Hh - 6}" font-size="8" fill="var(--dim)">month 1</text>
        <text x="${W - pad}" y="${Hh - 6}" font-size="8" fill="var(--dim)" text-anchor="end">month ${months}</text>
      </svg>
      <div class="legend">
        <span class="k"><span class="swatch" style="background:var(--accent)"></span>Confidence</span>
        <span class="k"><span class="swatch" style="background:var(--warn)"></span>Understanding</span>
        <span class="k"><span class="swatch" style="background:var(--ega-brightmagenta)"></span>Client</span>
      </div>
    </div>`;
}

// ---- Ending cards ---------------------------------------------------------
function linkedupCard(gs, h) {
  const cause = gs.ending;
  const fb = FALLBACK_POSTS[cause] || FALLBACK_POSTS.default;
  const av = CLASS_AVATAR[gs.class && gs.class.id] || '👤';
  const name = (gs.class && gs.class.name) || 'You';
  return `
    <div class="lu-card">
      <div class="lu-head"><span class="in">in</span> LinkedUp</div>
      <div class="lu-body">
        <div class="lu-top">
          <span class="lu-avatar">${av}</span>
          <div><div class="lu-name">${h.esc(name)}</div>
          <div class="lu-meta">Formerly Founder · Month ${gs.month} · 🌐</div></div>
        </div>
        <div class="lu-post" data-fulltext="${h.esc(fb.body)}">&nbsp;</div>
        <div class="lu-cause">${h.esc(fb.cause)}</div>
        <div class="lu-react">👍 ❤️ 😮 · 47 · 12 comments</div>
      </div>
    </div>`;
}
function winCard(gs, h) {
  return `<div class="event-card major" style="text-align:center">
    <div class="plate">THE QUALIFIED HUMAN</div>
    <div class="hi" style="font-size:1.2em">Contract renewed. Calibrated. The team intact.</div>
    <div class="dim small" style="margin-top:6px">You can explain your own system. The rarest ending there is.</div>
    </div>`;
}
function impostorCard(gs, h) {
  return `<div class="event-card" style="text-align:center;border-color:var(--warn)">
    <div class="plate" style="background:var(--warn);color:#fff">THE IMPOSTOR</div>
    <div class="hi" style="font-size:1.15em">The contract renewed. The software runs beautifully.</div>
    <div class="dim small" style="margin-top:6px">You could not tell them how. A victory screen that reads like horror.</div>
    </div>`;
}

// ---- Screen ---------------------------------------------------------------
export function render(c) {
  const { gs, h, app, topten } = c;
  const { score, title } = computeScore(gs);

  let card;
  if (gs.ending === 'qualified') card = winCard(gs, h);
  else if (gs.ending === 'impostor') card = impostorCard(gs, h);
  else card = linkedupCard(gs, h);

  let tail;
  if (app.scoreSaved) {
    const rows = topten.map((e, i) => {
      const you = e.initials === app.savedInitials && e.score === score;
      return `<tr class="${you ? 'you' : ''}"><td>${i + 1}.</td><td>${h.esc(e.initials)}</td>`
        + `<td>${h.esc(e.title || e.ending || '')}</td><td class="money">${e.score}</td></tr>`;
    }).join('');
    tail = `
      <table class="topten"><tbody>${rows}</tbody></table>
      <div class="menu" style="width:100%;max-width:420px">
        ${h.row({ key: 'enter', label: '▶ Back to the title', attrs: 'data-action="quit-title"' })}
      </div>`;
  } else {
    tail = `
      <div class="initials">
        Enter your initials:
        <input maxlength="3" autocomplete="off" value="${h.esc((gs.class && gs.class.id ? gs.class.id.slice(0, 3) : 'YOU').toUpperCase())}">
        <button class="row" style="display:inline-flex;width:auto;min-height:36px" data-action="save-initials"><span class="lab">Save</span></button>
      </div>`;
  }

  return `
    <div class="screen scroll center">
      <h2 class="sub caps">${h.esc(title)}</h2>
      ${card}
      ${chart(gs, h)}
      <div class="hi">Score: <span class="money">${score}</span> <span class="dim small">(×${(gs.class && gs.class.multiplier) || 1})</span></div>
      ${tail}
    </div>`;
}

// ---- After render: type the LinkedUp post; upgrade copy from data if present.
export function after(c) {
  const { gs } = c;
  if (gs.ending === 'qualified' || gs.ending === 'impostor') return;
  const el = document.querySelector('#stage .lu-post');
  const causeEl = document.querySelector('#stage .lu-cause');
  if (!el) return;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const startTyping = (text) => {
    el.dataset.fulltext = text;
    if (reduce) { el.textContent = text; return; }
    el.textContent = '';
    el.classList.add('lu-caret');
    let i = 0;
    const step = () => {
      if (!document.body.contains(el)) return;
      el.textContent = text.slice(0, i++);
      if (i <= text.length) c.schedule ? c.schedule(step, 18) : setTimeout(step, 18);
      else el.classList.remove('lu-caret');
    };
    step();
  };

  // start immediately with the fallback text already in data-fulltext
  startTyping(el.dataset.fulltext || '');

  // then try to upgrade from data/linkedup.js (may not exist)
  loadLinkedup().then((mod) => {
    if (!mod) return;
    const post = resolvePost(mod, gs.ending);
    if (post && post.body && document.body.contains(el)) {
      if (causeEl && post.cause) causeEl.textContent = post.cause;
      startTyping(post.body);
    }
  });
}
