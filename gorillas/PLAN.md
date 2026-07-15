# GORILLAS — Implementation Plan

This plan operationalizes `SPEC.md`. The spec remains authoritative for every invariant; this
document records the concrete decisions, the few deliberate deviations (with rationale), the frozen
module APIs, and the build/verification order. Where this plan and the spec disagree on an
invariant, the spec wins.

> **Revisions (2026-07-15):** per user decision, every round is a new world — `startRound()`
> regenerates the city, re-places the gorillas, and clears AI correction memory (the original
> GORILLA.BAS structure). Damage persists between turns within a round only. Also removed: the
> ghost arc and the fading in-flight banana trail — no path hints of any kind; the aim arrow is
> the only aiming affordance. SPEC §4.1/§6/§11.1/§13.5/§14/§16/§17 carry the matching notes.

---

## 1. Deviations from SPEC — deliberate, and why

### 1.1 Sound (user-directed override of §2.2)

`gorillas/sounds/` ships five mp3s and the game uses them. This is the only external-asset
exception; everything visual remains procedural. Rules that keep the spirit of §2.2 intact:

- **New module `src/audio.js`**, imported by `main.js` only. The simulation never knows audio
  exists. Audio is driven by drained game events, exactly like particles.
- **Zero loading state.** Sounds load lazily after the first user gesture (which browsers require
  for audio anyway). Every fetch/decode/play is wrapped in try/catch; if audio fails to load or
  `AudioContext` is unavailable, the game plays identically, silently. First paint still waits on
  nothing.
- Event map: `throw → throw-banana.mp3`, terrain/ground explosion → `hit-building.mp3`,
  gorilla kill → `hit-gorilla.mp3`, victory dance → `chest-thump.mp3`, menu/attract →
  `intro-music.mp3` (looped quietly, stopped at match start). Mute toggle (button + `M`),
  persisted to localStorage via the same try/catch wrapper as §15.

### 1.2 Escape predicate: cloned integrator instead of closed form (§10.2)

The spec asks for an analytic solve at the lateral-bound crossing. The *purpose* is a pacing
decision made at the instant of crossing (GONE → cut early; BOOMERANG → hold). We keep the decision
point but compute it by fast-forwarding a **clone of the banana through the same `physics.step`**
(capped at 2 sim-minutes). Rationale: the real flight is discrete semi-implicit Euler, and a
closed-form quadratic can disagree with it near tangent re-entries — producing a "GONE" verdict for
a banana that then visibly comes back. Using the integrator makes the predicate exact by
construction, for ~a few thousand adds. The observable behavior (§10.2's GONE hold / BOOMERANG
camera hold) is unchanged.

### 1.3 Scorch is baked at carve time, not a particle decal (§13.2, §13.5)

At each carve, after zeroing the mask, the art canvas gets: (1) a `source-atop` dark radial ring —
it can only darken surviving building pixels, so no floating scorch in the sky; (2) the
`destination-out` feathered hole from §7.4. Craters therefore read as scorched forever, at every
LOD, with zero per-frame cost. The LOD row "skip scorch decals" becomes moot (there are no decal
objects to skip); the LOD table otherwise stands.

### 1.4 Discrete UI is DOM; in-world HUD is canvas (§13.3, §14)

Menus, setup, the angle/power type-in, banners, and pause live in plain DOM overlays (no framework,
no build). Rationale: real `<input>` elements give mobile keyboards, focus handling, and
accessibility for free — the original's type-in interface, done natively. Everything the camera
must not affect but that lives *in the frame* (names, score, wind arrow, off-screen indicator, turn
marker) is canvas-drawn under an identity transform per §13.3. DOM is identity by definition, so
Invariant 3 and the HUD acceptance check hold trivially.

---

## 2. Additions (not deviations — the spec is silent on these)

- **Launch arming.** The banana spawns at the thrower's hand (just above the head, like the
  original's `StartYPos`). The shooter's own gorilla is excluded from hit tests **only until the
  banana first exits its own inflated AABB**; after that, self-destruction works per §8.2. Without
  this, frame-0 self-collision would end every throw instantly.
