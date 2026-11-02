// @ts-check
// Campaign level 8 of 12 (2026-11-02). Tuned against the expert bot with
// `node src/sim/report.js`; src/levels/README.md §0 explains the rules every level is held to.
// After any change, rerun the report: the goal rate, beta curve, opening and hand-run columns
// all move together. The numbers below are the expert at full beta supply unless noted.
//
// THE REWRITE is a ring around the old system with four capabilities and a tight spot each
// way round. Ordered pairs cross the ring, so direction is a real choice.
//
// expert 67% at 9/12 · betas 0..3: 12/50/59/67% · sloppy 71% · opening worth little (66%)
/** @type {import('./index.js').LevelDef} */
export const rewrite = {
  id: 'rewrite',
  name: 'The Rewrite',
  story:
    'The original system is too slow, and the plan is to replace it while it is still running. ' +
    'Your code can go around it either way, and each way has a tight spot. Users need search (B), ' +
    'the dashboard (C), sharing (D) and history (E), and some need more than one, so pick the ' +
    'side you start on before anyone shows up.',
  map: `
##########^^^^^^B#########
##########################
##########################
#########################C
##########################
######^^^^^^^^^^^^^^######
######^^^^^^^^^^^^^^######
######^^^^^^^^^^^^^^######
######^^^^^^^^^^^^^^####^^
A#####^^^^^^^^^^^^^^####^^
######^^^^^^^^^^^^^^####^^
######^^^^^^^^^^^^^^####^^
######^^^^^^^^^^^^^^######
######^^^^^^^^^^^^^^######
######^^^^^^^^^^^^^^######
##########################
#########################E
##########################
##########################
##########^^^^^^D#########
`,
  arrivals: {count: 12, firstTick: 6, every: 1},
  goal: 9,
  patience: 7,
  mineDensity: 0.13,
  betaSupply: 3,
  blastRadius: 0,
  shapePool: 'compact+awkward',
  walkers: [
    {stops: ["B"]},
    {stops: ["C"]},
    {stops: ["D"]},
    {stops: ["E"]},
    {stops: ["B", "C"], ordered: true},
    {stops: ["D", "E"], ordered: true},
    {stops: ["C", "E"]},
    {stops: ["B", "D"]},
    {stops: ["C"]},
    {stops: ["E"]},
    {stops: ["B", "C", "E"], ordered: true},
    {stops: ["D", "C"]},
  ],
};
