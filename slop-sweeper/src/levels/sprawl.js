// @ts-check
// Open water, wall to wall, on a tight cadence (PLAN §9). Nothing to read anywhere in the
// middle: no coastline to place against, no volcano to shelter behind, and fifty-two tiles
// between the endpoints. This is where the thesis of SPEC §1 bites — the cadence makes
// hand-building unaffordable and the open water makes generated ground unreadable, so the
// only question left is dosage.
//
// TUNING NOTE (M2, still binding): the endpoints started in opposite corners. The last user
// then arrived around tick 90 in every winning game, well past the target band, because the
// walk alone is the length of the diagonal and the arrival tail runs on top of it. Pulling
// them to opposite *edges* keeps "far" and "anchor-poor" while bringing the session back
// inside the band.
//
// RESCALE (2026-08-04): 26×16 → 50×30. The same trap is twice as easy to fall into at this
// size, so the endpoints are only three rows apart and the schedule is short: the route is 52
// tiles, and 52 of the session's ticks are the walk no matter how well you build. `count` and
// `every` are chosen so the last user spawns by tick 30 — the sim still medians around 99,
// the highest in the corpus and the one level that sits above PLAN §13's relaxed band.

/** @type {import('./index.js').LevelDef} */
export const sprawl = {
  id: 'sprawl',
  name: 'The Sprawl',
  map: `
##################################################
##################################################
##################################################
##################################################
##################################################
##################################################
##################################################
##################################################
##################################################
##################################################
##################################################
##################################################
##################################################
A#################################################
##################################################
##################################################
#################################################B
##################################################
##################################################
##################################################
##################################################
##################################################
##################################################
##################################################
##################################################
##################################################
##################################################
##################################################
##################################################
##################################################
`,
  arrivals: { count: 10, firstTick: 3, every: 3 },
  mineDensity: 0.10,
  shapePool: 'awkward+heavy',
};
