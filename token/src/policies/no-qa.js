// no-qa.js — qualified play, minus the QA hire (build-plan Phase 3).
//
// Identical to `qualified` in every routed/focus/event choice; the ONLY change is
// outfitting never hires a QA. Its survival should track qualified through Q1 then
// diverge mid-year as unreviewed defects (no QA review-capacity bonus, tighter
// review budget) accumulate. Deterministic, like qualified.

import { qualified } from './qualified.js';

export const noQa = {
  name: 'no-qa',

  outfit(offer, rng) {
    const sel = qualified.outfit(offer, rng);
    sel.hires.qa = null;   // the one difference
    return sel;
  },

  choose(visible, decision, rng) {
    return qualified.choose(visible, decision, rng);
  }
};

export default noQa;
