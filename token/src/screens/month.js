// month.js — MONTH HUB (the office screen) + the "Look at the year" map.
// The centerpiece: a status strip, the animated office scene, and the month's
// menu. The month auto-advances through the engine as soon as the plan is
// complete, so the hub only shows while decisions remain.

import { config } from '../../config.js';

// ===========================================================================
// THE OFFICE SCENE. A PURE function of visibleState: posture, chairs, monitor
// glow and the window all render from the projection — decorative truth, never
// the only truth (the strip's mood faces mirror what posture shows). Drawn as
// cartoon stick figures in ink; the only typing animation is the HANDS tapping
// the keyboard (CSS steps() on transforms, cadence from --type-dur).
//
// Pose -> visible condition:
//   you slumped .......... energy < BURN_LOW              (burnout looming)
//   you typing ........... otherwise; speed = visible workload (tasks+backlog)
//   member slumped ....... mood ☹️ (morale sinking)
//   member feet-up ....... mood 🙂/😐 AND CD >= CD_HOT    (the AI does their work)
//   member typing ........ mood 🙂/😐 AND CD <  CD_HOT
//   empty + boxes ........ seat null, never hired
//   chair still spinning . seat null, a prior hire in the log (they just quit)
//   monitor glow ......... tint by model tier (the rack shows the nameplate)
//   window ............... one art per quarter (season from the month)
// ===========================================================================

const BURN_LOW = 30;      // your Energy below this reads as slumped/burning out
const CD_HOT = 5;         // Cognitive Debt at/above this: the machine carries them

const INK = '#2e2a50';
const SKIN = '#ffe9c9';
const WALL = '#fdf4df';
const FLOOR = '#ead9b5';
const WOOD = '#d9a45b';

const SEASONS = ['winter','winter','spring','spring','spring','summer','summer','summer','fall','fall','fall','winter'];
function seasonOf(month) { return SEASONS[(month - 1) % 12] || 'winter'; }

