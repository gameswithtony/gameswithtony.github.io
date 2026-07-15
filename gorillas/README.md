# GORILLAS

A browser tribute to QBasic `GORILLA.BAS` (IBM, 1991) — two gorillas on a city skyline throwing
exploding bananas by angle and power, rebuilt with a **wide destructible city** and a **dynamic
camera**. Pure HTML/CSS/JS: no framework, no build step, no dependencies.

## Run it

ES modules need HTTP, so serve the directory with any static server, e.g.:

```
cd gorillas
python -m http.server 8000
# → http://localhost:8000/
```

Or just visit the hosted site — deploying is copying this directory.

## How to play

- **1 Player** vs. an adaptive AI (Easy / Medium / Hard) or **2 Players** hotseat.
- Aim by **typing angle (degrees) and power (0–100)** — the original interface — or **drag back
  from your gorilla like a slingshot** (works with touch). Arrow keys nudge, Enter throws,
  Esc pauses, M mutes.
- Wind is the horizontal arrow at the bottom. Gravity and wind behavior are configurable in setup.
- Direct hit wins the round. Blowing **yourself** up gives the point to your opponent — and is,
  as ever, legal and hilarious.

## What's different from 1991

- The city is **four screens wide**. Wild misses blow real holes in the outer neighborhoods, and
  the camera pulls back to frame high lobs and long shots.
- Terrain damage is **pixel-persistent within a round**: dig a tunnel through the tower between
  you, volley by volley, then thread a banana through the gap. Nothing collapses, nothing heals
  mid-round. Every new round deals a fresh skyline, just like the original.
- A banana that leaves the map may **boomerang back on the wind** — the camera waits for it.
- Sounds, a victory chest-beat, the shocked sun, the spinning banana, and the randomly lit
  windows all survive.

## Design docs

- `SPEC.md` — the authoritative technical specification (invariants, constants, acceptance list).
- `PLAN.md` — implementation plan: decisions, deviations, module APIs, algorithms.
- `gorilla.bas` — the original, for reference and reverence.

## Credits

Original game © IBM Corporation 1991, shipped with MS-DOS 5.0 QBasic.
This tribute: Games With Tony. All art drawn procedurally at runtime; sounds in `sounds/`.
