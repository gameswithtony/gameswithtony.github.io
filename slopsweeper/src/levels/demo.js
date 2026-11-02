// @ts-check
// Campaign level 2 of 12 (2026-11-02). Tuned against the expert bot with
// `node src/sim/report.js`; src/levels/README.md §0 explains the rules every level is held to.
// After any change, rerun the report: the goal rate, beta curve, opening and hand-run columns
// all move together. The numbers below are the expert at full beta supply unless noted.
//
// THE DEMO adds a second capability. B is close and needs nothing clever; C sits past the
// handwritten gap, and its users need the beta. The opening decides which comes first.
//
// expert 86% at 6/8 · no beta 14% · scattered opening 59% · sloppy 86% · hand-only 0%
/** @type {import('./index.js').LevelDef} */
export const demo = {
  id: 'demo',
  name: 'The Demo',
  story:
    'Dana booked an investor demo for Friday. The investors want to watch someone sign up (B) and ' +
    'send an invoice (C). Signup is close to done. Invoicing needs code nobody has written yet. ' +
    "Investors don't read code, but they notice when a demo crashes.",
  map: `
................................
######B######...................
#############..#################
#############..#################
#############..######^^#########
#############..######^^#########
#####^^######..#################
#####^^######..#################
###############################C
A###############################
#############..#########^^######
#############..#########^^######
#############..#################
#############..#################
#############..#################
#############...................
`,
  arrivals: {count: 8, firstTick: 4, every: 1},
  goal: 6,
  patience: 5,
  mineDensity: 0.12,
  betaSupply: 1,
  blastRadius: 0,
  shapePool: 'compact',
  walkers: [
    {stops: ["B"]},
    {stops: ["B"]},
    {stops: ["C"]},
    {stops: ["C"]},
    {stops: ["C"]},
    {stops: ["B", "C"]},
    {stops: ["B", "C"]},
    {stops: ["C"]},
  ],
};
