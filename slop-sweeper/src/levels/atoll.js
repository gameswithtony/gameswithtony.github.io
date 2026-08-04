// @ts-check
// A reef ring of volcano islets around an inner lagoon, breached north-east and south-west
// (PLAN §9). The route has to walk the reef flat most of the way round the island before a
// breach lets it in — this is the level that exercises SPEC §4.2's refund path in anger.
//
// RESCALE (2026-08-04): 18×14 → 34×26. The old reef flat was two to three cells wide,
// which the 12–26-cell blocks would have refused outright — every Generate would refund and
// the level would collapse into hand-only, the exact failure the M2 note in `channel`
// records. The flat is now six cells wide and the lagoon twelve by four, so placement is
// *constrained* rather than impossible: the reef takes any stencil, the lagoon takes
// nothing five cells tall, and `heavy`'s two squares are reef-only.

/** @type {import('./index.js').LevelDef} */
export const atoll = {
  id: 'atoll',
  name: 'The Atoll',
  map: `
..................................
.......####################.......
.....########################.....
....##########################....
...############################...
..##############################..
.################################.
.######^^^^^^^^^^^^^#############.
.######^^^^^^^^^^^^#######^######.
.######^^^^^^^^^^^^#####^^^######.
.######^^^^^^^^^^^####^^^^^######.
.######^^^^############^^^^######.
.######^^^^############^^^^######.
.A#####^^^^######B#####^^^^######.
.######^^^^############^^^^######.
.######^^^^^####^^^^^^^^^^^######.
.######^^^#####^^^^^^^^^^^^######.
.######^#######^^^^^^^^^^^^######.
.#############^^^^^^^^^^^^^######.
.################################.
..##############################..
...############################...
....##########################....
.....########################.....
.......####################.......
..................................
`,
  arrivals: { count: 12, firstTick: 4, every: 2 },
  mineDensity: 0.14,
  shapePool: 'awkward+heavy',
};
