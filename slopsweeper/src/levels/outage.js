// @ts-check
// Campaign level 7 of 12 (2026-11-02). Tuned against the expert bot with
// `node src/sim/report.js`; src/levels/README.md §0 explains the rules every level is held to.
// After any change, rerun the report: the goal rate, beta curve, opening and hand-run columns
// all move together. The numbers below are the expert at full beta supply unless noted.
//
// THE OUTAGE turns blastRadius on (1): a defect takes the tiles around it and anyone on
// them. Rock firewalls stop blasts. The expert flags doubtful tiles in front of a crowd here
// (hold flags), which is what keeps deaths near zero; hand probes become worth a turn.
//
// expert 73% at 9/12 · betas 0..3: 10/59/70/73% · sloppy 64% · opening worth little (72%)
/** @type {import('./index.js').LevelDef} */
export const outage = {
  id: 'outage',
  name: 'The Outage',
  story:
    'At two in the morning, something the assistant wrote three weeks ago took down production. ' +
    'Customers need alerts (B), a status page (C) and their backups (D). From now on a bug takes ' +
    'out the code around it, not just its own tile. The rock walls are firewalls: a blast stops ' +
    'at them. If a tile looks suspicious, write one of your own next to it. Your tile shows how ' +
    'many bugs it touches.',
  map: `
############################^^####
##################################
#################################B
##################################
############################^^####
#######^^^^^^^^^^^^^^^^^^^^^^^####
############################^^####
############################^^####
#################^^#########^^####
#######^^^#######^^###############
A######^^^#######^^##############C
#################^^###############
############################^^####
############################^^####
#######^^^^^^^^^^^^^^^^^^^^^^^####
############################^^####
##################################
#################################D
##################################
############################^^####
`,
  arrivals: {count: 12, firstTick: 5, every: 1},
  goal: 9,
  patience: 8,
  mineDensity: 0.12,
  betaSupply: 3,
  blastRadius: 1,
  shapePool: 'compact+awkward',
  walkers: [
    {stops: ["B"]},
    {stops: ["B"]},
    {stops: ["C"]},
    {stops: ["C"]},
    {stops: ["C"]},
    {stops: ["D"]},
    {stops: ["D"]},
    {stops: ["B", "D"]},
    {stops: ["C", "D"]},
    {stops: ["B", "C"]},
    {stops: ["C"], patience: 5},
    {stops: ["D"], patience: 5},
  ],
};
