// decay.js — the Confidence/Understanding bookkeeping. The subtlest math in the
// game (PLAN.md §8), kept here as small pure functions on a single skill object.
//
// A skill = { conf, und, floor, streak }.
//   und   = hidden Understanding (the truth)
//   conf  = shown Confidence
//   floor = decay/rust floor for und, set by how the skill was learned
//   streak= consecutive AI-raw delegations, accelerates decay
//
// Every function returns a NEW skill object; inputs are never mutated.

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

/** Growth from doing the work (self-build, hunt, review, assign). Diminishes
 *  above a threshold. Caps und at 100. Does not touch streak. */
export function grow(skill, amount, { diminishThreshold = null, diminishFactor = 0.5 } = {}) {
  let inc = amount;
  if (diminishThreshold != null && skill.und >= diminishThreshold) inc *= diminishFactor;
  return { ...skill, und: clamp(skill.und + inc, 0, 100) };
}

/** AI-raw delegation decay: und -= (base + accel*streak), floored; streak++.
 *  This is the acceleration curve — the longer you delegate, the faster you rot. */
export function delegateDecay(skill, { base, accel }) {
  const drop = base + accel * skill.streak;
  return {
    ...skill,
    und: Math.max(skill.floor, skill.und - drop),
    streak: skill.streak + 1
  };
}

/** AI+review decay: half the raw drop, still floored; streak still advances. */
export function reviewDecay(skill, { base, accel }) {
  const drop = (base + accel * skill.streak) / 2;
  return {
    ...skill,
    und: Math.max(skill.floor, skill.und - drop),
    streak: skill.streak + 1
  };
}

/** Rust: a skill unused this month loses `rate`, floored. */
export function rust(skill, { rate }) {
  return { ...skill, und: Math.max(skill.floor, skill.und - rate) };
}

/** Reset the delegation streak (skill was actively grown by you). */
export function resetStreak(skill) {
  return skill.streak === 0 ? skill : { ...skill, streak: 0 };
}

/** Confidence +delta per shipped success (any route), capped at 100. */
export function shipConf(skill, { confPerShip = 1 } = {}) {
  return { ...skill, conf: clamp(skill.conf + confPerShip, 0, 100) };
}

/** Self-work / review nudge Confidence a fraction of the way toward truth. */
export function converge(skill, { fraction = 0.25 } = {}) {
  return { ...skill, conf: clamp(skill.conf + (skill.und - skill.conf) * fraction, 0, 100) };
}

/** A check reveal snaps Confidence `fraction` of the way to reality (default 50%). */
export function revealSnap(skill, { fraction = 0.5 } = {}) {
  return { ...skill, conf: clamp(skill.conf + (skill.und - skill.conf) * fraction, 0, 100) };
}

/** Derived Calibration: 100 - mean(|conf - und|) across the three skills.
 *  Never stored in state — computed on demand (reveals, postmortem, score). */
export function calibration(skills) {
  const keys = ['coding', 'debugging', 'judgment'];
  const total = keys.reduce((a, k) => a + Math.abs(skills[k].conf - skills[k].und), 0);
  return 100 - total / keys.length;
}
