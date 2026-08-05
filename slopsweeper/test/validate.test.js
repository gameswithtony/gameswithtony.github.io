// @ts-check
// PLAN §9.1: the validator is structural only, and init() refuses to load a level it rejects.
import test from 'node:test';
import assert from 'node:assert/strict';

import { MAX_DIM, validateLevel } from '../src/core/validate.js';
import { init } from '../src/core/reduce.js';
import { allLevels, levelIds } from '../src/levels/index.js';

/** @param {Partial<import('../src/levels/index.js').LevelDef>} over */
const level = (over) => /** @type {any} */ ({ id: 'v', map: ['####', 'A##B', '####'].join('\n'), ...over });

/** @param {Partial<import('../src/levels/index.js').LevelDef>} over */
const errors = (over) => validateLevel(level(over)).errors.join(' | ');

test('a minimal { id, map } level is valid and playable', () => {
  const def = { id: 'v-minimal', map: 'A#B' };
  assert.deepEqual(validateLevel(/** @type {any} */ (def)).errors, []);
  const s = init(/** @type {any} */ (def), 1);
  assert.equal(s.level, 'v-minimal');
  assert.equal(s.schedule.total, 10, 'every optional field defaulted');
});

test('error: an unknown map character, named by row and column', () => {
  assert.match(errors({ map: ['####', 'A#XB', '####'].join('\n') }), /unknown map character 'X'.*row 2.*column 3/);
});

test('error: not exactly one A and one B', () => {
  assert.match(errors({ map: '###' }), /no origin 'A'/);
  assert.match(errors({ map: 'A##' }), /no destination 'B'/);
  assert.match(errors({ map: 'A#A#B' }), /more than one 'A'/);
  assert.match(errors({ map: 'A#B#B' }), /more than one 'B'/);
});

test('error: an endpoint with no buildable neighbour', () => {
  //  A boxed in by volcano on the only side it has.
  assert.match(errors({ map: ['.^..', 'A^#B', '.^..'].join('\n') }), /endpoint 'A' has no buildable neighbour/);
  // Two endpoints side by side are fine: the connection already exists.
  assert.deepEqual(validateLevel(/** @type {any} */ ({ id: 'v-ab', map: 'AB' })).errors, []);
});

test('error: no ocean connectivity from A to B', () => {
  assert.match(errors({ map: ['A#^#B'].join('\n') }), /no ocean connectivity/);
  assert.match(errors({ map: ['A#.#B'].join('\n') }), /no ocean connectivity/);
});

test('error: a board over the size ceiling', () => {
  const wide = 'A' + '#'.repeat(MAX_DIM) + 'B';
  assert.match(errors({ map: wide }), new RegExp(`board is ${MAX_DIM + 2}×1; the ceiling is`));
  const tall = ['A#B', ...Array(MAX_DIM).fill('###')].join('\n');
  assert.match(errors({ map: tall }), /the ceiling is/);
});

test('error: a nonsense schedule, density or pool', () => {
  assert.match(errors({ arrivals: { count: 0, firstTick: 6, every: 4 } }), /arrivals\.count must be a positive integer/);
  assert.match(errors({ arrivals: { count: 3, firstTick: -1, every: 4 } }), /arrivals\.firstTick must be a non-negative integer/);
  assert.match(errors({ arrivals: { count: 3, firstTick: 6, every: 0 } }), /arrivals\.every must be a positive integer/);
  assert.match(errors({ mineDensity: 1.5 }), /mineDensity must be a probability/);
  assert.match(errors({ mineDensity: /** @type {any} */ ('lots') }), /mineDensity must be a probability/);
  assert.match(errors({ shapePool: /** @type {any} */ ('gentle') }), /unknown pool 'gentle'/);
  assert.match(errors({ shapePool: ['Q9'] }), /unknown shape 'Q9'/);
  assert.match(errors({ userMoveEvery: 0 }), /userMoveEvery must be an integer ≥ 1/);
  assert.match(errors({ blastRadius: -1 }), /blastRadius must be an integer ≥ 0/);
});

test('warnings: degenerate path, landlocked water, density outside the tuned band', () => {
  const degenerate = validateLevel(/** @type {any} */ ({ id: 'v-short', map: 'A#B' }));
  assert.deepEqual(degenerate.errors, []);
  assert.match(degenerate.warnings.join(' | '), /degenerate path length: A and B are 2 steps apart/);

  //  A pond nobody can reach: ocean cut off from both endpoints by volcano.
  const island = validateLevel(/** @type {any} */ (level({
    map: ['####', 'A##B', '^^^^', '####'].join('\n'),
  })));
  assert.deepEqual(island.errors, []);
  assert.match(island.warnings.join(' | '), /4 ocean cell\(s\) are landlocked/);

  assert.match(validateLevel(level({ mineDensity: 0.02 })).warnings.join(' | '), /outside the tuned range/);
  assert.match(validateLevel(level({ mineDensity: 0.9 })).warnings.join(' | '), /outside the tuned range/);
  assert.deepEqual(validateLevel(level({ mineDensity: 0.25 })).warnings.filter((w) => /tuned range/.test(w)), []);
});

test('init() refuses to load a level the validator rejects', () => {
  assert.throws(() => init(/** @type {any} */ ({ id: 'v-bad', map: 'A#^#B' }), 1), /level 'v-bad' is invalid/);
  assert.throws(() => init(/** @type {any} */ ({ id: 'v-bad2', map: 'A##' }), 1), /no destination 'B'/);
});

test('THE STANDING TEST: every registered level is structurally sound', () => {
  assert.deepEqual(levelIds(), ['plain', 'channel', 'atoll', 'caldera', 'strait', 'sprawl', 'delta']);
  for (const def of allLevels()) {
    const { errors: errs, warnings } = validateLevel(def);
    assert.deepEqual(errs, [], `${def.id} has errors`);
    assert.deepEqual(warnings, [], `${def.id} has warnings`);
    // …and it boots.
    const s = init(def, 1);
    assert.equal(s.level, def.id);
    assert.ok(s.w > 0 && s.h > 0);
    assert.ok(s.w <= MAX_DIM && s.h <= MAX_DIM);
  }
});
