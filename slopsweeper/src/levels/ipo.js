// @ts-check
// Campaign level 12 of 12 (2026-11-02). Tuned against the expert bot with
// `node src/sim/report.js`; src/levels/README.md §0 explains the rules every level is held to.
// After any change, rerun the report: the goal rate, beta curve, opening and hand-run columns
// all move together. The numbers below are the expert at full beta supply unless noted.
//
// LAUNCH DAY is the finale: three lanes split by firewalls, five capabilities, ordered pairs
// kept inside one lane (cross-lane stops meant 60-tile walks back through A), and spreading
// blasts. The owner's rule: near perfect, so the goal is everyone but one. Patience is high
// on purpose; the test is juggling five capabilities without losing anyone.
//
// expert 59% at 7/8 (48% perfect) · betas 0..4: 23/46/53/61/59% · sloppy 50%
/** @type {import('./index.js').LevelDef} */
export const ipo = {
  id: 'ipo',
  name: 'Launch Day',
  story:
    'The acquisition closes if the public launch goes well. Every capability you built this year ' +
    'is on one map, B through F, behind firewalls, with checklists that go in order. Launch day ' +
    'forgives one lost user and no more. Dana says to treat it like any other Tuesday. It is a ' +
    'Thursday.',
  map: `
^^^^^^^^^^E#^^^^^^^^^^
^^^^^#################
#####################B
######################
######################
#####^^^^^^^^^^^^^^^^^
######################
#####################C
A#####################
######################
#####^^^#######^^^^^^^
#####^^^^^^^^^^^^^^^^^
######################
######################
#####################D
^^^^^#################
^^^^^^^^^^F#^^^^^^^^^^
`,
  arrivals: {count: 8, firstTick: 6, every: 3},
  goal: 7,
  patience: 16,
  mineDensity: 0.1,
  betaSupply: 4,
  blastRadius: 1,
  shapePool: 'compact+awkward',
  walkers: [
    {stops: ["B"]},
    {stops: ["C"]},
    {stops: ["D"]},
    {stops: ["E"]},
    {stops: ["F"]},
    {stops: ["E", "B"], ordered: true},
    {stops: ["F", "D"], ordered: true},
    {stops: ["C"]},
  ],
};
