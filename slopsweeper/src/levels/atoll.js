// @ts-check
// A reef ring of volcano islets around an inner lagoon, breached north-east and south-west
// (PLAN §9). The route has to walk the reef flat most of the way round the island before a
// breach lets it in — this is the level that exercises SPEC §4.2's refund path in anger.
//
// PROVENANCE:
//
//   · RESCALE 2026-08-04: 18×14 → 34×26. The old flat was two to three cells wide, which the
//     12–26-cell blocks would have refused outright. Six cells wide and a twelve-by-four lagoon
//     makes placement *constrained* rather than impossible: the flat takes any stencil, the
//     lagoon takes nothing five cells tall, and `heavy`'s squares are flat-only.
//   · RETUNED 2026-08-04 when Analyze became one minesweeper click.
//   · NOTE 2026-08-12: SPEC §4.2 was revised — an unplaceable draw is now redrawn invisibly,
//     and Generate only cancels when the whole pool fits nowhere. The `refund` columns below
//     count per-draw refusals under the old rule, so they overstate what a player now sees
//     (the genRush 0.85 "re-draws the same refused stencil" failure mode is gone outright).
//     The tension the shore bar buys — heavies land along the flat and nowhere else — is
//     placement-constrained, not refund-driven, so it survives; the dials want a re-run
//     before anyone quotes them.
//   · REBUILT 2026-08-06 (owner decision), and the reason is embarrassing enough to write down.
//     **The sentence at the top of this file was not true.** The south-west breach opened onto
//     the south flat twelve tiles from the origin, so A→B was 30 and the reef walk was optional
//     — a back door, not a circumnavigation. Measured, `handOnly` served **75%** of the schedule
//     here, the highest in the corpus and a flat violation of the standing rule that generated
//     blocks must be *necessary*. The rebuild makes the file's own brief true.
//
// THE GEOMETRY, and what each piece is for:
//
//   · **The reef reaches the shore south of the origin** — rows 16–17 at cols 1–6 are volcano
//     now. That one bar is the whole floor fix: the outer flat is a **horseshoe** rather than a
//     ring, open only northwards from `A`, so the back door is gone and the reef walk is the
//     level again. It is two rows rather than four on purpose; four cost twelve cells of the
//     widest part of the flat and nothing in exchange (see the refund note below).
//   · **Both breaches survive, wildly asymmetric.** The north-east breach is the way in: its
//     mouth is at (20, 7) and it drops five tiles into the lagoon. The south-west breach is now
//     the *far* end of the horseshoe — you reach it by walking north, east, south and back west,
//     eighty-odd tiles. Nobody will route through it, and it is still worth keeping: it means a
//     crater in the NE breach is a detour rather than the end of the game.
//   · **`A` (1, 13)** on the west shore, **`B` (21, 13)** at the lagoon's east end, **`C`
//     (26, 3)** on the north-east shoulder of the reef flat. A→B is 34, A→C is 35, C→B is 15.
//     `C` is the point of the whole retrofit: **the reef walk is now a destination and not only
//     a means**, and it is placed *past* the breach mouth rather than short of it, so a walker
//     owing both has to choose whether to drop into the lagoon or keep going round.
//   · Why the north-east shoulder and not the east point proper: the east point is 44 tiles from
//     `A`, which reads better and measures worse — it puts `C` a third of a lap beyond `B`,
//     makes the ordered role a seventy-tile trip, and shows up as walkers nobody could ever have
//     delivered. Thirty-five tiles is a full northern arc and it keeps both legs playable.
//
// THE DIALS, measured 2026-08-06, 200 games a cell, seed 1:
//
//   | policy            | served | win | gaveUp | killed | dets | refund |
//   | ----------------- | ------ | --- | ------ | ------ | ---- | ------ |
//   | handOnly          |     0% |  0% |   12.0 |    0.0 | 0.00 |   0.00 |
//   | genRush           |    19% | 76% |    0.9 |    8.8 | 8.36 |   0.85 |
//   | balanced:0.4      |    27% | 87% |    1.6 |    7.1 | 7.12 |   0.25 |
//   | balanced-beta:0.4 |    26% | 78% |    2.0 |    6.9 | 6.72 |   0.24 |
//   | careful:0.4       |     4% | 22% |    8.6 |    2.9 | 5.10 |   0.13 |
//
//   · **27% is the best row in the corpus**, and the shape is right: genRush 19 < balanced 27 >
//     careful 4, both extremes losing in opposite directions (`genRush` loses 8.8 users to
//     blasts and almost nobody to the clock; `careful` loses 8.6 to the clock and 2.9 to blasts).
//   · **`arrivals: 12 / 14 / 1` with `patience: 7`.** The crush stays a crush — twelve users in
//     twelve turns — but it moves. Both numbers are set against measured route-open ticks (40
//     games, schedule taken out of the way so the game cannot end first):
//
//       | policy       | B opens | C opens |
//       | ------------ | ------- | ------- |
//       | genRush      |       8 |       7 |
//       | balanced:0.4 |      21 |      16 |
//       | careful:0.4  |      34 |      29 |
//       | handOnly     |      33 |      40 |
//
//     The last walker spawns on 25 and is gone by 32; a hand build cannot open B before 33. So
//     the floor is one turn wide and it is arithmetic: **`handOnly` delivers nobody** — 500
//     games on seed 1 and 500 on seed 7, zero served and zero wins, against the 75% this level
//     scored on the morning of the same day. At the other end the crush lands on turns 14–25,
//     straddling `balanced`'s 16
//     and 21 — walkers arrive while the route is being finished and has not been read, which is
//     the only window where the game's actual question gets asked. Note `C` opens *before* `B`
//     for every AI policy: the reef walk is the cheaper half, which is what makes the ordered
//     role in the cast a real temptation rather than a tax.
//   · **`mineDensity: 0.1`, down from 0.14, and here it is a live dial** — unlike `caldera`,
//     whose 12-cell blocks are pinned by the two-defect floor. This pool is 14–26 cells, so the
//     binomial is doing the work and the response is monotone and steep: 0.10 → 27%, 0.12 → 24%,
//     0.14 → 19%, 0.17 → 12%.
//   · **`blastRadius: 0`.** Same finding as `caldera` and the same size: hold everything else
//     and turn the neighbours back on and the best policy scores **5%** instead of 27%. The reef
//     already stops blasts sideways (SPEC §5), which is why this level survived at radius 1 for
//     two days — but a crater in a six-wide flat still severs the only route round the island,
//     and the repair is fresh slop for the next walker to die on.
//   · **`shapePool: 'awkward+heavy'`, unchanged, and the 6×5 heavies do fit.** On the empty board
//     `J22` has 387 anchor-free positions and `B26` 319 — the flat is six wide, which is exactly
//     their long side, so they land along it and nowhere else. In play the refund column reads
//     **0.25 per game for `balanced:0.4`** against 0.00 before the rebuild, and the A/B is clean:
//     take the shore bar out and leave everything else alone and refunds go to 0.00 — and
//     `handOnly` goes to 8%. That is the trade, stated: a fortieth of a Generate per turn, for
//     the floor. `genRush`'s 0.85 is a different animal and not a map problem — it never lays a
//     tile by hand, so it boxes its own frontier in and then re-draws the same refused stencil.
//   · **`betaSupply: 3`.** The long reef walk is the case for the verb, and the measurement is
//     underwhelming: 26% with betas against 27% without, inside the noise. The one thing the beta
//     policy does own is the only `perfect` in the table — **1%**, twelve of twelve, which no
//     other policy on either of today's two levels managed even once.
//
// THE CAST is four roles against twelve arrivals, so the deal is exactly 3/3/3/3. `{ B }` is the
// lagoon alone; `{ C }` is the reef walk alone; `{ C, B }` is **ordered** — the reef point first
// and *then* into the lagoon, which is the level's decision made personal: that walker goes past
// the breach mouth it needs, spends fifteen tiles coming back to it, and cannot be helped by a
// finished B route until it has stood on C. And `{ C }` on `patience: 4` against the level's 7 is
// the roster's countdown. Four is set against the table above rather than picked: the C route
// opens on 16 and the first walker spawns on 14, so an impatient one at the head of the queue has
// two ticks of slack and one at the back has none to spare — what kills them is not the opening
// wait but the *second* one, the stall after a crater somewhere out on the reef. They are the
// level's argument for reading a block before you walk somebody over it, one row of the roster
// long.

