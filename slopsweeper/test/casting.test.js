// @ts-check
// THE WALKER CAST LIST (owner decision 2026-08-05; SPEC §6.6).
//
// A level authors a *cast* — a pool of walkers, each with stops, an optional order and an
// optional patience of its own — and every game deals that pool against the arrival schedule on
// a private, seeded stream. Same seed, same deal. Different seed, different deal. The demand is
// still fixed before the first turn, because the whole cast is resolved at `init()`.
//
// There are three load-bearing tests in this file and they are the three promises the feature
// made:
//
//   · `THE CORPUS PASSES THROUGH CASTING` — a one-destination level's pool is one role, so the
//     deal cannot change anything about it, whatever the seed does. That is the *mechanism* by
//     which the six tuned levels' sim rows are byte-identical, checked here rather than argued.
//   · `THE STREAMS ARE UNTOUCHED` — `init` leaves `s.rng` exactly as `initStreams(seed)` built
//     it, so casting cost the generation and movement streams nothing. If this ever fails, every
//     recorded game in the repo has silently changed.
//   · `A RESTORE RE-DERIVES THE IDENTICAL CAST` — nothing about a walker is stored, so a refresh
//     mid-game has to rebuild it from (LevelDef, seed) and get the same people back. That is why
//     this landed with no save version.
import test from 'node:test';
import assert from 'node:assert/strict';

import { CAST_STREAM_XOR, arrivalCount, castPool, resolveCast } from '../src/core/casting.js';
import { levelParams, patienceLimit, setLevelParams } from '../src/core/state.js';
import { MOVE_STREAM_XOR, initStreams } from '../src/core/rng.js';
import { init, reduce } from '../src/core/reduce.js';
import { validateLevel } from '../src/core/validate.js';
import { hashState } from '../src/sim/hash.js';
import { allLevels, getLevel, resolveLevel } from '../src/levels/index.js';

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

//  x: 0 1 2 3 4
//  0  . . B . .        A in the middle of a plus, one destination down each arm. Four letters
//  1  . # # # .        is enough to write six distinguishable roles.
//  2  D # A # C
//  3  . # # # .
//  4  . . E . .
const PLUS = {
  id: 'cast-plus',
  map: ['..B..', '.###.', 'D#A#C', '.###.', '..E..'].join('\n'),
  arrivals: { count: 6, firstTick: 0, every: 1 },
  patience: 60,
};

/** One cast entry, printed so a whole deal fits on a line and a diff is readable. */
const show = (/** @type {import('../src/core/rules.js').WalkerDef} */ c) =>
  `${c.stops.join('')}${c.ordered ? '!' : ''}${c.patience ? `@${c.patience}` : ''}`;

/** @param {object} def @param {number} seed @returns {string[]} */
const dealt = (def, seed) => levelParams(init(/** @type {any} */ (def), seed)).cast.map(show);

// --- (a) the deal is a function of the seed, and only of the seed ---------------------------

test('the same seed deals the same cast, every time, from a cold start', () => {
  const level = {
    ...PLUS,
    walkers: [{ stops: ['B'] }, { stops: ['C'] }, { stops: ['D', 'E'] }],
  };
  for (const seed of [0, 1, 7, 20260805, 0xffffffff]) {
    assert.deepEqual(dealt(level, seed), dealt(level, seed), `seed ${seed} dealt twice, differently`);
  }
  // And it is the seed and nothing ambient: a deal taken after a hundred other games is the
  // same deal. (A shared module-level stream would fail exactly here.)
  const first = dealt(level, 42);
  for (let n = 0; n < 100; n++) dealt(level, n);
  assert.deepEqual(dealt(level, 42), first, 'the deal drifted after other games were dealt');
});

