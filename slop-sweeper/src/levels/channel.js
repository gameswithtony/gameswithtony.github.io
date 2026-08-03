// @ts-check
// A channel descending diagonally across a mostly-void board (PLAN §9). Almost every cell
// touches coastline, which per SPEC §7.5 makes the deduction layer *easier* while the
// routing layer gets tighter — the axis this level exists to isolate.
//
// TUNING NOTE (M2): the first draft was a true diagonal band four cells wide, shifting two
// columns per row. It measured badly for a reason worth writing down: consecutive rows
// overlapped in only two columns, so nothing three cells tall could ever land, and three of
// the five `compact` shapes fit *nowhere on the board* — 60% of Generates refunded and the
// level collapsed into hand-only. A staircase of three-row landings keeps the coastline
// density and the diagonal read while giving blocks somewhere to sit.

/** @type {import('./index.js').LevelDef} */
export const channel = {
  id: 'channel',
  name: 'The Channel',
  map: `
#######...............
A######...............
#######...............
.....#########........
.....#########........
.....#########........
............##########
............#########B
............##########
`,
  arrivals: { count: 14, firstTick: 3, every: 2 },
  mineDensity: 0.18,
  // PLAN §9 writes this pool as 'compact+'; empty segments resolve to nothing, so it is
  // exactly `compact` — see levels/README.md for the pool grammar.
  shapePool: 'compact+',
};
