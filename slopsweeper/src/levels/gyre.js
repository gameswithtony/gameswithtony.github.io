// @ts-check
// THE RING (2026-08-06). Every other level in the corpus asks *what* to build. This one asks
// **which way round**, and it is the only question it asks: an annulus of open water seven
// cells wide around a volcano massif, the origin on the west point, and three destinations at
// the other three. There is no shortcut, no neck and no trunk. There is a decision you make on
// turn one — north or south — and then you live in it.
//
// THE SHAPE. 37×25. An octagonal ring, uniformly seven cells wide, wrapped round a nineteen-by-
// nine volcano. `A` west, `B` north, `C` east, `D` south. What that buys, in tiles:
//
//   | leg   | A→B | A→D | A→C  | B→C | C→D | B→D  |
//   | ----- | --- | --- | ---- | --- | --- | ---- |
//   | tiles |  27 |  27 |   42 |  27 |  27 |   42 |
//
// **`C` is the coin-flip.** Forty-two tiles clockwise, forty-two counter-clockwise, to the
// cell. Nothing on the board breaks that tie — the tie is broken by *who else is on the
// roster*, which is the whole design. Going north to reach `C` passes through `B` and delivers
// the `B` errands on the way; going south passes `D`. So the direction is priced by the hand
// you were dealt, and the price is different every game.
//
// The volcano is doing three jobs at once and it is worth naming them separately, because only
// two of them survived tuning. It is the **inner coastline** — void outside, volcano inside,
// so a ring cell is never more than three or four steps from something that counts zero for
// clues, and the minesweeper layer here is the easiest in the corpus (README §6: coastline is a
// difficulty-*reducing* axis). It **deletes placements**, which is why the ring is seven wide
// and not five: `heavy` needs a clear 5×5 and `J22`/`B26` need 6×5, and seven admits them
// everywhere, so `refund` reads a flat **0.00** in every row of the table below. And it **stops
// blasts**, which is the tactical lesson the brief asked this level to carry — build against
// the inner wall and a detonation loses half the neighbours it would have taken in open water.
// That third one is real in the rules and **the bots cannot show it**: `balanced-edge:0.4`,
// the policy that deliberately hugs coastline, measures 6% against plain `balanced`'s 6% and
// buys 0.7 fewer deaths for 0.8 more walk-outs. It is a human's tactic on this board, not a
// measurable one, and this header would rather say that than pretend the sim agrees.
//
// WHEN EACH DESTINATION OPENS, measured with the arrival pressure removed (40 runs a policy,
// median first tick connected). **This table is the reason the cast looks the way it does:**
//
//   | policy       |  B |  C |  D |
//   | ------------ | -- | -- | -- |
//   | handOnly     | 26 | 52 | 78 |
//   | genRush      |  4 | 10 | 11 |
//   | balanced:0.4 |  9 | 27 | 21 |
//   | careful:0.4  | 19 | 56 | 42 |
//
// Read the `handOnly` row: a hand build circumnavigates. It closes `B` on 26, carries on round
// the top to `C` on 52, and only reaches `D` on 78. So the floor a level needs — *nobody
// arrives without AI* — binds at three completely different turns depending on where a walker
// is going, and a single level-wide `patience` would have to be set against the tightest of
// them and would then be far too mean for the other two.
//
// **So the errands are priced in patience, one walker at a time** (README §3b: "per-walker
// patience prices a route in people rather than in turns"). Fourteen users arrive one a turn
// from turn 4, so the last spawns on 17, and each tier is set against its own hand-build
// deadline and its own AI opening:
//
//   | role                       | bar | dies by | AI opens | hand opens |
//   | -------------------------- | --- | ------- | -------- | ---------- |
//   | `{B}` ×5 (level bar)       |   8 |      25 |        9 |         26 |
//   | `{D}` ×4                   |  15 |      32 |       21 |         78 |
//   | `{C}` ×2                   |  22 |      39 |       27 |         52 |
//   | `{D,B}` ordered            |  18 |      35 |       21 |         78 |
//   | `{B,C,D}` ordered (level)  |   8 |      25 |        9 |         26 |
//   | `{B}` impatient            |   5 |      22 |        9 |         26 |
//
// Every row dies before its hand build lands and after its AI build could have — which is what
// a floor *is*, stated per person instead of per level. It is also the level's UI: the roster
// on turn 4 shows a 22-tick bar next to a 5-tick bar, and those two numbers are a map of which
// way round the ring the game wants you to go this time.
//
// THE CAST, nine roles against fourteen arrivals — an exact 2/2/2/2/2/1/1/1/1 mix, shuffled
// (§3b). Undersized on purpose: `marina` next door is the repertoire showcase, and a ring where
// you cannot *see* the demand would make the direction call a guess rather than a read.
//
//   · **Five `B`, four `D`, two `C`** once the nine roles are dealt across fourteen slots.
//     Weighted hard toward the twenty-seven-tile points, because a walker who owes `C` is a
//     forty-two-tile walk over generated ground and the level cannot afford many of them (see
//     `killed`, below). The two that remain are enough: `C` is the question, not the volume.
//   · **`{B,C,D}` ordered** — the forced circumnavigation, 81 tiles, on the level's own eight-
//     tick bar plus a half-bar back at each of the first two stops. It is the only role that
//     cannot answer the level's question: it goes clockwise because it was told to.
//   · **`{D,B}` ordered** — the backtrack, and the counterweight. It owes the *south* point
//     first and then the north one, so a player who committed north on turn one watches it
//     stand at the origin in front of a finished `B` route it may not use yet.
//   · **`{B}` on a bar of 5.** North opens on turn 9 at best; this walker gives you about three
//     turns of grace. It is the reason the opening move is usually north — and the reason the
//     `{D,B}` row hurts when it lands.
//
// THE DIALS. **`mineDensity: 0.10`**, the bottom of the band — the brief asked for 0.13–0.16
// and the sim refused it: two coastlines make this the most legible board in the corpus, but
// legibility does not help a walker who is *already on* a twenty-seven-tile route made of slop,
// and 0.13 costs a point flat. **`blastRadius: 1`**, the corpus default, kept deliberately —
// see the honest note at the bottom. **`betaSupply: 3`**, and they do not earn it (below).
// **`awkward+heavy`**, which the seven-wide ring admits entirely; heavy is what makes a
// half-circuit affordable at all.
//
// THE NUMBERS (200 games a cell, seed 1, `node src/sim/run.js --level gyre`):
//
//   | policy            | served | win | gaveUp | killed | medTicks | dets | refund |
//   | ----------------- | ------ | --- | ------ | ------ | -------- | ---- | ------ |
//   | handOnly          |     0% |  0% |   14.0 |    0.0 |        — | 0.00 |   0.00 |
//   | genRush           |     6% | 41% |    1.6 |   11.6 |       51 | 6.97 |   0.00 |
//   | balanced:0.4      |     7% | 42% |    4.5 |    8.5 |       54 | 6.33 |   0.00 |
//   | balanced-beta:0.4 |     5% | 35% |    4.8 |    8.5 |       58 | 5.66 |   0.00 |
//   | careful:0.4       |     3% | 22% |   10.7 |    3.0 |       46 | 5.21 |   0.00 |
//   | careful-beta:0.4  |     1% | 14% |   10.0 |    3.8 |       58 | 4.97 |   0.00 |
//
//   · **The ordering is the one the game wants.** `balanced:0.4` on top, `genRush` a point
//     behind it, `careful` a third of it, `handOnly` at zero. This is the only one of the three
//     2026-08-06 levels where reading beats spraying on the baseline sweep, and it is the
//     blast radius that does it: at radius 1 an unread defect costs five cells of ring and
//     everyone standing in them, so `genRush` pays 11.6 deaths a game for its speed.
//   · **Betas do nothing here, and the level says so rather than hiding it.** 7% → 5%. Beta is
//     a verb for a long unbuilt gap behind a frontier (README §3c); a ring builds one
//     continuous arc and the frontier *is* the far end, so the staging post the bot ships is
//     usually a tile the queue would have reached anyway. `betaSupply: 3` is kept because a
//     human running the circumnavigation role has somewhere obvious to put them — the three
//     quarter-points — but nobody should read the supply as tuned-for.
//   · **Deaths cap it, as they cap the corpus.** Eight to twelve of fourteen walkers die in a
//     blast in every AI row. That is twenty-seven tiles of mostly-generated ground per walker
//     and forty-two for the `C` errands, and it is why the cast is weighted west and north.
//
// **THE ONE NUMBER A RETUNE SHOULD LOOK AT FIRST, stated plainly:** `blastRadius: 0` measures
// **15% for `genRush` and 12% for `balanced`** on this exact geometry, against the 6%/7% above.
// It was not taken. Radius 0 deletes the only thing the volcano can do for a *player* that it
// cannot do for a bot, flips the top row from `balanced` to `genRush`, and would make three of
// the four newest levels blast-free. The ring is the corpus's demonstration that a blast radius
// is the difference between a route and a rebuild; `marina` and `reach` pay for radius 0 with
// geometries that genuinely cannot survive a crater, and this one can. Both halves of that
// trade are measured, and the number is one field away if the owner wants the other half.
//
// `perfect` is 0% over 1000 games — fourteen walkers, three destinations, and bots that never
// flag. Every AI row is a floor.

