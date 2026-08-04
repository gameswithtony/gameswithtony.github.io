// @ts-check
// Two wide basins joined by a narrow neck (PLAN §9). Every route shares the neck, so the
// trunk decision arrives early and cheaply: one mine in those twenty-four cells takes the
// whole level down, and the fastest rebuild is often to let a user walk into it on purpose
// (SPEC §5 protects that tactic deliberately).
//
// RESCALE (2026-08-04): 24×12 → 46×22, neck widened from two rows to three. Three is the
// load-bearing number: of the ten stencils in `compact+awkward` exactly one — `R12` laid on
// its side, 4×3 — fits a three-row corridor, so generation can cross the neck but only with
// the one block the pool rarely offers. The basins take anything; the neck is where the
// level bites.
//
// RETUNED 2026-08-04 (Analyze became one minesweeper click, SPEC §4.3): reading a block now
// costs several turns instead of one, so every level in the corpus got a looser schedule and
// a lower defect density. See PLAN §9 for the measured trade-off — the hand-only floor and
// the AI path now pull against each other much harder than they did.

/** @type {import('./index.js').LevelDef} */
export const strait = {
  id: 'strait',
  name: 'The Strait',
  map: `
###################........###################
###################........###################
###################........###################
###################........###################
###################........###################
###################........###################
###################........###################
###################........###################
###################........###################
###################........###################
A#############################################
##############################################
#############################################B
###################........###################
###################........###################
###################........###################
###################........###################
###################........###################
###################........###################
###################........###################
###################........###################
###################........###################
`,
  arrivals: { count: 9, firstTick: 1, every: 3 },
  mineDensity: 0.11,
  shapePool: 'compact+awkward',
};
