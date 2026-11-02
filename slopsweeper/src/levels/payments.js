// @ts-check
// Campaign level 4 of 12 (2026-11-02). Tuned against the expert bot with
// `node src/sim/report.js`; src/levels/README.md §0 explains the rules every level is held to.
// After any change, rerun the report: the goal rate, beta curve, opening and hand-run columns
// all move together. The numbers below are the expert at full beta supply unless noted.
//
// PAYMENTS is the first level with two branches users need at once, north (B) and east (C),
// each behind a four-wide channel. One beta per branch: the beta curve is the point.
//
// expert 75% at 9/10 · betas 0/1/2: 7/62/75% · scattered opening 51% · sloppy 61%
/** @type {import('./index.js').LevelDef} */
export const payments = {
  id: 'payments',
  name: 'Payments',
  story:
    'The enterprise deal closed, and now everyone wants to pay you. Some need account settings ' +
    '(B), some need checkout (C), and some need both. Code that touches money is code you write ' +
    'by hand, so the narrow parts are yours. You have two betas this time, one for each group.',
  map: `
......B...........................
......#...........................
....####..........................
....####..........................
....####..........................
....####..........................
....####..........................
....####..........................
###############...................
###############.........##########
###############.........##########
#########^^####.........####^^####
#########^^#################^^####
##################################
A################################C
##################################
###############.........##########
###############.........###^^#####
###############.........###^^#####
###############.........##########
###############.........##########
###############...................
`,
  arrivals: {count: 10, firstTick: 5, every: 1},
  goal: 9,
  patience: 7,
  mineDensity: 0.12,
  betaSupply: 2,
  blastRadius: 0,
  shapePool: 'compact',
  walkers: [
    {stops: ["B"]},
    {stops: ["B"]},
    {stops: ["B"]},
    {stops: ["C"]},
    {stops: ["C"]},
    {stops: ["C"]},
    {stops: ["C"]},
    {stops: ["B", "C"]},
    {stops: ["B", "C"]},
    {stops: ["B", "C"]},
  ],
};