/** @type {import('./index.js').LevelDef} */
export const gyre = {
  id: 'gyre',
  name: 'The Gyre',
  map: `
.....................................
.....#############B#############.....
....#############################....
...###############################...
..#################################..
..#################################..
..#################################..
..#################################..
..#########^^^^^^^^^^^^^^^#########..
..########^^^^^^^^^^^^^^^^^########..
..#######^^^^^^^^^^^^^^^^^^^#######..
..#######^^^^^^^^^^^^^^^^^^^#######..
..A######^^^^^^^^^^^^^^^^^^^######C..
..#######^^^^^^^^^^^^^^^^^^^#######..
..#######^^^^^^^^^^^^^^^^^^^#######..
..########^^^^^^^^^^^^^^^^^########..
..#########^^^^^^^^^^^^^^^#########..
..#################################..
..#################################..
..#################################..
..#################################..
...###############################...
....#############################....
.....#############D#############.....
.....................................
`,
  arrivals: { count: 14, firstTick: 4, every: 1 },
  patience: 8,
  mineDensity: 0.10,
  // Stated rather than inherited: nine of the ten levels override this to 0, and gyre keeping
  // the default is a decision (see the header), not an omission.
  blastRadius: 1,
  betaSupply: 3,
  walkers: [
    { stops: ['B'] },
    { stops: ['D'], patience: 15 },
    { stops: ['B'] },
    { stops: ['D'], patience: 15 },
    { stops: ['C'], patience: 22 },
    { stops: ['B'] },
    { stops: ['B', 'C', 'D'], ordered: true },
    { stops: ['D', 'B'], ordered: true, patience: 18 },
    { stops: ['B'], patience: 5 },
  ],
  shapePool: 'awkward+heavy',
};
