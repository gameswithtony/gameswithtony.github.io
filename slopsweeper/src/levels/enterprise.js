// @ts-check
// Campaign level 3 of 12 (2026-11-02). Tuned against the expert bot with
// `node src/sim/report.js`; src/levels/README.md §0 explains the rules every level is held to.
// After any change, rerun the report: the goal rate, beta curve, opening and hand-run columns
// all move together. The numbers below are the expert at full beta supply unless noted.
//
// ENTERPRISE introduces ordered itineraries: B, then C, then D, rooms joined by four-wide
// channels. The chain runs one way, so one beta carries it; patience is short instead.
// A smaller stop refill (destRefill 0.25) was tried and did not make a second beta matter.
//
// expert 79% at 8/10 · betas 0/1/2: 21/73/79% · scattered opening 61% · sloppy 67%
/** @type {import('./index.js').LevelDef} */
export const enterprise = {
  id: 'enterprise',
  name: 'Enterprise',
  story:
    'An enterprise client signed a contract with a strict onboarding checklist. Every new account ' +
    'needs single sign-on (B), then permissions (C), then billing (D), in that order. Reaching ' +
    "billing early doesn't count. Their IT department checks.",
  map: `
##################################
##################################
##################################
##############B###################
....####.............####^^#######
....####.............####^^######C
....####.............#############
....####.............#############
....####.............#############
############.........#############
############.........#############
############..............####....
############..............####....
############..............####....
#####^^#####..............####....
A####^^#####..............####....
############.....#################
############.....#################
############.....#################
############.....#################
############.....#################
############.....D################
`,
  arrivals: {count: 10, firstTick: 3, every: 1},
  goal: 8,
  patience: 4,
  mineDensity: 0.12,
  betaSupply: 2,
  blastRadius: 0,
  shapePool: 'compact+awkward',
  walkers: [
    {stops: ["B", "C", "D"], ordered: true},
    {stops: ["B", "C", "D"], ordered: true},
    {stops: ["B", "C", "D"], ordered: true},
    {stops: ["B", "C"], ordered: true},
    {stops: ["B", "C"], ordered: true},
    {stops: ["B"]},
    {stops: ["B"]},
    {stops: ["C", "D"], ordered: true},
    {stops: ["B", "D"], ordered: true},
    {stops: ["B", "C", "D"], ordered: true, patience: 9},
  ],
};
