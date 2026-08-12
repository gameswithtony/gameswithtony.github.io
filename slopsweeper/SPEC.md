# Slop Sweeper

A turn-based puzzle game about building software under deadline with AI assistance.

**Status:** design spec, pre-prototype. Sections marked OPEN are unresolved. Sections marked DECIDED are settled and should not be re-litigated or tuned away.

**Revision (2026-08-03, owner decision):** the implementation stack in §10.1 changed from Vite + TypeScript to plain JavaScript ES modules with **no build step** — the `slop-sweeper/` folder deploys as-is, like every other app in this repository. §10.1 and §10.2 carry the matching notes. Tooling only; no other DECIDED content changed. See `PLAN.md` §1.2 for how each property the original stack protected is preserved.

---

## 1. Design intent

Read this section before implementing anything. Several rules below look like they could be simplified or balanced away. They cannot. They are the game.

The player is a developer shipping software to users under stakeholder pressure. Using AI is mandatory. The question the game asks is never *whether* to use AI, it is *how much, where, and at what cost to your own capacity to evaluate what you shipped*.

The central mechanic is a resource that:

1. buys throughput,
2. generates uncertainty, and
3. degrades the player's ability to resolve that uncertainty.

Point 3 is the novel part. Most "AI in a game" mechanics are a flat speed/risk tradeoff. Here the risk compounds against the player's capacity to manage it.

**The thesis compressed into one interaction:** when the player is handed a block to place (§4.2), coverage-optimal placement and *legible* placement are usually different placements. A block placed against the ocean edge or against known tiles is far more solvable than one dropped into open water. The greedy play covers ground. The wise play often places worse in order to stay readable. That single choice is the whole argument.

Note also what this implies: placing blocks well is a real skill, and it is **not** the same skill as the skill meter tracks. A player can be excellent at placement and still go blind. That is deliberate.

**Satirical mapping** (implementer does not need to surface any of this in UI text):

| Mechanic | Referent |
| --- | --- |
| Path from A to B | User needs, met or unmet |
| Hand-placed tile | Code you wrote and understand |
| AI block | Generated code, shipped unreviewed |
| Block shape you didn't choose | Output you didn't specify and can't refuse |
| Mine | Latent defect |
| Clue numbers | Code comprehension |
| Skill meter | Ability to read and reason about a codebase |
| Analysis turn | Review |
| Flag | Guardrail / feature flag / known-issue workaround |
| Waiting users | Unmet demand |
| Stakeholder confidence | Political capital |

**Do not** add a path to victory through AI abstinence. **Do not** display the break-even ratio (§8.4). **Do not** make the clue system produce wrong information (§7.2). **Do not** let the player preview or decline an incoming block (§4.2).

---

## 2. Board and entities

### 2.1 Two layers per cell — DECIDED

Every cell has **two independent layers**. Do not collapse them into one enum.

**Layer 1 — terrain.** Fixed at level load, never mutated by play. This is the level's authored geometry.

**Layer 2 — construction state.** What the player has built there, if anything.

Terrain features are defined by a **capability table**, not by hardcoded per-feature logic. Adding a feature should mean adding a row, never editing a switch statement:

| Feature | Buildable by hand | Generatable (AI) | Passable | Counts as known-empty | Rendered as |
| --- | --- | --- | --- | --- | --- |
| `OCEAN` | yes | yes | no (until built) | yes | open water |
| `VOID` | no | no | no | yes | not drawn; coastline stroke at boundary |
| `VOLCANO` | no | no | no | yes | terrain feature inside the play space |

`VOID` and `VOLCANO` are mechanically near-identical, and that is fine. They differ in **authorial meaning and rendering**: `VOID` is outside the level and defines its silhouette; `VOLCANO` is an obstacle *inside* the play space, surrounded by ocean, that the player must build around. Keeping them distinct also leaves room for features that diverge mechanically later.

### 2.2 Construction states

