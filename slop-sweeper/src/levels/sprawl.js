// @ts-check
// Open water, wall to wall, on a tight cadence (PLAN §9). Nothing to read anywhere in the
// middle: no coastline to place against, no volcano to shelter behind, and thirty-two tiles
// between the endpoints. This is where the thesis of SPEC §1 bites — the cadence makes
// hand-building unaffordable and the open water makes generated ground unreadable, so the
// only question left is dosage.
//
// TUNING NOTE (M2): the endpoints started in opposite corners, a forty-tile route. The last
// user then arrived around tick 90 in every winning game, well past PLAN §13's 35–70 target,
// because the walk alone is forty ticks and the arrival tail runs on top of it. Pulling them
// to opposite edges rather than opposite corners keeps "far" and "anchor-poor" while
// bringing the session back inside the band.

/** @type {import('./index.js').LevelDef} */
export const sprawl = {
  id: 'sprawl',
  name: 'The Sprawl',
  map: `
##########################
##########################
##########################
##########################
A#########################
##########################
##########################
##########################
##########################
##########################
##########################
#########################B
##########################
##########################
##########################
##########################
`,
  arrivals: { count: 12, firstTick: 3, every: 2 },
  mineDensity: 0.24,
  shapePool: 'awkward+heavy',
};
