// @ts-check
// MULTI-DESTINATION ITINERARIES (user decision 2026-08-05; SPEC §2.4/§6, §9.2.2).
//
// A level may mark several destinations, B, C, D…, and each user carries a list of the ones it
// still has to visit, in any order. The lists are authored by the level and cycled by spawn
// order — no RNG anywhere near them. Reaching one on the list ticks it off **on contact**,
// hands back half a bar of patience if there is more to do, and is arrival if there is not.
//
// The load-bearing test in this file is `ONE DESTINATION`. A level with a single 'B' has to
// play exactly the game it played before any of this existed, and the mechanism is that its
// users all carry the same one-element list — so the per-mask field is measured directly
// against the field the beta work left behind, rather than argued for.
import test from 'node:test';
import assert from 'node:assert/strict';

import { RULES } from '../src/core/rules.js';
import { CON_HAND } from '../src/core/state.js';
import { cellAt, parseMap } from '../src/core/grid.js';
import {
  canProgress, compositePotential, distField, gateOpen, pathComplete, potentialField,
  waypointField,
} from '../src/core/routing.js';
import { init, reduce } from '../src/core/reduce.js';
import { validateLevel } from '../src/core/validate.js';
import { hashState } from '../src/sim/hash.js';
import { makePolicy } from '../src/sim/policies.js';
import { allLevels, getLevel } from '../src/levels/index.js';

/** @typedef {import('../src/core/state.js').GameState} GameState */
/** @typedef {import('../src/core/state.js').Ev} Ev */
/** @typedef {import('../src/core/state.js').Action} Action */

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

// --- (a) the charmap carries the destinations ------------------------------------------

test('B, C, D… are destinations in letter order, and the letters must not have gaps', () => {
  const m = parseMap('A#B#C#D');
  assert.equal(m.origin, 0);
  assert.deepEqual(m.dests, [2, 4, 6], "dests[0] is 'B', dests[1] is 'C', dests[2] is 'D'");

  // Everything parseMap always said about 'B' it now says about each of them.
  assert.throws(() => parseMap('A#B#C#C'), /more than one 'C'/);
  assert.throws(() => parseMap('A#B#D'), /has 'D' but no 'C'/);
  assert.throws(() => parseMap('A#B#C#E'), /has 'E' but no 'D'/);
  assert.throws(() => parseMap('A###'), /no destination 'B'/);
  assert.throws(() => parseMap('A#C#D'), /no destination 'B'/, 'the missing first letter is its own message');
  // The cap is 'H'; past it a letter is a typo, not a level.
  assert.deepEqual(parseMap('A#B#C#D#E#F#G#H').dests.length, 7);
  assert.throws(() => parseMap('A#B#I'), /unknown map character 'I'/);
});

test('the validator checks every destination, and the itineraries that name them', () => {
  /** @param {object} over @returns {string} */
  const errs = (over) => validateLevel(/** @type {any} */ ({
    id: 'it-v', map: ['####', 'A##B', '#C#D'].join('\n'), ...over,
  })).errors.join(' | ');

  assert.equal(errs({}), '');
  assert.match(errs({ itineraries: [['B'], ['E']] }), /itineraries\[1\] names 'E', which is not a destination/);
  assert.match(errs({ itineraries: [['B', 'B']] }), /itineraries\[0\] visits 'B' twice/);
  assert.match(errs({ itineraries: [[]] }), /itineraries\[0\] must be a non-empty array/);
  assert.match(errs({ itineraries: 'B' }), /itineraries must be an array/);
  assert.match(errs({ destRefill: 1.5 }), /destRefill must be a fraction in \[0, 1\]/);
  assert.match(errs({ destRefill: -0.1 }), /destRefill must be a fraction/);
  assert.equal(errs({ destRefill: 0 }), '', 'zero is a level where a stop buys only the walk');
  assert.equal(errs({ destRefill: 1 }), '', 'and one is a level where it resets the clock');

  // Each unreachable destination is named, because "unwinnable" is useless without a leg.
  assert.match(
    validateLevel(/** @type {any} */ ({ id: 'it-cut', map: ['A#B^C'].join('\n') })).errors.join(' | '),
    /no ocean connectivity from 'A' to 'C'/,
  );
});

