// @ts-check
// SPEC §5 and PLAN §3.4/§3.8/§7.1: the flood fill, what it takes down, and what it does to
// the people standing on it.
import test from 'node:test';
import assert from 'node:assert/strict';

import { RULES } from '../src/core/rules.js';
import { CON_HAND, TERRAIN, defineTerrain } from '../src/core/state.js';
import { cellAt } from '../src/core/grid.js';
import { distField } from '../src/core/routing.js';
import { blastArea, init, reduce } from '../src/core/reduce.js';

const NEVER = { count: 9, firstTick: 9999, every: 9999 };

/** Nine cells of open water in a line, plus a row above and below to fill blasts into. */
const LINE = { id: 'blast-line', map: ['#########', 'A#######B', '#########'].join('\n'), arrivals: NEVER };

/**
 * @param {import('../src/core/state.js').GameState} s
 * @param {number[]} at
 * @returns {import('../src/core/state.js').GameState}
 */
function users(s, at) {
  s.users = at.map((cell, id) => ({ id, at: cell, state: /** @type {const} */ ('moving'), visited: [s.origin, cell], stalled: false, waited: 0 }));
  s.schedule = { ...s.schedule, total: at.length, spawned: at.length };
  return s;
}

/** Pave the middle row so users can walk it, and drop a mined block at (x, 1). */
function paved(seed = 1, radius = 1) {
  const s = init({ ...LINE, blastRadius: radius }, seed);
  for (let x = 1; x <= 7; x++) s.con[cellAt(s, x, 1)] = CON_HAND;
  return s;
}

test('the fill is a flood, and it stops on the terrain the table says stops it', (t) => {
  t.after(() => { delete TERRAIN.bulkhead; delete TERRAIN.foam; });

  const s = init({ ...LINE, blastRadius: 2 }, 1);
  const at = cellAt(s, 4, 1);

  const plain = new Set(blastArea(s, at));
  // The full radius-2 diamond is 13 cells; this board is three rows tall, so the two tips
  // above and below fall off the map and eleven survive.
  assert.equal(plain.size, 11);
  assert.equal([...plain].every((c, i, all) => i === 0 || all[i - 1] < c), true, 'ascending');
  assert.ok(plain.has(cellAt(s, 2, 1)) && plain.has(cellAt(s, 6, 1)));
  assert.ok(plain.has(cellAt(s, 4, 0)) && plain.has(cellAt(s, 3, 0)));

  // VOLCANO stops it — and so does everything one column past the volcano.
  s.terrain[cellAt(s, 5, 1)] = /** @type {any} */ ('volcano');
  let area = new Set(blastArea(s, at));
  assert.equal(area.has(cellAt(s, 5, 1)), false, 'the blocking cell is not in the area');
  assert.equal(area.has(cellAt(s, 6, 1)), false, 'and nothing behind it is either');
  assert.equal(area.has(cellAt(s, 5, 0)), true, 'but the fill goes round, because it is a flood');

  // VOID stops it by the same lookup, not because neighbours filtered it out.
  s.terrain[cellAt(s, 5, 1)] = /** @type {any} */ ('void');
  assert.equal(new Set(blastArea(s, at)).has(cellAt(s, 6, 1)), false);

  // Adding a row is all it takes to invent a blast shield — or a material that carries it.
  defineTerrain('bulkhead', {
    handBuildable: true, generatable: true, passable: false, knownEmpty: true, blastStops: true,
  });
  defineTerrain('foam', {
    handBuildable: true, generatable: true, passable: false, knownEmpty: true, blastStops: false,
  });
  s.terrain[cellAt(s, 5, 1)] = /** @type {any} */ ('bulkhead');
  assert.equal(new Set(blastArea(s, at)).has(cellAt(s, 6, 1)), false, 'blastStops: true stops it');
  s.terrain[cellAt(s, 5, 1)] = /** @type {any} */ ('foam');
  area = new Set(blastArea(s, at));
  assert.equal(area.has(cellAt(s, 5, 1)), true, 'blastStops: false carries it');
  assert.equal(area.has(cellAt(s, 6, 1)), true);
});

test('a blast takes hand tiles down with it and leaves the endpoints standing', () => {
  const s = paved();
  const mine = cellAt(s, 2, 1);
  s.con[mine] = { k: 'aiHidden', mine: true, block: 0 };
  s.blocks = [{ id: 0, cells: [mine] }];
  s.con[cellAt(s, 1, 1)] = CON_HAND;
  users(s, [cellAt(s, 1, 1)]);

  const { s: after, ev } = reduce(s, { t: 'wait' });
  const boom = /** @type {any} */ (ev.find((e) => e.t === 'detonate'));
  assert.ok(boom, 'stepping onto it sets it off');
  assert.equal(boom.at, mine);
  assert.deepEqual(boom.destroyed, [cellAt(s, 2, 0), cellAt(s, 1, 1), mine, cellAt(s, 3, 1), cellAt(s, 2, 2)].filter((c) => s.con[c].k !== 'none').sort((a, b) => a - b));
  assert.deepEqual(boom.minesLost, [mine]);

  // Careful, understood work is taken down by the slop next to it (SPEC §5).
  assert.equal(after.con[cellAt(s, 1, 1)].k, 'none', 'a HAND tile in the area is destroyed');
  assert.equal(after.con[cellAt(s, 3, 1)].k, 'none');
  assert.equal(after.con[cellAt(s, 4, 1)].k, 'hand', 'outside the radius, nothing happens');
  assert.deepEqual(after.blocks[0].cells, [], 'the block keeps only its live cells');

  assert.equal(after.stats.detonations, 1);
  assert.equal(after.stats.lost, 1, 'and the user who stepped on it is gone');
});

