// @ts-check
// The sixteen colours of PLAN §11.1, declared once. Nothing drawn on the board may use a
// colour that is not a value in this table — that constraint, plus dithering instead of
// alpha, is most of what makes procedural rendering read as pixel art (SPEC §10.8).

export const PALETTE = Object.freeze({
  INK: '#16131c',            // outlines, clue text, badge backing
  PAPER: '#f2efe4',          // light marks on dark fills
  VOID: '#0d1016',           // background; VOID cells are never filled as board (SPEC §10.7)
  OCEAN: '#14324f',
  OCEAN_DITHER: '#1a4066',
  COAST: '#e8dcc0',          // coastline stroke along the VOID boundary
  HAND: '#c98f3f',
  HAND_DITHER: '#7d5a26',
  AI_HIDDEN: '#6b4d93',
  AI_HIDDEN_DITHER: '#57407a',
  AI_REVEALED: '#a08cc0',
  VOLCANO: '#4a4650',
  RED: '#d4405c',            // endpoints, confirmed mines, invalid ghost, lava speckle
  USER: '#ffd23e',
  SELECT: '#55d6ff',
  OK: '#4ade80',             // legal anchors, valid ghost
});

/** @typedef {keyof typeof PALETTE} PaletteRole */