// --- (b) THE REGRESSION GUARANTEE --------------------------------------------------------

test('ONE DESTINATION: the per-mask field IS the field the betas left behind', () => {
  // A real mid-game board rather than a fixture: a bot plays caldera long enough to put slop,
  // reveals, craters, walkers and a live queue on it, and on every tick the mask machinery is
  // compared against the single-target field it generalizes.
  //
  // Caldera with its extra destinations stripped back out (rev. 2026-08-06): the multi-dest
  // pass left no registered level with one destination, and one destination is this test's
  // entire subject — the degenerate mask the machinery must reduce to. Stripping `C`… from
  // the live map (and the cast that names them) keeps the mid-game realism without freezing
  // a copy of the level in this file.
  const caldera = getLevel('caldera');
  const single = { ...caldera, map: caldera.map.replace(/[C-H]/g, '#'), walkers: [], itineraries: [] };
  let s = init(/** @type {any} */ (single), 20260805);
  const bot = makePolicy('balanced:0.5', 20260805);
  let checked = 0;

  for (let n = 0; n < 120 && (s.phase.k === 'play' || s.phase.k === 'placing'); n++) {
    assert.equal(s.dests.length, 1);
    const mask = [0];
    // The composite over a one-element mask is the destination's own field, by identity —
    // not a copy of it, which is what guarantees the guard compares the same numbers.
    assert.equal(compositePotential(s, mask), potentialField(s, s.dests[0]));

    const wf = waypointField(s, mask);
    const dist = distField(s);
    assert.deepEqual(wf.dist, dist, `tick ${s.tick}: the mask field diverged from distField`);
    assert.deepEqual(wf.dist, waypointField(s).dist, 'the default mask is every destination');
    for (let i = 0; i < s.con.length; i++) assert.equal(canProgress(s, wf, i), dist[i] > 0);

    // And the two questions the sim and the HUD ask are the one topological question again.
    assert.equal(pathComplete(s), dist[s.origin] >= 0, `tick ${s.tick}: pathComplete disagrees`);
    assert.equal(gateOpen(s), dist[s.origin] >= 0, `tick ${s.tick}: the gate disagrees`);
    checked++;

    const r = reduce(s, bot.act(s));
    bot.observe(r.ev);
    s = r.s;
  }
  assert.ok(checked > 40, `only ${checked} ticks were compared`);
});

test('a single-destination level still emits arrived and never visited', () => {
  const level = { id: 'it-single', map: 'A###B', arrivals: { count: 1, firstTick: 0, every: 1 } };
  let s = init(level, 1);
  for (const x of [1, 2, 3]) s.con[cellAt(s, x, 0)] = CON_HAND;
  const { s: end, ev } = waits(s, 6);
  assert.deepEqual(s.users.map ? [] : [], []);
  assert.equal(only(ev, 'visited').length, 0, 'there is no such thing as an intermediate B');
  assert.equal(only(ev, 'arrived').length, 1);
  assert.equal(end.stats.served, 1);
  assert.deepEqual(end.users[0].todo, [], 'the list it was born with is spent');
});

// --- (c) itineraries are authored and cycled ---------------------------------------------

//  x: 0 1 2 3 4
//  0  . . B . .        A in the middle of a plus, one destination down each arm. Every leg is
//  1  . # # # .        the same length, so anything asymmetric in the result is the itinerary.
//  2  D # A # C
//  3  . # # # .
//  4  . . E . .
const PLUS = {
  id: 'it-plus',
  map: ['..B..', '.###.', 'D#A#C', '.###.', '..E..'].join('\n'),
  arrivals: { count: 6, firstTick: 0, every: 1 },
  patience: 40,
};

