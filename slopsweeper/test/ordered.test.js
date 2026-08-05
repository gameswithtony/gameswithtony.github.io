// @ts-check
// OPT-IN ORDERED VISITATION (owner decision 2026-08-05; SPEC §6.5).
//
// An itinerary was a *set* of obligations taken in whatever order the walk found them. It may
// now also be a *sequence*: `{ stops: ['B','C','D'], ordered: true }` means B, then C, then D,
// and the user owes `todo[0]` and nothing else until it has stood on it. Crossing a later stop
// on the way does **nothing** — that is what enforcement is made of, and it is the one place
// the feature is more than a change of mask.
//
// The load-bearing test in this file is `LOOSE ITINERARIES ARE UNTOUCHED`, in two parts: the
// mask a loose user hands the field machinery is the identical array it always handed it, and
// a save written before this feature existed — users with no `ordered` key at all — hashes and
// plays exactly as it did. Both are measured against the pre-change semantics rather than
// argued for, because "your live game still works" is not a claim to make on reasoning.
import test from 'node:test';
import assert from 'node:assert/strict';

import { RULES } from '../src/core/rules.js';
import { CON_HAND, effectiveMask } from '../src/core/state.js';
import { waypointField, waypointFields } from '../src/core/routing.js';
import { init, reduce } from '../src/core/reduce.js';
import { validateLevel } from '../src/core/validate.js';
import { hashState } from '../src/sim/hash.js';

/** @typedef {import('../src/core/state.js').GameState} GameState */
/** @typedef {import('../src/core/state.js').Ev} Ev */

/** @param {GameState} s @param {number} n */
function waits(s, n) {
  /** @type {Ev[]} */
  const all = [];
  for (let i = 0; i < n; i++) {
    const r = reduce(s, { t: 'wait' });
    s = r.s;
    all.push(...r.ev);
  }
  return { s, ev: all };
}

/** @param {Ev[]} ev @param {Ev['t']} t */
const only = (ev, t) => ev.filter((e) => e.t === t);

/** Pave every ocean cell, so routing is the only thing under test. */
function paved(/** @type {GameState} */ s) {
  const con = s.con.slice();
  for (let i = 0; i < con.length; i++) if (s.terrain[i] === 'ocean') con[i] = CON_HAND;
  for (const e of [s.origin, ...s.dests]) con[e] = { k: 'none' };
  return { ...s, con };
}

/** @param {GameState} s @param {number} cell @param {import('../src/core/state.js').Con} con */
function built(s, cell, con) {
  const next = { ...s, con: s.con.slice() };
  next.con[cell] = con;
  return next;
}

//  0 1 2 3 4
//  A # B # C        B two steps east of the origin, C four. Anything that walks past B is
//                   walking past a destination on purpose.
const LINE = { id: 'ord-line', map: 'A#B#C', arrivals: { count: 1, firstTick: 0, every: 1 }, patience: 40 };

//  0 1 2 3 4 5 6
//  B # # # A # C    B four steps west, C two steps east: the nearest stop and the first stop
//                   are different stops, which is the whole of what ordering changes.
const SPLIT = { id: 'ord-split', map: 'B###A#C', arrivals: { count: 1, firstTick: 0, every: 1 }, patience: 40 };

// --- (a) the level says so, and the validator lets it ------------------------------------

test('the validator takes both itinerary shapes, and only a boolean for ordered', () => {
  /** @param {object} over @returns {string} */
  const errs = (over) => validateLevel(/** @type {any} */ ({
    id: 'ord-v', map: ['####', 'A##B', '#C#D'].join('\n'), ...over,
  })).errors.join(' | ');

  assert.equal(errs({ itineraries: [['B', 'C']] }), '', 'the array form is untouched');
  assert.equal(errs({ itineraries: [{ stops: ['B', 'C'], ordered: true }] }), '');
  assert.equal(errs({ itineraries: [{ stops: ['B'] }] }), '', 'ordered is optional in the object form too');
  assert.equal(errs({ itineraries: [{ stops: ['B'], ordered: false }, ['C', 'D']] }), '', 'a level may mix them');

  // The stop rules are the same rules, because it is the same loop.
  assert.match(errs({ itineraries: [{ stops: ['E'], ordered: true }] }), /itineraries\[0\] names 'E', which is not a destination/);
  assert.match(errs({ itineraries: [{ stops: ['B', 'B'], ordered: true }] }), /itineraries\[0\] visits 'B' twice/);
  assert.match(errs({ itineraries: [{ stops: [] }] }), /itineraries\[0\] must be a non-empty array/);
  assert.match(errs({ itineraries: [{ ordered: true }] }), /itineraries\[0\] must be a non-empty array/);
  assert.match(errs({ itineraries: [{ stops: ['B'], ordered: 'yes' }] }), /itineraries\[0\]\.ordered must be a boolean/);
  assert.match(errs({ itineraries: [{ stops: ['B'], ordered: 1 }] }), /itineraries\[0\]\.ordered must be a boolean/);
});

