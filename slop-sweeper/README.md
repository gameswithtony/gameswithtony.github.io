# Slop Sweeper

A turn-based puzzle about building software under deadline with AI assistance.
Design spec: [`SPEC.md`](SPEC.md). Implementation plan: [`PLAN.md`](PLAN.md).

**Status: M1 — walking skeleton.** The headless core plays a hand-built game of `plain` to a
win in Node. The board renderer, camera, and HUD arrive in M3 (PLAN §14); until then
`index.html` is a shell that boots the core and prints a placeholder.

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

URL parameters: `?level=plain` picks a level, `?seed=12345` reproduces a game exactly.

## Tests and sim

Node ≥ 20 (dev only — players need only a browser):

```sh
cd slop-sweeper
node --test          # the whole suite
npm test             # same thing
npm run sim          # the policy-bot harness (arrives in M2)
```

## Layout

```
src/core/     zero deps, zero DOM, pure, injected PRNG — the whole game model
src/levels/   charmap level definitions + registry (one file, one line, per level)
src/ui/       canvas board and DOM HUD (M3)
test/         node:test + node:assert
```

**Dependency law:** `core` imports only `core`; `levels` import core; nothing imports `ui`.
Core touching a DOM global breaks the tests immediately, which is the enforcement.
