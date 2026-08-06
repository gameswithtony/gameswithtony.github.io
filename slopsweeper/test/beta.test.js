// @ts-check
// BETA BLOCKS (user decision 2026-08-05; SPEC §2.2/§4.7/§6.2).
//
// A beta is a shipped milestone: one cell, hand-placed by the same target rules a hand tile
// is, out of a scarce per-level supply. What it changes is where users are willing to walk.
// They leave the origin for the nearest waypoint that is genuinely closer to B — B itself, or
// a beta staged between here and there — walk to it, and camp there until something better
// becomes reachable. Only B is arrival, and camping is waiting: the benefit of a beta is the
// walk, never the clock.
//
// The load-bearing test in this file is `NO BETA ON THE BOARD`. With no beta standing, the
// whole waypoint apparatus has to collapse back into the complete-path gate the game has
// always had, cell for cell — and that is asserted directly rather than argued for.
import test from 'node:test';
import assert from 'node:assert/strict';

import { RULES } from '../src/core/rules.js';
import { CON_BETA, CON_HAND } from '../src/core/state.js';
import { cellAt } from '../src/core/grid.js';
import {
  canProgress, distField, gateOpen, potentialField, waypointField,
} from '../src/core/routing.js';
import { betaRejection, cellHasMine, clue, init, legalActions, reduce } from '../src/core/reduce.js';
import { makePolicy } from '../src/sim/policies.js';
import { getLevel } from '../src/levels/index.js';

/** @typedef {import('../src/core/state.js').GameState} GameState */
/** @typedef {import('../src/core/state.js').Ev} Ev */
/** @typedef {import('../src/core/state.js').Action} Action */

const NEVER = { count: 9, firstTick: 9999, every: 9999 };

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

/** @param {GameState} s @param {Action[]} actions */
function play(s, actions) {
  /** @type {Ev[]} */
  const all = [];
  for (const a of actions) {
    const r = reduce(s, a);
    s = r.s;
    all.push(...r.ev);
  }
  return { s, ev: all };
}

/** The UI's camped-user predicate, spelled out once so the contract lives in one place. */
const camped = (/** @type {GameState} */ s, /** @type {number} */ id) => {
  const u = s.users[id];
  return u.state === 'moving' && u.stalled && s.con[u.at].k === 'beta';
};

/** @param {Ev[]} ev @param {Ev['t']} t */
const only = (ev, t) => ev.filter((e) => e.t === t);

/** @param {Ev[]} ev */
const stepsTo = (ev) => only(ev, 'step').map((e) => /** @type {any} */ (e).to);

// --- (a) legality mirrors Place, plus a supply ----------------------------------------

//  x: 0 1 2 3 4 5
//  0  . # # # # #
//  1  A # ^ # # B
//  2  . # # # # #
const BOARD = {
  id: 'beta-board',
  map: ['.#####', 'A#^##B', '.#####'].join('\n'),
  arrivals: NEVER,
};

test('a beta lands exactly where a hand tile lands, and nowhere else', () => {
  const s = init(BOARD, 1);
  /** @param {number} x @param {number} y */
  const at = (x, y) => cellAt(s, x, y);
  /** @param {number} cell */
  const why = (cell) => /** @type {any} */ (reduce(s, { t: 'beta', cell }).ev[0]).reason;

  // Adjacent to an endpoint: legal, and offered beside Place rather than instead of it.
  assert.equal(betaRejection(s, at(1, 1)), '');
  assert.deepEqual(legalActions(s, at(1, 1)), ['place', 'beta']);

  // Every target rule of SPEC §4.1, word for word — because it is the same function.
  assert.match(why(at(3, 0)), /must touch an endpoint or a tile that is already built/);
  assert.match(why(at(2, 1)), /cannot build on volcano/);
  assert.match(why(at(0, 0)), /cannot build on void/);
  assert.match(why(s.origin), /endpoints are not buildable/);
  assert.match(why(s.dests[0]), /endpoints are not buildable/);
  assert.match(why(-1), /off the board/);
  assert.match(why(s.w * s.h), /off the board/);

  // Occupancy is what stops a beta landing on anything — another beta included.
  const built = { ...s, con: s.con.slice() };
  built.con[at(1, 1)] = CON_HAND;
  built.con[at(1, 0)] = CON_BETA;
  assert.match(/** @type {any} */ (reduce(built, { t: 'beta', cell: at(1, 1) }).ev[0]).reason, /already built/);
  assert.match(/** @type {any} */ (reduce(built, { t: 'beta', cell: at(1, 0) }).ev[0]).reason, /already built/);

  // …and it branches from any structure, exactly as Place does since 2026-08-04.
  const slop = { ...s, con: s.con.slice() };
  slop.con[at(3, 1)] = { k: 'aiHidden', mine: true, block: 0, flagged: true };
  assert.equal(betaRejection(slop, at(3, 0)), '');
});

