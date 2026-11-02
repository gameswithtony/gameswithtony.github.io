// @ts-check
// Campaign level 9 of 12 (2026-11-02). Tuned against the expert bot with
// `node src/sim/report.js`; src/levels/README.md §0 explains the rules every level is held to.
// After any change, rerun the report: the goal rate, beta curve, opening and hand-run columns
// all move together. The numbers below are the expert at full beta supply unless noted.
//
// INTERNATIONAL is a switchback: B along the first row from the middle, C and D down two
// four-wide crossings. Lots of close calls (1.7 a game). Known gap: the opening barely
// matters here, even with A moved to the middle of the top row.
//
// expert 65% at 7/12 · betas 0..3: 9/52/61/65% · sloppy 80% · opening worth little (69%)
/** @type {import('./index.js').LevelDef} */
export const international = {
  id: 'international',
  name: 'International',
  story:
    'The company is expanding into three countries. Users need local taxes (B), local currency ' +
    '(C) and local banks (D), each farther along the same winding route. Users headed for all three ' +
    'will need more than one beta.',
  map: `
###########A############
########################
B#######################
########################
########################
..................####..
..................####..
..................####..
..................####..
########################
########################
C#######################
########################
########################
########################
..####..................
..####..................
..####..................
..####..................
########################
########################
########################
#######################D
########################
########################
`,
  arrivals: {count: 12, firstTick: 6, every: 1},
  goal: 7,
  patience: 7,
  mineDensity: 0.13,
  betaSupply: 3,
  blastRadius: 0,
  shapePool: 'compact+awkward',
  walkers: [
    {stops: ["B"]},
    {stops: ["B"]},
    {stops: ["C"]},
    {stops: ["C"]},
    {stops: ["C"], patience: 5},
    {stops: ["D"]},
    {stops: ["D"]},
    {stops: ["D"]},
    {stops: ["B", "D"]},
    {stops: ["C", "D"], ordered: true},
    {stops: ["B", "C", "D"], ordered: true},
    {stops: ["D"], patience: 5},
  ],
};
