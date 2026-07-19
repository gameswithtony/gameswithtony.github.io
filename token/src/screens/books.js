// books.js — BOOKS (month close). A ledger stamp; auto-advances after 3s, tap to
// skip. Reads the 'books' log line the engine wrote for the month just closed
// (revenue post-SLA, payroll, tokens). SLA penalty is derived from the gap
// between the contract and booked revenue. Any reveals / title bumps / incidents
// / hunts from that month ride along as small notes.
//
// NOTE (flagged): the engine's books log does not itemize slip fees or goodwill
// (they settle earlier, in resolveWork, straight to cash), so they are not shown
// as separate lines here — only the net cash-on-hand reflects them.

import { config } from '../../config.js';

function line(label, amt, cls, h) {
  const sign = amt < 0 ? 'neg' : 'pos';
  const txt = amt == null ? '' : `<span class="amt ${cls || sign}">${h.money(amt)}</span>`;
  return `<div class="line"><span>${label}</span>${txt}</div>`;
}

export function render(c) {
  const { vs, h, booksMonth } = c;
  const log = vs.log || [];            // visibleState exposes the log (reveals included)
  const books = [...log].reverse().find((l) => l.type === 'books' && l.month === booksMonth) || {};
  const revenue = books.revenue || 0;
  const salaries = books.salaries || 0;
  const tokens = books.tokens || 0;
  const slaPenalty = Math.max(0, config.contractMonthly - revenue);
  const net = revenue - salaries - tokens;

  // notable month lines (no hidden numbers except the sanctioned reveal)
  const notes = log.filter((l) => l.month === booksMonth
    && ['reveal', 'title', 'incident', 'hunt', 'ai-hunt', 'renewal'].includes(l.type))
    .map((l) => noteLine(l, h)).filter(Boolean);

  return `
    <div class="screen center" data-books="1">
      <div class="stamp caps">Month ${booksMonth} · Books</div>
      <div class="ledger">
        ${line('Revenue', revenue, 'pos', h)}
        ${slaPenalty > 0 ? line('SLA penalty', -slaPenalty, 'neg', h) : ''}
        ${line('Payroll', -salaries, 'neg', h)}
        ${line('AI tokens', -tokens, 'neg', h)}
        <div class="line net"><span class="hi">Net this month</span><span class="amt ${net < 0 ? 'neg' : 'pos'} hi">${h.money(net)}</span></div>
        <div class="line"><span class="dim">Cash on hand</span><span class="amt money">${h.money(vs.money)}</span></div>
      </div>
      ${notes.length ? `<div class="small dim" style="margin-top:6px">${notes.join('<br>')}</div>` : ''}
      <div class="spacer"></div>
      <div class="menu" style="width:100%;max-width:420px">
        ${h.row({ key: 'enter', label: '▶ Continue (auto)', attrs: 'data-action="books-skip"' })}
      </div>
    </div>`;
}

function noteLine(l, h) {
  switch (l.type) {
    case 'reveal': return `<span class="caps">Reveal — ${h.esc(l.skill)}: believed ${l.believed}, reality ${l.reality}.</span>`;
    case 'title': return `${h.esc(l.role)} promoted to ${h.esc(l.title)}.`;
    case 'incident': return `<span class="warn">Incident: severity +${l.severity}.</span>`;
    case 'hunt': return `Hunt: fixed ${l.fixed}.`;
    case 'ai-hunt': return `AI hunt: closed ${l.fixed}${l.regressions ? `, ${l.regressions} quiet regression(s)` : ''}.`;
    case 'renewal': return `<span class="hi">Renewal: passed ${l.passed} of 3 — ${l.renewed ? 'RENEWED' : 'not renewed'}.</span>`;
    default: return '';
  }
}

// Auto-advance after 3s (tap to skip). Uses the tracked scheduler so navigation
// clears it.
export function after(c) {
  if (typeof c.schedule !== 'function') return;
  c.schedule(() => {
    const btn = document.querySelector('#stage [data-action="books-skip"]');
    if (btn) btn.click();
  }, 3000);
}