test('DIFFERENT SEEDS DEAL DIFFERENTLY — named seeds, not a hopeful sweep', () => {
  const level = {
    ...PLUS,
    walkers: [{ stops: ['B'] }, { stops: ['C'] }, { stops: ['D'] }],
  };
  // Two seeds asserted by name rather than "some pair in a sweep differs": this test has to
  // fail the day the shuffle stops shuffling, and a sweep would let one surviving pair hide it.
  assert.notDeepEqual(dealt(level, 1), dealt(level, 2), 'seeds 1 and 2 dealt the identical order');
  assert.notDeepEqual(dealt(level, 3), dealt(level, 4), 'seeds 3 and 4 dealt the identical order');

  // Over a spread of seeds the deal really does move around, which is the design intent: a
  // replayed level asks the same questions in a different order.
  const orders = new Set([...Array(40).keys()].map((n) => dealt(level, n).join(' ')));
  assert.ok(orders.size > 5, `forty seeds produced only ${orders.size} distinct orders`);
});

test('THE STREAMS ARE UNTOUCHED: casting draws on nothing the game replays from', () => {
  //  The whole regression guarantee in one assertion. `initStreams` is the only thing that may
  //  decide where `s.rng` starts; casting has its own constant and its own throwaway stream.
  const level = {
    ...PLUS,
    arrivals: { count: 12, firstTick: 0, every: 1 },
    walkers: [{ stops: ['B'] }, { stops: ['C'] }, { stops: ['D'] }, { stops: ['E'] }],
  };
  for (const seed of [1, 2, 12345]) {
    assert.deepEqual(init(/** @type {any} */ (level), seed).rng, initStreams(seed));
    assert.deepEqual(init(getLevel('plain'), seed).rng, initStreams(seed));
  }
  // And the split constant is genuinely its own: reusing the movement stream's would have made
  // the cast a preview of every routing tie-break in the game.
  assert.notEqual(CAST_STREAM_XOR, MOVE_STREAM_XOR);
});

// --- (b) the two pool branches --------------------------------------------------------------

test('A SUBSET: an oversized cast means some roles do not appear this run', () => {
  const pool = [
    { stops: ['B'] }, { stops: ['C'] }, { stops: ['D'] },
    { stops: ['E'] }, { stops: ['B', 'C'] }, { stops: ['D', 'E'] },
  ];
  const level = { ...PLUS, arrivals: { count: 3, firstTick: 0, every: 1 }, walkers: pool };
  const known = new Set(pool.map(show));

  /** @type {Set<string>} */
  const subsets = new Set();
  for (let seed = 0; seed < 40; seed++) {
    const hand = dealt(level, seed);
    assert.equal(hand.length, 3, `seed ${seed}: exactly the scheduled arrivals are cast`);
    for (const c of hand) assert.ok(known.has(c), `seed ${seed}: '${c}' is not in the pool`);
    assert.equal(new Set(hand).size, 3, 'a subset draws each role at most once');
    subsets.add(hand.slice().sort().join(' '));
  }
  assert.ok(subsets.size > 3, `forty seeds drew only ${subsets.size} distinct subsets`);

  // The point of the branch, stated: some pool member really is absent from some run, which is
  // the owner's explicit request and the thing an author is buying by oversizing the cast.
  const one = dealt(level, 1);
  assert.ok([...known].some((c) => !one.includes(c)), 'every role appeared — that is not a subset');
});

test('A CYCLE: an undersized cast preserves the authored mix exactly, and only shuffles', () => {
  //  Three roles, nine arrivals. 3/3/3 on EVERY seed — the ratios are the level's, the order is
  //  the game's. Shuffling three roles nine times independently would have made this a lottery.
  const level = {
    ...PLUS,
    arrivals: { count: 9, firstTick: 0, every: 1 },
    walkers: [{ stops: ['B'] }, { stops: ['C'] }, { stops: ['D'] }],
  };
  for (let seed = 0; seed < 40; seed++) {
    const hand = dealt(level, seed);
    assert.equal(hand.length, 9);
    /** @type {Record<string, number>} */
    const count = {};
    for (const c of hand) count[c] = (count[c] ?? 0) + 1;
    assert.deepEqual(count, { B: 3, C: 3, D: 3 }, `seed ${seed} dealt an unbalanced mix`);
  }
  // A ragged division is preserved just as exactly: four roles over nine is 3/2/2/2, always.
  const ragged = {
    ...PLUS,
    arrivals: { count: 9, firstTick: 0, every: 1 },
    walkers: [{ stops: ['B'] }, { stops: ['C'] }, { stops: ['D'] }, { stops: ['E'] }],
  };
  for (let seed = 0; seed < 20; seed++) {
    const hand = dealt(ragged, seed);
    /** @type {Record<string, number>} */
    const count = {};
    for (const c of hand) count[c] = (count[c] ?? 0) + 1;
    assert.deepEqual(
      Object.values(count).sort((a, b) => b - a), [3, 2, 2, 2],
      `seed ${seed}: the head of the cycle must be the first role, not a random one`,
    );
  }
});

