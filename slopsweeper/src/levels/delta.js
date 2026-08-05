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
// these numbers **hand-only clears it, ~78% served** (200 games, seed 1 — it was 89% before the
// third itinerary was ordered, below), so the level currently sits in `plain`'s
// class rather than `strait`'s — a control, not a level with a floor. That is a property of
// the trunk being 26 tiles, and the schedule will not fix it: `every` from 5 down to 2 moves
// hand-only by about ten points and moves the AI policies not at all (they lose six to nine
// users a game to blasts, exactly as the corpus does — see `README.md` §6, "deaths, not
// delays"). The dials with something to say here are `blastRadius`, `mineDensity`, and the
// geometry itself: lengthen the trunk, or make the branches share more of it.
//
// **AND THE NUMBERS MOVED AGAIN ON 2026-08-05** with the cast (below), which this header keeps
// saying because it keeps being true. Two measurements, both 200 games at seed 1:
//
//   - **hand-only is still ~78% served, and is no longer the same game twice.** Before the cast
//     it delivered exactly 7 of 9 in all 200 games — a flat line, because nothing about a
//     hand-only run of this level was random. It now spreads 6/7/8/9 (48/105/45/2 games) for the
//     same mean, and posts the level's first non-zero `perfect` rate at 1%. Read that as the
//     cast working rather than as the level changing difficulty: the mix is fixed, the order is
//     the seed's, and *where* the impatient walker lands in the queue is now worth a user.
//   - **the AI policies got easier by four to six points** — `balanced:0.4` 7% → 13% served,
//     `genRush` 2% → 5%, and median winning ticks 107 → 76 — because the cast rebalanced the
//     demand toward the trunk. Four roles over nine arrivals is 3/2/2/2, so C-only users went
//     from three to five (three patient, two impatient) while the two-branch and full-tour roles
//     dropped from three each to two. Fewer long tours is a shorter, cheaper level.
//
// Neither number is a tuning result and both should be re-measured after the tuning pass, but
// the second one is worth a decision on its own: if the trunk-heavy mix is not what the level
// wants, the fix is the cast, not the geometry.
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
// THE CAST. Four roles over nine arrivals, deliberately spanning the range: a single stop, a
// two-stop that skips the trunk's own destination, the full tour, and somebody who only wants
// the trunk and will not wait long for it. So the level asks four different questions of the
// same board — one walker needs only C, one needs both branches and never stops in the middle,
// one needs everything and gets its patience topped up twice on the way round
// (RULES.DEST_REFILL), and one is on a twelve-tick clock against the level's twenty-six. Four
// betas rather than three, because a three-legged trip has more places worth staging from than
// a one-legged one.
//
// AND THE THIRD ONE IS ORDERED (2026-08-05, owner decision — SPEC §6.5). `{ stops: ['B','C','D'],
// ordered: true }` is B, then C, then D, enforced: that walker owes B and only B until it has
// stood on it, and if it crosses C on the way — which on this geometry it does, C being on the
// spine between the north neck and everything else — C does not come off its list. It walks back
// for it. The showcase carries one so the feature is exercised by a real level rather than only
// by a fixture, and it is the *full tour* that carries it because that is where the difference
// is legible: the loose two-stop next to it goes to whichever branch is nearer, and the ordered
// three-stop goes north first whatever the board looks like.
//
// AND THE FOURTH IS THE IMPATIENT ONE (2026-08-05, owner decision — the walker cast list, SPEC
// §6.6). `{ stops: ['C'], patience: 12 }` is the same single-stop errand as the first role on a
// bar less than half the level's, and it is here because a cast that could only vary *where*
// people go would be an itinerary list with a new name. Twelve is chosen against the geometry
// rather than picked: the trunk is 26 tiles, so this walker is gone long before a hand-built C
// route can exist, and the only thing that saves it is generated ground going down early on the
// leg it happens to be waiting for. It is the level's clock made personal — one row of the
// roster that says the thing the whole level is about, in a countdown.
//
// THE FIELD CHANGED WITH IT: `itineraries` became `walkers`, which is the same three entries in
// their long form plus this one. Nothing about the first three moved.
//
// AND THE DEAL IS SEEDED NOW, which is the bigger change to how this level plays. Four roles
// over nine arrivals cycle to 3/2/2/2 and are then shuffled, so the *mix* is fixed and the
// *order* is not: which turn the impatient walker shows up on, and whether the ordered tour
// lands before or after the C route opens, is a property of the seed. Two games of delta ask the
// same four questions in a different order, which is the point (SPEC §6.6).
//
// It costs delta's numbers again, and the header above already says not to trust those. Ordering
// the third role cost it eleven points on the day it landed: hand-only 89% → 78% served over 200
// games, one more user a game giving up (gaveUp 1.0 → 2.0) and no change to anything else. The
// cast has moved them a second time — the impatient walker is two of nine users on a clock the
// level cannot reliably beat, and the shuffle spreads the variance differently — so re-read the
// sim table rather than either of those numbers. The six corpus levels' rows did not move, and
// that is byte-compared rather than assumed.

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
  walkers: [
    { stops: ['C'] },
    { stops: ['B', 'D'] },
    { stops: ['B', 'C', 'D'], ordered: true },
    { stops: ['C'], patience: 12 },
  ],
  shapePool: 'compact+awkward',
};
