// schema.test.js — the safety net for the thing Tony actually edits (PLAN.md §5).
// Walks all three decks and enforces the authoring contract so a bad edit fails
// `node --test`, not a live run. This test is the contract that keeps event
// editing safe. It asserts, verbatim from §5:
//   • every predicate callable against a sample state without throwing
//   • every effect key legal (validated through applyEffects itself)
//   • every check skill/target real
//   • every weight positive
//   • all ids unique
//   • majors deck covers months 3/6/9 under any predicate outcome (no empty draw)
//   • every choice's effects/check touches at least one of the five axes
//   • every effect inside the §5 magnitude caps (2× for majors)
//   • removeMember/endRun only behind checks or earned-state predicates
// PLUS the WP2 done-when: every deck entry is reachable (some fixture satisfies
// its predicate).
//
// Run from /token:  node --test   (NOT `node --test test/` on Node 24)

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { config } from '../config.js';
import { createRng } from '../src/sim/rng.js';
import { initState } from '../src/state.js';
import { applyEffects } from '../src/sim/effects.js';
import { events } from '../src/data/events.js';
import { majors } from '../src/data/majors.js';
import { incidents } from '../src/data/incidents.js';

const LEGAL_SKILLS = ['coding', 'debugging', 'judgment'];
const LEGAL_TARGETS = ['you', 'team', 'junior', 'qa', 'senior'];
// Effect keys that put one of the five axes at stake (PLAN §1 mapping):
//   money 💰 · energy/member.morale ⚡ · skill/cd/conf 🧠 · defects/client 🤝 ·
//   removeMember ⚡🚚 (member touches ⚡ via morale / 🧠 via comp→und).
// endRun ends the run outright — the mortal failure mode itself — so it stakes an
// axis by construction (documented WP2 call; §1 maps removeMember, endRun is its
// terminal cousin).
const AXIS_KEYS = ['money', 'energy', 'cd', 'skill', 'conf', 'defects', 'client', 'removeMember', 'member', 'endRun'];

const CAPS = config.eventEffectCaps;
const MAJOR_MULT = CAPS.majorMultiplier;

// ---------------------------------------------------------------------------
// Fixtures — targeted states for reachability + predicate-safety.
// ---------------------------------------------------------------------------

// A healthy, fully-staffed month-1 state. Earned-state predicates must be FALSE
// here (nothing bad has happened yet) — that is the operational test for "earned."
function pristineHealthy() {
  const hire = (name, und) => ({ name, trait: 'quick study', salary: 200, und, morale: 70 });
  const s = initState('vibe', {
    junior: hire('Jun', 45), qa: hire('Quinn', 55), senior: hire('Sen', 75)
  }, 'standard', 1);
  s.money = 8000; s.energy = 100; s.client = 80; s.cd = 0;
  s.defects = []; s.backlog = []; s.openSeverity = 0; s.slipped = 0;
  return s;
}

function withNoMembers(mut) {
  const s = initState('vibe', {}, 'standard', 2);
  if (mut) mut(s);
  return s;
}

const fixtures = (() => {
  const s0 = pristineHealthy();                                   // all ()=>true, member-present events
  const s1 = initState('vibe', { senior: { name: 'Sen', trait: 'steady under pages', salary: 400, und: 60, morale: 30 } }, 'standard', 3); // recruiter (low morale)
  const s3 = withNoMembers((s) => {                               // defect pool present
    s.defects = [1, 2, 3].map(() => ({ severity: 1, provenance: 'ai-raw', monthShipped: 1 }));
    s.openSeverity = 2;
  });
  const s4 = withNoMembers((s) => { s.cd = 6; });                 // high Cognitive Debt
  const s5 = initState('vibe', { junior: { name: 'Jun', trait: 'quick study', salary: 200, und: 40, morale: 10 } }, 'standard', 4); // sunk morale
  const s6 = withNoMembers((s) => { s.month = 12; });             // month 12 (renewal)
  return [s0, s1, s3, s4, s5, s6];
})();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DECKS = { events, majors, incidents };
const ALL = [...events, ...majors, ...incidents];

function effectBlocks(choice) {
  const b = [];
  if (choice.cost) b.push(choice.cost);
  if (choice.effects) b.push(choice.effects);
  if (choice.success && choice.success.effects) b.push(choice.success.effects);
  if (choice.fail && choice.fail.effects) b.push(choice.fail.effects);
  return b;
}

