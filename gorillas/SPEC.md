# Gorillas — Technical Specification

A browser recreation of QBasic `GORILLA.BAS` with a wide destructible city and a dynamic camera.
No backend. No framework. No build step. Two players locally, or one player vs. AI.

This document is the authoritative source for implementation. Where it states an **Invariant**, that
rule is load-bearing: violating it will break determinism, AI correctness, the camera, or the feel of
the original. Where it states a constant as `TUNABLE`, the value is a starting point and may be
adjusted, but the *relationship* it derives from must be preserved.

---

## 1. Scope

### In scope

- Turn-based artillery duel: two gorillas on a city skyline throw explosive bananas by angle + power.
- Gravity and wind (wind is horizontal acceleration, as in the original).
- Pixel-precise destructible buildings. Holes accumulate; bananas fly through gaps.
- A world several arena-widths wide. Buildings outside the default framing take real damage.
- A camera that fits the action, widening as the banana climbs and closing back in as it falls.
- Local 2-player hotseat, and 1-player vs. an AI with difficulty levels.
- Mouse, touch, and keyboard input.

### Non-goals — do not implement

- No server, no networking, no multiplayer over the wire.
- **No framework, no bundler, no build step, no `npm install`, no transpilation.** (§2)
- **No time dilation / slow-motion.** Time runs at 1× always.
- **No structural physics.** Buildings never collapse, settle, topple, or shed debris that matters.
  (§3 Invariant 6, §7.3 — this is the single most likely unwanted "improvement.")
- No vector or polygon-boolean terrain. Terrain destruction is raster. (§7)
- No sprite atlases, image files, audio files, fonts, or any external asset. All art is drawn
  procedurally at runtime. (§2.2)
- No physics engine dependency. The integrator is ~20 lines; write it. (§8)

---

## 2. Delivery: pure HTML/CSS/JS, no build

### 2.1 Hard requirements

- The shipped tree is exactly what the browser loads. Nothing is compiled, bundled, minified,
  transpiled, or generated ahead of time.
- No React/Vue/Svelte/etc. No jQuery. No physics or game library. No CDN `<script>` tags. **Zero
  third-party runtime code.**
- No `package.json`, no `node_modules`, no dev server config, no Vite/webpack/esbuild/Parcel.
- Plain ES2022 that ships to browsers as-authored.
- Deployment target is a static HTTPS host. The build pipeline is: copy the directory.

### 2.2 No external assets

Every visual is drawn at runtime with Canvas 2D: buildings, windows, gorillas, banana, sun,
particles, HUD. No `fetch`, no `XMLHttpRequest`, no image loading, no web fonts. Use system font
stacks only.

This is not an aesthetic preference — it means the page has nothing to wait on, no loading state, no
decode step, and no asset-loading failure modes. First paint is a working game.

### 2.3 Module loading

Use native ES modules: `<script type="module" src="./src/main.js"></script>`, with relative-path
`import` statements between files. ES modules are a platform feature, not a framework, and no build
step is involved — the browser loads the exact files on disk.

The game is served over HTTPS from a static host, so module CORS is a non-issue and the tree is
deployed as-authored. There is no server-side anything: any static file host works, and "deploy"
means copying the directory.

Do **not** concatenate everything into one file, and do **not** drop to classic `<script>` tags with
a shared global namespace. The module boundaries in §2.4 are enforced by `import` statements, and the
dependency invariants in §3 are checkable precisely because imports are explicit. Preserve them.

Because the host serves files as-authored, assume no cache-busting layer exists. Do not rely on
filename hashing for cache invalidation; if it matters later, that is a hosting-config concern, not
an application concern.

### 2.4 Tree

```
index.html
style.css
README.md
src/
  main.js         bootstrap, RAF loop, wiring
  config.js       all constants from §5
  rng.js          seeded PRNG
  physics.js      pure integrator
  terrain.js      city generation, mask ownership, carve/query
  ai.js           opponent
  game.js         state machine, turn orchestration, scoring
  camera.js       world-rect framing (render layer)
  render.js       canvas stack, compositing, LOD, particles
  input.js        pointer/keyboard → aim intents
```

