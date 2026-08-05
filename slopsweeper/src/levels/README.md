# Authoring a Slop Sweeper level

Everything you need is in this file. Hand it to a person or to an assistant and say "make me
a level like `strait`, but meaner" — nothing else is required reading.

A level is **one file plus one line in `index.js`**. There is no build step, no registry
format, and no asset. If `node --test` is green and `node src/sim/validate.js` says `✓`, the
level loads.

---

## 1. The shortest possible level

```js
// src/levels/pond.js
// @ts-check

/** @type {import('./index.js').LevelDef} */
export const pond = {
  id: 'pond',
  map: `
######
A####B
######
`,
};
```

```js
// src/levels/index.js — add the import and one call
import { pond } from './pond.js';
register(pond);
```

That is a complete, playable, tuned-by-default level. Every other field is optional and
falls back to `core/rules.js`. State only what deviates.

It is also, at 6×3, very nearly a hand-only level. Of the five `compact` stencils only `R12`
fits at all, in exactly one position, so four Generates in five refund (§4). Blocks are
12–26 cells now and they need room: the shipped corpus runs 32×20 to 50×30.

---

## 2. The charmap

| char | terrain | means |
| --- | --- | --- |
| `#` | `OCEAN` | open water: buildable by hand, generatable by AI, impassable until built |
| `.` | `VOID` | outside the level; defines the silhouette, drawn as coastline not as board |
| ` ` (space) | `VOID` | exactly the same as `.` |
| `^` | `VOLCANO` | an obstacle *inside* the play space: unbuildable, and it **stops blasts** |
| `A` | `OCEAN` | the origin endpoint (exactly one) |
| `B` | `OCEAN` | the destination endpoint (exactly one) |

The parser is deliberately forgiving, because generated ASCII maps rot at the edges:

- Leading and trailing blank lines are dropped, so a template literal starting on its own
  line just works.
- Trailing whitespace on any row is stripped.
- Short rows are right-padded with `VOID`, so ragged maps are fine.
- **Any other character is a hard error** naming the 1-based row and column. Silence here
  would be worse than a crash.

`VOID` is not a wall you route around, it is a hole in the board. A `VOID` cell has no
neighbours at all, in either direction — so nothing is adjacent to it, nothing counts it for
clues, and no block can overlap it. `VOLCANO` is mechanically near-identical but lives
*inside* the water and reads as terrain.

---

## 3. Every field, with its default

| field | default | what it does |
| --- | --- | --- |
| `id` | *(required)* | unique key; `?level=<id>` loads it |
| `map` | *(required)* | the charmap above |
| `name` | `id` | display name |
| `arrivals` | `{ count: 10, firstTick: 6, every: 4 }` | how many users, when the first one shows up, and the gap between them |
| `mineDensity` | `0.16` | per-cell probability inside a generated block; the total is `Binomial(size, p)` **topped up to a minimum of 2** — see §4 |
| `shapePool` | `'compact'` | which blocks Generate draws from — see §4 |
| `userMoveEvery` | `1` | users step every N ticks |
| `blastRadius` | `1` | flood-fill steps from a detonation; 1 = the tile plus its four orthogonals |
| `patience` | `20` (`RULES.USER_PATIENCE`) | cumulative ticks a user will spend unable to move before it gives up and leaves for good |
| `betaSupply` | `3` (`RULES.BETA_SUPPLY`) | beta milestones the player may ship (SPEC §4.7); `0` switches the verb off for this level |

`arrivals` is the difficulty dial. Everything else is texture.

**Beta** is the third build verb (added 2026-08-05). It costs one turn and lands by exactly
Place's target rules, and what it buys is that users treat it as an intermediate destination:
they leave the origin for it as soon as it is reachable and closer to B, walk to it, and camp
there until B or a better beta opens up. **Camping drains patience like any other waiting**,
so a beta never buys time — it buys the walk, which is free, and a starting line further
along. Only B counts as an arrival. Two things to hold in mind when authoring:

- **A beta is only worth shipping where there is a long walk to be had.** On a level whose
  frontier advances one tile a turn, a camper's walk is a handful of ticks and the beta cost a
  whole turn. Levels with a partly built board, a long unbuilt gap behind the frontier, or a
  route that doubles back are where the verb has something to work with.
- **`betaSupply: 0` is a real setting**, and the honest one for a level you want read as pure
  build-and-route.

