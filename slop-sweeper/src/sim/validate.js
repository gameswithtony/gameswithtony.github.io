// @ts-check
// Node CLI: structural validation of one level or the whole registry (PLAN §9.1).
//
//   node src/sim/validate.js            all registered levels
//   node src/sim/validate.js caldera    just that one
//
// Exits non-zero if anything errored, so it drops straight into a check loop.

import { validateLevel } from '../core/validate.js';
import { getLevel, levelIds } from '../levels/index.js';

const wanted = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const ids = wanted.length ? wanted : levelIds();

let errors = 0;
let warnings = 0;

for (const id of ids) {
  let def;
  try {
    def = getLevel(id);
  } catch (err) {
    console.log(`✗ ${id}: ${/** @type {Error} */ (err).message}`);
    errors++;
    continue;
  }
  const result = validateLevel(def);
  errors += result.errors.length;
  warnings += result.warnings.length;
  const mark = result.errors.length ? '✗' : (result.warnings.length ? '!' : '✓');
  console.log(`${mark} ${id}`);
  for (const e of result.errors) console.log(`    error:   ${e}`);
  for (const w of result.warnings) console.log(`    warning: ${w}`);
}

console.log(`\n${ids.length} level(s), ${errors} error(s), ${warnings} warning(s)`);
process.exit(errors ? 1 : 0);