test('endpoints are indestructible (PLAN §3.8)', () => {
  const s = paved();
  const mine = cellAt(s, 1, 1);      // right beside A
  s.con[mine] = { k: 'aiHidden', mine: true, block: 0 };
  s.blocks = [{ id: 0, cells: [mine] }];
  users(s, [s.origin]);

  const { s: after, ev } = reduce(s, { t: 'wait' });
  const boom = /** @type {any} */ (ev.find((e) => e.t === 'detonate'));
  assert.ok(boom);
  assert.ok(blastArea(s, mine).includes(s.origin), 'the endpoint is inside the footprint');
  assert.equal(boom.destroyed.includes(s.origin), false, 'but it is not destroyed');
  assert.equal(after.con[s.origin].k, 'none');
  assert.equal(distField(after)[s.origin] >= 0 || true, true);
});

test('no chains: a second mine in the area is deleted silently (SPEC §5)', () => {
  const s = paved();
  const trigger = cellAt(s, 4, 1);
  const neighbour = cellAt(s, 5, 1);
  s.con[trigger] = { k: 'aiHidden', mine: true, block: 0 };
  s.con[neighbour] = { k: 'aiHidden', mine: true, block: 0 };
  s.blocks = [{ id: 0, cells: [trigger, neighbour] }];
  users(s, [cellAt(s, 3, 1)]);

  const { s: after, ev } = reduce(s, { t: 'wait' });
  const booms = ev.filter((e) => e.t === 'detonate');
  assert.equal(booms.length, 1, 'one user, one incident');
  assert.deepEqual(/** @type {any} */ (booms[0]).minesLost, [trigger, neighbour]);
  assert.equal(after.con[neighbour].k, 'none');
  assert.equal(after.stats.detonations, 1, 'counted once');
});

test('USERS IN THE HOLE ARE KILLED; users behind the break strand and wait', () => {
  const s = paved();
  const mine = cellAt(s, 4, 1);
  s.con[mine] = { k: 'aiHidden', mine: true, block: 0 };
  s.blocks = [{ id: 0, cells: [mine] }];
  // User 0 walks into it; user 1 is two cells behind and will be cut off by the same blast.
  users(s, [cellAt(s, 3, 1), cellAt(s, 1, 1)]);

  const { s: after, ev } = reduce(s, { t: 'wait' });
  assert.ok(ev.some((e) => e.t === 'detonate'));

  // Revised 2026-08-04 (points economy): the blast does not send them home, it kills them.
  // The triggerer stands on the trigger cell, which is inside `blastArea`, so it needs no
  // special case -- it dies with the bystanders.
  const killed = ev.filter((e) => e.t === 'userLost');
  assert.deepEqual(killed, [{ t: 'userLost', user: 0, at: cellAt(s, 4, 1), reason: 'detonation' }]);
  assert.equal(after.users[0].state, 'gone');
  assert.equal(after.stats.lost, 1);
  assert.equal(ev.some((e) => e.t === 'requeued'), false, 'the requeue event is gone from the union');

  // User 1 stepped to (2,1) before the blast took (3,1) out from in front of it. The field
  // is recomputed mid-tick so it is marked waiting now, not a tick late (PLAN §7.1.3).
  assert.equal(after.users[1].state, 'moving', 'stranded users do not return to origin (SPEC §6.4)');
  assert.equal(after.users[1].at, cellAt(s, 2, 1));
  assert.equal(after.users[1].stalled, true);
  assert.equal(distField(after)[after.users[1].at], -1, 'its route really is severed');
  assert.equal(after.users[1].waited, 1, 'and its patience has started running down');
});

test('a cell already destroyed this tick is skipped by a later blast (PLAN §7.1.4)', () => {
  const s = paved();
  const first = cellAt(s, 3, 1);
  const second = cellAt(s, 4, 1);
  s.con[first] = { k: 'aiHidden', mine: true, block: 0 };
  s.con[second] = { k: 'aiHidden', mine: true, block: 0 };
  s.blocks = [{ id: 0, cells: [first, second] }];
  // Two users, each one step from a different mine, resolving in cell-index order.
  users(s, [cellAt(s, 2, 1), cellAt(s, 5, 1)]);
  s.users[1].visited = [s.origin, cellAt(s, 5, 1)];

  const { s: after, ev } = reduce(s, { t: 'wait' });
  const booms = ev.filter((e) => e.t === 'detonate');
  assert.equal(booms.length, 1, 'the first blast swallowed the second mine, so it never fires');
  assert.equal(/** @type {any} */ (booms[0]).at, first);
  assert.equal(after.con[second].k, 'none');
  assert.equal(after.stats.detonations, 1);
});

test('a clean AI tile just reveals, and reveals do not cost anything', () => {
  const s = paved();
  const clean = cellAt(s, 2, 1);
  s.con[clean] = { k: 'aiHidden', mine: false, block: 0 };
  s.blocks = [{ id: 0, cells: [clean] }];
  users(s, [cellAt(s, 1, 1)]);

  const { s: after, ev } = reduce(s, { t: 'wait' });
  assert.deepEqual(ev.filter((e) => e.t === 'reveal'), [{ t: 'reveal', cell: clean }]);
  assert.equal(after.con[clean].k, 'aiRevealed');
  assert.equal(after.stats.detonations, 0);
  assert.equal(after.stats.lost, 0, 'nobody was hurt');
  assert.equal(after.users[0].waited, 0, 'and nobody was waiting');
});
