# SLOP SWEEPER — Implementation Plan (first implementation, SPEC §11)

This plan operationalizes `SPEC.md` for the §11 prototype scope: a tuning corpus of hand-authored
levels that answers *"is pressing Generate fun in the first ten minutes?"* and *"does play space
shape change how the game plays?"* The spec remains authoritative for every DECIDED item; where
this plan and the spec disagree on an invariant, the spec wins — except the two explicit
deviations in §1, which are called out precisely so they can be reversed.

Plan date: 2026-08-03. Sections §3 rulings are provisional interpretations where the spec is
silent; they are implementation decisions, not design amendments, and each is flagged for
playtest.

> **Revised 2026-08-03 (user decision):** SPEC §10.1's stack (Vite + TypeScript) is overridden —
> the game is pure JavaScript ES modules with **no build step and no `dist/`**; the
> `slop-sweeper/` folder itself is what deploys, like every other app in this repo. §1.2 records
> the details, and SPEC §10.1/§10.2 carry the matching revision notes.

---

## 1. Deviations from SPEC — deliberate, and why

### 1.1 A `Wait` action is included (§11 says "no pass")

§11 omits pass as a *strategic verb*, and that intent is preserved — waiting is never a good play
mid-build. But the prototype's win condition (§3.3 below) requires ticks to advance after
construction is finished: once the path is complete and users are still walking, the player has
nothing left to build, and every remaining verb would force them to spend turns placing junk
tiles just to watch users arrive. `Wait` also enables the deliberate-detonation tactic SPEC §5
explicitly protects ("let a user walk into it"). It is implemented as reducer action `wait`,
surfaced as a **Wait** button, and reused by the UI's fast-forward (§12.6). If the spec owner
prefers, it can be hidden until the departure gate is open — but it must exist in the reducer.

### 1.2 Pure JavaScript, no build step (user-directed override of SPEC §10.1)

SPEC §10.1 originally specified Vite + TypeScript (DECIDED). Per user decision (2026-08-03),
now recorded in the spec itself, the prototype is
**plain JavaScript ES modules — no compiler, no bundler, no `dist/`**. The `slop-sweeper/`
folder is deployed as-is by GitHub Pages, exactly like every other app in this repository
(gorillas is the precedent: `index.html` + `src/*.js` modules, served raw). What §10.1 was
actually protecting survives intact:

- **Zero runtime dependencies** — now zero dependencies of any kind. Nothing installs, ever.
- **Headless core, injected PRNG, reducer/events split (§10.2)** — none of it needed a compiler.
  `node src/sim/run.js` runs the sim; `node --test` runs the tests; both use only Node built-ins
  (`node:test`, `node:assert`).
- **Types as documentation:** every core file opens with `// @ts-check` and declares its shapes
  as JSDoc `@typedef`s — SPEC §10.2's discriminated unions stay discriminated, and VS Code
  type-checks them with zero toolchain. Exhaustiveness is enforced the JS way: every union
  `switch` ends in a `default:` that throws.
- A three-line `package.json` (`{ "type": "module" }` plus a few convenience scripts) exists only
  so Node treats `.js` as ES modules when running sim/tests. It is a marker, not tooling —
  nothing to install, nothing to build, and the browser never sees it.

---

## 2. Scope restated

Built: 6 hand-authored levels (§9), two endpoints A→B, terrain `OCEAN`/`VOID`/`VOLCANO`, actions
**Place / Generate / Analyze** (+ `Wait`, deviation §1.1), exact clues only, one meter
(stakeholder confidence), full arrival forecast + departure gating, legal-placement highlighting,
fully procedural pixel-art canvas with particle detonations, DOM HUD, semantic zoom + pan,
headless core, Node sim harness with policy bots, solver as instrumentation, and a
level-authoring pipeline — validator, headless check loop, in-game Level Lab (§9.1–§9.2).

