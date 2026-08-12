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

It is also, at 6×3, very nearly a hand-only level. Of the six `compact` stencils only `R12`
fits at all, in exactly one position — so every Generate here hands you R12 (since
2026-08-12 an unplaceable draw is redrawn invisibly; a Generate only cancels when *nothing*
in the pool fits, see §4). Blocks are 12–26 cells now and they need room: the shipped
corpus runs 32×20 to 50×30.

---

## 2. The charmap

| char | terrain | means |
| --- | --- | --- |
| `#` | `OCEAN` | open water: buildable by hand, generatable by AI, impassable until built |
| `.` | `VOID` | outside the level; defines the silhouette, drawn as coastline not as board |
| ` ` (space) | `VOID` | exactly the same as `.` |
| `^` | `VOLCANO` | an obstacle *inside* the play space: unbuildable, and it **stops blasts** |
| `A` | `OCEAN` | the origin endpoint (exactly one) |
| `B` … `H` | `OCEAN` | the destinations, at least one, **contiguous from `B`** and at most seven |

**Destinations** (2026-08-05). `B` alone is the classic level. Add `C` and you have a second
place users go; the letters must run `B`, `C`, `D`… with no gaps, each appearing at most once,
and `I` onward is an unknown character rather than an eighth destination. Which users go where
is `itineraries`, in §3 — by default, everyone goes everywhere.

Everything true of `B` is true of every destination: always passable, never buildable by hand
or by AI, indestructible in a blast, no clue displayed, invisible to the solver. And only
reaching the **last** one on a user's list is an arrival — see §3.

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
| `arrivals` | `{ count: 10, firstTick: 6, every: 4 }` | how many users, when the first one shows up, and the gap between them — **or** `{ at: [2, 5, 9] }`, the turns spelled out (§3a) |
| `mineDensity` | `0.16` | per-cell probability inside a generated block; the total is `Binomial(size, p)` **topped up to a minimum of 2** — see §4 |
| `shapePool` | `'compact'` | which blocks Generate draws from — see §4 |
| `userMoveEvery` | `1` | users step every N ticks |
| `blastRadius` | `1` | flood-fill steps from a detonation; 1 = the tile plus its four orthogonals |
| `patience` | `20` (`RULES.USER_PATIENCE`) | cumulative ticks a user will spend unable to move before it gives up and leaves for good |
| `betaSupply` | `3` (`RULES.BETA_SUPPLY`) | beta milestones the player may ship (SPEC §4.7); `0` switches the verb off for this level |
| `walkers` | `[]` | **the cast** — the roles this level is written for, dealt against `arrivals` by seed (§3b). An entry is `{ stops: ['B','D'], ordered?, patience? }`. Mutually exclusive with `itineraries` |
| `itineraries` | `[]` | the same thing without a per-walker `patience`: which destinations each user must visit, as letters, dealt by seed; `[]` means **every user visits every destination**. An entry is `['B','D']` (any order) or `{ stops: ['B','D'], ordered: true }` (that order, enforced) |
| `destRefill` | `0.5` (`RULES.DEST_REFILL`) | fraction of `patience` handed back when a user reaches a stop that is not its last |

`arrivals` is the difficulty dial. Everything else is texture.

---

## 3a. Two ways to write a schedule

```js
arrivals: { count: 9, firstTick: 2, every: 4 }   // a cadence: nine users, turns 2, 6, 10, …
arrivals: { at: [0, 1, 2, 3, 18, 19, 20] }       // a burst, a lull, and another burst
```

The list's **length is the user count**, the turns must be **strictly increasing**, and a
definition carrying fields from both shapes is a hard error rather than a guess. Reach for `at`
when the pressure you want is *shaped* — a rush while the board is empty, a gap that tempts you
into generating, a second rush that arrives while you are still reading the block. A cadence
cannot say that, and faking it with a tight `every` changes the whole level instead of one
stretch of it.

The HUD is unchanged either way: `NEXT IN` counts down to the next listed turn exactly as it
counts down a cadence.

---

## 3b. The cast

**A level authors a cast, and every run deals it** (added 2026-08-05). This is the field to
reach for when you want the level to ask a *person*-shaped question rather than a route-shaped
one:

