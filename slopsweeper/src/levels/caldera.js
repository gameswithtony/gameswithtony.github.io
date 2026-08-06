// @ts-check
// A volcano cluster squatting in the middle of open water, with satellites fouling the northern
// and southern bypasses (PLAN §9). Volcano cells pull in two directions at once (SPEC §5): they
// stop blasts, so building against them contains the damage — and they delete legal placements,
// so building against them is exactly where a block will not fit.
//
// PROVENANCE, because only the silhouette is older than today:
//
//   · RESCALE 2026-08-04: 20×14 → 38×26, so the 12–26-cell blocks had somewhere to land.
//   · RETUNED 2026-08-04 when Analyze became one minesweeper click — looser schedule, lower
//     density, right across the corpus.
//   · REBUILT 2026-08-06 (owner decision). Two things forced it. The corpus notes had `caldera`
//     as the worst level in the game — "loses about eight of nine users to blasts", 0–1% served
//     for every AI policy in the sweep — and the standing rule now says every level carries
//     several destinations. So: a third endpoint, both pinches cut back to the three rows the
//     2026-08-04 note *claimed* they were, a cast, and a schedule found by measurement rather
//     than by feel. The board is the same 38×26 and `A` and `B` have not moved.
//
// THE GEOMETRY, and what each piece is for:
//
//   · **The caldera** is a solid octagon, rows 9–16, cols 8–29 — twenty-two wide in open water.
//     Nothing crosses it, so every route is a detour and the detour is the level.
//   · **Two bypasses, north and south**, three rows tall where a satellite squats on them and
//     five to nine rows tall either side. Of `compact+awkward` only `R12` fits a three-row
//     corridor (core/shapes.js, the three-row rule), so a pinch is either one exactly-placed
//     `R12` or four tiles laid by hand. **The pinches are four columns wide, not eight.** The
//     first draft of this rebuild made them eight and six, and the sim was unambiguous: at that
//     length the bots could not cross either bypass at all and every policy stayed at 0% served
//     with `gaveUp` climbing to 4.4. Four columns is one `R12`, or four turns of Place. That is
//     the pinch economy priced to be paid rather than priced to be admired.
//   · **`C` at (34, 25)**, the south-east corner, past the southern satellite. A→B is 46 either
//     way round; A→C is 47 by the south and 55 by the north, so `C` is the southern bypass's
//     destination without being walled off from the northern one. B→C is 15 down the open east
//     coast. So the two legs share a long trunk and then fork, and which bypass you open decides
//     which fork is cheap — the northern route hands you B and owes you eight tiles down the east
//     wall for C, the southern route hands you C and owes you the same eight going up.
//
// THE DIALS. Every number below was measured on 2026-08-06, 200 games a cell, seed 1, against
// the twenty-stencil shape table that landed the same day:
//
//   | policy            | served | win | gaveUp | killed | dets |
//   | ----------------- | ------ | --- | ------ | ------ | ---- |
//   | handOnly          |     0% |  0% |   16.0 |    0.0 | 0.00 |
//   | genRush           |    10% | 61% |    1.6 |   12.7 | 12.1 |
//   | balanced:0.4      |    17% | 73% |    3.3 |   10.0 | 10.2 |
//   | balanced-beta:0.4 |    17% | 68% |    2.9 |   10.3 |  9.8 |
//   | careful:0.4       |     0% |  5% |   13.9 |    2.0 |  6.4 |
//
//   · **`blastRadius: 0` is the whole retrofit, and it is the dial worth arguing about.** Hold
//     everything else at the numbers below and put the neighbours back on and the best policy
//     scores **2%** instead of 17%. That is not a tuning nudge, it is the difference between a
//     level and a slideshow, and it is the same 6× that `tutorial` measures. The mechanism is in
//     the corpus note: a five-tile crater in a 46-tile route is a rebuild, the rebuild is fresh
//     unread slop, and the next walker dies on that instead. Long routes compound craters.
//     The honest cost is that half of SPEC §5's volcano story — *building against a volcano
//     contains the blast* — has nothing to contain on this level any more. The other half, that
//     a volcano deletes the placement you wanted, is doing more work than ever: see the pinches.
//   · **`mineDensity: 0.1`**, the floor of the validator's tuned band. On 12–20-cell blocks the
//     two-defect floor (RULES.MIN_BLOCK_DEFECTS) already sets the real number, so this buys
//     about three points over 0.11 and has nowhere left to go. It is not a dial here; it is
//     bottomed out, and that is worth writing down so nobody tries it again.
//   · **`arrivals: 16 / 22 / 1` with `patience: 7`** — sixteen users, first on turn 22, one a
//     turn after that. Both halves are set against measured route-open ticks (40 games, seed
//     1000+, with the schedule taken out of the way so the game cannot end first):
//
//       | policy       | B opens | C opens |
//       | ------------ | ------- | ------- |
//       | genRush      |      15 |      17 |
//       | balanced:0.4 |      25 |      30 |
//       | careful:0.4  |      42 |      53 |
//       | handOnly     |      45 |      59 |
//
//     Read the two ends. **The floor is arithmetic, not luck**: the last user spawns on 37 and
//     is gone by 44, and a hand build cannot open B before 45. `handOnly` therefore delivers
//     nobody — 500 games on seed 1 and 500 on seed 7, zero served and zero *wins*, `win` being
//     the column that reads high everywhere else by design. **And the crush lands
//     inside the danger window on purpose**: turns 22–37 straddle `balanced`'s 25 and 30, so the
//     walkers arrive while the route is *being finished and has not been read* — which is the
//     only interesting place to put them. Start them earlier and they bleed out before any route
//     could exist — and the patience has to rise to keep the floor, which hands the level back
//     to the clock: `firstTick: 10, patience: 19` measures **1%**. Start them later and there is
//     no window left in front of the floor at all. Sixteen rather than twelve because served is
//     a fraction and the walkers behind the first mine cross ground the first mine has already
//     cleared: the identical recipe at twelve users scores 12%, at ten users 10%.
//   · **`shapePool: 'compact+awkward'`**, never `compact` alone, and never with `heavy`: the
//     pinches are the level and `heavy`'s smallest box is 5×5. Refunds measure **0.00–0.03 per
//     game**, so the pool fits the geometry at some rotation everywhere it matters.
//   · **`betaSupply: 3`.** A 46-tile trunk with a fork at the far end is exactly the shape the
//     verb was written for. It is worth about a point — `balanced-beta:0.4` reads 17% against
//     `balanced:0.4`'s 17% here and 18% against 17% on seed 7 — which is real but small, and
//     honest to state as small.
//
// THE CAST is seven roles against sixteen arrivals, so the deal is 3/3/2/2/2/2/2 (casting.js
// §3b): six walkers want B alone, four want C alone, four want both, and two are on a four-tick
// clock. Two single-stop roles at each end is deliberate — closing *either* bypass pays
// immediately, which is what makes the choice a choice rather than a checklist. The ordered role
// is `{ C, B }`: south first, then north-east, enforced, so that walker stands at the origin
// while a finished B route sits there unusable. The impatient role is `{ C }` on 4 against the
// level's 7, set against the geometry the way `delta`'s is — four ticks cannot survive the wait
// for a hand-built anything, so the only thing that saves them is generated ground on the C leg,
// early.
//
// WHAT IS STILL WRONG, stated rather than hidden. `perfect` is **0 in 400 games** and there is no
// version of this board where a bot gets sixteen of sixteen home; the mean is 2.7. A flagging
// human is a different proposition — every AI row here is a floor, because the sim bots never
// flag (src/sim/policies.js) and walk their users over slop they could have deduced — but the
// claim is untested. `careful:0.4` at 0% is also unlovely: on a route this long, reading
// everything means opening B on turn 42 and C on turn 53, thirty turns after the queue is dead.
// The level says "read *some* of it" and it says so very sharply.

