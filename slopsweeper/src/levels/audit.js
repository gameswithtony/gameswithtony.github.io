// @ts-check
// Campaign level 10 of 12 (2026-11-02). Tuned against the expert bot with
// `node src/sim/report.js`; src/levels/README.md §0 explains the rules every level is held to.
// After any change, rerun the report: the goal rate, beta curve, opening and hand-run columns
// all move together. The numbers below are the expert at full beta supply unless noted.
//
// DUE DILIGENCE: a main floor with channels north (B), south (E) and east to a far floor
// with C and D, so the first blocks pick a direction. Known gap: at this goal the sloppy
// bot beats the expert, whose full reviews across three branches cost it patience.
//
// expert 64% at 9/12 · betas 0..3: 4/35/55/64% · scattered opening 54% · sloppy 72%
/** @type {import('./index.js').LevelDef} */
export const audit = {
  id: 'audit',
  name: 'Due Diligence',
  story:
    'A bigger company wants to buy you, and their auditors are reading everything. They need ' +
    'access logs (B), contracts (C), the security review (D) and revenue numbers (E), from three ' +
    'directions at once.',
  map: `
....#B##......................
....####......................
....####......................
....####..............########
....####..............#######C
....####..............########
##############........########
##############........########
##############################
#########^^##############^^###
A########^^##############^^###
#########################^^###
##############........###^^###
##############........########
##############........########
##############........########
....####..............########
....####..............#######D
....####..............########
....####......................
....####......................
....#E##......................
`,
  arrivals: {count: 12, firstTick: 5, every: 1},
  goal: 9,
  patience: 8,
  mineDensity: 0.12,
  betaSupply: 3,
  blastRadius: 0,
  shapePool: 'compact+awkward',
  walkers: [
    {stops: ["B"]},
    {stops: ["C"]},
    {stops: ["D"]},
    {stops: ["E"]},
    {stops: ["B", "C"]},
    {stops: ["C", "D"]},
    {stops: ["E", "B"], ordered: true},
    {stops: ["D"], patience: 4},
    {stops: ["C"]},
    {stops: ["B"]},
    {stops: ["E"]},
    {stops: ["B", "C", "D"]},
  ],
};
