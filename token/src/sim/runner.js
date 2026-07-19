// runner.js — the headless balance harness (PLAN.md §4 runner, §6 WP3).
//
// Usage (run from /token):
//   node src/sim/runner.js --policy=qualified --runs=1000 --seed=42
//   node src/sim/runner.js --policy=all --runs=1000 --seed=1
//   node src/sim/runner.js --policy=pure-ai --runs=1000 --seed=1 --csv > out.csv
//   node src/sim/runner.js --policy=qualified --runs=500 --sweep renewal.baseDc=50,55,60
//
// Flags:
//   --policy=NAME   one of random|pure-ai|pure-self|no-qa|qualified, a comma list,
//                   or 'all'. (Required.)
//   --runs=N        runs per policy (default 1000). Seeds are S, S+1, ... S+N-1.
//   --seed=S        base seed (default 1).
//   --csv           emit one CSV row per run to stdout instead of the report.
//   --sweep PATH=v1,v2,v3   sweep a config knob (dotted path into the nested
//                   config) across values; report per value. WP4 drives this.
//
// This file is the ONLY Node-only module in WP3 (it uses node:process for argv).
// The policies it drives stay environment-pure. The runner is a privileged
// driver: it may read the FULL state to record hidden final stats — the fair-bot
// boundary constrains the policies, not the instrument measuring them.

import process from 'node:process';

import { config } from '../../config.js';
import { createRng, rngFromState } from './rng.js';
import { initState } from '../state.js';
import { pendingDecisions, applyDecision } from './engine.js';
import { visibleState } from './visible.js';
import { calibration } from './decay.js';
import { classes } from '../data/classes.js';

import random from '../policies/random.js';
import pureAi from '../policies/pure-ai.js';
import pureSelf from '../policies/pure-self.js';
import noQa from '../policies/no-qa.js';
import qualified from '../policies/qualified.js';

const POLICIES = { random, 'pure-ai': pureAi, 'pure-self': pureSelf, 'no-qa': noQa, qualified };
const POLICY_ORDER = ['random', 'pure-ai', 'pure-self', 'no-qa', 'qualified'];
const ROLES = ['junior', 'qa', 'senior'];
const DEATHS = ['bankruptcy', 'burnout', 'fired'];   // engine deaths; endRun causes add themselves
const WINS = new Set(['qualified']);
const SURVIVED = new Set(['qualified', 'impostor']); // reached the month-12 verdict

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const round = (x) => Math.round(x * 10) / 10;

// A traits palette for synthesized candidate offers. Only 'quick study',
// 'steady under pages' and 'flight risk' carry mechanics in WP1; the fourth is
// mechanically neutral. WP2's candidates.js is the authoritative generator — see
// the report's "missing from the engine surface" note.
const TRAITS = ['quick study', 'steady under pages', 'flight risk', 'generalist'];
const NAMES = {
  junior: ['Robin', 'Sky', 'Devon', 'Pat'],
  qa: ['Morgan', 'Quinn', 'Alex', 'Sam'],
  senior: ['Casey', 'Jordan', 'Riley', 'Drew']
};

// ---------------------------------------------------------------------------
// Outfitting offer — synthesized from config bands (WP2's candidates.js will own
// this for real). resumeUnd is the CLAIMED figure the policy sees; trueUnd is the
// hidden Understanding that goes into initState. The view handed to the policy
// carries NO trueUnd, so the fair-bot boundary holds even at outfitting.
// ---------------------------------------------------------------------------
function makeOffer(seed) {
  const rng = createRng((seed ^ 0x5f356495) >>> 0);
  const classesView = classes.map((c) => ({
    id: c.id, name: c.name, cash: c.cash, multiplier: c.multiplier,
    skills: { ...c.skills }, quirks: { ...c.quirks }
  }));
  const models = Object.keys(config.tokenCosts);

  const full = { junior: [], qa: [], senior: [] };
  const view = { junior: [], qa: [], senior: [] };
  for (const role of ROLES) {
    const [cmin, cmax] = config.claimedRanges[role];
    const [smin, smax] = config.salaryBands[role];
    const variance = config.resumeVariance[role];
    for (let i = 0; i < 2; i++) {           // two candidates per role (PLAN.md §1)
      const claimed = rng.range(cmin, cmax);
      const trueUnd = clamp(claimed + config.resumeBias + rng.range(-variance, variance), 0, 100);
      const salary = rng.range(smin, smax);
      const trait = TRAITS[rng.range(0, TRAITS.length - 1)];
      const name = NAMES[role][i % NAMES[role].length];
      full[role].push({ role, name, trait, salary, resumeUnd: claimed, trueUnd });
      view[role].push({ role, name, trait, salary, resumeUnd: claimed });
    }
  }
  return {
    view: { classes: classesView, models, candidates: view },
    full: { candidates: full }
  };
}

