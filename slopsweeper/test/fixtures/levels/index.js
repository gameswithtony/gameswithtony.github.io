// @ts-check
// The ten levels the campaign shipped with until 2026-11-02, kept as test fixtures. They were
// tuned, measured and documented against the rules as they stood, and a lot of the suite
// asserts behaviour on their exact geometry. The campaign moved on; the fixtures did not.

import { resolveLevel } from '../../../src/levels/index.js';
import { tutorial } from './tutorial.js';
import { channel } from './channel.js';
import { strait } from './strait.js';
import { caldera } from './caldera.js';
import { atoll } from './atoll.js';
import { delta } from './delta.js';
import { marina } from './marina.js';
import { gyre } from './gyre.js';
import { reach } from './reach.js';
import { sprawl } from './sprawl.js';

const FIXTURES = new Map([tutorial, channel, strait, caldera, atoll, delta, marina, gyre, reach, sprawl]
  .map((d) => [d.id, d]));

/**
 * A fixture level with every default applied, exactly as `getLevel` would hand it back.
 * @param {string} id
 */
export function fixture(id) {
  const def = FIXTURES.get(id);
  if (!def) throw new Error(`unknown fixture level '${id}'`);
  return resolveLevel(def);
}

/** @returns {ReturnType<typeof fixture>[]} */
export function allFixtures() {
  return [...FIXTURES.keys()].map(fixture);
}