test('itineraries are DEALT by seed — the mix is the level, the order is the game', () => {
  //  Revised 2026-08-05 (owner decision — the walker cast list, SPEC §6.6). This test used to
  //  assert the round-robin: user 0 takes the first list, user 1 the second, on every seed. That
  //  guarantee is deliberately GONE. What the level still owns is the *mix* — three entries over
  //  six arrivals is two of each, on every seed — and what the seed now owns is the order.
  const level = { ...PLUS, itineraries: [['B'], ['C', 'E'], ['B', 'C', 'D', 'E']] };
  const lists = (/** @type {number} */ seed) =>
    waits(init(level, seed), 8).s.users.map((u) => u.todo.join(''));

  // dests are B=2, C=14, D=10, E=22 → indexes B0, C1, D2, E3.
  const counted = (/** @type {string[]} */ hand) => hand.slice().sort().join(' ');
  const EXPECTED = counted(['0', '0', '13', '13', '0123', '0123']);
  for (const seed of [1, 2, 3, 999, 20260805]) {
    assert.equal(counted(lists(seed)), EXPECTED, `seed ${seed} dealt a different mix`);
  }

  // Same seed, same hand — the determinism half, which is what makes a share link a share link.
  assert.deepEqual(lists(1), lists(1));
  assert.deepEqual(lists(999), lists(999));
  // …and some pair of seeds really does deal a different order, which is the other half. Two
  // named seeds rather than a sweep: this must fail loudly if the shuffle ever stops shuffling.
  assert.notDeepEqual(lists(1), lists(2), 'seeds 1 and 2 dealt the identical order');
});

test('a level that lists none sends every user to every destination', () => {
  const s = waits(init(PLUS, 1), 3).s;
  assert.equal(s.users.length >= 2, true);
  for (const u of s.users) assert.deepEqual(u.todo, [0, 1, 2, 3]);

  // Which is what made the original single-destination levels the games they were: one
  // destination, everyone owing it, arrival on contact. Inline now (rev. 2026-08-06, second
  // revision — the morning's rename made this "whichever registered level still has exactly one
  // B", and the afternoon's multi-destination pass emptied that set for good). The shape is
  // still legal and still the baseline the itinerary machinery reduces to, which is exactly
  // what is worth pinning after the corpus stopped shipping an example of it.
  const one = { id: 'it-single', map: 'A####B', arrivals: { count: 2, firstTick: 0, every: 1 } };
  const s1 = waits(init(/** @type {any} */ (one), 1), 8).s;
  for (const u of s1.users) assert.deepEqual(u.todo, [0]);
});

test('a todo is ascending however the level wrote the itinerary down', () => {
  const level = { ...PLUS, itineraries: [['E', 'B', 'C']] };
  const s = waits(init(level, 1), 2).s;
  assert.deepEqual(s.users[0].todo, [0, 1, 3], 'order within a list carries no meaning');
});

// --- (d) visit on contact ------------------------------------------------------------------

/** A#B#C: B sits between the origin and C, so the walk to C crosses it. */
const LINE = {
  id: 'it-line',
  map: 'A#B#C',
  arrivals: { count: 1, firstTick: 0, every: 1 },
  patience: 40,
};

test('VISIT ON CONTACT: a destination on the list is ticked off the moment it is stepped on', () => {
  const level = { ...LINE, itineraries: [['B', 'C']] };
  let s = init(level, 1);
  for (const c of [1, 3]) s.con[c] = CON_HAND;

  const { s: after, ev } = waits(s, 3);
  const visits = /** @type {any[]} */ (only(ev, 'visited'));
  assert.deepEqual(visits, [{ t: 'visited', user: 0, dest: 2 }], 'B is a stop, not an arrival');
  assert.equal(after.stats.served, 0, 'a stop is not a score');
  assert.deepEqual(after.users[0].todo, [1], 'and B came off the list');
  assert.equal(after.users[0].state, 'moving');

  const { s: end, ev: rest } = waits(after, 3);
  assert.deepEqual(only(rest, 'arrived'), [{ t: 'arrived', user: 0 }], 'C is the last one, so C is arrival');
  assert.equal(end.stats.served, 1);
  assert.equal(end.users[0].state, 'arrived');
  assert.equal(end.phase.k, 'won');
});

