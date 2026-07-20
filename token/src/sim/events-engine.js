// events-engine.js — the deck machinery: filter by predicate, weighted draw.
// Three tiny pure operations, per economy doc §Event system. Predicates are JS
// functions `when(s)`; a throwing predicate is treated as not-eligible so a bad
// edit can never crash a live run (the schema test catches it earlier).
//
// MOREFUN D5: an entry may declare `minMonth` — it is not drawable before that
// month, and the schema test grants it that quarter's larger effect caps.

/** Entries whose month gate passes and whose `when(state)` is truthy.
 *  Throwing predicates are excluded. */
export function eligible(state, deck) {
  return deck.filter((e) => {
    if (e.minMonth && state.month < e.minMonth) return false;
    try { return e.when ? e.when(state) : true; }
    catch { return false; }
  });
}

/** Weighted random draw from a list of {weight} entries. Null if empty. */
export function weightedDraw(list, rng) {
  if (!list.length) return null;
  const total = list.reduce((a, e) => a + (e.weight ?? 1), 0);
  if (total <= 0) return list[0];
  let r = rng.next() * total;
  for (const e of list) {
    r -= (e.weight ?? 1);
    if (r < 0) return e;
  }
  return list[list.length - 1];
}

/** Filter a deck by predicate, then weighted-draw one entry (or null). */
export function drawEvent(state, deck, rng) {
  return weightedDraw(eligible(state, deck), rng);
}

export default drawEvent;