test('the pool is walkers, else itineraries, else the whole map', () => {
  const base = { id: 'cast-pool', map: PLUS.map };
  assert.deepEqual(castPool(/** @type {any} */ (base), 4).map(show), ['BCDE'],
    'no cast at all is one role owing every destination — the game as it always was');
  assert.deepEqual(
    castPool(/** @type {any} */ ({ ...base, itineraries: [['C'], { stops: ['B', 'D'], ordered: true }] }), 4).map(show),
    ['C', 'BD!'], 'itineraries are walkers without a patience');
  assert.deepEqual(
    castPool(/** @type {any} */ ({ ...base, walkers: [{ stops: ['C'], patience: 9 }] }), 4).map(show),
    ['C@9']);

  assert.equal(arrivalCount({ count: 7, firstTick: 0, every: 2 }), 7);
  assert.equal(arrivalCount({ at: [1, 4, 9] }), 3, 'the list IS the count');
  assert.deepEqual(resolveCast([], 5, 1), [], 'an empty pool is not a crash');
  assert.deepEqual(resolveCast([{ stops: ['B'] }], 0, 1), [], 'and neither is an empty schedule');
});

// --- (c) THE REGRESSION GUARANTEE ------------------------------------------------------------

test('THE CORPUS PASSES THROUGH CASTING: a one-role pool cannot be dealt differently', () => {
  //  The mechanism behind the byte-identical sim rows. A level with one destination and no cast
  //  has a pool of exactly one role, which cycles to N copies of itself — and no permutation of
  //  identical things is a different thing. The seed is free to do whatever it likes here.
  for (const def of allLevels()) {
    if (def.walkers.length > 0 || def.itineraries.length > 0) continue;
    for (const seed of [1, 2, 20260805]) {
      const s = init(def, seed);
      const cast = levelParams(s).cast;
      assert.equal(cast.length, s.schedule.total, `${def.id}: one entry per scheduled user`);
      for (const c of cast) {
        assert.deepEqual(c, cast[0], `${def.id}: the deal produced two different roles`);
        assert.equal(c.ordered, false);
        assert.equal(c.patience, undefined, 'and nobody in the corpus carries their own bar');
      }
      assert.deepEqual(cast[0].stops, s.dests.map((_, i) => String.fromCharCode(66 + i)));
    }
  }

  // …and the users it produces are the users it always produced: everybody owing everything.
  const { s } = waits(init(getLevel('plain'), 4), 16);
  assert.ok(s.users.length >= 2, `only ${s.users.length} users had spawned`);
  for (const u of s.users) {
    assert.deepEqual(u.todo, [0]);
    assert.equal(u.ordered, false);
    assert.equal(patienceLimit(s, u), levelParams(s).patience, 'and on the level bar, all of them');
  }
});

// --- (d) per-walker patience ------------------------------------------------------------------

test('PER-WALKER PATIENCE: the impatient one quits at ITS bar while its neighbour waits on', () => {
  //  A route that never opens, so the only thing that resolves anybody is the clock. Which user
  //  drew the impatient role is a property of the seed — this test asks `patienceLimit` who it
  //  is rather than assuming a slot, which is also how every UI reader has to do it.
  const level = {
    id: 'cast-patience',
    map: 'A##B',
    arrivals: { count: 2, firstTick: 0, every: 1 },
    patience: 30,
    walkers: [{ stops: ['B'], patience: 5 }, { stops: ['B'] }],
  };
  let s = init(/** @type {any} */ (level), 1);
  s = waits(s, 2).s;
  assert.equal(s.users.length, 2);

  const quick = s.users.find((u) => patienceLimit(s, u) === 5);
  const slow = s.users.find((u) => patienceLimit(s, u) === 30);
  assert.ok(quick && slow, 'the cast should have dealt one of each');
  assert.notEqual(quick.id, slow.id);

  // Run until the short bar is spent. It gives up at five; the other is still standing there
  // with the same board, the same gate and twenty-five turns of goodwill left.
  const { s: after, ev } = waits(s, 6);
  const gone = /** @type {any[]} */ (only(ev, 'userLost'));
  assert.deepEqual(gone.map((e) => e.user), [quick.id], 'the wrong person walked out');
  assert.equal(gone[0].reason, 'gaveUp');
  assert.equal(after.users[quick.id].waited, 5, 'exactly its own bar, not the level’s');
  assert.equal(after.users[slow.id].state, 'queued');
  assert.ok(after.users[slow.id].waited > 5, 'and it has already waited longer than that');

  // The level's own bar still resolves the other one, later, on the same board.
  const { s: end } = waits(after, 30);
  assert.equal(end.users[slow.id].state, 'gone');
  assert.equal(end.users[slow.id].waited, 30);
});