```js
walkers: [
  { stops: ['C'] },                                 // the trunk, and nothing else
  { stops: ['B', 'D'] },                            // both branches, nearest first
  { stops: ['B', 'C', 'D'], ordered: true },        // the full tour, in that sequence
  { stops: ['C'], patience: 12 },                   // same errand, half the goodwill
],
```

- **`stops`** is an itinerary's, with the identical rules: letters the map carries, at least one,
  no repeats. **`ordered`** is §3's opt-in sequence. **`patience`** is the new one: this walker's
  own bar, replacing the level's for them alone.
- **`walkers` and `itineraries` are mutually exclusive.** The validator refuses a level carrying
  both rather than picking one — they say the same kind of thing, so a level with both is an
  author who changed their mind halfway. An `itineraries` level is read as a cast with no
  patience overrides, so nothing about the older field stopped working.

**How the deal works, and how to author against it:**

- **Fewer roles than arrivals — the mix is exact, the order is not.** Three roles over nine
  arrivals is 3/3/3 on every seed; four is 3/2/2/2, the first role taking the extra. Only the
  running order is rolled. So **write the ratio you want as the pool** — repeat a role to weight
  it, because the level owns the ratio and the seed owns nothing but the sequence.
- **More roles than arrivals — a subset, and some roles do not appear.** Six roles over three
  arrivals casts three of the six, differently on different seeds. That is the strongest version
  of "replaying this level is a fresh read": the player cannot learn the demand by heart, only
  the possibilities. Use it when you want a level with a *repertoire*. Opting out is free — write
  exactly as many roles as arrivals and every one is cast, in a shuffled order.
- **The same seed always deals the same hand**, so `?seed=` reproduces a game exactly and a
  refresh mid-play resumes the identical one. Nothing about a walker is saved; it is re-derived.
- **The demand is still knowable in advance.** The whole cast is resolved before the first turn,
  which is what keeps the forecast (§6) honest.

**Per-walker `patience` prices a route in people rather than in turns.** An impatient walker is
a deadline attached to one leg: if the route they owe cannot be finished inside their bar, they
were never going to be delivered, and the player can read that off the roster from the turn they
spawn. Two things to hold in mind:

- **Set it against the geometry, not against the level's number.** `delta`'s impatient walker is
  on 12 with a 26-tile trunk, so hand-building alone cannot save them — only generated ground on
  the right leg, early. That is the trade the whole level is about, made personal.
- **The refill scales with the walker.** An intermediate stop hands back
  `round(ownPatience × destRefill)`, so half a bar is half of *their* bar. A short-bar walker on
  a multi-stop itinerary is punishing on purpose.
- **Everything on screen already knows.** The board's impatience shading, the roster's `LEAVES IN`
  countdown, its `GAVE UP` versus `KILLED` wording and the HUD's worst-case chip all read the
  walker's own bar, so a 12-tick walker can be the most urgent row on the panel while having
  waited the least.

**Re-sim after changing a cast.** It moves the demand, not just the flavour: replacing one of
`delta`'s three itineraries with a four-role cast shifted the mix toward the trunk and took the
AI policies from 7% to 13% served without a single number on the level changing.

---

## 3c. The whole dashboard — every override at once

Everything above in one definition, for reference rather than for taste. This is not a level
anybody tuned; it is the template to copy when you want the full set of dials in front of you,
and every line of it passes the validator as written:

```js
// @ts-check

/** @type {import('./index.js').LevelDef} */
export const everything = {
  id: 'everything',
  name: 'Kitchen Sink',                        // display name; defaults to the id
  map: `
