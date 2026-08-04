// @ts-check
// The control level (PLAN §9): an open 32×20 rectangle, endpoints on opposite edges
// midway down. No terrain to read, so it asks the fun question in its purest form.
//
// RESCALE (2026-08-04, user decision): 16×11 → 32×20, roughly double linear size, because
// the 12–26-cell blocks of the revised shape table (PLAN §10) landed on the old board like
// furniture in a doll's house. The route is now 31 tiles rather than 15, so hand-only is a
// thirty-turn build — still winnable here, which is what makes this the control.

/** @type {import('./index.js').LevelDef} */
export const plain = {
  id: 'plain',
  name: 'Plain Sailing',
  map: `
################################
################################
################################
################################
################################
################################
################################
################################
################################
################################
A##############################B
################################
################################
################################
################################
################################
################################
################################
################################
################################
`,
  arrivals: { count: 10, firstTick: 4, every: 3 },
  mineDensity: 0.12,
  shapePool: 'compact',
};
