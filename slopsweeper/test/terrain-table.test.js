// @ts-check
// Acceptance §15 item 1: adding a terrain feature is adding a row. This test invents one
// at runtime and checks that passability and buildability pick it up with no logic edits.
import test from 'node:test';
import assert from 'node:assert/strict';

import { TERRAIN, defineTerrain, isGeneratable, isHandBuildable, isPassable, stopsBlast, CON_NONE } from '../src/core/state.js';
import { cellAt } from '../src/core/grid.js';
import { gateOpen, passable } from '../src/core/routing.js';
import { init } from '../src/core/reduce.js';

const LEVEL = { id: 'terrain-table', map: 'A#B', arrivals: { count: 1, firstTick: 0, every: 1 } };

test('a new terrain row changes behaviour without touching any predicate', (t) => {
  t.after(() => { delete TERRAIN.marsh; delete TERRAIN.bedrock; });

  // Marsh: walkable ground you may also build on. Bedrock: neither, and it shields blasts.
  defineTerrain('marsh', {
    handBuildable: true, generatable: true, passable: true, knownEmpty: true, blastStops: false,
  });
  defineTerrain('bedrock', {
    handBuildable: false, generatable: false, passable: false, knownEmpty: true, blastStops: true,
  });

  assert.equal(isPassable('marsh', CON_NONE), true);
  assert.equal(isHandBuildable('marsh', CON_NONE), true);
  assert.equal(isGeneratable('marsh', CON_NONE), true);
  assert.equal(stopsBlast('marsh'), false);

  assert.equal(isPassable('bedrock', CON_NONE), false);
  assert.equal(isHandBuildable('bedrock', CON_NONE), false);
  assert.equal(stopsBlast('bedrock'), true);

  // …and the routing layer inherits it: an unbuilt marsh cell completes the path by itself.
  const s = init(LEVEL, 1);
  const mid = cellAt(s, 1, 0);
  assert.equal(passable(s, mid), false);
  assert.equal(gateOpen(s), false);

  s.terrain[mid] = /** @type {any} */ ('marsh');
  assert.equal(passable(s, mid), true);
  assert.equal(gateOpen(s), true, 'the departure gate reads the table, not a terrain name');

  s.terrain[mid] = /** @type {any} */ ('bedrock');
  assert.equal(gateOpen(s), false);
});

test('defineTerrain refuses an incomplete or duplicate row', (t) => {
  t.after(() => { delete TERRAIN.silt; });
  assert.throws(
    () => defineTerrain('silt', /** @type {any} */ ({ handBuildable: true })),
    /missing capability 'generatable'/,
  );
  defineTerrain('silt', {
    handBuildable: false, generatable: false, passable: false, knownEmpty: true, blastStops: false,
  });
  assert.throws(() => defineTerrain('silt', TERRAIN.silt), /already defined/);
});