############
A##########B
############
######^#####
############
###########C
############
`,
  arrivals: { at: [1, 3, 5, 6, 14, 22] },      // six users, turns spelled out (§3a): a rush,
                                               // a lull, two stragglers
  walkers: [                                   // the cast (§3b), dealt against those six
    { stops: ['B'] },                          //   slots by seed. SEVEN roles for SIX slots:
    { stops: ['C'] },                          //   someone different sits out every run.
    { stops: ['B', 'C'] },                     //   both stops, any order
    { stops: ['C', 'B'], ordered: true },      //   C first, then B — enforced
    { stops: ['B'], patience: 10 },            //   the impatient one, own bar of 10
    { stops: ['B', 'C'], ordered: true, patience: 30 },   // patient inspector, every field
    { stops: ['C'] },
  ],
  patience: 22,                                // the bar for everyone the cast does not override
  destRefill: 0.25,                            // a stop refunds a quarter-bar, not the default half
  betaSupply: 2,                               // two betas, not three
  mineDensity: 0.13,
  shapePool: ['R12', 'P14', 'T14'],            // explicit stencil ids; presets in §4
  userMoveEvery: 1,                            // users step every turn (the default, stated)
  blastRadius: 2,                              // craters two flood-fill steps, not one
};
```

Reading it back: `walkers` replaces `itineraries` (they are mutually exclusive), the `at`
schedule replaces the cadence trio (same rule), and the two per-walker `patience` values ride
*inside* the cast while the level-wide `22` covers everyone else. Delete any line and the
default from §3's table takes over — the shortest level in §1 and this one are the two ends of
the same dial panel.

**Itineraries** are the second half of multiple destinations (added 2026-08-05), and they are
where the axis gets interesting. Write them as arrays of letters:

```js
itineraries: [['C'], ['B', 'D'], ['B', 'C', 'D']]
```

- **Dealt by seed, and the mix is the level's** (revised 2026-08-05 — see §3b). Three lists over
  nine arrivals is 3/3/3 on every seed and always will be; *which* user gets which is the seed's
  business. The demand is therefore still knowable in advance — the whole hand is dealt before
  the first turn — but a replay is not the same run twice. This used to be a strict round-robin
  and is not any more.
- **Any order within a list, unless you say otherwise.** A user owing `B` and `D` goes to
  whichever is nearer and then to the other. If you want a forced sequence, say so — see
  **ordered itineraries** below.
- **Visited on contact.** A user routed to `C` that happens to cross `B` has been to `B`, and
  it comes off the list on the spot. A user stepping onto a destination that is **not** on its
  list does nothing at all — it is just a built cell it can walk on.
- **Only the last stop is an arrival**, and a user is worth exactly one point however many
  stops it made. Long itineraries buy the level texture, not score.
- **Each intermediate stop refunds `round(patience × destRefill)`** off that user's cumulative
  `waited`, floored at zero. At the default half bar, a three-stop user gets two half-refills
  on the way round, which is what makes a three-stop itinerary a trip rather than a slow way of
  losing somebody. `destRefill: 0` is a real setting — it says a stop buys only the walk, which
  is exactly what a **beta** buys, and it is the honest choice for a level where the
  destinations are meant to feel like milestones rather than like relief.

**Ordered itineraries** (added 2026-08-05) are the opt-in. An entry may be an object instead of
an array, and a level may mix the two freely:

```js
itineraries: [['C'], ['B', 'D'], { stops: ['B', 'C', 'D'], ordered: true }]
```

That is `delta`'s own list, and the third entry means **B, then C, then D — enforced**:

- **The user owes `stops[0]` and nothing else** until it has stood on it. It routes to that stop,
  gates on that stop, and camps or stalls against that stop. A later stop that is nearer, or open
  while the next one is shut, is not a place it is going: it **waits at the origin and burns
  patience** while a route it does not currently owe sits there finished. That is the cost, and
  it is the reason to reach for the feature at all.
- **Crossing a later stop does nothing.** It does not come off the list, there is no `visited`
  event, no patience refill, and the no-revisit trail is not reset. The user walks back for it
  when its turn comes. (Crossing a stop it never owed does nothing either — that rule is older.)
- **Everything else is identical.** Reaching `stops[0]` ticks it off, pays the refill if more
  remain, and is arrival when the list empties. One point per user, however far it walked.
- `{ stops: ['B','D'] }` with no `ordered` is just the loose form written the long way. Making a
  list into a sequence should cost you the word.

**Reach for it when the build order is the decision.** With `['B','C','D']` loose, closing any
one leg serves somebody, so the player can take the cheap wins in any sequence. Ordered, the
first leg gates the whole itinerary — a third of your schedule can be standing at the origin
because one neck is unbuilt. That makes a level meaningfully harder without touching a single
number, so re-sim after adding one; it is not decoration. On a one-destination level it does
nothing at all, in either direction.