/** @type {import('./index.js').LevelDef} */
export const atoll = {
  id: 'atoll',
  name: 'The Atoll',
  map: `
..................................
.......####################.......
.....########################.....
....######################C###....
...############################...
..##############################..
.################################.
.######^^^^^^^^^^^^^#############.
.######^^^^^^^^^^^^#######^######.
.######^^^^^^^^^^^^#####^^^######.
.######^^^^^^^^^^^####^^^^^######.
.######^^^^############^^^^######.
.######^^^^############^^^^######.
.A#####^^^^##########B#^^^^######.
.######^^^^############^^^^######.
.######^^^^^####^^^^^^^^^^^######.
.^^^^^^^^^#####^^^^^^^^^^^^######.
.^^^^^^^#######^^^^^^^^^^^^######.
.#############^^^^^^^^^^^^^######.
.################################.
..##############################..
...############################...
....##########################....
.....########################.....
.......####################.......
..................................
`,
  arrivals: { count: 12, firstTick: 14, every: 1 },
  patience: 7,
  mineDensity: 0.1,
  blastRadius: 0,
  betaSupply: 3,
  shapePool: 'awkward+heavy',
  walkers: [
    { stops: ['B'] },
    { stops: ['C'] },
    { stops: ['C', 'B'], ordered: true },
    { stops: ['C'], patience: 4 },
  ],
};
