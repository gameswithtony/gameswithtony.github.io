// candidates.js — the hiring pool. Two candidates per role, seeded from the RNG.
// A resume is a Confidence artifact: you see the CLAIMED understanding and the
// salary; the TRUE understanding stays hidden until a check reveals it. Resumes
// run ~5 points optimistic (config.resumeBias); the 'inflated resume' trait runs
// far worse and is undiscoverable until tested. Pillar 2 (Confidence vs. hidden
// Understanding) is live before month one.
//
// ── HOW TO ADD / EDIT A CANDIDATE SOURCE ─────────────────────────────────────
// Names and traits are plain data below. The NUMBERS live in config.js, not here
// (claimedRanges, salaryBands, resumeBias, resumeVariance) — tune them there so
// the balance harness sees the change. A generated candidate is:
//   { id, role, name, salary, claimed, und, trait }
//     claimed  visible resume number (Confidence)
//     und      TRUE hidden Understanding = claimed + resumeBias ± variance,
//              clamped 0–100. 'inflated resume' subtracts an extra hidden gap.
//     trait    one of the four below; each is a predicate/engine hook:
//              'flight risk'        recruiter events weighted toward them
//              'quick study'        +growth per task assigned (engine)
//              'steady under pages' +10 on incident checks (hook)
//              'inflated resume'    claimed sits far above true; only a check tells
// initState()'s makeMember reads {name, trait, salary, und, morale}; morale
// defaults to 60 there. Keep names short — the UI is 640×400.
// ─────────────────────────────────────────────────────────────────────────────

import { config } from '../../config.js';

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// Name pools. Deliberately generic-tech-industry; flavor, not a joke to land.
const NAMES = {
  junior: ['Devon', 'Priya', 'Marcus', 'Wen', 'Tuli', 'Hassan', 'Bex', 'Cole'],
  qa: ['Renata', 'Omar', 'Sunil', 'Grace', 'Ada', 'Petra', 'Yuki', 'Diego'],
  senior: ['Vera', 'Malik', 'Dana', 'Ingrid', 'Theo', 'Nadia', 'Boris', 'Lena']
};

const TRAITS = ['flight risk', 'quick study', 'steady under pages', 'inflated resume'];

// How far below the claimed number an 'inflated resume' truly sits (on top of the
// normal resumeBias). Documented content knob; kept here because it is a property
// of the trait, not a global balance dial.
const INFLATED_EXTRA_GAP = 22;

const ROLES = ['junior', 'qa', 'senior'];

/** Build one candidate for a role. */
function makeCandidate(rng, role, index, name) {
  const [cLo, cHi] = config.claimedRanges[role];
  const [sLo, sHi] = config.salaryBands[role];
  const variance = config.resumeVariance[role];

  const claimed = rng.range(cLo, cHi);
  const salary = rng.range(sLo, sHi);
  const trait = rng.pick(TRAITS);

  let und = claimed + config.resumeBias + rng.range(-variance, variance);
  if (trait === 'inflated resume') und -= INFLATED_EXTRA_GAP;
  und = clamp(Math.round(und), 0, 100);

  return { id: `${role}-${index}`, role, name, salary, claimed, und, trait };
}

/**
 * Generate the full hiring pool: two candidates per role.
 * @param {object} rng seeded RNG (sim/rng.js)
 * @returns {{junior:object[], qa:object[], senior:object[]}}
 */
export function generateCandidates(rng) {
  const pool = {};
  for (const role of ROLES) {
    const names = rng.shuffle(NAMES[role]);
    pool[role] = [
      makeCandidate(rng, role, 0, names[0]),
      makeCandidate(rng, role, 1, names[1])
    ];
  }
  return pool;
}

export default generateCandidates;
