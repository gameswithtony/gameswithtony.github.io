// store.js — QUARTER STORE (months 3/6/9, before the major hits).
//
// NOTE (flagged in the WP5 report): the pure engine exposes NO decision surface
// for mid-run hire/fire/model-switch — pendingDecisions only emits plan/event
// kinds, and the UI is forbidden from mutating hidden state outside
// applyDecision/beginMonth (that is what keeps auto-save and the drift test
// honest). So in this build the quarter store is a review-and-continue
// interstitial: it shows the roster, the model, and the burn against the
// contract, then lets you carry on. Wiring hire/fire/switch requires an engine
// `kind:'store'` decision surface (a future WP), at which point this screen drops
// in as the menu over those decisions with zero structural change here.

import { config } from '../../config.js';

const TIER_LABEL = { budget: 'Budget', standard: 'Standard', frontier: 'Frontier' };

export function render(c) {
  const { vs, h } = c;
  let burn = 0;
  const roster = [];
  for (const role of ['junior', 'qa', 'senior']) {
    const m = vs.team[role];
    if (m) {
      burn += 0; // salaries are hidden in the projection; show mood + name
      roster.push(`<div class="card"><span class="hi">${h.esc(m.name)}</span>
        <span class="det">${h.esc(role)} · ${h.esc(m.trait)}</span> <span>${m.mood}</span></div>`);
    } else {
      roster.push(`<div class="card socket"><span class="dim">${h.esc(role)} — an empty desk</span></div>`);
    }
  }

  const quarter = vs.month === 3 ? 'first' : vs.month === 6 ? 'second' : 'third';

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

      <div class="card"><span class="dim">Contract: ${h.money(config.contractMonthly)}/mo. A landmark waits at month's end.</span></div>

      <div class="menu">${h.row({ key: 'enter', label: '▶ Carry on', attrs: 'data-action="store-continue"' })}</div>
    </div>`;
}
