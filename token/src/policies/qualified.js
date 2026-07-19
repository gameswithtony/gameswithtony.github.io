// qualified.js — the strong DETERMINISTIC player (PLAN.md §6 / build-plan Phase 3).
//
// Plays from visible information ONLY (the fair-bot boundary is law): it reads
// the `visibleState` projection + the current `pendingDecisions` decision, never
// hidden fields (Understanding, Calibration, defect pool, member internals). It
// also reads `config` — public tuning data, not hidden state.
//
// Heuristics (minus the cut systems — no reference checks, no pace/quality moves):
//   OUTFIT  hire QA + junior when the burn rate fits, judged from resumes and
//           salaries alone; pick the class with the most runway; free-frontier
//           quirk -> frontier model, else standard.
//   ROUTE   hard tasks to self while Energy > 40; feed the junior easy tasks;
//           review all AI output up to capacity; when capacity is spent, hand off
//           to an available human, else accept raw AI; clear backlog by routing it
//           (defer only as a last resort — clearing it makes the client happy).
//   AI-HUNT skip — qualified cures by hand (AI hunts seed hidden regressions and
//           decay Understanding); manual hunting is a focus.
//   FOCUS   rest below Energy 30; hunt when open severity or Cognitive Debt climb;
//           1:1 when a teammate's mood sours; otherwise bank Energy with a rest.
//
// DETERMINISTIC: choose()/outfit() never consult the rng argument. Same seed ->
// same choices. (The sim's own randomness still flows through the shared game rng.)

import { config } from '../../config.js';

const ROLES = ['junior', 'qa', 'senior'];
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// Tuning constants local to the policy (not config knobs — these shape *play*,
// not the game). Documented in the WP3 report.
const HARD_SELF_ENERGY = 40;   // self-build hard tasks while Energy is above this
const REST_ENERGY = 30;        // rest below this
const HUNT_CD = 4;             // hunt when Cognitive Debt reaches this

const hasOption = (d, id) => d.options.some((o) => o.id === id && !o.disabled);
const firstEnabled = (d) => (d.options.find((o) => !o.disabled) || d.options[0]).id;

// Map a route decision back to its task size using the VISIBLE projection only.
function routeSize(visible, decision) {
  const id = decision.id;
  if (id.startsWith('route-task-')) {
    const t = visible.tasks.find((x) => x.id === id.slice('route-task-'.length));
    return t ? t.size : 'medium';
  }
  if (id.startsWith('route-backlog-')) {
    const b = visible.backlog.find((x) => x.id === id.slice('route-backlog-'.length));
    return b ? b.size : 'medium';
  }
  return 'medium';
}

// Best candidate for a role: highest claimed Understanding (resume), tie-break on
// the lower salary. Deterministic — resumes and salaries only.
function bestCandidate(cands) {
  if (!cands || !cands.length) return -1;
  let bi = 0;
  for (let i = 1; i < cands.length; i++) {
    const c = cands[i], b = cands[bi];
    if (c.resumeUnd > b.resumeUnd || (c.resumeUnd === b.resumeUnd && c.salary < b.salary)) bi = i;
  }
  return bi;
}

export const qualified = {
  name: 'qualified',

  // offer.view = { classes:[{id,name,cash,multiplier,skills,quirks}], models:[...],
  //                candidates:{ junior:[{role,name,trait,salary,resumeUnd}], qa, senior } }
  // Returns { classId, model, hires:{ junior:index|null, qa:index|null, senior:index|null } }.
  outfit(offer, _rng) {
    // Class: the one with the most starting cash (runway = strong play).
    let cls = offer.classes[0];
    for (const c of offer.classes) if (c.cash > cls.cash) cls = c;

    // Model: exploit a free-frontier quirk if the class has one; else standard.
    const model = cls.quirks && cls.quirks.freeFrontier && offer.models.includes('frontier')
      ? 'frontier'
      : (offer.models.includes('standard') ? 'standard' : offer.models[0]);

    // Hires: QA (review capacity) + junior (cheap, compounds) when payroll leaves
    // room under the monthly contract for tokens and profit.
    const jIdx = bestCandidate(offer.candidates.junior);
    const qIdx = bestCandidate(offer.candidates.qa);
    const jSal = jIdx >= 0 ? offer.candidates.junior[jIdx].salary : 0;
    const qSal = qIdx >= 0 ? offer.candidates.qa[qIdx].salary : 0;
    const payrollCap = config.contractMonthly * 0.7;

    const hires = { junior: null, qa: null, senior: null };
    if (jIdx >= 0 && jSal <= payrollCap) hires.junior = jIdx;
    const juniorSal = hires.junior != null ? jSal : 0;
    if (qIdx >= 0 && juniorSal + qSal <= payrollCap) hires.qa = qIdx;

    return { classId: cls.id, model, hires };
  },

  choose(visible, decision, _rng) {
    // AI bug hunt: qualified never delegates the cure.
    if (decision.id === 'ai-hunt') return hasOption(decision, 'skip') ? 'skip' : firstEnabled(decision);

    if (decision.kind === 'route') {
      const size = routeSize(visible, decision);
      // Hard work you keep — protects Understanding while Energy allows.
      if (size === 'hard' && visible.energy > HARD_SELF_ENERGY && hasOption(decision, 'self')) return 'self';
      // Feed the junior the easy stuff so they compound.
      if (size === 'easy' && hasOption(decision, 'assign-junior')) return 'assign-junior';
      // Review every AI diff you can afford to.
      if (hasOption(decision, 'ai-review')) return 'ai-review';
      // Capacity spent: hand off to an available human before accepting raw AI.
      for (const role of ['senior', 'qa', 'junior']) if (hasOption(decision, `assign-${role}`)) return `assign-${role}`;
      if (hasOption(decision, 'ai')) return 'ai';
      // Nothing better: keep backlog rather than pay a slip fee.
      if (hasOption(decision, 'defer')) return 'defer';
      return firstEnabled(decision);
    }

    if (decision.kind === 'focus') {
      if (visible.energy < REST_ENERGY && hasOption(decision, 'rest')) return 'rest';
      if ((visible.openSeverity > 0 || visible.cd >= HUNT_CD) && hasOption(decision, 'hunt')) return 'hunt';
      for (const role of ROLES) {
        const m = visible.team[role];
        if (m && m.mood === '☹️' && hasOption(decision, `oneonone-${role}`)) return `oneonone-${role}`;
      }
      if (hasOption(decision, 'rest')) return 'rest';
      return firstEnabled(decision);
    }

    // Events: the generic decision surface exposes no effect data on option rows
    // (only id/label/disabled/detail), so a fair bot cannot rank branches by
    // outcome. Take the first offered branch. (Judgment call — see WP3 report.)
    return firstEnabled(decision);
  }
};

export default qualified;