There is no `analyzeReveals` any more (removed 2026-08-04). **Analyze is one minesweeper
click**: it opens the tile you point at, and if that tile's clue is zero the classic cascade
runs — and **if you click a mine it goes off**, running the same detonation a user stepping
on it would. How much a review turns over is now a property of the board — of `mineDensity`,
mostly — not a number a level sets, and `blastRadius` now prices misclicks as well as
footsteps. **Flag** is the other new verb: free, no tick, a flagged tile is impassable to
users (so a flag wall can close your own route), and Analyze refuses a flagged target, which
is what stops a fat finger from cratering the tile you had worked out.

Two consequences for authoring, both learned the hard way in the 2026-08-04 tuning pass:

- **Reading a block costs three or four turns now, not one.** Budget for it. A level tuned
  against the old bulk reveal will be roughly ten turns too tight.
- **Probing is a gamble, not a read.** Since a clicked mine detonates, `mineDensity` prices
  *two* things at once: how hard the block is to deduce, and how expensive it is to get that
  deduction wrong. Raising it past ~0.15 punishes twice. The sim bots never flag, so every
  win rate they print is the floor — they take three or four self-inflicted detonations a
  game that a flagging player simply would not.
- **Loosening the schedule to pay for those turns pays for hand-building too.** On the long
  levels, going from `every: 3` to `every: 4` took `handOnly` from 0% to 100% — the one
  outcome SPEC §1 forbids. If your level has a floor, `every` is not the dial.
- **And since the two-defect floor (§4), density is barely a dial either on small blocks.**
  Between them, a level with a hand-only floor and a `compact` pool has very little slack.
- **Under the points economy the binding constraint moved again.** `caldera` and `strait`
  score worst in the corpus because their long routes cross the most generated ground, and
  generated ground now kills the people walking it — `caldera` loses about eight of nine users
  to blasts. That is a *route* problem, not a schedule or density problem, and `blastRadius`
  is the dial that speaks to it.

---

## 4. Shape pools

Twelve hand-authored stencils, **12–26 cells**, chunky on purpose — long thin tendrils
destroy the deduction layer, so every limb of every stencil is at least two cells wide (a
standing test enforces it). Rotation is free and unlimited; there is no reflection.

A block is meant to be a small minesweeper in its own right: at `mineDensity: 0.12` a 20-cell
block carries two or three defects, and reading it costs two or three turns. That trade —
fast ground now, comprehension debt later — is the game. Pick densities that keep it a trade.

### Every block carries at least two defects (2026-08-04)

The roll is `Binomial(size, mineDensity)` and is then **topped up to two** if it came in
under. Zero-defect generations are gone: they were the one turn on which Generate was free,
which is the opposite of what the game is about.

**This changes what `mineDensity` does, and it is the single most important thing to know
before tuning a level.** The floor binds from below, so the dial no longer controls whether a
block is dangerous — only the size of the tail above two. It binds hardest exactly where you
are least likely to notice: small blocks at low density. Expected defects per block:

| block size | p = 0.11 | p = 0.15 | p = 0.20 |
| --- | --- | --- | --- |
| 12 cells (`R12`) | 2.18 *(raw 1.32)* | 2.39 *(raw 1.80)* | 2.74 *(raw 2.40)* |
| 16 cells (`O16`) | 2.38 *(raw 1.76)* | 2.76 *(raw 2.40)* | 3.37 *(raw 3.20)* |
| 25 cells (`O25`) | 3.03 *(raw 2.75)* | 3.86 *(raw 3.75)* | 5.03 *(raw 5.00)* |

Read the twelve-cell row: nearly doubling the density moves the real answer by a quarter.
Below about 0.15 on `compact`-sized shapes the dial is close to inert, so **do not reach for
density to make a small-block level easier** — it has nowhere left to go. Reach for the
schedule, and if the schedule is pinned by a hand-only floor (§6), accept that the level is
as easy as it gets.

The floor is placement-time only. A blast may take a block below two, or to zero, and nothing
puts it back.

| pool | shapes | sizes | feel |
| --- | --- | --- | --- |
| `compact` | `R12 P14 O16 L16 W20` | 12–20 | dense rectangles and near-rectangles; fits almost anywhere, easy to read |
| `awkward` | `T14 Y15 Z16 U18 C20` | 14–20 | irregular blobs with notches and staircases; harder to place *and* harder to read |
| `heavy` | `H22 O25` | 22–25 | enormous throughput, enormous exposure; both need a clear 5×5 |

Two ways to say it:

```js
shapePool: 'awkward'              // one preset
shapePool: 'compact+awkward'      // union of presets, joined with '+'
shapePool: ['R12', 'O25']         // explicit shape ids, any mix
```