test('shipping a beta costs one turn, books the stat and emits betaPlaced', () => {
  const s = init(BOARD, 1);
  const cell = cellAt(s, 1, 1);
  const { s: after, ev } = reduce(s, { t: 'beta', cell });

  assert.deepEqual(after.con[cell], { k: 'beta' });
  assert.deepEqual(ev[0], { t: 'betaPlaced', cell });
  assert.equal(after.tick, 1, 'a beta is a turn, like the hand tile it is placed like');
  assert.equal(after.stats.betas, 1);
  assert.equal(after.stats.placed, 0, 'and it is not a hand tile: the two counters are separate');
});

test('the supply is finite and per level', () => {
  let s = init(BOARD, 1);
  for (let n = 0; n < RULES.BETA_SUPPLY; n++) {
    const cell = s.con.findIndex((_, i) => !betaRejection(s, i));
    assert.ok(cell >= 0, `nowhere legal for beta ${n + 1}`);
    s = reduce(s, { t: 'beta', cell }).s;
  }
  assert.equal(s.stats.betas, RULES.BETA_SUPPLY);

  const spare = s.con.findIndex((_, i) => legalActions(s, i).includes('place'));
  assert.ok(spare >= 0);
  assert.equal(betaRejection(s, spare), 'no beta supply remaining');
  assert.deepEqual(legalActions(s, spare), ['place'], 'the verb leaves the action bar');
  assert.match(/** @type {any} */ (reduce(s, { t: 'beta', cell: spare }).ev[0]).reason, /no beta supply/);

  // A level may turn the verb off outright.
  const none = init({ ...BOARD, id: 'beta-none', betaSupply: 0 }, 1);
  assert.equal(betaRejection(none, cellAt(none, 1, 1)), 'no beta supply remaining');
  assert.deepEqual(legalActions(none, cellAt(none, 1, 1)), ['place']);
});

// --- (b) THE REGRESSION GUARANTEE -----------------------------------------------------

test('NO BETA ON THE BOARD: the waypoint field IS the distance field, gate included', () => {
  // A real mid-game board rather than a fixture: a bot plays caldera long enough to put slop,
  // reveals, craters, walkers and a live queue on it, and on every single tick the two fields
  // and the two gates are compared.
  //
  // Caldera with its extra destinations stripped back out (rev. 2026-08-06): the multi-dest
  // pass gave every shipped level a second letter, and "the gate is a path to B" is an
  // identity that only holds on a single-destination board — which is the very fast path this
  // guarantee exists to pin. Stripping `C`… from the live map (and the cast that names them)
  // keeps the mid-game realism without freezing a copy of the level in this file.
  const caldera = getLevel('caldera');
  const single = { ...caldera, map: caldera.map.replace(/[C-H]/g, '#'), walkers: [], itineraries: [] };
  let s = init(/** @type {any} */ (single), 20260805);
  const bot = makePolicy('balanced:0.5', 20260805);
  let checked = 0;

  for (let n = 0; n < 120 && (s.phase.k === 'play' || s.phase.k === 'placing'); n++) {
    const wf = waypointField(s);
    const dist = distField(s);
    assert.deepEqual(wf.dist, dist, `tick ${s.tick}: the waypoint field diverged from distField`);
    assert.equal(wf.hasBeta, false);
    // The old gate, spelled out: a complete traversable path from the origin to B.
    assert.equal(gateOpen(s, wf), dist[s.origin] >= 0, `tick ${s.tick}: the gate disagrees`);
    assert.equal(gateOpen(s), dist[s.origin] >= 0);
    // And the progress guard is true exactly where the field is finite and not already there,
    // which is why nothing downstream of it can behave differently.
    for (let i = 0; i < s.con.length; i++) assert.equal(canProgress(s, wf, i), dist[i] > 0);
    checked++;
    const r = reduce(s, bot.act(s));
    bot.observe(r.ev);
    s = r.s;
  }
  assert.ok(checked > 40, `only ${checked} ticks were compared`);
});