test('patienceLimit is what every reader asks, and it answers per user', () => {
  const level = {
    id: 'cast-limit',
    map: 'A##B',
    arrivals: { count: 4, firstTick: 0, every: 1 },
    patience: 30,
    walkers: [{ stops: ['B'], patience: 5 }, { stops: ['B'] }],
  };
  const s = waits(init(/** @type {any} */ (level), 3), 4).s;
  const limits = s.users.map((u) => patienceLimit(s, u));
  assert.deepEqual(limits.slice().sort((a, b) => a - b), [5, 5, 30, 30], 'two of each, cycled');
  for (const u of s.users) {
    assert.equal(patienceLimit(s, u), levelParams(s).cast[u.id].patience ?? 30,
      'the casting slot IS the user id — that is the whole of why nothing was stored');
  }

  // A level with no override answers the level's number for everybody, which is what keeps the
  // helper a drop-in for the four sites that used to read `levelParams(s).patience`.
  const plain = waits(init(getLevel('plain'), 1), 8).s;
  for (const u of plain.users) assert.equal(patienceLimit(plain, u), levelParams(plain).patience);
});

test('half a bar is half of the walker’s own bar', () => {
  //  A#B#C with both gaps built: the walker crosses B on the way to C. Its bar is 10, so the
  //  intermediate stop refunds 5 — not half of the level's 30, which would forgive the whole
  //  wait it had accumulated and then some.
  const level = {
    id: 'cast-refill',
    map: 'A#B#C',
    arrivals: { count: 1, firstTick: 0, every: 1 },
    patience: 30,
    walkers: [{ stops: ['B', 'C'], patience: 10 }],
  };
  let s = init(/** @type {any} */ (level), 1);
  s = waits(s, 6).s;                       // queued with the gate shut: six ticks owed
  assert.equal(s.users[0].waited, 6);
  s = { ...s, con: s.con.slice() };
  s.con[1] = { k: 'hand' };
  s.con[3] = { k: 'hand' };
  s = waits(s, 2).s;
  assert.equal(s.users[0].at, 2, 'it reached B');
  assert.equal(s.users[0].waited, 1, 'six owed, five forgiven — half of ten, not half of thirty');
});

// --- (e) explicit arrival turns ----------------------------------------------------------------

test('EXPLICIT ARRIVAL TURNS: users spawn on exactly the turns the level listed', () => {
  const AT = [1, 2, 7];
  const level = { id: 'cast-at', map: 'A##B', arrivals: { at: AT }, patience: 60 };
  let s = init(/** @type {any} */ (level), 1);
  assert.equal(s.schedule.total, 3, 'the list is the count');
  assert.equal(s.schedule.nextTick, 1);
  assert.equal(s.schedule.every, 0, 'a listed schedule has no cadence, and says so');

  /** @type {number[]} */
  const spawnedAt = [];
  for (let n = 0; n < 10; n++) {
    const before = s.tick;
    const r = reduce(s, { t: 'wait' });
    for (const e of r.ev) if (e.t === 'spawned') spawnedAt.push(before);
    s = r.s;
    // NEXT IN, exactly as the HUD computes it (hud.js): it never sits on zero, it counts down
    // one a turn, and it says '—' only when the schedule is spent.
    const left = s.schedule.spawned >= s.schedule.total ? null
      : Math.max(1, s.schedule.nextTick - s.tick + 1);
    if (left !== null) {
      assert.equal(s.schedule.nextTick, AT[s.schedule.spawned], 'nextTick is the next listed turn');
      assert.ok(left >= 1, `NEXT IN went to ${left}`);
    }
  }
  assert.deepEqual(spawnedAt, AT, 'one user per listed turn, on that turn');
  assert.equal(s.users.length, 3);
});

