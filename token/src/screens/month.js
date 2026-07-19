// month.js — MONTH HUB (the office / wagon screen) + the "Look at the year" map.
// The centerpiece: a status strip, a minimal office banner (a static WP5
// placeholder — WP6 builds the full animated scene), and the Oregon-Trail
// question with the month's menu. The month auto-advances through the engine as
// soon as the plan is complete, so the hub only shows while decisions remain.

import { config } from '../../config.js';

// ===========================================================================
// THE OFFICE SCENE (WP6, full animated per UI spec). A PURE function of
// visibleState: posture, chairs, monitor glow and the window all render from the
// projection — decorative truth, never the only truth (the strip's mood faces
// mirror what posture shows). Animation is CSS steps() on TRANSFORMS only; the
// duration comes from a CSS var driven by visible workload. No canvas, no rAF.
//
// Pose -> visible condition (see the report table):
//   you slumped .......... energy < BURN_LOW              (burnout looming)
//   you typing ........... otherwise; speed = visible workload (tasks+backlog)
//   member slumped ....... mood ☹️ (morale sinking)
//   member scrolling ..... mood 🙂/😐 AND CD >= CD_HOT    (the AI does their work)
//   member typing ........ mood 🙂/😐 AND CD <  CD_HOT
//   empty + boxes ........ seat null, never hired
//   chair still spinning . seat null, a prior hire in the log (they just quit)
//   monitor glow ......... intensity by model tier (the rack shows the nameplate)
//   window ............... one art per quarter (season from the month)
// ===========================================================================

const BURN_LOW = 30;      // your Energy below this reads as slumped/burning out
const CD_HOT = 5;         // Cognitive Debt at/above this: the machine carries them

const SEASONS = ['winter','winter','spring','spring','spring','summer','summer','summer','fall','fall','fall','winter'];
function seasonOf(month) { return SEASONS[(month - 1) % 12] || 'winter'; }

