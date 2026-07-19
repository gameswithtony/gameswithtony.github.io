// majors.js — the quarter-end set pieces. Drawn WITHOUT repeats at months 3, 6,
// and 9, replacing that month's regular draw; predicates steer which crossing you
// face. Month 12 is the fixed Renewal Review — the engine runs it directly
// (resolveRenewal), so the Renewal entry here is descriptive framing and is
// guarded to never be drawn at 3/6/9.
//
// ── HOW TO ADD A MAJOR ───────────────────────────────────────────────────────
// Same schema as events.js (see that file's HOW TO block for the full contract),
// PLUS a `slot` hint ('q1'|'q2'|'q3'|'any' for the three quarter draws; 'q4' for
// the Renewal entry, which the engine handles specially). Majors follow the
// river-crossing shape — four options:
//   • by hand   (ford it: energy/skill, the honest way)
//   • AI full-auto (caulk the wagon and float: cheap now, debt/defects later)
//   • pay a contractor ($1,000 — the ferry; matches config.contractorCost)
//   • wait      (lose client goodwill rather than money)
//
// COVERAGE RULE (schema-enforced): at least three quarter majors (slot ≠ 'q4')
// must be unconditionally eligible, so months 3/6/9 can never draw empty even
// after two are consumed without repeats. Keep it that way when editing.
//
// MAGNITUDE CAPS are 2× the regular deck (these are the set pieces):
//   money ±1600 · energy ±40 · any one skill ±10 · cd ±4 · defects ±6 ·
//   client ±30 · member morale ±40.
//
// removeMember/endRun: still only behind a check-fail branch, or an earned
// predicate. The Outage's "by hand" failure is the deck-authored death.
// ─────────────────────────────────────────────────────────────────────────────

export const majors = [
  {
    id: 'the-big-migration',
    slot: 'q1',
    weight: 3,
    when: () => true,
    text: () => 'The Big Migration: the platform you built on is sunsetting. Everything must move to the new one, which is like the old one but angrier.',
    choices: [
      { id: 'hand', label: 'Port it by hand, module by module', effects: { energy: -30, skill: { coding: 4 } } },
      { id: 'ai', label: 'Let the AI rewrite it wholesale', effects: { cd: 4, defects: 4 } },
      { id: 'pay', label: 'Hire a migration contractor ($1,000)', effects: { money: -1000 } },
      { id: 'wait', label: 'Stay on the old platform for now', effects: { client: -20 } }
    ]
  },

  {
    id: 'the-security-audit',
    slot: 'q2',
    weight: 3,
    when: () => true,
    text: () => 'The Security Audit: an outside firm arrives with a checklist and a worrying amount of enthusiasm. They have questions about the auth system.',
    choices: [
      { id: 'hand', label: 'Remediate findings yourself', effects: { energy: -25, skill: { judgment: 4 }, defects: -3 } },
      { id: 'ai', label: 'Auto-remediate with the AI', effects: { cd: 3, defects: 3 } },
      { id: 'pay', label: 'Bring in a security contractor ($1,000)', effects: { money: -1000, defects: -4 } },
      { id: 'wait', label: 'Request an extension', effects: { client: -12, defects: 2 } }
    ]
  },

  {
    id: 'the-client-pivot',
    slot: 'any',
    weight: 3,
    when: () => true,
    text: () => 'The Client Pivot: leadership read an article on a plane. The product is now, effective immediately, an entirely different product.',
    choices: [
      { id: 'hand', label: 'Rebuild the core yourself', effects: { energy: -30, skill: { coding: 4 }, client: 10 } },
      { id: 'ai', label: 'Have the AI generate the pivot', effects: { cd: 4, defects: 4, client: 10 } },
      { id: 'pay', label: 'Contract out the rebuild ($1,000)', effects: { money: -1000, client: 8 } },
      { id: 'wait', label: 'Ask them to reconsider', effects: { client: -25 } }
    ]
  },

  {
    id: 'the-outage',
    slot: 'q3',
    weight: 4,
    when: (s) => s.cd >= 5 || s.openSeverity >= 3 || s.defects.length >= 4,
    text: () => 'The Outage: everything is down, at once, on a Friday. The dashboards are red in colors you did not know they had. Someone is already on the phone.',
    choices: [
      {
        id: 'hand',
        label: 'Go in and solve it yourself',
        check: { skill: 'debugging', dc: 65, target: 'you' },
        success: { effects: { client: 15, cd: -3, skill: { debugging: 4 } } },
        fail: { effects: { endRun: 'outage-unsolved' } }
      },
      { id: 'ai', label: 'Throw the AI at the incident', effects: { cd: 4, defects: 4, client: 8 } },
      { id: 'pay', label: 'Page an emergency contractor ($1,000)', effects: { money: -1000, client: 10 } },
      { id: 'wait', label: 'Wait and hope it self-heals', effects: { client: -25, defects: 3 } }
    ]
  },

  // The Renewal Review — month 12, fixed. The engine (resolveRenewal) runs the
  // three real checks; this entry exists for the deck's completeness and for the
  // UI's framing text. Guarded to `s.month >= 12` so it is NEVER eligible at the
  // 3/6/9 quarter draws (maybeEvent returns before drawing at month 12).
  {
    id: 'the-renewal-review',
    slot: 'q4',
    weight: 1,
    when: (s) => s.month >= 12,
    text: () => 'The Renewal Review: the client sits across the table and asks you to explain your own system. There is no ferry across this one.',
    choices: [
      {
        id: 'explain',
        label: 'Explain the architecture yourself',
        check: { skill: 'judgment', dc: 55, target: 'you' },
        success: { effects: { client: 20 } },
        fail: { effects: { client: -10 } }
      },
      {
        id: 'team',
        label: 'Let whoever knows it best answer',
        check: { skill: 'judgment', dc: 55, target: 'team' },
        success: { effects: { client: 15 } },
        fail: { effects: { client: -10 } }
      }
    ]
  }
];

export default majors;
