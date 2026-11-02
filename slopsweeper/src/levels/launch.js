// @ts-check
// Campaign level 1 of 12 (2026-11-02). Tuned against the expert bot with
// `node src/sim/report.js`; src/levels/README.md §0 explains the rules every level is held to.
// After any change, rerun the report: the goal rate, beta curve, opening and hand-run columns
// all move together. The numbers below are the expert at full beta supply unless noted.
//
// DAY ONE teaches the loop on one capability: generate toward B, ship the one beta at the
// two-tile handwritten gap so the waitlist starts walking, and read the slop ahead of them.
//
// expert 93% at 4/6 · no beta 25% · scattered opening 82% · sloppy 90% · hand-only 0%
// about 1.8 users a game served with two turns of patience or fewer left.
/** @type {import('./index.js').LevelDef} */
export const launch = {
  id: 'launch',
  name: 'Day One',
  story:
    'You are the first engineer at a startup that makes invoicing software for small businesses. ' +
    'The founder, Todd, hands you a laptop, an AI coding assistant, and a waitlist. Everyone on ' +
    'the waitlist comes in at A and needs signup (B). The assistant writes code fast, and every ' +
    'block it writes has at least two bugs. The middle is too narrow for its blocks, so you write ' +
    'that part by hand. A beta partway there gets the waitlist moving before signup is finished.',
  map: `
###############..#################
###############..#################
#######^^######..##########^######
#######^^######..##########^######
###############..#################
##################################
A################################B
###############..#################
###############..#######^^########
#####^^########..#######^^########
###############..#################
###############..#################
###############..#################
`,
  arrivals: {count: 6, firstTick: 4, every: 1},
  goal: 4,
  patience: 5,
  mineDensity: 0.1,
  betaSupply: 1,
  blastRadius: 0,
  shapePool: 'compact',
};