- **Attract mode.** The menu renders over a live, seeded city with a slow camera pan. Costs
  nothing (same render path), shows off the world, and gives first paint some charm.
- **Turn order** alternates every throw and persists across rounds (the original's `J = 1 - J`
  behavior). First to `playTo` points wins the match; a self-hit scores for the opponent
  (original's `HITSELF` rule).
- **Sun placement** (spec never fixes it): world-space, centered between the two gorillas at
  `y ≈ 55`, drawn **behind** terrain. Because the flight's swept terrain test runs before the sun
  test, a banana "at" the sun inside a building correctly hits the building — occlusion resolves
  with zero special-case code. Sun hit test: circle r=12+BANANA_DRAW_R, cosmetic only (§8.2).
- **AI tunneling for free, plus a nudge.** When the AI's shot is blocked by the intervening
  building, it sometimes keeps hammering a similar shot (digging the §7.1 tunnel) and sometimes
  raises its angle to lob — chosen by seeded RNG, forced to lob after 4 consecutive blocks. This is
  behavior *on top of* the required miss-correction memory, not a replacement.
- **Game-over composition.** On GAME_OVER the camera eases to the full-world rect (§9.5's "widest
  composition is a moment") over the winner's dance — the whole scarred city as the closing shot.
- **QoL:** aim fields pre-fill with that player's previous values; Enter in the power field
  throws; arrow keys nudge angle/power; ESC pauses (DOM overlay; sim tick suspended, render
  continues); gravity presets (Moon 80 / Earth 400 / Heavy 650); wind modes None / Steady
  (re-roll per round, like the original) / Gusty (re-roll per turn, §12).

---

## 3. Architecture

```
gorillas/
  index.html      canvas + DOM overlays (menu/setup/aim/banner/mute), loads src/main.js as module
  style.css       page CSS per §14.1, overlay styling, CSS-only scanline flourish
  README.md       how to run/play; credits
  sounds/*.mp3    (already present — the five files above)
  src/
    main.js       bootstrap, RAF + fixed-step accumulator, ResizeObserver, DOM wiring,
                  event drain → audio/render, camera targeting per game mode
    config.js     every constant; no logic
    rng.js        mulberry32; createRng(seed) → {next, range, int, pick, chance}
    physics.js    launch/step + createFlight/runFlight (the ONE flight code path)
    terrain.js    mask + art canvas ownership; generate/solidAt/carve/buildingColorAt
    ai.js         difficulty params, opening solve, correction memory, verification
    game.js       state machine, turns, scoring, wind, events out
    camera.js     rect + letterbox + smoothing + transforms (render-layer only)
    render.js     sky/parallax/terrain/actors/particles/HUD; sprite baking; LOD
    input.js      pointer drag-to-aim + keyboard nudges → intents only
    audio.js      (deviation §1.1) event-driven playback, resilient, main-only
```

Dependencies (spec §2.4 + audio): `physics ← config`; `terrain ← rng, config`;
`ai ← config` (+ a `simulate` closure the game builds from `physics`+`terrain`, see §5 —
so AI provably runs the same integrator); `game ← physics, terrain, ai, rng, config`;
`camera ← config`; `render ← camera, config` (state passed in as an argument);
`input ← camera, config`; `audio ← nothing`; `main ← everything`.
Nothing in physics/terrain/ai/game references camera. Render/input mutate nothing — intents only.

## 4. Constants added to §5's set (all in config.js)

| Constant | Value | Why |
|---|---|---|
| `GORILLA_W × GORILLA_H` | 26 × 30 | hit AABB, matches the ported ~30u sprite |
| `SUN_R` | 12 | cosmetic hit circle |
| `DRAG_FULL` | 220 u | drag length that maps to power 100 |
| `AI params` | table in ai.js | per-difficulty noise/gain/overcorrection (§11.1 table made concrete) |
| Palette | EGA-adjacent | sky deep blues; buildings gray/maroon/teal; windows `#ffe14d`/dark |

Mask stays `2560 × 401` `Uint8Array`; max ~61 buildings < 255 mask values. All §5.4 physics
constants and the `MAX_SPEED` derivation are untouched.

## 5. Frozen module APIs

```js
// physics.js — pure; injected solidAt keeps the import graph legal
launch(x, y, angleDeg, power) -> {x,y,vx,vy}            // world angle; 0-100 power → 0-MAX_SPEED
step(s, wind, gravity, dt) -> s                          // semi-implicit Euler (spec §8)
createFlight({x,y,angleDeg,power,wind,gravity,solidAt,gorillas,shooter}) -> flight
  flight.stepOnce() -> events[]   // one DT; per-sample swept: ground → terrain → gorillas (§8.1)
  flight.{cur,prev,t,escaped,done,outcome}
runFlight(opts) -> {outcome, time}                       // loop stepOnce; used by AI + predicate

// terrain.js (§7.6, exactly)
generate(seed) -> {buildings, gorillaSpawns}   // spawns via solidAt raycast, middle third, 2–4 apart
solidAt(x,y) -> 0|buildingIndex+1              // bounds check + one array read
carve(x,y,r)                                   // mask zero + art scorch(source-atop) + hole(destination-out)
getArt() -> HTMLCanvasElement; buildingColorAt(x,y) -> css|null

// camera.js (§9)
setViewport(cssW, cssH, dpr); update(dt, target); snap(target)
  target = {mode:'points', points} | {mode:'default', centerX} | {mode:'full'}
getView() -> {rect, letterbox, scale, dpr}
worldToScreen(x,y) / screenToWorld(x,y)        // CSS px; all pointer input routes through this
applyWorld(ctx, shakeX, shakeY) / applyHud(ctx)

// ai.js (§11) — pure given env; rng passed in (seeded, deterministic per match)
createAiState()                                 // cleared at every round start (§4.1 revision)
computeShot(env) -> {angle, power}              // facing-relative, like a human types
  env = {launch, meX, targetX, targetIdx, shooterIdx, dir, wind, gravity,
         difficulty, rng, mem, simulate(angle, power) -> {outcome, time}}
observe(mem, report)                            // signed along-throw miss; blocked detection;
                                                // solved-shot reuse with wind-delta compensation

// game.js — owns S; emits events; never draws, never reads camera
newMatch(settings) / rematch() / toMenu()
tick(DT); getState(); drainEvents()
submitAim(angleFacingRel, power); setAim(p, a, pow); isHumanTurn(); activeIdx()

// The game builds env.simulate as (angle, power) => runFlight(buildFlightOpts(idx, angle, power))
// — the SAME opts builder the real throw uses. Invariant 5 and the §17 "AI prediction matches
// actual landing exactly" check hold by construction, not by discipline.
```

## 6. Key algorithm decisions

- **Flight stepping.** Each `stepOnce` advances one `DT`, then sweeps prev→cur at ≤`SWEEP_STEP`
  spacing. *Every sample* is tested (lateral-inside samples only): ground, then `solidAt`, then
  gorilla AABBs (arming rule §2). Exit/boomerang judgment happens after the sweep, so the inside
  portion of a boundary-crossing step still collides — no skipped wall at x=2559.
- **State machine** per §4, with `ROUND_INTRO` (1.4s banner) folded into round start and
  `RESOLVE` split by outcome: non-lethal impact → 0.7s hold → advance turn; gorilla kill →
  ROUND_END (3.2s dance) → next round or GAME_OVER. The reset boundaries are two literal
  functions — `startRound()` (new city seed from the match rng stream, gorillas re-placed, wind
  re-rolled, banana/AI memory cleared) and `newMatch()` (all of that plus scores and
  the match seed) — so §4.1's table is auditable in one screen of code. The dance plays out on the
  old city; regeneration happens only when the next round actually starts.
- **Camera targeting** is computed in `main.js` (wiring layer): FLIGHT → fit-points (gorilla AABB
  corners, interpolated banana, +0.25s lookahead); escaped-and-boomerang → full; GAME_OVER → full;
  everything else → default rect centered between gorillas. Log-space width lerp, asymmetric
  `k_out/k_in`, 10u deadzone, per-frame-rate-scaled (§9.4); clamps per §9.5 with the ground-in-
  bottom-15% rule.
- **AI numbers** (concretizing §11.1): opening angle `rng 40–70°`, v from `R = v²sin2θ/g` with two
  wind-drift iterations, noise σ per difficulty (easy 12/12, med 7/7, hard 3.5/3.5 in °/power);
  correction `ΔP = P·gain·(−missAlong)/(2R)` clamped ±18 (range ∝ v², so dR/R = 2dv/v),
  overcorrection with probability 0.45/0.18/0.06 ×1.8/1.4/1.15; converged solution stored and
  reused on later turns of the same round with wind-delta drift compensation (`Δdrift = ½·Δw·T²`),
  dropped after two consecutive failures. Memory clears at round start — new world, fresh opening. Verification (§11.2): ≤6 re-rolls only when the sim shows the shot landing
  <30% of the way to the target or self-killing — reject-stupid, not aim-perfect.
- **Wind roll** mimics the original's distribution: base ±40, then 1/3 chance of a directional
  gust up to +60, clamped to ±`WIND_MAX`.
- **Sprites** (gorilla 3 poses, banana 4 spin frames, sun 2 faces) are baked once at init into
  small offscreen canvases — the original's GET/PUT, modernized. The gorilla is a direct port of
  `DrawGorilla`'s rect/arc geometry (QBasic CCW arcs map to canvas via `arc(cx,cy,r,−s,−e,true)`).
  Banana frames keep the original's L/U/D/R order and `rot = ⌊10t⌋ mod 4` timing.
- **Parallax** layers are procedural rect lists (not canvases), drawn each frame under a
  perspective-ish transform: scale `1/depth` about `(cameraCenterX, GROUND_Y)`. Pans less than the
  foreground, scales correctly under zoom, costs ~80 fillRects, and the far layer is the §13.2
  wide-LOD skip.
- **Two RNG streams** from the match seed: terrain generation consumes its own `createRng(seed)`
  inside `terrain.generate`; the game/AI/wind stream is `createRng(seed ^ 0x9e3779b9)`. Wind rolls
  and AI noise can never perturb city layout — a match seed is fully reproducible.

## 7. Rendering order (per frame)

sky gradient (full canvas, bleeds into letterbox) → clip letterbox → world transform (+decaying
shake) → parallax ×2 → ground strip → sun → terrain art blit → drag/aim indicator →
gorillas (pose: idle/throw/dance; dead = hidden) → banana (interpolated, spin frames; simple disc
past 1.6×LOD) → particles/trail/flash (skipped past 2.4×LOD) → unclip → HUD at identity: score
strip, wind arrow, turn marker, off-screen banana indicator (clamped edge arrow + distance), AI
"thinking" line. DOM overlays sit above the canvas.

## 8. Build order & verification

1. `config` → `rng` → `physics` (pure core)
2. `terrain` (mask+art+carve) → `camera`
3. `game` + `ai` (turn loop vs. static aim), `input`
4. `render` (sprites, city, actors) → `main` wiring → DOM screens
5. `audio` last (events already flowing)
6. Smoke-test in a real browser via a local static server + DevTools: console clean, menu → setup
   → shots (drag + typed), AI match, tunnel scenario, boomerang shot, resize mid-flight,
   round persistence. Walk §17's checklist explicitly — it is the acceptance gate.

Manual spot-checks emphasized from §17: two window sizes show identical world content; full-power
45° ranges ≈`WORLD_W`; straight-up shot returns; craters persist turn to turn within a round and a
new round deals an unscarred city;
`terrain.js` contains no connectivity/collapse code; AI predicted landing == actual (shared code
path makes this structural).

## 9. Risks / notes

- **ES modules require HTTP.** `file://` won't load modules; the deploy target (static HTTPS) and
  any dev server are fine. README documents `python -m http.server` as the one-liner.
- **Autoplay policy** is handled by design (audio unlock on first gesture; menu requires a click
  before any sound matters).
- **Determinism**: all sim randomness flows through the two seeded streams; `DT` is fixed;
  render-side effects (particles, shake) may use `Math.random` freely — they never touch the sim.