- `OCEAN` — nothing built. Buildable per terrain capability.
- `HAND` — player-placed. Always safe. Always buildable-from.
- `AI_HIDDEN` — AI-generated, unrevealed. Passable. Not buildable-from. May contain a mine.
- `AI_REVEALED` — AI tile whose clue is visible. Passable, safe, buildable-from. *(Revised 2026-08-04: no longer the only state that shows a clue — `HAND` does too, see §7.4. What is still unique to `AI_REVEALED` is that it was *turned over*: it used to be slop and is now known to be clean.)*
- `FLAGGED` — player-marked. Impassable to users. Not buildable-from. *(Revised 2026-08-04: represented as a `flagged` flag on `AI_HIDDEN` rather than as a separate state — see §4.5. The behaviour described here is unchanged; only the encoding is.)*
- `BETA` — a shipped beta milestone. Player-placed, always safe, always buildable-from, holds no defect: mechanically a `HAND` tile in every column of the capability table. *(Added 2026-08-05 by owner decision — see §4.7. It is a state of its own and not a flag on `HAND` because what makes it different is not a capability at all: it is a **waypoint**, somewhere users are willing to walk to and stop, which lives entirely in §6.2's routing. Keeping it in the union is also what makes "you cannot ship one on top of anything, another beta included" free — occupancy already says so.)*
- `MINE_CONFIRMED` — revealed to contain a mine. Impassable. *(Revised 2026-08-04: **no action produces this state any more** — analyzing a mine detonates it (§4.3), and a flag is what marks a suspected defect. The state, its clue arithmetic and its rendering are kept implemented and tested, per `PLAN.md` §2: a defuse verb — spend turns to turn a known defect into a permanent wall instead of a crater — is the obvious next move and would produce it on day one. §4.4's overwrite pricing below is written against that future.)*

### 2.3 Future features — NOT YET BUILT

The capability table exists so these are additive. Listed to validate the schema, not to be implemented now:

- **Legacy tile** — passable and buildable-from, but pre-existing at level start. Infrastructure you inherited.
- **Regulated zone** — hand-buildable but **not generatable**. AI blocks cannot overlap it. This is the strongest untapped feature in the design: it is auth, payments, compliance, the part of the codebase nobody vibe-codes. It forces hand-building exactly where the level most needs a path, which means it forces skill regeneration (§7.3) as a structural consequence of the map rather than as player virtue. Hold it for mid-campaign.
- **Erosion / eruption** — terrain that mutates on a schedule. Only worth it if the capability table stays honest.

### 2.4 Other entities

- **Endpoints** are fixed marked cells (rendered red). Baseline level: two endpoints, A (origin) and B (destination). Later levels: three or more, with required connections between specified pairs (see §9.2).
- **Users** are entities that spawn at an origin endpoint and travel to a destination endpoint.
- Users cannot enter unbuilt `OCEAN`. All adjacency for movement is orthogonal (4-way).

*(Revised 2026-08-05 by owner decision — **the "later levels" arrived.** A level marks **one origin, `A`, and one or more destinations, `B`, `C`, `D`… contiguous from B**. There is still exactly one spawn: users all come from A, and the variation is in where they are going, not where they are from.*

*What an endpoint **is** did not change, and the list is worth stating once because it was previously written out at nine separate call sites as "the origin or B": an endpoint is always passable, never buildable by hand or by generation, indestructible in a blast, displays no clue, and is invisible to the solver. Every destination has all five properties.*

*Users are unchanged in kind and gain one field: **an itinerary**, the set of destinations that user has to visit, in any order (§6). A level with one destination gives every user the one-element itinerary, which is the game as it was — and that is the mechanism, not a coincidence.)*

---

## 3. Turn structure

**DECIDED**

Fully turn-based. No wall clock. No real-time mode. The pressure comes from turn scarcity, not reflex.

One tick resolves as:

1. Player takes exactly one turn-consuming action (or passes).
2. Free actions may be taken before or after at no tick cost (§4.5).
3. All users on the board move one step (§6).
4. Traversal effects resolve (reveals, detonations).
5. New users spawn per the level's arrival schedule.
6. Meters update (§8).

**Rationale, do not override:** real-time play makes the game reward reflex over deduction, which inverts the thesis. The intended failure feeling is *"I could have solved this with more turns,"* not *"I clicked too slowly."*

**OPEN:** whether users move every tick or every N ticks. Default to every tick; expose as a per-level parameter.

---

## 4. Player actions

### 4.1 Place tile — 1 turn

Place one `HAND` tile on an ocean cell. Must be orthogonally adjacent to an endpoint, a `HAND` tile, or an `AI_REVEALED` tile.

**Cannot branch from an `AI_HIDDEN` tile.** You may build on ground you understand. Ground you generated and never reviewed is walkable but not buildable. This rule is load-bearing; see §9.3.

*(Revised 2026-08-04 by owner decision — **the branching restriction is removed.** A hand tile may be placed adjacent to **any** structure: endpoint, `HAND`, `AI_REVEALED`, `AI_HIDDEN` (flagged or not), `MINE_CONFIRMED`. Everything about the target cell is unchanged — ocean terrain, nothing built there, not an endpoint, orthogonally adjacent to the network.*

*The old rule was load-bearing when it was written, and what it was carrying is worth naming so it is clear the load did not vanish, it moved. It made unreviewed slop a **wall**: generate carelessly and the frontier locked, and only Analyze could unlock it. That taught AI dependency by absence — the action bar simply refused. Three later decisions took that job over and do it better, with risk instead of prohibition:*

*— **§4.3's analyze-detonation.** Clicking into slop can now crater it. Unreviewed ground is dangerous to touch, which is a stronger lesson than being unable to touch it.*
*— **§4.5's flags.** The player can mark ground they distrust and steer users off it, so "I do not understand this" has an expression that is not "I cannot build".*
*— **§7.4's hand clues.** A hand tile reads the defects beside it, so building along a block is how you learn what is in it. Forbidding exactly that placement was working against the newer mechanic.*

*What the player buys with the freedom is a legal path they may not survive: build along slop and users walk it, and §5 decides what happens next. That is the intended cost, and it is a decision rather than a refusal. §9.3's comprehension-debt argument is untouched — debt is now paid in detonations rather than in blocked placements.)*

Increases skill (§7.3).

### 4.2 Generate — 1 turn — DECIDED

The player invokes Generate and is **given a block**: a fixed multi-cell shape of `AI_HIDDEN` tiles. They then place it. Invocation and placement together are a **single action costing one turn**.

Hard rules:

- **No preview.** The block is revealed only on invocation. The player commits to generating before seeing what they get. There is no queue and no lookahead.
- **No decline and no reroll.** Once invoked, the block is placed. (Because nothing is revealed before committing, no anti-reroll rule is needed.)
- **Rotation is free** and unlimited before commit. Rotation is now most of the remaining decision space; charging for it would make players place badly to dodge the cost.
- **All-or-nothing placement.** Every cell of the block must land on ocean. No partial overhang, no clipping. Clipping would make the block's mine count ambiguous.
- The block must touch existing structure by the normal adjacency rule, and **may** branch from `AI_HIDDEN` tiles (unlike hand placement).
- **The block's total mine count is stated at placement time** ("this generation introduced 3 defects"). Required, not flavor. Without a per-block count, deduction on an irregular island is frequently unsolvable. The player is choosing where to put a known quantity of defects. *(Revised 2026-08-04 by owner decision: **that quantity is never below two.** The count is rolled Binomial(size, density) as before and then topped up — uniformly, from the same seeded stream — until it reaches two. A clean generation used to be possible and was a genuinely delightful moment; it was also the one turn on which Generate was strictly free, which is the exact opposite of what §1 says this game is about. Now the question a block asks is never "is this one dangerous", only "how, and where". The floor applies at placement only: §5's blast may take a block below two and nothing restores it. `PLAN.md` §3 ruling 6 carries the matching note.)*
- **If no legal placement exists anywhere, the turn is refunded and no block is given.** *(Revised 2026-08-12 by owner decision: this rule now applies to the **pool**, not to the individual draw. Placement cannot be declined, so a block, once shown, must be placeable — a drawn shape with no legal placement is therefore redrawn invisibly, uniformly over the placeable remainder of the pool, from the same seeded stream. The player never sees the failed roll, so no-preview and no-reroll above are undisturbed: nothing revealed was ever declined. Generate cancels — turn refunded, nothing shown, and the UI must say so — only when no shape in the level's pool fits anywhere at any rotation. Sim `refund` columns measured before this date count per-draw refusals and overstate what a player now sees.)*

**This last rule changed because of terrain.** It was originally written for a rare edge case on open ocean. With volcanoes and irregular coastlines, "this 6-cell block fits nowhere" becomes *common*, and burning a scarce turn on it would feel like a gotcha rather than a consequence. Two requirements follow:

1. Compute legal placements **before** committing the turn. Refund if the set is empty.
2. **Surface the legal placement set in the UI** when a block is drawn — highlight valid anchor positions, per rotation. On a cluttered map, hunting for a legal fit by trial and error is tedious, not interesting. The interesting decision is *which* legal placement, never *whether one exists*.

Note this cannot be abused: there is nothing to gain from deliberately boxing yourself in, since a refunded turn produces no block and no progress.

Shape source: a **curated table**, not procedural generation. Hand-authored shapes guarantee chunkiness (long thin tendrils destroy deduction) and give exact control over the difficulty curve. Later levels draw from pools with more awkward, more perimeter-heavy shapes, which are harder to place *and* harder to read.

Baseline shape sizes: 4–8 cells.

*(Revised 2026-08-04 by owner decision: **baseline shape sizes are 12–26 cells**, and the boards they land on grew ~2× linearly to match. At 4–8 cells a single Analyze cleared an entire block, so the loop this section describes — take the fast thing, then spend turns understanding it — collapsed into "take the fast thing". A block must be a small minesweeper in its own right for §4.3 and §7 to have anything to bite on. Nothing else in §4.2 changes: still curated, still chunky, still rotation-only, still refunded when nothing fits — and chunkiness is now a tested invariant, since a 20-cell shape has far more room to grow a tendril than a 5-cell one. The table and pools are in `PLAN.md` §10; the boards in §9.)*

Decreases skill (§7.3).

### 4.3 Analyze — 1 turn

Reveals clue numbers on some `AI_HIDDEN` tiles, converting them to `AI_REVEALED`.

- Quantity revealed per analysis: per-level parameter.
- **Precision of the revealed clues is governed by current skill** (§7.2).
- **OPEN:** does the player choose which tiles/region to analyze? Player-chosen is more interesting and more thematically accurate (you choose what to review). Recommend the player selects a target tile and analysis radiates from it.

*(Revised 2026-08-04 by owner decision. **Analyze is one minesweeper click.** It opens the single tile the player pointed at; if that tile's clue is exactly zero it cascades classically — every hidden 8-neighbour opens, recursing through further zeros — and the cascade is free because a zero clue cannot, by the definition of a clue, neighbour a mine. A mined target **detonates** — see the second note below. A flagged target is refused outright — unflag it first — and the cascade skips flagged tiles, both exactly as minesweeper behaves.*

*(Revised again 2026-08-04 by owner decision: **a mined target detonates.** Not confirmed — it goes off, running §5's standard detonation unchanged: blast radius by flood fill, destroyed construction reverts to ocean, other mines in the area go silently, users in the crater re-queue, confidence takes the hit. It is the identical code path a user stepping on the mine takes, so it emits the identical events and the renderer needed no change at all. The turn is still consumed and the review still counts in the stats — it happened, it just went badly — and there is no cascade.*

*`PLAN.md` §3 ruling 1 argued the opposite, and its reasoning is worth keeping because of **why** it stopped applying: it was written when Analyze swept a region, so the player had not chosen the mined tile and setting it off would have been a gotcha. One click at a time removes that premise. You point at the tile; that is the decision; this is minesweeper. The knock-on effects are that `MINE_CONFIRMED` (§2.2) is now produced by nothing, and that §4.5's refusal to analyze a flagged tile stops being a courtesy — it is the only thing between a misclick and a crater.)*

*"Quantity revealed per analysis: per-level parameter" is therefore **withdrawn**: the constant `ANALYZE_REVEALS` and the `analyzeReveals` level override are deleted, not defaulted. The reason is the whole point of the change: a bulk reveal did the deduction **for** the player, risk-free, so the minesweeper layer had no play in it. One click at a time is a decision — where do you probe, and is this tile the one that ends your turn. The cost is real and measured: reading a block costs several turns now instead of one, which is why the corpus was re-tuned (PLAN §9) and why `4.5 Flag` is no longer omitted from the prototype.)*

### 4.4 Overwrite — 1 or 2 turns

Replace an existing tile with a `HAND` tile.

- Overwriting an `AI_HIDDEN` tile: **1 turn**.
- Overwriting a `MINE_CONFIRMED` tile: **2 turns**. Fixing bad code costs more than writing new code. This makes "route around it" a live alternative to "fix it."

Counts as hand placement for skill purposes.

### 4.5 Flag — free, does not consume a tick

Toggle a tile to `FLAGGED`. Flagged tiles are impassable to users and unbuildable.

Free with no supply cap. It self-balances: flag your only route and users pile up and drain confidence. No arbitrary flag limit is needed.

**OPEN:** confirm free-and-uncapped survives playtest. If players spam-flag to stall, first try steepening the confidence drain rather than adding a cap.

*(Revised 2026-08-04 by owner decision: **Flag ships in the prototype**, reversing §11's omission table. With Analyze reduced to a single click (§4.3) the player needed a way to *act* on a deduction — without it, working out that a tile is a defect changed nothing you could do. It is implemented exactly as this section describes: a free toggle, no cap, self-balancing because a flag wall closes your own route and the pile-up drains you.*

*(Amended 2026-08-05 by owner decision, after a playtest in which the owner's own flag was the single cut vertex between his users and both remaining destinations and the board read as a pathfinding bug. **The mechanics are unchanged** — a flag is still impassable, still free, still uncapped, and still self-balancing exactly as described above. What changed is that the game now says so: the UI surfaces any flag whose removal, on its own, would let a currently-stuck user move again. "Stuck" is queued at the origin or stalled mid-route — the two states patience is draining in.*

*It is display only. Nothing in the tick pipeline reads it, no event carries it, and it is not saved: it is derived from the board every time it is asked, like a clue. And it is deliberately literal — a wall made of **two** flags in series names neither of them, because lifting either one alone frees nobody. The player is told what is individually decisive, never what a search thinks they ought to do.)*

*One representation change: `FLAGGED` is **not** a construction state of its own (§2.2). A flag is an annotation on an `AI_HIDDEN` tile — `{ k: 'aiHidden', mine, block, flagged }` — because it has to remember the mine and the block underneath, and because a flagged tile must keep counting for clues exactly as it did unflagged: flagging is a claim, not knowledge, and the board never confirms your guess by moving a number. The flag masks exactly one capability, `passable`. Everything else — clue arithmetic, generate-adjacency, destruction by blast — is unchanged, and a blast takes the flag with the cell.)*

### 4.6 Pass — 1 turn

Advance the tick without acting.

### 4.7 Ship a beta — 1 turn, from a fixed supply — DECIDED

*(Added 2026-08-05 by owner decision.)*

Place one `BETA` tile. **Target rules are Place's, exactly** (§4.1): ocean terrain, nothing built there, not an endpoint, orthogonally adjacent to the network. It cannot be placed on top of anything, another beta included — occupancy already forbids it and no extra rule is written.

**Supply.** `RULES.BETA_SUPPLY` betas per level, three by default, overridable per level (`betaSupply`, `0` switching the verb off). The counter is **betas shipped**, not betas standing: a beta a blast takes out is spent and does not come back. You shipped it.

What it buys is in §6.2: a beta is an **intermediate destination**. Users leave the origin for one as soon as it is reachable and genuinely closer to B than where they stand, walk to it, and camp there until something better is reachable. Only B is arrival.

**What it does not buy is time, and that is the point.** Camping at a beta drains patience exactly as waiting anywhere else does (§8) — moving is not waiting and standing still is, wherever the standing happens. The whole benefit of a beta is the **walk**: the ticks a user spends travelling to it are ticks it is not spending waiting, and the ground it covers is ground it does not have to cover later. A beta is staging, not slack.

Read the satirical mapping (§1) and it says itself: shipping a beta gets something in front of users before the thing is finished. They will come and look at it. They will not wait forever for the rest, and if the road past it is mined they will walk into that too (§6.2 is topological, not safe). Nothing about a beta makes a route safe; it only makes users start sooner.

Counts as hand placement for skill purposes when §7 exists.

---

## 5. Mines and detonation

**DECIDED**

A user stepping onto an `AI_HIDDEN` tile reveals it. If it contains a mine, it detonates.

*(Revised 2026-08-04 by owner decision: **a user stepping on it is no longer the only trigger.** Analyzing a mined tile (§4.3) runs this same section, unchanged and unspecialized — same flood fill, same reversion to ocean, same silent destruction of other mines, same re-queue, same confidence drop. Everything below therefore reads with "the triggering user" generalized to "the trigger"; when the trigger is a click rather than a footstep there simply is no triggering user to send home, and only users standing in the crater re-queue.)*

Detonation effects:

1. **Blast radius.** All tiles in the radius are destroyed and revert to **ocean**, including `HAND` tiles. This is deliberate: careful, understood work is taken down by the slop placed next to it.
2. **No chain reactions.** Other mines within the blast are destroyed silently. One user, one incident. Chains make variance unmanageable.
3. The triggering user returns to its origin and re-queues.
4. Stakeholder confidence drops.

Blast radius shape/size: per-level parameter. Baseline: the tile plus its 4 orthogonal neighbors.

**Volcanoes stop blasts — DECIDED.** A blast does not propagate through or past a `VOLCANO` cell. Radius is computed by flood fill from the detonation point, blocked by volcano terrain, not by naive rectangular or Manhattan distance.

This makes volcanoes **blast shields**, and creates a placement incentive worth naming: a player can deliberately place AI blocks against volcano walls to contain the damage they might do. That is isolating risky code behind a boundary, and it rewards reading the terrain rather than only the clues. It also gives the same cell two opposing pulls — volcanoes reduce legal placements but improve blast containment — which is exactly the kind of tension worth having in a level's geometry.

`VOID` should block blasts identically. Verify this falls out of the flood fill rather than special-casing it.

**Detonation as a deliberate tactic is legal and intended.** A player who has written off a region can let a user walk into it to clear the ground. That is "burn it down and rewrite." Do not patch it out. Do ensure it is not *cheaper* than repairing: the cost is the reset trip plus confidence loss plus the rebuild.

*(Revised 2026-08-04 by owner decision: **the tactic is now a sacrifice.** Users in the blast are killed, not returned to the queue (§8), so clearing ground on purpose costs you the person who did it — permanently, out of a fixed supply, off your final score. It is still legal and still intended, and it is a better decision than it was: the price is no longer an abstract number off a bar, it is "this one is not getting there, spend them". The triggerer needs no special case in the code, because the trigger cell is inside its own blast area.)*

---

## 6. Users

### 6.1 Arrival schedule and forecast — DECIDED

Each level defines a fixed arrival schedule: a **total user count** and a per-tick or per-N-tick cadence.

**The player must be able to see how many users are coming.** Display persistently in the HUD:

- total users remaining for the level,
- ticks until the next arrival,
- current number of users waiting.

This is not optional polish. The floor/ceiling decision (§8.3) is a dosage judgement, and a dosage judgement is unmakeable without knowing the demand. A player who cannot see the schedule is not choosing how much AI to use, they are guessing. The schedule is a forecast, not a surprise — the pressure comes from the turns being insufficient, not from the arrivals being hidden.

### 6.2 Departure gating — DECIDED

**A user departs only when a complete traversable path exists from its origin to its destination.** Otherwise it waits at the origin.

Traversability for this check includes `HAND`, `AI_HIDDEN`, and `AI_REVEALED`. It excludes `FLAGGED`, `MINE_CONFIRMED`, and ocean.

Note that `AI_HIDDEN` counts as passable here. The check is **topological, not safe**. A user will happily depart down a route that may be mined. It will not depart down a route that goes nowhere.

Implementation: BFS from origin over passable tiles, re-evaluated each tick for all waiting users.

Consequences, all intended:

- Users never walk into stubs, so dead-end stalling largely disappears as a case.
- **Waiting is the primary visible failure state.** A pile-up at the origin is the player's "you have not shipped anything usable yet" signal, and it reads instantly.
- Flagging a chokepoint immediately halts departures. This is the self-balancing property that lets flags stay free and uncapped (§4.5).

*(Revised 2026-08-05 by owner decision — **users walk to waypoints, and B is one of them.** With beta blocks (§4.7) the destination is no longer the only place a user is willing to go. Restated:*

*A user departs when a **waypoint** is reachable that is genuinely closer to B than where it stands. A waypoint is the destination or a beta. Reachability is the same topological question it always was — `AI_HIDDEN` passable, `FLAGGED` and `MINE_CONFIRMED` not — so nothing about the check became safe.*

*Three pieces make it work and each is doing a specific job:*

*— **Which waypoint.** Passable ground splits into connected components; a component's target is its waypoint nearest the finish. Users cannot walk to a waypoint they cannot reach, and there is no point offering them a choice they would never take.*
*— **"Closer to B" is measured over ground that could **ever** be built on, not over ground that is built now.* Otherwise the comparison is circular: an unfinished route reads as infinitely far and every waypoint looks equally good. Terrain is fixed at load, so this measure never moves during a game.*
*— **The progress guard.** A user may walk only when its target is strictly closer to B than its own cell. Without it, a beta shipped behind the origin — on a backwards spur, or across a bay — would drag the whole board away from the destination, because a routing field has no opinion about direction. It also earns its keep twice: a user standing on its own target fails the test, which is what makes arriving at a beta into **camping** with no separate rule for it.*

***The no-beta case is the old rule, unchanged.** With no beta on the board the only waypoint is B, every reachable component's target is B, the guard is true wherever a route exists, and "a waypoint is reachable and closer" is word for word "a complete traversable path exists from origin to destination". That equivalence is a tested invariant, not an argument.*

*One consequence worth stating because it looks like a bug and is not: a user that walks to a beta and camps there is **waiting**, and its patience runs down at the origin's rate (§4.7, §8). A pile at a beta is the same failure signal as a pile at A, one leg further along.*

*And one rule had to bend: SPEC §6.3.3's no-revisit trail. It exists to stop a user looping inside one trip, but a user that walks to a beta and is later retargeted may have to leave by the way it came in. When the waypoint set moves under a walker and its own trail is the only thing in its way, the trip that trail belongs to is over: it forgets where it has been and starts a new one from where it stands. It cannot oscillate, because every step still strictly decreases the current field and only a player turn can change that field. This applies **only while a beta is standing** — a board with none plays exactly as it played before, trail included.)*

### 6.3 Movement — DECIDED

Departed users move one step per tick along passable tiles, orthogonally only.

Routing rules:

1. Move only to a passable tile that **reduces distance to the user's destination**.
2. Among valid moves, choose **randomly**.
3. **Never re-enter a tile already visited on the current trip.** Prevents looping in networked boards.
4. Never enter `FLAGGED`, `MINE_CONFIRMED`, or ocean.
5. If no legal move exists, the user waits in place.

### 6.4 Stranded users — DECIDED

A detonation (§5) or a mid-trip flag can sever the path of a user already en route. **Stranded users wait in place and count as waiting users.** They do not return to origin and do not re-enter the departure gate.

Rationale: returning to origin would double-punish an event that already cost the player a blast, a rebuild, and a confidence hit. Waiting in place also keeps the stranded user visible on the broken section, which is better feedback than removing it from the board.

All waiting users — gated at origin, stalled mid-route, or stranded by a blast — count identically toward the waiting penalty (§8.2).

### 6.5 Itineraries — DECIDED 2026-08-05 (owner decision)

With several destinations on the board (§2.4), "where is this user going" stops being a property of the level and becomes a property of the user. **Each user carries an itinerary: a list of destinations it must visit, in any order.** A list of one is legal and is the common case.

**The order is the user's, not the level's.** A user owing B and D visits whichever is nearer first, by the same routing that has always sent it to the nearest waypoint (§6.2) — the itinerary is a *set* of obligations, and the walk is what turns it into a sequence. Levels that want a forced order should use two destinations and two itineraries, not one itinerary and a rule.

**Itineraries are authored and cycled, never rolled.** The level lists them — `[['B'], ['B','C'], ['D']]` — and users take them round-robin in spawn order. A level that lists none gives **every user every destination**. Two deliberate consequences:

- **The demand is knowable in advance**, which is what §6.1's forecast is for. A random draw would make the same level ask for different things on different seeds, and the dosage judgement of §8.3 is unmakeable against a demand that moves.
- **A single-destination level is untouched**, because "every user visits every destination" is "every user visits B". This is the whole regression argument, and it is a mechanism rather than a promise.

**Visited on contact.** Stepping onto a destination still on the list ticks it off *immediately*, whether or not it was the one the user was routed toward — a user sent to C that crosses B on the way has been to B. Stepping onto a destination **not** on the list does nothing whatsoever: it is a passable cell, like any other built cell.

**The last stop is arrival**, priced exactly as arrival always was: the user leaves the board, the level scores a point (§8). A user is worth one point however many destinations it visited, because the point is the *user served*, not the mileage. Intermediate stops score nothing.

**Reaching an intermediate stop refunds half a bar of patience**: `waited ← max(0, waited − round(patience × destRefill))`, `destRefill` defaulting to 0.5 and overridable per level in [0, 1]. This is the one genuinely new number and it exists to make long itineraries *possible* rather than merely slower:

- With **no** refill, the second leg is walked by a user who has already spent whatever the first leg cost, so a three-stop itinerary is close to a slow way of losing that user, and the level gets harder in proportion to how much it asks for. That is backwards.
- With a **full** refill, every extra stop is a free extension of the clock and a level gets *easier* the more it asks for, which is worse.
- **Half** makes arriving somewhere worth something and keeps the whole trip finite. It is a first number, not a measured one (§10.2: the sim tunes it, not play).

Note what the refill is not: it is not a reward for distance and it does not stack. Camping on a **beta** still buys nothing but the walk (§4.7) — a milestone is not a destination, and the difference between them is exactly this line.

#### Ordered itineraries — opt-in, DECIDED 2026-08-05 (owner decision)

*(Added the same day, and it does not overturn a word above: everything already written stays the default. This is a second shape a level may reach for when it wants one.)*

**An itinerary entry may be a sequence instead of a set.** Two shapes, and a level may mix them freely:

```js
itineraries: [['C'], ['B', 'D'], { stops: ['B', 'C', 'D'], ordered: true }]
```

- `['B', 'D']` — the original, unchanged. Obligations in any order, nearest first, visited on contact.
- `{ stops: ['B','C','D'], ordered: true }` — **B, then C, then D**, enforced.
- `{ stops: [...] }` with no `ordered` is the loose form spelled the long way. Turning a list into a sequence should cost the author the word.

**The exact semantics, which are one sentence with one consequence.** An ordered user's next obligation is `stops[0]` **and nothing else**:

- **Routing.** It walks toward `stops[0]` — the departure gate, the waypoint election and the progress guard all see a one-element list. A later stop that is nearer, reachable, or both, is not a place it is going. Standing at the origin with its next stop walled off and a later stop wide open, it **stays at the origin** and burns patience. That is not a side effect of the implementation; it is what the level asked for.
- **Contact with a later stop does nothing.** Stepping onto a destination that is on its list but is not `stops[0]` is exactly as eventless as stepping onto a destination it never owed: no tick-off, no `visited` event, no patience refill, no fresh trail. It will walk back for it when its turn comes. Ordering that did not enforce itself on contact would be a suggestion, and §6.5's contact rule already covers the set case.
- **Everything else is untouched.** Reaching `stops[0]` ticks it off, refunds `round(patience × destRefill)` if more stops remain, starts a fresh no-revisit trail, and is arrival when the list empties — the same lines, the same event, the same one point per user however far it walked.

**Absent means loose, everywhere.** A user carries the bit; a level that never writes `ordered` produces users that never carry it, and a saved game written before this existed reads back as the loose game it was. A level with one destination cannot tell the difference in either direction — a one-stop sequence and a one-stop set are the same walk — which is the same regression argument the rest of §6.5 rests on.

**What it is for.** A set of stops is a routing problem; a sequence is a *schedule*, and it prices the legs against each other. With `['B','C','D']` loose, closing any one leg serves somebody. Ordered, closing the last leg first serves nobody until the first one opens, so the build order stops being a matter of taste. `delta`'s third itinerary carries it for exactly that reason (§9.2.2).

### 6.6 The walker cast — DECIDED 2026-08-05 (owner decision)

*(Added the same day, and it does overturn one line above: §6.5's "**authored and cycled**" is now "**authored and dealt**". Everything else in §6.5 stands, including the guarantee that a single-destination level is untouched.)*

**A level authors a cast, and every run deals it.** The cast is a pool of *walkers*, not a list of routes:

```js
walkers: [
  { stops: ['C'] },
  { stops: ['B', 'D'] },
  { stops: ['B', 'C', 'D'], ordered: true },
  { stops: ['C'], patience: 12 },
]
```

`stops` and `ordered` are an itinerary's, with the identical rules and the identical validation. `patience` is the new field and the reason the shape exists at all: a cast that could only vary *where* people go would be an itinerary list wearing a new name.

`walkers` and `itineraries` are **mutually exclusive** — a definition carrying both is a validation error rather than a merge or a precedence rule, because the two fields answer the same question and a level with both is an author who changed their mind halfway. An `itineraries` level is read as a cast of walkers with no patience override, so there is one code path downstream and the older field keeps working.

**The deal is seeded, resolved once, and never stored.** At `init(def, seed)` the pool is dealt against the arrival count into a per-spawn list: entry *k* is the person who walks out on arrival *k*. Three properties, each load-bearing:

- **The demand is still knowable in advance.** The *whole* cast exists before the first turn, so §6.1's forecast is as honest as it was — the player can be shown every stop the level will ask for. This is what rules out the obvious alternative of rolling each user at spawn.
- **The same seed always deals the same hand**, so a share link, a replay and a refresh are the same game. The deal comes off a **private stream** derived from the seed, created and dropped inside the resolution; the generation and movement streams (PLAN §7.5) are not advanced by a single step, which is how the six tuned levels stayed bit-identical.
- **Nothing about a walker is saved.** A walker's `id` *is* its casting slot, so its stops, its order and its bar are re-derivable from `(LevelDef, seed)` — which a save already carries. A refresh mid-game rebuilds the identical cast. This is why a per-walker feature landed with no save version and no migration.

**Two branches, decided by the count, and the count is how an author states their intent:**

- **Pool ≥ arrivals — a seeded SUBSET.** Shuffle the pool and take the first *N*. An oversized cast means **some members simply do not appear this run**: twelve roles over nine arrivals is a level that asks nine of twelve possible questions and never the same nine. Opting out costs nothing — write exactly *N* roles and every one is cast, in a shuffled order.
- **Pool < arrivals — cycle, then shuffle.** The pool is repeated head-to-tail to exactly *N* entries **first**, and only then shuffled, so **the authored mix is exact**: three roles over nine arrivals is 3/3/3 on every seed, four is 3/2/2/2, and only the running order moves. Rolling each slot independently would let a seed deal six of one role and none of another, which turns a mix the author balanced into a lottery and turns the §6.1 forecast into a distribution. **Ratios are authored; order is rolled.**

**Per-walker patience.** `patience` on a cast entry replaces the level's bar *for that walker only*, and it is a bar, not a modifier — an impatient walker on a 12 against a level's 26 leaves after twelve cumulative waiting ticks (§6.4), wherever it is standing. Two consequences worth stating because both are the point:

- **Half a bar is half of that walker's bar.** The intermediate-stop refill (§6.5) is `round(ownPatience × destRefill)`. Any other reading would hand the largest relief in the game to precisely the walkers a cast writes *because* they are fragile.
- **Every display reads the walker's own bar**, not the level's: the board's impatience shading, the roster's per-person countdown, its gave-up-versus-killed wording, and the HUD's worst-case chip. A walker on a short bar can be the worst case on the board while carrying the *smallest* waiting count, and a HUD that measured everybody against the level's number would name the wrong person exactly when the level had gone to the trouble of writing an impatient one.

**Explicit arrival turns.** `arrivals` may now be `{ at: [2, 5, 9] }` instead of `{ count, firstTick, every }` — the turns spelled out, strictly increasing, and the list's length is the user count. It is the same schedule field in a second shape, for levels whose pressure is a *burst* rather than a cadence, and the two shapes are mutually exclusive on the same reasoning as `walkers`/`itineraries`. Nothing about the schedule's stored form changed: the next arrival is still one number, read off the list instead of added to.

**What the cast is for.** §6.5 made the level's demand richer; this makes it *unrepeatable*. Two games of a level with a cast ask the same questions in a different order, and on an oversized cast they ask different questions — so the second playthrough is a fresh read of the same geometry rather than a faster execution of a remembered plan. Measured on `delta` the day it landed: hand-only had delivered exactly 7 of 9 in all 200 games, a flat line; with the cast it spreads 6–9 for the same mean and posts the level's first non-zero perfect rate.

---

## 7. The skill system

This is the core system. Implement it exactly.

### 7.1 What skill is

A single persistent scalar, carried **across levels** in campaign mode. It governs the precision of clue information, and nothing else.

It is unrelated to the player's competence at block placement. Those are deliberately separate.

### 7.2 Clue precision — DECIDED

Skill degrades *interpretation*, not quantity. A revealed clue is **never wrong, only weaker**. Tiers, from high skill to low:

| Tier | Display | Meaning |
| --- | --- | --- |
| Exact | `3` | Exactly 3 adjacent mines |
| Range | `2-3` | Between 2 and 3 |
| Bound | `2+` | At least 2 |

Notation must fit in a tile. `2+` and `2-3` do.

**The asymmetry is the point.** A lower bound proves mines *exist* but almost never proves a tile *safe*. So as skill falls, the player retains the ability to detect that something is wrong and loses the ability to confirm that anything is right. Low-skill players therefore flag more, because flagging is the only action their information supports, which blocks routes, which piles up users, which drains confidence. The failure spiral emerges from the information structure. It is not a scripted penalty and should not be supplemented with one.

The player is never given false information. The feeling to produce is *underequipped*, not *cheated*.

### 7.3 Skill movement

- Generate (§4.2): decreases skill.
- Place tile (§4.1) and Overwrite (§4.4): increases skill.
- Analyze (§4.3): **OPEN** — plausibly a small increase (review builds comprehension), plausibly neutral. Try neutral first; a self-healing analyze action weakens the trap.

**OPEN:** numeric model. Needs to be a smooth scalar with tier thresholds, not discrete steps, so degradation is felt before it is visible.

### 7.4 Adjacency for clue counting

Clue numbers count mines in **all 8 surrounding cells** (classic minesweeper), even though user *movement* is 4-way. Two different adjacency rules in one game is a real usability risk.

**OPEN:** resolve to 4-way counting if playtest shows confusion. 4-way counting produces weaker deduction and may need compensating (larger blocks, more analysis).

*(Revised 2026-08-04 by owner decision — **which cells carry a clue, not how one is counted.** Until now only `AI_REVEALED` tiles displayed a number. **`HAND` tiles display theirs too:** structure you built yourself senses the defects next to it. The adjacency rule above is untouched, and so is the arithmetic — a clue has always been a statement about the eight cells around a position, with no opinion about what is built on that position. Only the set of positions that put their count on screen changed.*

*Why it matters more than it sounds: it turns Place into a **safe, slow information source**. Build alongside a generated block and read its edge, rather than clicking into the block and risking the crater §4.3 now produces. Generate buys ground fast and blind; Analyze buys one tile fast and dangerously; Place buys one tile slowly and safely, and now tells you something on the way. That is the trade the verb set was missing.*

*Two consequences recorded elsewhere: `HAND` counting zero **as a neighbour** (§7.5) is unchanged and unrelated — a hand tile holds no mine, and separately has a count of its own. And the solver (§10.2) reads hand clues on the same footing as revealed ones, or its `guessForced` instrumentation would measure a game nobody is playing; endpoints stay out of both, since they display nothing. The renderer leaving a hand tile blank below 1 is a display choice about visual noise — blank means zero, and the information is identical.)*

### 7.5 Ocean as deduction aid — DECIDED

Ocean cells are known-empty and count as zero for clue purposes. *(Throughout this section "counts as zero" means **as a neighbour**: the cell holds no mine, so it adds nothing to the counts around it. It says nothing about whether the cell displays a count of its own — since 2026-08-04 hand tiles do, see §7.4.)* The ocean perimeter functions like the revealed edge of a minesweeper board and is a major deduction aid. This is what makes placement-against-the-edge a meaningful choice (§1).

`VOID` and `VOLCANO` cells count as zero identically. A coastline is therefore just as good a deduction anchor as open ocean, which means non-rectangular play spaces (§10.7) change the *shape* of available deduction anchors without weakening them. Irregular coastlines with many inlets are actually *easier* to deduce against than open water, so treat coastline complexity as a difficulty-reducing axis, not an increasing one.

---

## 8. Meters and pressure

> **REVISED 2026-08-04 by owner decision — THE CONFIDENCE METER IS GONE.** This whole section
> described a bar that emptied; the game now has no bar. Pressure is the users themselves,
> and the economy is points:
>
> - **Patience replaces the drain.** Every user carries a cumulative count of the ticks it
>   spent unable to move — queued at the origin, stalled mid-route, stranded behind a crater,
>   all the same thing (§6.4 was always right about that). At `RULES.USER_PATIENCE` ticks it
>   gives up and leaves for good. Moving is not waiting, and the count never resets, so a
>   route that keeps stalling bleeds the same person out across the whole game.
> - **Death replaces the detonation hit.** A user caught in a blast — the one who triggered
>   it included — is killed, not returned to the queue. See §5.
> - **Running out of users replaces the empty bar.** The level ends when every scheduled user
>   has either arrived or gone. **Score is arrivals.** One is a win, all of them is the goal,
>   none is a loss.
>
> `CONFIDENCE_START`, `WAIT_DRAIN_PER_USER`, `DETONATE_HIT` and `SERVED_BONUS` are deleted.
> **The metaphor survives as flavour** — stakeholder confidence is a fine thing to call the
> HUD's remaining-users readout, and §8.1's "AI is the exchange rate" framing still describes
> what the player is trading. What is gone is the *mechanism*: nothing is subtracted from a
> pool any more, and the thing you can run out of is people. Everything below is kept for the
> reasoning; read §8.2's "continuous, scales with the count" as satisfied by patience running
> on every waiting user at once. `PLAN.md` §3 rulings 3/4/11 and §7.1 carry the details.

### 8.1 Two persistent meters

- **Skill** — buys clarity (§7).
- **Stakeholder confidence** — buys time.

AI is the exchange rate between them. The rate worsens as skill falls, because weaker analysis means slop takes more turns to clean up. One dial, two resources, emergent spiral.

### 8.2 Waiting penalty — DECIDED

Waiting users drain stakeholder confidence **continuously and gradually**. Not a cliff, not an instant loss.

This preserves agency. A player must be able to *choose* to eat the anger, hand-build carefully, and protect skill for later levels. That sandbag move only exists if waiting hurts on a slope.

Drain rate should scale with the number of waiting users so pile-ups compound.

### 8.3 Floor and ceiling — DECIDED

Every level has two implicit thresholds:

- **Minimum viable AI usage** — below it, you lose *now* (users pile up, confidence hits zero).
- **Maximum sustainable AI usage** — above it, you lose *later* (skill degrades past the point of readability).

The gap between them is the game. Early levels open it wide. Late levels close it from both sides: arrival cadence tightens, raising the floor, while degraded skill lowers the ceiling.

The intended campaign ending is not a loss screen. It is the floor rising above the ceiling, so no correct play exists.

### 8.4 The break-even ratio — DECIDED

Because the floor is never zero, each level has an implicit hand-placement ratio at which skill holds steady.

**Make it discoverable through play. Never display it.** Late levels should raise the floor past break-even, so maintenance becomes unaffordable even though the player knows exactly what it would take. Knowing the correct practice and being unable to afford it is the intended ending.

---

## 9. Level design

### 9.1 Level 1 — DECIDED

- **Winnable with minimal AI usage. Not winnable with zero.** There was never a moment when a working developer under deadline could opt out entirely; what existed was survivable dosage.
- Forcing at least one Generate means level 1 teaches the entire verb set. A hand-winnable level 1 would leave generate/analyze/flag untaught until pressure spikes.
- **The level 1 block must be a satisfying solve.** Full skill, exact numbers, an easy shape, ocean on multiple sides, clean deduction, no guessing required.

This is not just onboarding. The player cannot mourn a competence they never felt. Level 1 must give them `3` on a solvable board so that level 6 giving them `2+` on an unsolvable one means something. The player should leave level 1 believing they have found a sustainable practice.

The trap is then the **anchor**: they carry forward a dosage ratio that was correct at small scale and keep applying it as the floor rises underneath them. The satirical point is not that they reached for AI. It is that they kept using a dosage that was correct under conditions that no longer hold.

### 9.2 Variation axes

Ranked by design value, not implementation order:

1. **Arrival cadence.** The primary difficulty dial. Tightening it raises the floor.
2. **Multiple endpoints.** A, B, C with required connections. The value is not size, it is the **trunk decision**: one shared path serving A→B and A→C is turn-efficient but a single mine takes down both, while separate paths cost far more turns and fail independently. Monolith versus isolation, felt rather than stated.

   *(**Shipped 2026-08-05.** A level marks `A` plus `B`, `C`, `D`… (§2.4) and `src/levels/delta.js` is the first one to use it — two three-row necks into a shared spine with three lobes off it, so the trunk decision arrives in the first ten turns. The axis works exactly as written above and needs nothing else to be worth using.*

   *What **itineraries** (§6.5) add on top is a second dial on the same axis, and it is the more interesting one: the demand no longer has to be uniform. With every user visiting every destination, a three-destination level is one big connectivity problem. With `[['C'], ['B','D'], ['B','C','D']]` it is three different problems sharing a board — a third of the users are served by the trunk alone, a third never stop in the middle, and a third pay for the whole tour and get patience back twice for doing it. That turns "which routes do I build" into "which routes do I build **first**", because partial connectivity now serves part of the demand. The trunk decision and the dosage decision (§8.3) start pulling on the same turn, which is the whole point of the level design chapter.*

   *Mid-level requirements (§9.2.3) remain unbuilt and are now a much smaller change than they were: a new destination appearing on tick N is an edit to `dests` and to the live itineraries, and every routing consequence is already in place.)*
3. **Mid-level requirements.** A new endpoint opens on tick N. If the player got there by generating, they now have a board they can walk on but cannot build from (§4.1/§9.3), and must spend turns analyzing already-shipped ground before they can respond. Strongest difficulty mechanism in the design, because it is made of consequence rather than grid size.
4. **Shape pool.** Later levels draw awkward, perimeter-heavy shapes. Harder to place and harder to read, compounding correctly.
5. **Inherited board.** One specific mid-campaign level starts with a partially built board of `AI_HIDDEN` tiles the player did not generate and has no mine counts for. Use once.
6. **Play space shape.** Chokepoints, inlets, islands, irregular coastlines, non-rectangular arenas (§10.7). Weakest axis alone; use as texture. Note that more coastline means *more* deduction anchors, so irregular shapes ease the minesweeper layer while tightening the routing layer.

### 9.3 Why §4.1's build restriction matters

The rule "you cannot branch from an unrevealed tile" is what converts the whole design into an argument. Combined with mid-level requirements (§9.2.3), it means unreviewed shipped code is *walkable but not extensible*. Responding to a new requirement requires paying down comprehension debt first. Do not relax this rule for convenience.

---

## 10. Technical architecture

### 10.1 No game engine — DECIDED

Discrete state, deterministic transitions, no physics, no continuous simulation, no frame-rate-dependent logic, few moving entities. Phaser / Kaplay / Excalibur / Godot-web would add payload and lifecycle opinions while solving no problem this game has.

The hard parts are board generation with a solvability guarantee, constraint solving over ranged clues, and economy tuning. No engine helps with any of those.

Stack: plain JavaScript ES modules — no build step, no bundler, zero dependencies of any kind. The folder is served as-is. Types live as `// @ts-check` + JSDoc typedefs; tests and the sim harness use Node built-ins (`node --test`, `node src/sim/run.js`).

*(Revised 2026-08-03 by owner decision; originally "Vite + TypeScript, zero runtime dependencies in core." Tooling only — the no-engine decision and every §10.2 property — headless core, no DOM in core, injected PRNG — are unchanged. Details in `PLAN.md` §1.2.)*

### 10.2 Headless core, renderer as subscriber — DECIDED

```
core/          zero deps, no DOM, pure, injected PRNG
  state.js     discriminated unions for tile states (JSDoc typedefs)
  rules.js     every tunable constant, one file, one exported config
  shapes.js    curated block table + rotation/normalization
  generate.js  block selection + mine placement
  solver.js    constraint checker over ranged clues
  routing.js   user movement
  reduce.js    (state, action) -> { state, events[] }
sim/           headless harness, policy bots, batch runs
ui/            canvas renderer, HUD, input
```

Three concrete reasons, all specific to this design:

**The economy cannot be tuned by playing it.** §8.3 and §8.4 are claims about thousands of games, not fifteen. Run scripted policies (always-generate, always-hand, 70/30, adaptive) across seeded boards in Node and chart where skill and confidence land. Requires a core with no DOM imports and an injected PRNG rather than global `Math.random`.

**The solver is needed at generation time, not just for hints.** Ranged clues make deduction a constraint problem: each **displayed** clue is an inequality over a set of booleans — revealed AI tiles and, since 2026-08-04, hand tiles (§7.4); endpoints display nothing and contribute nothing. Enumerate frontier configurations consistent with all constraints; a tile is provably safe only if no consistent configuration places a mine there. Exponential in frontier size, which is exactly why small chunky blocks are load-bearing. At 4–8 cells it is trivially tractable.

*(Revised 2026-08-04, following the §4.2 size change to 12–26 cells: still tractable, and the reason is component splitting rather than block size — the solver enumerates over `AI_HIDDEN` cells only, splits the constraint graph into independent components, and marks any component past its budget `bailed`. Measured cost across the corpus is under a millisecond a game. What did change is the payoff: `guessForced` read 0% on every level of the old corpus and now fires on 20–40% of games, so "the moment deduction became impossible" is finally a signal instead of a constant.)*

The larger payoff: the solver can *measure* solvability at a given skill tier, so the moment the game becomes unwinnable by deduction is instrumented rather than guessed at. That is the ending §8.3 describes.

**Seeded determinism** for bug reports and for a possible daily-board mode.

**Anti-pattern, called out explicitly:** the canvas is **never** the source of truth for terrain or collision. Classic procedural games (QBasic *Gorillas* and its descendants) test the framebuffer for collision and carve craters directly into it, making the pixels and the world model the same thing. That is elegant in a game with no other consumers of the world state. It is fatal here: the solver (§10.2), the routing BFS (§6.3), the departure gate (§6.2), the blast flood fill (§5), and the headless sim harness all must reason about the board with **no canvas in existence**. A detonation mutates core state and emits an event; the renderer reacts. Never the reverse. If any gameplay question is ever answered by reading pixels, the architecture has been inverted.

**Event emission:** the reducer returns `{ state, events[] }` where events are `{ type: 'reveal', cell }`, `{ type: 'detonate', cells }`, `{ type: 'step', user, from, to }`. The renderer animates from that list rather than diffing two boards. Core stays entirely time-free; all animation lives in the renderer; the sim runs at thousands of ticks per second in Node because nothing in core knows what a frame is.

### 10.3 Canvas rendering — DECIDED

Canvas for the board. DOM for HUD, action bar, minimap, and arrival forecast (§6.1), where layout and text actually are the job.

Rationale:

- **Zoom performance.** A 40×40 board is 1600 cells; SVG would mean thousands of nodes to transform during a pinch, which is where SVG falls over on mid-range Android. Canvas redraws at device resolution and does not care. *(Board sizes revised 2026-08-04 by owner decision — the corpus now runs 32×20 to 50×30, and `core/validate.js` caps boards at 64×64 rather than 40×40. The argument is unchanged and the arithmetic only moves further in canvas's favour: 1500 cells today, 4096 at the ceiling.)*
- **Crispness.** Canvas re-rasterizes every frame at any scale. CSS-transformed DOM text goes soft mid-gesture.
- **Destruction effects.** Blast particles and shake are trivial on canvas and awkward in SVG. Running two rendering models to get them would be worse than running one.
- **Hit testing is not a problem here.** A uniform grid needs no scene graph: `floor((px - offsetX) / cellSize)`. The thing that normally makes canvas expensive does not apply to this shape of game.

Text rendering is a non-issue: the glyph set is `0-9`, `+`, `-`, drawn from a procedural bitmap font (§10.8), not `fillText`. No measurement, no font loading, no fallback behaviour, and selection is meaningless on a board.

### 10.4 Responsive sizing — DECIDED

The canvas **upsizes to fill available screen space**. Requirements:

- Back the canvas with a `ResizeObserver` on its container. On resize, set `canvas.width/height` to `containerSize × devicePixelRatio`, set CSS size to the container size, and `ctx.scale(dpr, dpr)` once per resize.
- Derive base cell size from container dimensions and board dimensions rather than hardcoding, so a fit-to-screen view is always available.
- Recompute on `devicePixelRatio` change (external monitor, browser zoom), not only on element resize.
- Never let layout depend on canvas size — HUD is DOM and lays out independently.

### 10.5 Zoom and pan — DECIDED

**Semantic zoom, not scaled zoom.** If zooming only makes tiles bigger, players pinch on every turn, because the information they need alternates between "where is my path going" and "what does this clue say." Render different content per tier, keyed to **effective cell size in CSS pixels** (which makes tiers responsive automatically):

- **Far** — no clue text. Tile fills only: hand vs AI-hidden vs revealed vs flagged as flat colors, endpoints, user dots, block boundaries. Topology view.
- **Mid** — clue text appears, borders thin.
- **Near** — full detail, per-block mine counts, larger hit targets.

Text legibility therefore only matters at the tier where few tiles are on screen.

Persistent **minimap** in DOM showing the full board plus a viewport rectangle. Cheap, and it means players rarely need to zoom out at all.

Gestures: Pointer Events with `touch-action: none` on the board container so the browser does not hijack pinch and zoom the whole UI. Track active pointers in a Map; two pointers give midpoint and distance. **Anchor zoom at the gesture midpoint, not viewport center** — getting this wrong is why bad pinch implementations feel like the board is fighting you. Clamp scale to tier range; clamp pan to board bounds with rubber-banding on overscroll.

Camera state (scale, offset, tier) is pure view state. It never enters the reducer and is never serialized into a save.

### 10.6 Input model — DECIDED

Two-step, on touch and desktop alike:

1. Tap/click a cell → it becomes selected. Nothing is spent. The action bar shows the **legal** actions for that cell with turn costs.
2. Tap the action → the turn resolves.

This eliminates the misfire class (tap-to-place vs drag-to-pan on one surface), which matters enormously when a misfire costs a scarce turn. It also solves action selection on devices with no right-click or modifier keys.

Side benefit: showing only *legal* actions teaches the adjacency and build-from rules without a tutorial. A cell adjacent only to `AI_HIDDEN` simply will not offer Place, and the player learns §4.1 from its absence.

Use the selected state to preview consequences: blast radius of a confirmed mine, routes a flag would sever, ghost of the current block with valid/invalid tinting. *(Revised 2026-08-04: the confirmed-mine preview has nothing to fire on while no action produces `MINE_CONFIRMED` — see §2.2. The other two previews are unaffected, and the code stays for the same reason the state does.)*

**Block placement flow:** Generate → block appears in HUD at fixed size (must stay legible at far zoom while the player scans) → ghost follows cursor/tap position with snap → rotate button, free and unlimited → confirm. Nothing spends a turn until confirm.

### 10.7 Play space geometry — DECIDED

**The play space must not be assumed rectangular.** Future levels use irregular coastlines, inlets, lakes, islands, and asymmetric arenas (§9.2.6). The first level is a plain rectangle, but the architecture must support arbitrary shapes **from the first commit**, because retrofitting this touches generation, routing, solving, camera, and rendering simultaneously.

Concretely, the following must never be written:

- Iteration as `for y in 0..h, for x in 0..w` treating every cell as playable.
- Bounds checks of the form `x >= 0 && x < w` used as a proxy for "is this a real cell."
- Fit-to-screen or camera clamping derived from array dimensions.
- Neighbour lookups that assume all in-array neighbours exist.

Instead:

- Store the grid as a dense array for cache locality, but carry a **playability mask** alongside it. `VOID` in the tile-state union is sufficient; a separate mask is not needed as long as every consumer checks it.
- Provide a single `neighbors(cell)` accessor in core that filters `VOID`, and use it everywhere. Routing, clue counting, flood fill, and block placement validation all go through it. This is the one function that makes irregular shapes free everywhere else.
- Derive the **playable bounding box** at level load and use it for fit-to-screen sizing (§10.4) and camera clamping (§10.5), not the array dimensions. A level shaped like a diagonal channel should not be framed as though it filled its rectangle.
- Block placement validation (§4.2) already requires all-or-nothing overlap onto ocean, so it rejects `VOID` overlap automatically. No extra rule needed — verify this, do not special-case it.
- The **solver** (§10.2) must treat `VOID` as a known-empty constraint identical to ocean. If it enumerates over a rectangular frontier it will produce wrong results on coastlines.

Level definition format carries the terrain layer explicitly as a character map. This is the most editable form for hand-authoring and is worth having from the first level:

```
..####....
.###^##...
A###^###.B
.######...
..####^...
```

`.` = `VOID`, `#` = `OCEAN`, `^` = `VOLCANO`, `A`/`B` = endpoints. One character per terrain feature; extend the legend as features are added (§2.3). Store each map as its own file alongside its arrival schedule, mine density, and shape pool.

Rendering: `VOID` is not drawn as board. Draw a coastline stroke along the play space boundary rather than filling void cells with a color, or the irregular shapes will read as a rendering bug rather than as terrain.

### 10.8 Art direction — DECIDED

**Pixel art as an aesthetic, rendered entirely procedurally in-canvas. No PNGs, no sprite sheets, no image assets of any kind.** Particle-based explosions provide deliberate contrast: the world is authored and discrete, the destruction is not.

#### What "pixel art" means without bitmaps

The look comes from three constraints, not from source images:

1. **A quantized art grid.** Define an **art pixel** as the atomic unit of rendering. A tile is N art pixels square — **8×8 recommended**. Nothing is ever drawn at a position or size that is not a whole number of art pixels.
2. **A fixed, small palette.** Declare it once as constants. Twelve to sixteen colors total. No gradients, no alpha blending in world rendering. Shading is achieved by **dithering** — checkerboard and Bayer patterns between two palette entries — which is what actually reads as pixel art.
3. **Hard edges only.** `fillRect` exclusively for world geometry. No `arc`, no `bezierCurveTo`, no anti-aliased strokes on the board. Circles and diagonals are drawn as stepped rect runs.

#### This makes the integer-scale problem smaller

The previous constraint (integer zoom factors) existed to avoid resampling a source bitmap. **With no bitmap there is no resampling**, so the constraint relaxes to something finer:

> The **art pixel size in device pixels must be a positive integer**. The zoom factor itself need not be.

At 8 art pixels per tile, zoom now steps at 8× the granularity of the sprite approach, so pinch feels close to continuous while staying perfectly crisp. Every `fillRect` lands on whole device pixels by construction.

`imageSmoothingEnabled = false` still applies to any blitting (§ below). Compute art pixel size **after** devicePixelRatio: `artPx = max(1, round(cssArtPx × dpr))`. Fit-to-screen picks the largest integer `artPx` whose resulting board fits the playable bounding box, and letterboxes the remainder.

#### Bake procedural tiles into an atlas at runtime

Draw procedurally, then cache like sprites:

- On load, and on any change to `artPx`, render each tile variant **once** into an offscreen canvas atlas.
- World rendering then blits from that atlas rather than re-running procedural draw code per cell per frame.
- This keeps authoring fully procedural while giving sprite-sheet performance, and it means the expensive part happens on zoom-tier change rather than per frame.

**Seed per-cell texture by cell coordinates.** Ocean dithering, volcano speckle, and any noise must be a pure function of `(x, y)` and the level seed. If it is re-randomized per draw, texture will crawl and shimmer when panning, which is the single most common way procedural pixel art looks broken.

#### Text

The clue font is a **procedurally defined bitmap font**, encoded as bit patterns in code. The required glyph set is tiny: digits `0-9`, `+`, `-`. A 3×5 or 5×7 pattern table covers it in a few dozen lines.

Legibility floor: a 5px glyph height needs roughly 10–12px of tile width. Below that, drop to the far tier and stop drawing text (§10.5). **The zoom tier thresholds and the font legibility floor must derive from the same constant**, not be tuned independently.

#### Particles

Particles are **pure view layer**. Core emits `{ type: 'detonate', cells }` (§10.2); the particle system consumes it. Core never knows particles exist, never simulates them, never waits for them.

- **Simulate in floating point, render quantized to the art grid.** Smooth physics, pixel look. Free subpixel rendering is the louder reading of the contrast and is defensible, but it needs conviction elsewhere or it reads as two games stapled together. Default to quantized.
- Particles are `fillRect` of one to three art pixels, drawn from the same palette. Fade by **switching palette entries**, not by lowering alpha.
- **Particles must respect volcano occlusion** (§5). If volcanoes stop blasts mechanically but debris sprays across them visually, the rule reads as a bug.
- Detonation is the game's signature moment. Screen shake, tile-dissolve on reverting cells, debris. It should be the most expensive thing on screen.

#### Consequences worth exploiting

**No asset pipeline.** No image loading, no CORS, no preloader, no build step for art, no missing-texture states. The whole game remains shippable as a small number of source files, and every visual is diffable in version control.

**The board is completely static between ticks.** Nothing animates unless a user steps or a blast fires. So cache the composited world to an offscreen canvas, redraw it **only on state change**, and run a per-frame loop only while particles or step-tweens are alive, then idle. A 40×40 board costs essentially nothing at rest, and the full frame budget is available during the one moment that needs it. *(Board sizes revised 2026-08-04 — up to 50×30 in the corpus, 64×64 at the validator ceiling; "essentially nothing at rest" is a property of the idle-at-rest frame model, not of the cell count, so it survives the rescale intact.)*

That second point is a direct payoff of the headless-core split (§10.2): because core is time-free and emits discrete events, the renderer knows exactly when to wake.

*(Revised 2026-08-04 by owner decision: **16 art px per tile, calmer low-noise texture, full cell borders on AI tiles, larger clue font.** The three constraints above — quantized art grid, sixteen-colour palette, hard edges only — are unchanged and are what the look still rests on; what changed is how much texture sits inside a tile. The recommended 8 becomes 16, so a tile can be mostly flat and still carry a crisp one-art-pixel cell border and a legible clue; ocean texture drops from ~18% coverage to ~4%; the 25% ordered dither on hidden AI tiles is gone; the clue font is 5×7 rather than 3×5 (a range tightens to a zero gap to stay inside its tile). The derived-from-one-constant rule for the tier thresholds and the legibility floor is untouched — the "5px glyph" arithmetic above is now read with GLYPH_H = 7, giving far 1 · mid 2–3 · near ≥4 with `ZOOM_MAX_ARTPX` 6, the same 96 device-px tile ceiling as before. Particle sizes are stated in art pixels and were rescaled with the grid so nothing shrank. Details in `PLAN.md` §11.)*

### 10.9 Accessibility — DEFERRED

Not in scope for the working prototype. **One constraint must be honored anyway so it stays recoverable:**

> Every action must be expressible in the reducer as a `(cellX, cellY, actionType, rotation?)` tuple, never as a pointer event. Input is coordinates, not clicks.

If that holds, adding a keyboard cursor and a visually-hidden `role="grid"` DOM mirror later is purely additive. If pointer handling reaches into the reducer, it is a rewrite.

---

## 11. First implementation — DECIDED

**A small library of hand-authored levels, each defined by its play space shape. No campaign, no progression, no generator.**

Levels are authored as character maps (§10.7), stored as files, loaded by name. Each is a distinct **shape** of play space, and shape variation is the entire content axis for now: coastlines, chokepoints, volcano clusters, wide-open water, narrow channels.

Purpose is a **tuning corpus**, not a game. Five to eight levels is enough to answer whether shape variation produces meaningfully different play, and to give the sim harness (§10.2) something to run policies against. Do not build a level select screen, a progression system, unlock logic, or a difficulty curve. Load by URL parameter or a dropdown.

Scope per level:

- **Two endpoints only, A → B.** No multi-point networks, no mid-level requirements.
- **Terrain:** `OCEAN`, `VOID`, `VOLCANO`. No future features from §2.3.
- **Three actions:** place, generate (block placement with free rotation), analyze. No flag, no overwrite, no pass. *(Revised 2026-08-04: **flag is in** — see §4.5. Single-click Analyze left the player able to deduce a defect and unable to do anything about it; flag is the verb that acts on the deduction. Overwrite and pass-as-strategy remain omitted.)*
- **Fixed skill.** Exact clues only. No degradation, no persistence, no skill meter in the HUD.
- **One meter:** stakeholder confidence, draining from waiting users.
- **Full arrival forecast** (§6.1) and **departure gating** (§6.2). Both required even here — without the forecast the player cannot budget turns, and without gating the waiting pile-up never reads correctly.
- **Legal placement highlighting** (§4.2). Required once volcanoes exist.
- Canvas board, fully procedural pixel-art rendering with no image assets, particle detonations (§10.8). DOM HUD, working zoom and pan. No accessibility layer (§10.9).

**The question this answers:** is pressing Generate *fun* in the first ten minutes with none of the trap wired up?

Secondary question the level library answers: does play space shape actually change how the game plays, or do all shapes collapse into the same optimal behavior? If the latter, §9.2's variation axes are worth less than assumed and difficulty has to come from cadence alone.

If the primary question is not answered yes, the rest of the design is a lecture with tiles. Do not build §7 or §8.3 until it is.

### Deliberately omitted, and why

| Omitted | Reason |
| --- | --- |
| Skill degradation (§7) | Meaningless across disconnected levels; needs a campaign to land |
| ~~Flag (§4.5)~~ | ~~Its balancing property only matters under real pressure~~ — **reversed 2026-08-04**: with Analyze reduced to one click, a deduction the player cannot act on is not a mechanic. Flag ships. |
| Overwrite (§4.4) | Repair economics are a tuning concern, not a fun concern |
| Multiple endpoints (§9.2.2) | The trunk decision needs a working single path first |
| Regulated zones (§2.3) | Strong feature, but it only pays off once skill regeneration exists |
| Level progression | Cannot curve difficulty before one level is fun |

**The question the prototype answers:** is pressing Generate *fun* in the first ten minutes with none of the trap wired up?

If it is not, the rest of the design is a lecture with tiles. Do not build §7 or §8 until that question is answered yes.

---

## 12. Open questions, consolidated

| # | Question | Section | Recommendation |
| --- | --- | --- | --- |
| 1 | User move cadence: every tick or every N? | §3 | Every tick; parameterize |
| 2 | Analyze: player-targeted or automatic? | §4.3 | Player-targeted |
| 3 | Flag free and uncapped? | §4.5 | Yes; adjust drain, not cap |
| 4 | Stranded users when a path is severed mid-trip | §6.4 | Wait in place, count as waiting |
| 5 | Does Analyze restore skill? | §7.3 | Neutral; test increase later |
| 6 | Skill numeric model and tier thresholds | §7.3 | Smooth scalar |
| 7 | Clue adjacency: 8-way or 4-way? | §7.4 | 8-way; fall back if confusing |
| 8 | Per-level win condition (users served? survive N ticks?) | §8 | Unresolved |
| 9 | Block shape table contents and per-level pools | §4.2 | Start with ~12 hand-authored |
| 10 | Is the block reflectable, or rotation only? | §4.2 | Rotation only; use asymmetric shapes |
| 11 | Do unrevealed untraversed tiles persist between levels? | §9.2.5 | Probably not; too much |
| 12 | Scoring formula | — | Unresolved |
| 13 | Are particles quantized to the art grid, or free subpixel? | §10.8 | Quantized; revisit if the contrast should read louder |
| 14 | Art pixels per tile (8 recommended) and final palette | §10.8 | Lock early; tier thresholds derive from it |

---

## 13. Prior art

Checked, nothing matching found.

- Minesweeper variants with alternate goals are an established subgenre (Hexcells, Polimines, Mamono Sweeper, Runestone Keeper).
- Tile-laying path construction is one of the oldest board game mechanics.
- Shape-placement onto a grid is well covered (Tetris lineage, Dorfromantik, Railroad Ink).
- The theme is heavily covered in essays ("comprehension debt," "cognitive debt," the supervision paradox) but not, as far as can be found, in a game.

The novel element is specifically the resource that buys speed, generates uncertainty, and degrades the player's capacity to resolve that uncertainty. Protect it.