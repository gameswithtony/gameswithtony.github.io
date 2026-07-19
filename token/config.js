// config.js — every tuning knob for The Token Trail.
//
// Source: token-trail-economy.md §"Baseline numbers" and §"Tuning knobs & the
// balance harness", reconciled with PLAN.md §1 locked decisions.
//
// CUT SYSTEMS (PLAN.md §1) — deliberately absent, do not re-add:
//   - no pace/quality sliders (both cut)           -> no slider knobs
//   - no reference-check step (cut)                -> no referenceCheckCost
//   - no contingencies (cut)                       -> no contingency knobs
//   - no member burnout stat (cut)                 -> members carry und + morale only
//
// This is plain data, JSON-serializable, no DOM, no functions. Tune freely; the
// balance harness (WP3/WP4) is the authority on what these numbers should be.
//
// NOTE ON VERSION: PLAN.md §6 says "baseline v0.2 numbers"; the economy doc's
// baseline table is headed v0.3. They are the same numbers in practice — the
// economy doc is the numeric source of truth, so these are its v0.3 baselines.
// Flagged in the WP0/WP1 report.

export const config = {
  // --- Clock -------------------------------------------------------------
  months: 12,
  majorMonths: [3, 6, 9, 12],   // quarter-end set pieces; 12 is the Renewal Review
  tasksPerMonth: { min: 2, max: 3 },
  eventChance: 0.65,            // chance of a regular-deck draw on a non-quarter month

  // --- Review capacity ---------------------------------------------------
  capacityBase: 3,
  capacityQaBonus: 2,          // +2 review capacity while a QA is hired
  // capacity penalty: -1 for each threshold your Energy is below (low-energy bands)
  energyBands: { capacityPenaltyThresholds: [60, 30] },

  // --- Skill dynamics (Understanding = hidden truth; Confidence = shown) --
  decayBase: 1,                // AI-raw delegation: -(base + accel * streak)
  decayAccel: 0.5,             // streak acceleration on that decay
  rustRate: 0.5,               // -0.5/month to any skill unused that month
  growthRates: {
    selfCoding: 2,             // self-build a task -> +2 Coding Understanding
    huntDebugging: 2,          // manual hunt -> +2 Debugging Understanding
    reviewJudgment: 1,         // review a diff -> +1 Judgment Understanding
    assignMember: 3            // assign to teammate -> their und +3
  },
  diminishingThreshold: 80,    // self-Coding growth halves at/above this und
  diminishingFactor: 0.5,
  confPerShip: 1,              // Confidence +1 per shipped success (any route)
  calibrationSnap: 0.5,        // a check reveal snaps Confidence 50% toward Understanding
  confConvergeFraction: 0.25,  // self-work/review nudge Confidence toward Understanding
  reviewUndDivisor: 120,       // AI+review defect risk = modelRate * (1 - yourUnd/divisor)

  // Understanding floors, set by HOW a skill was learned
  floors: { doing: 40, watching: 0 },

  // --- The model (the fourth hire) --------------------------------------
  tokenCosts: { budget: 50, standard: 100, frontier: 200 },   // per task
  errorRates: { budget: 0.25, standard: 0.15, frontier: 0.08 },
  subtletyMods: { budget: 0.10, standard: 0, frontier: -0.10 }, // review-catch adjustment
  deprecationWeights: { budget: 1, standard: 2, frontier: 4 },  // event weight scales with tier

  // --- AI bug hunt (delegate the cure) ----------------------------------
  aiHunt: {
    tokenMult: 1.5,                                              // ~1.5x a task's token cost
    closeRate: { budget: 0.40, standard: 0.55, frontier: 0.70 },// % of live pool closed
    regression: { budget: 0.15, standard: 0.10, frontier: 0.06 },// hidden new-bug chance per fix
    cdPerFixes: 3                                                // +1 Cognitive Debt per 3 fixes
  },

  // --- Manual bug hunt (the cure you understand) ------------------------
  hunt: {
    timerSeconds: 45,          // session length (skin)
    skinModifierClamp: 0.20,   // whack-a-mole performance modulates baseline by +/-20%, clamped
    baseSurface: 0.30,         // fraction of the pool that surfaces at zero Understanding...
    undSurface: 0.70,          // ...plus this fraction scaled by Debugging Understanding
    cdPerFix: 1,               // manual fix pays down this much Cognitive Debt
    debuggingGrowth: 2         // +2 Debugging Understanding for hunting
  },

  // --- Cognitive Debt ----------------------------------------------------
  cdCoef: 0.10,                // incident severity multiplier: (1 + cdCoef * CD)
  cdPerRawAi: 1,               // +1 CD per unreviewed AI task

  // --- Money / the ledger -----------------------------------------------
  contractMonthly: 2500,       // revenue in
  slaPerSeverity: 250,         // revenue lost per open incident-severity point
  slipFee: 250,                // -$ when a fresh task slips
  goodwillBonus: 150,          // +$ when a backlog item is cleared
  contractorCost: 1000,        // the "ferry" option in majors
  openSeverityCap: 20,         // severity pool ceiling

  // --- Client happiness (0-100) -----------------------------------------
  clientStart: 70,
  clientMin: 0,
  clientMax: 100,
  clientDeltas: {
    slip: -5,                  // per slipped task
    openSeverityPerPoint: -5,  // per open severity point, per month
    backlogLingerPerItem: -1,  // per backlog item left lingering, per month
    allShipped: 2,             // a month with zero slips
    backlogClear: 5            // per backlog item cleared
  },
  renewalClientMod: { high: 75, low: 35, amount: 10 }, // DC -10 when client>=75, +10 when <=35

  // --- Renewal Review (month 12, fixed) ---------------------------------
  renewal: { baseDc: 55, cdCoef: 2, needed: 2, of: 3 }, // dc = base + cdCoef*CD -/+ clientMod

  // --- Incidents ---------------------------------------------------------
  incident: {
    flarePerDefect: 0.08,      // monthly flare chance = min(flarePerDefect * pool, flareCap)
    flareCap: 0.70,
    baseSeverity: 3,           // default base if an incident template omits one
    responderPassMult: 0.25,   // severity * 0.25 when the responder passes the check
    defectPoolDivisor: 3       // + floor(defectPool / 3)
  },

  // --- Energy ------------------------------------------------------------
  energyStart: 100,
  energyMax: 100,
  restEnergy: 30,              // Rest focus -> +30 Energy
  restMoraleAura: 5,           // Rest -> small team-morale aura
  oneOnOneMorale: 10,          // 1:1 focus -> +10 that teammate's morale
  assignMorale: 5,             // assigning work -> +morale for that teammate
  taskEnergyCost: { easy: 5, medium: 10, hard: 15 },  // self-build energy cost by size
  hardTaskUndThreshold: 60,    // Hard tasks risky below this Understanding...
  hardAiErrorMult: 1.5,        // ...and AI error x1.5 on Hard tasks

  // --- Outfitting: candidates (resume = claimed; true = claimed + bias +/- variance) ---
  resumeBias: -5,              // resumes average 5 points optimistic
  resumeVariance: { junior: 10, qa: 10, senior: 15 },
  claimedRanges: { junior: [20, 40], qa: [40, 60], senior: [55, 80] },
  salaryBands: { junior: [150, 250], qa: [200, 300], senior: [350, 500] },
  traitMods: {
    quickStudyGrowth: 1,       // +growth per task
    steadyUnderPagesCheck: 10, // +10 on incident checks
    flightRiskWeight: 2        // recruiter events weighted up
  },

  // --- Member mood icon thresholds (visible projection only) -------------
  moodThresholds: { happy: 70, ok: 40 }, // >=happy 🙂, >=ok 😐, else ☹️

  // --- Event / effect magnitude caps (schema-enforced in WP2) -----------
  eventEffectCaps: {
    money: 800, energy: 20, skill: 5, cd: 2, defects: 3, client: 15, morale: 20,
    majorMultiplier: 2         // majors get 2x the caps
  },

  // --- Scoring (v1 placeholder; tune in WP4) -----------------------------
  scoring: {
    moneyDivisor: 100,
    teamRetainedBonus: 25,
    clientDivisor: 2,
    endingBonus: { qualified: 200, impostor: 0 }
  }
};

export default config;