test('A BETA THAT IS NOT THE BEST WAYPOINT CHANGES NOTHING', () => {
  // The test above short-circuits on the no-beta fast path, so this one drives the general
  // component analysis and asserts it lands in the same place: a beta standing *behind* B on
  // a finished route loses the target election, and the field is the plain distance field.
  let s = init(CORRIDOR, 1);
  for (const cell of [1, 2, 4, 5, 6, 7]) {
    s = { ...s, con: s.con.slice() };
    s.con[cell] = CON_HAND;
  }
  s = play(s, [{ t: 'beta', cell: 3 }]).s;

  const wf = waypointField(s);
  assert.equal(wf.hasBeta, true, 'the general path really is the one under test');
  assert.deepEqual(wf.dist, distField(s));
  assert.equal(wf.targetPot[s.origin], 0, 'B won the election, so every cell aims at B');
  assert.equal(gateOpen(s), true);
  assert.equal(canProgress(s, wf, 3), true, 'and nobody camps on a milestone B is past');
});

test('the potential field is terrain-only, cached, and blind to what is built', () => {
  const s = init(getLevel('tutorial'), 1);
  const before = potentialField(s, s.dests[0]);
  assert.equal(before[s.dests[0]], 0);
  assert.ok(before[s.origin] > 0);

  const built = { ...s, con: s.con.slice() };
  for (let i = 1; i <= 8; i++) built.con[s.origin + i] = CON_HAND;
  assert.equal(potentialField(built, built.dests[0]), before, 'construction cannot move it — that is the point');

  // Volcano and void are out by capability row, never by name.
  const caldera = init(getLevel('caldera'), 1);
  const pot = potentialField(caldera, caldera.dests[0]);
  for (let i = 0; i < caldera.terrain.length; i++) {
    if (caldera.terrain[i] === 'volcano' || caldera.terrain[i] === 'void') {
      assert.equal(pot[i], -1, `cell ${i} is ${caldera.terrain[i]} and can never be on a route`);
    }
  }
});

// --- (c) depart for a beta, walk to it, camp on it -------------------------------------

/** Nine cells in a line: A at 0, B at 8, seven cells of open water between them. */
const CORRIDOR = {
  id: 'beta-corridor',
  map: 'A#######B',
  arrivals: { count: 1, firstTick: 0, every: 1 },
  patience: 30,
};

/** Two hand tiles and a beta at cell 3 — the standard staging for these tests. */
function staged(/** @type {object} */ over = {}) {
  const s = init({ ...CORRIDOR, ...over }, 1);
  return play(s, [{ t: 'place', cell: 1 }, { t: 'place', cell: 2 }, { t: 'beta', cell: 3 }]);
}

test('a user departs for a reachable beta, walks to it, and camps there', () => {
  const s0 = init(CORRIDOR, 1);
  assert.equal(gateOpen(s0), false, 'nothing is built, so nobody is going anywhere');

  const opened = staged();
  let s = opened.s;
  assert.equal(gateOpen(s), true, 'a beta closer to B than the origin is somewhere worth going');
  assert.equal(distField(s)[s.origin], -1, 'while B itself is still unreachable');
  assert.equal(only(opened.ev, 'departed').length, 1, 'the queue flushed the tick it existed');
  assert.equal(s.users[0].at, 1);

  const walk = waits(s, 3);
  s = walk.s;
  assert.deepEqual(stepsTo(walk.ev), [2, 3]);
  assert.equal(only(walk.ev, 'arrived').length, 0, 'only B is arrival');
  assert.equal(s.stats.served, 0);
  assert.equal(camped(s, 0), true, 'standing on the beta, stalled — that is camping');
});

