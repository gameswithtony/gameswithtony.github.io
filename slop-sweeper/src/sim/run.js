// @ts-check
// Node CLI over batch.js (PLAN §13). Argument parsing and table formatting, nothing else —
// every number below comes from `runGames`, which the browser Level Lab calls too.
//
//   node src/sim/run.js --level caldera --policy balanced:0.5 --games 200 --seed 1
//   node src/sim/run.js --all
//   node src/sim/run.js --all --games 200 --policy handOnly --policy careful:0.4

import { runGames } from './batch.js';
import { DEFAULT_SWEEP } from './policies.js';
import { getLevel, levelIds } from '../levels/index.js';

/**
 * @param {string[]} argv
 * @returns {{ levels: string[], policies: string[], games: number, seed: number, solver: boolean, verbose: boolean }}
 */
function parseArgs(argv) {
  /** @type {string[]} */
  const levels = [];
  /** @type {string[]} */
  const policies = [];
  let games = 100;
  let seed = 1;
  let all = false;
  let solver = true;
  let verbose = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '--all': all = true; break;
      case '--level': levels.push(argv[++i]); break;
      case '--policy': policies.push(argv[++i]); break;
      case '--games': games = Number(argv[++i]); break;
      case '--seed': seed = Number(argv[++i]); break;
      case '--no-solver': solver = false; break;
      case '--verbose': verbose = true; break;
      case '--help': case '-h':
        console.log('usage: node src/sim/run.js [--all] [--level id]… [--policy name[:p]]… [--games N] [--seed S] [--no-solver] [--verbose]');
        process.exit(0);
        break;
      default:
        throw new Error(`unknown argument '${a}' (try --help)`);
    }
  }

  if (all || levels.length === 0) levels.push(...levelIds().filter((id) => !levels.includes(id)));
  if (policies.length === 0) policies.push(...DEFAULT_SWEEP);
  if (!Number.isInteger(games) || games < 1) throw new Error('--games must be a positive integer');
  return { levels, policies, games, seed, solver, verbose };
}

/**
 * @param {number} x
 * @param {number} [places]
 * @returns {string}
 */
const num = (x, places = 1) => x.toFixed(places);

/** @param {number} x */
const pct = (x) => `${(x * 100).toFixed(0)}%`;

/**
 * @param {string[]} header
 * @param {string[][]} rows
 * @returns {string}
 */
function markdownTable(header, rows) {
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length)));
  const line = (cells) => `| ${cells.map((c, i) => (c ?? '').padEnd(widths[i])).join(' | ')} |`;
  return [
    line(header),
    `| ${widths.map((w) => '-'.repeat(w)).join(' | ')} |`,
    ...rows.map(line),
  ].join('\n');
}

const args = parseArgs(process.argv.slice(2));
const started = Date.now();

/** @type {string[][]} */
const rows = [];
for (const id of args.levels) {
  const def = getLevel(id);
  for (const policy of args.policies) {
    const st = runGames(def, policy, args.games, args.seed, { solver: args.solver });
    rows.push([
      id,
      policy,
      pct(st.winRate),
      st.medianWinTicks ? num(st.medianWinTicks, 0) : '—',
      num(st.meanWinConfidence),
      num(st.detonationsPerGame, 2),
      num(st.waitingPerGame, 0),
      num(st.verbs.placed, 1),
      num(st.verbs.generated, 1),
      num(st.verbs.analyzed, 1),
      num(st.refundsPerGame, 2),
      pct(st.guessForcedRate),
      st.rejects ? String(st.rejects) : '·',
    ]);
    if (args.verbose) console.error(`  ${id} × ${policy}: ${pct(st.winRate)}`);
  }
}

console.log(`# slop-sweeper sim — ${args.games} games/cell, seed ${args.seed}\n`);
console.log(markdownTable(
  ['level', 'policy', 'win', 'medTicks', 'confW', 'dets', 'waitΣ', 'place', 'gen', 'analyze', 'refund', 'guess', 'bad'],
  rows,
));
console.log(`\n_${rows.length} cells in ${((Date.now() - started) / 1000).toFixed(1)}s. `
  + 'medTicks/confW are over winning games; waitΣ is the waiting-tick integral; '
  + 'guess is the share of games where deduction was ever impossible on a live route; '
  + 'bad counts rejected bot actions (should be ·)._');
