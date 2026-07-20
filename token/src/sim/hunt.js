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
  // Sanctioned skin write-back channel (WP6). engine.js resolveHunt passes an
  // explicit skinModifier:0 for headless/policy runs, so those are byte-identical
  // to before. The interactive whack-a-mole session, which cannot reach the frozen
  // applyDecision signature, instead stashes its clamped performance modifier on a
  // TRANSIENT state field; we read it here when no explicit modifier was given, and
  // DELETE it from the returned state so it never persists into the serialized save
  // (keeping the drift/resume contracts honest — the skin touches sim state only
  // through this one clamped number).
  const mod = skinModifier || s._huntSkinModifier || 0;
  delete s._huntSkinModifier;
  const clampMod = clamp01ish(mod, H.skinModifierClamp);

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

/**
 * huntParams(state) — the ONE engine-sanctioned projection the hunt skin reads
 * to pace itself (MOREFUN D7: Spot the Bug). It runs on the full state (like the
 * engine, not the visibleState projection), but returns ONLY derived pacing the
 * skin needs — never raw Understanding, never the raw defect pool. This keeps
 * the fair-bot boundary: the skin's difficulty comes through this sanctioned
 * door, and screens still render everything else from visibleState.
 *
 * Read-only; no behavior change to any existing resolution path.
 *
 * @returns {{
 *   ammo:number, legibility:number, durationMs:number,
 *   spawnBudget:number, density:object, expectedFixes:number
 * }}
 */
export function huntParams(state) {
  const H = config.hunt;
  const dbg = clamp01((state.skills.debugging.und || 0) / 100); // hidden -> pacing only
  const pool = state.defects.length;
  const ammo = Math.max(0, state.capacity.total - state.capacity.spent);

  // MOREFUN D7: atrophy rendered as illegibility. Legibility is the fraction of
  // code panels the hunter can actually READ; the rest render as static. An
  // atrophied hunter stares at their own system and cannot parse it.
  const legibility = Math.round((0.30 + 0.65 * dbg) * 100) / 100;   // 0.30..0.95
  const durationMs = (H.timerSeconds || 45) * 1000;

  // Spawn budget: how many buggy boards the session can show, tied to the
  // (hidden) pool and Understanding. An empty pool => clean boards only; a deep
  // pool at high Understanding => bug after bug.
  const spawnBudget = pool > 0
    ? Math.max(3, Math.min(12, Math.round(pool * (0.6 + 0.8 * dbg))))
    : 0;

  return {
    ammo, legibility, durationMs, spawnBudget,
    density: provenanceDensity(state),
    expectedFixes: expectedManualFixes(state, ammo)
  };
}

// Per-provenance defect counts so the skin can label panels and cluster bugs in
// "unreviewed" modules (defect provenance). Read-only.
function provenanceDensity(state) {
  const counts = {};
  for (const d of state.defects) {
    const p = d.provenance || 'unknown';
    counts[p] = (counts[p] || 0) + 1;
  }
  return counts;
}

// The statistical par (fixed count at skinModifier 0) the skin's performance is
// judged against — mirrors resolveManualHunt's formula, read-only, for reporting.
function expectedManualFixes(state, ammo) {
  const H = config.hunt;
  const dbg = state.skills.debugging.und || 0;
  const pool = state.defects.length;
  const surfaceFrac = clamp01(H.baseSurface + H.undSurface * (dbg / 100));
  const surfaced = Math.min(pool, Math.round(pool * surfaceFrac));
  return Math.min(surfaced, Math.max(0, Math.floor(ammo)));
}
