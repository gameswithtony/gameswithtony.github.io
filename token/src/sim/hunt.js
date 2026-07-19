// hunt.js — statistical hunt resolution (PLAN.md §4.5). The whack-a-mole skin
// (WP6) only modulates expected fixes by +/-20%, clamped, via `skinModifier`;
// headless runs pass 0 (baseline). Pure module; returns { state, report }.

import { config } from '../../config.js';

const clone = (s) => structuredClone(s);
const clamp01 = (x) => Math.max(0, Math.min(1, x));

import { grow, delegateDecay } from './decay.js';

/**
 * Manual hunt. Surfacing scales with hidden Debugging Understanding; the carry
 * limit is `ammo` (remaining review capacity); overflow returns fully to the
 * pool (no partial credit). Each fix clears a live defect + one open-severity
 * point + pays down CD, and grows Debugging.
 *
 * @param {object} state
 * @param {{ammo:number, skinModifier?:number}} opts
 * @param {object} rng
 */
export function resolveManualHunt(state, { ammo, skinModifier = 0 }, rng) {
  const s = clone(state);
  const H = config.hunt;
  const clampMod = clamp01ish(skinModifier, H.skinModifierClamp);

  const debuggingUnd = s.skills.debugging.und;
  const pool = s.defects.length;

  // fraction of the pool that surfaces; low Understanding => the screen looks calm
  const surfaceFrac = clamp01((H.baseSurface + H.undSurface * (debuggingUnd / 100)) * (1 + clampMod));
  const surfaced = Math.min(pool, Math.round(pool * surfaceFrac));
  const fixed = Math.min(surfaced, Math.max(0, Math.floor(ammo)));

  // remove `fixed` live defects (overflow stays in the pool)
  s.defects.splice(0, fixed);
  s.openSeverity = Math.max(0, s.openSeverity - fixed);
  s.cd = Math.max(0, s.cd - fixed * H.cdPerFix);
  if (fixed > 0 || ammo > 0) {
    s.skills.debugging = grow(s.skills.debugging, config.hunt.debuggingGrowth);
  }

  return { state: s, report: { kind: 'manual', surfaced, fixed, ammo, poolBefore: pool } };
}

/**
 * AI hunt (delegate the cure). Closes a % of the live pool by model tier; each
 * fix may seed a NEW hidden regression; +1 CD per `cdPerFixes` fixes; ticks the
 * Debugging delegation streak (teaches nothing). Token cost accrues to
 * state.monthTokens. Zero review capacity spent — that's the temptation.
 */
export function resolveAiHunt(state, rng, { tier }) {
  const s = clone(state);
  const A = config.aiHunt;
  const pool = s.defects.length;
  const rate = A.closeRate[tier] ?? A.closeRate.standard;
  const fixed = Math.min(pool, Math.round(pool * rate));

  s.defects.splice(0, fixed);
  s.openSeverity = Math.max(0, s.openSeverity - fixed);

  // hidden regressions: each fix may quietly reopen/introduce a bug
  const regChance = A.regression[tier] ?? A.regression.standard;
  let regressions = 0;
  for (let i = 0; i < fixed; i++) {
    if (rng.chance(regChance)) {
      regressions++;
      s.defects.push({ severity: 1, provenance: 'ai-hunt-regression', monthShipped: s.month });
    }
  }

  s.cd += Math.floor(fixed / A.cdPerFixes);
  // ticks the Debugging decay streak — atrophies your future hunts
  s.skills.debugging = delegateDecay(s.skills.debugging, {
    base: config.decayBase, accel: config.decayAccel
  });

  const tokenCost = Math.round((config.tokenCosts[tier] ?? config.tokenCosts.standard) * A.tokenMult);
  s.monthTokens = (s.monthTokens || 0) + tokenCost;

  return { state: s, report: { kind: 'ai', fixed, regressions, tokenCost, poolBefore: pool } };
}

// Clamp a skin modifier symmetrically to +/- clampAmount.
function clamp01ish(mod, clampAmount) {
  return Math.max(-clampAmount, Math.min(clampAmount, mod));
}