test('CAMPING IS WAITING: patience drains on a beta at exactly the origin rate', () => {
  let s = waits(staged().s, 2).s;                  // walk the last two steps onto the beta
  assert.equal(s.users[0].at, 3);
  const walked = s.users[0].waited;

  s = waits(s, 1).s;
  assert.equal(camped(s, 0), true);
  assert.equal(s.users[0].waited, walked + 1, 'the walk itself cost nothing; the camp costs');

  // The camp and the origin run the same clock, tick for tick.
  let queued = waits(init(CORRIDOR, 1), 4).s;
  assert.equal(queued.users[0].state, 'queued');
  const start = { camp: s.users[0].waited, queue: queued.users[0].waited };
  for (let n = 1; n <= 5; n++) {
    s = waits(s, 1).s;
    queued = waits(queued, 1).s;
    assert.equal(s.users[0].waited, start.camp + n, `camp, tick ${n}`);
    assert.equal(queued.users[0].waited, start.queue + n, `origin, tick ${n}`);
    assert.equal(s.users[0].stalled, true);
  }
});

test('a camper that waits too long gives up on the beta it was camped on', () => {
  const { s, ev } = waits(staged({ id: 'beta-impatient', patience: 8 }).s, 20);
  assert.deepEqual(only(ev, 'userLost'), [{ t: 'userLost', user: 0, at: 3, reason: 'gaveUp' }]);
  assert.equal(s.users[0].state, 'gone');
  assert.equal(s.stats.lost, 1);
  assert.equal(s.stats.served, 0);
  assert.equal(s.phase.k, 'lost');
});

// --- (d) moving on, including the visited reset ---------------------------------------

test('a camp holds until something better is reachable, and then breaks at once', () => {
  let s = waits(staged().s, 3).s;
  assert.equal(camped(s, 0), true);

  // More road, but no new waypoint: the camp is unmoved, which is the whole rule.
  ({ s } = play(s, [{ t: 'place', cell: 4 }, { t: 'place', cell: 5 }, { t: 'place', cell: 6 }]));
  assert.equal(s.users[0].at, 3);
  assert.equal(camped(s, 0), true, 'a longer road to nowhere is still nowhere');

  // The tile that closes the route retargets it on the same tick.
  ({ s } = play(s, [{ t: 'place', cell: 7 }]));
  assert.equal(s.users[0].at, 4, 'it left the camp the instant B was reachable');
  const { s: end, ev } = waits(s, 4);
  assert.equal(end.users[0].state, 'arrived');
  assert.equal(end.stats.served, 1);
  assert.equal(only(ev, 'arrived').length, 1);
});

test('a strictly better beta retargets a camper; the one it leaves keeps standing', () => {
  let s = waits(staged().s, 3).s;
  assert.equal(camped(s, 0), true);

  ({ s } = play(s, [{ t: 'place', cell: 4 }, { t: 'beta', cell: 5 }]));
  assert.equal(s.users[0].at, 4, 'the better milestone broke the camp');
  s = waits(s, 1).s;
  assert.equal(s.users[0].at, 5);
  assert.equal(camped(s, 0), false, 'it arrived this tick — camping starts when it stalls');
  s = waits(s, 1).s;
  assert.equal(camped(s, 0), true);
  assert.equal(s.con[3].k, 'beta', 'and the milestone it walked past is still there');
  assert.equal(s.stats.betas, 2);
});

//  x: 0 1 2 3 4        Two arms of equal length join A to B. The beta goes on the top arm,
//  0  . 1 2 3 4        which is then never finished; the route is closed along the bottom.
//  1  A 6 . . B
//  2  . 11 12 13 14
const DETOUR = {
  id: 'beta-detour',
  map: ['.####', 'A#..B', '.####'].join('\n'),
  arrivals: { count: 1, firstTick: 0, every: 1 },
  patience: 30,
};