Dependency rule: `physics` imports nothing but `config`. `terrain` imports `rng` + `config`. `ai`
imports `physics` + `terrain` + `config`. `game` imports everything except `render`/`input`. `render`
and `input` import `camera` and read state; they never mutate simulation state — they emit intents to
`game`.

---

## 3. Core invariants

These are the rules that make the rest of the design work. Read this section twice.

1. **Three coordinate spaces exist and never collapse into each other.** World space (float,
   physics), mask space (integer grid, collision + destruction), device space (pixels). (§5)

2. **The camera is cosmetic. It lives only in the render layer.** No physics, collision, AI, or game
   logic function may read camera state. The camera never feeds back into the simulation.

3. **What is visible is a function of game state alone — never of window size.** A bigger window
   draws the same world content *larger*. It does not reveal more world. (§9.1 — this is a strict
   requirement, both for feel and for 2-player fairness.)

4. **The physics timestep is fixed and independent of frame rate.** Rendering interpolates. The
   simulation does not.

5. **The AI calls the same integrator the real banana uses.** Never a separate approximation. If the
   AI's prediction and the real flight disagree, that is a defect.

6. **Terrain is static geometry, not physical objects. Nothing ever falls.** No structural integrity,
   no connectivity analysis, no collapse, no settling. Carve a hole under the top half of a building
   and that top half hangs in the air forever. This is correct. (§7.3)

7. **The mask is truth; art is a projection of the mask.** Destruction carves the mask. Rendering is
   derived from it. Never the reverse. (§7.4)

8. **LOD the art, never the mask.** Damage outside the current view is recorded at full fidelity even
   though nobody is watching. This is the whole point of the wide world.

9. **One boundary, three meanings.** The widest camera rect is simultaneously the maximum framing,
   the simulation's collision domain, and the line past which a shot is gone. There is never a banana
   that is live but unrenderable, or off-screen but still colliding. (§10)

10. **Gorillas and the sun are not in the mask.** They are explicit hit tests against data. Only
    buildings live in the mask.

11. **The ceiling is soft; the sides are hard.** Above the skyline there is nothing to hit, so
    collision is disabled and integration continues. The high lob is the signature Gorillas shot and
    must always come back. Crossing a lateral bound is escape. (§10)

---

## 4. Game state machine

```
MENU → SETUP → AIM → FLIGHT → RESOLVE → (AIM | ROUND_END) → ... → GAME_OVER
```

- **MENU** — title, 1P/2P selection.
- **SETUP** — player names, rounds to win, gravity, wind mode (fixed / random per turn), AI
  difficulty. Seed the RNG here.
- **AIM** — the active player supplies angle + power. The AI computes its shot here. The only state
  that accepts aim input. Camera rests at default framing.
- **FLIGHT** — the only real-time state. Fixed-step integration, camera active.
- **RESOLVE** — carve terrain, run gorilla/sun hit tests, award points, advance turn, re-roll wind if
  enabled.
- **ROUND_END / GAME_OVER** — scoreboard, victory dance.

Everything except FLIGHT is discrete. Input handling stays trivial because aim input is only ever
accepted in AIM.

### 4.1 Two reset boundaries

> **Revised (2026-07-15):** every round is a new world. This supersedes the original
> persistent-city design here, in §6, §11.1, §16, and §17.

| | **Match start** (new game) | **Round start** (within a match) |
|---|---|---|
| City geometry | regenerate from a new seed | **regenerate from a new seed** |
| Gorilla positions | re-place (§6) | **re-place (§6)** |
| Scores | reset to 0 | keep |
| AI correction memory | clear | **clear** (§11.1) |
| Wind | roll | roll |
| Banana / particles | clear | clear |

A round is what the original called a "game": `MakeCityScape` ran at the top of every one. Only
the score line (and the players) carry across rounds. Round city seeds derive from the match rng
stream, so a match seed still reproduces the same sequence of skylines.

---

## 5. Coordinate spaces and constants

### 5.1 World space

Float units. Origin at world top-left. **Y increases downward** (matches canvas and mask indexing;
gravity is positive Y). 1 world unit ≈ 1 reference pixel.

| Constant | Value | Notes |
|---|---|---|
| `ARENA_W` | 640 | Default framing width. A framing concept only — **not** a world boundary. |
| `ARENA_H` | 400 | Default framing height. |
| `WORLD_W` | 2560 | `4 × ARENA_W`. TUNABLE (3–4× is the useful range). |
| `GROUND_Y` | 400 | Ground line. Terrain domain is y ∈ [0, `GROUND_Y`]. |
| `VIEW_ASPECT` | 16/9 | Fixed. Letterboxed. (§9.1) |

