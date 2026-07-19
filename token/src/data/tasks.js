// tasks.js — the feature work that arrives each month. Deadpan client-request
// titles; a size (easy/medium/hard) that sets self-build energy cost and AI risk.
// Sizes are weighted toward easy/medium so Hard tasks feel like the ones that
// bite (Hard is risky below Understanding 60 and AI-errors ×1.5 — see config).
//
// ── HOW TO ADD A TASK TITLE ──────────────────────────────────────────────────
// Append a string to TITLES. Titles are cosmetic — routing consequences come
// from `size`, not the words. The generator returns objects the engine consumes:
//   { id, title, size, route: null }
// `id` is unique within the month (t{month}-{i}); the engine builds decision ids
// and backlog ids from it, so keep the shape. Size distribution is SIZE_WEIGHTS.
// Task NUMBERS (energy cost, AI mult, count per month) live in config.js.
// ─────────────────────────────────────────────────────────────────────────────

// Plausible, faintly weary client asks. The joke is that they are all "small."
const TITLES = [
  'Payment retry logic',
  'Dark mode toggle',
  'CSV export (again)',
  'Password reset flow',
  'Search that actually searches',
  'Onboarding wizard, step 4',
  'Timezone handling',
  'The dashboard, but faster',
  'Webhook delivery retries',
  'Soft-delete for everything',
  'Rate limiting on the API',
  'Email digest, opt-in',
  'Bulk import from spreadsheet',
  'Two-factor auth',
  'Audit log for the audit',
  'Feature flags for the feature flags',
  'Infinite scroll, finite budget',
  'PDF invoices',
  'Undo, and then redo',
  'Analytics that leadership will ignore'
];

// Size weighting: mostly small, a Hard now and then. Weighted pick below.
const SIZE_WEIGHTS = [
  { size: 'easy', weight: 4 },
  { size: 'medium', weight: 4 },
  { size: 'hard', weight: 2 }
];

function pickSize(rng) {
  const total = SIZE_WEIGHTS.reduce((a, x) => a + x.weight, 0);
  let r = rng.next() * total;
  for (const x of SIZE_WEIGHTS) {
    r -= x.weight;
    if (r < 0) return x.size;
  }
  return 'medium';
}

/**
 * Generate `count` fresh feature tasks for the given month.
 * @param {object} rng   seeded RNG (sim/rng.js)
 * @param {number} count how many tasks (config.tasksPerMonth)
 * @param {number} month current month (for stable ids)
 */
export function generateTasks(rng, count, month) {
  const titles = rng.shuffle(TITLES);
  const out = [];
  for (let i = 0; i < count; i++) {
    const size = pickSize(rng);
    const title = titles[i % titles.length];
    out.push({ id: `t${month}-${i}`, title, size, route: null });
  }
  return out;
}

export default generateTasks;