test('THE VISITED RESET: a camper turns around when the route opens behind it', () => {
  const base = init(DETOUR, 1);
  const [junction, tip] = [6, 3];
  let s = play(base, [
    { t: 'place', cell: junction }, { t: 'place', cell: 1 }, { t: 'place', cell: 2 },
    { t: 'beta', cell: tip },
  ]).s;
  s = waits(s, 4).s;
  assert.equal(camped(s, 0), true, 'camped up the top arm, three quarters of the way to B');
  assert.deepEqual(s.users[0].visited, [base.origin, junction, 1, 2, tip]);

  // Close the route along the *bottom* arm. The beta's one open neighbour is now a cell its
  // own trail already owns, so the trip that trail belongs to is over and a new one starts
  // from where it stands (SPEC §6.3.3, rev. 2026-08-05). Without the reset this user would
  // stand on a milestone next to a finished road until its patience ran out.
  s = play(s, [11, 12, 13, 14].map((cell) => /** @type {Action} */ ({ t: 'place', cell }))).s;
  assert.equal(s.users[0].at, 2, 'it turned around');
  assert.deepEqual(s.users[0].visited, [tip, 2], 'on a fresh trail, because the trip changed');
  assert.equal(s.users[0].stalled, false);

  const { s: end } = waits(s, 7);
  assert.equal(end.users[0].state, 'arrived');
  assert.equal(end.stats.served, 1);
});

// --- (e) the backwards spur ------------------------------------------------------------

test('THE PROGRESS GUARD: a beta behind the origin attracts nobody', () => {
  const level = {
    id: 'beta-backwards',
    map: '#A#####B',
    arrivals: { count: 1, firstTick: 0, every: 1 },
    patience: 30,
  };
  const s = play(init(level, 1), [{ t: 'beta', cell: 0 }]).s;

  const wf = waypointField(s);
  assert.equal(wf.dist[s.origin], 1, 'the beta is one step away and perfectly reachable…');
  assert.equal(canProgress(s, wf, s.origin), false, '…and it is the wrong way');
  assert.equal(gateOpen(s), false, 'so the gate stays shut');

  const held = waits(s, 3);
  assert.equal(only(held.ev, 'departed').length, 0);
  assert.equal(held.s.users[0].state, 'queued');
  assert.equal(held.s.users[0].at, held.s.origin);

  // A beta on the far side of the origin opens the same gate on the same board.
  const ahead = play(s, [{ t: 'beta', cell: s.origin + 1 }]);
  assert.equal(gateOpen(ahead.s), true);
  assert.equal(only(ahead.ev, 'departed').length, 1);
});

// --- (f) a blast takes a beta ----------------------------------------------------------

test('a blast destroys a beta, kills its campers, and refunds nothing', () => {
  let s = staged({ id: 'beta-blast', arrivals: NEVER }).s;
  const mined = 4;
  s = { ...s, con: s.con.slice() };
  s.con[mined] = { k: 'aiHidden', mine: true, block: 0, flagged: false };
  s.blocks = [{ id: 0, cells: [mined] }];
  // Two campers on the beta, one walker still down the corridor behind them.
  s.users = [
    { id: 0, at: 3, state: 'moving', todo: [0], visited: [s.origin, 1, 2, 3], stalled: true, waited: 2 },
    { id: 1, at: 3, state: 'moving', todo: [0], visited: [s.origin, 1, 2, 3], stalled: true, waited: 2 },
    { id: 2, at: 1, state: 'moving', todo: [0], visited: [s.origin, 1], stalled: false, waited: 0 },
  ];
  s.schedule = { ...s.schedule, total: 3, spawned: 3 };
  assert.equal(s.stats.betas, 1);

  // Clicking the defect next door craters it, and the beta is inside the radius.
  const { s: after, ev } = reduce(s, { t: 'analyze', cell: mined });
  const boom = /** @type {any} */ (ev.find((e) => e.t === 'detonate'));
  assert.ok(boom);
  assert.ok(boom.destroyed.includes(3), 'a beta is construction like any other');
  assert.equal(after.con[3].k, 'none');
  assert.deepEqual(
    only(ev, 'userLost').map((e) => /** @type {any} */ (e).user),
    [0, 1],
    'campers die in a crater like anyone else standing in one',
  );

  // THE SUPPLY IS NOT REFUNDED. You shipped it; it is gone whatever became of the tile.
  assert.equal(after.stats.betas, 1);
  assert.equal(betaRejection(after, 3), '', 'two of three left, not three');
  const spent = play(after, [{ t: 'beta', cell: 3 }, { t: 'beta', cell: 4 }]).s;
  assert.equal(spent.stats.betas, 3);
  assert.equal(betaRejection(spent, 5), 'no beta supply remaining');

  // And the survivor re-stalls on the tick of the blast, not the tick after (PLAN §7.1.3).
  assert.equal(after.users[2].state, 'moving');
  assert.equal(after.users[2].stalled, true);
  assert.equal(after.users[2].waited, 1);
  assert.equal(waypointField(after).dist[after.users[2].at], -1, 'there is nowhere left to walk');
});