function buildHires(full, selection) {
  const hires = {};
  for (const role of ROLES) {
    const idx = selection && selection.hires ? selection.hires[role] : null;
    if (idx == null || !full.candidates[role][idx]) { hires[role] = null; continue; }
    const c = full.candidates[role][idx];
    hires[role] = { name: c.name, trait: c.trait, salary: c.salary, und: c.trueUnd, morale: 60 };
  }
  return hires;
}

// ---------------------------------------------------------------------------
// One run: outfit through the policy, then answer decisions until an ending.
// ---------------------------------------------------------------------------
function runOne(policy, seed) {
  const offer = makeOffer(seed);
  const policyRng = createRng((seed ^ 0x2545f491) >>> 0);   // policy's own stream

  const sel = policy.outfit(offer.view, policyRng) || {};
  const classId = sel.classId || offer.view.classes[0].id;
  const model = sel.model || 'standard';
  const hires = buildHires(offer.full, sel);

  let s = initState(classId, hires, model, seed);

  let guard = 0;
  while (!s.ending && s.phase !== 'gameover' && guard++ < 20000) {
    const decisions = pendingDecisions(s);
    if (!decisions.length) break;
    const d = decisions[0];
    const v = visibleState(s);
    const wanted = policy.choose(v, d, policyRng);
    // Only ever apply an ENABLED option; fall back to the first enabled one.
    const ok = d.options.find((o) => o.id === wanted && !o.disabled);
    const chosen = ok ? ok.id : (d.options.find((o) => !o.disabled) || d.options[0]).id;
    const rng = rngFromState(s.seed, s.rngState);
    s = applyDecision(s, d.id, chosen, rng);
  }

  return record(policy.name, s, seed);
}

function record(policyName, s, seed) {
  const ending = s.ending || 'incomplete';
  const isDeath = !SURVIVED.has(ending);
  const teamUnd = {};
  for (const role of ROLES) teamUnd[role] = s.team[role] ? round(s.team[role].und) : null;
  return {
    policy: policyName,
    seed,
    ending,
    isDeath,
    monthOfDeath: isDeath ? s.month : null,
    finalMonth: s.month,
    money: s.money,
    energy: s.energy,
    client: s.client,
    cd: s.cd,
    calibration: round(calibration(s.skills)),
    und: {
      coding: round(s.skills.coding.und),
      debugging: round(s.skills.debugging.und),
      judgment: round(s.skills.judgment.und)
    },
    conf: {
      coding: round(s.skills.coding.conf),
      debugging: round(s.skills.debugging.conf),
      judgment: round(s.skills.judgment.conf)
    },
    teamUnd,
    moneyCurve: [...s.history.map((h) => h.money), s.money],
    renewal: s.renewalResult || null
  };
}

// ---------------------------------------------------------------------------
// Batch + aggregation
// ---------------------------------------------------------------------------
function runBatch(policy, baseSeed, runs) {
  const records = [];
  for (let i = 0; i < runs; i++) records.push(runOne(policy, baseSeed + i));
  return records;
}

