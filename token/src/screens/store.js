// store.js — QUARTER STORE (months 3/6/9, before the major hits).
//
// The engine exposes a kind:'store' decision surface (hire an empty desk /
// switch model / carry on), so this screen is the menu over those decisions. It
// renders ONLY the visible resume data the engine puts on each option row (name,
// salary, trait, claimed resume) — never a candidate's true Understanding — and
// dispatches each choice through applyDecision like every other screen. It is one
// action per quarter: any pick (a hire, a model switch, or "Carry on") opens the
// month. Skippable in one tap (Enter = Carry on).

import { config } from '../../config.js';

const TIER_LABEL = { budget: 'Budget', standard: 'Standard', frontier: 'Frontier' };

export function render(c) {
  const { vs, h, decisions } = c;
  const store = decisions.find((d) => d.kind === 'store');

  const roster = [];
  for (const role of ['junior', 'qa', 'senior']) {
    const m = vs.team[role];
    if (m) {
      roster.push(`<div class="card"><span class="hi">${h.esc(m.name)}</span>
        <span class="det">${h.esc(role)} · ${h.esc(m.trait)}</span> <span>${m.mood}</span></div>`);
    } else {
      roster.push(`<div class="card socket"><span class="dim">${h.esc(role)} — an empty desk</span></div>`);
    }
  }

  const quarter = vs.month === 3 ? 'first' : vs.month === 6 ? 'second' : 'third';

  // Purchasable options (hires + model switches) as numbered rows; "Carry on"
  // (the engine's skip) is the primary Enter action.
  const buys = store ? store.options.filter((o) => o.id !== 'skip') : [];
  let key = 1;
  const buyRows = buys.map((o) => h.row({
    key: key++, label: h.esc(o.label), detail: o.detail,
    attrs: `data-action="dispatch" data-decision="store" data-option="${o.id}"`
  })).join('');
  const carryOn = h.row({
    key: 'enter', label: '▶ Carry on',
    attrs: 'data-action="dispatch" data-decision="store" data-option="skip"'
  });

  return `
    <div class="screen scroll">
      ${h.strip(vs)}
      <h2 class="sub">The general store, revisited</h2>
      <div class="small dim">"Back again. The ${quarter} quarter closes soon." The clerk remembers you.</div>

      <div class="hi caps" style="margin-top:8px">Your crew</div>
      ${roster.join('')}

      <div class="hi caps" style="margin-top:6px">The model</div>
      <div class="card"><span class="hi">${TIER_LABEL[vs.model] || vs.model}</span>
        <span class="det">$${config.tokenCosts[vs.model]}/task</span></div>

      <div class="hi caps" style="margin-top:6px">For sale</div>
      <div class="small dim">Resumes run optimistic — the truth shows only under a check.</div>
      <div class="menu">${buyRows || '<div class="row empty"><span class="lab dim">Nothing on the shelf — a full crew.</span></div>'}</div>

      <div class="card"><span class="dim">Contract: ${h.money(config.contractMonthly)}/mo. A landmark waits at month's end.</span></div>

      <div class="menu">${carryOn}</div>
    </div>`;
}
