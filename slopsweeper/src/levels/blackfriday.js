// @ts-check
// Campaign level 11 of 12 (2026-11-02). Tuned against the expert bot with
// `node src/sim/report.js`; src/levels/README.md §0 explains the rules every level is held to.
// After any change, rerun the report: the goal rate, beta curve, opening and hand-run columns
// all move together. The numbers below are the expert at full beta supply unless noted.
//
// BLACK FRIDAY: two waves (turns 4-10 and 15-21) into five capabilities, three of them down
// four-tall aisles. Defect rate 0.10 and patience 8 are what make careful play beat sloppy
// play here; at 0.14 the sloppy bot won.
//
// expert 60% at 11/14 · betas 0..4: 1/35/48/56/60% · scattered opening 46% · sloppy 62%
/** @type {import('./index.js').LevelDef} */
export const blackfriday = {
  id: 'blackfriday',
  name: 'Black Friday',
  story:
    'Every one of your customers runs a sale on the same day. Two waves of shoppers need carts ' +
    '(B), coupons (C), checkout (D), receipts (E) and shipping (F), and none of them will wait ' +
    'long. Ship betas early, one ahead of every aisle, and read the code before the crowd reaches ' +
    'it.',
  map: `
^^^^^^^^^^^#B##^^^^^^^^^^^^^^^^^^^
^^^^^^^^^^^####^^^^^^^^^^^^^^^^^^^
^^^^^^^^^^^####^^^^^^^^^^^^^^^^^^^
^^^^^^^^^^^####^^^^^^^^^^^^^^^^^^^
##################################
#################################D
##################################
##################################
##########################^^^^^^^^
##########################^^^^^^^^
##########################^^^^^^^^
##################################
A################################E
##################################
##################################
##########################^^^^^^^^
##########################^^^^^^^^
##########################^^^^^^^^
##################################
##################################
#################################F
##################################
^^^^^^^^^^^####^^^^^^^^^^^^^^^^^^^
^^^^^^^^^^^####^^^^^^^^^^^^^^^^^^^
^^^^^^^^^^^####^^^^^^^^^^^^^^^^^^^
^^^^^^^^^^^#C##^^^^^^^^^^^^^^^^^^^
`,
  arrivals: {at: [4, 5, 6, 7, 8, 9, 10, 15, 16, 17, 18, 19, 20, 21]},
  goal: 11,
  patience: 8,
  mineDensity: 0.1,
  betaSupply: 4,
  blastRadius: 0,
  shapePool: 'compact+awkward',
  walkers: [
    {stops: ["B"]},
    {stops: ["C"]},
    {stops: ["D"]},
    {stops: ["E"]},
    {stops: ["F"]},
    {stops: ["B", "D"]},
    {stops: ["C", "E"]},
    {stops: ["F"], patience: 4},
    {stops: ["D", "F"]},
    {stops: ["E", "F"]},
    {stops: ["B", "C"]},
    {stops: ["D"]},
    {stops: ["E"]},
    {stops: ["B", "F"], ordered: true},
  ],
};