// ---- window art per season (static SVG; no animation needed) --------------
function windowArt(month) {
  const s = seasonOf(month);
  const sky = { winter: '#bcd9f0', spring: '#c2e9f5', summer: '#9fd9f0', fall: '#f3d9b0' }[s] || '#bcd9f0';
  let art = '';
  if (s === 'winter') {
    art = `<circle cx="34" cy="46" r="9" fill="#ffffff" stroke="${INK}" stroke-width="2"/>` +
      `<circle cx="34" cy="33" r="6.5" fill="#ffffff" stroke="${INK}" stroke-width="2"/>` +
      `<circle cx="32" cy="32" r="1" fill="${INK}"/><circle cx="36" cy="32" r="1" fill="${INK}"/>` +
      dots([[64, 22], [80, 34], [70, 48], [88, 18], [56, 40]], '#ffffff', 2);
  } else if (s === 'spring') {
    art = `<rect x="66" y="34" width="6" height="22" rx="2" fill="#8a5a2a"/>` +
      `<circle cx="69" cy="28" r="13" fill="#7fce8f"/>` +
      dots([[62, 22], [76, 24], [69, 33], [58, 44], [84, 42]], '#ffa8d6', 2.4);
  } else if (s === 'summer') {
    art = `<circle cx="66" cy="28" r="11" fill="#ffc53d" stroke="${INK}" stroke-width="2"/>` +
      `<ellipse cx="38" cy="46" rx="13" ry="6" fill="#ffffff"/>` +
      `<ellipse cx="48" cy="42" rx="10" ry="6" fill="#ffffff"/>`;
  } else { // fall
    art = `<rect x="66" y="30" width="6" height="26" rx="2" fill="#8a5a2a"/>` +
      `<circle cx="69" cy="26" r="12" fill="#e8842a"/>` +
      dots([[52, 40], [84, 36], [60, 52], [78, 50]], '#ffb054', 2.4);
  }
  return `
    <g>
      <rect x="22" y="12" width="108" height="66" rx="9" fill="${sky}" stroke="${INK}" stroke-width="3"/>
      <g>${art}</g>
      <line x1="76" y1="14" x2="76" y2="76" stroke="${INK}" stroke-width="2.5"/>
      <line x1="24" y1="45" x2="128" y2="45" stroke="${INK}" stroke-width="2.5"/>
    </g>`;
}
function dots(pts, fill, r) {
  return pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`).join('');
}

// ---- server rack + model nameplate ----------------------------------------
function rack(model) {
  const led = { budget: '#21985f', standard: '#ffc53d', frontier: '#7b6cdb' }[model] || '#ffc53d';
  const lights = [26, 40, 54].map((y, i) =>
    `<circle cx="536" cy="${y}" r="3.5" fill="${led}" style="opacity:${0.55 + i * 0.2}"/>`).join('');
  return `
    <g>
      <rect x="522" y="12" width="96" height="66" rx="9" fill="#e6def7" stroke="${INK}" stroke-width="3"/>
      ${lights}
      <g stroke="${INK}" stroke-width="2" stroke-linecap="round">
        <line x1="548" y1="26" x2="606" y2="26"/>
        <line x1="548" y1="40" x2="606" y2="40"/>
        <line x1="548" y1="54" x2="606" y2="54"/>
      </g>
      <text x="570" y="72" font-size="9" fill="${INK}" text-anchor="middle" class="caps">${esc(model)}</text>
    </g>`;
}

// ---- character poses (local coords; station <g> translates them into place) --
// Side view: the figure sits at x≈95 facing the monitor on its left. Desk top
// y=136, chair seat y=126, floor y=172. Ink stick figures, colored shirt line.
const STROKE = `stroke="${INK}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" fill="none"`;

function chair() {
  return `<g>
    <rect x="84" y="124" width="26" height="7" rx="3.5" fill="${INK}"/>
    <line x1="97" y1="131" x2="97" y2="164" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
    <line x1="85" y1="168" x2="109" y2="168" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
    <circle cx="86" cy="171" r="2.5" fill="${INK}"/><circle cx="108" cy="171" r="2.5" fill="${INK}"/>
  </g>`;
}

function poseTyping(color) {
  return `<g class="fig type">
    ${chair()}
    <line x1="96" y1="126" x2="94" y2="101" stroke="${color}" stroke-width="7" stroke-linecap="round"/>
    <circle cx="93" cy="91" r="9" fill="${SKIN}" stroke="${INK}" stroke-width="2.5"/>
    <circle cx="88.5" cy="90" r="1.2" fill="${INK}"/>
    <g class="arm-l">
      <polyline points="95,106 85,118 80,129" ${STROKE}/>
      <circle cx="79" cy="130" r="2.2" fill="${INK}"/>
    </g>
    <g class="arm-r">
      <polyline points="95,108 86,120 74,130" ${STROKE}/>
      <circle cx="73" cy="131" r="2.2" fill="${INK}"/>
    </g>
    <polyline points="96,126 78,129 80,168 73,168" ${STROKE}/>
    <polyline points="96,126 82,131 85,168 78,168" ${STROKE}/>
  </g>`;
}

function poseSlumped(color) {
  return `<g class="fig">
    ${chair()}
    <line x1="96" y1="126" x2="87" y2="115" stroke="${color}" stroke-width="7" stroke-linecap="round"/>
    <circle cx="80" cy="127" r="9" fill="${SKIN}" stroke="${INK}" stroke-width="2.5"/>
    <polyline points="87,116 70,131" ${STROKE}/>
    <polyline points="88,118 94,140 92,150" ${STROKE}/>
    <polyline points="96,126 80,130 82,168 75,168" ${STROKE}/>
    <text x="98" y="102" font-size="11" fill="#837fa1" font-style="italic">z</text>
    <text x="106" y="94" font-size="9" fill="#837fa1" font-style="italic">z</text>
  </g>`;
}

// Feet up on the desk, phone out — the machine is doing their work.
function poseScrolling(color) {
  return `<g class="fig lean">
    ${chair()}
    <line x1="98" y1="126" x2="106" y2="102" stroke="${color}" stroke-width="7" stroke-linecap="round"/>
    <circle cx="108" cy="92" r="9" fill="${SKIN}" stroke="${INK}" stroke-width="2.5"/>
    <circle cx="103.5" cy="91" r="1.2" fill="${INK}"/>
    <polyline points="105,106 95,102 90,96" ${STROKE}/>
    <rect x="83" y="84" width="8" height="13" rx="2" fill="${INK}"/>
    <rect x="84.5" y="86" width="5" height="8" rx="1" fill="#9fe8ff"/>
    <polyline points="106,110 100,120 96,126" ${STROKE}/>
    <polyline points="98,126 76,122 64,131" ${STROKE}/>
    <polyline points="98,126 80,126 68,134" ${STROKE}/>
  </g>`;
}

function chairSpinning() {
  return `<g class="chair-spin">
    <ellipse cx="95" cy="130" rx="16" ry="6" fill="#e6def7" stroke="${INK}" stroke-width="2.5"/>
    <line x1="95" y1="136" x2="95" y2="164" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
    <line x1="83" y1="168" x2="107" y2="168" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
  </g>`;
}

function emptyBoxes() {
  return `<g>
    <rect x="76" y="152" width="24" height="19" rx="2" fill="#e0b878" stroke="${INK}" stroke-width="2.5"/>
    <rect x="82" y="138" width="18" height="14" rx="2" fill="#eac48a" stroke="${INK}" stroke-width="2.5"/>
    <line x1="76" y1="161" x2="100" y2="161" stroke="${INK}" stroke-width="1.5"/>
  </g>`;
}

// One desk station: desk, monitor with tier tint, keyboard, and the pose.
function station(x, opts) {
  const { label, pose, model, filled } = opts;
  const tint = { budget: '#d8f0dc', standard: '#fff1c4', frontier: '#e4defc' }[model] || '#fff1c4';
  const screen = filled ? tint : '#8a879d';
  return `
    <g transform="translate(${x},0)">
      ${pose}
      <!-- desk -->
      <rect x="10" y="132" width="120" height="9" rx="4" fill="${WOOD}" stroke="${INK}" stroke-width="3"/>
      <rect x="20" y="141" width="6" height="31" fill="${WOOD}" stroke="${INK}" stroke-width="2"/>
      <rect x="112" y="141" width="6" height="31" fill="${WOOD}" stroke="${INK}" stroke-width="2"/>
      <!-- monitor + keyboard -->
      <rect x="42" y="128" width="10" height="4" fill="${INK}"/>
      <rect x="24" y="98" width="46" height="32" rx="5" fill="${screen}" stroke="${INK}" stroke-width="3"/>
      <rect x="74" y="128" width="20" height="4" rx="2" fill="${INK}"/>
      <text x="70" y="192" font-size="9" text-anchor="middle" fill="#837fa1" class="caps">${esc(label)}</text>
    </g>`;
}

function resolvePose(role, vs) {
  // YOU
  if (role === 'you') {
    const slumped = vs.energy < BURN_LOW;
    return { filled: true, pose: slumped ? poseSlumped('#ff6b57') : poseTyping('#ff6b57') };
  }
  const m = vs.team[role];
  if (m) {
    const color = { junior: '#21985f', qa: '#7b6cdb', senior: '#e09a1f' }[role];
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
  // more visible work -> faster typing (pace keyed to workload)
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
    return station(xs[i], { label: s.label, pose: r.pose, model: vs.model, filled: r.filled });
  }).join('');

  return `
    <div class="office" style="--type-dur:${typeDur}ms">
      <svg viewBox="0 0 640 200" preserveAspectRatio="xMidYMid meet" role="img"
           aria-label="The office. Your desk and up to three teammates; the window shows the season.">
        <rect x="0" y="0" width="640" height="200" fill="${WALL}"/>
        <rect x="0" y="172" width="640" height="28" fill="${FLOOR}"/>
        <line x1="0" y1="172" x2="640" y2="172" stroke="${INK}" stroke-width="2.5"/>
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

  // MOREFUN D4: the quarter's deliverable, always in view with its fuse.
  const ms = vs.milestone;
  const msLine = ms
    ? `<div class="card"><span class="hi">⭐ ${esc(ms.title)}</span>
        <span class="det">due month ${ms.deadlineMonth} · ${ms.shipped}/${ms.need} shipped</span></div>`
    : '';

  return `
    <div class="screen">
      ${h.strip(vs)}
      ${office(vs)}
      ${msLine}
      <div class="hi" style="margin-top:2px">It is month ${vs.month}. What will you do?</div>
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
