// outfitting.js — OUTFITTING (the general store). Two clean decisions: who to
// hire (two candidates per role — salary, trait, and a "claimed" resume bar; the
// TRUE understanding stays hidden until a check) and which model tier. No
// reference check (cut, PLAN.md §1). Running burn is projected against the
// contract at the bottom. The clerk mutters.

import { config } from '../../config.js';
import { createRng } from '../sim/rng.js';
import { generateCandidates } from '../data/candidates.js';

const ROLES = ['junior', 'qa', 'senior'];
const TIERS = ['budget', 'standard', 'frontier'];
const TIER_LABEL = { budget: 'Budget', standard: 'Standard', frontier: 'Frontier' };

// Build the candidate pool once, deterministically from the run seed.
export function prepare(draft) {
  if (draft.pool) return;
  const rng = createRng(draft.seed >>> 0);
  draft.pool = generateCandidates(rng);
  if (!draft.hires) draft.hires = {};
  if (!draft.model) draft.model = 'standard';
}

export function toggleHire(draft, role, candId) {
  const cur = draft.hires[role];
  if (cur && cur.id === candId) { draft.hires[role] = null; return; }
  const pool = draft.pool[role] || [];
  draft.hires[role] = pool.find((x) => x.id === candId) || null;
}

export function finalize(draft) {
  const hires = {};
  for (const r of ROLES) hires[r] = draft.hires[r] || null;
  return { classId: draft.classId, hires, model: draft.model, seed: draft.seed };
}

function burn(draft) {
  let s = 0;
  for (const r of ROLES) if (draft.hires[r]) s += draft.hires[r].salary;
  return s;
}

function clerkLine(draft) {
  if (!draft.hires.qa) return '"I always tell folks: hire the QA. Nobody listens."';
  if (draft.model === 'frontier') return '"Frontier model. Errors so subtle your reviews sail right past."';
  if (!draft.hires.junior && !draft.hires.senior) return '"Just you and the machine, then. Bold."';
  return '"Sign here. The contract does not read itself."';
}

function candCard(c, role, cand, selected) {
  const { h } = c;
  const sel = selected ? ' style="border-color:var(--accent);color:var(--fg-hi)"' : '';
  return `
    <button class="row" data-action="toggle-hire" data-role="${role}" data-cand="${h.esc(cand.id)}"${sel}
            style="flex-direction:column;align-items:flex-start;gap:2px">
      <div style="display:flex;gap:6px;width:100%;align-items:center">
        <span class="lab hi">${h.esc(cand.name)}</span>
        <span class="det money">${h.money(cand.salary)}/mo</span>
        ${selected ? '<span class="det sub">✓ hired</span>' : ''}
      </div>
      <div class="small dim">${h.esc(cand.trait)}</div>
      <div class="small"><span class="dim">claimed</span> ${h.bar(cand.claimed, 100, 10)}</div>
    </button>`;
}

function modelCard(c, tier, selected) {
  const { h } = c;
  const sel = selected ? ' style="border-color:var(--accent);color:var(--fg-hi)"' : '';
  const cost = config.tokenCosts[tier];
  const err = Math.round((config.errorRates[tier] || 0) * 100);
  const subtle = config.subtletyMods[tier] > 0 ? 'obvious errors'
    : config.subtletyMods[tier] < 0 ? 'subtle errors' : 'plain errors';
  return `
    <button class="row" data-action="pick-model" data-model="${tier}"${sel}
            style="flex-direction:column;align-items:flex-start;gap:2px">
      <div style="display:flex;gap:6px;width:100%;align-items:center">
        <span class="lab hi">${TIER_LABEL[tier]}</span>
        ${selected ? '<span class="det sub">✓ chosen</span>' : ''}
      </div>
      <div class="small dim">$${cost}/task · ${err}% error rate · ${subtle}</div>
    </button>`;
}

export function render(c) {
  const { h, draft } = c;
  prepare(draft);

  const hireBlocks = ROLES.map((role) => {
    const pool = draft.pool[role] || [];
    const cards = pool.map((cand) =>
      candCard(c, role, cand, draft.hires[role] && draft.hires[role].id === cand.id)
    ).join('');
    return `<div class="dim caps small" style="margin-top:6px">${role}</div>${cards || '<div class="dim small">none available</div>'}`;
  }).join('');

  const modelCards = TIERS.map((t) => modelCard(c, t, draft.model === t)).join('');
  const b = burn(draft);

  return `
    <div class="screen scroll">
      <h2 class="sub">The general store</h2>
      <div class="dim small">${h.esc(clerkLine(draft))}</div>

      <div class="hi caps" style="margin-top:8px">Hires</div>
      <div class="small dim">The resume is all you get. The first check is the first truth.</div>
      ${hireBlocks}

      <div class="hi caps" style="margin-top:10px">The model — the fourth hire</div>
      ${modelCards}

      <div class="card" style="margin-top:10px">
        Burn: <span class="money">${h.money(b)}/mo</span>
        <span class="dim">against ${h.money(config.contractMonthly)}/mo contract.</span>
      </div>
      <div class="menu">
        ${h.row({ key: 'enter', label: '▶ Set out on the trail', attrs: 'data-action="set-out"' })}
      </div>
    </div>`;
}
