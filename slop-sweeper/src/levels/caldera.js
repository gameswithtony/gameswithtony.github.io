// @ts-check
// A volcano cluster squatting in the middle of open water, with two satellites fouling the
// northern and southern bypasses (PLAN §9). Volcano cells pull in two directions at once
// (SPEC §5): they stop blasts, so building against them contains the damage — and they
// delete legal placements, so building against them is exactly where a block will not fit.
//
// RESCALE (2026-08-04): 20×14 → 38×26. The bypasses are now eight cells tall where they are
// open and exactly three where a satellite squats on them, which is the interesting number:
// three rows admit `R12` on its side and nothing else in the pool, so the pinch is a real
// decision (crawl through by hand, or spend turns going the long way round with blocks).

/** @type {import('./index.js').LevelDef} */
export const caldera = {
  id: 'caldera',
  name: 'The Caldera',
  map: `
#######^^^^^^^^^######################
######^^^^^^^^^^^#####################
######^^^^^^^^^^^#####################
#######^^^^^^^^^######################
#########^^^^^########################
######################################
######################################
######################################
#################^^^^#################
############^^^^^^^^^^^^^^############
#########^^^^^^^^^^^^^^^^^^^^#########
########^^^^^^^^^^^^^^^^^^^^^^########
A#######^^^^^^^^^^^^^^^^^^^^^^########
########^^^^^^^^^^^^^^^^^^^^^^#######B
########^^^^^^^^^^^^^^^^^^^^^^########
#########^^^^^^^^^^^^^^^^^^^^#########
############^^^^^^^^^^^^^^############
#################^^^^#################
######################################
######################################
######################################
########################^^^^^#########
######################^^^^^^^^^#######
#####################^^^^^^^^^^^######
#####################^^^^^^^^^^^######
######################^^^^^^^^^#######
`,
  arrivals: { count: 10, firstTick: 2, every: 3 },
  mineDensity: 0.12,
  shapePool: 'compact+awkward',
};
