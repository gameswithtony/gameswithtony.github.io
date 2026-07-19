// drift.test.js — the browser/headless no-drift contract (PLAN.md §6 WP5).
//
// The UI mutates game state ONLY through initState + applyDecision, recording
// every {decisionId, optionId} into an append-only decision log (exactly what
// the save stores). This test proves the load-bearing guarantees:
//
//   A. A recorded run's decision log replays headless to an IDENTICAL final
//      state — the "browser and headless never diverge" promise.
//   B. Resume fidelity: JSON round-tripping the state mid-run (closing the tab
//      and reopening) and continuing reaches the exact same final state.
//   C. A committed fixture log (test/fixtures/drift-run.json) replays
//      deterministically, with and without a mid-run round-trip.
//
// The decision-driver below mirrors the UI's own loop: read pendingDecisions,
// apply one, repeat — so the recorded log is a real playthrough, not a
// hand-authored script. Tests A/B regenerate against live content, so they stay
// valid as WP2's decks/tasks land; test C guards the serialized reconstruction
// path against a stable artifact.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { initState } from '../src/state.js';
import { applyDecision, pendingDecisions } from '../src/sim/engine.js';
import { rngFromState } from '../src/sim/rng.js';

const HERE = dirname(fileURLToPath(import.meta.url));

// A content-independent setup: explicit hires (with true `und`) so the fixture
// and Test A stay stable regardless of data/candidates.js.
const SETUP = {
  classId: 'vibe',
  hires: {
    junior: { name: 'Devon', trait: 'quick study', salary: 200, und: 35 },
    qa: { name: 'Renata', trait: 'steady under pages', salary: 250, und: 45 },
    senior: null
  },
  model: 'standard',
  seed: 12345
};

// The UI's choice policy, distilled: prefer raw AI for routes (creates defects to
// hunt and leaves review capacity as ammo), skip the AI hunt, spend focus on the
// manual hunt, take the first event option. Deterministic.
function optById(d, id) {
  const o = d.options.find((x) => x.id === id && !x.disabled);
  return o ? o.id : null;
}
function chooseOption(d) {
  const enabled = d.options.filter((o) => !o.disabled);
  if (d.id === 'ai-hunt') return optById(d, 'skip') || enabled[0].id;
  if (d.kind === 'focus') return optById(d, 'hunt') || optById(d, 'rest') || enabled[0].id;
  if (d.kind === 'route') return optById(d, 'ai') || optById(d, 'ai-review') || enabled[0].id;
  if (d.kind === 'event') return d.options[0].id;
  return enabled[0].id;
}

// Drive a full run the way the UI does, recording the decision log.
function driveRun(setup) {
  let s = initState(setup.classId, setup.hires, setup.model, setup.seed);
  const rng = rngFromState(s.seed, s.rngState);
  const log = [];
  let guard = 0;
  while (!s.ending && guard++ < 100000) {
    const ds = pendingDecisions(s);
    if (!ds.length) break;
    const d = ds[0];
    const optionId = chooseOption(d);
    log.push({ decisionId: d.id, optionId });
    s = applyDecision(s, d.id, optionId, rng);
  }
  return { final: s, log };
}

// Replay a recorded log through the pure engine (the UI's reconstruction path).
function replay(setup, log) {
  let s = initState(setup.classId, setup.hires, setup.model, setup.seed);
  const rng = rngFromState(s.seed, s.rngState);
  for (const { decisionId, optionId } of log) {
    s = applyDecision(s, decisionId, optionId, rng);
  }
  return s;
}

// Replay with a save/reload (JSON round-trip + rng cursor restore) before step `at`.
function replayWithResume(setup, log, at) {
  let s = initState(setup.classId, setup.hires, setup.model, setup.seed);
  let rng = rngFromState(s.seed, s.rngState);
  for (let i = 0; i < log.length; i++) {
    if (i === at) {
      s = JSON.parse(JSON.stringify(s));          // close the tab...
      rng = rngFromState(s.seed, s.rngState);      // ...reopen, restore the cursor
    }
    s = applyDecision(s, log[i].decisionId, log[i].optionId, rng);
  }
  return s;
}

test('A. a recorded run replays headless to an identical final state', () => {
  const { final, log } = driveRun(SETUP);
  assert.ok(final.ending, 'the recorded run reaches an ending');
  assert.ok(log.length > 10, 'a full run records a non-trivial decision log');
  const replayed = replay(SETUP, log);
  assert.deepEqual(replayed, final, 'headless replay diverged from the recorded run');
});

test('B. resume fidelity: a mid-run save/reload reaches the same final state', () => {
  const { final, log } = driveRun(SETUP);
  const at = Math.floor(log.length / 2);
  const resumed = replayWithResume(SETUP, log, at);
  assert.deepEqual(resumed, final, 'resuming from a mid-run save diverged');
});

test('B2. the recorded run is deterministic across independent replays', () => {
  const { log } = driveRun(SETUP);
  assert.deepEqual(replay(SETUP, log), replay(SETUP, log));
});

test('C. the committed fixture replays deterministically (with and without resume)', () => {
  const fixture = JSON.parse(readFileSync(join(HERE, 'fixtures', 'drift-run.json'), 'utf8'));
  const setup = fixture.setup;
  const log = fixture.decisionLog;
  const full = replay(setup, log);
  const at = Math.floor(log.length / 2);
  const resumed = replayWithResume(setup, log, at);
  assert.deepEqual(resumed, full, 'committed-fixture resume diverged from straight replay');
  // sanity: a second straight replay is identical (pure determinism)
  assert.deepEqual(replay(setup, log), full);
});
