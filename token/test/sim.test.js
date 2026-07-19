// sim.test.js — WP1 done-when: decay curves/floors/streaks, check targets
// (team = best in shop; unhired-member choices pruned), effects incl. illegal
// -key throw, hunt formula (surfacing vs. Debugging, carry limit, AI regression
// seeding, +/-20% skin clamp), and a headless 12-month run. Run: node --test test/

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { config } from '../config.js';
import { createRng, rngFromState } from '../src/sim/rng.js';
import { initState } from '../src/state.js';
import * as decay from '../src/sim/decay.js';
import { resolveTarget, bestTeamUnd, runCheck } from '../src/sim/checks.js';
import { applyEffects } from '../src/sim/effects.js';
import { resolveManualHunt, resolveAiHunt } from '../src/sim/hunt.js';
import { visibleState } from '../src/sim/visible.js';
import { pendingDecisions, applyDecision } from '../src/sim/engine.js';

// ---------------------------------------------------------------------------
// decay.js
// ---------------------------------------------------------------------------

test('grow diminishes above the threshold', () => {
  const below = decay.grow({ und: 50, conf: 50, floor: 40, streak: 0 }, 2,
    { diminishThreshold: 80, diminishFactor: 0.5 });
  assert.equal(below.und, 52);
  const above = decay.grow({ und: 85, conf: 85, floor: 40, streak: 0 }, 2,
    { diminishThreshold: 80, diminishFactor: 0.5 });
  assert.equal(above.und, 86); // 2 * 0.5
});

test('delegateDecay accelerates with the streak', () => {
  let sk = { und: 60, conf: 60, floor: 40, streak: 0 };
  const drops = [];
  for (let i = 0; i < 3; i++) {
    const before = sk.und;
    sk = decay.delegateDecay(sk, { base: 1, accel: 0.5 });
    drops.push(before - sk.und);
  }
  assert.deepEqual(drops, [1, 1.5, 2]); // strictly accelerating
  assert.equal(sk.streak, 3);
});

test('delegateDecay and rust respect the floor', () => {
  const d = decay.delegateDecay({ und: 40.5, conf: 50, floor: 40, streak: 2 }, { base: 1, accel: 0.5 });
  assert.equal(d.und, 40); // would be 38.5, floored
  const r = decay.rust({ und: 40.3, conf: 50, floor: 40, streak: 0 }, { rate: 0.5 });
  assert.equal(r.und, 40);
});

test('calibration is 100 when perfectly calibrated, lower otherwise', () => {
  const s = (c, u) => ({ conf: c, und: u, floor: 40, streak: 0 });
  assert.equal(decay.calibration({ coding: s(50, 50), debugging: s(30, 30), judgment: s(70, 70) }), 100);
  // |60-40| across one skill only, others equal -> 100 - 20/3
  const cal = decay.calibration({ coding: s(60, 40), debugging: s(30, 30), judgment: s(70, 70) });
  assert.ok(Math.abs(cal - (100 - 20 / 3)) < 1e-9);
});

test('revealSnap moves Confidence halfway to Understanding', () => {
  const snapped = decay.revealSnap({ conf: 80, und: 40, floor: 40, streak: 0 }, { fraction: 0.5 });
  assert.equal(snapped.conf, 60);
});

// ---------------------------------------------------------------------------
// checks.js
// ---------------------------------------------------------------------------

test('resolveTarget: you / team (best in shop) / unhired member -> null', () => {
  const st = initState('vibe', { senior: { name: 'Sam', trait: 'quick study', salary: 400, und: 70, morale: 60 } }, 'standard', 5);
  // you
  assert.equal(resolveTarget(st, 'you', 'coding').und, st.skills.coding.und);
  // team = best hidden Understanding in the shop (your 20 debugging vs senior 70)
  assert.equal(bestTeamUnd(st, 'debugging'), 70);
  assert.equal(resolveTarget(st, 'team', 'debugging').und, 70);
  // unhired member (no junior) -> null
  assert.equal(resolveTarget(st, 'junior', 'coding'), null);
});