The world is short and wide (6.4:1). Intentional: at the widest framing you see the city as a band
with open sky above, and that sky is where the arc lives.

### 5.2 Mask space

Integer grid, `WORLD_W × (GROUND_Y + 1)` = 2560 × 401. One `Uint8Array`, row-major:
`index = y * WORLD_W + x`. ≈1.0 MB. **Fixed across all devices** — it defines destruction granularity
and therefore 2-player fairness. A crater must not be chunkier on a phone than on a monitor.

Values: `0` = empty, `1..N` = building index + 1 (so debris can sample the right building's color).

### 5.3 Device space

Device pixels. Canvas backing store = CSS size × `devicePixelRatio`. Recomputed on `ResizeObserver`.
Affects sharpness and size on screen only. Never affects what is visible. (§9.1)

### 5.4 Physics constants

| Constant | Value | Derivation |
|---|---|---|
| `GRAVITY` | 400 u/s² | TUNABLE. |
| `MAX_SPEED` | 1000 u/s | Derived: `sqrt(GRAVITY × WORLD_W)` ≈ 1012, rounded. |
| `WIND_MAX` | ±100 u/s² | TUNABLE. Meaningful but not dominant vs. gravity. |
| `DT` | 1/120 s | Fixed physics step. |
| `EXPLOSION_R` | 25 u | Carve radius. Gameplay-critical — see §7.5. |
| `BANANA_DRAW_R` | 4 u | **Drawing only.** Terrain collision is a point. (§8.1) |
| `SWEEP_STEP` | 1 u | Max spacing of swept collision samples. |

**`MAX_SPEED` derivation — preserve this relationship.** Power is 0–100, mapped linearly to
0–`MAX_SPEED`. `MAX_SPEED` is set so a full-power 45° shot in still air ranges ≈`WORLD_W`: range at
45° is `v²/g`, so `v = sqrt(g × WORLD_W)`. This makes escape (§10) reachable but not routine — you
have to *try* to lose a banana. If you retune `WORLD_W` or `GRAVITY`, re-derive `MAX_SPEED`.

Sanity check: full-power 45° → flight ≈3.6 s, apex ≈640 u above launch. Max wind drifts a 3.6 s
flight by ≈650 u, a quarter of the city. Both intended.

---

## 6. Terrain generation

Seeded (`rng.js`) so a match is reproducible. Walk x from 0 to `WORLD_W` emitting buildings of random
width (40–90 u) and height (60–320 u) with small gaps. Each building gets an index (→ mask value), a
base hue from a small palette, and a grid of windows, each randomly lit or dark.

Gorilla placement, **once per round** (§4.1 revision): pick an x for each gorilla in the **middle
third**, x ∈ [`WORLD_W/3`, `2·WORLD_W/3`], separated by 2–4 buildings and framed comfortably by the
default arena rect. Then find the rooftop by raycasting the mask downward from `y = 0` at that x and
stopping at the first solid cell. Reuse `terrain.solidAt`; do not read building records. That keeps
placement correct against *any* skyline, intact or ruined.

**Gorilla positions are fixed for the duration of a round.** They do not move between turns; each
new round re-places them on that round's fresh skyline.

Consequence, and it is intended: a gorilla whose rooftop gets carved away does not move or fall
(§7.3). It stands on air, fully exposed, for the rest of the round. Losing your cover is permanent
until the world resets.

There is no "outer city" as a concept. There is one city, wider than the default framing, generated
by one code path with no special casing. Everything is equally destructible.

---

## 7. Destruction — the heart of the game

### 7.1 What must be preserved

The canonical scenario, which the implementation must produce **without any special-case code**:

> Two gorillas roughly across from each other with a tall building between them. Neither can clear
> it. So they take turns blasting divots out of it — each hit digging a little deeper. After several
> volleys the divots from both sides meet and a ragged tunnel now perforates the building. The next
> shot, thrown at exactly the right angle and power, threads that tunnel and hits the other gorilla.
> The top of the building — now supported by nothing — hangs there. It does not fall.

Every element of that emerges from three rules and nothing else:

1. The banana explodes at **first contact**, so the carve is centered on the *surface* it hit. Each
   hit therefore digs at most ≈`EXPLOSION_R` deeper. Progressive tunneling is automatic: once a divot
   exists, the next banana flies into it before touching solid and explodes deeper in.
2. Carving is a circle subtracted from a static mask. Overlapping circles from repeated hits produce
   arbitrary ragged shapes. A tunnel is just enough overlapping circles.
3. Collision is a point sample against the mask, swept finely enough to never skip a gap. (§8.1)

Do not "help" this scenario along. It falls out. If it doesn't, one of the three rules is wrong.

### 7.2 Explosion carving

Explosions are pure circles subtracted from the mask. No cracking, no spalling, no directional blast,
no chunk simulation, no crater lips, no rubble accumulation. Carved is carved.

### 7.3 Nothing falls. Ever.

Restating Invariant 6 because it will be violated otherwise:

- **No connectivity or connected-component analysis.** Never compute whether a region of building is
  still attached to the ground. The question is not asked.
- **No collapse, no toppling, no settling, no structural integrity.** A building's unsupported upper
  half floats. Floating masonry is a *feature*.
- **Gorillas do not fall either.** Carve the roof out from under a gorilla and it stands on empty air,
  exactly as before. Its position is unchanged by terrain edits.
- **No falling debris that interacts with anything.** Cosmetic particles (§13.5) are render-layer
  only, have no collision, and never carve.

The terrain has no physics. It is a stencil.

### 7.4 Mask as truth, art as projection

The city's art is baked **once** at startup into a full-world offscreen canvas (2560 × 401 RGBA,
≈4.1 MB): gradients, lit windows, edge shading. Both buffers are then updated in lockstep at every
carve:

