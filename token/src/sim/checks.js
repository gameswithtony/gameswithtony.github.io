// checks.js — d100 vs hidden Understanding, with you / member / team targets.
//
// A check names a skill, a difficulty (dc), and a target. Resolution formula
// (a WP1 design call — documented in the report):
//
//     effective = understanding - (dc - 50) + bonus
//     success   = d100() <= effective
//
// dc = 50 is neutral (roll straight against Understanding); higher dc is harder.
// This uses BOTH the hidden Understanding and the event's dc, stays d100-based,
// and matches "every check is a d100 against hidden Understanding" (economy §Event
// system) while honoring the per-event dc and the renewal dc formula.
//
// Pure module: reads state, never mutates it.

/** Best hidden Understanding "in the shop" for a skill — you plus hired members.
 *  Members carry a single Understanding; you contribute the named skill. */
export function bestTeamUnd(state, skillId) {
  let best = state.skills[skillId].und;
  for (const role of ['junior', 'qa', 'senior']) {
    const m = state.team[role];
    if (m) best = Math.max(best, m.und);
  }
  return best;
}

/** Resolve a check target to { kind, name?, und } — or null if it names an
 *  unhired member (the engine prunes such choices; this is the safety net). */
export function resolveTarget(state, target, skillId) {
  if (target == null || target === 'you') {
    return { kind: 'you', und: state.skills[skillId].und };
  }
  if (target === 'team') {
    return { kind: 'team', und: bestTeamUnd(state, skillId) };
  }
  const m = state.team[target];
  if (!m) return null; // choice naming an unhired member — pruned upstream
  return { kind: 'member', name: target, und: m.und };
}

/**
 * Run a check. Returns:
 *   { valid, success, roll, effective, dc, understanding, target:{kind,name} }
 * `valid:false` only when the target is an unhired member.
 */
export function runCheck(state, check, rng, { bonus = 0 } = {}) {
  const t = resolveTarget(state, check.target, check.skill);
  if (!t) return { valid: false, success: false };
  const dc = check.dc ?? 50;
  const effective = t.und - (dc - 50) + bonus;
  const roll = rng.d100();
  return {
    valid: true,
    success: roll <= effective,
    roll,
    effective,
    dc,
    understanding: t.und,
    target: { kind: t.kind, name: t.name ?? null },
    skill: check.skill
  };
}
