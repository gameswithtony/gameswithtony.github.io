// @ts-check
// Campaign level 5 of 12 (2026-11-02). Tuned against the expert bot with
// `node src/sim/report.js`; src/levels/README.md §0 explains the rules every level is held to.
// After any change, rerun the report: the goal rate, beta curve, opening and hand-run columns
// all move together. The numbers below are the expert at full beta supply unless noted.
//
// LEGACY puts an untouchable system in the middle and a rock wall with two four-tall gates
// in front of B and C. Two walkers carry patience 4: they are the ones the panel warns about.
//
// expert 69% at 8/10 · betas 0/1/2: 10/48/69% · scattered opening 63% · sloppy 63%
/** @type {import('./index.js').LevelDef} */
export const legacy = {
  id: 'legacy',
  name: 'Legacy',
  story:
    'Your newest customer runs the whole company on a system older than you are. It sits in the ' +
    'middle of everything and nobody is allowed to touch it, so your code has to go around it. ' +
    'Their staff need reports (B) and exports (C). A few of them have used the old system for ' +
    'twenty years, and they will not wait long for yours.',
  map: `
#####################^^^^#####
##############################
############^################B
##############################
####^#########################
#########^^^^^^^^####^^^^#####
#########^^^^^^^^####^^^^#####
#########^^^^^^^^####^^^^#####
#########^^^^^^^^#^##^^^^##^##
A########^^^^^^^^####^^^^#####
#########^^^^^^^^####^^^^#####
#########^^^^^^^^####^^^^#####
#########^^^^^^^^####^^^^#####
#####^########################
##############################
##############^##############C
##############################
#####################^^^^#####
`,
  arrivals: {count: 10, firstTick: 4, every: 1},
  goal: 8,
  patience: 9,
  mineDensity: 0.12,
  betaSupply: 2,
  blastRadius: 0,
  shapePool: 'compact+awkward',
  walkers: [
    {stops: ["B"]},
    {stops: ["B"]},
    {stops: ["B"], patience: 4},
    {stops: ["C"]},
    {stops: ["C"]},
    {stops: ["C"], patience: 4},
    {stops: ["B", "C"]},
    {stops: ["B", "C"]},
    {stops: ["C"]},
    {stops: ["B"]},
  ],
};
