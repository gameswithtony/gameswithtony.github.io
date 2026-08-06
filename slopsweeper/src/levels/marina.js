// @ts-check
// THE COMB (2026-08-06). One shared spine, four piers that fail independently, and not enough
// turns for all four. `delta` asks which *route* you commit to; this one asks **which of four
// you are willing to abandon**, and it asks it again every run because the demand is dealt
// from a repertoire rather than fixed (§3b of `src/levels/README.md`).
//
// THE SHAPE. 36×14. A six-row spine runs the whole width along the south edge with the origin
// at its west end, and four piers — four columns wide, eight rows tall — rise north off it,
// spaced one column apart, with `B`, `C`, `D` and `E` at the tips. Sixteen columns of open
// approach come first, which is the part of the build that pays for nothing until the first
// pier is climbed.
//
// The geometry is one arithmetic fact and everything else follows from it:
//
//   | route | A→B | A→C | A→D | A→E |
//   | ----- | --- | --- | --- | --- |
//   | tiles |  27 |  32 |  37 |  42 |
//
// Five tiles of pitch between the tips — but **the climb is never shared**. Opening `B` is 27
// tiles; adding `C` is five more of spine *plus a fresh ten-tile climb*, so the second pier
// costs 15, the third 15, the fourth 15. All four is 72 tiles of build against a schedule that
// is over by turn 20. That is the level: the spine is cumulative, the piers are not, and a
// player who spreads themselves across the comb finishes four half-built piers and delivers
// nobody.
//
// WHEN EACH PIER ACTUALLY OPENS, measured with the arrival pressure removed so the build runs
// to completion (40 runs a policy, median first tick each destination becomes connected):
//
//   | policy       |  B |  C |  D |  E |
//   | ------------ | -- | -- | -- | -- |
//   | handOnly     | 26 | 39 | 52 | 65 |
//   | genRush      |  6 |  8 | 12 | 14 |
//   | balanced:0.4 | 12 | 19 | 27 | 35 |
//   | careful:0.4  | 24 | 38 | 49 | 64 |
//
// **That table is where `arrivals` comes from, and it is the whole of the tuning.** The window
// a competent build owns on this board is turns 12 through 26 — after AI can plausibly open
// `B`, before a hand build does. Twelve users arrive one a turn from turn 9, so the last spawns
// on 20; `patience: 5` puts every death between turn 14 and turn 25. The entire schedule
// therefore lives and dies *inside* the window: nobody is asked to survive a stretch where no
// route could exist, and nobody is still standing when the hand build finally lands. `handOnly`
// reads a clean **0%** over 200 games — twelve gave up, none killed, every time.
//
// This is the correction that made the level. The first draft opened on turn 3 with a patience
// of 14 and scored 0–1% for every policy: five walkers spent ten turns bleeding out before any
// pier could have existed, which is not difficulty, it is dead air. Moving `firstTick` from 3
// to 9 and cutting `patience` from 14 to 5 is worth about eleven points. Note which way the
// dials went — a *later* start with a *shorter* bar. Reach for `firstTick` before `patience`
// when a level reads as hopeless; a long quiet opening is the opposite failure, and it hands
// the board back to `handOnly`.
//
// THE CAST IS A REPERTOIRE — the point of the level, and the feature it was written to show.
// **Sixteen roles against twelve arrivals**, so four of them sit out every game and which four
// is the seed's business: 1,820 possible hands, none of them learnable. The player reads the
// roster on turn 9 and *then* decides which piers to open, which is a different game from
// executing a plan they already know. Role by role:
//
//   · **Four `B`, four `C`, three `D`, one `E`.** The single-pier errands, weighted west. A
//     harbour mostly serves the near berths, and the weighting is also what keeps the level
//     scoreable: a hand dealt three `E`s would be unwinnable through no fault of the player.
//   · **`{B,D}` and `{C,E}`** — the cross-comb trips, loose. Down one pier, along the spine,
//     up another: 84 and 88 tiles of walking, and the loose order means they take the near one
//     first, so each is really "open my cheap pier, then my expensive one".
//   · **`{E,B}` ordered** — far then near, enforced. It owes the *most* expensive pier first
//     and will stand at the origin watching a finished `B` route it is not allowed to use
//     (§3 of the README). It is the level's most expensive single row and it is meant to be:
//     one look at the roster tells you whether this run is asking you to go all the way east.
//   · **`{D}` on a bar of 3** against the level's 5 — the impatient far-pier errand. `D` opens
//     on turn 27 at best and this walker is gone within three turns of arriving, so it is a
//     loss you can read the moment it spawns. It is there to be *written off*, which is a skill
//     this level needs and the others do not.
//
// THE DIALS, and why each is where it is:
//
//   · **Piers four columns wide, not five.** Of `compact+awkward` only `K19` and `D20` need
//     five in both directions, so those two can never enter a pier — they land on the spine
//     instead and the turn buys nothing toward the tip. That is a real placement tax paid two
//     draws in fourteen, and it is why `refund` stays near zero (0.04–0.53 a game) while the
//     piers still argue with the pool: the block is legal *somewhere*, just not where you
//     wanted it. The six-row spine takes `C20` at 4×6 exactly.
//   · **`pierH: 8`.** Twelve-row piers were the first draft and they cost the level two thirds
//     of its score: `balanced-beta:0.4` measures 12% at eight rows, 5% at ten and 2% at twelve,
//     with `refund` climbing 0.4 → 1.4 → 2.9 as the taller piers run out of room to land
//     anything in. Pier height is the marginal cost of every pier after the first, and it
//     compounds four times.
//   · **`blastRadius: 0`**, borrowed from `tutorial` and for a structural reason rather than a
//     teaching one: a radius-1 crater is five cells, and a four-column pier does not survive
//     one. Measured on the shipped geometry, `balanced-beta:0.4` scores **2% at radius 1 and
//     12% at radius 0**, and widening the piers to five or six columns does not rescue it
//     (2% and 3%). A defect here kills the walker who stepped on it and nothing else.
//   · **`mineDensity: 0.12`**, mid-band. 0.10 hands another point to `genRush`, 0.16 costs
//     everyone five, and 0.20 halves the level.
//   · **`betaSupply: 2`.** The pier mouths are the staging posts, and the sim says so louder
//     here than anywhere in the corpus — see below.
//
// THE NUMBERS (200 games a cell, seed 1, `node src/sim/run.js --level marina`):
//
//   | policy            | served | win | gaveUp | killed | medTicks | dets | refund |
//   | ----------------- | ------ | --- | ------ | ------ | -------- | ---- | ------ |
//   | handOnly          |     0% |  0% |   12.0 |    0.0 |        — | 0.00 |   0.00 |
//   | genRush           |    10% | 63% |    1.3 |    9.5 |       62 | 9.03 |   0.53 |
//   | balanced:0.4      |     6% | 41% |    7.0 |    4.3 |       53 | 5.64 |   0.04 |
//   | balanced-beta:0.4 |    12% | 67% |    3.0 |    7.5 |       59 | 7.37 |   0.08 |
//   | careful:0.4       |     1% | 10% |   11.3 |    0.6 |       52 | 3.87 |   0.00 |
//   | careful-beta:0.4  |     0% |  4% |   11.2 |    0.7 |       54 | 3.52 |   0.00 |
//
// Three things worth reading out of it:
//
//   · **Betas are not a nicety on this level, they are the best turn on the board.**
//     `balanced:0.4` doubles from 6% to 12% when it is allowed to ship them, and the
//     `gaveUp` column says why: 7.0 → 3.0. Four routes and one queue means somebody is always
//     waiting at the origin for a pier that is three turns away, and a beta at a pier mouth
//     turns that wait into a walk. Two is enough to stage two piers and nowhere near enough to
//     breadcrumb the comb, which is the point of the number.
//   · **`careful` is not slow here, it is absent.** It opens `B` on turn 24 and `C` on turn 38,
//     against a schedule that is finished by 25. Reading every block before building past it is
//     a strategy for one route; on four it is a way of arriving after the harbour has closed.
//   · **`genRush` at 10% is the honest cost of `blastRadius: 0`,** and it is the one thing about
//     this level a retune should look at first. Spraying loses 9.5 of 12 walkers and still keeps
//     up, because a one-cell crater is repaired in a turn. It does not win — `balanced-beta`
//     does — but the gap is two points, not the three-to-twenty `tutorial` posts. If the comb
//     ever needs to say something sharper about reading, the dial is the pier width, not the
//     density: wider piers survive a bigger radius.
//
// `perfect` is **0% over 1000 games** and that is a property of the bots, not a target missed.
// Twelve walkers spread over four piers, with the sim never flagging a single deduced mine
// (`src/sim/policies.js`), cannot all arrive. A flagging human is the only player who could,
// and every AI row above is a floor for the same reason.

/** @type {import('./index.js').LevelDef} */
export const marina = {
  id: 'marina',
  name: 'The Marina',
  map: `
................#B##.#C##.#D##.#E##.
................####.####.####.####.
................####.####.####.####.
................####.####.####.####.
................####.####.####.####.
................####.####.####.####.
................####.####.####.####.
................####.####.####.####.
####################################
####################################
A###################################
####################################
####################################
####################################
`,
  arrivals: { count: 12, firstTick: 9, every: 1 },
  patience: 5,
  mineDensity: 0.12,
  betaSupply: 2,
  blastRadius: 0,
  walkers: [
    { stops: ['B'] },
    { stops: ['B'] },
    { stops: ['B'] },
    { stops: ['B'] },
    { stops: ['C'] },
    { stops: ['C'] },
    { stops: ['C'] },
    { stops: ['C'] },
    { stops: ['D'] },
    { stops: ['D'] },
    { stops: ['D'] },
    { stops: ['E'] },
    { stops: ['B', 'D'] },
    { stops: ['C', 'E'] },
    { stops: ['E', 'B'], ordered: true },
    { stops: ['D'], patience: 3 },
  ],
  shapePool: 'compact+awkward',
};
