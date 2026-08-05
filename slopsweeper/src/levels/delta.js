// @ts-check
// THE FIRST MULTI-DESTINATION LEVEL (2026-08-05), and the reason the machinery exists: SPEC
// §9.2.2's trunk decision, made of geometry rather than stated.
//
// **SHOWCASE, PENDING TUNING.** The shape is the argument; the numbers are a first guess.
// `arrivals`, `patience` and `mineDensity` have had one sim pass to check the level is
// playable and winnable, and no tuning pass at all (PLAN §13 protocol: the corpus numbers came
// from hundreds of games a level, these came from a sanity check). Read the sim table before
// believing any of them, and do not copy them into a new level as if they were measured.
//
// The one thing the sanity pass already knows and the tuning pass will have to answer: at
// these numbers **hand-only clears it, ~89% served**, so the level currently sits in `plain`'s
// class rather than `strait`'s — a control, not a level with a floor. That is a property of
// the trunk being 26 tiles, and the schedule will not fix it: `every` from 5 down to 2 moves
// hand-only by about ten points and moves the AI policies not at all (they lose six to nine
// users a game to blasts, exactly as the corpus does — see `README.md` §6, "deaths, not
// delays"). The dials with something to say here are `blastRadius`, `mineDensity`, and the
// geometry itself: lengthen the trunk, or make the branches share more of it.
//
// THE SHAPE. A west basin with the origin on its edge, two three-row necks into a north-south
// spine, and three lobes hanging off that spine — B at the top, C straight ahead, D at the
// bottom — each sealed from its neighbours by a volcano bar that runs to the east wall. So:
//
//   - **C is the trunk.** A straight 26-tile shot along row 7 from A through the north neck
//     and the middle lobe. Every route that is not the southern detour is built on top of it.
//   - **B and D are branches**, eleven tiles each off the spine the C route already paid for.
//     Turn-efficient, and one defect in the north neck takes down all three at once.
//   - **The southern neck is the other answer.** Thirty-odd tiles to reach D on its own, going
//     round the reef at the bottom of the basin — far more turns, and it fails independently.
//
// That is the whole decision and it arrives early, because the basin makes you choose which
// neck to build toward before you know what the generated ground will do to you. The two necks
// are three rows tall on purpose: of `compact+awkward` only `R12` fits a three-row corridor
// (see `src/levels/README.md` §4), so generation crosses a neck rarely and the necks are where
// the level makes you build by hand — the same trick `strait` plays, doubled and pulled apart.
//
// THE ITINERARIES. Three of them, cycled by spawn order, deliberately spanning the range:
// a single stop, a two-stop that skips the trunk's own destination, and the full tour. So the
// level asks three different questions of the same board — user 0 needs only the trunk, user 1
// needs both branches and never stops in the middle, user 2 needs everything and gets its
// patience topped up twice on the way round (RULES.DEST_REFILL). Four betas rather than three,
// because a three-legged trip has more places worth staging from than a one-legged one.

/** @type {import('./index.js').LevelDef} */
export const delta = {
  id: 'delta',
  name: 'The Delta',
  map: `
..................##########
..................#########B
..................##########
############......##########
######^^####......####^^^^^^
######^^####......##########
############################
A##########################C
############################
####^^^^^^##......##########
####^^^^^^##......####^^^^^^
############......##########
############################
###########################D
############################
`,
  arrivals: { count: 9, firstTick: 2, every: 4 },
  mineDensity: 0.12,
  patience: 26,
  betaSupply: 4,
  itineraries: [['C'], ['B', 'D'], ['B', 'C', 'D']],
  shapePool: 'compact+awkward',
};
