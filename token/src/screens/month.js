// month.js — MONTH HUB (the office / wagon screen) + the "Look at the year" map.
// The centerpiece: a status strip, a minimal office banner (a static WP5
// placeholder — WP6 builds the full animated scene), and the Oregon-Trail
// question with the month's menu. The month auto-advances through the engine as
// soon as the plan is complete, so the hub only shows while decisions remain.

import { config } from '../../config.js';

// Minimal static office banner. A pure function of visibleState: a desk per
// seat, empty (dashed) desks where no one was hired. WP6 replaces this.
function office(vs) {
  const seats = [
    { x: 40, label: 'YOU', filled: true, mood: '' },
    { x: 190, label: 'JR', filled: !!vs.team.junior, mood: vs.team.junior ? vs.team.junior.mood : '' },
    { x: 340, label: 'QA', filled: !!vs.team.qa, mood: vs.team.qa ? vs.team.qa.mood : '' },
    { x: 490, label: 'SR', filled: !!vs.team.senior, mood: vs.team.senior ? vs.team.senior.mood : '' }
  ];
  const desks = seats.map((s) => {
    const stroke = s.filled ? 'var(--border)' : 'var(--dim)';
    const dash = s.filled ? '' : 'stroke-dasharray="4 3"';
    const chair = s.filled
      ? `<circle cx="${s.x + 55}" cy="42" r="12" fill="var(--panel)" stroke="${stroke}" stroke-width="2"/>`
      : `<rect x="${s.x + 40}" y="30" width="24" height="18" fill="none" stroke="var(--dim)" stroke-width="2" ${dash}/>`;
    const face = s.mood ? `<text x="${s.x + 55}" y="47" font-size="13" text-anchor="middle">${s.mood}</text>` : '';
    return `
      <g>
        <rect x="${s.x}" y="70" width="110" height="34" fill="var(--panel)" stroke="${stroke}" stroke-width="2" ${dash}/>
        <rect x="${s.x + 12}" y="52" width="46" height="26" fill="var(--panel-2)" stroke="${stroke}" stroke-width="2" ${dash}/>
        ${chair}${face}
        <text x="${s.x + 55}" y="120" font-size="11" text-anchor="middle" fill="var(--dim)">${s.label}</text>
      </g>`;
  }).join('');
  return `
    <div class="office"><svg viewBox="0 0 620 130" preserveAspectRatio="xMidYMid meet">
      <rect x="2" y="2" width="616" height="126" fill="none" stroke="var(--border)" stroke-width="2"/>
      <rect x="540" y="14" width="60" height="40" fill="var(--panel-2)" stroke="var(--border)" stroke-width="2"/>
      <text x="570" y="38" font-size="10" text-anchor="middle" fill="var(--accent)">${seasonWord(0)}</text>
      ${desks}
    </svg></div>`;
}

// (kept tiny — the seasonal glyph is rendered from the strip's month elsewhere)
function seasonWord() { return ''; }

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
