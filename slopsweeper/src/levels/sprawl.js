// @ts-check
// THE ARCHIPELAGO — a total redesign, 2026-08-06 (owner decision). The old `sprawl` was fifty
// by thirty of featureless open water with one destination at the far edge, and the owner's
// verdict on it was short: they disliked it. The sim agreed and had been saying so for two
// days. Every policy in the sweep scored **0% served** — hand-only lost all nine users to
// patience, the AI policies lost eight and a half of nine to blasts, and nothing in between
// existed. A level nobody can play is not a hard level, it is a broken one, and this one was
// the corpus finale.
//
// WHAT WAS ACTUALLY WRONG. Not the size. The old level had two faults and they compounded:
//
//   - **Nothing to read.** Open water counts zero for clues from every side, which sounds like
//     it should make deduction easier and does the opposite: with no coast, no volcano and no
//     hand tile to sit beside, every generated block was an island of unconstrained cells in an
//     ocean of unconstrained cells. The level denied the player the free anchors §6 of the
//     authoring guide is built on, and then charged fifty-two tiles of walking for the privilege.
//   - **The route was a gauntlet.** Fifty-two tiles of route is fifty-two chances to tread on
//     something the AI buried. Deaths scale with route length and nothing else does, so the
//     level's whole difficulty came from a number the player cannot influence.
//
// THE ARGUMENT FOR ISLANDS. Volcano is the cheapest terrain in the game: it deletes legal
// placements, so a Generate becomes a placement decision instead of a formality, and it gives
// the middle of the board something to deduce against. Scattering it turns one featureless
// basin into lanes — and lanes are what let three destinations sit in three directions without
// the routes to them being three copies of the same walk. So: twenty-odd islets, a barrier
// reef across the north with a channel at each end, a second broken reef across the south with
// four six-wide passes, and a north-west coastline of void where the old level had more water.
//
//   - **C is the near shore** — thirty-two tiles, out of the west basin, up the west channel at
//     cols 10-15, over the lagoon. It is the trunk, and it is the only leg the schedule pays for.
//   - **B is fifty-two tiles due east** and **D fifty-four to the south-east**, past two reefs.
//     They are the level's ambition. Nothing in the sim reaches them on a commuter's bar, and
//     that is stated rather than hidden: the roster is written so that six walkers in ten want C.
//   - **Two of the mid-lane islets pinch the central lane to four rows**, which refuses all of
//     `heavy` (the box table, §4) and makes the east-bound trunk an `awkward` problem, while the
//     open water on either side of it takes anything. That is the placement decision, on the
//     stretch where it costs the most.
//
// TWO MEASURED DEAD ENDS, recorded so nobody re-walks them. **A long trunk does not work here.**
// Moving the north channel east so C came in at forty-one tiles instead of thirty-two took the
// best policy from 22% served to 2% — the extra nine tiles are nine more mines under nine more
// feet, and no schedule, density or cast recovers them. And **sealing the lagoon to one eastern
// head** (C at sixty-odd tiles, the version that made the three legs equal) was worse still.
// Route length is the binding constraint on this engine and it is not close; `tutorial` and
// `atoll`, the two levels that score, are thirty and thirty-one tiles.
//
// `blastRadius: 0`, which is the other thing that had to give. At the default 1 a single mine
// craters the tile plus its orthogonals — which on a one-wide route means the walker, the tile
// behind it and the tile in front, so one defect costs two or three users and severs the road
// behind the survivors. Measured on this exact definition: radius 1 gives genRush 7% and
// balanced 4%; radius 0 gives 20% and 20%. Here a defect costs you the walker who found it and
// one tile to rebuild, and the level is a level. The islets still stop blasts, they just have
// nothing left to stop; what they are for on this board is placement.
//
// THE SCHEDULE, timed against measured route-opening rather than against feel. Medians over
// twenty-five seeds, the tick a route to C first exists: **genRush 6, balanced:0.4 14,
// careful:0.4 24, hand-only 31 — and hand-only gets there in one game out of twenty-five**,
// because by then it has no one left to deliver to.
//
//   - **The rush lands at ticks 2, 4, 6, 8, and the board genuinely cannot be ready.** On a bar
//     of seven those four are gone by 9, 11, 13 and 15. A player who opens with Generate can
//     save the back half of the rush; a player who opens by reading cannot save any of it. That
//     is the opening gamble and it is deliberately not survivable by hesitation.
//   - **The lull is four ticks, 8 to 12, and it is short on purpose.** A longer quiet stretch is
//     free build-and-read time at zero patience cost — the exact thing hand-only exploits, and
//     the reason a `handOnly` above zero is the alarm on this level. Four ticks is one Generate
//     and part of a read: enough to be a decision, not enough to be verification.
//   - **The wave is twelve walkers on twelve consecutive ticks, 12 to 23**, landing while the
//     opening slop is still unread. It is where the score is.
//   - **The last spawn is 23 and the bar is 7, so the window shuts at 30 — two tiles short of
//     the thirty-two a hand-built C route costs.** That two-tile margin is the entire hand-only
//     floor, and it is the same margin `tutorial` and `strait` are built on.
//
// THE CAST is a repertoire: **twenty roles dealt against sixteen arrivals**, so four sit out
// every game and which four is the seed's business (§3b). Twelve of the twenty want C and
// nothing else — ten on the level's bar and two on their own, at five and four — because the
// ratio is the level's to write and only the running order is rolled. The rest are the islands:
// single stops at B and D, three loose pairs, and three sequences including the full tour
// `C → B → D` and a `D → C` whose whole point is that the near destination is sitting right
// there and it is not that walker's turn.
//
// MEASURED (200 games, seed 1). handOnly **0%** · genRush **23%** · balanced:0.4 **22%** ·
// balanced-beta:0.4 **19%** · careful:0.4 **4%** · careful-beta:0.4 **1%**. Perfect is 0%
// everywhere, as it is on every level in the corpus but `delta`.
//
// **Which pressure bites depends on who is playing, and that is the level's shape.** The fast
// policies die: genRush loses 9.5 of sixteen to blasts and only 2.9 to patience. The careful
// ones starve: careful:0.4 loses 11.8 to patience and 3.6 to blasts, because a bar of seven
// does not pay for twenty-four analyses. Hand-only loses all sixteen to patience, every game,
// having never opened a road. So the level's sentence is *the slop is the only thing fast
// enough, and it will kill about half of them* — which is what `sprawl` was always supposed to
// say and, at 0% served, never got to.
//
// **Betas do not help here, and the honest thing is to write that down.** `balanced-beta:0.4`
// scores three points below `balanced:0.4` and `careful-beta:0.4` three below `careful:0.4`;
// a beta costs a turn, and on a bar of seven nobody stalls long enough for staging to repay
// one. The supply stays at three because the long hauls to B and D are exactly where a *human*
// — who flags, which the bots never do, so every number above is a floor — has something to
// stage toward. If a later tuning pass wants the verb to earn its keep by measurement, the dial
// is patience, and patience is pinned by the hand-only margin above.