Two authoring notes learned putting `delta` together:

- **Itineraries change what "connected" is worth.** With everyone visiting everywhere, a level
  is one connectivity problem and partial progress serves nobody. With a mixed list, closing
  the cheapest route already delivers a third of the users, so the player has a reason to
  finish one leg before starting the next. That is a genuinely different level from the same
  map with `itineraries` left out — try both before you decide which one you are shipping.
- **A single-stop itinerary is the level's tutorial.** Whichever destination it names becomes
  the trunk everything else branches off, because it is the one route that pays immediately.

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

Twenty hand-authored stencils, **12–26 cells**, chunky on purpose — long thin tendrils
destroy the deduction layer, so every limb of every stencil is at least two cells wide (a
standing test enforces it). Rotation is free and unlimited; there is no reflection — so a
sweep and its mirror image are two different blocks, and the table ships both.

**Eighteen of the twenty are in the three named pools. Two are explicit-only**: `N16` and
`M12` belong to no preset and appear only if a level names them in a `shapePool` array. They
are narrower than a pool member is allowed to be (see the box table below), which is the
whole reason they are kept out of the presets.

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
| `compact` | `R12 P14 O16 L16 W20 K19` | 12–20 | dense rectangles and near-rectangles, plus one lozenge; fits almost anywhere, easy to read |
| `awkward` | `T14 Y15 Z16 U18 C20 V16 S18 D20` | 14–20 | notches, clefts, sweeps and one enclosed hole; harder to place *and* harder to read |
| `heavy` | `H22 O25 J22 B26` | 22–26 | enormous throughput, enormous exposure; every one of them needs at least a clear 5×5 |
| *(no pool)* | `N16 M12` | 12–16 | **explicit-only.** Narrow blocks for corridor levels; a preset never draws them |

Three ways to say it, and the third is the only one that can reach an explicit-only stencil:

```js
shapePool: 'awkward'              // one preset
shapePool: 'compact+awkward'      // union of presets, joined with '+'
shapePool: ['R12', 'O25']         // explicit shape ids, any mix
shapePool: ['R12', 'N16']         // …including the two no preset carries
```