function assertCap(name, value, cap, mult, ctx) {
  assert.ok(Math.abs(value) <= cap * mult,
    `${ctx}: ${name} ${value} exceeds cap ±${cap * mult}`);
}

// Enforce §5 magnitude caps on one effect object. Uncapped keys (tokensCostMult,
// flag, capacityDelta, removeMember, endRun, conf, member.comp/burnout) are skipped.
function checkCaps(block, mult, ctx) {
  for (const [key, v] of Object.entries(block)) {
    switch (key) {
      case 'money': assertCap('money', v, CAPS.money, mult, ctx); break;
      case 'energy': assertCap('energy', v, CAPS.energy, mult, ctx); break;
      case 'cd': assertCap('cd', v, CAPS.cd, mult, ctx); break;
      case 'client': assertCap('client', v, CAPS.client, mult, ctx); break;
      case 'skill':
        for (const [sk, d] of Object.entries(v)) assertCap(`skill.${sk}`, d, CAPS.skill, mult, ctx);
        break;
      case 'defects':
        if (typeof v === 'number') assertCap('defects', v, CAPS.defects, mult, ctx);
        else if (v && v.add) assertCap('defects.add.severity', v.add.severity ?? 1, CAPS.defects, mult, ctx);
        break;
      case 'member':
        for (const [role, sub] of Object.entries(v)) {
          if (sub && typeof sub.morale === 'number') assertCap(`member.${role}.morale`, sub.morale, CAPS.morale, mult, ctx);
        }
        break;
      default: break; // uncapped key
    }
  }
}

// ---------------------------------------------------------------------------
// Predicates: callable without throwing; every entry reachable
// ---------------------------------------------------------------------------

test('every predicate is callable against sample states without throwing', () => {
  for (const e of ALL) {
    if (e.when == null) continue;
    assert.equal(typeof e.when, 'function', `${e.id}: when must be a function`);
    for (const st of fixtures) {
      assert.doesNotThrow(() => e.when(st), `${e.id}: when threw on a sample state`);
    }
  }
});

test('every deck entry is reachable — some fixture satisfies its predicate', () => {
  for (const e of ALL) {
    const reachable = fixtures.some((st) => {
      try { return e.when ? !!e.when(st) : true; } catch { return false; }
    });
    assert.ok(reachable, `${e.id}: no fixture state satisfies its predicate`);
  }
});

// ---------------------------------------------------------------------------
// Weights, ids, text
// ---------------------------------------------------------------------------

test('every weight is a positive number', () => {
  for (const e of ALL) {
    assert.equal(typeof e.weight, 'number', `${e.id}: weight must be a number`);
    assert.ok(e.weight > 0, `${e.id}: weight must be positive`);
  }
});

test('ids are unique within each deck, and text is a function', () => {
  for (const [deckName, deck] of Object.entries(DECKS)) {
    const seen = new Set();
    for (const e of deck) {
      assert.ok(typeof e.id === 'string' && e.id.length, `${deckName}: entry missing id`);
      assert.ok(!seen.has(e.id), `${deckName}: duplicate id '${e.id}'`);
      seen.add(e.id);
      assert.equal(typeof e.text, 'function', `${e.id}: text must be a function`);
      assert.ok(Array.isArray(e.choices) && e.choices.length > 0, `${e.id}: needs choices`);
    }
  }
});

// ---------------------------------------------------------------------------
// Checks: skill + target real
// ---------------------------------------------------------------------------

test('every check names a real skill and a real target', () => {
  for (const e of ALL) {
    for (const c of e.choices) {
      if (!c.check) continue;
      assert.ok(LEGAL_SKILLS.includes(c.check.skill), `${e.id}/${c.id}: illegal check skill '${c.check.skill}'`);
      const tgt = c.check.target ?? 'you';
      assert.ok(LEGAL_TARGETS.includes(tgt), `${e.id}/${c.id}: illegal check target '${tgt}'`);
    }
  }
});

// ---------------------------------------------------------------------------
// Effect keys legal (via applyEffects) + magnitude caps + axis coverage
// ---------------------------------------------------------------------------

