// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import { POOLS, SHAPES, SIZE_RANGE, resolvePool, rotationsOf, shapeIndex } from '../src/core/shapes.js';

test('the table holds exactly the twelve PLAN §10 stencils, 12-26 cells each', () => {
  assert.deepEqual(
    SHAPES.map((s) => s.id),
    ['R12', 'P14', 'O16', 'L16', 'W20', 'C20', 'T14', 'Y15', 'Z16', 'U18', 'H22', 'O25'],
  );
  assert.deepEqual([...SIZE_RANGE], [12, 26]);
  for (const s of SHAPES) {
    assert.equal(s.cells.length, s.size);
    assert.ok(s.size >= SIZE_RANGE[0] && s.size <= SIZE_RANGE[1], `${s.id} is ${s.size} cells`);
    assert.equal(Math.min(...s.cells.map((c) => c[0])), 0, `${s.id} is not normalized in x`);
    assert.equal(Math.min(...s.cells.map((c) => c[1])), 0, `${s.id} is not normalized in y`);
    assert.equal(new Set(s.cells.map((c) => c.join(','))).size, s.size, `${s.id} repeats a cell`);
    // The id's trailing digits state the size — a typo in the stencil shows up here.
    assert.equal(Number(s.id.slice(1)), s.size);
  }
});

test('THE CHUNKINESS RULE: no stencil has a limb one cell wide', () => {
  // Operationalized as "every cell belongs to some 2×2 block of the shape". A one-cell
  // tendril fails it, and a tendril's clues constrain nothing — deduction degenerates into
  // guessing, which is the whole reason SPEC §4.2 curates the table by hand.
  for (const s of SHAPES) {
    const filled = new Set(s.cells.map((c) => c.join(',')));
    for (const [x, y] of s.cells) {
      const square = ([ox, oy]) => filled.has(`${x + ox},${y + oy}`) && filled.has(`${x + ox + 1},${y + oy}`)
        && filled.has(`${x + ox},${y + oy + 1}`) && filled.has(`${x + ox + 1},${y + oy + 1}`);
      assert.ok(
        [[0, 0], [-1, 0], [0, -1], [-1, -1]].some(square),
        `${s.id} has a one-cell-wide limb at (${x},${y})`,
      );
    }
  }
});

test('the stencils are the shapes PLAN §10 draws', () => {
  const box = (id) => {
    const s = SHAPES[shapeIndex(id)];
    return [Math.max(...s.cells.map((c) => c[0])) + 1, Math.max(...s.cells.map((c) => c[1])) + 1];
  };
  assert.deepEqual(box('R12'), [4, 3], 'R12 is the plain 4×3 rectangle');
  assert.deepEqual(box('O16'), [4, 4]);
  assert.deepEqual(box('O25'), [5, 5]);
  assert.deepEqual(box('Z16'), [6, 4], 'the staircase is the widest stencil');
  assert.deepEqual(box('C20'), [4, 6]);

  assert.deepEqual(SHAPES[shapeIndex('R12')].cells, [
    [0, 0], [1, 0], [2, 0], [3, 0], [0, 1], [1, 1], [2, 1], [3, 1], [0, 2], [1, 2], [2, 2], [3, 2],
  ]);
  assert.deepEqual(SHAPES[shapeIndex('U18')].cells, [
    [0, 0], [1, 0], [3, 0], [4, 0],
    [0, 1], [1, 1], [3, 1], [4, 1],
    [0, 2], [1, 2], [2, 2], [3, 2], [4, 2],
    [0, 3], [1, 3], [2, 3], [3, 3], [4, 3],
  ], 'the U keeps its notch two cells deep');
});

test('rotation dedup counts follow each shape symmetry (rotation only, no reflection)', () => {
  /** @type {Record<string, number>} */
  const expected = {
    O16: 1, O25: 1,                         // the squares are their own rotation
    R12: 2, W20: 2, Z16: 2,                 // 180-degree symmetric
    P14: 4, L16: 4, C20: 4, T14: 4, Y15: 4, U18: 4, H22: 4,
  };
  assert.deepEqual(Object.keys(expected).sort(), SHAPES.map((s) => s.id).sort());
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
  // R12 lying down is 4×3; one quarter turn stands it up as 3×4, same twelve cells.
  const r12 = rotationsOf(shapeIndex('R12'));
  assert.deepEqual(r12[1], [
    [0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1],
    [0, 2], [1, 2], [2, 2], [0, 3], [1, 3], [2, 3],
  ], 'one quarter turn clockwise');
});

test('rotationsOf caches, and shape lookups are total', () => {
  assert.equal(rotationsOf(0), rotationsOf(0));
  assert.throws(() => rotationsOf(99), /unknown shape index/);
  assert.throws(() => shapeIndex('Q9'), /unknown shape/);
});

test('the named pools are PLAN §10 and cover every shape exactly once', () => {
  assert.deepEqual(POOLS.compact, ['R12', 'P14', 'O16', 'L16', 'W20']);
  assert.deepEqual(POOLS.awkward, ['C20', 'T14', 'Y15', 'Z16', 'U18']);
  assert.deepEqual(POOLS.heavy, ['H22', 'O25']);
  const all = [...POOLS.compact, ...POOLS.awkward, ...POOLS.heavy];
  assert.equal(new Set(all).size, all.length);
  assert.deepEqual(new Set(all), new Set(SHAPES.map((s) => s.id)));

  // The pools are size bands as well as feel bands (PLAN §10).
  const size = (id) => SHAPES[shapeIndex(id)].size;
  for (const id of POOLS.compact) assert.ok(size(id) >= 12 && size(id) <= 20, `${id} is not compact-sized`);
  for (const id of POOLS.awkward) assert.ok(size(id) >= 14 && size(id) <= 20, `${id} is not awkward-sized`);
  for (const id of POOLS.heavy) assert.ok(size(id) >= 22 && size(id) <= 26, `${id} is not heavy-sized`);
});

test('pools resolve by name, by union, and by explicit shape ids', () => {
  const compact = resolvePool('compact');
  assert.deepEqual(compact, POOLS.compact.map(shapeIndex).sort((a, b) => a - b));

  // The `+` grammar: empty segments are ignored, so PLAN §9's 'compact+' is exactly compact.
  assert.deepEqual(resolvePool('compact+'), compact);
  assert.deepEqual(resolvePool('compact+awkward').length, 10);
  assert.deepEqual(resolvePool('awkward+heavy').length, 7);
  assert.deepEqual(resolvePool('compact+compact'), compact, 'a union never repeats a shape');

  assert.deepEqual(resolvePool(['O25', 'R12']), [shapeIndex('R12'), shapeIndex('O25')].sort((a, b) => a - b));

  assert.throws(() => resolvePool('gentle'), /unknown pool 'gentle'/);
  assert.throws(() => resolvePool('+'), /names no pool/);
  assert.throws(() => resolvePool([]), /is empty/);
  assert.throws(() => resolvePool(['nope']), /unknown shape/);
});
