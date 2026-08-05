# Slop Sweeper

A turn-based puzzle about building software under deadline with AI assistance.
Design spec: [`SPEC.md`](SPEC.md). Implementation plan: [`PLAN.md`](PLAN.md).

**Status: M4 — playable, with the juice and the Level Lab.** The headless core plays complete
games of all six levels in Node: place, generate (draw / legal set / refund / mine roll),
analyze, and traversal with flood-fill detonations, plus live clues, a constraint solver, a
level validator, and a policy-bot sim harness. The economy had its first tuning pass before
any UI existed — per SPEC §10.2 it cannot be tuned by playing it. The page is now the whole
game: a procedural pixel-art canvas board with semantic zoom and pan, a DOM HUD, step tweens,
particle detonations, fast-forward, an end screen, and the paste-to-play Level Lab (§9.2).
What is left is M5's device pass (PLAN §14).

**Beta blocks** land on 2026-08-05 (SPEC §4.7): three shipped milestones a level, placed on
open water exactly like a hand tile, that users treat as intermediate destinations — they
depart for one the moment it is reachable and closer to B, walk to it, and camp there until
something better opens up. Camping drains patience like any other waiting, so what a beta
buys is the walk, not the clock. With no beta on the board the game is bit-for-bit the game
it was, which the sim table and `test/beta.test.js` both check rather than assume.

**Multi-destination itineraries** land the same day (SPEC §2.4/§6.5, §9.2.2): a level may mark
`B`, `C`, `D`… as well as `A`, and each user carries a list of the ones it has to visit, in any
order. The lists are authored by the level and handed out round-robin by spawn order, so the
demand is a property of the level and not of the seed; a level that lists none sends every user
everywhere, which is why a one-destination level is the game it always was — measured, not
promised. Reaching a stop that is not the last one refunds half a bar of patience and the walk
carries on; the last one is arrival and scores the point, however far the user went to earn it.
`src/levels/delta.js` is the first level built for it — two necks into one spine with three
lobes hanging off it, so SPEC §9.2.2's trunk-versus-branches decision arrives in the first ten
turns. It is a showcase and its numbers are a first guess; read its header before copying them.

## There is no build step, ever

Plain JavaScript ES modules. No bundler, no compiler, no `dist/`, no dependencies — nothing
to install (PLAN §1.2). This folder *is* the app: merging it publishes it at
`/slop-sweeper/`. `package.json` exists only so Node treats `.js` as ES modules when running
tests and the sim; the browser never reads it.

Types are `// @ts-check` + JSDoc typedefs, so an editor checks the frozen shapes in PLAN §6
with zero toolchain.

## Run it locally

ES modules will not load over `file://` — the page needs any static server:

```sh
cd slop-sweeper
python -m http.server 8000     # then open http://localhost:8000/
```

VS Code Live Server or `npx serve` work the same way.

URL parameters: `?level=plain` picks a level, `?seed=12345` reproduces a game exactly, and
`?lab=1` adds the Level Lab (PLAN §9.2) — paste a charmap, validate it, play it, quick-sim it
in the browser, and export a finished `src/levels/<id>.js` to the clipboard. The Lab module is
only fetched when that parameter is present.

## Tests and sim

Node ≥ 20 (dev only — players need only a browser):

```sh
cd slop-sweeper
node --test                                  # the whole suite
npm test                                     # same thing

node src/sim/validate.js                     # structural check of every registered level
node src/sim/validate.js caldera             # …or just one

node src/sim/run.js --all                    # levels x policies, as a markdown table
node src/sim/run.js --level caldera --policy balanced:0.5 --games 200 --seed 1
npm run sim -- --all --games 200             # same runner
```

Policies: `handOnly`, `genRush`, `balanced:p`, `careful:p`, each optionally suffixed
`-greedy` (default) or `-edge` to pick the ghost-placement strategy, and `-beta` to ship beta
milestones under pressure (SPEC §4.7). Suffixes compose in any order —
`balanced-edge-beta:0.4`. `-beta` is deliberately out of the default sweep, so `--all` keeps
measuring the game the corpus was tuned against. `--no-solver` skips the `guessForced`
instrumentation.

## Layout

```
src/core/     zero deps, zero DOM, pure, injected PRNG — the whole game model
src/levels/   charmap level definitions + registry (one file, one line, per level)
              README.md is the authoring guide: legend, invariants, defaults, worked example
src/sim/      policy bots, pure batch runner, Node CLIs, state hash
src/ui/       canvas board, DOM HUD, particles, and the ?lab=1 Level Lab overlay
test/         node:test + node:assert
```

**Dependency law:** `core` imports only `core`; `levels` import core; `sim` imports core and
levels, with everything Node-specific confined to the two CLIs so the browser Level Lab can
import `batch.js` unchanged; nothing imports `ui`. Core touching a DOM global breaks the
tests immediately, which is the enforcement.

## Adding a level

One file plus one line in `src/levels/index.js`. `{ id, map }` alone is playable —
[`src/levels/README.md`](src/levels/README.md) is the complete guide.