test('a destination NOT on the list is a passable cell and nothing else', () => {
  // The same board and the same walk, but this user was only ever asked for C.
  const level = { ...LINE, itineraries: [['C']] };
  let s = init(level, 1);
  for (const c of [1, 3]) s.con[c] = CON_HAND;

  const { s: end, ev } = waits(s, 6);
  assert.equal(only(ev, 'visited').length, 0, 'crossing B did nothing at all');
  assert.deepEqual(only(ev, 'arrived'), [{ t: 'arrived', user: 0 }]);
  assert.ok(/** @type {any[]} */ (only(ev, 'step')).some((e) => e.to === 2), 'it really did walk over B');
  assert.equal(end.stats.served, 1);
});

test('the last visit is arrival even when the list was three long', () => {
  const level = { ...PLUS, arrivals: { count: 1, firstTick: 0, every: 1 }, itineraries: [['B', 'C', 'D', 'E']] };
  const { s: end, ev } = waits(paved(init(level, 4)), 40);
  assert.equal(only(ev, 'visited').length, 3, 'three stops…');
  assert.deepEqual(only(ev, 'arrived'), [{ t: 'arrived', user: 0 }], '…and one arrival');
  assert.equal(end.stats.served, 1, 'a user is worth one point however far it walked');
  assert.deepEqual(end.users[0].todo, []);
});

// --- (e) the refill ------------------------------------------------------------------------

test('THE REFILL: an intermediate stop hands back round(patience × destRefill)', () => {
  //  A user held at the origin long enough to burn `stall` ticks of patience, then the tile
  //  that puts B one step away. Patience 21 is deliberately odd, so the half bar is a rounding
  //  question and not an arithmetic coincidence.
  const PATIENCE = 21;
  /** @param {number | undefined} destRefill @param {number} stall @returns {{ before: number, after: number }} */
  const run = (destRefill, stall) => {
    const level = {
      ...LINE, patience: PATIENCE, destRefill, itineraries: [['B', 'C']],
      arrivals: { count: 1, firstTick: 0, every: 1 },
    };
    let s = init(/** @type {any} */ (level), 1);
    s = waits(s, stall).s;                   // queued at the origin with the gate shut
    const before = s.users[0].waited;
    s = { ...s, con: s.con.slice() };
    s.con[1] = CON_HAND;                     // …now B is reachable, and one step away
    s = waits(s, 2).s;
    assert.equal(s.users[0].at, 2, 'it reached B');
    assert.equal(s.users[0].state, 'moving', 'and it is still going, so the refill applies');
    return { before, after: s.users[0].waited };
  };

  //  21 × 0.5 = 10.5, which rounds to 11 — the half bar, stated exactly.
  assert.equal(RULES.DEST_REFILL, 0.5);
  const paid = Math.round(PATIENCE * RULES.DEST_REFILL);
  assert.equal(paid, 11);

  const half = run(undefined, 14);
  assert.equal(half.before, 14);
  assert.equal(half.after, 14 - paid, 'the default is half a bar off the clock');

  // It floors at zero: a stop can clear the debt, never put the user in credit.
  const cheap = run(undefined, 6);
  assert.equal(cheap.before, 6);
  assert.equal(cheap.after, 0, 'six ticks owed, eleven forgiven, nothing carried forward');

  // A level may say otherwise, in either direction.
  assert.equal(run(0, 14).after, 14, 'destRefill 0: the stop buys the walk and nothing else');
  assert.equal(run(0.25, 14).after, 14 - Math.round(PATIENCE * 0.25));
  assert.equal(run(1, 14).after, 0, 'destRefill 1: the clock starts again');
});