test('an ordered list is assigned in AUTHORED order; a loose one is still ascending', () => {
  const level = {
    ...LINE,
    arrivals: { count: 4, firstTick: 0, every: 1 },
    itineraries: [{ stops: ['C', 'B'], ordered: true }, ['C', 'B']],
  };
  const { s } = waits(init(/** @type {any} */ (level), 1), 4);
  assert.equal(s.users.length, 4);

  // dests are B=cell 2 (index 0) and C=cell 4 (index 1).
  assert.deepEqual(s.users[0].todo, [1, 0], 'C first, because the level wrote C first');
  assert.equal(s.users[0].ordered, true);
  assert.deepEqual(s.users[1].todo, [0, 1], 'the same letters, loose, sort ascending as they always did');
  assert.equal(s.users[1].ordered, false, 'and the bit is written out rather than left absent');

  // Cycling is blind to the shape: round-robin by spawn order, no RNG, same every seed.
  assert.deepEqual(s.users[2].todo, s.users[0].todo);
  assert.equal(s.users[2].ordered, true);
  assert.deepEqual(s.users[3].todo, s.users[1].todo);
  assert.equal(s.users[3].ordered, false);
  const other = waits(init(/** @type {any} */ (level), 99999), 4).s;
  assert.deepEqual(other.users.map((u) => `${u.todo.join('')}${u.ordered ? '!' : ''}`),
    s.users.map((u) => `${u.todo.join('')}${u.ordered ? '!' : ''}`), 'a different seed cannot deal a different hand');
});

test('effectiveMask is the whole routing story: [todo[0]] when ordered, todo itself when not', () => {
  const level = { ...LINE, arrivals: { count: 2, firstTick: 0, every: 1 }, itineraries: [{ stops: ['C', 'B'], ordered: true }, ['C', 'B']] };
  const { s } = waits(init(/** @type {any} */ (level), 1), 2);

  assert.deepEqual(effectiveMask(s.users[0]), [1], 'an ordered user owes exactly one thing');
  assert.equal(effectiveMask(s.users[1]), s.users[1].todo, 'and a loose one hands over the identical array');

  // A user with nothing left owes nothing, ordered or not — the arrived case, stated so the
  // helper cannot quietly index into an empty list.
  assert.deepEqual(effectiveMask({ todo: [], ordered: true }), []);
});

// --- (b) routing: the first stop, not the nearest one -------------------------------------

test('an ordered user walks to todo[0] even when a later stop is strictly nearer', () => {
  const ordered = { ...SPLIT, itineraries: [{ stops: ['B', 'C'], ordered: true }] };
  const loose = { ...SPLIT, itineraries: [['B', 'C']] };

  const a = waits(paved(init(/** @type {any} */ (ordered), 1)), 2).s;
  const b = waits(paved(init(/** @type {any} */ (loose), 1)), 2).s;

  assert.equal(a.users[0].at, 3, 'ordered: west, toward B, four steps away');
  assert.equal(b.users[0].at, 5, 'loose: east, toward C, two steps away');

  // …and the field says the same thing before anybody moves: the mask is the destination set.
  const start = paved(init(/** @type {any} */ (ordered), 1));
  assert.equal(waypointField(start, [0]).dist[start.origin], 4, 'B is four away');
  assert.equal(waypointField(start, [0, 1]).dist[start.origin], 2, 'and the loose composite finds C at two');
});

test('the departure gate is per effective mask: an open later stop does NOT let an ordered user leave', () => {
  //  B # A # C with only the eastern arm built. C is reachable; B, which is all this user owes
  //  right now, is not. THIS is what enforcement costs the player: the user stands there.
  const level = { id: 'ord-gate', map: 'B#A#C', arrivals: { count: 1, firstTick: 0, every: 1 }, patience: 40 };
  const ordered = built(init(/** @type {any} */ ({ ...level, itineraries: [{ stops: ['B', 'C'], ordered: true }] }), 1), 3, CON_HAND);
  const loose = built(init(/** @type {any} */ ({ ...level, itineraries: [['B', 'C']] }), 1), 3, CON_HAND);

  const a = waits(ordered, 3);
  assert.equal(a.s.users[0].state, 'queued', 'it never left');
  assert.equal(only(a.ev, 'departed').length, 0);
  assert.equal(a.s.users[0].waited, 3, 'and it is burning patience while it waits for its own leg');

  const b = waits(loose, 3);
  assert.equal(b.s.users[0].state, 'moving', 'the same letters, loose, went east on tick one');

  // The HUD's own question agrees, which is the point of asking it per user (routing.js).
  const opened = built(a.s, 1, CON_HAND);
  const { s: after, ev } = waits(opened, 2);
  assert.deepEqual(only(ev, 'departed').map((e) => /** @type {any} */ (e).user), [0]);
  assert.equal(after.users[0].at, 0, 'and it walked west to B, the stop it owed all along');
});