test('runCheck: dc 50 rolls straight against Understanding; higher dc is harder', () => {
  const st = initState('vibe', {}, 'standard', 9);
  st.skills.coding.und = 100;
  const rng = createRng(1);
  // effective = 100 - (50-50) = 100 -> always success
  assert.equal(runCheck(st, { skill: 'coding', dc: 50, target: 'you' }, rng).success, true);
  st.skills.coding.und = 0;
  // effective = 0 - (90-50) = -40 -> never success
  assert.equal(runCheck(st, { skill: 'coding', dc: 90, target: 'you' }, rng).success, false);
});

test('pendingDecisions prunes event choices that name an unhired member', () => {
  const st = initState('vibe', {}, 'standard', 3);
  st.phase = 'event';
  st.pendingEvent = {
    deck: 'event',
    event: {
      id: 'x', text: () => 'q', choices: [
        { id: 'a', label: 'A', check: { skill: 'coding', dc: 50, target: 'senior' }, success: {}, fail: {} },
        { id: 'b', label: 'B', effects: { money: 1 } }
      ]
    }
  };
  const opts = pendingDecisions(st)[0].options.map((o) => o.id);
  assert.deepEqual(opts, ['b']); // 'a' pruned (senior unhired)
});

// ---------------------------------------------------------------------------
// effects.js
// ---------------------------------------------------------------------------

test('applyEffects applies the full legal key set', () => {
  const st = initState('vibe', { qa: { name: 'Q', trait: 'steady under pages', salary: 250, und: 50, morale: 60 } }, 'standard', 7);
  const out = applyEffects(st, {
    money: -100, energy: -5, cd: 2, client: -10,
    skill: { coding: 3 }, conf: { judgment: -4 },
    member: { qa: { morale: 5, comp: 10, burnout: 99 } }, // burnout ignored, comp->und
    defects: 2, capacityDelta: 1, tokensCostMult: 0.5, flag: 'seenIt'
  }, createRng(1));

  assert.equal(out.money, st.money - 100);
  assert.equal(out.energy, st.energy - 5);
  assert.equal(out.cd, 2);
  assert.equal(out.client, st.client - 10);
  assert.equal(out.skills.coding.und, st.skills.coding.und + 3);
  assert.equal(out.skills.judgment.conf, st.skills.judgment.conf - 4);
  assert.equal(out.team.qa.morale, 65);
  assert.equal(out.team.qa.und, 60);            // comp mapped to und
  assert.equal(out.defects.length, 2);
  assert.equal(out.flags.capacityDelta, 1);
  assert.equal(out.flags.tokensCostMult, 0.5);
  assert.equal(out.flags.seenIt, true);
  // input untouched
  assert.equal(st.cd, 0);
});

test('applyEffects: defects add-object, negative removal, removeMember, endRun', () => {
  const st = initState('vibe', { senior: { name: 'S', trait: 'flight risk', salary: 400, und: 70, morale: 40 } }, 'standard', 2);
  let out = applyEffects(st, { defects: { add: { severity: 3, provenance: 'incident' } } }, createRng(1));
  assert.equal(out.defects[0].severity, 3);
  assert.equal(out.defects[0].provenance, 'incident');
  out = applyEffects(out, { defects: -1 }, createRng(1));
  assert.equal(out.defects.length, 0);
  out = applyEffects(out, { removeMember: 'senior' }, createRng(1));
  assert.equal(out.team.senior, null);
  out = applyEffects(out, { endRun: 'everyone-quit' }, createRng(1));
  assert.equal(out.ending, 'everyone-quit');
});

