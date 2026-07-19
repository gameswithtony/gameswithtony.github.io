// classes.js — STUB (WP1). One class, enough to boot the pipeline.
// WP2 replaces this with all four (Vibe Coder, Bootcamp Grad, Greybeard,
// Craftsperson) per economy doc §Baseline numbers. Marked stub on purpose.
//
// Shape (frozen enough for WP1):
//   id, name, cash, skills{coding,debugging,judgment} (Understanding truth),
//   floorProfile ('doing'|'watching'|'high'), multiplier (scoring),
//   quirks: { capacityBonus, tokenMult, freeFrontier }

export const classes = [
  {
    id: 'vibe',
    name: 'Vibe Coder',              // STUB
    cash: 8000,
    skills: { coding: 30, debugging: 20, judgment: 25 },
    floorProfile: 'doing',
    multiplier: 1.0,
    quirks: { capacityBonus: 0, tokenMult: 1.0, freeFrontier: true }
  }
];

export function getClass(id) {
  return classes.find((c) => c.id === id) || classes[0];
}

export default classes;