// --- (c) the enforcement itself ------------------------------------------------------------

test('CROSSING A LATER STOP DOES NOTHING: no tick-off, no refill, no fresh trail', () => {
  //  A # B # C, ordered C-then-B: the walk to C runs straight over B, and B stays owed.
  //  Patience 21 is deliberately odd, so an accidental refill would be unmistakable.
  const PATIENCE = 21;
  const level = {
    ...LINE, patience: PATIENCE,
    itineraries: [{ stops: ['C', 'B'], ordered: true }],
  };
  let s = init(/** @type {any} */ (level), 1);
  s = waits(s, 14).s;                              // queued with the gate shut: 14 ticks owed
  assert.equal(s.users[0].waited, 14);
  s = built(built(s, 1, CON_HAND), 3, CON_HAND);   // now the whole line is walkable

  const first = waits(s, 2);                        // depart+step to 1, then step onto B
  s = first.s;
  assert.equal(s.users[0].at, 2, 'it is standing on B');
  assert.equal(only(first.ev, 'visited').length, 0, 'and nothing happened');
  assert.deepEqual(s.users[0].todo, [1, 0], 'B is still owed, and still second');
  assert.equal(s.users[0].waited, 14, 'no refill: a stop out of turn is not a stop');
  assert.deepEqual(s.users[0].visited, [0, 1, 2], 'and the no-revisit trail was not reset');

  const second = waits(s, 2);                       // step to 3, then onto C — its actual stop
  s = second.s;
  assert.deepEqual(only(second.ev, 'visited'), [{ t: 'visited', user: 0, dest: 4 }], 'C is the stop it owed');
  assert.deepEqual(s.users[0].todo, [0], 'so C came off and B is now first');
  assert.equal(s.users[0].waited, 14 - Math.round(PATIENCE * RULES.DEST_REFILL), 'the refill is paid on the real stop');
  assert.deepEqual(s.users[0].visited, [4], 'and the trail starts again from there');

  const third = waits(s, 2);                        // back west: 3, then B — now its turn
  s = third.s;
  assert.deepEqual(only(third.ev, 'arrived'), [{ t: 'arrived', user: 0 }], 'B is the last stop, so B is arrival');
  assert.equal(s.stats.served, 1, 'it walked the line twice and is still worth one point');
  assert.deepEqual(s.users[0].todo, []);
});

test('the same walk, loose, ticks B off in passing — which is the rule ordering opts out of', () => {
  const level = { ...LINE, patience: 21, itineraries: [['C', 'B']] };
  let s = init(/** @type {any} */ (level), 1);
  s = waits(s, 14).s;
  s = built(built(s, 1, CON_HAND), 3, CON_HAND);

  const { s: after, ev } = waits(s, 2);
  assert.equal(after.users[0].at, 2);
  assert.deepEqual(only(ev, 'visited'), [{ t: 'visited', user: 0, dest: 2 }], 'visited on contact (SPEC §6.5)');
  assert.deepEqual(after.users[0].todo, [1], 'B came off on the spot');
  assert.equal(after.users[0].waited, 14 - Math.round(21 * RULES.DEST_REFILL), 'and it was paid for');
});

test('a destination on nobody\'s list is still just a cell, ordered or not', () => {
  const level = { ...LINE, itineraries: [{ stops: ['C'], ordered: true }] };
  let s = init(/** @type {any} */ (level), 1);
  s = built(built(s, 1, CON_HAND), 3, CON_HAND);
  const { s: end, ev } = waits(s, 5);
  assert.equal(only(ev, 'visited').length, 0, 'crossing B did nothing at all');
  assert.deepEqual(only(ev, 'arrived'), [{ t: 'arrived', user: 0 }]);
  assert.equal(end.stats.served, 1);
});

// --- (d) the post-blast recompute asks the same question ----------------------------------