1. Mask: zero out cells within `EXPLOSION_R` of the impact point.
2. Art: `globalCompositeOperation = 'destination-out'`, draw a radial-gradient circle at the same
   point and radius, feathered at the rim so craters read as scorched rather than cookie-cut.

The art is thereby always clipped to the mask's silhouette with zero per-frame clipping work. This is
what lets the buildings look modern while collision stays one array read.

Both buffers are allocated once at full world size at startup. Do not tile, chunk, defer, or lazily
generate. Five megabytes is nothing.

### 7.5 The tunneling ratio — a derived relationship

`EXPLOSION_R` relative to average building width sets **how many volleys it takes to punch through**,
which is the pacing of the §7.1 scenario and therefore gameplay-critical.

At `EXPLOSION_R = 25` and mean building width ≈65 u, a building takes roughly **3 hits from one side,
or 2 from each side**, to perforate. That is the target: long enough to feel earned, short enough to
happen in a real match. If you change building widths or `EXPLOSION_R`, re-check this ratio. Do not
tune either constant in isolation.

### 7.6 Interface

```js
terrain.generate(seed) -> { buildings, gorillaSpawns }
terrain.solidAt(x, y) -> number   // 0 = empty; else building index+1. Out of domain -> 0.
terrain.carve(x, y, r) -> void    // updates mask AND art canvas
terrain.artCanvas -> OffscreenCanvas
terrain.buildingColorAt(x, y) -> string
```

`solidAt` returns `0` for anything outside the mask domain (above the sky, past the sides, below
ground). It runs in the hot loop and is called thousands of times per shot by the AI — a bounds check
plus one array index. No allocation.

---

## 8. Physics

Pure. No canvas, no camera, no globals, no randomness. Fully unit-testable.

```js
physics.step(state, wind, gravity, dt) -> state'   // state = {x, y, vx, vy}
physics.launch(originX, originY, angleDeg, power) -> state
```

Semi-implicit Euler at fixed `DT`:

```
vx += wind * dt
vy += gravity * dt
x  += vx * dt
y  += vy * dt
```

Accumulate real elapsed time, consume it in fixed `DT` chunks, carry the remainder as `alpha`, and
let `render` interpolate between the previous and current step. **Never** step physics by a variable
frame delta.

### 8.1 Collision — point-sampled and swept