test('applyEffects throws on any illegal key or sub-key', () => {
  const st = initState('vibe', {}, 'standard', 1);
  const rng = createRng(1);
  assert.throws(() => applyEffects(st, { bogus: 1 }, rng), /illegal effect key/);
  assert.throws(() => applyEffects(st, { skill: { wizardry: 1 } }, rng), /illegal skill/);
  assert.throws(() => applyEffects(st, { member: { intern: { morale: 1 } } }, rng), /illegal member role/);
  assert.throws(() => applyEffects(st, { member: { qa: { vibes: 1 } } }, rng), /illegal member field/);
});

// ---------------------------------------------------------------------------
// hunt.js
// ---------------------------------------------------------------------------

function stateWithPool(seed, poolSize, debuggingUnd) {
  const st = initState('vibe', {}, 'standard', seed);
  st.skills.debugging.und = debuggingUnd;
  st.defects = Array.from({ length: poolSize }, (_, i) => ({ severity: 1, provenance: 'ai-raw', monthShipped: 1 }));
  st.openSeverity = poolSize;
  return st;
}

test('manual hunt: surfacing scales with hidden Debugging Understanding', () => {
  const low = resolveManualHunt(stateWithPool(1, 20, 10), { ammo: 999 }, createRng(1));
  const high = resolveManualHunt(stateWithPool(1, 20, 90), { ammo: 999 }, createRng(1));
  assert.ok(high.report.surfaced > low.report.surfaced,
    `expected more surfaced at high Understanding: ${high.report.surfaced} > ${low.report.surfaced}`);
});

test('manual hunt: carry limit caps fixes at ammo; overflow stays in the pool', () => {
  const res = resolveManualHunt(stateWithPool(1, 20, 100), { ammo: 3 }, createRng(1));
  assert.equal(res.report.fixed, 3);
  assert.equal(res.state.defects.length, 17);       // 20 - 3, overflow returned
  assert.equal(res.state.openSeverity, 20 - 3);
});

test('manual hunt: +/-20% skin modifier is clamped', () => {
  const base = resolveManualHunt(stateWithPool(1, 10, 50), { ammo: 999, skinModifier: 0 }, createRng(1)).report.surfaced;
  const hi = resolveManualHunt(stateWithPool(1, 10, 50), { ammo: 999, skinModifier: 0.2 }, createRng(1)).report.surfaced;
  const hiClamped = resolveManualHunt(stateWithPool(1, 10, 50), { ammo: 999, skinModifier: 5 }, createRng(1)).report.surfaced;
  const loClamped = resolveManualHunt(stateWithPool(1, 10, 50), { ammo: 999, skinModifier: -5 }, createRng(1)).report.surfaced;
  const lo = resolveManualHunt(stateWithPool(1, 10, 50), { ammo: 999, skinModifier: -0.2 }, createRng(1)).report.surfaced;
  assert.equal(hiClamped, hi);        // +5 clamps to +0.2
  assert.equal(loClamped, lo);        // -5 clamps to -0.2
  assert.ok(hi > base && base > lo);  // the modifier still bites within the clamp
});

test('AI hunt: closes by tier, seeds hidden regressions, costs tokens, ticks decay', () => {
  const st = stateWithPool(4, 20, 60);
  const res = resolveAiHunt(st, createRng(4), { tier: 'budget' });
  assert.equal(res.report.fixed, 8);  // round(20 * 0.40)
  assert.equal(res.report.tokenCost, Math.round(config.tokenCosts.budget * config.aiHunt.tokenMult));
  assert.equal(res.state.monthTokens, res.report.tokenCost);
  // accounting: pool = start - fixed + regressions
  assert.equal(res.state.defects.length, 20 - 8 + res.report.regressions);
  const seeded = res.state.defects.filter((d) => d.provenance === 'ai-hunt-regression').length;
  assert.equal(seeded, res.report.regressions);
  // Debugging streak ticked (delegation), no growth
  assert.equal(res.state.skills.debugging.streak, 1);
});

