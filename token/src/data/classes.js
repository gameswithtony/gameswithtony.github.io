// classes.js — the four professions (Oregon Trail's banker-to-farmer choice, in
// dev-shop drag). Each is a starting position AND a score multiplier: the softer
// the start, the smaller the trophy. Source: economy doc §Baseline numbers.
//
// ── HOW TO ADD / EDIT A CLASS ────────────────────────────────────────────────
// A class is plain data. Shape (all fields required unless noted):
//   id            unique string, referenced by initState(classId, ...)
//   name          display name
//   cash          starting money
//   skills        { coding, debugging, judgment }  — TRUE hidden Understanding at
//                 month 1 (Confidence starts equal — you begin calibrated)
//   floorProfile  'doing' | 'watching' | 'high'  — the decay floor for learned
//                 skills. state.js maps 'doing'/'high' -> floors.doing (40),
//                 'watching' -> floors.watching (0). 'high' is a hook for a
//                 deeper floor later; today it behaves like 'doing'.
//   multiplier    final-score multiplier (the risk/reward dial)
//   quirks        engine-read hooks, all optional (default 0/1/false):
//                   capacityBonus  +N review capacity every month
//                   tokenMult      multiplies every AI token cost (distrust tax)
//                   freeFrontier   true => frontier-tier tokens are free
//   blurb         one deadpan line for the outfitting screen (UI only)
//
// Keep skills 0–100. The clerk's advice — "hire the QA, nobody listens" — is UI.
// ─────────────────────────────────────────────────────────────────────────────

export const classes = [
  {
    id: 'vibe',
    name: 'Vibe Coder',
    cash: 8000,
    skills: { coding: 30, debugging: 20, judgment: 25 },
    floorProfile: 'doing',
    multiplier: 1.0,
    quirks: { capacityBonus: 0, tokenMult: 1.0, freeFrontier: true },
    blurb: 'Frontier tokens come free. So does the not-knowing.'
  },
  {
    id: 'bootcamp',
    name: 'Bootcamp Grad',
    cash: 5000,
    skills: { coding: 40, debugging: 35, judgment: 35 },
    floorProfile: 'doing',
    multiplier: 1.5,
    quirks: { capacityBonus: 1, tokenMult: 1.0, freeFrontier: false },
    blurb: 'Twelve weeks, a certificate, and one extra pair of reviewing eyes.'
  },
  {
    id: 'greybeard',
    name: 'Greybeard',
    cash: 4000,
    skills: { coding: 70, debugging: 75, judgment: 65 },
    floorProfile: 'doing',
    multiplier: 2.0,
    quirks: { capacityBonus: 0, tokenMult: 1.25, freeFrontier: false },
    blurb: 'Distrusts the machine on principle. Charges himself 25% for using it.'
  },
  {
    id: 'craftsperson',
    name: 'Craftsperson',
    cash: 2500,
    skills: { coding: 60, debugging: 60, judgment: 70 },
    floorProfile: 'high',
    multiplier: 2.5,
    quirks: { capacityBonus: 0, tokenMult: 1.0, freeFrontier: false },
    blurb: 'Learned it deep. Learned it slow. Two thousand five hundred dollars.'
  }
];

export function getClass(id) {
  return classes.find((c) => c.id === id) || classes[0];
}

export default classes;
