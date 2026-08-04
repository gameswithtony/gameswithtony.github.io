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
| `mineDensity` | `0.14` | per-cell probability inside a generated block; the block's total is `Binomial(size, p)` and **zero is possible** |
| `shapePool` | `'compact'` | which blocks Generate draws from — see §4 |
| `analyzeReveals` | `8` (`RULES.ANALYZE_REVEALS`) | tiles one Analyze turns over |
| `userMoveEvery` | `1` | users step every N ticks |
| `blastRadius` | `1` | flood-fill steps from a detonation; 1 = the tile plus its four orthogonals |

`arrivals` is the difficulty dial. Everything else is texture.

---

## 4. Shape pools

Twelve hand-authored stencils, **12–26 cells**, chunky on purpose — long thin tendrils
destroy the deduction layer, so every limb of every stencil is at least two cells wide (a
standing test enforces it). Rotation is free and unlimited; there is no reflection.

A block is meant to be a small minesweeper in its own right: at `mineDensity: 0.12` a 20-cell
block carries two or three defects, one Analyze turns over eight tiles, and reading the whole
thing costs two or three turns. That trade — fast ground now, comprehension debt later — is
the game. Pick densities that keep it a trade.

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

**Arrival cadence is the primary dial.** Tightening it raises the *floor* — the minimum AI
usage below which you lose now. The measured budget is `CONFIDENCE_START /
WAIT_DRAIN_PER_USER` ≈ **267 waiting-user-ticks** for a whole game. Sum the users piled up at
the origin over the ticks it takes to open a route and you have predicted the level.

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
  arrivals: { count: 10, firstTick: 1, every: 3 },
  mineDensity: 0.11,
  shapePool: 'compact+awkward',
};
```

(The real file spells every row out; `src/levels/strait.js` is the copy to read.)

Reading it back:

- **46×22**, two 19-wide basins, a neck three rows tall and eight long. `A` and `B` sit on the
  neck rows at opposite edges, so the shortest route is 47 tiles straight through it.
- **`arrivals: 10 / 1 / 3`** was found by sim, not by feel. Hand-only takes 46 turns to close
  that route; at this cadence roughly 275 waiting-user-ticks accumulate before it gets there,
  past the ~267 the meter can absorb. Hand-only therefore loses **0%**, and the level has a
  genuine floor. `count: 12, every: 2` was the first draft and killed every policy including
  `careful`; this is the loosest schedule that still keeps the floor.
- **`mineDensity: 0.11`.** Blocks here are 12–20 cells, so 0.11 still means one to two defects
  a block — and the neck concentrates them. At 0.14 the review-and-reroute tax on a 47-tile
  route cancelled the AI's throughput advantage and every policy converged near zero.
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

Targets to aim the second command at: hand-only should lose wherever you intended a floor,
`balanced:0.4` should land somewhere in 30–70%, median winning length should sit in 35–85
ticks, and winning games should finish on 10–40 confidence. Anything at 100% or 0% across the
*whole* policy sweep is a level with no decision in it — but note that `careful:0.4` wins
90–100% almost everywhere in the current corpus, because reviewing a block before walking
through it is simply the right play at these block sizes. Read the spread between
`genRush`, `balanced` and `careful`, not `careful` alone.