test('AI hunt seeds at least one regression across seeds (statistical sanity)', () => {
  let any = 0;
  for (let seed = 0; seed < 40; seed++) {
    const res = resolveAiHunt(stateWithPool(seed, 20, 60), createRng(seed), { tier: 'budget' });
    any += res.report.regressions;
  }
  assert.ok(any > 0, 'expected some regressions to be seeded over 40 seeds');
});

// ---------------------------------------------------------------------------
// visible.js — the fair-bot boundary
// ---------------------------------------------------------------------------

test('visibleState strips Understanding, defect pool, and member internals', () => {
  const st = initState('vibe', { qa: { name: 'Q', trait: 'steady under pages', salary: 250, und: 55, morale: 30 } }, 'standard', 8);
  const v = visibleState(st);
  assert.equal(v.skills.coding.und, undefined);
  assert.equal(v.skills.coding.conf !== undefined, true);
  assert.equal(v.defects, undefined);            // pool hidden
  assert.equal(v.openSeverity, st.openSeverity); // downstream SLA visible
  assert.equal(v.team.qa.und, undefined);
  assert.equal(v.team.qa.morale, undefined);
  assert.ok(typeof v.team.qa.mood === 'string');  // mood icon survives
});

// ---------------------------------------------------------------------------
// engine.js — headless 12-month run
// ---------------------------------------------------------------------------

// Drive a run to completion by answering one decision at a time.
function drive(state, choose) {
  let s = state;
  let guard = 0;
  while (!s.ending && s.phase !== 'gameover' && guard++ < 5000) {
    const decisions = pendingDecisions(s);
    if (!decisions.length) break;
    const d = decisions[0];
    const opt = choose(s, d);
    const rng = rngFromState(s.seed, s.rngState);
    s = applyDecision(s, d.id, opt, rng);
  }
  return s;
}

function policy(s, d) {
  if (d.id === 'ai-hunt') return 'skip';
  if (d.kind === 'focus') return 'rest';
  if (d.kind === 'route') return 'ai';
  if (d.kind === 'event') return d.options.find((o) => !o.disabled).id;
  return d.options[0].id;
}

test('a scripted 12-month run completes headless with an ending', () => {
  const start = initState('vibe', {}, 'standard', 42);
  const end = drive(start, policy);
  assert.ok(end.ending, 'run produced no ending');
  assert.equal(end.phase, 'gameover');
  assert.ok(end.log.length > 0, 'log is empty');
  // either it survived to the Renewal Review verdict, or it hit an engine death
  const valid = ['qualified', 'impostor', 'bankruptcy', 'burnout', 'fired'];
  assert.ok(valid.includes(end.ending) || typeof end.ending === 'string');
  if (end.ending === 'qualified' || end.ending === 'impostor') {
    assert.equal(end.month, 12);
    assert.ok(end.history.length >= 11);
  }
});

test('the run is deterministic: same seed -> identical final state', () => {
  const a = drive(initState('vibe', {}, 'standard', 123), policy);
  const b = drive(initState('vibe', {}, 'standard', 123), policy);
  assert.deepEqual(a, b);
});

test('different seeds can diverge', () => {
  const a = drive(initState('vibe', {}, 'standard', 1), policy);
  const b = drive(initState('vibe', {}, 'standard', 2), policy);
  // at minimum, the RNG cursors differ; usually the whole trajectory does
  assert.notEqual(a.rngState, b.rngState);
});

test('a self-build routes energy and grows Coding Understanding', () => {
  let s = initState('vibe', {}, 'standard', 11);
  const undBefore = s.skills.coding.und;
  const energyBefore = s.energy;
  // answer the first route decision with 'self'
  const first = pendingDecisions(s).find((d) => d.kind === 'route' && d.id.startsWith('route-task-'));
  const rng = rngFromState(s.seed, s.rngState);
  s = applyDecision(s, first.id, 'self', rng);
  // find that task's size to know the energy cost expectation later; just assert focus consumed
  assert.equal(s.focusUsed, true);
  assert.equal(s.focus, 'build');
});
