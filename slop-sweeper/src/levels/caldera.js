// @ts-check
// A volcano cluster squatting in the middle of open water, with two satellites fouling the
// northern and southern bypasses (PLAN §9). Volcano cells pull in two directions at once
// (SPEC §5): they stop blasts, so building against them contains the damage — and they
// delete legal placements, so building against them is exactly where a block will not fit.

/** @type {import('./index.js').LevelDef} */
export const caldera = {
  id: 'caldera',
  name: 'The Caldera',
  map: `
####################
###^^^##############
##^^^^^#############
###^^^##############
#######^^^^^^#######
######^^^^^^^^######
A####^^^^^^^^^^#####
#####^^^^^^^^^^####B
######^^^^^^^^######
#######^^^^^^#######
##############^^^^##
##############^^^^##
##############^^^^##
####################
`,
  arrivals: { count: 14, firstTick: 2, every: 2 },
  mineDensity: 0.2,
  shapePool: 'compact+awkward',
};
