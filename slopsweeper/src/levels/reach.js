// @ts-check
// THE BETA SHOWCASE (2026-08-06). README §3c says a beta "is only worth shipping where there is
// a long walk to be had", and until now the corpus had no level built to that sentence. This is
// it: a serpentine corridor with a sixty-seven-tile route from `A` to `B`, which is more than
// twice `tutorial`'s trunk and the longest single route in the game.
//
// THE SHAPE. 24×27 — narrow and tall, because the length is folded rather than laid out. Three
// horizontal legs five rows deep and twenty-two columns long, joined by switchbacks at
// alternating ends: east between legs one and two, west between legs two and three. `A` sits at
// the west end of the top leg, `B` at the east end of the bottom one, and `C` hangs in a
// five-by-five dead-end pocket off the underside of the middle leg. Route lengths:
//
//   | leg   | A→C | A→B | C→B |
//   | ----- | --- | --- | --- |
//   | tiles |  39 |  67 |  38 |
//
// `C` is the milestone at the halfway mark and it is a **detour, not a waypoint**: the pocket
// is sealed from the bottom leg by a row of void, so a walker that goes down for `C` climbs
// back out and carries on. Reaching it costs nine tiles that do nothing for `B`.
//
// Everything about the level follows from README §6's threshold — *past thirty tiles hand-only
// stops being a strategy*. At sixty-seven, hand-building is not slow, it is a different
// timescale:
//
//   | policy       |  C |  B |
//   | ------------ | -- | -- |
//   | handOnly     | 38 | 70 |
//   | genRush      |  7 | 14 |
//   | balanced:0.4 | 15 | 33 |
//   | careful:0.4  | 31 | 61 |
//
// (Measured with arrival pressure removed, 40 runs a policy, median first tick connected.)
// A hand build reaches `B` on turn 70. A competent AI build reaches it on 33. **That
// thirty-seven-turn gap is the widest window in the corpus**, and it is the only reason this
// level can afford a `patience` of 18 when `marina` next door runs on 5: window width scales
// with route length, so the long level is also the forgiving one. Long routes are not simply
// harder — they buy you room to write a schedule in.
//
// THE SCHEDULE IS THE `at` FORM, and it is shaped against the two columns of that table:
//
//   arrivals: { at: [10, 11, 12, 13, 15, 17,   22, 23, 24, 25, 26, 28] }
//                   └──── the burst ────┘      └──── the wave ────┘
//
//   · **The burst (10–17) is the `C` wave.** AI opens `C` on turn 15; the short-barred `C`
//     errands in this group die between 15 and 24. They are playing for the pocket and nothing
//     else — a `B` errand that spawns on 12 is already lost, because `B` will not exist for
//     twenty more turns.
//   · **The lull (17→22) is five turns, and it is deliberately too short to be free.** The
//     temptation the brief asked for is real — a gap with nobody new arriving is when a player
//     wants to generate and read — but half the burst is still standing in the queue burning
//     its bar through the whole of it. Nothing about turns 18–21 is verification time you did
//     not pay for. An earlier draft ran the lull from 9 to 20 and that *was* free: it let the
//     board be read to the last cell before the second wave landed, which is exactly the
//     failure the shaped schedule exists to avoid.
//   · **The wave (22–28) is the `B` wave.** On an eighteen-tick bar it dies between 40 and 46,
//     against `B` opening on 33. It lands while the first stretch of slop is still unread, and
//     it is the only group the far end was ever for.
//
// PER-WALKER BARS DO THE REST, because the two destinations have hand-build deadlines thirty
// turns apart (38 and 70) and one level number cannot serve both. `C` errands are capped so
// they die before turn 38; `B` errands are given until 46, which is comfortably inside 70.
// Seven roles against twelve arrivals — a 2/2/2/2/2/1/1 mix, shuffled:
//
// Dealt across twelve slots that is four `{C}`, four `{B}`, two `{C,B}`, one inspector and one
// impatient — a mix a player can learn, in an order the seed owns.
//
//   · **`{C}` on a bar of 7, four of the twelve** — the milestone errand, and the only role the
//     opening burst can actually deliver.
//   · **`{B}` on the level's 18, four of the twelve** — the long haul. They cannot be served by
//     the burst and they know it; whether they are served at all is whether you were still
//     building at turn 33.
//   · **`{C,B}` ordered, bar 9** — pocket first, then the far end. It is the role that makes
//     the detour hurt: nine tiles down and nine back before it may even start on `B`.
//   · **`{B,C}` ordered, bar 30 — the patient inspector.** Far end first, milestone second,
//     and 105 tiles of walking. Thirty ticks is set against the geometry the same way
//     `delta`'s twelve is: it is exactly enough to outlast the wait for `B` at turn 33 and
//     nowhere near enough to outlast a hand build's turn 70, so the floor holds and the role is
//     still winnable. It is the one walker on the board who can afford to want everything.
//   · **`{C}` on a bar of 5** — the impatient one, and the fastest read on the roster: if the
//     pocket is not nearly closed when it spawns, write it off.
//
// **`destRefill: 0.25`** rather than the default half, on the README's own advice: stops here
// are milestones, not relief. A `{C,B}` walker gets two ticks back for reaching the pocket —
// enough to notice, nowhere near enough to reset the clock. On a level whose whole subject is
// distance, a stop that handed back half a bar would be a second chance rather than a landmark.
//
// **`shapePool` is explicit, and it is the level that earns `N16`.** Eight stencils spanning
// all three bands — `R12 N16 O16 L16 C20 S18 D20 J22`, twelve to twenty-two cells. The legs are
// five rows deep, so every one of them fits *at the start*; what changes is what fits later. As
// a leg fills with slop the survivable gaps narrow to three rows, and `R12` and `N16` are the
// only two stencils in the table that go down a three-row corridor (README §4). `N16` belongs
// to no preset and had to be asked for by name, which is precisely the opt-in the shape table
// documents: a corridor level that wants generation to keep working after the easy placements
// are gone. `J22` is the other end of the same argument — a two-wide mast on a six-wide foot,
// which is the shape a switchback is built for.
//
// **`blastRadius: 0`**, and this one is not a preference. Sixty-seven tiles of route means a
// walker crosses more generated ground on this board than anywhere in the corpus, and at
// radius 1 the level measures **1%** for its best policy against 10% at radius 0. `mineDensity`
// sits at the band floor, 0.10, for the same reason: route exposure is already the entire
// difficulty and there is nothing to gain by adding a tail to it. **`betaSupply: 3`.**
//
// THE NUMBERS (200 games a cell, seed 1, `node src/sim/run.js --level reach`):
//
//   | policy            | served | win | gaveUp | killed | medTicks | dets | refund |
//   | ----------------- | ------ | --- | ------ | ------ | -------- | ---- | ------ |
//   | handOnly          |     0% |  0% |   12.0 |    0.0 |        — | 0.00 |   0.00 |
//   | genRush           |     8% | 54% |    0.5 |   10.6 |       80 | 9.82 |   0.12 |
//   | balanced:0.4      |     6% | 44% |    2.5 |    8.8 |       85 | 8.19 |   0.02 |
//   | balanced-beta:0.4 |    10% | 64% |    1.0 |    9.8 |       89 | 9.19 |   0.02 |
//   | careful:0.4       |     1% | 10% |    9.7 |    2.2 |       73 | 7.09 |   0.00 |
//   | careful-beta:0.4  |     1% |  5% |    7.4 |    4.5 |       80 | 6.66 |   0.00 |
//
// **The beta row is the level.** `balanced:0.4` goes from 6% to 10% — and 44% to 64% on win —
// the moment it is allowed to ship staging posts, and the `gaveUp` column says exactly what it
// bought: 2.5 → 1.0. That is the biggest proportional swing betas produce anywhere in the
// corpus, and it is the condition README §3c predicted: on a sixty-seven-tile route the walk
// behind the frontier is enormous, so a beta two thirds of the way along converts twenty turns
// of queueing into twenty turns of walking. Three of them is one per leg.
//
// The rest reads as the corpus does. `careful` is not careful here, it is late — it opens `B`
// on turn 61 and loses 9.7 walkers to the clock. `genRush` keeps up on raw throughput and pays
// 10.6 deaths for it. `refund` is a flat 0.02–0.12: the explicit pool was chosen against the
// five-row legs and it fits. `handOnly` lays fifty tiles in an average game — twenty-odd short
// of the sixty-seven it needs, and past the pocket's thirty-eight only because the last walker
// had already left — a clean **0%** over 200 games, and the crispest version of the thirty-tile
// rule the corpus has.
//
// `perfect` is 0% over 1000 games: twelve walkers, a route made almost entirely of unread slop,
// and bots that never flag. Every AI row above is a floor.