Not built (per §11's omission table, plus): flag, overwrite, pass-as-strategy, skill
degradation/meter, multiple endpoints, mid-level requirements, regulated zones, campaign or
progression, level-select *screen* (dropdown + `?level=` param only, as §11 allows), save/load
(refresh restarts the level), audio (spec is silent; keeping the zero-asset property), tutorial,
accessibility layer (§10.9 deferred — but the coordinate-tuple invariant is enforced from day
one).

Full §2.2 construction-state union (including `FLAGGED`) is implemented in types and in the
table-driven passability/buildability predicates, because it costs a few lines and keeps the
schema honest; no prototype action produces the unused states.

---

## 3. Rulings where the spec is silent (all provisional, revisit in playtest)

1. **Analyze that reaches a mined tile → `MINE_CONFIRMED`, no blast.** Review found the defect.
   The alternative (silently skipping mines) leaks perfect information by omission — "the tile
   analysis refused to reveal is a mine" — and `AI_REVEALED` is defined safe (§2.2), so a mined
   tile can never become it. Cost is real: with Overwrite absent, a confirmed mine is a permanent
   wall the player must route around, which makes analyze targeting a weighty choice.
2. **Analyze spread:** from the player-chosen `AI_HIDDEN` target, BFS 4-way across the contiguous
   `AI_HIDDEN` region, revealing up to `ANALYZE_REVEALS` tiles in BFS order (deterministic
   tie-break by cell index). No spill beyond the contiguous region — "you review this module."
3. **Win/loss (resolves OPEN #8 for the prototype only):** win when every scheduled user has
   arrived at B; lose when confidence ≤ 0.
4. **Users caught in a blast:** any user standing inside the destroyed area returns to origin and
   re-queues, exactly like the triggerer. Users elsewhere whose path is severed strand per §6.4.
5. **Clues and per-block badges are always derived live** from the current mine set — silent mine
   destruction (§5) updates them. Required by the never-wrong rule (§7.2), and it is the
   information payoff of burn-it-down. Nothing clue-shaped is ever stored; it is computed.
6. **Per-block mine count = Binomial(size, level.mineDensity)**, rolled from the generation RNG
   stream at commit (after position/rotation are final), mines placed uniformly among block
   cells. Zero is possible — "got away with it" is a legitimate and delightful outcome.
7. **Users stack freely** (no collision); renderer offsets/marks multiples.
8. **Endpoints** are always passable, count as structure for build adjacency, are not buildable,
   and are indestructible (blast skips them).
9. **Departures:** at the start of each movement phase, *all* queued users with an open path
   depart at once (the flush when a path completes is great feedback). Users spawned this tick
   join the queue and gate next tick.
10. **`MINE_CONFIRMED` counts in adjacent clues** while it exists (standard minesweeper flag
    arithmetic); if a blast destroys it, counts drop — consistent with ruling 5.
11. **No confidence regeneration.** A `SERVED_BONUS` constant exists in `rules.js`, default 0, as
    a tuning lever only.
12. **Restart rerolls the seed by default**; `?seed=` pins it for reproduction. Combined with
    determinism (§7.9) this closes the refresh-to-reroll exploit: replaying the same seed replays
    the same block draws and mine rolls.

---

## 4. What we take from `gorillas/` — and what we deliberately don't

All of it re-implemented as slop-sweeper's own plain-JS modules (apps in this repo are
self-contained); nothing is imported across app folders. With the stack override (§1.2) the two
apps now share the exact same stack — raw ES modules behind a static server — so gorillas'
patterns port line-for-line.

**Taken:**

- **Resize discipline** (`gorillas/src/main.js` `resize()` + the per-frame self-heal at
  main.js:286): backing store = `clientSize × devicePixelRatio`, camera told CSS size + dpr
  separately. Slop-sweeper idles between ticks, so the per-frame self-heal becomes a
  *wake-time* self-heal plus listeners: `ResizeObserver` on the container, `visualViewport`
  resize, `orientationchange`, and a re-armed `matchMedia('(resolution: …dppx)')` listener for
  dpr changes (§10.4 requires the dpr case; Safari's pinch/address-bar dances are why the
  self-heal exists at all).
- **Coordinate discipline** (`gorillas/src/camera.js` doctrine): every pointer coordinate routes
  through `camera.screenToWorld`/`screenToCell`; camera is pure view state, nothing in core ever
  reads it. This is verbatim SPEC §10.5's invariant, already proven in gorillas.
- **Pointer robustness** (`gorillas/src/input.js`): `setPointerCapture` wrapped in try/catch
  (synthetic pointers throw), `pointercancel` treated as abort, keyboard handling guarded so DOM
  form fields keep their keys.
- **Event drain wiring** (`game.drainEvents()` → `handleGameEvent` in main.js): the reducer
  returns events; the UI shell drains them to renderer / particles / HUD. Identical to SPEC
  §10.2's event-emission contract.
- **`mulberry32` + xor-split seed streams** (`gorillas/src/rng.js`, and the two-stream trick in
  gorillas PLAN §6): our generation stream and movement stream derive from
  `seed` and `seed ^ 0x9e3779b9`.
- **localStorage try/catch wrapper** for trivia prefs (last level, mute-equivalents later); the
  game must run with storage unavailable.

**Deliberately not taken:** the auto-follow camera (lerp targets, `holdWide`) — slop-sweeper's
camera is gesture-driven; the fixed-aspect letterbox — we letterbox to the *playable bounding
box* (§10.7), not an aspect ratio; the continuous RAF loop — slop-sweeper idles at rest per
§10.8 and wakes on events/gestures; canvas-drawn HUD text — our HUD is DOM; audio.

---

## 5. Architecture & repo layout

```
slop-sweeper/
  SPEC.md  PLAN.md  README.md
  package.json        { "type": "module" } marker + convenience scripts — zero dependencies (§1.2)
  index.html          the page: canvas + DOM HUD skeleton, loads src/ui/main.js as a module
  styles.css          HUD/overlay layout and typography (board is canvas; DOM does text — §10.3)
  src/
    core/             zero deps, zero DOM, pure, injected PRNG        (SPEC §10.2 skeleton)
      state.js        JSDoc typedefs: Terrain, capability table, Con union, GameState, Action, Ev
      rules.js        every tunable constant, one exported config (§8)
      rng.js          mulberry32, stream split
      grid.js         charmap parse, neighbors4/8 (VOID-filtered, precomputed), playable bbox
      shapes.js       curated block table + rotation/normalization
      generate.js     shape draw, legal placement enumeration, mine roll
      solver.js       constraint checker over [lo,hi] clues + live block totals
      routing.js      passability, distance field BFS, departure gate, step choice
      reduce.js       init(level, seed); (state, action) → { state, events[] }; legalActions()
      validate.js     level validator — structural errors/warnings (§9.1)
    levels/
      index.js        registry (id → LevelDef) + field defaults + named shape pools
      README.md       authoring guide: legend, invariants, defaults, worked example — written
                      to be handed to an AI as complete context (§9.1)
      plain.js channel.js atoll.js caldera.js strait.js sprawl.js
    sim/
      policies.js     policy bots (§13)
      batch.js        pure runGames() — imported by the Node CLI and the browser Lab alike
      run.js          Node CLI over batch.js → results table (node src/sim/run.js …)
      validate.js     Node CLI: validate one or all registered levels (§9.1)
      hash.js         stable state hash for determinism tests
    ui/
      main.js         boot, wiring, level/seed params, event drain, wake/idle loop
      camera.js       artPx zoom, pan, tiers, transforms, clamps, fit()
      input.js        pointer/gesture → select/pan/zoom/ghost intents (never touches state)
      renderer.js     atlas-backed drawing, viewport static cache, dirty tracking
      atlas.js        per-artPx tile variant baking into offscreen canvas
      font.js         3×5 procedural bitmap font: 0-9 + -
      particles.js    detonation debris, shake, dissolve — view-only
      hud.js          DOM meters, forecast, action bar, block tray, minimap, banners
      lab.js          Level Lab overlay: paste → validate → play → quick-sim → export (§9.2)
      palette.js      the 16 colors (§11.1)
  test/               *.test.js — node:test + node:assert, run with `node --test`
```

**Dependency law:** `core` imports only `core`. `levels` import core. `sim` imports core +
levels. `ui` imports core + levels, plus sim's pure modules (`policies.js`, `batch.js`) for the
Lab's quick-sim (§9.2) — everything Node-specific in sim stays confined to the `run.js` /
`validate.js` CLIs, so the graph is acyclic and browser-safe. Nothing imports `ui`. Enforcement
is practical: the tests
and `node src/sim/run.js` execute core in Node, where no DOM exists — if a DOM global sneaks
into core, the sim breaks immediately.

**Language/tooling:** modern browser-native JavaScript (ES2022), no compile target to manage.
Core modules carry `// @ts-check` + JSDoc typedefs (§1.2) so the frozen shapes in §6 stay
editor-enforced. No bundler and no minification — ~25 small modules over HTTP/2 is nothing, and
unminified source matches the rest of this site. Node ≥ 20 for sim/tests (dev-only; players need
only a browser). The no-asset rule (§10.8) is now trivially auditable: the folder simply
contains no image or audio files.

**Deployment:** there is none. The folder is the app; merging publishes it at `/slop-sweeper/`.

---

## 6. Core model — frozen shapes

Cells are indices (`i = y * w + x`); the §10.9 tuple `(cellX, cellY, actionType, rotation?)` is
carried as `{ t, cell, rot? }` with the index encoding x/y. **No reducer action ever contains a
pointer event, pixel coordinate, or DOM reference.**

Shapes below are written in compact type notation for the plan's readability; in code each one
is a JSDoc `@typedef` in `core/state.js` (`levels/index.js` for `LevelDef`), checked in-editor
via `// @ts-check` (§1.2). The translation is mechanical; the shapes, not the syntax, are what
is frozen.

```ts
// core/state.js — notation shorthand for the JSDoc typedefs
export type Terrain = 'ocean' | 'void' | 'volcano'
export interface TerrainCaps {
  handBuildable: boolean; generatable: boolean; passable: boolean
  knownEmpty: boolean; blastStops: boolean            // §2.1 table + blast column (§5)
}
export const TERRAIN: Record<Terrain, TerrainCaps>    // adding a feature = adding a row

export type Con =                                     // §2.2, complete (flagged unused for now)
  | { k: 'none' }
  | { k: 'hand' }
  | { k: 'aiHidden'; mine: boolean; block: number }
  | { k: 'aiRevealed'; block: number }
  | { k: 'flagged' }
  | { k: 'mineConfirmed'; block: number }

export interface User {
  id: number; at: number
  state: 'queued' | 'moving' | 'arrived'
  visited: number[]                                   // current-trip no-revisit set (§6.3)
  stalled: boolean                                    // no legal move this tick → counts waiting
}

export interface GameState {
  level: string; seed: number; tick: number
  w: number; h: number
  terrain: Terrain[]; con: Con[]                      // dense, parallel, row-major
  bbox: { x0: number; y0: number; x1: number; y1: number }   // playable bbox (§10.7)
  origin: number; dest: number
  blocks: { id: number; cells: number[] }[]           // live cells; badge counts derived
  users: User[]
  schedule: { total: number; spawned: number; nextTick: number; every: number }
  confidence: number
  phase:
    | { k: 'play' }
    | { k: 'placing'; shape: number; rots: RotAnchors[] }    // legal anchors per rotation
    | { k: 'won' } | { k: 'lost' }
  rng: { gen: number; move: number }                  // mulberry32 states (§7.5)
  stats: { placed: number; generated: number; analyzed: number; waited: number
           detonations: number; served: number }
}

export type Action =
  | { t: 'place'; cell: number }
  | { t: 'generate' }
  | { t: 'placeBlock'; cell: number; rot: 0 | 1 | 2 | 3 }
  | { t: 'analyze'; cell: number }
  | { t: 'wait' }

export type Ev =
  | { t: 'rejected'; reason: string }                 // reducer guards; UI should never trigger
  | { t: 'blockDrawn'; shape: number; rots: RotAnchors[] }
  | { t: 'generateRefunded' }                         // §4.2: empty legal set, turn not consumed
  | { t: 'placed'; cells: number[] }                  // hand tile or committed block cells
  | { t: 'blockPlaced'; block: number; cells: number[]; mines: number }  // count → toast
  | { t: 'analyzed'; revealed: number[]; minesFound: number[] }
  | { t: 'reveal'; cell: number }                     // traversal reveal (§5)
  | { t: 'detonate'; at: number; destroyed: number[]; minesLost: number[] }
  | { t: 'step'; user: number; from: number; to: number }
  | { t: 'departed'; user: number } | { t: 'arrived'; user: number }
  | { t: 'spawned'; user: number } | { t: 'requeued'; user: number }
  | { t: 'confidence'; delta: number; reason: 'waiting' | 'detonation' }
  | { t: 'won' } | { t: 'lost' }
```

Information discipline: `detonate.minesLost` exists for the sim's metrics; the renderer must
never visualize which destroyed cells held mines (§5: destroyed silently).

```ts
// module signatures (frozen; notation shorthand — implemented with JSDoc in the .js files)
// core/grid.js
parseMap(text: string): { w; h; terrain; origin; dest; bbox }
n4(g, i): number[]; n8(g, i): number[]      // precomputed at init, VOID filtered — THE accessor (§10.7)
// core/rng.js
mulberry32(seed): () => number
// core/shapes.js
SHAPES: { id: string; cells: [dx, dy][] }[]           // ~12 stencils (§10)
rotationsOf(shapeIdx): [dx, dy][][]                    // normalized, deduped (symmetry)
// core/generate.js
legalPlacements(s, shapeIdx): RotAnchors[]             // computed BEFORE the turn commits (§4.2)
// core/routing.js
passable(s, i): boolean
distField(s): Int32Array                               // BFS from dest over passable
gateOpen(s): boolean                                   // dist[origin] finite (§6.2)
// core/reduce.js
init(level: LevelDef, seed: number): GameState
reduce(s, a: Action): { s: GameState; ev: Ev[] }       // pure; clones what it changes
legalActions(s, cell?: number): ActionKind[]           // single source for the action bar (§10.6)
clue(s, i): { lo: number; hi: number }                 // exact tier ⇒ lo === hi; derived live
blastArea(s, i): number[]                              // flood fill; also drives selection preview
// core/solver.js
solve(s): { safe: number[]; mines: number[]; unknown: number[]; guessForced: boolean; bailed: boolean }
// core/validate.js
validateLevel(def: LevelDef): { errors: string[]; warnings: string[] }   // §9.1; init() throws on errors
// sim/batch.js
runGames(def, policy, n, seed): BatchStats             // pure, env-agnostic; Lab quick-sim uses it (§9.2)
// sim/hash.js
hashState(s): string                                   // stable serialization → FNV-1a
```

Level definition (a JSDoc `@typedef` in `levels/index.js`):

```ts
export interface LevelDef {
  id: string              // with map, the only required field (§9.1)
  name?: string           // default: id
  map: string             // charmap: '.'/space VOID · '#' OCEAN · '^' VOLCANO · 'A' origin · 'B' dest
                          // rows right-padded with VOID — trailing whitespace can never break a level
  arrivals?: { count: number; firstTick: number; every: number }   // default 10 / 6 / 4
  mineDensity?: number    // Binomial p per block cell (§3.6); default 0.25
  shapePool?: 'compact' | 'awkward' | 'heavy' | string[]           // preset name or ids (§10); default 'compact'
  analyzeReveals?: number // default rules.ANALYZE_REVEALS
  userMoveEvery?: number  // default 1 (OPEN #1: parameterized)
  blastRadius?: number    // default 1 = tile + orthogonals (§5)
}
```

---

## 7. Key algorithms

### 7.1 Tick pipeline (inside `reduce`, deterministic order)

A turn-consuming action (`place`, `placeBlock`, `analyze`, `wait`) runs this pipeline;
`generate` alone does not (the turn charges at `placeBlock`; an empty legal set refunds — no
tick, `generateRefunded` event, phase unchanged):

1. Apply the player action (board mutation, mine roll, analyze reveals).
2. **Departures:** all queued users with `gateOpen` path become `moving` (§3.9).
3. **Movement:** compute `distField` once; step each moving user in id order — to a passable
   4-neighbor with strictly smaller distance, not in `visited`, random tie-break from the move
   stream; else `stalled = true`, wait in place (§6.3). If a detonation occurred earlier in this
   tick's resolution, the field is recomputed before remaining users step.
4. **Traversal resolution:** collect cells now occupied where `con` is `aiHidden`, process in
   cell-index order: reveal (→ `aiRevealed`) or detonate. A detonation flood-fills `blastRadius`
   steps from the trigger cell through terrain whose caps allow blast (`VOLCANO` and `VOID` stop
   it by the same table lookup — no special case, per §5/§10.7), reverts destroyed construction
   to open water, silently deletes mines in the area (no chains), returns in-area users to the
   queue, applies `DETONATE_HIT`. Cells already destroyed this tick are skipped.
5. **Stranding check:** moving users with no remaining path simply stay `moving`; they will
   stall each tick and count as waiting (§6.4) — no extra state needed.
6. **Spawns:** schedule due → new queued users (they gate next tick).
7. **Meters:** `confidence −= WAIT_DRAIN_PER_USER × waitingCount`, where waiting = queued +
   stalled-this-tick (§6.4 counts all three cases identically); then win/lose check (§3.3).
8. `tick++`.

### 7.2 Placement legality (§4.2)

For each unique rotation, for each anchor: every block cell must land on generatable terrain
(`TERRAIN[t].generatable`) with `con.k === 'none'`, and at least one block cell must be
4-adjacent to structure (endpoint, `hand`, `aiRevealed`, **or `aiHidden`** — generation may
branch from slop; hand placement may not, §4.1). VOID rejection falls out of the capability
table — verified by test, never special-cased (§10.7). Worst case ~1600 cells × 8 block cells ×
4 rotations ≈ 50k checks; enumerate eagerly at draw time, store in `phase.placing.rots`, and the
UI highlights anchors per rotation directly from that data.

### 7.3 Clues (§7.2/§7.4/§7.5)

`clue(s, i)` counts mines in the 8-neighborhood: mines exist only in `aiHidden` cells and
`mineConfirmed` cells (§3.10); everything else — ocean, void, volcano, hand, revealed,
endpoints — contributes zero (§7.5). Always computed from current state (§3.5). Display
formatting lives in the renderer: `lo === hi → "3"`, else `"2-3"` / `"2+"` — the [lo,hi]
plumbing and the `+`/`-` glyphs ship now so skill tiers are purely additive later.

### 7.4 Solver (§10.2)

Constraints: each revealed clue is `lo ≤ Σ(mines in its hidden 8-neighbors) ≤ hi`; each live
block contributes an exact total over its remaining hidden cells; known-empty cells are excluded
by construction (the solver never enumerates over a rectangle — it enumerates over `aiHidden`
cells only, which handles coastlines for free). Split the constraint graph into independent
components; enumerate each (≤ 2^24 states, else mark the component `bailed`/unknown — metrics
only, never gameplay). A cell is safe iff no consistent assignment mines it; a board state is
`guessForced` iff users must cross cells that are neither provably safe nor avoidable. Used by
tests and the sim; not surfaced in-game in the prototype.

### 7.5 RNG streams

`gen` stream (shape draws, mine rolls) = `mulberry32(seed)`; `move` stream (routing tie-breaks)
= `mulberry32(seed ^ 0x9e3779b9)` — gorillas' two-stream trick, so replay and variance-reduction
work and cosmetic randomness can never perturb the sim. View-layer effects (particles, shake)
use `Math.random` freely; they never touch core.

Determinism contract: `init(level, seed)` + identical action sequence ⇒ identical `hashState`
at every tick. This is a standing test.

---

## 8. `rules.js` starting constants

Every number below is a starting point for the sim to tune (§13) — none is sacred except the
structural ones marked SPEC.

| Constant | Start | Note |
| --- | --- | --- |
| `CONFIDENCE_START` | 100 | |
| `WAIT_DRAIN_PER_USER` | 0.5 /user/tick | continuous + scales with count (SPEC §8.2) |
| `DETONATE_HIT` | 10 | |
| `SERVED_BONUS` | 0 | tuning lever only (§3.11) |
| `BLAST_RADIUS` | 1 | tile + orthogonals (SPEC §5 baseline); per-level override |
| `ANALYZE_REVEALS` | 4 | per-level override |
| `USER_MOVE_EVERY` | 1 | per-level override (OPEN #1) |
| `ART_PX_PER_TILE` | 8 | SPEC §10.8 recommended |
| `FONT_MIN_DEVICE_PX` | 10 | glyph legibility floor; **tiers derive from this** (SPEC §10.8) |
| `ZOOM_MAX_ARTPX` | 12 | tile ≤ 96 device px |
| `TAP_SLOP_CSS` / `TAP_MS` | 6 px / 250 ms | tap-vs-drag disambiguation |
| `STEP_TWEEN_MS` | 120 | user step animation (view only) |
| `FF_INTERVAL_MS` | 180 | fast-forward wait cadence (view only) |

---

## 9. Level roster (the corpus)

Authored as charmaps in `src/levels/*.js` (SPEC §10.7 legend). Sizes deliberately modest —
40×40 is the performance ceiling, not the target. Arrival numbers are sim-tuning seeds.

| id | size | shape intent | arrivals (count / first / every) | density | pool | what it tests |
| --- | --- | --- | --- | --- | --- | --- |
| `plain` | 16×11 | open rectangle, control | 8 / 6 / 5 | .22 | compact | baseline; generous solve; the fun question in its purest form |
| `channel` | 22×9 | diagonal 4-wide channel, VOID-heavy | 10 / 6 / 4 | .22 | compact+ | coast anchors everywhere (§7.5: easier deduction, tighter routing) |
| `atoll` | 18×14 | ring of islets, inner lagoon | 10 / 6 / 4 | .25 | awkward | placement scarcity; exercises the refund path (§4.2) |
| `caldera` | 20×14 | central volcano cluster | 12 / 6 / 4 | .28 | compact+awkward | blast shields (§5) vs. reduced legal placements — the two opposing pulls |
| `strait` | 24×12 | two basins, 2-wide neck | 12 / 5 / 3 | .25 | awkward | chokepoint trunk risk; deliberate-detonation temptation |
| `sprawl` | 26×16 | open water, far endpoints | 16 / 5 / 3 | .30 | awkward+heavy | anchor-poor middle; cadence pressure ceiling — where the §1 thesis bites |

### 9.1 Authoring pipeline — new levels must be cheap, for humans and AI alike

(User requirement, 2026-08-03.) A new level is **one file plus one registry line**, and every
step of the authoring loop runs headless, so an AI assistant can draft a level, check it, and
tune it end-to-end before a human ever plays it.

- **Minimal surface.** `{ id, map }` is a complete, playable level: `name` defaults to the id;
  arrivals, mine density, shape pool, analyze count, move cadence, and blast radius all default
  from `rules.js`. Level files state only what deviates. Pools are named presets (`'compact'`,
  `'awkward'`, `'heavy'`) or explicit shape-id arrays (§10).
- **Forgiving charmap.** Space is an alias of `.` (VOID), and rows are right-padded to the
  widest row — invisible trailing whitespace, the classic defect of generated ASCII maps, can
  never break a level. Any *other* unknown character is a hard error naming its row and column.
- **Validator in core** (`core/validate.js`). `validateLevel(def)` returns
  `{ errors, warnings }`. Errors (level refuses to load; `init()` throws): unknown map
  character, not exactly one `A` / one `B`, an endpoint with zero buildable neighbors, no
  ocean connectivity from A to B (unwinnable by construction), board over 40×40, nonsense
  schedule/density/pool. Warnings: degenerate path length, landlocked terrain fragments,
  density outside the tuned range. The validator is deliberately **structural only** — whether
  a level is *good* is the sim's job (§13). Stating the division here so the validator never
  grows into a designer.
- **Three headless one-liners close the loop**, each runnable by an assistant:
  `node src/sim/validate.js [id]` (structure), `node src/sim/run.js --level id --all`
  (winnable? by whom? how hard?), and `node --test` (a standing test validates every registered
  level, so a broken level fails the suite immediately).
- **`src/levels/README.md` is the authoring guide**: the legend, the invariants, every LevelDef
  field with its default, the design axes in brief (coastline eases deduction — SPEC §7.5;
  cadence raises the floor and chokepoints concentrate risk — SPEC §9.2), and one worked
  example. It is written to be handed to an AI as complete context for "make me a level like
  `strait`, but meaner."

### 9.2 Level Lab — paste-to-play

A dev overlay on the playable game, opened with `?lab=1`: a textarea for the charmap, fields
for the handful of numbers, a pool picker. **Validate** shows validator output inline. **Play**
boots the pasted definition with the current seed. **Quick-sim** runs `sim/batch.js` right in
the browser (≈50 games × 2 policies in a few seconds — a direct payoff of the DOM-free core)
and prints win rates. **Export** copies a finished `levels/<id>.js` module plus its one-line
registry entry to the clipboard. The draft persists in localStorage (try/catch wrapper, §4).
The authoring loop becomes: paste an AI-drafted map → validate → play it → quick-sim it →
freeze it to a file. Pure DOM overlay; core never knows the Lab exists.

---

## 10. Shapes (initial 12 — OPEN #9's recommendation)

Rotation only, no reflection (OPEN #10); asymmetric shapes do the work. Normalization dedupes
symmetric rotations. Stencils (`X` = cell):

| id | stencil | id | stencil | id | stencil |
| --- | --- | --- | --- | --- | --- |
| `O4` | `XX / XX` | `P5` | `XX / XX / X.` | `F5` | `.XX / XX. / .X.` |
| `L4` | `X. / X. / XX` | `W5` | `X.. / XX. / .XX` | `O6` | `XXX / XXX` |
| `S4` | `.XX / XX.` | `U5` | `X.X / XXX` | `L6` | `XXXX / XX..` |
| `T4` | `XXX / .X.` | `Z5` | `XX. / .X. / .XX` | `D8` | `XXX / XXX / XX.` |

Pools: **compact** {O4, L4, T4, P5, O6} · **awkward** {S4, W5, U5, Z5, F5} · **heavy** {L6, D8}.
Sizes 4–8, chunky, per §4.2 (thin tendrils destroy deduction).

---

## 11. Rendering

### 11.1 Palette (16 — lock early per OPEN #14; starting values, tunable until locked)

| Role | Hex | Role | Hex |
| --- | --- | --- | --- |
| INK (outlines, clue text) | `#16131c` | AI hidden | `#6b4d93` |
| PAPER (light text/UI) | `#f2efe4` | AI hidden dither | `#57407a` |
| VOID background | `#0d1016` | AI revealed | `#a08cc0` |
| Ocean | `#14324f` | Volcano rock | `#4a4650` |
| Ocean dither | `#1a4066` | RED (endpoints, mines, invalid, lava speckle) | `#d4405c` |
| Coastline stroke | `#e8dcc0` | USER | `#ffd23e` |
| Hand tile | `#c98f3f` | SELECT accent | `#55d6ff` |
| Hand dither | `#7d5a26` | OK accent (legal anchors, valid ghost) | `#4ade80` |

No alpha in world rendering: tint overlays (ghost valid/invalid, legal anchors, blast preview)
are drawn as checkerboard dither of the accent color — 50% coverage without blending, on-style.

### 11.2 Art grid & atlas (§10.8)

Art pixel size in **device px is a positive integer**: `artPx = max(1, round(cssArtPx × dpr))`.
Tile = 8 artPx. On load and on every artPx change, bake all tile variants once into an offscreen
atlas: ocean (with `(x,y,seed)`-hashed dither so texture is a pure function of coordinates —
never re-randomized, no crawl on pan), volcano speckle, hand, aiHidden, aiRevealed (clue digits
composited per value), mineConfirmed, endpoints, coastline edge pieces. World drawing is atlas
blits at integer device offsets; pan offset is quantized to whole device px so every fillRect
stays crisp. `imageSmoothingEnabled = false` on all contexts. Block boundaries (edges between
differing `block` ids) are stroked in a pass over the static layer — state-dependent, so not
atlas-baked, but only redrawn on state change.

### 11.3 Zoom tiers — derived, not tuned (§10.5 + §10.8)

Glyphs are 3×5 art px. Mid tier requires `5 × artPx ≥ FONT_MIN_DEVICE_PX` ⇒ **far: artPx 1 ·
mid: artPx 2–3 · near: artPx ≥ 4**. Both thresholds come from the one constant, as the spec
demands. Content: far = flat fills, endpoints, user dots, block boundaries (topology view);
mid = + clue digits, thin borders; near = + per-block mine badges (live counts, §3.5) at block
centroids, fatter selection. `fit()` picks the largest integer artPx whose board bbox fits the
container, letterboxes the remainder, and is the zoom floor; ceiling `ZOOM_MAX_ARTPX`.

### 11.4 Frame model — idle at rest (§10.8)

No continuous RAF. A viewport-sized offscreen **static cache** holds the composited world;
invalidated by state change, camera change, or artPx change (memory stays flat — it's
screen-sized, never board-sized). The RAF loop runs only while step tweens, particles, shake,
rubber-band, or an active gesture are alive, drawing static cache + dynamic layer; then it
sleeps. Wake sources: reducer events, pointer activity, resize. The wake path re-verifies the
canvas backing store (gorillas' self-heal, §4).

### 11.5 Users

Dots (1–3 art px) tweened over `STEP_TWEEN_MS` from `step` events; stacks render a count pip at
mid/near tiers. Queued users render as a pile at the origin — the "you have not shipped" signal
(§6.2) must read at every tier.

### 11.6 Particles & detonation (§10.8)

The signature moment, budgeted accordingly: screen shake (integer device px offsets, decaying),
per-destroyed-cell dissolve (staged dither-out over ~300 ms), debris particles simulated in
floating point, rendered quantized to the art grid (OPEN #13 default), fading by palette-entry
switching, killed on entering a blast-stopping cell so debris never crosses a volcano (§10.8:
if the mechanic stops blasts, the visual must too). Reveal ticks get a two-frame flip; arrivals
a small pop at B. All purely event-driven view state.

### 11.7 Minimap

Small canvas inside the DOM HUD: whole board at 1–2 px/cell + viewport rectangle; redrawn on
state/camera change; tap-to-jump pans the camera.

### 11.8 HUD (DOM does layout and text — §10.3)

Top bar: level dropdown, seed (tap to copy), tick counter, confidence bar, and the forecast trio
— users remaining / ticks to next arrival / currently waiting — persistent, per §6.1 (not
optional polish). Bottom: contextual action bar fed **only** by `legalActions()` so the UI can
never disagree with the reducer, with turn costs shown; global Generate button; Wait button.
Block tray (during `placing`): the drawn shape at fixed CSS size — legible regardless of board
zoom (§10.6) — rotate button (+ `R`), confirm button, and the "introduced N defects" toast on
commit. Banners: won / lost / generate-refunded. End screen shows stats (ticks, verbs used,
detonations, served). The Level Lab (§9.2) rides this same DOM overlay layer, gated behind
`?lab=1`.

---

## 12. Input & camera

1. **Two-step select→act everywhere** (§10.6). Tap = pointer up within `TAP_SLOP_CSS` and
   `TAP_MS`; selects the cell, action bar updates. Nothing on the board ever spends a turn
   directly; only action-bar taps do. This kills the tap-vs-pan misfire class by construction.
2. **Gestures:** one pointer drag = pan; two pointers = pinch (zoom anchored at the gesture
   midpoint — non-negotiable, §10.5 — with simultaneous midpoint pan); wheel and ctrl+wheel
   (trackpad pinch) = zoom anchored at cursor. Pointers tracked in a Map; `touch-action: none`
   on the board container; viewport meta pins page zoom. Pointer capture per gorillas (§4).
3. **Zoom snapping:** continuous pinch ratio maps to integer artPx with hysteresis (switch at
   ±0.6 toward the next integer) so tier/scale changes don't flicker at boundaries. Pan clamps
   to the playable bbox with rubber-banding on overscroll, springing back on release.
4. **Block placement flow** (§10.6): Generate → tray shows shape → legal anchors for the current
   rotation highlighted on the board (from `phase.placing.rots` — the player never hunts for
   fits, §4.2) → tap moves the ghost (snap; OK/RED dither tint for valid/invalid) → rotate
   freely → Confirm commits and spends the turn. Pan/zoom stay live throughout. There is no
   cancel — no decline is a state-machine property, not a UI courtesy.
5. **Selection previews** (§10.6): selecting a `mineConfirmed` cell overlays `blastArea()`;
   selecting during `placing` moves the ghost.
6. **Fast-forward:** once the gate is open and the player chooses to watch, a Run toggle issues
   `wait` every `FF_INTERVAL_MS`; any detonation, strand, win/loss, or user input stops it.
   Pure UI sugar over the same reducer action (§1.1).
7. **Keyboard (dev convenience, not the a11y layer):** R rotate, Enter confirm, Esc deselect,
   +/- zoom, arrows pan. The §10.9 invariant holds regardless: input produces coordinate tuples.

---

## 13. Sim harness & tuning protocol

`node src/sim/run.js --level caldera --policy balanced:0.5 --games 200 --seed 1` (`npm run sim`
is a convenience alias) → console/markdown table; `--all` sweeps levels × policies. The runner
is layered: `sim/batch.js` exposes a pure `runGames()` that the Node CLI and the Level Lab's
in-browser quick-sim (§9.2) both import; `run.js` is only argument parsing and table formatting
around it. Metrics per run set: win %, median ticks, mean final
confidence, detonations/game, waiting-tick integral, verb counts, and solver-instrumented
`guessForced` incidence (the "was deduction ever impossible" flag, §10.2's larger payoff).

Policies (legal information only — no mine peeking):

- `handOnly` — hand-build a shortest completion path; wait when done. Measures each level's
  hand-only viability (the floor's existence, §8.3).
- `genRush` — generate whenever legal, coverage-greedy ghost placement; never analyze.
- `balanced(p)` — generate with probability p, else hand-place toward B; analyze on a fixed
  cadence.
- `careful(p)` — balanced, but analyzes every fresh block before advancing past it.
- Ghost placement sub-strategies: **coverage-greedy** vs **edge-hugging** (prefer anchors
  touching coastline/known tiles). The delta between them is a direct measurement of the §1
  thesis — legible placement should out-survive greedy placement.

Provisional tuning gates (adjust constants, cadence, density until):

| Gate | Target |
| --- | --- |
| `plain`: `balanced(0.4)` win rate | ≥ 70% |
| `sprawl`/`strait`: `handOnly` win rate | low — the floor is real |
| `genRush` vs `balanced` on `caldera`/`strait` | genRush loses more, via detonations |
| edge-hugging vs coverage-greedy | measurable survival gap somewhere in the corpus |
| median winning game length | 35–70 ticks (a 5–10 minute session) |
| winning-game final confidence | frequently 10–40% — near-misses are the drama |

Determinism replay (same seed + action log ⇒ identical per-tick hashes) runs as a standing
`node --test` case, not a gate.

---

## 14. Build order & gates

1. **M0 — scaffold.** `index.html` + `styles.css` shell, the three-line `package.json` marker,
   README (serve locally with any static server; no build, no install), `rules.js`, `rng.js`,
   `state.js` typedefs + `TERRAIN` table, one `node --test` smoke test passing.
2. **M1 — walking skeleton (core).** `grid.js` (charmap parse, neighbors, bbox) + `reduce` with
   `place`/`wait`, users (spawn, gate, movement), meters, win/loss. Tests green. *Gate: a
   scripted hand-only game of `plain` completes headless in Node.*
3. **M2 — the whole verb set + instrumentation.** `shapes`, `generate` (draw / legal set /
   refund / mine roll), `analyze`, traversal reveal/detonate with flood-fill blast, live clues,
   `solver`, determinism hash, sim harness + policies, the level validator with its
   `sim/validate.js` CLI and all-levels standing test, all six levels authored. **First tuning
   pass happens here, before any UI exists** — the spec is explicit that the economy cannot be
   tuned by playing it (§10.2). *Gate: sim table produced; tuning gates from §13 roughly met.*
4. **M3 — playable.** `palette`/`font`/`atlas`/`renderer` static path, camera (fit, zoom, pan,
   tiers), input (select→act, gestures), HUD (forecast, confidence, action bar, block tray,
   minimap, banners), level/seed params. *Gate: full game playable mouse + touch.*
5. **M4 — the juice.** Step tweens, detonation (shake, dissolve, debris, volcano occlusion),
   reveal flips, fast-forward, end-screen stats, and the Level Lab (§9.2) — the full UI now
   exists for it to reuse.
6. **M5 — device pass & ship.** iOS Safari, Android Chrome, desktop Chrome/Firefox/Safari:
   pinch anchoring, dpr changes mid-session, address-bar resize, `visualViewport` self-heal,
   idle-CPU check (0% at rest). Nothing to build — merging the folder is the ship. *Gate:
   acceptance checklist (§15).*

---

## 15. Acceptance checklist (spec-mapped)

- [ ] §2.1 capability table drives buildable/generatable/passable/known-empty/blast — adding a
      terrain row requires no logic edits (test adds a fake feature row)
- [ ] §3 exactly one turn-consuming action per tick; ticks never advance otherwise
- [ ] §4.1 hand placement cannot branch from `aiHidden` (test) — and the action bar teaches it
      by absence
- [ ] §4.2 no preview / no decline / no reroll are state-machine properties (test: during
      `placing`, only `placeBlock` is legal)
- [ ] §4.2 empty legal set ⇒ refund, no tick, notice shown (test + UI)
- [ ] §4.2 legal anchors highlighted per rotation; mine-count toast on commit
- [ ] §5 blast flood fill stops at `VOLCANO` and `VOID` via the same table path — no
      special-case (tests); `HAND` tiles destroyed; no chains; in-area users requeue; others
      strand (§6.4)
- [ ] §5 silent mine destruction updates clues and block badges (test — never-wrong rule §7.2)
- [ ] §6.1 forecast trio persistent in HUD
- [ ] §6.2 gate is topological, not safe: a user departs into a mined corridor (test)
- [ ] §6.3 movement: monotone toward dest, seeded random tie-break, no revisit, stall-in-place
      (tests)
- [ ] §7.4 clues count 8-way; movement is 4-way
- [ ] §7.5 ocean/void/volcano/hand/revealed all count zero (test)
- [ ] §10.2 core never touches DOM globals (`node src/sim/run.js` is the proof); no gameplay
      question is ever answered by reading pixels (grep: no `getImageData` outside
      particles/tests)
- [ ] §10.4 backing store = css × dpr; resize + dpr-change + visualViewport self-heal
- [ ] §10.5 pinch anchored at gesture midpoint; pan clamped to playable bbox with rubber-band;
      camera state never serialized
- [ ] §10.7 no `for y/for x`-as-playable iteration; all neighbor access via `n4`/`n8`;
      fit-to-screen uses playable bbox (code review + `caldera`/`channel` exercise it)
- [ ] §10.8 integer artPx always; per-cell texture seeded by (x,y,seed) — pan shows zero
      shimmer; fades switch palette entries; debris respects volcano occlusion; renderer idles
      at 0% between ticks
- [ ] §10.9 every reducer action is a cell/rotation tuple (JSDoc-typed; review and tests
      enforce it)
- [ ] §11 six levels load by dropdown + `?level=`; `?seed=` reproduces a game exactly
      (determinism test)
- [ ] Authoring (§9.1): `{ id, map }` alone is playable; a new level is one file + one registry
      line; the standing test validates every registered level
- [ ] Level Lab (§9.2): paste → validate → play → quick-sim → export yields a working
      `levels/*.js` file
- [ ] §1 "Do not" list: no AI-abstinence path (arrival cadence makes handOnly lose where
      intended), break-even never displayed, clues never wrong, no block preview/decline

---

## 16. Risks & notes

- **ES modules require HTTP.** `file://` won't load modules; any static server works for local
  dev (`python -m http.server`, VS Code Live Server). The deploy target — GitHub Pages — is
  fine. Same note as gorillas' plan.
- **Types without TypeScript.** Reducer/solver correctness leans on `// @ts-check` + JSDoc,
  throwing `default:` arms on union switches, the unit tests, and the determinism hash. Adequate
  for ~25 small modules, but drift is quieter than it would be under a compiler — review changes
  with §6's frozen shapes open.
- **iOS Safari gestures.** `touch-action: none` + Pointer Events covers pinch, but Safari's
  `gesturestart` page-zoom and double-tap zoom need explicit `preventDefault`, and the
  visualViewport self-heal (§4) is load-bearing there. Budget real device time in M5.
- **Integer-artPx zoom coarseness.** At low artPx the steps are big (8→16 device px per tile is
  2×). Hysteresis + snap animation should mask it. If pinch still feels notchy, the candidate
  fix is non-integer scale *during the active gesture only*, snapping to integer on release —
  every rest state stays crisp. That bends §10.8's stated rule, so it ships only with spec-owner
  sign-off; flagged rather than pre-authorized.
- **Solver blowup.** Merged frontiers across many adjacent blocks can exceed enumeration budget;
  component splitting + the `bailed` marker keep it metrics-safe. The solver is never on the
  gameplay path in this prototype, so worst case is a less-instrumented sim run.
- **Tuning risk is front-loaded by design.** M2 puts the sim before the UI, per the spec. If the
  §13 gates can't be met by tuning constants, that is a design finding about §11's primary
  question, not a schedule slip — surface it, don't polish past it.
- **Node version.** Sim and tests want Node ≥ 20 (`node:test`). Dev-only — players need nothing
  but a browser.
- **No saves is a feature here.** Levels are 5–10 minutes; refresh restarts with a fresh seed
  (§3.12 closes the reroll exploit). Persisting mid-game state would drag camera/phase
  serialization questions into the prototype for no tuning value.
