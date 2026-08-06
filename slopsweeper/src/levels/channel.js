// @ts-check
// A channel descending diagonally across a mostly-void board (PLAN §9). Almost every cell
// touches coastline, which per SPEC §7.5 makes the deduction layer *easier* while the
// routing layer gets tighter — the axis this level exists to isolate.
//
// TUNING NOTE (M2): the first draft was a true diagonal band four cells wide, shifting two
// columns per row. It measured badly for a reason worth writing down: consecutive rows
// overlapped in only two columns, so nothing three cells tall could ever land, and three of
// the five `compact` shapes fit *nowhere on the board* — 60% of Generates refunded and the
// level collapsed into hand-only. A staircase of landings keeps the coastline density and
// the diagonal read while giving blocks somewhere to sit.
//
// RESCALE (2026-08-04): 22×9 → 40×16. The landings grew with the blocks — each is now
// 14–17 wide and 6–7 tall, which is the smallest that admits the 5×5 stencils. The
// staircase overlaps by two rows rather than one, so the junctions are chunky enough to
// build across instead of being single-tile hinges.
//
// RETUNED 2026-08-04 (Analyze became one minesweeper click, SPEC §4.3): reading a block now
// costs several turns instead of one, so every level in the corpus got a looser schedule and
// a lower defect density.
//
// ─────────────────────────────────────────────────────────────────────────────────────────
// THREE DESTINATIONS DOWN THE STAIRCASE — 2026-08-06 (owner placement, then a tuning pass)
// ─────────────────────────────────────────────────────────────────────────────────────────
//
// The owner hung the three destinations off the staircase itself: **C** at the east end of the
// upper landing, **B** at the west edge of the third landing, **D** on the east edge of the
// bottom landing. Those positions are kept exactly as placed. Everything below is what the sim
// said had to change around them.
//
// **The three legs, priced in turns**, because every other number in this file is derived from
// these three:
//
//   | leg   | tiles | a hand build opens it on |
//   | ----- | ----- | ------------------------ |
//   | A → B |    18 | turn 17                  |
//   | A → C |    28 | turn 27                  |
//   | A → D |    50 | turn 49                  |
//
// (The `handOnly` bot reads 17 / 32 / 53 — it always builds toward the *nearest* unconnected
// destination, so it pays for B before it starts on C, and in practice the run is over long
// before it gets anywhere near D. A player reads the roster,
// sees that nobody's first stop is B, and builds straight at C — so **27 is the honest floor**,
// and it is the one this level is tuned against. Five turns of the bot's margin are an artefact
// of how the bot chooses, and they were deliberately not spent.)
//
// **THE ESCORT — the failure this level exists to have avoided.** The first cast written here
// was the obvious one: a lone-C errand, a loose `['C','B','D']` tour, the ordered twist, an
// impatient deep errand. It measured `handOnly` at 22–45% served on every schedule tried, which
// is the one outcome the corpus forbids. The mechanism is worth stating plainly because it will
// catch the next author too: **a loose itinerary departs the moment ANY of its stops is
// connected**, and B is connected on turn 17. From there the hand builder lays one tile a turn
// and the walker steps one tile a turn, so each successive leg finishes *just before* the walker
// arrives at it. The walker is escorted the whole way down the staircase and never accumulates a
// single tick of waiting, and patience cannot bite something that is always moving. Hence the
// rule this map now obeys:
//
//   **No loose list may contain B.** B is reachable too cheaply to be anybody's opening move. It
//   appears exactly once, as the *second* stop of an ordered pair — the place you have to climb
//   back up for — and that is the only way it enters the cast at all.
//
// **THE CAST**, six entries against nine arrivals, so the deal is 2/2/2/1/1/1 (casting.js cycles
// the pool then shuffles it: the mix is the level's, the running order is the seed's):
//
//   · **`{C}` × three entries → six of the nine walkers.** The short errand, and deliberately the
//     majority. The upper landing is the only leg the AI can buy inside this schedule, so it is
//     the leg that carries the score; going from two entries to three moved the best policy from
//     8% to 12% served without touching another number.
//   · **`{C,D}` loose** — with the flow, and it does not need the word `ordered`: C is nearer than
//     D from the origin, so nearest-first *is* downhill. This is the one place on the map where
//     the loose form already says what the author means.
//   · **`{D,B}` ordered, patience 24** — the twist. All the way to the bottom landing and then
//     back **up** the staircase to B. It owes D and only D until it has stood on it, so a route
//     that happens to pass B early ticks nothing off. Twenty-four rather than the level's five,
//     because a walker who has to reach the bottom before it starts is being asked for something
//     else entirely and its row on the roster should say so.
//   · **`{D}` patience 14** — the personal clock, and the rarest role (one walker in nine). Set
//     against the full staircase: fifty tiles of it, so hand-building cannot save them at any
//     speed, and a beta staged behind the frontier does not either. Generated ground on the D
//     leg, early, or nothing.
//
// **THE SCHEDULE is a staircase too** — `at: [11,12,13, 15,16,17, 19,20,21]`, three cohorts of
// three. Two constraints pin it and there is one turn of slack between them:
//
//   · **11 is where the AI's earliest C leg lands.** Measured over seeds, `genRush` opens C on
//     turns 6–13 and `balanced:0.4` on 11–31 (D lands on 9–12 and 18–31 respectively, which is
//     why the deep roles carry their own bars). Starting the schedule at 11 puts the first walker
//     on the board at the earliest moment generated ground could plausibly be carrying it.
//     Pushing `firstTick` out past that is the too-easy failure: quiet turns are free
//     build-and-read turns that cost nobody any patience, and banking them is precisely what
//     hand-only play does with them.
//   · **21 + 5 = 26, and the honest hand build of the C leg opens on 27.** That one-turn gap is
//     the whole floor. Every walker is gone before hand-building alone could have served the
//     first of them, which is why `handOnly` reads a clean 0% and does not even post a `win`.
//
// **`patience: 5`** is therefore not a mood, it is the second half of that arithmetic — and it is
// honest about who this level is mostly made of. Six of nine walkers only ever wanted the top
// landing, and people on a short errand do not wait. The two who signed up for the bottom of the
// staircase carry their own, far longer bars, which is what per-walker `patience` is for.
//
// **`blastRadius: 0`** is the largest single dial here and it was not a stylistic choice. At the
// corpus-standard 1, every policy scored **1–2% served**; at 0 the same definitions score
// **11–15%**. The reason is geometric rather than lethal: `killed` barely moves (6.0 against
// 5.2), but `gaveUp` collapses (1.9 against 3.6). A staircase is a corridor with landings — one
// route through each — so a five-tile crater is not a detour, it **severs the level**, and the
// rebuild costs three or four turns nobody on a five-tick bar has. Radius 0 keeps the honest half
// of the rule (step on a defect and you lose the walker who stepped on it) and drops the
// collateral demolition this geometry cannot absorb. It moves `handOnly` by exactly zero, because
// a hand build never detonates, so it widens the gap the level stands on instead of flattening
// it. `tutorial` reaches for the same setting for the same reason and its header claims to be
// alone in it; on this evidence that claim wants revisiting rather than this level does.
//
// **`shapePool: 'compact+awkward'`.** It used to read `'compact+'`, which the `+` grammar resolves
// to `compact` **alone** — the owner's standing rule now forbids that, and it was doing the level
// no favours anyway. The landings run 14–17 wide by 5–7 tall and the junction band at columns
// 10–13 is nine rows deep, so both presets place in full at some rotation: `refund` measures
// 0.01–0.04 per game, which is as close to "the pool fits the geometry" as that column gets. No
// corridor here is under four rows, so the explicit-only `M12` and `N16` are not earned and are
// not named.
//
// **`betaSupply: 2`.** Three landings, two betas: one short of breadcrumbing the staircase, which
// is the point. It is also the only dial that separates the two best policies —
// `balanced-beta:0.4` beats plain `balanced:0.4` by three points (15% against 12%), entirely by
// converting origin-waiting into walking, which on a fifty-tile descent is worth more than it
// sounds. It is the clearest measurement of the beta verb anywhere in the corpus; `strait`, next
// door, measures it as a wash, and the two rows together are the answer to "when is a beta worth
// a turn".
//
// THE NUMBERS (200 games a cell, seed 1, `node src/sim/run.js --level channel`):
//
//   | policy            | served | win | gaveUp | killed | dets |
//   | ----------------- | ------ | --- | ------ | ------ | ---- |
//   | handOnly          |     0% |  0% |    9.0 |    0.0 | 0.00 |
//   | genRush           |    11% | 53% |    0.6 |    7.4 | 7.15 |
//   | balanced:0.4      |    12% | 53% |    1.9 |    6.0 | 6.32 |
//   | balanced-beta:0.4 |    15% | 57% |    1.3 |    6.3 | 6.26 |
//   | careful:0.4       |     0% |  2% |    8.5 |    0.5 | 4.72 |
//   | careful-beta:0.4  |     0% |  3% |    7.3 |    1.7 | 5.11 |
//
// Three honest caveats about that table:
//
//   · **`careful` scores 0% and that is the level talking, not a bug.** Reading every block before
//     building past it costs twenty analyses, and on a five-tick bar the queue is long gone before
//     the C leg opens. Channel punishes over-reading harder than anything else in the corpus. The
//     spread — genRush 11, balanced 12, balanced-beta 15, careful 0 — is the property to protect
//     when somebody retunes this.
//   · **`perfect` is 0%, and is probably out of reach for a bot.** Nine of nine wants six walkers
//     across a 28-tile route and three more across a 50-tile one without a single misstep, and the
//     sim bots never flag. A flagging player's odds are better than zero; nobody has measured how
//     much better, and this note is not going to pretend otherwise.
//   · **Every AI figure above is a floor**, for the same reason (`src/sim/policies.js`, top).

/** @type {import('./index.js').LevelDef} */
export const channel = {
  id: 'channel',
  name: 'The Channel',
  map: `
##############..........................
##############..........................
A#############..........................
##############..........................
##########################C.............
###########################.............
..........#################.............
..........#################.............
..........#################.............
..........##############################
..........B#############################
.......................#################
.......................#################
.......................################D
.......................#################
.......................#################
`,
  // Three cohorts of three, one per notional landing — and the last of them lands exactly one
  // turn inside the honest hand-only opening of the C leg (see the header).
  arrivals: { at: [11, 12, 13, 15, 16, 17, 19, 20, 21] },
  patience: 5,
  mineDensity: 0.11,
  betaSupply: 2,
  blastRadius: 0,
  shapePool: 'compact+awkward',
  walkers: [
    { stops: ['C'] },
    { stops: ['C'] },
    { stops: ['C'] },
    { stops: ['C', 'D'] },
    { stops: ['D', 'B'], ordered: true, patience: 24 },
    { stops: ['D'], patience: 14 },
  ],
};
