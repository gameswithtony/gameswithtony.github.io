// random.js — the floor: pick a random enabled option for every decision, and a
// random outfit (build-plan Phase 3, "floor check"). Establishes the low-water
// mark a real strategy must beat (target win rate <= 5%).
//
// The ONLY policy that uses randomness in its choices. It draws from the
// policy-local rng passed by the runner (a stream distinct from the sim's own
// rng, so it never disturbs run determinism / save-resume). Reads the visible
// projection only.

export const random = {
  name: 'random',

  outfit(offer, rng) {
    const cls = offer.classes[Math.floor(rng.next() * offer.classes.length)];
    const model = offer.models[Math.floor(rng.next() * offer.models.length)];
    const hires = { junior: null, qa: null, senior: null };
    for (const role of ['junior', 'qa', 'senior']) {
      const cands = offer.candidates[role];
      if (cands && cands.length && rng.next() < 0.5) {
        hires[role] = Math.floor(rng.next() * cands.length);
      }
    }
    return { classId: cls.id, model, hires };
  },

  choose(_visible, decision, rng) {
    const enabled = decision.options.filter((o) => !o.disabled);
    const pool = enabled.length ? enabled : decision.options;
    return pool[Math.floor(rng.next() * pool.length)].id;
  }
};

export default random;
