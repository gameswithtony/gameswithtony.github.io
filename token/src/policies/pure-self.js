// pure-self.js — never delegates to the model (build-plan Phase 3).
//
// The lone craftsperson: builds one task by hand each month (the single focus),
// slips or defers the rest, and refuses the AI on every axis — no raw AI, no
// AI+review, no AI hunt. Goes solo (no hires) so the Energy and money/client
// pressure of doing everything yourself lands squarely. Expected to fail most
// runs (Greybeard its best class). Deterministic.
//
// Reads the visible projection only.

const hasOption = (d, id) => d.options.some((o) => o.id === id && !o.disabled);
const firstEnabled = (d) => (d.options.find((o) => !o.disabled) || d.options[0]).id;

export const pureSelf = {
  name: 'pure-self',

  // Solo; model tier is irrelevant (never routes to the AI). Standard by default.
  outfit(offer, _rng) {
    const model = offer.models.includes('standard') ? 'standard' : offer.models[0];
    return { classId: offer.classes[0].id, model, hires: { junior: null, qa: null, senior: null } };
  },

  choose(visible, decision, _rng) {
    if (decision.id === 'ai-hunt') return hasOption(decision, 'skip') ? 'skip' : firstEnabled(decision);

    if (decision.kind === 'route') {
      // Build it yourself while the focus is free (once per month).
      if (hasOption(decision, 'self')) return 'self';
      // Otherwise hand to a human if one exists; never to the model.
      for (const role of ['senior', 'qa', 'junior']) if (hasOption(decision, `assign-${role}`)) return `assign-${role}`;
      if (hasOption(decision, 'defer')) return 'defer';   // keep backlog rather than pay
      if (hasOption(decision, 'slip')) return 'slip';
      // Last resort only if the surface forces it (avoids ai/ai-review by construction above).
      return firstEnabled(decision);
    }

    if (decision.kind === 'focus') {
      // Reached only when nothing was self-built this month.
      if (visible.energy < 30 && hasOption(decision, 'rest')) return 'rest';
      if (hasOption(decision, 'hunt')) return 'hunt';   // cure by hand, never the AI
      return firstEnabled(decision);
    }

    return firstEnabled(decision); // events
  }
};

export default pureSelf;