function aggregate(records) {
  const n = records.length;
  const endings = {};
  const deaths = {};
  const monthHist = {};                 // month -> death count
  for (let m = 1; m <= config.months; m++) monthHist[m] = 0;

  let wins = 0, survived = 0, moneySum = 0;
  for (const r of records) {
    endings[r.ending] = (endings[r.ending] || 0) + 1;
    if (WINS.has(r.ending)) wins++;
    if (SURVIVED.has(r.ending)) survived++;
    if (r.isDeath) {
      deaths[r.ending] = (deaths[r.ending] || 0) + 1;
      if (monthHist[r.monthOfDeath] != null) monthHist[r.monthOfDeath]++;
    }
    moneySum += r.money;
  }
  return { n, endings, deaths, monthHist, wins, survived, avgMoney: Math.round(moneySum / n) };
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------
const pct = (x, n) => `${((100 * x) / n).toFixed(1)}%`;

function distLine(dist, n) {
  const keys = Object.keys(dist).sort((a, b) => dist[b] - dist[a]);
  if (!keys.length) return '    (none)';
  return keys.map((k) => `    ${k.padEnd(16)} ${String(dist[k]).padStart(5)}  ${pct(dist[k], n)}`).join('\n');
}

function bar(count, max, width = 30) {
  if (max <= 0) return '';
  return '█'.repeat(Math.round((count / max) * width));
}

function reportPolicy(name, records) {
  const a = aggregate(records);
  const out = [];
  out.push('');
  out.push(`==== ${name}  (${a.n} runs) ====`);
  out.push(`  win (qualified): ${a.wins}  ${pct(a.wins, a.n)}    reached M12 verdict: ${a.survived}  ${pct(a.survived, a.n)}    avg final $: ${a.avgMoney}`);
  out.push('  ending distribution:');
  out.push(distLine(a.endings, a.n));
  out.push('  death distribution:');
  const deathTotal = Object.values(a.deaths).reduce((x, y) => x + y, 0);
  out.push(deathTotal ? distLine(a.deaths, a.n) : '    (no deaths)');
  if (deathTotal) {
    // "no single death cause > 50% of losses" — the WP4 fairness check; surface it here.
    const worst = Object.entries(a.deaths).sort((x, y) => y[1] - x[1])[0];
    out.push(`    top cause: ${worst[0]} = ${pct(worst[1], deathTotal)} of losses`);
  }
  out.push('  month-of-death histogram:');
  const maxM = Math.max(1, ...Object.values(a.monthHist));
  for (let m = 1; m <= config.months; m++) {
    const c = a.monthHist[m];
    out.push(`    M${String(m).padStart(2)} ${String(c).padStart(5)} ${bar(c, maxM)}`);
  }
  return { text: out.join('\n'), agg: a };
}

const CSV_COLS = [
  'policy', 'seed', 'ending', 'isDeath', 'monthOfDeath', 'finalMonth',
  'money', 'energy', 'client', 'cd', 'calibration',
  'coding_und', 'debugging_und', 'judgment_und',
  'coding_conf', 'debugging_conf', 'judgment_conf'
];
function csvRow(r) {
  return [
    r.policy, r.seed, r.ending, r.isDeath ? 1 : 0, r.monthOfDeath ?? '', r.finalMonth,
    r.money, r.energy, round(r.client), r.cd, r.calibration,
    r.und.coding, r.und.debugging, r.und.judgment,
    r.conf.coding, r.conf.debugging, r.conf.judgment
  ].join(',');
}

// ---------------------------------------------------------------------------
// Config-path helpers (for --sweep; config is nested)
// ---------------------------------------------------------------------------
function getPath(obj, path) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
}
function setPath(obj, path, val) {
  const ks = path.split('.');
  const last = ks.pop();
  const t = ks.reduce((o, k) => o[k], obj);
  t[last] = val;
}
function coerce(v) {
  const n = Number(v);
  return v.trim() !== '' && !Number.isNaN(n) ? n : v;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const args = { policy: null, runs: 1000, seed: 1, csv: false, sweep: null, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') args.help = true;
    else if (a === '--csv') args.csv = true;
    else if (a.startsWith('--policy=')) args.policy = a.slice('--policy='.length);
    else if (a.startsWith('--runs=')) args.runs = parseInt(a.slice('--runs='.length), 10);
    else if (a.startsWith('--seed=')) args.seed = parseInt(a.slice('--seed='.length), 10);
    else if (a.startsWith('--sweep=')) args.sweep = a.slice('--sweep='.length);
    else if (a === '--sweep') args.sweep = argv[++i];   // space form: --sweep path=v1,v2
  }
  return args;
}