/** @type {import('./index.js').LevelDef} */
export const reach = {
  id: 'reach',
  name: 'The Long Reach',
  map: `
........................
.######################.
.######################.
.A#####################.
.######################.
.######################.
..................#####.
..................#####.
..................#####.
..................#####.
.######################.
.######################.
.######################.
.######################.
.######################.
.#####....#####.........
.#####....#####.........
.#####....#####.........
.#####....#####.........
.#####....##C##.........
.#####..................
.######################.
.######################.
.#####################B.
.######################.
.######################.
........................
`,
  arrivals: { at: [10, 11, 12, 13, 15, 17, 22, 23, 24, 25, 26, 28] },
  patience: 18,
  mineDensity: 0.10,
  betaSupply: 3,
  blastRadius: 0,
  destRefill: 0.25,
  walkers: [
    { stops: ['C'], patience: 7 },
    { stops: ['B'] },
    { stops: ['C'], patience: 7 },
    { stops: ['C', 'B'], ordered: true, patience: 9 },
    { stops: ['B'] },
    { stops: ['B', 'C'], ordered: true, patience: 30 },
    { stops: ['C'], patience: 5 },
  ],
  shapePool: ['R12', 'N16', 'O16', 'L16', 'C20', 'S18', 'D20', 'J22'],
};
