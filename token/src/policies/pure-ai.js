// pure-ai.js — everything raw, never reviews, AI-hunts (build-plan Phase 3).
//
// The delegation-to-the-hilt player: every task routed to raw AI (no review, no
// self-build, no teammates), the bug hunt always handed to the AI, the focus
// spent resting. Velocity heaven, Understanding hell — should reach month 12 but
// fail the Renewal Review (Cognitive Debt buries the Understanding checks).
//
// Reads the visible projection only; deterministic (no rng use).

const hasOption = (d, id) => d.options.some((o) => o.id === id && !o.disabled);
const firstEnabled = (d) => (d.options.find((o) => !o.disabled) || d.options[0]).id;

export const pureAi = {
  name: 'pure-ai',

  // No hires (minimize burn); standard model.
  outfit(offer, _rng) {
    const model = offer.models.includes('standard') ? 'standard' : offer.models[0];
    return { classId: offer.classes[0].id, model, hires: { junior: null, qa: null, senior: null } };
  },

  choose(_visible, decision, _rng) {
    if (decision.id === 'ai-hunt') return hasOption(decision, 'do') ? 'do' : firstEnabled(decision);
    if (decision.kind === 'route') return hasOption(decision, 'ai') ? 'ai' : firstEnabled(decision);
    if (decision.kind === 'focus') return hasOption(decision, 'rest') ? 'rest' : firstEnabled(decision);
    return firstEnabled(decision); // events
  }
};

export default pureAi;
