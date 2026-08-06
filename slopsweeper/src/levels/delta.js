// @ts-check
// THE MULTI-DESTINATION LEVEL (2026-08-05), and the reason the machinery exists: SPEC §9.2.2's
// trunk decision, made of geometry rather than stated.
//
// TUNED 2026-08-06. It shipped as a showcase with a sanity pass instead of a tuning pass, and
// the header used to say so in four places. It measured `handOnly` **78% served** — a control
// level by accident, in flat violation of the standing rule that generated blocks must be
// necessary. It now measures **0.00% over 1000 games, and 0% win**: a hand build cannot open
// one route to one walker. The identity is unchanged — C is the trunk along the spine, B and D
// are branches sealed behind volcano bars, the north neck is the shared point of failure, the
// southern neck is the independent detour, and the cast is the same four roles. Every number
// under it moved, and the map was reshaped. What follows is what the measurements said.
//
// THE SHAPE. A west basin with the origin on its edge, two three-row necks into a north-south
// spine, and three lobes hanging off that spine — B at the top, C straight ahead, D at the
// bottom — each sealed from its neighbours by a volcano bar running from the spine's edge to
// the east wall. 32×18. So:
//
//   - **C is the trunk.** A straight 30-tile shot along row 9, through the north neck and out
//     to the east wall. Every route that is not the southern detour is built on top of it.
//   - **B and D are branches**, ten tiles each off the spine the C route already paid for:
//     38 steps against C's 31, of which 28 are the trunk. Turn-efficient, and one defect in
//     the north neck takes down all three at once.
//   - **The southern neck is the other answer.** Round the reef at the bottom of the basin and
//     along the floor to D — the same 38 steps, none of them shared, and it fails independently
//     of everything the north neck is carrying.
//
// That is the whole decision and it arrives early, because the basin makes you choose which
// neck to build toward before you know what the generated ground will do to you.
//
// THE RESHAPE, AND WHY IT IS NOT WHAT THE OLD HEADER PREDICTED. That header named the geometry
// dial as *lengthen the trunk*. Measured, lengthening is a trap: at 38 tiles of trunk `handOnly`
// does drop to 0%, but every AI policy drops to 1% with it, and at 46 tiles `handOnly` is still
// 23% while the AI policies are 0–1%. A walker crossing generated ground dies at roughly one in
// twenty tiles, so every tile added to the route is taken out of the AI's score before it is
// taken out of the hand build's. The trunk therefore grew only 26 → 30.
//
// What actually mattered was **obstruction, not length**: void beside the route is what slows
// generation down, because a block needs a hole to land in and hand placement never does. The
// same 30-tile route was measured against four boards, and the AI's opening moved by eight
// turns while the hand build's did not move at all (it is 30 turns on any of them, one tile a
// turn, and it is the same 30 on every seed — the hand-only bot is deterministic). So:
//
//   - the necks went from six columns to **four** — exactly R12's footprint, so one Generate
//     crosses a neck and no second stencil in `compact+awkward` can (the three-row rule,
//     `core/shapes.js`). The level always claimed that sentence and never actually kept it: at
//     six columns R12 is four wide and **nothing in either pool could bridge a neck in one
//     placement**, so generation could only shorten the walk and the claim was decoration.
//     Enumerated over every stencil, every rotation and every legal offset, the answer on this
//     board is exactly `R12` and on the old one it was the empty set.
//   - the spine went from four columns to **six**, wide enough that the climb to B or D is a
//     placement rather than a formality;
//   - the lobes narrowed six → **four**, which is what keeps the branch marginal at ten tiles;
//   - the board grew four rows taller, so the basin is fourteen rows and there is somewhere for
//     a five-by-five to land even though this level does not draw one.
//
// Measured effect at a fixed 30-tile route: `balanced:0.4` opens C on turn 18 instead of 25,
// and `refund` fell from 6.4 a game to 0.6. That gap between "the AI can open this" and "a hand
// build can open this" is the only place a schedule with a floor can live, and the old board did
// not have one wide enough to put nine walkers in.
//
// THE WINDOW IS THE DIAL THAT KILLED THE HAND-ONLY NUMBER. Not density, not blast radius, not
// the map on its own: the schedule and the bar, set against the measured opening times.
//
//   | who            | opens C | opens B | opens D |
//   | -------------- | ------- | ------- | ------- |
//   | `genRush`      |      11 |      12 |      15 |
//   | `balanced:0.7` |      15 |      18 |      22 |
//   | `balanced:0.4` |      18 |      22 |      26 |
//   | `careful:0.4`  |     25* |     34* |     46* |
//   | a hand build   |  **30** |      40 |      50 |
//
//   (medians over 60 games; * `careful` opens C in nine games out of sixty and never reaches a
//   median — reading every block to the end does not finish this level.)
//
// Nine walkers arrive on turns 11–19, one a turn, on a bar of 9. So the last of them is gone on
// turn 28 and the first hand-built route could exist on turn 30. **The floor is arithmetic, not
// luck**: `handOnly` places 27.7 tiles, the roster empties, and the game ends on tick 28 with
// the C route two tiles short — 1000 games, no exceptions, not even a `win`. Turn 11 is chosen
// against the same table: it is the turn a generate-first opening has just put ground on the C
// leg and nobody has read a cell of it, which is the only moment this level is interesting.
// There are no free turns before the queue starts, and no walker arrives into a board where no
// route could yet exist.
//
// **`blastRadius: 0` is the dial that made it playable.** A defect takes out its own tile and
// whoever was standing on it, and nothing else. At `blastRadius: 1` this exact level scores
// `genRush` 1% and `balanced:0.4` 1%; at 0 it scores 8% and 5%. The reason is the chokepoint:
// walkers go single file through a three-row neck, so a one-step flood fill catches the two
// behind whoever stepped on the mine, and the crater severs the neck for everybody else. It
// moves `handOnly` by exactly zero — a hand build never detonates — so it widens the gap the
// level is built on instead of flattening it. Nine of the ten levels landed on the same setting
// by the end of the 2026-08-06 pass, each from its own measurement; `gyre` alone keeps radius 1,
// having the one terrain — a blast-stopping volcano core — that answers blasts.
//
// THE NUMBERS (200 games a cell, seed 1, `node src/sim/run.js --level delta`), measured
// 2026-08-06 against the twenty-stencil shape table:
//
//   | policy            | served | win | gaveUp | killed | dets | refund |
//   | ----------------- | ------ | --- | ------ | ------ | ---- | ------ |
//   | handOnly          |     0% |  0% |    9.0 |    0.0 | 0.00 |   0.00 |
//   | genRush           |     8% | 36% |    0.6 |    7.7 | 6.69 |   0.59 |
//   | balanced:0.4      |     5% | 25% |    2.5 |    6.1 | 5.26 |   0.00 |
//   | balanced:0.7      |     7% | 36% |    1.3 |    7.1 | 6.43 |   0.10 |
//   | balanced-edge:0.4 |     4% | 23% |    2.9 |    5.7 | 4.99 |   0.00 |
//   | careful:0.4       |     0% |  1% |    8.8 |    0.2 | 3.42 |   0.00 |
//
// Read it in four passes:
//
//   · **The floor is exact and it is the headline.** 78% → 0.00% (1000 games, seed 1), and the
//     `win` column — "did one single walker arrive", the metric that reads high everywhere by
//     design — is 0% as well. Before this pass `handOnly` delivered seven of nine.
//   · **The two extremes are not symmetric here, and that is the level's own thesis.**
//     `careful` is dead at 0%: on a board where every route runs through a chokepoint, reading
//     each block to the end costs turns the queue does not have. Generation-leaning play wins —
//     `genRush` 8% and `balanced:0.7` 7% against `balanced:0.4`'s 5%. `delta` is the level that
//     says *commit to generated ground and route around what kills you*, where `tutorial` says
//     *read what you generate*. Two levels, two halves of the same argument.
//   · **Deaths cap it, not the clock.** The best policies lose 6–8 of nine walkers to blasts and
//     under one to patience; `careful` inverts it exactly, 8.8 to the clock and 0.2 to blasts.
//     Every AI number above is a floor: the sim bots never flag (`src/sim/policies.js`), so they
//     walk users over unread slop a player would have marked. The best single game in 1000
//     delivered six of nine.
//   · **`perfect` is 0.0% over 1000 games, and that is a miss worth stating.** Nine of nine
//     wants a 31-tile route with no defect left on it *and* the two five-tick walkers saved, and
//     a non-flagging bot cannot do the first. `tutorial`, on an open board with no chokepoint,
//     manages 0.2%. A flagging human's odds are far better than either bot's, but the number as
//     measured is zero and nothing in this pass moved it.
//
// THE DIALS, and what each one is doing:
//
//   · **`arrivals: 9 / 11 / 1`** — see the window table above. The burst is the level, and the
//     firstTick is set against the measured opening rather than by feel.
//   · **`patience: 9`.** Derived, not picked: nine walkers one turn apart starting on turn 11
//     put the last deadline on turn 28, two turns inside the hand build's turn 30. Ten leaves
//     one turn of margin; eleven hands the tail of the schedule back to `handOnly`.
//   · **`mineDensity: 0.10`**, the bottom of the validator's tuned band. Measured, 0.10 → 0.12 →
//     0.14 costs `genRush` 8% → 6% → 3%. It cannot go lower and it would not help if it could:
//     the two-defect floor (RULES.MIN_BLOCK_DEFECTS) already puts two mines in a 12-cell block
//     whatever this number says, so on `compact+awkward` sizes the dial is nearly inert from
//     below — see `README.md` §4.
//   · **`blastRadius: 0`** — the biggest lever on the table, above.
//   · **`shapePool: 'compact+awkward'`**, never `compact` alone. Fourteen stencils, of which
//     exactly one — R12, four wide and three tall — fits a neck. `refund` reads 0.00–0.59, so
//     the pool fits this geometry at some rotation nearly always, and the exceptions are the
//     necks, which is where they belong.
//   · **`betaSupply: 2`**, re-derived. Four was written for a 26-tile trunk on a 26-tick bar,
//     where there was time to stage every leg. On a 9-tick bar a beta buys the walk and nothing
//     else — camping drains patience like any other waiting — so what it is worth here is one
//     staging post mid-trunk and one on whichever branch you commit to, which is the same "more
//     legs, more staging" argument at this clock speed. A no-losses run plausibly wants the
//     first of them: a walker spawning on turn 11 is fifteen tiles along when the far half of
//     the trunk opens instead of standing at the door. **The sim disagrees and is worth quoting
//     against me**: `balanced-beta:0.4` scores 4% against `balanced:0.4`'s 5%, and
//     `careful-beta:0.4` is 0% either way. That is a statement about the bot's heuristic — it
//     ships a beta once patience is under pressure, and on a nine-tick bar that is turn one —
//     rather than about the verb, but the number is the number.
//
// THE CAST. Four roles over nine arrivals, unchanged from the day the level shipped and
// deliberately spanning the range: a single stop, a two-stop that skips the trunk's own
// destination, the full tour, and somebody who only wants the trunk and will not wait long for
// it. So the level asks four different questions of the same board — one walker needs only C,
// one needs both branches and never stops in the middle, one needs everything and gets its
// patience topped up twice on the way round (RULES.DEST_REFILL), and one is on a five-tick clock
// against the level's nine.
//
// AND THE THIRD ONE IS ORDERED (2026-08-05, owner decision — SPEC §6.5). `{ stops: ['B','C','D'],
// ordered: true }` is B, then C, then D, enforced: that walker owes B and only B until it has
// stood on it, and if it crosses C on the way — which on this geometry it does, C being on the
// spine between the north neck and everything else — C does not come off its list. It walks back
// for it. The level carries one so the feature is exercised by a real board rather than only by
// a fixture, and it is the *full tour* that carries it because that is where the difference is
// legible: the loose two-stop next to it goes to whichever branch is nearer, and the ordered
// three-stop goes north first whatever the board looks like.
//
// AND THE FOURTH IS THE IMPATIENT ONE. `{ stops: ['C'], patience: 5 }` is the same single-stop
// errand as the first role on a bar just over half the level's, and **five is re-derived against
// this trunk** rather than carried over (the old twelve was set against a 26-tile trunk and a
// 26-tick level bar, and both of those are gone). Read it off the window table: these walkers
// spawn on turns 11–19, so they are gone on turns 16–24. A hand build opens C on turn 30 and can
// never save one of them. A generate-first opening lands C on turn 11 and saves all of them. A
// read-as-you-go opening lands it on turn 18 and saves only the ones who came late. That is the
// level's whole argument compressed into one row of the roster, and it is the row a player
// should be looking at when they decide whether to Analyze the block in the neck or place beside
// it. Measured, moving the bar anywhere between 4 and 7 changes served by under half a point —
// once the route is open these two die in blasts like everybody else — so the number is chosen
// to say the right thing rather than to buy a score.
//
// AND THE DEAL IS SEEDED. Four roles over nine arrivals cycle to 3/2/2/2 and are then shuffled,
// so the *mix* is fixed — five walkers want only C, two want both branches, two want the tour —
// and the *order* is not. Which turn the impatient walker shows up on, and whether the ordered
// tour lands before or after the C route opens, is a property of the seed. Two games of delta
// ask the same four questions in a different order, which is the point (SPEC §6.6).
//
// A run takes 28 ticks (`handOnly`, the roster emptying) to about 60 (a winning AI run), and the
// longest of 3000 measured games was 113 — comfortably inside the 400-tick guard that
// `test/itinerary.test.js` plays this level under.

/** @type {import('./index.js').LevelDef} */
export const delta = {
  id: 'delta',
  name: 'The Delta',
  map: `
......................##########
......................##########
......................#########B
......................##########
##################....##########
########^^^^######....##########
########^^^^######....######^^^^
##################....##########
################################
A##############################C
################################
#####^^^^^^^^^^###....##########
#####^^^^^^^^^^###....##########
##################....######^^^^
##################....##########
################################
###############################D
################################
`,
  arrivals: { count: 9, firstTick: 11, every: 1 },
  patience: 9,
  mineDensity: 0.1,
  blastRadius: 0,
  betaSupply: 2,
  walkers: [
    { stops: ['C'] },
    { stops: ['B', 'D'] },
    { stops: ['B', 'C', 'D'], ordered: true },
    { stops: ['C'], patience: 5 },
  ],
  shapePool: 'compact+awkward',
};
