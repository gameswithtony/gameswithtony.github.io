// @ts-check
// Campaign level 6 of 12 (2026-11-02). Tuned against the expert bot with
// `node src/sim/report.js`; src/levels/README.md §0 explains the rules every level is held to.
// After any change, rerun the report: the goal rate, beta curve, opening and hand-run columns
// all move together. The numbers below are the expert at full beta supply unless noted.
//
// MOBILE is a trunk with four piers, four wide, a capability at each tip. Three betas, and
// every one of them is worth shipping: the curve climbs all the way.
//
// expert 73% at 9/12 · betas 0..3: 3/45/65/73% · scattered opening 54% · sloppy 75%
/** @type {import('./index.js').LevelDef} */
export const mobile = {
  id: 'mobile',
  name: 'Mobile',
  story:
    'Dana promised the board a mobile app this month. Phone users need invoices (B), payments ' +
    '(C), receipts (D) and reports (E), each at the end of its own long branch. A beta halfway ' +
    'down a branch lets users wait there while you finish it.',
  map: `
..................................
...##B#....##C#....##D#....##E#...
...####....####....####....####...
...####....####....####....####...
...####....####....####....####...
...####....####....####....####...
...####....####....####....####...
...####....####....####....####...
...####....####....####....####...
...####....####....####....####...
##################################
##################################
##################################
A#################################
##################################
##################################
##################################
`,
  arrivals: {count: 12, firstTick: 5, every: 1},
  goal: 9,
  patience: 7,
  mineDensity: 0.12,
  betaSupply: 3,
  blastRadius: 0,
  shapePool: 'compact+awkward',
  walkers: [
    {stops: ["B"]},
    {stops: ["B"]},
    {stops: ["C"]},
    {stops: ["C"]},
    {stops: ["D"]},
    {stops: ["D"]},
    {stops: ["E"]},
    {stops: ["E"]},
    {stops: ["B", "C"]},
    {stops: ["D", "E"]},
    {stops: ["C", "E"]},
    {stops: ["B", "D"]},
  ],
};