**Terrain collision uses the banana's center point, not its drawn radius.** The banana is drawn at
`BANANA_DRAW_R` but collides as a point. This is faithful to the original (which read a single pixel
under the banana) and it is what makes the §7.1 tunnel threadable: a gap narrower than the drawn
banana can still be threaded. The banana visually clipping a wall edge by a couple of pixels before
exploding is correct and is what the original looked like.

**Sweeping is mandatory.** At `MAX_SPEED` the banana covers ≈8 u per `DT` step while building
features and tunnel gaps are ~10 u. Point-sampling once per step will tunnel through thin walls and,
worse, will *miss the gap* the player just spent four volleys carving. After each step, march the
segment from the previous position to the current position at intervals of `SWEEP_STEP` (≤1 u) and
call `solidAt` at each sample. First solid sample wins; that point is the impact position.

Order: **terrain (swept) → gorilla (circle vs. AABB) → sun (circle vs. circle)**. Gorillas and the
sun are checked against data, never the mask (Invariant 10).

### 8.2 Old-school behaviors to preserve

- **Self-destruction works.** A banana can hit your own building, your own roof, or your own gorilla.
  Blowing yourself up is legal and hilarious. No guard rails.
- **Only direct contact kills.** There is no blast radius against gorillas. A banana landing 10 u from
  a gorilla's feet carves the roof out from under it and does not harm it. (The gorilla then stands on
  air — §7.3.)
- **The sun is non-blocking.** Hitting the sun switches its face to the shocked expression; the banana
  continues flying. The sun is scenery with a reaction, not an obstacle.

---

## 9. Camera

Lives in `camera.js`, consumed only by `render.js`. Nothing in the simulation may read it.

### 9.1 Framing vs. window size — two different things, two different names

This distinction is a strict requirement (Invariant 3) and the naming exists to prevent conflating
them:

- **`camera.rect`** — `{x, y, w, h}` in **world units**. The rectangle of world that is visible.
  Driven by game state (§9.2). "Zooming out" during flight means `rect.w` grows.
- **`viewScale`** — device pixels per world unit. **Derived from window size.** Purely display.

> A bigger browser window increases `viewScale`. It does not change `rect`. The same world content is
> drawn *larger*. It does not reveal more of the city.

Concretely, each frame:

```
letterbox = largest VIEW_ASPECT rect that fits the canvas, centered
viewScale = letterbox.width / rect.w
transform: translate(letterbox.x, letterbox.y) · scale(viewScale) · translate(-rect.x, -rect.y)
```

Letterboxing to a fixed `VIEW_ASPECT` is what guarantees the invariant on windows of any shape: an
ultrawide window must not show more city than a square one. The sky gradient may bleed into the
letterbox margins (it looks better than black bars); all world content is clipped to the letterbox
rect.

Resize handling is therefore the entire responsive story: on `ResizeObserver`, resize the backing
store to CSS size × DPR, recompute `letterbox` and `viewScale`. `rect` is untouched. Simulation is
untouched.

### 9.2 Fit a box, do not follow the banana

A camera centered on the banana loses the shot geometry — the target scrolls away and the player
can't read where the shot is going. Instead, each frame:

1. Collect focus points: the banana (interpolated), both gorillas, and the look-ahead point (§9.3).
2. Compute their world-space AABB.
3. Pad by `CAM_PAD = 80` u (TUNABLE).
4. Expand to `VIEW_ASPECT`.
5. That is `targetRect`.

The box is small at launch and grows as the banana climbs, so widening happens for free, and the arc
is always framed *relative to the arena*. Height usually drives the fit — correct, because height is
the dramatic axis in Gorillas.

### 9.3 Look-ahead

Add `banana.pos + banana.vel * CAM_LOOKAHEAD` (`CAM_LOOKAHEAD = 0.25` s, TUNABLE) as an extra focus
point. Without it a fast banana pins to the frame edge and the camera chases it all flight.

### 9.4 Smoothing

- **Interpolate `rect.w` in log space**, not linearly: `w = exp(lerp(log(w), log(targetW), k))`.
  Framing scale is multiplicative; a linear lerp feels wrong on the way out. Derive `rect.h` from
  `rect.w` and `VIEW_ASPECT`; lerp the center linearly.
- **Asymmetric rates.** Widening is snappy (`k_out ≈ 0.25`) so the banana never leads the frame off.
  Closing back in is lazy (`k_in ≈ 0.08`) so the descent settles gracefully.
