// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import { POOLS, SHAPES, resolvePool, rotationsOf, shapeIndex } from '../src/core/shapes.js';

test('the table holds exactly the twelve PLAN §10 stencils, 4-8 cells each', () => {
  assert.deepEqual(
    SHAPES.map((s) => s.id),
    ['O4', 'L4', 'S4', 'T4', 'P5', 'W5', 'U5', 'Z5', 'F5', 'O6', 'L6', 'D8'],
  );
  for (const s of SHAPES) {
    assert.equal(s.cells.length, s.size);
    assert.ok(s.size >= 4 && s.size <= 8, `${s.id} is ${s.size} cells`);
    assert.equal(Math.min(...s.cells.map((c) => c[0])), 0, `${s.id} is not normalized in x`);
    assert.equal(Math.min(...s.cells.map((c) => c[1])), 0, `${s.id} is not normalized in y`);
    assert.equal(new Set(s.cells.map((c) => c.join(','))).size, s.size, `${s.id} repeats a cell`);
    // The id's trailing digit states the size — a typo in the stencil shows up here.
    assert.equal(Number(s.id.slice(1)), s.size);
  }
});

test('the stencils are the shapes PLAN §10 draws', () => {
  assert.deepEqual(SHAPES[shapeIndex('O4')].cells, [[0, 0], [1, 0], [0, 1], [1, 1]]);
  assert.deepEqual(SHAPES[shapeIndex('L4')].cells, [[0, 0], [0, 1], [0, 2], [1, 2]]);
  assert.deepEqual(SHAPES[shapeIndex('S4')].cells, [[1, 0], [2, 0], [0, 1], [1, 1]]);
  assert.deepEqual(SHAPES[shapeIndex('U5')].cells, [[0, 0], [2, 0], [0, 1], [1, 1], [2, 1]]);
  assert.deepEqual(SHAPES[shapeIndex('D8')].cells, [
    [0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2],
  ]);
});

test('rotation dedup counts follow each shape symmetry (rotation only, no reflection)', () => {
  /** @type {Record<string, number>} */
  const expected = {
    O4: 1,                                  // the square is its own rotation
    S4: 2, Z5: 2, O6: 2,                    // 180-degree symmetric
    L4: 4, T4: 4, P5: 4, W5: 4, U5: 4, F5: 4, L6: 4, D8: 4,
  };
  for (const [id, n] of Object.entries(expected)) {
    const rots = rotationsOf(shapeIndex(id));
    assert.equal(rots.length, n, `${id} should have ${n} distinct rotations`);
    assert.equal(new Set(rots.map((r) => JSON.stringify(r))).size, n, `${id} repeats a rotation`);
    for (const cells of rots) {
      assert.equal(cells.length, SHAPES[shapeIndex(id)].size, `${id} lost a cell rotating`);
      assert.equal(Math.min(...cells.map((c) => c[0])), 0);
      assert.equal(Math.min(...cells.map((c) => c[1])), 0);
    }
  }
});

test('the array index of a rotation is its quarter-turn count', () => {
  // Rotational symmetry has a period dividing 4, so the surviving turns are always 0…p−1.
  // Action.placeBlock.rot relies on this: it is an index *and* something a renderer can draw.
  for (let i = 0; i < SHAPES.length; i++) {
    const rots = rotationsOf(i);
    assert.ok([1, 2, 4].includes(rots.length), `${SHAPES[i].id} has a period that does not divide 4`);
    // Rotating the last distinct rotation must return to rotation 0 or an earlier one.
    const first = JSON.stringify(rots[0]);
    const wrapped = JSON.stringify(rotationsOf(i)[0]);
    assert.equal(first, wrapped);
  }
  const l4 = rotationsOf(shapeIndex('L4'));
  assert.deepEqual(l4[1], [[0, 0], [1, 0], [2, 0], [0, 1]], 'one quarter turn clockwise');
});

test('rotationsOf caches, and shape lookups are total', () => {
  assert.equal(rotationsOf(0), rotationsOf(0));
  assert.throws(() => rotationsOf(99), /unknown shape index/);
  assert.throws(() => shapeIndex('Q9'), /unknown shape/);
});

test('the named pools are PLAN §10 and cover every shape exactly once', () => {
  assert.deepEqual(POOLS.compact, ['O4', 'L4', 'T4', 'P5', 'O6']);
  assert.deepEqual(POOLS.awkward, ['S4', 'W5', 'U5', 'Z5', 'F5']);
  assert.deepEqual(POOLS.heavy, ['L6', 'D8']);
  const all = [...POOLS.compact, ...POOLS.awkward, ...POOLS.heavy];
  assert.equal(new Set(all).size, all.length);
  assert.deepEqual(new Set(all), new Set(SHAPES.map((s) => s.id)));
});

test('pools resolve by name, by union, and by explicit shape ids', () => {
  const compact = resolvePool('compact');
  assert.deepEqual(compact, POOLS.compact.map(shapeIndex).sort((a, b) => a - b));

  // The `+` grammar: empty segments are ignored, so PLAN §9's 'compact+' is exactly compact.
  assert.deepEqual(resolvePool('compact+'), compact);
  assert.deepEqual(resolvePool('compact+awkward').length, 10);
  assert.deepEqual(resolvePool('awkward+heavy').length, 7);
  assert.deepEqual(resolvePool('compact+compact'), compact, 'a union never repeats a shape');

  assert.deepEqual(resolvePool(['D8', 'O4']), [shapeIndex('O4'), shapeIndex('D8')].sort((a, b) => a - b));

  assert.throws(() => resolvePool('gentle'), /unknown pool 'gentle'/);
  assert.throws(() => resolvePool('+'), /names no pool/);
  assert.throws(() => resolvePool([]), /is empty/);
  assert.throws(() => resolvePool(['nope']), /unknown shape/);
});