Empty segments in the `+` grammar are ignored, so `'compact+'` is exactly `compact`. (PLAN §9
writes `channel`'s pool that way; it resolves to `compact`.)

**Bounding boxes are now the main thing to design against.** Every stencil is at least three
rows tall in every rotation, and eight of the twelve need four:

| box needed | stencils |
| --- | --- |
| 4×3 | `R12` — the only block that fits a three-row corridor |
| 4×4 | `P14`, `O16` |
| 5×4 (or 4×5) | `L16`, `W20`, `Y15`, `U18`, `T14`, `C20` (4×6) |
| 6×4 | `Z16` |
| 5×5 | `H22`, `O25` |

So a three-row neck admits exactly one shape from `compact+awkward`, and a four-row lagoon
refuses all of `heavy`. Both are deliberate in the corpus (`strait`, `atoll`). What you must
not do by accident is make a level's *only* route narrower than the pool it draws from — it
silently becomes hand-only, and the arrival cadence will then kill it. Check the `refund`
column in the sim before shipping a narrow map.

---

## 5. Invariants the validator enforces

`node src/sim/validate.js [id]` — nonzero exit on any error. `init()` throws on the same
list, so a broken level cannot load, and a standing `node --test` case validates every
registered level.

**Errors** (the level refuses to load):

- an unknown map character
- not exactly one `A` and one `B`
- an endpoint with no buildable neighbour — nothing could ever connect to it
- no ocean connectivity from `A` to `B` — unwinnable by construction
- a board over 64×64 (a performance ceiling, not a target — the corpus runs 32×20 to 50×30)
- a nonsense schedule, density, pool, or count

**Warnings** (worth a look, not fatal):

- a degenerate path — `A` and `B` fewer than four steps apart
- landlocked ocean unreachable from either endpoint
- `mineDensity` outside the tuned 0.10–0.40 band

The validator is **structural only**, on purpose. Whether a level is *good* is the sim's job.
If this list ever grows an opinion about difficulty, it has turned into a designer.

---

## 6. Design axes, briefly

**The game is scored in points** (2026-08-04). There is no confidence meter. Each user has
`patience` cumulative ticks of being unable to move — queued at the origin, stalled, or
stranded, all the same — and then it leaves for good. A blast kills everyone standing in it.
The level ends when every scheduled user has arrived or gone: **one arrival is a win, all of
them is the goal, none is a loss.** So `arrivals.count` is now the denominator of the score as
well as the difficulty dial, and the number to read in the sim is **served**, not win %.

**Arrival cadence is still the primary dial.** Tightening it raises the *floor* — the minimum
AI usage below which you deliver nobody. The budget is per-user now and easy to compute: a
user spawned at tick `t` is gone by tick `t + patience` unless a route opens. Take the turn a
competent build opens the route, subtract each user's spawn tick, and any user whose gap
exceeds `patience` is one you were never going to deliver.

**Deaths, not delays, are what actually caps the corpus.** Measured across all six levels the
AI policies lose five to nine of their nine-to-twelve users to *blasts* and one or two to
patience — and `plain` serves the same 17% at every patience from 12 to 28, which is as clean
a demonstration as you could ask for that the schedule is not the binding constraint. If a
level scores badly, look at `killed` before you touch `arrivals`: the fix is less generated
ground on the route, or `blastRadius`, not a looser schedule.

**And mind the ceiling on patience.** It is not a free dial: raise it far enough and hand-only
starts delivering on levels that are supposed to have a floor. On `sprawl`, patience 24 takes
hand-only from 0% to 11% served. Whatever you set, re-check the `handOnly` row.

**Session length has a hard floor you cannot tune away:** `firstTick + (count−1)×every` plus
the A→B route, because the last user cannot start walking before it spawns and the level is
not won until it arrives. On a 50-wide board that floor is already ~70 ticks. If a level runs
long, shorten the *schedule* before you touch anything else — and remember every detonation
sends users back to the origin to walk the whole route again, which is why detonation-heavy
levels overshoot by twenty or thirty ticks.

**Route length decides whether AI is worth it at all.** A generated block advances a route by
four or five tiles per turn against hand placement's one, but every block also buys mines,
reviews and reroutes — reading a 20-cell block costs two or three Analyzes. On a fifteen-tile
route that trade barely pays and hand-only is a real strategy. Past thirty tiles it stops
being one: `plain` (31 tiles) is still hand-only-winnable and is the control for exactly that
reason, while `channel`, `caldera`, `strait` and `sprawl` (47–52) all measure 0% hand-only.
If you want a level to *require* AI, make the route long or the cadence brutal — preferably
both.

**Coastline eases deduction; it does not harden the level.** Ocean, void and volcano all
count zero for clues, so an irregular coast is a free deduction anchor on every side. Inlets
and narrow bands make the minesweeper layer *easier* while making the routing layer tighter.
Treat coastline complexity as a difficulty-*reducing* axis and pay for it elsewhere.

**Hand tiles are the other deduction anchor** (added 2026-08-04). A hand tile displays the
count of defects around it, so building alongside a generated block reads its edge for free
— safely, one turn at a time, with no risk of the crater a bad Analyze makes. That gives
Place a second job besides throughput, and it means a level with room to build *beside* the
route is easier to read than one where every tile you can afford is on it. Narrow channels
and necks deny that room, which is a real part of why they are hard.

**And hand placement now branches from anything**, unreviewed slop included (2026-08-04,
overriding SPEC §4.1). The two changes compound: you can hook a reading tile **directly onto
the block you are reading**, instead of having to own a clean tile next to it first. Slop no
longer walls a frontier off either, so a level can never trap the player into generating —
which means the pressure that makes AI worth using has to come from the schedule, not from
the placement rules. Two consequences when you are authoring:

- **A wide level is now easier than it was**, because open water beside the route is free
  reconnaissance. If you want a level read blind, deny the shoulder room rather than the
  legality.
- **Nothing stops a player hand-building along their own slop and walking users into it.**
  That path is legal, cheap in turns and occasionally fatal — which is the intended trade,
  and it is why `mineDensity` is doing more work than it looks like it is.

**Volcanoes pull in two directions at once.** They stop blasts, so building slop against one
contains the damage it might do — and they delete legal placements, so that is exactly where
a block will not fit. A cluster in open water is the cheapest way to make placement a real
decision.

**Chokepoints concentrate risk.** One neck shared by every route means one mine takes the
level down, which makes deliberate detonation ("let a user walk into it and rebuild") a live
tactic rather than a bug.

---

## 7. Worked example — `strait`

The brief: *two basins joined by a narrow neck; every route shares the neck, so the trunk
decision arrives early.*

```js
// @ts-check

/** @type {import('./index.js').LevelDef} */
export const strait = {
  id: 'strait',
  name: 'The Strait',
  map: `
###################........###################
… nine more rows like it …
###################........###################
A#############################################
##############################################
#############################################B
###################........###################
… nine more rows like it …
###################........###################
`,
  arrivals: { count: 9, firstTick: 1, every: 3 },
  mineDensity: 0.11,
  shapePool: 'compact+awkward',
};
```

(The real file spells every row out; `src/levels/strait.js` is the copy to read.)

Reading it back:

- **46×22**, two 19-wide basins, a neck three rows tall and eight long. `A` and `B` sit on the
  neck rows at opposite edges, so the shortest route is 47 tiles straight through it.
- **`arrivals: 9 / 1 / 3`** was found by sim, not by feel. Hand-only takes 46 turns to close
  that route; at this cadence roughly 297 waiting-user-ticks accumulate before it gets there,
  past the ~267 the meter can absorb. Hand-only therefore loses **0%**, and the level has a
  genuine floor. Loosen `every` to 4 and hand-only wins outright at 100% — that one step is
  the whole margin, which is why the floor levels all sit at `every: 3`.
- **`mineDensity: 0.11`.** Blocks here are 12–20 cells, so 0.11 still means one to two defects
  a block — and the neck concentrates them. At 0.14 the review-and-reroute tax on a 47-tile
  route cancelled the AI's throughput advantage and every policy converged near zero. Since
  the schedule cannot loosen without handing the level to `handOnly` (above), density is the
  only dial left on a level with a floor.
- **`shapePool: 'compact+awkward'`** rather than plain `awkward`, because the neck is three
  cells tall and only `R12` fits a three-row corridor at all. Adding `compact` lets generation
  cross the neck at all — see the box table in §4. It crosses *rarely*, which is the point:
  the neck is where the level makes you build by hand.

The loop that produced those numbers:

```
node src/sim/validate.js strait                      # structure
node src/sim/run.js --level strait --games 200       # winnable? by whom? how hard?
node --test                                          # nothing else broke
```

Targets to aim the second command at, in the points economy: **hand-only should deliver
nobody wherever you intended a floor** (it now reads as a clean 0% served, which is the
crispest that gate has ever been), the best AI policy should land somewhere in 30-60% served,
and `perfect` should be rare but not zero. **Ignore win %** - it only asks whether one user
got through, so it reads high everywhere by design. Anything at 0% served across the *whole*
policy sweep is a level nobody can play; anything near 100% is a level with no decision in it.
Read the spread between `genRush`, `balanced` and `careful`, and read `gaveUp` against
`killed` to see which pressure is actually biting.