- **Deadzone**: ignore target changes under ~10 u so the camera doesn't shimmer.
- Scale all rates by frame delta so behavior is frame-rate independent.

### 9.5 Clamps

- `rect.w` is clamped to `[ARENA_W, WORLD_W]`. Note these are **world-unit** bounds, not
  pixel-derived — they do not change with window size.
  - `rect.w = WORLD_W` — widest framing. Shows exactly the whole city. Same line as the simulation
    bound (§10).
  - `rect.w = ARENA_W` — default framing. Never closer.
- Clamp `rect.x` so the frame never shows past the lateral world bounds (when `rect.w = WORLD_W`, `x`
  is pinned to 0).
- Clamp `rect.y` so `GROUND_Y` never rises above the bottom 15% of the frame. Sky above is unclamped
  — that's where the arc goes.
- In AIM and RESOLVE, ease `rect` back to default framing centered between the two gorillas.

The widest composition — the whole city, scarred — is a fixed, art-directable frame. Tune it
deliberately; it's a moment.

### 9.6 Helpers

`camera.worldToScreen(p)` and `camera.screenToWorld(p)`. All pointer input routes through
`screenToWorld` (§14). All HUD drawing resets the transform first (§13.3).

---

## 10. World bounds and escape

### 10.1 The rules

- **Above (`y < 0`):** collision disabled, integration continues. Off-screen but alive. Edge
  indicator (§13.4). It always comes back.
- **Lateral (`x < 0` or `x > WORLD_W`):** escaped. Collision disabled, integration continues (§10.2).
- **Below (`y > GROUND_Y`):** ground impact. Carve, resolve.

Outside the world, keep stepping with a `collide: false` flag. Same code path, one boolean.
Integrating out there is ~10 flops per step — the expensive things are collision and rendering, and
there is nothing out there to collide with or render.

### 10.2 The escape predicate — pacing, not performance

At the moment the banana crosses a lateral bound, solve analytically: **does wind reverse it and
carry it back inside the world before it falls below `GROUND_Y`?**

```
Given (x, y, vx, vy) at the crossing, wind w, gravity g:
  t_ground = positive root of  y + vy·t + ½g·t² = GROUND_Y
  x(t)     = x + vx·t + ½w·t²
  Find the earliest t in (0, t_ground] where x(t) re-enters [0, WORLD_W].
  Exists -> BOOMERANG. Else -> GONE.
```

- **GONE:** hold ~400 ms so the miss registers, then cut to RESOLVE. Don't make anyone watch a dot
  fall for four seconds.
- **BOOMERANG:** keep the banana live, hold `rect.w` at `WORLD_W`, keep the edge indicator up, and let
  it land. Worth waiting for — and exactly what you'd have destroyed by killing the banana at the
  bound.

### 10.3 Why the outer city matters

In the original a wild miss does nothing: the banana leaves and the universe forgets. Here it blows a
hole in the neighborhood. The outer buildings are miss-catchers — they convert a null outcome into
feedback, and the hole's size and distance are a legible signal of *how badly* you missed. Preserve
this; it is why the wide world exists.

---

## 11. AI

Imports `physics` + `terrain` only. Pure: given game state, returns `{ angle, power }`.

### 11.1 Adaptive shooter, analytically seeded

Do **not** implement a pure analytic solver that inverts the projectile equations and adds noise to
dumb itself down. It plays like a sniper and is not fun to watch.

Model how a person actually plays:

1. **Opening shot:** coarse analytic solve toward the opponent given current wind and gravity, plus
   noise scaled by difficulty. Plausible, not sniper.
2. **Observe:** record the *signed* miss — short/long, over/under.
3. **Correct:** nudge angle and power toward the target next turn. Converge over a few volleys.
4. **Correction memory lives for one round and clears whenever the world does** (round start,
   §4.1 revision). Within a round the gorillas never move, so corrections stay valid turn to turn;
   per-turn wind re-rolls (gusty mode) are what keep a converged AI honest inside a round. A new
   round means new geometry, so the AI opens fresh with the analytic solve — same as a human
   sizing up a new skyline.

This produces near-misses and the drama of walking a shot in, and makes difficulty a natural dial.