/** @type {import('./index.js').LevelDef} */
export const caldera = {
  id: 'caldera',
  name: 'The Caldera',
  map: `
##########^^^^^^^^^^##################
#########^^^^^^^^^^^^#################
########^^^^^^^^^^^^^^################
#########^^^^^^^^^^^^#################
###########^^^^^^^^###################
#############^^^^#####################
######################################
######################################
######################################
############^^^^^^^^^^^^^^############
#########^^^^^^^^^^^^^^^^^^^^#########
########^^^^^^^^^^^^^^^^^^^^^^########
A#######^^^^^^^^^^^^^^^^^^^^^^########
########^^^^^^^^^^^^^^^^^^^^^^#######B
########^^^^^^^^^^^^^^^^^^^^^^########
#########^^^^^^^^^^^^^^^^^^^^#########
############^^^^^^^^^^^^^^############
######################################
######################################
######################################
#####################^^^^#############
###################^^^^^^^^###########
##################^^^^^^^^^^##########
#################^^^^^^^^^^^^#########
##################^^^^^^^^^^##########
###################^^^^^^^^#######C###
`,
  arrivals: { count: 16, firstTick: 22, every: 1 },
  patience: 7,
  mineDensity: 0.1,
  blastRadius: 0,
  betaSupply: 3,
  shapePool: 'compact+awkward',
  walkers: [
    { stops: ['B'] },
    { stops: ['B'] },
    { stops: ['C'] },
    { stops: ['C'] },
    { stops: ['B', 'C'] },
    { stops: ['C', 'B'], ordered: true },
    { stops: ['C'], patience: 4 },
  ],
};