// --- (g) a beta on the far side of slop ------------------------------------------------

test('a beta beyond unreviewed slop marches users into it, for better or worse', () => {
  /** @param {boolean} mine */
  const board = (mine) => {
    let s = play(init({ ...CORRIDOR, id: `beta-slop-${mine}` }, 1), [{ t: 'place', cell: 1 }]).s;
    s = { ...s, con: s.con.slice() };
    s.con[2] = { k: 'aiHidden', mine, block: 0, flagged: false };
    s.blocks = [{ id: 0, cells: [2] }];
    return play(s, [{ t: 'beta', cell: 3 }]).s;
  };

  // Clean slop: the user walks over it and turns it over on the way, with no special case.
  const clean = waits(board(false), 3);
  assert.deepEqual(only(clean.ev, 'reveal'), [{ t: 'reveal', cell: 2 }]);
  assert.equal(clean.s.con[2].k, 'aiRevealed');
  assert.equal(camped(clean.s, 0), true);

  // Mined slop: the same walk, the same standard detonation, and the milestone goes with it.
  const bad = waits(board(true), 3);
  assert.ok(only(bad.ev, 'detonate').length >= 1);
  assert.deepEqual(
    only(bad.ev, 'userLost'),
    [{ t: 'userLost', user: 0, at: 2, reason: 'detonation' }],
    'the gate is topological, not safe — a beta does not make it safe either',
  );
  assert.equal(bad.s.con[3].k, 'none', 'the milestone was inside the blast radius');
  assert.equal(bad.s.stats.betas, 1, 'and it is still spent');
});

// --- (h) clue arithmetic ---------------------------------------------------------------

test('a beta holds no defect, so it counts zero as a neighbour (SPEC §7.5)', () => {
  const s = init(BOARD, 1);
  const centre = cellAt(s, 3, 1);
  const beside = cellAt(s, 3, 0);

  s.con[beside] = CON_BETA;
  assert.equal(cellHasMine(s, beside), false);
  assert.deepEqual(clue(s, centre), { lo: 0, hi: 0 }, 'a beta adds nothing to the count');

  // It is transparent, not opaque: a defect beside it still counts, from both sides.
  s.con[cellAt(s, 4, 0)] = { k: 'aiHidden', mine: true, block: 0, flagged: false };
  assert.deepEqual(clue(s, centre), { lo: 1, hi: 1 });
  assert.deepEqual(clue(s, beside), { lo: 1, hi: 1 });
});

// --- the sim variant -------------------------------------------------------------------

test('the -beta policy modifier parses and composes with the ghost styles', () => {
  assert.equal(makePolicy('careful-beta:0.4', 1).name, 'careful-beta:0.4');
  assert.equal(makePolicy('balanced-edge-beta:0.4', 1).name, 'balanced-edge-beta:0.4');
  assert.equal(makePolicy('balanced-beta-edge:0.4', 1).name, 'balanced-beta-edge:0.4');
  assert.throws(() => makePolicy('beta', 1), /unknown policy 'beta'/);
});

test('a -beta bot ships betas under pressure and never asks for an illegal one', () => {
  const bot = makePolicy('careful-beta:0.4', 3);
  let s = init(getLevel('sprawl'), 3);
  let guard = 0;
  while ((s.phase.k === 'play' || s.phase.k === 'placing') && guard++ < 300) {
    const a = bot.act(s);
    const cell = /** @type {{ cell?: number }} */ (a).cell;
    const kinds = cell === undefined ? legalActions(s) : legalActions(s, cell);
    assert.ok(kinds.includes(a.t), `the bot asked for ${a.t}, which is not on offer`);
    const r = reduce(s, a);
    assert.equal(r.ev.some((e) => e.t === 'rejected'), false);
    bot.observe(r.ev);
    s = r.s;
  }
  assert.ok(s.stats.betas > 0, 'a long level on a tight schedule should reach for one');
  assert.ok(s.stats.betas <= RULES.BETA_SUPPLY);
});
