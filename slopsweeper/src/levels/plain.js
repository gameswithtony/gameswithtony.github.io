// @ts-check
// The control level (PLAN §9): an open 32×20 rectangle, endpoints on opposite edges
// midway down. No terrain to read, so it asks the fun question in its purest form.
//
// RESCALE (2026-08-04, user decision): 16×11 → 32×20, roughly double linear size, because
// the 12–26-cell blocks of the revised shape table (PLAN §10) landed on the old board like
// furniture in a doll's house. The route is now 31 tiles rather than 15, so hand-only is a
// thirty-turn build — still winnable here, which is what makes this the control.
//
// RETUNED 2026-08-04 (Analyze became one minesweeper click, SPEC §4.3): reading a generated
// block costs several turns now instead of one, so the schedule loosened to 9/6/4 and the
// density fell to 0.12. `plain` is the level with no floor to protect — hand-only is *meant*
// to win here — so it is the one that could absorb the change cleanly.

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
  arrivals: { count: 9, firstTick: 4, every: 3 },
  patience: 5,
  mineDensity: 0.12,
  betaSupply: 1,
  shapePool: 'awkward',
};
