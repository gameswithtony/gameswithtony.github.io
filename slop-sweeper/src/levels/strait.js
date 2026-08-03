// @ts-check
// Two wide basins joined by a two-cell neck (PLAN §9). Every route shares the neck, so the
// trunk decision arrives early and cheaply: one mine in those twelve cells takes the whole
// level down, and the fastest rebuild is often to let a user walk into it on purpose
// (SPEC §5 protects that tactic deliberately).

/** @type {import('./index.js').LevelDef} */
export const strait = {
  id: 'strait',
  name: 'The Strait',
  map: `
#########......#########
#########......#########
#########......#########
#########......#########
#########......#########
A#######################
#######################B
#########......#########
#########......#########
#########......#########
#########......#########
#########......#########
`,
  arrivals: { count: 16, firstTick: 0, every: 2 },
  mineDensity: 0.18,
  shapePool: 'compact+awkward',
};