test('a stop does not refill the last leg — arrival is not a refill', () => {
  const level = { ...LINE, patience: 20, itineraries: [['B']], arrivals: { count: 1, firstTick: 0, every: 1 } };
  let s = init(level, 1);
  s = waits(s, 6).s;
  const owed = s.users[0].waited;
  s = { ...s, con: s.con.slice() };
  s.con[1] = CON_HAND;
  s = waits(s, 2).s;
  assert.equal(s.users[0].state, 'arrived');
  assert.equal(s.users[0].waited, owed, 'the counter is left exactly where arrival found it');
});

// --- (f) per-mask routing ------------------------------------------------------------------

test('TWO LISTS, TWO DIRECTIONS: users walk opposite ways on the same tick', () => {
  //  D#A#C with the arms paved: user 0 owes C (east), user 1 owes D (west).
  const level = {
    id: 'it-split',
    map: 'D#A#C',
    arrivals: { count: 2, firstTick: 0, every: 1 },
    patience: 40,
    itineraries: [['C'], ['B']],      // 'B' is D's letter here? no — see below
  };
  // Letters are assigned in order, so on 'D#A#C' the parser reads 'C' at index 4 as dests[1]
  // and 'D' at index 0 as dests[2]; there is no 'B' on this map at all, which the validator
  // catches. Use a map that spells its destinations properly instead.
  assert.match(validateLevel(/** @type {any} */ (level)).errors.join(' | '), /no destination 'B'/);

  const proper = {
    id: 'it-split2',
    map: 'B#A#C',
    arrivals: { count: 2, firstTick: 0, every: 1 },
    patience: 40,
    itineraries: [['C'], ['B']],
  };
  let s = init(proper, 1);
  assert.deepEqual(s.dests, [0, 4]);
  s.con[1] = CON_HAND;
  s.con[3] = CON_HAND;

  const { s: after, ev } = waits(s, 4);
  assert.deepEqual(after.users.map((u) => u.todo), [[], []]);
  const steps = /** @type {any[]} */ (only(ev, 'step'));
  assert.deepEqual(steps.filter((e) => e.user === 0).map((e) => e.to), [3, 4], 'user 0 went east to C');
  assert.deepEqual(steps.filter((e) => e.user === 1).map((e) => e.to), [1, 0], 'user 1 went west to B');
  assert.equal(after.stats.served, 2);
});

test('the departure gate is per user: one list can be open while another is shut', () => {
  const level = {
    id: 'it-gate',
    map: 'B#A#C',
    arrivals: { count: 2, firstTick: 0, every: 1 },
    patience: 40,
    itineraries: [['C'], ['B']],
  };
  let s = init(level, 1);
  s.con[3] = CON_HAND;                        // only the eastern arm is built

  const { s: after, ev } = waits(s, 2);
  assert.deepEqual(only(ev, 'departed').map((e) => /** @type {any} */ (e).user), [0],
    'the C user left; the B user is still standing at the origin');
  assert.equal(after.users[1].state, 'queued');
  assert.equal(after.users[1].waited > 0, true, 'and it is burning patience while it waits');

  // The HUD gate asks the stuck, and the only stuck user here cannot move: the Run button is
  // dead even though somebody on the board is walking. Building the other arm revives it.
  assert.equal(gateOpen(after), false);
  const opened = { ...after, con: after.con.slice() };
  opened.con[1] = CON_HAND;
  assert.equal(gateOpen(opened), true);
});

test('pathComplete is stricter than the gate: an open route is not a finished level', () => {
  const level = { id: 'it-complete', map: 'B#A#C', arrivals: { count: 1, firstTick: 0, every: 1 } };
  const s = init(level, 1);
  const east = { ...s, con: s.con.slice() };
  east.con[3] = CON_HAND;
  assert.equal(pathComplete(east), false, 'C is reachable, B is not, so the job is not done');

  const both = { ...east, con: east.con.slice() };
  both.con[1] = CON_HAND;
  assert.equal(pathComplete(both), true);
});

