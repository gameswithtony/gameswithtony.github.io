// @ts-check
// THE TEACHING LEVEL. An open 32×20 rectangle, the origin on the west edge midway down, and two
// destinations on the east wall: B straight across, C six rows below it. No terrain to read, so
// every question this board asks is a question about the verbs.
//
// It is registered first, and `main.js` opens a new player on `levelIds()[0]`, so this file is
// the first thing anybody plays. Everything below is chosen for that job.
//
// PROVENANCE, because the shape of the board is older than its purpose:
//
//   · Born as `plain`, THE CONTROL LEVEL (PLAN §9) — the simplest possible arena, kept
//     deliberately hand-only-winnable so the corpus had one row where AI was optional and the
//     other five could be read against it.
//   · RESCALED 2026-08-04, 16×11 → 32×20, because the 12–26-cell blocks of the revised shape
//     table landed on the old board like furniture in a doll's house. The A→B route went from 15
//     tiles to 31.
//   · RETUNED 2026-08-04 when Analyze became one minesweeper click: reading a block costs three
//     or four turns now instead of one, so the schedule loosened and the density fell to 0.12.
//   · RENAMED AND REDESIGNED 2026-08-06 (owner decision). **The control-level role is retired.**
//     The rule now applies to every level in the corpus without exception: the design must make
//     generated blocks *necessary* — hand-only play must not be able to serve most walkers — and
//     every level carries several destinations. A level whose entire point was that you could
//     ignore the AI is the one level that rule deletes. So `plain` became `tutorial`: the same
//     board, the opposite premise. The id moved (`?level=tutorial`), the registration slot did
//     not, and the display name went with the premise — "Plain Sailing" was a promise this level
//     no longer keeps.
//
// WHAT IT TEACHES, in the order the board teaches it:
//
//   · **Place is too slow on its own.** The A→B route is 31 steps, thirty of them tiles you have
//     to lay, so a hand-only build opens it on turn 30 and the C leg five turns after that. The
//     whole schedule has come and gone by then. That is the owner's rule made of arithmetic
//     rather than stated in a tooltip, and it is the first thing a player finds out — `handOnly`
//     scores a clean **0%** here.
//   · **Generate is the answer, and it has a price.** A block covers four or five tiles of route
//     for one turn, and carries at least two defects (RULES.MIN_BLOCK_DEFECTS) whatever the
//     density says. The game is that trade, and this level has nothing else in it to distract
//     from it.
//   · **Reading the slop is not optional either.** `genRush` — generate, never review — scores
//     6%. `balanced:0.4` — generate about half the time and review what it generated — scores
//     19%, three times better. The level's own sim table is the argument for Analyze.
//   · **Two destinations, forking late.** B is straight across; C hangs six rows below it on the
//     same wall. The cheapest build to either runs the same long trunk east and then turns, so
//     closing B leaves C five tiles further on — thirty turns of shared work and then a fork
//     nobody has to agonise over. It is the gentlest possible version of the trunk decision
//     `delta` makes you take under pressure. Nothing is `ordered` here; sequencing is a later
//     lesson.
//   · **The roster is a countdown.** One walker in nine carries `patience: 5` against the level's
//     8. Mildly impatient, not doomed: they are there so a new player meets a `LEAVES IN` row
//     that is shorter than the others and learns to read the panel, and the number is set so that
//     a decent opening still saves them.
//   · **Beta exists.** Two of them. A 31-tile trunk is long enough for staging to be worth a
//     turn, which is the condition under which the verb has anything to say at all.
//
// THE NUMBERS (200 games a cell, seed 1, `node src/sim/run.js --level tutorial`), measured on
// 2026-08-06 against the twenty-stencil shape table that landed the same day — every figure here
// is a draw from `compact+awkward`, so a change to either pool is a reason to re-run this:
//
//   | policy            | served | win | gaveUp | killed | dets |
//   | ----------------- | ------ | --- | ------ | ------ | ---- |
//   | handOnly          |     0% |  0% |    9.0 |    0.0 | 0.00 |
//   | genRush           |     6% | 35% |    0.8 |    7.6 | 7.41 |
//   | balanced:0.4      |    19% | 64% |    0.9 |    6.4 | 6.11 |
//   | balanced:0.7      |    13% | 56% |    0.7 |    7.1 | 7.38 |
//   | balanced-edge:0.4 |    18% | 62% |    1.0 |    6.4 | 6.05 |
//   | careful:0.4       |     1% |  4% |    8.0 |    0.9 | 3.85 |
//
// Read it in four passes, because it is not the table the brief asked for:
//
//   · **The floor is exact.** `handOnly` delivers nobody in 200 games out of 200, and it is not
//     close: every user is gone by turn 29 and the hand build opens on turn 30. It does not even
//     post a win — `win` is "at least one user arrived", the metric that reads high everywhere by
//     design, and here it is 0%. Rule 6a holds by construction rather than by tuning luck.
//   · **The shape of the spread is the lesson.** genRush 6% < balanced 19% > careful 1%. Both
//     extremes lose, and they lose in opposite directions, which the `gaveUp`/`killed` columns say
//     out loud: genRush loses 7.6 users to blasts and almost nobody to the clock, careful loses
//     8.0 to the clock and almost nobody to blasts. Spraying slop kills the people who walk it;
//     reading every block to the end is thirty turns nobody has. The middle wins by three to
//     twenty times. That is the game's whole thesis, and it is the one property of this level
//     worth protecting when somebody retunes it.
//   · **Nobody reaches 50–80%, because on this board nobody can.** The sim bots never flag
//     (`src/sim/policies.js` says so at the top), so they walk users straight over unreviewed
//     slop, and a route made mostly of generated ground kills roughly one walker per five tiles
//     of it. Measured corpus-wide the AI policies lose six to nine of their nine users to blasts
//     and the best row anywhere is `atoll`'s 24%. That ceiling belongs to the bots, not to this
//     level: a player who flags a deduced mine, or spends one turn on a cascade before the queue
//     moves, does not take those losses. **Every AI number above is a floor**, and `win` is the
//     column that says the level is playable — two games in three, `balanced:0.4` gets somebody
//     through.
//   · **`perfect` is 0.2%** — two runs in a thousand for `balanced:0.4` (1000 games, seed 1;
//     it rounds to 0% in the 200-game table above, which is why it is quoted from the longer
//     run). Attainable and rare, exactly as intended, and a human's odds are far better than a
//     bot's: nine of nine wants the route open by turn 15 and not one walker stepping on a
//     defect, which is a flagging problem and the bots do not flag.
//
// THE DIALS, and what each one is doing:
//
//   · **`arrivals: 9 / 13 / 1`** — nine users, first on turn 13, one a turn after that. Two
//     decisions in one line. The **thirteen quiet turns** are the tutorial: nobody is waiting, so
//     a new player can try Generate, misplace a ghost, click a mine and watch what happens with
//     nothing on the line. The **single-turn burst** is the level: turns 13–21 is entirely inside
//     the window between "a competent AI build opens the route" (~turn 14) and "a hand build
//     does" (turn 30). That window is sixteen turns wide on this geometry and it is the whole
//     reason the floor exists. Spread the burst out — `every: 2` — and the tail of the schedule
//     starts arriving after a hand build has finished, which hands the level straight back to
//     `handOnly`. On a level with a floor, `every` is not the dial (`src/levels/README.md` §3).
//   · **`patience: 8`.** Set against the same window, not picked. The last user spawns on 21 and
//     a hand build opens on 30, so anything under 9 means no hand-built route can ever save
//     anybody; at 12 the tail of the burst survives one and the floor starts leaking. Eight also
//     says something true to the player: by the time the first walker arrives, the route had
//     better be nearly finished.
//   · **`mineDensity: 0.10`**, the bottom of the validator's tuned band, because the two-defect
//     floor already puts two mines in every block whatever this number says (README §4) and a
//     teaching level should not add a tail on top of that. 0.12 costs `balanced:0.4` three points.
//   · **`blastRadius: 0`** — by a distance the biggest lever on the table above. A defect takes
//     out its own tile and whoever was standing on it, and nothing else. At `blastRadius: 1`
//     this level scores **3%** for its best policy instead of 19%, because a five-tile crater in
//     a 31-tile trunk is a rebuild the schedule cannot absorb. And it moves `handOnly` by
//     exactly zero — a hand build never detonates — so it widens the gap the level is built on
//     instead of flattening it. As a lesson it is the honest half of the real rule: step on a
//     defect and you lose the walker who stepped on it. (This header used to call the setting
//     unusual and claim the rest of the corpus turns the neighbours back on. By the end of the
//     2026-08-06 pass that was false: nine of the ten levels reached the same conclusion
//     independently — single-file routes and chokepoints mean a radius-1 blast kills the queue,
//     not the culprit — and `gyre`, whose seven-wide ring and blast-stopping volcano core are
//     the terrain that answers blasts, is the one level that keeps radius 1.)
//   · **`shapePool: 'compact+awkward'`**, never `compact` alone — the owner's standing rule. The
//     board is open enough for every stencil in both presets in every rotation, so placement is a
//     real choice from the first Generate rather than a formality.
//   · **`betaSupply: 2`** — one more than the old control level, one fewer than the default:
//     enough to teach the verb and stage the trunk once, nowhere near enough to breadcrumb it.
//     A perfect run plausibly wants one, dropped mid-trunk while the far half is still open, so
//     that the queue is walking instead of waiting.
//
// THE CAST is written out entry by entry rather than weighted, because **nine roles against nine
// arrivals means every one of them is cast, exactly once**, in an order the seed shuffles (see
// `src/core/casting.js` §3b). So the demand is always five for B, two for C, one for both and one
// on a short clock — a mix a player can learn and plan against — while *who walks through the
// door when* is different every game. That is the smallest possible demonstration of what a cast
// is for, which is the right size for a first level.

/** @type {import('./index.js').LevelDef} */
export const tutorial = {
  id: 'tutorial',
  name: 'Open Water',
  map: `
################################
################################
################################
################################
###############B################
################################
################################
################################
################################
################################
A##############################C
################################
################################
################################
################################
################################
################################
################################
################################
################################
`,
  arrivals: { count: 9, firstTick: 7, every: 1 },
  patience: 8,
  mineDensity: 0.1,
  betaSupply: 2,
  blastRadius: 0,
  shapePool: 'compact+awkward',
  walkers: [
    { stops: ['C'] },
    { stops: ['C'] },
    { stops: ['C'] },
    { stops: ['C'] },
    { stops: ['C'] },
    { stops: ['C'] },
    { stops: ['B'] },
    { stops: ['B', 'C'] },
    { stops: ['B'], patience: 5 },
  ],
};