/** @type {import('./index.js').LevelDef} */
export const sprawl = {
  id: 'sprawl',
  name: 'The Archipelago',
  map: `
..............#####C###########################...
.............###################################..
............############^^^^#####^^^^#############
...........###^^^#######^^^^#####^^^^#####^^^^####
...........###^^^################^^^^#####^^^^####
..........################################^^^^####
..........########################################
################^^^^^^^^^^^^^^^^^^^^######^^^^^###
################^^^^^^^^^^^^^^^^^^^^######^^^^^###
################^^^^^^^###########################
#################^^^^#############################
#################^^^^##################^^^########
#######################################^^^#######B
A########################^^^^#####################
######^^^################^^^^################^^^##
######^^^################^^^^################^^^##
##^^^^^^^######^^^^^^######^^^^^^######^^^^^^#####
##^^^^^^^######^^^^^^######^^^^^^######^^^^^^#####
##^^^^^^^######^^^^^^######^^^^^^######^^^^^^#####
##################################################
######################^^^^#############^^^########
#####^^^##############^^^^#############^^^########
#####^^^#####^^^^##############^^^^###############
#############^^^^##############^^^^###############
..##############################################..
....######################################D####...
`,
  arrivals: { at: [2, 4, 6, 8, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23] },
  mineDensity: 0.10,
  patience: 7,
  betaSupply: 3,
  blastRadius: 0,
  walkers: [
    // The commuters. Ten identical rows because the level owns the ratio and the seed owns
    // only the running order (README §3b): six in ten of the roster wants C and nothing else,
    // which is what makes closing the west channel worth doing before anything else.
    { stops: ['C'] },
    { stops: ['C'] },
    { stops: ['C'] },
    { stops: ['C'] },
    { stops: ['C'] },
    { stops: ['C'] },
    { stops: ['C'] },
    { stops: ['C'] },
    { stops: ['C'] },
    { stops: ['C'] },
    // The same errand on less goodwill. Five and four against the level's seven: both are
    // inside the window an early Generate opens and outside the one a read-first player does.
    { stops: ['C'], patience: 5 },
    { stops: ['C'], patience: 4 },
    // The islanders. B and D are fifty-two and fifty-four tiles out; nothing in the sim
    // reaches them on a commuter's bar, and they are the level's ambition rather than its score.
    { stops: ['B'] },
    { stops: ['D'] },
    { stops: ['C', 'B'] },
    { stops: ['C', 'D'] },
    { stops: ['B', 'D'] },
    // The tour, in that sequence: C, then the far east, then the south-east corner.
    { stops: ['C', 'B', 'D'], ordered: true },
    // And two sequences whose whole point is the order. 'D' then 'C' is the long way round
    // deliberately: the near destination is right there and it is not this walker's turn.
    { stops: ['D', 'C'], ordered: true },
    { stops: ['B', 'C'], ordered: true },
  ],
  shapePool: 'awkward+heavy',
};
