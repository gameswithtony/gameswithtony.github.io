// @ts-check
// Two wide basins joined by a narrow neck (PLAN §9). Every route shares the neck, so the
// trunk decision arrives early and cheaply: one mine in those twenty-four cells takes the
// whole level down, and the fastest rebuild is often to let a user walk into it on purpose
// (SPEC §5 protects that tactic deliberately).
//
// RESCALE (2026-08-04): 24×12 → 46×22, neck widened from two rows to three. Three is the
// load-bearing number: of the stencils in `compact+awkward` exactly one — `R12` laid on its
// side, 4×3 — fits a three-row corridor, so generation can cross the neck but only with the
// one block the pool rarely offers. The basins take anything; the neck is where the level
// bites, and it is why this level's pool has never been anything but `compact+awkward`.
//
// RETUNED 2026-08-04 (Analyze became one minesweeper click, SPEC §4.3): reading a block now
// costs several turns instead of one, so every level in the corpus got a looser schedule and
// a lower defect density.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// THE FORK BEYOND THE NECK — 2026-08-06
// ─────────────────────────────────────────────────────────────────────────────────────────
//
// **C joins B in the east basin, in its far north-east corner** (row 1, east wall). B stays
// exactly where it was, on the east wall at mid-row. The sentence the map now makes is: *every
// route pays the neck once, and then it forks.* Nothing west of column 27 is a choice; the whole
// decision lives in what you do once you are through.
//
// **The legs, priced in turns**, because every number below is derived from them:
//
//   | leg   | steps | a hand build opens it on          |
//   | ----- | ----- | --------------------------------- |
//   | A → B |    47 | turn 46                           |
//   | A → C |    54 | turn 53 direct (56 the bot's way) |
//   | B → C |    11 | straight up the east wall         |
//
// Those eleven tiles between B and C are the point of the fork. The cheapest way to own both is
// to close B and then run up the wall — which is why **`{C,B}` ordered** is in the cast. That
// walker owes C *first*, so it walks the road straight past B without B coming off its list (on
// an ordered itinerary, crossing a later stop does nothing at all — SPEC §6.5), reaches the
// corner, and then comes back down eleven tiles for a destination it has already stood beside.
// It is the cheapest legible way to make sequence cost something on a map with one trunk.
//
// **THE CAST**, six entries against twelve arrivals, so the deal is exactly 2/2/2/2/2/2 — the
// mix is the level's, the running order is the seed's (casting.js):
//
//   · **`{B}` × two entries → four walkers.** The trunk, and the majority. B is the shortest
//     thing on this board and it is still forty-seven tiles away.
//   · **`{C}` → two walkers.** The corner on its own: seven steps further than B, and because the
//     cheapest build runs up B's wall, in practice the trunk plus the climb.
//   · **`{B,C}` loose → two walkers.** Nearest first, which here means B and then the climb.
//     Loose because the order is not the decision for this one — the geometry already picked it.
//   · **`{C,B}` ordered → two walkers.** The same pair backwards, and enforced. See above.
//   · **`{B}` patience 9 → two walkers.** A short clock against a 47-tile trunk: nine ticks is
//     enough for nothing except a route that was nearly finished when they walked in.
//
// **THE SCHEDULE AND THE FLOOR ARE THE SAME ARITHMETIC.** A hand build opens B on turn 46, so
// **every walker has to be gone by turn 45** or hand-only play serves somebody. With `count: 12`
// and `every: 1` from turn 20, the last walker spawns on 31 and its bar of 14 runs out on 45.
// One turn. That is the whole level:
//
//   · **`firstTick: 20` is timed against the measured route-open window, not chosen for room.**
//     Over seeds, `genRush` opens B on turns 14–34 and `balanced:0.4` on 22–39. Twenty is the
//     earliest turn at which generated ground could plausibly be carrying anybody, so the first
//     walker arrives into a level that has only just become winnable. The old schedule started on
//     turn 1 and the first third of it bled out before any route could exist — the same 0% served,
//     but five users of it were never a decision.
//   · **The margin was measured in both directions and it is one notch wide.** Relax `every` from
//     1 to 2 and `handOnly` goes from 0% to **35% served**. Leave the cadence alone and raise
//     `patience` from 14 to 16 and it goes to **8%**. The old header attributed this property to
//     `every: 3`; the general form is `firstTick + (count−1)·every + patience ≤ 45`, and with
//     arrivals timed against the window above there is no room left for a cadence of three at all.
//
// **`blastRadius: 0`** — by the end of the 2026-08-06 pass this was the corpus norm rather than
// a dissent (nine of ten levels; `gyre` alone keeps radius 1, having the one terrain that
// answers blasts), but strait's version of the argument is worth writing out because it is the
// starkest. At the standard 1 this level scores **≤1% served for every policy at
// every schedule tried** — twelve configurations, none of them playable by README §7's own
// standard. The cause is not lethality, it is packing: on this board the only ground anybody can
// stand on *is* the route, forty-seven tiles of single file, so a radius-1 blast does not price
// one misstep. It kills the two or three walkers pressed in behind the one who erred and craters
// five tiles of the only road while it does it. At radius 0 the same definitions score 3–7%,
// almost entirely because the queue survives its own leader. It moves `handOnly` by exactly zero
// — a hand build never detonates — and it leaves SPEC §5's deliberate-detonation tactic intact
// and in fact cheaper: walking somebody into a suspected neck mine now costs one walker and one
// tile rather than one walker and a rebuild.
//
// **`mineDensity: 0.10`**, down from 0.11 and the bottom of the validator's tuned band. On a route
// this long every defect left standing on it is a walker, and the two-defect floor (README §4)
// already puts two in every block whatever this number says — so all the dial controls is the
// tail above two, and it is worth about a point of served. At 0.14 the review-and-reroute tax on
// a 47-tile route cancelled the AI's throughput advantage outright; nothing about that changed.
//
// **`betaSupply: 2`.** The mouth of the neck is the one obvious staging post on the board: it is
// where a walker has finished the part of the trip nobody can hurry and is about to start the
// part that forks. Two stages the trunk once and allows one reposition; it is nowhere near enough
// to breadcrumb it. On this level the beta modifier measures as a **wash** rather than a win —
// `balanced-beta:0.4` lands a point *below* plain `balanced:0.4`, inside the noise at 200 games —
// and that is worth stating plainly: staging buys walking instead of waiting, and strait's
// walkers are not dying of waiting. (On `channel` the same modifier is worth three points. The
// difference between those two rows is the whole answer to "when is a beta worth a turn".)
//
// **`shapePool: 'compact+awkward'`, unchanged and load-bearing.** `refund` measures 0.00–0.07 per
// game, so both presets place freely in the basins; the neck is the only place on the board that
// refuses all but `R12`, which is exactly the economy this level was built on. The explicit-only
// `N16` (6×3) would fit that neck and was deliberately not named — handing generation a second
// three-row block is the single edit that would delete this level's central decision.
//
// THE NUMBERS (200 games a cell, seed 1, `node src/sim/run.js --level strait`):
//
//   | policy            | served | win | gaveUp | killed | dets |
//   | ----------------- | ------ | --- | ------ | ------ | ---- |
//   | handOnly          |     0% |  0% |   12.0 |    0.0 | 0.00 |
//   | genRush           |     3% | 20% |    1.4 |   10.3 | 8.06 |
//   | balanced:0.4      |     7% | 37% |    1.3 |    9.8 | 7.61 |
//   | balanced-beta:0.4 |     6% | 31% |    1.5 |    9.8 | 7.36 |
//   | careful:0.4       |     0% |  3% |   11.1 |    0.9 | 5.72 |
//   | careful-beta:0.4  |     0% |  2% |   11.6 |    0.3 | 5.09 |
//
// Four things that table is not saying:
//
//   · **This is the corpus's hardest board and the sim understates it here more than anywhere
//     else.** The bots never flag (`src/sim/policies.js`, top), so they walk twelve users single
//     file over unreviewed slop for forty-seven tiles, and `killed` saturates near ten — which is
//     roughly the number of defects the AI leaves standing on the road. A player who flags one
//     deduced mine removes one of those ten. Every AI figure here is a floor, and a deeper one
//     than elsewhere in the corpus.
//   · **`served` on this level rises with `arrivals.count` for a bot-specific reason, and the
//     temptation was declined.** Because `killed` saturates, walkers past the tenth tend to arrive
//     on a road the earlier ones cleared: the identical definition reads **10% at `count: 14`** and
//     **15% at 18**, which measures the sacrifice queue and not the level. Twelve is what a 47-tile
//     route and a ~100-turn session justify on their own, and twelve is what ships.
//   · **`careful` scores 0%** because reading every block before building past it costs
//     twenty-four analyses and forty-five turns is all anybody gets. genRush 3 / balanced 7 /
//     careful 0 is the right shape — the middle wins — but the whole spread is compressed against
//     the floor, which is what a level with a one-turn margin looks like from the inside.
//   · **`perfect` is 0% and is not reachable here by a bot.** Twelve of twelve across a 47-tile
//     road made mostly of generated ground would need that road read end to end, which is a
//     flagging problem. Nobody has measured a flagging player's odds and this note will not
//     invent them.

/** @type {import('./index.js').LevelDef} */
export const strait = {
  id: 'strait',
  name: 'The Strait',
  map: `
###################........###################
###################........##################C
###################........###################
###################........###################
###################........###################
###################........###################
###################........###################
###################........###################
###################........###################
###################........###################
A#############################################
##############################################
#############################################B
###################........###################
###################........###################
###################........###################
###################........###################
###################........###################
###################........###################
###################........###################
###################........###################
###################........###################
`,
  // Twelve users, one a turn from turn 20 — the earliest turn generated ground could be carrying
  // anybody. The last of them expires on 45; a hand build opens B on 46 (see header).
  arrivals: { count: 12, firstTick: 20, every: 1 },
  patience: 14,
  mineDensity: 0.10,
  betaSupply: 2,
  blastRadius: 0,
  shapePool: 'compact+awkward',
  walkers: [
    { stops: ['B'] },
    { stops: ['B'] },
    { stops: ['C'] },
    { stops: ['B', 'C'] },
    { stops: ['C', 'B'], ordered: true },
    { stops: ['B'], patience: 9 },
  ],
};