Empty segments in the `+` grammar are ignored, so `'compact+'` is exactly `compact`. (PLAN §9
writes `channel`'s pool that way; it resolves to `compact`.)

### The 2026-08-06 additions, and what each is for

Eight stencils joined the table in the variety pass. The brief was **moderate irregularity**:
a shape with enormous perimeter per cell is deduced off its coastline before you have spent a
turn on it, and a plain rectangle offers no coastline to bite on at all. What the new ones all
have is somewhere for a *hand tile* to sit — see §6, hand tiles are the free deduction anchor —
so building beside one reads more than a flat face would.

| id | pool | what it is | why an author would want it |
| --- | --- | --- | --- |
| `K19` | compact | a 5×5 lozenge, four fifths solid | the only outline that steps on all four sides; beds into a diagonal coast where every rectangle leaves a ragged gap, and still places like a compact |
| `V16` | awkward | a chevron with a two-wide cleft in its base | wants to be built *into*: a hand tile in the cleft sees four block cells where one against a flat face sees three. The most perimeter per cell in the table, deliberately at the ceiling |
| `S18` | awkward | `Z16`'s mirror family, with a solid overlap band | rotation can never reach it, so it is a genuinely new read; the band is where the two arms' clues talk to each other |
| `D20` | awkward | **the donut** — a ring with a one-cell hole | the strongest anchor there is: a hand tile built into the hole sees eight block cells at once. Nothing needs to be free under the hole, so it drops over volcano, void or ground you own |
| `J22` | heavy | a two-wide mast on a six-wide foot | reaches up a channel while the foot pays for the turn; needs an L-shaped hole, so a heavy Generate becomes a placement question |
| `B26` | heavy | a 6×5 slab with a 2×2 bite | the most ground one Generate can buy, and the first heavy block with a handle: a tile at the head of the bay sees five block cells |
| `N16` | *(none)* | a three-row runner with a bite | for corridor levels: pair it with `R12` when you want generation to do more than twelve cells down a neck |
| `M12` | *(none)* | a 6×2 plank | the only stencil that fits a two-row channel. Every cell is on the coast, so it is the easiest block in the table to deduce — that is the price of the width |

**Widening a pool changes the draw for every level that names it.** The sim figures quoted
elsewhere in this file predate this pass; re-run the corpus before quoting them again.

**Bounding boxes are the main thing to design against.** Every *pooled* stencil is at least
four rows tall in every rotation — `R12` excepted, and that exception is load-bearing:

| box needed | stencils |
| --- | --- |
| 6×2 | `M12` — explicit-only; the only block that fits a two-row channel |
| 4×3 | `R12` — the only **pooled** block that fits a three-row corridor |
| 6×3 | `N16` — explicit-only; the other three-row block |
| 4×4 | `P14`, `O16` |
| 5×4 (or 4×5) | `L16`, `W20`, `Y15`, `U18`, `T14` |
| 4×6 | `C20` |
| 6×4 | `Z16`, `V16`, `S18` |
| 5×5 | `H22`, `O25`, `K19`, `D20` |
| 6×5 | `J22`, `B26` |

So a three-row neck admits exactly one shape from `compact+awkward`, and a four-row lagoon
refuses all of `heavy`. Both are deliberate in the corpus (`strait`, `atoll`, and both of
`delta`'s necks), and both are held by a standing test — **any stencil added to `compact` or
`awkward` must need four rows in every rotation**, or several shipped levels quietly lose their
central decision. The two explicit-only stencils are the escape hatch: a level that wants
generation down a narrow neck names them and has opted in by name.

What you must not do by accident is make a level's *only* route narrower than the pool it draws
from — it silently becomes hand-only, and the arrival cadence will then kill it. The wider pools
make this easier to trip over: `awkward` now carries `D20` at a full 5×5 and `compact` carries
`K19` at the same, so a tight level draws a stencil it cannot place more often than it used to.
Check the `refund` column in the sim before shipping a narrow map.

---

## 5. Invariants the validator enforces

`node src/sim/validate.js [id]` — nonzero exit on any error. `init()` throws on the same
list, so a broken level cannot load, and a standing `node --test` case validates every
registered level.

**Errors** (the level refuses to load):

- an unknown map character
- not exactly one `A`; no `B`; a repeated destination letter; a gap in `B`, `C`, `D`…
- an endpoint with no buildable neighbour — nothing could ever connect to it
- no ocean connectivity from `A` to **any** destination, each named — unwinnable by construction
- an itinerary or a walker that is empty, names a letter the map does not carry, or visits one
  twice — in every shape, `['B','C']`, `{ stops: ['B','C'], ordered: true }` or
  `{ stops: ['B','C'], patience: 9 }`, since they are all checked by the same code
- an `ordered` that is not a boolean; a `patience` that is not a positive integer, or that is set
  on an `itineraries` entry, which has no such field
- **both `walkers` and `itineraries`**, which say the same kind of thing
- **both arrivals shapes at once** — `count`/`firstTick`/`every` beside `at` — or an `at` list
  that is empty, negative, fractional or not strictly increasing
- a board over 64×64 (a performance ceiling, not a target — the corpus runs 32×20 to 50×30)
- a nonsense schedule, density, pool, count, or `destRefill` outside [0, 1]

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

**Deaths, not delays, are what actually caps the corpus.** Measured across the corpus the
AI policies lose most of their users to *blasts* and only one or two to patience — the old
control level served the same 17% at every patience from 12 to 28, which is as clean a
demonstration as you could ask for that the schedule is not the binding constraint. If a
level scores badly, look at `killed` before you touch `arrivals`: the fix is less generated
ground on the route, or `blastRadius`, not a looser schedule. (The 2026-08-06 pass leaned on
`blastRadius: 0` hard for exactly this reason — the sim bots never flag, so radius 1 prices
their misreads at five tiles of route and the whole table converges on zero. Radius 0 keeps a
detonation lethal to whoever is standing on it while leaving the route repairable.)

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
being one. There is no hand-only-winnable level any more (owner rule, 2026-08-06: every level
must make generated ground necessary, the tutorial included) — the old 31-tile control was
retired with the rename to `tutorial`, and every level in the ten now measures 0% hand-only
served. The dial pairing that gets a shorter route there is the schedule: arrivals timed
inside the window where AI-built ground can exist but a hand build cannot — a long quiet
opening before the first walker is free build time and will lift `handOnly` off zero.

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
###################........##################C
###################........###################
… seven more rows like it …
A#############################################
##############################################
#############################################B
###################........###################
… nine more rows like it …
###################........###################
`,
  arrivals: { count: 12, firstTick: 20, every: 1 },
  patience: 14,
  mineDensity: 0.1,
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
```

(The real file spells every row out; `src/levels/strait.js` is the copy to read.)

Reading it back:

- **46×22**, two 19-wide basins, a neck three rows tall and eight long. `A` and `B` sit on the
  neck rows at opposite edges, so the shortest route is 47 tiles straight through it. **`C` is
  one character of map**, on the east wall's far north — every route still pays the neck once,
  then forks: A→B 47, A→C 54, and B→C eleven tiles straight up the east wall. The ordered
  `{C,B}` walker crosses B on its way north without ticking it off, then comes back down for it.
- **`arrivals: 12 / 20 / 1` with `patience: 14`** was found by sim against the measured window,
  not by feel. A hand build opens B on turn 46; the AI policies open it on 14–39. The floor is
  the invariant `firstTick + (count−1)·every + patience ≤ 45`: last spawn 31, gone by 45, one
  turn short of the hand build. The margin is razor-thin and measured — `every` 1 → 2 takes
  `handOnly` from 0% to **35% served**, `patience` 14 → 16 takes it to 8%. (The level shipped
  for months at `9 / 1 / 3`; the old header credited the floor to `every: 3`, but that cadence
  only worked because `firstTick: 1` bled the first third of the schedule out before any route
  could exist — the general form above is the real rule.)
- **`mineDensity: 0.10`**, the bottom of the tuned band. On a route this long every defect left
  standing on it is a walker, and the two-defect floor (§4) sets the real minimum whatever this
  dial says; all it controls is the tail above two.
- **`shapePool: 'compact+awkward'`** rather than plain `awkward`, because the neck is three
  cells tall and only `R12` fits a three-row corridor at all. Adding `compact` lets generation
  cross the neck at all — see the box table in §4. It crosses *rarely*, which is the point:
  the neck is where the level makes you build by hand. (`N16` would also fit and was
  deliberately refused — naming it in an explicit pool would delete the level's central
  decision.)
- **`blastRadius: 0`.** At radius 1 strait measures ≤1% served for every policy across twelve
  configurations — the only ground anybody can stand on *is* the route, forty-seven tiles of
  single file, so one blast kills the walkers packed behind the culprit and craters the road.
  See §6; nine of the ten levels landed here.

The loop that produced those numbers:

```
node src/sim/validate.js strait                      # structure
node src/sim/run.js --level strait --games 200       # winnable? by whom? how hard?
node --test                                          # nothing else broke
```

Targets to aim the second command at, in the points economy: **hand-only should deliver
nobody wherever you intended a floor** (it now reads as a clean 0% served, which is the
crispest that gate has ever been), and the best AI policy should clearly dominate the sweep.
Calibrate expectations to the bots, not to hope: they never flag (`src/sim/policies.js`), so
every served figure is a floor a flagging human beats — the 2026-08-06 corpus's best rows run
7–27% served, and `perfect` reads 0% almost everywhere at 200 games. **Ignore win %** — it only
asks whether one user got through, so it reads high everywhere by design. Anything at 0% served
across the *whole* policy sweep is a level nobody can play; anything near 100% is a level with
no decision in it. Read the spread between `genRush`, `balanced` and `careful`, and read
`gaveUp` against `killed` to see which pressure is actually biting.

---

## 8. Worked example — `delta`, with three destinations

The brief: *SPEC §9.2.2's trunk decision, made of geometry — one shared spine serving three
destinations is turn-efficient and one defect takes all three down, while an independent route
costs far more turns and fails on its own.* And then, on top of it, three different itineraries
asking three different questions of the same board.

```js
// @ts-check

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
```

Reading it back:

- **32×18.** A west basin with `A` on its edge, two three-row necks east into a north-south
  spine, and three lobes off that spine — `B` top, `C` straight ahead, `D` bottom — each sealed
  from its neighbours by a volcano bar running to the east wall.
- **`C` is the trunk**: a straight 30-tile shot along row 9. `B` and `D` are ten marginal tiles
  each off the spine that route already paid for — cheap, and sharing a single point of failure
  in the north neck. **The southern neck is the other answer**: the same 38 steps round the reef
  to reach `D` on its own, none of them shared, failing independently. That is the trunk
  decision, and the basin makes you commit to a direction before you know what generation will
  do to you.
- **Both necks are three rows tall and four columns long** — exactly `R12`'s footprint, so of
  `compact+awkward` exactly one stencil crosses a neck in one placement (§4) — the same trick
  `strait` plays, doubled and pulled apart. (The 2026-08-06 tuning pass found the six-column
  necks it shipped with were wider than R12, so the level's signature sentence was decoration —
  *nothing* could bridge a neck in one block. Four columns made it true.)
- **The four roles span the range deliberately**: a single stop, a two-stop that never touches
  the trunk's own destination, the full tour, and the same single stop on half the goodwill. Four
  roles over nine arrivals is 3/2/2/2, so five of the nine are served by the trunk alone, two
  need both branches, and two need everything and get half a bar of patience back twice on the
  way round. Closing the C route first therefore *delivers over half the level*, which is what
  makes the build order a decision rather than a checklist.
- **And the deal is the seed's** (2026-08-05, §3b): the mix above is fixed, the running order is
  not. Whether the impatient walker is the first person through the door or the seventh is worth
  a served user, and it is different every game — which is the difference between replaying
  `delta` and re-executing it.
- **And the full tour is `ordered`** (2026-08-05): `{ stops: ['B','C','D'], ordered: true }` is
  B, then C, then D, enforced. That walker owes B and only B until it has stood on it — so it
  waits at the origin for the north neck specifically, and when it finally walks it crosses C
  without ticking C off, because C is not its turn. It is deliberately the *longest* list that
  carries the feature, where the difference against the loose two-stop beside it is legible.
- **The fourth role is the impatient one**: `{ stops: ['C'], patience: 5 }` against the level's
  9, re-derived against the tuned geometry. These walkers spawn on turns 11–19 and are gone by
  16–24; a hand build opens C on turn 30 and can never save one, a generate-first opening lands
  C around turn 11 and saves them all. The level's whole argument in one roster row.
- **`betaSupply: 2`**, re-derived for the 9-tick bar: one staging post mid-trunk, one on the
  branch you commit to. (Four was written for the old 26-tick bar.)

**Tuned 2026-08-06** — it shipped as a showcase with hand-only at ~78% served, a control by
accident. The tuning pass took it to **0.00% hand-only over 1000 games, 0% win** — and the floor
is arithmetic, not luck: nine walkers on turns 11–19 with a 9-tick bar put the last deadline on
turn 28, and a hand build opens C on turn 30, every seed, no exceptions. Two findings from that
pass are worth carrying to any level with a chokepoint: **lengthening the trunk is a trap**
(route length costs the AI's score before it costs the hand build's — what widens the window is
*obstruction* beside the route, which slows generation and never slows a hand build), and
**`blastRadius: 0` is what makes a chokepoint level playable** (single-file walkers mean a
radius-1 blast kills the queue and severs the neck; radius 0 moves hand-only by exactly zero
while taking the best AI policies from 1% to 8%). `genRush` outscores `balanced` here — delta is
the level that says *commit to generated ground and route around what kills you*, where
`tutorial` says *read what you generate*. Full measurements live in the level's own header.
Read §6 — deaths, not delays — before reaching for `arrivals`.

The loop is the same one:

```
node src/sim/validate.js delta                       # structure, itineraries included
node src/sim/run.js --level delta --games 200        # winnable? by whom? how hard?
node --test                                          # nothing else broke
```