| Difficulty | Opening noise | Convergence | Overcorrection |
|---|---|---|---|
| Easy | high | slow | frequent |
| Medium | moderate | ~3 volleys | occasional |
| Hard | low | ~2 volleys | rare |

### 11.2 Verification, not omniscience

The AI may run `physics.step` forward to check its intended shot isn't immediately blocked by its own
building or a neighbor (a common frustration in the original). It uses the same integrator and the
same `terrain.solidAt` (Invariant 5). It must not read the camera and must not query state a human
player could not see.

Note the AI gets the §7.1 scenario for free: as the building between the gorillas gets perforated, its
forward simulation starts finding shots through the tunnel. No tunnel-aware code required.

---

## 12. Wind

Horizontal acceleration, constant for a turn, drawn from `[-WIND_MAX, +WIND_MAX]`, re-rolled at each
RESOLVE if random wind is enabled. Display as the classic arrow at the bottom, length proportional to
magnitude, in **screen space** (§13.3) so it doesn't shrink when the camera widens.

---

## 13. Rendering

### 13.1 Canvas stack

Back to front:

1. **Sky** — vertical gradient, screen space, full bleed (including letterbox margins).
2. **Parallax** — 1–2 non-destructible skyline silhouettes. Each scales its effective camera offset by
   a depth factor (`0.3`, `0.6`), so widening reveals more sky.
3. **Terrain** — one blit of `terrain.artCanvas` through the camera transform.
4. **Actors** — gorillas, banana, sun.
5. **Particles** — debris, smoke, flash.
6. **HUD** — screen space.

Layers 1–5 may share one canvas; the point is draw order. World content (2–5) is clipped to the
letterbox rect.

Do **not** use `image-rendering: pixelated`. The camera scales continuously and nearest-neighbor at
fractional scale shimmers. Draw at reference resolution and let the browser filter. The retro read
comes from palette, silhouette, and the chunky window grid — not from enforced hard pixels.

### 13.2 LOD

Tie detail to `rect.w`, and **only art** (Invariant 8):

| `rect.w` | Skip |
|---|---|
| > 1.6 × `ARENA_W` | banana spin frames (draw a simple shape), window flicker |
| > 2.4 × `ARENA_W` | debris particles, smoke |
| > 3.2 × `ARENA_W` | scorch decals, parallax detail |

The mask is carved at full fidelity at every framing, always. The scars get recorded even when nobody
is watching them happen at three pixels tall — that fidelity-when-unobserved is exactly what pays off
when the camera pulls back and finds the damage waiting.

### 13.3 HUD

Angle, power, wind arrow, names, score — drawn with the transform reset to identity. They must not
pan or scale with the camera.

### 13.4 Off-screen indicator

When the banana is outside the current rect, draw a clamped arrow at the frame edge pointing toward
it, with a small height/distance readout. This is the alternative to unbounded widening: never shrink
the gorillas to dots.

### 13.5 Juice

All render-layer, none of it touches mechanics or the mask: impact flash, debris particles tinted by
`terrain.buildingColorAt` at the impact point, smoke, scorch decals, brief
screen shake on impact, sky gradient, reactive sun. (No banana trail — see §14.) Particles are cosmetic — no collision, no
carving, and they never fall onto anything that matters (§7.3).

### 13.6 Keep these — they are most of the charm

- The banana's 4-frame spin.
- The sun's shocked face on a hit.
- The wind arrow.
- Randomly lit windows.
- The victory chest-beat dance.

---

## 14. Input

Two aim methods, both always available:

- **Type-in:** angle (degrees) and power (0–100). The original's interface; keep it.
- **Drag-to-aim:** pointer down on the active gorilla, drag back like a slingshot, release. Vector
  length → power (clamped to 100), angle → angle. This is what makes it playable on touch. Route every
  pointer coordinate through `camera.screenToWorld` — never reason about aim in screen pixels.

**No path hints** (revised 2026-07-15): there is no ghost arc of the previous shot and no trail
behind the live banana. The only aiming affordance is the aim arrow on the active gorilla. Reading
your last miss and adjusting from memory is the game, exactly as in the original.

Aim input is accepted only in AIM.

### 14.1 Page CSS

The canvas fills the browser window and tracks it live:

```css
html, body { margin: 0; height: 100%; overflow: hidden; background: #000; }
canvas { display: block; width: 100%; height: 100%; touch-action: none; }
```