test('a beta stages toward whichever destination the walker still owes', () => {
  //  An L of open water: C five cells east along the top, B five cells south down the left.
  //  Two betas, one up each arm, both far short of their destination — so both stay elected.
  const level = {
    id: 'it-beta',
    map: ['A#####C', '#......', '#......', '#......', '#......', 'B......'].join('\n'),
    arrivals: { count: 2, firstTick: 0, every: 1 },
    patience: 40,
    itineraries: [['C'], ['B']],
  };
  let s = init(level, 1);
  assert.deepEqual(s.dests, [35, 6], "B is dests[0] wherever it sits, and C is dests[1]");

  s = reduce(s, { t: 'place', cell: 1 }).s;
  s = reduce(s, { t: 'beta', cell: 2 }).s;       // east arm, four cells short of C
  s = reduce(s, { t: 'place', cell: 7 }).s;
  s = reduce(s, { t: 'beta', cell: 14 }).s;      // south arm, three cells short of B

  // One board, one set of betas, two elections — because a component's target is chosen
  // against the walker's own composite potential rather than against the board's.
  const toC = waypointField(s, [1]);
  const toB = waypointField(s, [0]);
  assert.equal(toC.hasBeta, true);
  assert.equal(toC.dist[2], 0, 'the C walker is sent to the eastern milestone');
  assert.equal(toB.dist[14], 0, 'and the B walker to the southern one');
  assert.equal(toC.dist[14], 4, 'each can see the other, and each is aimed past it');
  assert.equal(toB.dist[2], 4);
  assert.equal(canProgress(s, toC, 2), false, 'and each camps on its own once it gets there');
  assert.equal(canProgress(s, toB, 14), false);

  const { s: after } = waits(s, 3);
  assert.equal(after.users[0].at, 2, 'user 0 camped up the C arm');
  assert.equal(after.users[1].at, 14, 'user 1 camped down the B arm');
  assert.equal(after.stats.served, 0, 'a beta is never an arrival, on any itinerary');
});

// --- (g) serialization ---------------------------------------------------------------------

test('dests and todo survive the save round trip and ride the hash', () => {
  const level = { ...PLUS, itineraries: [['B'], ['C', 'E']] };
  const { s } = waits(paved(init(level, 3)), 5);
  assert.ok(s.users.length >= 2);

  const revived = JSON.parse(JSON.stringify(s));
  assert.deepEqual(revived.dests, s.dests);
  assert.deepEqual(revived.users.map((/** @type {any} */ u) => u.todo), s.users.map((u) => u.todo));
  assert.equal(hashState(revived), hashState(s));

  // Two boards that differ only in what a user still owes are different boards.
  const moved = { ...s, users: s.users.map((u, i) => (i === 0 ? { ...u, todo: [1] } : u)) };
  assert.notEqual(hashState(moved), hashState(s));
  // …and so are two levels that differ only in where they put their destinations.
  const elsewhere = { ...s, dests: [...s.dests].reverse() };
  assert.notEqual(hashState(elsewhere), hashState(s));
});

test('a bot plays the multi-destination showcase without asking for anything illegal', () => {
  for (const spec of ['handOnly', 'balanced:0.4', 'careful-beta:0.4']) {
    const bot = makePolicy(spec, 5);
    let s = init(getLevel('delta'), 5);
    let guard = 0;
    while ((s.phase.k === 'play' || s.phase.k === 'placing') && guard++ < 400) {
      const r = reduce(s, bot.act(s));
      assert.equal(r.ev.some((e) => e.t === 'rejected'), false, `${spec} asked for something illegal`);
      bot.observe(r.ev);
      s = r.s;
    }
    assert.ok(s.phase.k === 'won' || s.phase.k === 'lost', `${spec} never finished (${s.phase.k})`);
  }
});