test('a listed schedule still ends the level, and resolveLevel passes it through whole', () => {
  const level = { id: 'cast-at-end', map: 'A#B', arrivals: { at: [0, 3] }, patience: 4 };
  const { s, ev } = waits(init(/** @type {any} */ (level), 1), 20);
  assert.equal(s.users.length, 2);
  assert.equal(s.phase.k, 'lost', 'both ran out of patience, so nobody was served');
  assert.deepEqual(only(ev, 'lost'), [{ t: 'lost', served: 0, total: 2 }]);

  // The resolver must not merge the two shapes into a definition the validator would refuse.
  const resolved = resolveLevel(/** @type {any} */ ({ id: 'cast-at-res', map: 'A#B', arrivals: { at: [2, 5] } }));
  assert.deepEqual(resolved.arrivals, { at: [2, 5] });
  assert.equal(validateLevel(resolved).errors.join(' | '), '');
});

// --- (f) the validator -------------------------------------------------------------------------

test('the validator refuses a level that says the same thing twice', () => {
  /** @param {object} over @returns {string} */
  const errs = (over) => validateLevel(/** @type {any} */ ({
    id: 'cast-v', map: ['####', 'A##B', '#C#D'].join('\n'), ...over,
  })).errors.join(' | ');

  assert.match(errs({ itineraries: [['B']], walkers: [{ stops: ['C'] }] }),
    /either itineraries or walkers, never both/);
  assert.equal(errs({ itineraries: [], walkers: [{ stops: ['C'] }] }), '',
    'an empty list is a field the level did not author — resolveLevel fills both');
  assert.match(errs({ arrivals: { count: 3, firstTick: 0, every: 1, at: [1, 2, 3] } }),
    /not both/);

  // The listed form's own rules.
  assert.equal(errs({ arrivals: { at: [0] } }), '', 'one user on turn zero is a level');
  assert.match(errs({ arrivals: { at: [] } }), /arrivals\.at must be a non-empty array/);
  assert.match(errs({ arrivals: { at: [3, 3] } }), /strictly increasing/);
  assert.match(errs({ arrivals: { at: [5, 2] } }), /strictly increasing/);
  assert.match(errs({ arrivals: { at: [-1] } }), /arrivals\.at\[0\] must be a non-negative integer/);
  assert.match(errs({ arrivals: { at: [1.5] } }), /must be a non-negative integer/);
  assert.match(errs({ arrivals: 7 }), /arrivals must be \{ count, firstTick, every \} or \{ at: \[\.\.\.\] \}/);
});

test('a walkers entry is checked exactly like an itinerary, plus its own bar', () => {
  /** @param {object} over @returns {string} */
  const errs = (over) => validateLevel(/** @type {any} */ ({
    id: 'cast-w', map: ['####', 'A##B', '#C#D'].join('\n'), ...over,
  })).errors.join(' | ');

  assert.equal(errs({ walkers: [{ stops: ['B', 'C'] }] }), '');
  assert.equal(errs({ walkers: [{ stops: ['B'], ordered: true, patience: 12 }] }), '');
  assert.match(errs({ walkers: [{ stops: ['E'] }] }), /walkers\[0\] names 'E', which is not a destination/);
  assert.match(errs({ walkers: [{ stops: ['B', 'B'] }] }), /walkers\[0\] visits 'B' twice/);
  assert.match(errs({ walkers: [{ stops: [] }] }), /walkers\[0\] must be a non-empty array/);
  assert.match(errs({ walkers: [{ patience: 3 }] }), /walkers\[0\] must be a non-empty array/);
  assert.match(errs({ walkers: [{ stops: ['B'], ordered: 'yes' }] }), /walkers\[0\]\.ordered must be a boolean/);
  assert.match(errs({ walkers: [{ stops: ['B'], patience: 0 }] }), /walkers\[0\]\.patience must be a positive integer/);
  assert.match(errs({ walkers: [{ stops: ['B'], patience: 2.5 }] }), /walkers\[0\]\.patience must be a positive integer/);
  assert.match(errs({ walkers: 'B' }), /walkers must be an array/);

  // The older field cannot borrow the newer one's option, and the error says which list it was.
  assert.match(errs({ itineraries: [{ stops: ['B'], patience: 5 }] }),
    /itineraries\[0\] sets a patience, which only a walkers entry may do/);

  // And `init` refuses to load any of it, which is the enforcement that matters.
  assert.throws(
    () => init(/** @type {any} */ ({ id: 'cast-bad', map: 'A#B', walkers: [{ stops: ['B'], patience: -1 }] }), 1),
    /patience must be a positive integer/,
  );
});