// ---- window art per season (static SVG; no animation needed) --------------
function windowArt(month) {
  const s = seasonOf(month);
  const sky = { winter: '#12325a', spring: '#1c5a3a', summer: '#2a6ad6', fall: '#7a4a12' }[s] || '#12325a';
  let art = '';
  if (s === 'winter') {
    art = `<circle cx="18" cy="14" r="6" fill="#cfe6ff"/>` +
      dots([[14,30],[30,20],[46,36],[62,24],[36,42],[54,14]], '#ffffff', 1.6);
  } else if (s === 'spring') {
    art = `<rect x="36" y="24" width="6" height="24" fill="#4a3010"/>` +
      `<circle cx="39" cy="20" r="12" fill="#55ff55"/>` +
      dots([[33,16],[45,18],[39,26],[30,40],[52,38]], '#ff9de0', 1.8);
  } else if (s === 'summer') {
    art = `<circle cx="39" cy="22" r="11" fill="var(--ega-yellow)"/>` +
      rays(39, 22, 15) + `<rect x="24" y="42" width="30" height="6" fill="#2a8a3a"/>`;
  } else { // fall
    art = `<rect x="36" y="22" width="6" height="24" fill="#4a3010"/>` +
      `<circle cx="39" cy="18" r="11" fill="#aa5500"/>` +
      dots([[20,34],[54,30],[30,44],[48,42],[62,38]], '#ff9a3a', 1.8);
  }
  return `
    <g>
      <rect x="24" y="8" width="94" height="58" fill="${sky}" stroke="var(--border)" stroke-width="2"/>
      <g transform="translate(24,8)">${art}</g>
      <line x1="71" y1="8" x2="71" y2="66" stroke="var(--border)" stroke-width="2"/>
      <line x1="24" y1="37" x2="118" y2="37" stroke="var(--border)" stroke-width="2"/>
    </g>`;
}
function dots(pts, fill, r) {
  return pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`).join('');
}
function rays(cx, cy, len) {
  let out = '';
  for (let a = 0; a < 360; a += 45) {
    const rad = a * Math.PI / 180;
    out += `<line x1="${(cx + Math.cos(rad) * (len - 3)).toFixed(1)}" y1="${(cy + Math.sin(rad) * (len - 3)).toFixed(1)}"
      x2="${(cx + Math.cos(rad) * len).toFixed(1)}" y2="${(cy + Math.sin(rad) * len).toFixed(1)}"
      stroke="var(--ega-yellow)" stroke-width="2"/>`;
  }
  return out;
}

// ---- server rack + model nameplate ----------------------------------------
function rack(model) {
  const glow = { budget: '#00aa00', standard: '#55ff55', frontier: '#55ffff' }[model] || '#55ff55';
  const lights = [18, 30, 42].map((y, i) =>
    `<rect class="rack-led" x="548" y="${y}" width="8" height="4" fill="${glow}" style="opacity:${0.5 + i * 0.2}"/>`).join('');
  return `
    <g>
      <rect x="540" y="8" width="72" height="58" fill="var(--panel-2)" stroke="var(--border)" stroke-width="2"/>
      ${lights}
      <rect x="560" y="14" width="46" height="30" fill="none" stroke="var(--dim)" stroke-width="1"/>
      <text x="576" y="60" font-size="8" fill="${glow}" text-anchor="middle" class="caps">${esc(model)}</text>
    </g>`;
}

// ---- character poses (local coords; station <g> translates them into place) --
// Each returns SVG drawn around a seated figure centered at x≈70, sitting at a
// desk whose top is y≈150. Transforms-only animation via CSS classes.
function poseTyping(color) {
  return `<g class="fig type">
    <g class="torso">
      <rect x="56" y="112" width="28" height="30" rx="4" fill="${color}" stroke="var(--ega-black)" stroke-width="2"/>
      <circle cx="70" cy="104" r="11" fill="#e6b98a" stroke="var(--ega-black)" stroke-width="2"/>
      <g class="arms">
        <rect x="48" y="128" width="12" height="6" fill="${color}" stroke="var(--ega-black)" stroke-width="1.5"/>
        <rect x="80" y="128" width="12" height="6" fill="${color}" stroke="var(--ega-black)" stroke-width="1.5"/>
      </g>
    </g>
  </g>`;
}
function poseSlumped(color) {
  return `<g class="fig">
    <rect x="54" y="120" width="32" height="24" rx="4" fill="${color}" stroke="var(--ega-black)" stroke-width="2"/>
    <circle cx="70" cy="124" r="11" fill="#e6b98a" stroke="var(--ega-black)" stroke-width="2"/>
    <text x="90" y="118" font-size="11">z</text>
  </g>`;
}
function poseScrolling(color) {
  return `<g class="fig lean">
    <g class="torso">
      <rect x="56" y="114" width="28" height="28" rx="4" fill="${color}" stroke="var(--ega-black)" stroke-width="2"/>
      <circle cx="72" cy="104" r="11" fill="#e6b98a" stroke="var(--ega-black)" stroke-width="2"/>
      <rect x="82" y="112" width="9" height="14" rx="1" fill="var(--ega-black)" stroke="var(--dim)" stroke-width="1"/>
      <rect x="83" y="114" width="7" height="8" fill="#55ffff" class="phone-glow"/>
    </g>
  </g>`;
}
function chairSpinning() {
  return `<g class="chair-spin" transform="translate(70,132)">
    <ellipse cx="0" cy="0" rx="16" ry="7" fill="var(--panel)" stroke="var(--border)" stroke-width="2"/>
    <rect x="-3" y="0" width="6" height="14" fill="var(--dim)"/>
    <line x1="-12" y1="16" x2="12" y2="16" stroke="var(--dim)" stroke-width="2"/>
  </g>`;
}
function emptyBoxes() {
  return `<g>
    <rect x="70" y="122" width="16" height="16" fill="none" stroke="var(--dim)" stroke-width="2" stroke-dasharray="4 3"/>
    <g stroke="var(--brown,#aa5500)" stroke-width="2" fill="var(--panel-2)">
      <rect x="48" y="126" width="18" height="16"/>
      <rect x="52" y="114" width="16" height="14"/>
    </g>
    <line x1="48" y1="134" x2="66" y2="134" stroke="var(--dim)" stroke-width="1"/>
  </g>`;
}

// One desk station: desk, monitor with tier glow, and the resolved pose.
function station(x, opts) {
  const { label, color, pose, model, filled } = opts;
  const glow = { budget: '#0a3a0a', standard: '#0a4a10', frontier: '#0a4a4a' }[model] || '#0a3a0a';
  const glowColor = filled ? glow : 'var(--panel-2)';
  return `
    <g transform="translate(${x},0)">
      <!-- monitor -->
      <rect x="24" y="120" width="40" height="28" fill="${glowColor}" stroke="var(--border)" stroke-width="2" class="${filled ? 'monitor lit' : 'monitor'}"/>
      <rect x="40" y="148" width="8" height="6" fill="var(--dim)"/>
      ${pose}
      <!-- desk -->
      <rect x="8" y="150" width="124" height="10" fill="var(--panel)" stroke="var(--border)" stroke-width="2"/>
      <text x="70" y="176" font-size="11" text-anchor="middle" fill="var(--dim)" class="caps">${esc(label)}</text>
    </g>`;
}

function resolvePose(role, vs) {
  // YOU
  if (role === 'you') {
    const slumped = vs.energy < BURN_LOW;
    return { filled: true, pose: slumped ? poseSlumped('var(--ega-brightblue)') : poseTyping('var(--ega-brightblue)') };
  }
  const m = vs.team[role];
  if (m) {
    const color = { junior: 'var(--ega-green)', qa: 'var(--ega-magenta)', senior: 'var(--ega-brown)' }[role];
    if (m.mood === '☹️') return { filled: true, pose: poseSlumped(color) };
    if (vs.cd >= CD_HOT) return { filled: true, pose: poseScrolling(color) };
    return { filled: true, pose: poseTyping(color) };
  }
  // empty seat: distinguish "just quit" (a prior hire in the log) from "never hired"
  const wasHired = (vs.log || []).some((l) => l.type === 'hire' && l.role === role);
  return { filled: false, pose: wasHired ? chairSpinning() : emptyBoxes() };
}

function office(vs) {
  const waiting = vs.tasks.filter((t) => t.route == null).length
    + vs.backlog.filter((b) => b.route == null).length;
  // more visible work -> faster typing (the "pace" homage, keyed to workload)
  const typeDur = Math.max(280, 820 - waiting * 140);

  const seats = [
    { role: 'you', label: 'YOU' },
    { role: 'junior', label: 'JUNIOR' },
    { role: 'qa', label: 'QA' },
    { role: 'senior', label: 'SENIOR' }
  ];
  const xs = [8, 158, 308, 458];
  const stations = seats.map((s, i) => {
    const r = resolvePose(s.role, vs);
    const color = s.role === 'you' ? 'var(--ega-brightblue)' : 'var(--fg)';
    return station(xs[i], { label: s.label, color, pose: r.pose, model: vs.model, filled: r.filled });
  }).join('');

  return `
    <div class="office" style="--type-dur:${typeDur}ms">
      <svg viewBox="0 0 640 190" preserveAspectRatio="xMidYMid meet" role="img"
           aria-label="The office. Your desk and up to three teammates; the window shows the season.">
        <rect x="2" y="2" width="636" height="186" fill="var(--panel-2)" stroke="var(--border)" stroke-width="2"/>
        <rect x="2" y="100" width="636" height="88" fill="var(--panel)"/>
        ${windowArt(vs.month)}
        ${rack(vs.model)}
        ${stations}
      </svg>
    </div>`;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function render(c) {
  if (c.view === 'map') return mapPane(c);
  const { vs, decisions, h } = c;

  const routePending = decisions.filter((d) => d.kind === 'route').length;
  const focusPending = decisions.some((d) => d.kind === 'focus');
  const waiting = vs.tasks.filter((t) => t.route == null).length;
  const backlog = vs.backlog.filter((b) => b.route == null).length;

  const rows = [];
  let k = 1;
  rows.push(h.row({
    key: k++, label: 'Assign the work',
    detail: `${waiting} waiting · ${backlog} in backlog`,
    attrs: 'data-action="nav" data-view="assign"',
    disabled: routePending === 0
  }));
  rows.push(h.row({
    key: k++, label: 'Spend your focus',
    detail: focusPending ? 'one per month' : 'spend it after routing',
    attrs: 'data-action="nav" data-view="focus"',
    disabled: !focusPending
  }));
  rows.push(h.row({ key: k++, label: 'Look at the year', attrs: 'data-action="nav" data-view="map"' }));

  return `
    <div class="screen">
      ${h.strip(vs)}
      ${office(vs)}
      <div class="hi" style="margin-top:4px">It is month ${vs.month}. What will you do?</div>
      <div class="menu">${rows.join('')}</div>
      <div class="hintbar">${h.seasonName(vs.month)} · ${h.monthName(vs.month)}</div>
    </div>`;
}

function mapPane(c) {
  const { vs, h } = c;
  const quarters = [
    { q: 'Q1', months: [1, 2, 3], landmark: 'The first crossing' },
    { q: 'Q2', months: [4, 5, 6], landmark: 'Midyear set piece' },
    { q: 'Q3', months: [7, 8, 9], landmark: 'The autumn crossing' },
    { q: 'Q4', months: [10, 11, 12], landmark: 'The Renewal Review' }
  ];
  const cells = quarters.map((qt) => {
    const passed = vs.month > qt.months[2];
    const here = qt.months.includes(vs.month);
    const cls = here ? 'sub' : passed ? 'dim' : 'hi';
    const mark = passed ? '✓ behind you' : here ? '◀ you are here' : 'ahead';
    return `<div class="card ${here ? '' : ''}"><span class="${cls} caps">${qt.q}</span>
      · months ${qt.months.join('–')} · <span class="dim">${qt.landmark}</span>
      <div class="small ${here ? 'sub' : 'dim'}">${mark}</div></div>`;
  }).join('');

  // crossings behind you, drawn from the log's major/renewal lines
  const crossings = (vs.log || []).filter((l) => l.type === 'books').length;
  return `
    <div class="screen scroll">
      ${h.strip(vs)}
      <h2 class="sub">The year ahead</h2>
      ${cells}
      <div class="small dim">Months closed: ${crossings}. The contract runs ${config.months} months.</div>
      <div class="menu">${h.row({ key: 1, label: 'Back to the office', attrs: 'data-action="nav" data-view="hub"' })}</div>
    </div>`;
}
