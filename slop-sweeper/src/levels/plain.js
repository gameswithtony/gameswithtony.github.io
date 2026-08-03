// @ts-check
// The control level (PLAN §9): an open 16×11 rectangle, endpoints on opposite edges
// midway up. No terrain to read, so it asks the fun question in its purest form.

/** @type {import('./index.js').LevelDef} */
export const plain = {
  id: 'plain',
  name: 'Plain Sailing',
  map: `
################
################
################
################
################
A##############B
################
################
################
################
################
`,
  arrivals: { count: 10, firstTick: 4, every: 3 },
  mineDensity: 0.18,
  shapePool: 'compact',
};