// --- (g) THE RESTORE ---------------------------------------------------------------------------

test('A RESTORE RE-DERIVES THE IDENTICAL CAST, mid-game and to the end of it', () => {
  //  Exactly what ui/main.js does on a refresh: parse the state back out of JSON, boot the level
  //  definition once against the state's own seed, and copy those parameters across. Nothing
  //  about a walker is in the save — the cast is a pure function of (LevelDef, seed) — so this
  //  is the test that says the feature really did land without a save version.
  const def = {
    id: 'cast-restore',
    map: 'A#B#C',
    arrivals: { count: 6, firstTick: 0, every: 2 },
    patience: 30,
    walkers: [{ stops: ['C'] }, { stops: ['B', 'C'] }, { stops: ['C'], patience: 4 }],
  };
  const SEED = 20260805;
  let s = init(/** @type {any} */ (def), SEED);
  s = { ...s, con: s.con.slice() };
  s.con[1] = { k: 'hand' };                       // B reachable, C is not — so some walkers walk
  s = waits(s, 12).s;                             // mid-game: spawned, departed, one gone
  assert.equal(s.users.length, 6);
  assert.equal(s.phase.k, 'play', 'the game must still be running for a mid-game restore');
  assert.ok(s.users.some((u) => u.state === 'gone'), 'the impatient role has already resolved');

  const revived = /** @type {GameState} */ (JSON.parse(JSON.stringify(s)));
  setLevelParams(revived, levelParams(init(/** @type {any} */ (def), revived.seed)));

  assert.deepEqual(levelParams(revived).cast, levelParams(s).cast, 'the cast came back different');
  for (const u of s.users) {
    assert.equal(patienceLimit(revived, u), patienceLimit(s, u), `user ${u.id} came back on another clock`);
  }
  assert.equal(hashState(revived), hashState(s));

  // And it keeps playing the same game: identical events, identical hashes, to the end.
  let a = s;
  let b = revived;
  for (let n = 0; n < 60 && a.phase.k === 'play'; n++) {
    const ra = reduce(a, { t: 'wait' });
    const rb = reduce(b, { t: 'wait' });
    assert.deepEqual(rb.ev, ra.ev, `tick ${a.tick}: the restored run diverged`);
    a = ra.s;
    b = rb.s;
    assert.equal(hashState(b), hashState(a));
  }
  assert.equal(b.phase.k, a.phase.k);
  assert.deepEqual(b.stats, a.stats);

  // The failure this guards against, made visible: a state whose parameters were NEVER
  // re-associated falls back to the defaults, and there the per-walker bars are simply gone.
  const orphan = /** @type {GameState} */ (JSON.parse(JSON.stringify(s)));
  assert.equal(levelParams(orphan).cast.length, 0, 'a WeakMap cannot follow a state through JSON');
});

test('a wrong seed re-derives a different cast, which is why the save carries the seed', () => {
  const def = {
    id: 'cast-seedlink',
    map: 'A#B#C',
    arrivals: { count: 6, firstTick: 0, every: 2 },
    walkers: [{ stops: ['B'] }, { stops: ['C'] }, { stops: ['B', 'C'] }],
  };
  const right = dealt(def, 1);
  const wrong = dealt(def, 2);
  assert.notDeepEqual(wrong, right, 'seeds 1 and 2 must not deal the same hand here');
});