function resolvePolicies(spec) {
  if (!spec || spec === 'all') return POLICY_ORDER.slice();
  return spec.split(',').map((s) => s.trim()).filter(Boolean);
}

const HELP = `The Token Trail — headless balance harness (WP3)

  node src/sim/runner.js --policy=NAME [--runs=N] [--seed=S] [--csv] [--sweep PATH=v1,v2,v3]

  --policy=NAME   ${POLICY_ORDER.join(' | ')} | all | comma-list   (required)
  --runs=N        runs per policy (default 1000); seeds S..S+N-1
  --seed=S        base seed (default 1)
  --csv           one CSV row per run to stdout (no report)
  --sweep PATH=v1,v2,v3   sweep a dotted config knob across values (WP4)

Examples:
  node src/sim/runner.js --policy=all --runs=1000 --seed=1
  node src/sim/runner.js --policy=qualified --runs=1000 --csv > runs.csv
  node src/sim/runner.js --policy=qualified --runs=500 --sweep renewal.baseDc=50,55,60
`;

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.policy) {
    process.stdout.write(HELP);
    if (!args.policy && !args.help) process.exitCode = 1;
    return;
  }
  const names = resolvePolicies(args.policy);
  for (const nm of names) {
    if (!POLICIES[nm]) {
      process.stderr.write(`unknown policy: ${nm}\n`);
      process.exitCode = 1;
      return;
    }
  }

  // --- Sweep mode: vary one config knob, report per value -------------------
  if (args.sweep) {
    const eq = args.sweep.indexOf('=');
    if (eq < 0) { process.stderr.write('bad --sweep (expected PATH=v1,v2,v3)\n'); process.exitCode = 1; return; }
    const path = args.sweep.slice(0, eq);
    const values = args.sweep.slice(eq + 1).split(',').map((v) => coerce(v));
    const original = getPath(config, path);
    if (original === undefined) { process.stderr.write(`unknown config path: ${path}\n`); process.exitCode = 1; return; }

    process.stdout.write(`\n# SWEEP ${path}: ${values.join(', ')}  (${args.runs} runs each, base seed ${args.seed})\n`);
    for (const val of values) {
      setPath(config, path, val);
      process.stdout.write(`\n### ${path} = ${val}\n`);
      for (const nm of names) {
        const recs = runBatch(POLICIES[nm], args.seed, args.runs);
        const a = aggregate(recs);
        const topDeath = Object.entries(a.deaths).sort((x, y) => y[1] - x[1])[0];
        process.stdout.write(
          `  ${nm.padEnd(10)} win ${pct(a.wins, a.n).padStart(6)}  M12 ${pct(a.survived, a.n).padStart(6)}` +
          `  avg$ ${String(a.avgMoney).padStart(7)}  topDeath ${topDeath ? `${topDeath[0]} ${pct(topDeath[1], a.n)}` : '-'}\n`
        );
      }
    }
    setPath(config, path, original);   // restore
    return;
  }

  // --- CSV mode: per-run rows ----------------------------------------------
  if (args.csv) {
    process.stdout.write(CSV_COLS.join(',') + '\n');
    for (const nm of names) {
      for (let i = 0; i < args.runs; i++) {
        process.stdout.write(csvRow(runOne(POLICIES[nm], args.seed + i)) + '\n');
      }
    }
    return;
  }

  // --- Report mode ----------------------------------------------------------
  process.stdout.write(`# The Token Trail — balance harness\n# ${args.runs} runs/policy, base seed ${args.seed}\n`);
  for (const nm of names) {
    const recs = runBatch(POLICIES[nm], args.seed, args.runs);
    process.stdout.write(reportPolicy(nm, recs).text + '\n');
  }
}

main();

export { runOne, runBatch, aggregate, makeOffer };