test('a crater on the current leg strands an ordered user even when a later stop is wide open', () => {
  //  y0:  A # # M B      the B route, mined at M
  //  y1:  #              the only way south…
  //  y2:  C              …to C, which this user also owes — later.
  const level = {
    id: 'ord-blast',
    map: ['A###B', '#....', 'C....'].join('\n'),
    arrivals: { count: 2, firstTick: 9999, every: 9999 },
    blastRadius: 0,                                  // the crater is the trigger cell and nothing else
  };
  const s = init(level, 1);
  s.con[1] = CON_HAND;
  s.con[2] = CON_HAND;
  s.con[3] = { k: 'aiHidden', mine: true, block: 0, flagged: false };
  s.con[5] = CON_HAND;                               // A → (0,1) → C, untouched by any of this
  s.blocks = [{ id: 0, cells: [3] }];
  s.users = [
    { id: 0, at: 1, state: 'moving', todo: [0, 1], visited: [0, 1], stalled: false, waited: 0, ordered: true },
    { id: 1, at: 2, state: 'moving', todo: [0], visited: [0, 1, 2], stalled: false, waited: 0 },
  ];
  s.schedule = { ...s.schedule, total: 2, spawned: 2 };

  const { s: after, ev } = reduce(s, { t: 'wait' });
  assert.equal(ev.some((e) => e.t === 'detonate'), true, 'user 1 found the defect');
  assert.equal(after.users[1].state, 'gone');
  assert.equal(after.users[0].at, 2, 'user 0 had already stepped');
  assert.equal(after.users[0].stalled, true, 'and the recompute caught it on ITS leg, which is B');

  // The discriminator, stated rather than implied: with the whole tour on the mask this user
  // has somewhere to go — C is reachable the other way — and it is still stuck, because the
  // only thing it owes right now is B.
  assert.ok(waypointField(after, [0, 1]).dist[2] > 0, 'the loose mask has a live route');
  assert.equal(waypointField(after, [0]).dist[2], -1, 'the ordered one does not');
});

// --- (e) THE REGRESSION GUARANTEE ----------------------------------------------------------

//  x: 0 1 2 3 4
//  0  . . B . .
//  1  . # # # .
//  2  D # A # C
//  3  . # # # .
//  4  . . E . .
const PLUS = {
  id: 'ord-plus',
  map: ['..B..', '.###.', 'D#A#C', '.###.', '..E..'].join('\n'),
  arrivals: { count: 6, firstTick: 0, every: 1 },
  patience: 40,
};

test('LOOSE ITINERARIES ARE UNTOUCHED: the mask handed to the fields is still `todo` itself', () => {
  // A four-destination board with three loose lists on it, played out far enough to have
  // walkers, a queue and users on different legs at once. On every tick, every live user's
  // effective mask is asserted to BE its `todo` — by object identity, not by value — and the
  // field it gets is asserted to be the field `waypointField(s, u.todo)` produced before any
  // of this existed. That is the pre-change semantics, checked directly.
  const level = { ...PLUS, itineraries: [['B'], ['C', 'E'], ['B', 'C', 'D', 'E']] };
  let s = paved(init(/** @type {any} */ (level), 3));
  let checked = 0;

  for (let n = 0; n < 30 && s.phase.k === 'play'; n++) {
    const fields = waypointFields(s);
    for (const u of s.users) {
      if (u.state !== 'queued' && u.state !== 'moving') continue;
      assert.equal(u.ordered, false, 'a loose level spawns nobody ordered');
      assert.equal(effectiveMask(u), u.todo, 'the mask is the list, by identity');
      assert.deepEqual(fields.for(effectiveMask(u)), waypointField(s, u.todo), `tick ${s.tick}: the field moved`);
      checked++;
    }
    s = reduce(s, { t: 'wait' }).s;
  }
  assert.ok(checked > 20, `only ${checked} user-ticks were compared`);
});

test('A SAVE FROM BEFORE THE FEATURE: users with no `ordered` key hash and play identically', () => {
  const level = { ...PLUS, itineraries: [['B'], ['C', 'E']] };
  const { s } = waits(paved(init(/** @type {any} */ (level), 3)), 6);
  assert.ok(s.users.length >= 3);

  // Exactly what a v3 save carries: the field did not exist when it was written.
  const v3 = JSON.parse(JSON.stringify(s));
  for (const u of v3.users) delete u.ordered;
  assert.ok(v3.users.every((/** @type {any} */ u) => !('ordered' in u)), 'the key really is gone');

  assert.equal(hashState(v3), hashState(s), 'absent must fingerprint exactly as false');
  for (let n = 0; n < 20; n++) {
    const a = reduce(s, { t: 'wait' });
    const b = reduce(v3, { t: 'wait' });
    assert.deepEqual(b.ev, a.ev, 'the two runs diverged in their events');
    assert.equal(hashState(b.s), hashState(a.s));
    if (a.s.phase.k !== 'play') break;
  }

  // …and the bit is in the fingerprint the moment it is true, which is the other half: two
  // users owing the same two stops from the same cell are different users if one may only
  // have the first of them.
  const flipped = { ...s, users: s.users.map((u, i) => (i === 0 ? { ...u, ordered: true } : u)) };
  assert.notEqual(hashState(flipped), hashState(s));
});
