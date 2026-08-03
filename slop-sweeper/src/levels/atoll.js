// @ts-check
// A reef ring of volcano islets around an inner lagoon, breached north-east and south-west
// (PLAN §9). The reef flat is two to three cells wide, so the awkward pentominoes routinely
// fit nowhere at all — this is the level that exercises SPEC §4.2's refund path in anger.

/** @type {import('./index.js').LevelDef} */
export const atoll = {
  id: 'atoll',
  name: 'The Atoll',
  map: `
........##........
....##########....
...#####^^#####...
..###^^^^^######..
.###^^^######^###.
.##^^^######^^^##.
#A#^^########^^###
###^^####B###^^###
.##^^^######^^^##.
.###^######^^^###.
..######^^^^^###..
...#####^^#####...
....##########....
........##........
`,
  arrivals: { count: 12, firstTick: 4, every: 3 },
  mineDensity: 0.2,
  shapePool: 'awkward+heavy',
};
