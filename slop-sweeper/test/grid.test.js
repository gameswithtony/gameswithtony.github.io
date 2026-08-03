// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';

import { cellAt, n4, n8, parseMap } from '../src/core/grid.js';

test('the legend maps every authored character', () => {
  const m = parseMap('A#^.B');
  assert.equal(m.w, 5);
  assert.equal(m.h, 1);
  assert.deepEqual(m.terrain, ['ocean', 'ocean', 'volcano', 'void', 'ocean']);
  assert.equal(m.origin, 0);
  assert.equal(m.dest, 4);
});

test('space is an alias of void', () => {
  const dots = parseMap('A.#.B');
  const spaces = parseMap('A #.B');
  assert.deepEqual(spaces.terrain, dots.terrain);
});

test('short rows are right-padded with void and trailing whitespace is invisible', () => {
  const m = parseMap(['A##', '#  ', '##B      '].join('\n'));
  assert.equal(m.w, 3);
  assert.equal(m.h, 3);
  assert.deepEqual(m.terrain, [
    'ocean', 'ocean', 'ocean',
    'ocean', 'void', 'void',
    'ocean', 'ocean', 'ocean',
  ]);
  assert.equal(m.dest, 8);
});

test('blank leading and trailing lines are dropped, so template literals just work', () => {
  const m = parseMap('\n\nA#B\n\n');
  assert.equal(m.h, 1);
  assert.equal(m.origin, 0);
});

test('an unknown character is a hard error naming its row and column', () => {
  assert.throws(
    () => parseMap(['A##', '#X#', '##B'].join('\n')),
    (err) => {
      assert.match(String(err.message), /unknown map character 'X'/);
      assert.match(String(err.message), /row 2/);
      assert.match(String(err.message), /column 2/);
      return true;
    },
  );
});

test('parseMap demands exactly one A and one B', () => {
  assert.throws(() => parseMap('###'), /no origin 'A'/);
  assert.throws(() => parseMap('A##'), /no destination 'B'/);
  assert.throws(() => parseMap('A#A#B'), /more than one 'A'/);
  assert.throws(() => parseMap('A#B#B'), /more than one 'B'/);
});

test('the bounding box frames the playable cells, not the array', () => {
  const m = parseMap([
    '.....',
    '..A#.',
    '..##.',
    '...B.',
    '.....',
  ].join('\n'));
  assert.equal(m.w, 5);
  assert.equal(m.h, 5);
  assert.deepEqual(m.bbox, { x0: 2, y0: 1, x1: 3, y1: 3 });
});

test('n4/n8 are void-filtered in both directions', () => {
  const m = parseMap([
    'A#.',
    '###',
    '.#B',
  ].join('\n'));
  const a = cellAt(m, 0, 0);
  const voidCell = cellAt(m, 2, 0);
  const centre = cellAt(m, 1, 1);

  assert.deepEqual(n4(m, a).sort((x, y) => x - y), [cellAt(m, 1, 0), cellAt(m, 0, 1)].sort((x, y) => x - y));
  assert.ok(!n4(m, cellAt(m, 1, 0)).includes(voidCell), 'void neighbour must not be offered');
  assert.deepEqual(n4(m, voidCell), [], 'a void cell has no neighbours at all');
  assert.deepEqual(n8(m, voidCell), []);

  assert.equal(n8(m, centre).length, 6, 'two of the eight surrounding cells are void');
  assert.ok(!n8(m, centre).includes(voidCell));
  assert.ok(n8(m, centre).includes(cellAt(m, 2, 2)), 'diagonals count for clues (SPEC §7.4)');
});

test('cellAt returns -1 outside the array', () => {
  const m = parseMap('A#B');
  assert.equal(cellAt(m, 1, 0), 1);
  assert.equal(cellAt(m, 3, 0), -1);
  assert.equal(cellAt(m, -1, 0), -1);
});
