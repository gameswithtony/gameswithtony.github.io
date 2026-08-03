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
| `mineDensity` | `0.25` | per-cell probability inside a generated block; the block's total is `Binomial(size, p)` and **zero is possible** |
| `shapePool` | `'compact'` | which blocks Generate draws from — see §4 |
| `analyzeReveals` | `5` (`RULES.ANALYZE_REVEALS`) | tiles one Analyze turns over |
| `userMoveEvery` | `1` | users step every N ticks |
| `blastRadius` | `1` | flood-fill steps from a detonation; 1 = the tile plus its four orthogonals |

`arrivals` is the difficulty dial. Everything else is texture.

---

## 4. Shape pools

Twelve hand-authored stencils, 4–8 cells, chunky on purpose — long thin tendrils destroy the
deduction layer. Rotation is free and unlimited; there is no reflection.

| pool | shapes | feel |
| --- | --- | --- |
| `compact` | `O4 L4 T4 P5 O6` | fits almost anywhere, easy to read |
| `awkward` | `S4 W5 U5 Z5 F5` | perimeter-heavy pentominoes; harder to place *and* harder to read |
| `heavy` | `L6 D8` | six and eight cells; enormous throughput, enormous exposure |

Two ways to say it:

```js
shapePool: 'awkward'              // one preset
shapePool: 'compact+awkward'      // union of presets, joined with '+'
shapePool: ['O4', 'D8']           // explicit shape ids, any mix
```

Empty segments in the `+` grammar are ignored, so `'compact+'` is exactly `compact`. (PLAN §9
writes `channel`'s pool that way; it resolves to `compact`.)

**Bounding boxes matter more than you expect.** Every pentomino except `S4` and `U5` needs a
3×3 box. A channel two cells wide will refuse most of `awkward` outright, and a level whose
only route is two cells wide becomes hand-only whether you meant it to or not. Check the
refund column in the sim before shipping a narrow map.

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
- a board over 40×40
- a nonsense schedule, density, pool, or count

**Warnings** (worth a look, not fatal):

- a degenerate path — `A` and `B` fewer than four steps apart
- landlocked ocean unreachable from either endpoint
- `mineDensity` outside the tuned 0.10–0.40 band

The validator is **structural only**, on purpose. Whether a level is *good* is the sim's job.
If this list ever grows an opinion about difficulty, it has turned into a designer.

---

## 6. Design axes, briefly

**Arrival cadence is the primary dial.** Tightening it raises the *floor* — the minimum AI
usage below which you lose now. The measured budget is `CONFIDENCE_START /
WAIT_DRAIN_PER_USER` ≈ 133 waiting-user-ticks for a whole game. Sum the users piled up at the
origin over the ticks it takes to open a route and you have predicted the level.

**Route length decides whether AI is worth it at all.** A generated block advances a route by
about three tiles per turn against hand placement's one, but every block also buys mines,
reviews and reroutes. On a fourteen-tile route that trade barely pays and hand-only is a real
strategy. Past twenty-five tiles it stops being one. If you want a level to *require* AI,
make the route long or the cadence brutal — preferably both.

**Coastline eases deduction; it does not harden the level.** Ocean, void and volcano all
count zero for clues, so an irregular coast is a free deduction anchor on every side. Inlets
and narrow bands make the minesweeper layer *easier* while making the routing layer tighter.
Treat coastline complexity as a difficulty-*reducing* axis and pay for it elsewhere.

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
#########......#########
#########......#########
#########......#########
#########......#########
#########......#########
A#######################
#######################B
#########......#########
#########......#########
#########......#########
#########......#########
#########......#########
`,
  arrivals: { count: 16, firstTick: 0, every: 2 },
  mineDensity: 0.18,
  shapePool: 'compact+awkward',
};
```

Reading it back:

- **24×12**, two 9-wide basins, a neck two rows tall and six long. `A` and `B` sit on the neck
  rows at opposite edges, so the shortest route is 24 tiles straight through it.
- **`arrivals: 16 / 0 / 2`** was found by sim, not by feel. Hand-only takes 23 turns to close
  that route; at this cadence roughly 134 waiting-user-ticks accumulate in those 23 turns,
  which is past the ~133 the meter can absorb. Hand-only therefore loses **0%**, and the
  level has a genuine floor. Loosen `every` to 3 and hand-only wins outright.
- **`mineDensity: 0.18`.** At 0.25 the review-and-reroute tax cancelled the AI's throughput
  advantage and every policy converged; 0.18 puts generation clearly on the profitable side
  without making defects rare.
- **`shapePool: 'compact+awkward'`** rather than plain `awkward`, because the neck is two
  cells tall and three of the five awkward pentominoes need three rows. Adding `compact` lets
  generation cross the neck at all — see the warning in §4.

The loop that produced those numbers:

```
node src/sim/validate.js strait                      # structure
node src/sim/run.js --level strait --games 200       # winnable? by whom? how hard?
node --test                                          # nothing else broke
```

Targets to aim the third command at: hand-only should lose wherever you intended a floor, the
best policy should land somewhere in 40–70%, median winning length should sit in 35–70 ticks,
and winning games should finish on 10–40 confidence. Anything at 100% or 0% across the board
is a level with no decision in it.