Backing store is set in JS to CSS size × `devicePixelRatio` on `ResizeObserver`. Per §9.1, this makes
everything bigger and sharper; it never changes what is visible.

---

## 15. Persistence

`localStorage` only — settings, win counts, difficulty. No backend, no accounts. Wrap every access in
try/catch (private mode throws). The game must run correctly with storage entirely unavailable.

---

## 16. Damage persistence and the round arc — settled (revised 2026-07-15)

**Damage persists across turns within a round. Every round starts with a fresh city.** (§4.1)
This is the original GORILLA.BAS structure: what the original called a "game", we call a round.

**Within a round, cover degradation is intended. Do not mitigate it.** Specifically, do not
implement: mid-round terrain regeneration, repair or healing, a damage cap, a "minimum cover"
guarantee, rubble that refills craters, or any rebalancing pass that notices one player's building
is more wrecked than the other's. Asymmetric ruin is an outcome, not a bug. The §7.1 tunnel is dug
volley by volley inside a single round, and a gorilla whose roof is carved away stands exposed on
air until the round ends. The outer city (§10.3) records every wild miss for the duration of the
round.

Between rounds there is nothing to preserve: new seed, new skyline, new rooftops, new wind, new
AI memory. The match arc comes from the score line and each round's own escalation, not from
accumulated ruin.

---

## 17. Acceptance criteria

### Build & delivery
- [ ] Repo contains no `package.json`, no `node_modules`, no bundler config, no third-party JS.
- [ ] No network requests of any kind after initial page load. No image, audio, or font files exist.
- [ ] Deploying is copying the directory to a static HTTPS host. No build step was performed.
- [ ] `index.html` loads `src/main.js` as a module; no file is concatenated or namespaced onto a
      global.

### Window sizing
- [ ] Two browser windows of different sizes, same game state, show **exactly the same world content**
      at different pixel sizes. Neither reveals more city than the other.
- [ ] Maximizing the window mid-flight makes everything bigger. It does not zoom out.
- [ ] An ultrawide window shows no more city than a 16:9 one (letterboxed).
- [ ] Resizing mid-flight changes nothing about the simulation.

### Destruction
- [ ] Two gorillas either side of a tall building: repeated hits perforate it in ~3 hits per side, and
      a well-aimed shot then threads the tunnel and kills. No special-case code enables this.
- [ ] Carving under the top of a building leaves the top floating. It does not fall, settle, or shed.
- [ ] Carving the roof from under a gorilla leaves it standing on air, unmoved and unharmed.
- [ ] A banana passing through a 6 u gap in a wall is not stopped by it.
- [ ] A banana at full speed never tunnels through a thin wall.
- [ ] Craters are identical in mask units on a phone and a 4K monitor.
- [ ] `terrain.js` contains no flood fill, connected-component pass, or support/stability check.

### Simulation
- [ ] Physics is bit-identical at 30 fps and 144 fps for the same inputs.
- [ ] Full-power 45° shot in still air travels ≈`WORLD_W`.
- [ ] A banana fired straight up at full power leaves the top of the frame and returns to hit
      something. It is never lost.
- [ ] A shallow shot into strong opposing wind crosses the lateral bound, reverses, re-enters, and
      lands. The camera holds for it.
- [ ] A wild miss carves a visible crater in a building outside the default framing; widening the
      camera on a later turn shows that crater, unchanged.
- [ ] A player can blow up their own gorilla.

### Persistence (per the §4.1 revision)
- [ ] A crater carved on an early turn of a round is present, unchanged, many turns later in the
      same round.
- [ ] Starting a new round (or match) regenerates the city from a new seed with zero scars.
- [ ] Gorilla positions are identical on every turn of a round, and re-placed each round.
- [ ] A gorilla whose rooftop is destroyed stays at its exact position for the rest of the round.
- [ ] `game.js` contains no terrain repair, damage cap, or cover-rebalancing path *within* a round.
- [ ] The AI's predicted landing point for a given shot matches the actual landing point exactly.

### Structure
- [ ] Nothing in `physics.js`, `terrain.js`, `ai.js`, or `game.js` imports or references `camera`.
- [ ] The HUD does not scale or pan with the camera.
- [ ] Game runs with `localStorage` throwing on every access.