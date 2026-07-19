// tasks.js — STUB (WP1). Minimal fresh-task generator to exercise the Plan step.
// WP2 replaces this with themed titles and size weighting.

const SIZES = ['easy', 'medium', 'hard'];

/**
 * Generate `count` fresh feature tasks for the given month.
 * @param {object} rng  seeded RNG (from sim/rng.js)
 * @param {number} count
 * @param {number} month
 */
export function generateTasks(rng, count, month) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const size = rng.pick(SIZES);
    out.push({ id: `t${month}-${i}`, title: `Feature ${month}.${i} (${size})`, size, route: null });
  }
  return out;
}

export default generateTasks;
