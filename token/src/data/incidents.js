// incidents.js — the 2 a.m. flare-ups. Each month the live defect pool rolls for
// a flare: chance = min(0.08 × pool, 0.70). When one fires, the engine picks an
// eligible incident, reads its `base` severity, runs a team responder check, and
// adds severity to the open SLA pool (economy doc §Incident damage):
//
//   Severity = base × (1 + cdCoef·CD) × (0.25 if responder passes, else 1)
//            + floor(defectPool / 3)
//
// Severity points cost revenue and client goodwill every month until a bug hunt
// clears them. The nastiest templates are gated behind accumulated Cognitive Debt
// and a fat defect pool — disasters are earned, never explained.
//
// ── HOW TO ADD AN INCIDENT ───────────────────────────────────────────────────
// Same schema as events.js, plus a numeric `base` (the severity Base term the
// engine reads). Responder `check` choices default to target: 'team' — the 2 a.m.
// page goes to whoever in the shop can actually answer (best hidden Understanding,
// you included; if the AI did all the work, the team's best is nobody).
// Magnitude caps are the REGULAR deck's (money ±800 · energy ±20 · skill ±5 ·
// cd ±2 · defects ±3 · client ±15 · morale ±20). No unconditional removeMember/
// endRun — only behind a check-fail branch or an earned predicate.
//
// MOREFUN D6: a flare is a set piece. It takes the month's event slot, plays on
// its own 2 a.m.-page screen, and the severity lands when the player's chosen
// response resolves — a choice with a `check` is the responder roll (pass =
// responderPassMult); a choice without one means nobody qualified answered the
// page, and severity lands in full alongside the choice's own effects.
// ─────────────────────────────────────────────────────────────────────────────

export const incidents = [
  {
    id: 'the-2am-page',
    base: 3,
    weight: 4,
    when: () => true,
    text: () => 'The 2 A.M. Page: a health check is flapping, users are noticing, and the runbook is a link to a deleted wiki page.',
    choices: [
      {
        id: 'oncall',
        label: 'Take the page and dig in',
        check: { skill: 'debugging', dc: 50, target: 'team' },
        success: { effects: { client: 8, skill: { debugging: 2 } } },
        fail: { effects: { client: -8, energy: -10 } }
      },
      { id: 'ai-triage', label: 'Let the AI triage it', effects: { cd: 1, client: 3 } },
      { id: 'rollback', label: 'Roll back and investigate tomorrow', effects: { client: -5, energy: -5 } }
    ]
  },

  {
    id: 'rate-limit-meltdown',
    base: 2,
    weight: 3,
    when: () => true,
    text: () => 'Rate Limit Meltdown: a well-meaning integration is retrying every failed request instantly, forever. The API is DDoSing itself.',
    choices: [
      {
        id: 'patch',
        label: 'Add backoff by hand',
        check: { skill: 'coding', dc: 50, target: 'team' },
        success: { effects: { client: 6, skill: { coding: 2 } } },
        fail: { effects: { client: -6, defects: 1 } }
      },
      { id: 'ai-fix', label: 'Have the AI add a limiter', effects: { cd: 1, defects: 1 } },
      { id: 'block', label: 'Block the noisy client outright', effects: { client: -4 } }
    ]
  },

  {
    id: 'certificate-expired-again',
    base: 2,
    weight: 3,
    when: () => true,
    text: () => 'Certificate Expired (Again): the TLS cert lapsed at midnight. Every browser is now showing your client a large red warning about you.',
    choices: [
      {
        id: 'renew',
        label: 'Renew and automate it this time',
        check: { skill: 'judgment', dc: 45, target: 'team' },
        success: { effects: { client: 8 } },
        fail: { effects: { client: -6, energy: -5 } }
      },
      { id: 'ai-renew', label: 'Ask the AI to script the renewal', effects: { cd: 1, client: 3 } },
      { id: 'ignore', label: 'Tell users to click through the warning', effects: { client: -8 } }
    ]
  },

  {
    id: 'cascading-failure',
    base: 4,
    weight: 3,
    when: (s) => s.cd >= 3,
    text: () => 'Cascading Failure: one small service fell over and took four of its neighbors with it. The dependency graph, it turns out, was a house of cards.',
    choices: [
      {
        id: 'trace',
        label: 'Trace the cascade to its source',
        check: { skill: 'debugging', dc: 55, target: 'team' },
        success: { effects: { client: 10, cd: -1, skill: { debugging: 2 } } },
        fail: { effects: { client: -10, defects: 2 } }
      },
      { id: 'restart', label: 'Restart everything and hope', effects: { cd: 1, defects: 2 } },
      { id: 'contractor', label: 'Escalate to a paid on-call firm', effects: { money: -600, client: 5 } }
    ]
  },

  {
    id: 'the-data-leak',
    base: 4,
    weight: 3,
    when: (s) => s.defects.length >= 3,
    text: () => 'The Data Leak: a misconfigured bucket has been quietly public since a fix "nobody reviewed." A researcher emails you a screenshot, politely.',
    choices: [
      {
        id: 'lockdown',
        label: 'Lock it down and disclose properly',
        check: { skill: 'judgment', dc: 55, target: 'team' },
        success: { effects: { client: 8, defects: -2 } },
        fail: { effects: { client: -12, defects: 1 } }
      },
      { id: 'quiet-ai', label: 'Have the AI quietly close it', effects: { cd: 2, client: -3 } },
      { id: 'legal', label: 'Route it to legal and wait', effects: { money: -400, client: -5 } }
    ]
  },

  {
    id: 'the-silent-corruption',
    base: 3,
    weight: 3,
    when: (s) => s.cd >= 4,
    text: () => 'The Silent Corruption: rows have been subtly wrong for weeks. No error was ever thrown. The backups are subtly wrong too.',
    choices: [
      {
        id: 'reconcile',
        label: 'Reconcile the data by hand',
        check: { skill: 'debugging', dc: 60, target: 'team' },
        success: { effects: { client: 10, cd: -2, skill: { debugging: 2 } } },
        fail: { effects: { client: -10, defects: 2 } }
      },
      { id: 'ai-migrate', label: 'Write an AI migration to "fix" it', effects: { cd: 2, defects: 3 } },
      { id: 'accept', label: 'Declare the wrong data the new truth', effects: { client: -8 } }
    ]
  }
];

export default incidents;