test('every effect object uses only legal keys (applyEffects does not throw)', () => {
  const base = pristineHealthy(); // members present so member effects fully validate
  const rng = createRng(1);
  for (const e of ALL) {
    for (const c of e.choices) {
      for (const block of effectBlocks(c)) {
        assert.doesNotThrow(() => applyEffects(base, block, rng),
          `${e.id}/${c.id}: illegal effect key in ${JSON.stringify(block)}`);
      }
    }
  }
});

test('every effect is inside the §5 magnitude caps (2× for majors)', () => {
  for (const [deckName, deck] of Object.entries(DECKS)) {
    const mult = deckName === 'majors' ? MAJOR_MULT : 1;
    for (const e of deck) {
      for (const c of e.choices) {
        for (const block of effectBlocks(c)) {
          checkCaps(block, mult, `${deckName}/${e.id}/${c.id}`);
        }
      }
    }
  }
});

test('every choice touches at least one of the five axes', () => {
  for (const e of ALL) {
    for (const c of e.choices) {
      const hasCheck = !!c.check; // a check stakes 🧠 (Understanding)
      const hasAxisKey = effectBlocks(c).some((b) => Object.keys(b).some((k) => AXIS_KEYS.includes(k)));
      assert.ok(hasCheck || hasAxisKey, `${e.id}/${c.id}: touches no axis`);
    }
  }
});

// ---------------------------------------------------------------------------
// The big guns: removeMember / endRun only behind checks or earned predicates
// ---------------------------------------------------------------------------

test('removeMember/endRun appear only behind a check or an earned predicate', () => {
  const healthy = pristineHealthy();
  for (const e of ALL) {
    for (const c of e.choices) {
      // unconditional positions = cost / effects (NOT success/fail branches)
      const uncond = [c.cost, c.effects].filter(Boolean);
      const hasUncondBigGun = uncond.some((b) => 'removeMember' in b || 'endRun' in b);
      if (!hasUncondBigGun) continue; // behind a check-branch (or absent) → always allowed
      // otherwise the event must be earned: a predicate that is FALSE on a
      // pristine, healthy, fully-staffed state.
      assert.equal(typeof e.when, 'function',
        `${e.id}/${c.id}: unconditional removeMember/endRun needs an earned predicate`);
      let val;
      assert.doesNotThrow(() => { val = e.when(healthy); }, `${e.id}: earned predicate threw`);
      assert.equal(val, false,
        `${e.id}/${c.id}: unconditional removeMember/endRun but predicate is satisfiable on a healthy state (not earned)`);
    }
  }
});

// ---------------------------------------------------------------------------
// Majors coverage: months 3/6/9 can never draw empty, under any predicate outcome
// ---------------------------------------------------------------------------

test('the Renewal Review is never eligible at the 3/6/9 quarter draws', () => {
  const renewal = majors.find((m) => m.slot === 'q4');
  assert.ok(renewal, 'majors must include the Renewal Review (slot q4)');
  for (const month of [3, 6, 9]) {
    const st = withNoMembers((s) => { s.month = month; });
    assert.equal(renewal.when(st), false, `renewal eligible at month ${month}`);
  }
});

test('majors cover months 3/6/9 with no empty draw possible under any predicate outcome', () => {
  const quarterMajors = majors.filter((m) => m.slot !== 'q4');
  const draws = config.majorMonths.filter((m) => m !== config.months).length; // 3 (months 3/6/9)

  // Worst case = the fewest majors eligible = only the unconditionally-eligible
  // ones (all steering predicates forced false). Build such a state.
  const worst = withNoMembers((s) => { s.cd = 0; s.openSeverity = 0; s.defects = []; s.month = 3; });
  const eligibleWorst = quarterMajors.filter((m) => {
    try { return m.when ? !!m.when(worst) : true; } catch { return false; }
  });
  assert.ok(eligibleWorst.length >= draws,
    `only ${eligibleWorst.length} majors eligible in the worst case; need ≥ ${draws} to fill 3/6/9 without repeats`);

  // Simulate the engine's without-repeats draw across the three quarters for both
  // an adversarial and a rich state; assert every quarter has ≥1 eligible major.
  for (const st of [worst, fixtures[3] /* high CD, steers The Outage in */]) {
    const drawn = new Set();
    for (let q = 0; q < draws; q++) {
      const avail = quarterMajors.filter((m) => !drawn.has(m.id) && (m.when ? m.when(st) : true));
      assert.ok(avail.length > 0, `empty major draw at quarter ${q + 1}`);
      drawn.add(avail[0].id);
    }
  }
});
