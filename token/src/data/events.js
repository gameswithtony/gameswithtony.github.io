// events.js — the regular monthly deck. ~65% of non-quarter months draw one,
// weighted, from the entries whose `when(state)` is true. Punny titles, deadpan
// delivery: the joke lives in the title and setup; the consequences read clinical.
// The game never lectures — the systems make the argument.
//
// ── HOW TO ADD AN EVENT ──────────────────────────────────────────────────────
// Append a plain object. Schema:
//   {
//     id:     unique string (kebab-case). Used in logs; keep it stable.
//     weight: positive number. Relative draw odds among eligible events.
//     when:   (s) => boolean. Eligibility. Reads FULL state — hidden stats too —
//             so decisions make disasters possible. GUARD members: they may be
//             null (s.team.senior && s.team.senior.morale < 45). A predicate that
//             throws is treated as not-eligible, but the schema test fails on it,
//             so guard properly.
//     text:   (s) => string. The card copy. May interpolate state.
//     choices: [ choice, ... ]
//   }
// A choice is EITHER a plain-effects choice:
//     { id, label, cost?, effects: {…} }
// OR a check choice:
//     { id, label, cost?, check: { skill, dc, target }, success:{effects}, fail:{effects} }
//   - skill  ∈ coding | debugging | judgment
//   - target ∈ you (default) | team | junior | qa | senior
//              a check naming an UNHIRED member is auto-pruned from the card.
//              'team' = the best hidden Understanding in the shop (you included).
//   - a check targeting 'you' is always a calibration reveal (engine handles it).
//
// Legal effect keys (applyEffects throws on anything else):
//   money, energy, cd, skill:{coding|debugging|judgment}, conf:{…},
//   member:{junior|qa|senior:{morale, comp, burnout}}  (comp→und; burnout ignored),
//   removeMember, defects (±n or {add:{severity,provenance}}), client,
//   capacityDelta, tokensCostMult, flag, endRun.
//
// MAGNITUDE CAPS per choice (schema-enforced — see test/schema.test.js):
//   money ±800 · energy ±20 · any one skill ±5 · cd ±2 · defects ±3 ·
//   client ±15 · member morale ±20.  (Majors get 2×; this is the regular deck.)
//   MOREFUN D5: an event may declare `minMonth: n` — it can't be drawn earlier,
//   and its caps scale by that month's quarter (×1.5 Q2 · ×2 Q3 · ×2.5 Q4).
//   Late events should sting; that is what the bigger caps are FOR.
//
// EARNED BIG GUNS: removeMember and endRun may appear ONLY as a check-fail branch,
//   or in a choice whose event `when` requires accumulated state (sunk morale,
//   high CD, a soured client) — never on an unconditional always-true event.
//
// FIVE AXES: every choice must move at least one — 💰 money · ⚡ energy/morale ·
//   🧠 skill/cd/conf · 🚚 velocity · 🤝 client/defects. A check counts (🧠).
// ─────────────────────────────────────────────────────────────────────────────

export const events = [
  {
    id: 'token-gesture',
    weight: 4,
    when: () => true,
    text: () => 'Token Gesture: a vendor dangles a month of free credits — with a footnote nobody reads aloud.',
    choices: [
      { id: 'take', label: 'Take the credits', effects: { tokensCostMult: 0.5, cd: 1 } },
      { id: 'decline', label: 'Decline politely', effects: { client: 2 } }
    ]
  },

  {
    id: 'merge-conflict',
    weight: 3,
    when: (s) => !!s.team.senior && !!s.team.qa,
    text: (s) => `Merge Conflict of Interest: ${s.team.senior.name} and ${s.team.qa.name} are relitigating a design decision in the group channel. Reactions are being deployed.`,
    choices: [
      {
        id: 'mediate',
        label: 'Mediate the review thread',
        check: { skill: 'judgment', dc: 55, target: 'you' },
        success: { effects: { member: { senior: { morale: 8 }, qa: { morale: 8 } } } },
        fail: { effects: { member: { senior: { morale: -6 }, qa: { morale: -6 } }, client: -3 } }
      },
      { id: 'side', label: 'Rule for the QA', effects: { member: { qa: { morale: 12 }, senior: { morale: -8 } } } },
      { id: 'ship', label: 'Ship both and let prod decide', effects: { defects: 1, client: -3 } }
    ]
  },

  {
    id: 'prompt-and-circumstance',
    weight: 3,
    when: () => true,
    text: () => 'Prompt and Circumstance: the model was deprecated overnight. Your carefully tuned prompts are now ruins of a lost civilization.',
    choices: [
      { id: 'rewrite', label: 'Rewrite the prompts by hand', effects: { energy: -15, skill: { coding: 2 } } },
      { id: 'raw', label: 'Point raw AI at it and pray', effects: { cd: 2, defects: 2 } },
      { id: 'pay', label: 'Pay for legacy model access', effects: { money: -600 } }
    ]
  },

  {
    id: 'regression-to-the-mean',
    weight: 3,
    when: (s) => s.defects.length >= 1,
    text: () => 'Regression to the Mean: an AI "fix" from last month quietly reopened a bug you were sure was closed. It was so sure too.',
    choices: [
      {
        id: 'investigate',
        label: 'Trace it yourself',
        check: { skill: 'debugging', dc: 55, target: 'you' },
        success: { effects: { defects: -2, skill: { debugging: 1 } } },
        fail: { effects: { defects: 1, energy: -10 } }
      },
      { id: 're-fix', label: 'Have the AI re-fix it', effects: { cd: 1, defects: 1 } },
      { id: 'ignore', label: 'Mark it "works as designed"', effects: { client: -3, defects: 1 } }
    ]
  },

  {
    id: 'cache-cow',
    weight: 3,
    when: () => true,
    text: () => "Cache Cow: the client's beloved flagship feature turns out to be, on inspection, caching. They would like it to do more.",
    choices: [
      {
        id: 'explain',
        label: 'Explain what it actually is',
        check: { skill: 'judgment', dc: 55, target: 'you' },
        success: { effects: { client: 8 } },
        fail: { effects: { client: -5 } }
      },
      { id: 'build', label: 'Build the version they imagine', effects: { energy: -15, skill: { coding: 2 } } },
      { id: 'rebrand', label: 'Add TTL knobs and call it AI', effects: { cd: 1, client: 5 } }
    ]
  },

  {
    id: 'schrodingers-deploy',
    weight: 3,
    when: () => true,
    text: () => "Schrödinger's Deploy: nobody in the shop can say whether the release actually shipped. The changelog is both there and not there.",
    choices: [
      {
        id: 'observe',
        label: 'Open the logs and collapse the wavefunction',
        check: { skill: 'debugging', dc: 50, target: 'you' },
        success: { effects: { client: 5 } },
        fail: { effects: { energy: -10, client: -3 } }
      },
      { id: 'ask-ai', label: 'Ask the AI what it did', effects: { cd: 1 } },
      { id: 'rollback', label: 'Roll it back to be safe', effects: { client: -5, energy: -5 } }
    ]
  },

  {
    id: 'recruiter-coffee',
    weight: 4,
    when: (s) => !!s.team.senior && (s.team.senior.morale < 45 || s.team.senior.trait === 'flight risk'),
    text: (s) => `A recruiter buys ${s.team.senior.name} a suspiciously nice coffee. LinkedUp notifications ensue.`,
    choices: [
      { id: 'counter', label: 'Counter-offer ($700)', effects: { money: -700, member: { senior: { morale: 18 } } } },
      {
        id: 'make-case',
        label: 'Make the case yourself',
        check: { skill: 'judgment', dc: 55, target: 'you' },
        success: { effects: { member: { senior: { morale: 15 } } } },
        fail: { effects: { removeMember: 'senior' } }
      },
      { id: 'wish-well', label: 'Wish them well', effects: { removeMember: 'senior' } }
    ]
  },

  {
    id: 'standup-that-would-not-stand-down',
    weight: 2,
    when: () => true,
    text: () => 'The Standup That Would Not Stand Down: the fifteen-minute sync has metastasized to fifty. Someone is sharing their screen to show a calendar.',
    choices: [
      { id: 'timebox', label: 'Hard timebox it to 15', effects: { member: { junior: { morale: 5 }, qa: { morale: 5 }, senior: { morale: 5 } } } },
      { id: 'donuts', label: 'Bring donuts, keep the ritual', effects: { money: -100, member: { junior: { morale: 8 }, qa: { morale: 8 }, senior: { morale: 8 } } } },
      { id: 'double', label: 'Add a second sync to fix the first', effects: { energy: -5, client: -2 } }
    ]
  },

  {
    id: 'junior-asks-how-auth-works',
    weight: 3,
    when: (s) => !!s.team.junior,
    text: (s) => `${s.team.junior.name} asks, brightly, how the auth system works. You wrote none of it. Neither, it turns out, did anyone.`,
    choices: [
      { id: 'pair', label: 'Sit down and work it out together', effects: { energy: -10, member: { junior: { morale: 10, comp: 4 } } } },
      { id: 'ai', label: 'Tell them to ask the AI', effects: { member: { junior: { morale: -6 } }, cd: 1 } },
      {
        id: 'admit',
        label: "Admit you don't know either",
        check: { skill: 'judgment', dc: 50, target: 'you' },
        success: { effects: { member: { junior: { morale: 8 } } } },
        fail: { effects: { member: { junior: { morale: -10 } } } }
      }
    ]
  },

  {
    id: 'subtle-race-condition',
    weight: 3,
    when: () => true,
    text: () => 'A subtle race condition appears in production. The AI offers a plausible, confident, well-formatted fix. High Judgment notices what is wrong with it.',
    choices: [
      {
        id: 'review',
        label: 'Review the fix line by line',
        check: { skill: 'judgment', dc: 60, target: 'you' },
        success: { effects: { skill: { judgment: 2 } } },
        fail: { effects: { defects: 2, cd: 1 } }
      },
      {
        id: 'senior',
        label: 'Have the senior look',
        check: { skill: 'judgment', dc: 55, target: 'senior' },
        success: { effects: { defects: -1 } },
        fail: { effects: { defects: 1 } }
      },
      { id: 'accept', label: 'Accept the AI fix', effects: { defects: 2, cd: 1 } }
    ]
  },

  {
    id: 'same-cloud-region',
    weight: 3,
    when: (s) => s.openSeverity >= 1 || s.defects.length >= 2,
    text: () => 'Production is down. So is the AI. Same cloud region. The status page is hosted there too.',
    choices: [
      {
        id: 'by-hand',
        label: 'Debug it raw, by hand',
        check: { skill: 'debugging', dc: 55, target: 'you' },
        success: { effects: { client: 8, skill: { debugging: 2 } } },
        fail: { effects: { client: -8, energy: -10 } }
      },
      { id: 'wait', label: 'Wait for the region to recover', effects: { client: -10 } },
      { id: 'apologize', label: 'Post a calm apology and a coupon', effects: { money: -150, client: 3 } }
    ]
  },

  {
    id: 'the-postmortem',
    weight: 3,
    when: (s) => s.cd >= 4,
    text: () => 'The postmortem requires a root-cause explanation. "The AI wrote it" is not an accepted entry on the form.',
    choices: [
      {
        id: 'honest',
        label: 'Write an honest one',
        check: { skill: 'judgment', dc: 60, target: 'you' },
        success: { effects: { client: 8, cd: -1 } },
        fail: { effects: { client: -5 } }
      },
      { id: 'blame-cloud', label: 'Blame the cloud provider', effects: { client: -3 } },
      { id: 'ai-writes', label: 'Have the AI write the postmortem', effects: { cd: 2, client: 5 } }
    ]
  },

  {
    id: 'the-exodus-interview',
    weight: 5,
    when: (s) => ['junior', 'qa', 'senior'].some((r) => s.team[r] && s.team[r].morale < 20),
    text: () => 'The whole team has booked a meeting with you titled, ominously, "quick chat." Their cameras are on. Yours suddenly is not.',
    choices: [
      {
        id: 'hear-out',
        label: 'Hear them out, honestly',
        check: { skill: 'judgment', dc: 55, target: 'you' },
        success: { effects: { member: { junior: { morale: 15 }, qa: { morale: 15 }, senior: { morale: 15 } } } },
        fail: { effects: { endRun: 'everyone-quit' } }
      },
      { id: 'raises', label: 'Raise everyone on the spot ($800)', effects: { money: -800, member: { junior: { morale: 15 }, qa: { morale: 15 }, senior: { morale: 15 } } } },
      { id: 'nothing', label: 'Tell them the market is tough', effects: { endRun: 'everyone-quit' } }
    ]
  },

  // ── MOREFUN D5: the mid/late-year deck. minMonth gates the draw; the caps ──
  // scale with the quarter, so these are authored to genuinely wound. ─────────

  {
    id: 'scope-creep-of-the-valley',
    weight: 4,
    minMonth: 4,
    when: (s) => !!s.milestone,
    text: (s) => `Scope Creep of the Valley: the client "had a thought" about ${s.milestone.title.toLowerCase()}. The thought is four more features.`,
    choices: [
      { id: 'absorb', label: 'Absorb it quietly', effects: { energy: -18, client: 8 } },
      {
        id: 'hold',
        label: 'Hold the line on scope',
        check: { skill: 'judgment', dc: 55, target: 'you' },
        success: { effects: { client: 6 } },
        fail: { effects: { client: -12 } }
      },
      { id: 'change-order', label: 'Quote a change order', effects: { money: 500, client: -8 } }
    ]
  },

  {
    id: 'the-unpaid-invoice',
    weight: 4,
    minMonth: 4,
    when: (s) => s.client < 60,
    text: () => 'The Unpaid Invoice: this month\'s payment is "in the system." The system, on inspection, is a person named Greg who is on leave.',
    choices: [
      {
        id: 'chase',
        label: 'Chase it, politely, daily',
        check: { skill: 'judgment', dc: 50, target: 'you' },
        success: { effects: { client: 5 } },
        fail: { effects: { money: -1000, client: -5 } }
      },
      { id: 'eat-it', label: 'Float the month yourself', effects: { money: -1000 } },
      { id: 'late-fees', label: 'Invoke the late-fee clause', effects: { money: 300, client: -10 } }
    ]
  },

  {
    id: 'technical-debt-ceiling',
    weight: 4,
    minMonth: 4,
    when: (s) => s.cd >= 5,
    text: () => 'The Technical Debt Ceiling: adding one field now requires three days of archaeology. Nobody remembers which layer is load-bearing.',
    choices: [
      { id: 'refactor', label: 'Declare a refactor week', effects: { energy: -20, cd: -3, client: -5 } },
      { id: 'press-on', label: 'Press on regardless', effects: { defects: 3, cd: 1 } },
      { id: 'ai-refactor', label: 'Have the AI refactor itself', effects: { money: -400, cd: 3, defects: 2 } }
    ]
  },

  {
    id: 'the-model-knows',
    weight: 3,
    minMonth: 7,
    when: (s) => s.cd >= 6,
    text: () => 'The Model Knows: the AI has started referring to internal services by names nobody gave them. It is not wrong. That is the unsettling part.',
    choices: [
      {
        id: 'audit',
        label: 'Audit the system by hand',
        check: { skill: 'debugging', dc: 60, target: 'you' },
        success: { effects: { cd: -4, skill: { debugging: 3 } } },
        fail: { effects: { energy: -25, cd: -1 } }
      },
      { id: 'ask-it', label: 'Ask it to explain itself', effects: { conf: { coding: 8 }, cd: 2 } },
      { id: 'ignore', label: 'Log off. It is fine.', effects: { defects: 4, cd: 2 } }
    ]
  },

  {
    id: 'the-body-shop',
    weight: 5,
    minMonth: 7,
    when: (s) => (s.flags.milestonesMissed || 0) >= 1,
    text: () => 'The Body Shop: after the missed milestone, the client has "engaged a partner consultancy to accelerate delivery." Their first deliverable is a kickoff deck.',
    choices: [
      { id: 'pay-off', label: 'Convince them off ($1,500 credit)', effects: { money: -1500, client: 8 } },
      { id: 'accept', label: 'Welcome the reinforcements', effects: { capacityDelta: 2, cd: 4, defects: 3 } },
      {
        id: 'outperform',
        label: 'Outperform them publicly',
        check: { skill: 'coding', dc: 60, target: 'team' },
        success: { effects: { client: 15 } },
        fail: { effects: { client: -15, member: { junior: { morale: -10 }, qa: { morale: -10 }, senior: { morale: -10 } } } }
      }
    ]
  },

  {
    id: 'backlog-with-a-name',
    weight: 4,
    minMonth: 7,
    when: (s) => s.backlog.length >= 3,
    text: () => 'The team has given the backlog a name. It is not a kind name. It has a birthday now, and the birthday is observed.',
    choices: [
      { id: 'crunch', label: 'Call a crunch fortnight', effects: { energy: -30, member: { junior: { morale: -12 }, qa: { morale: -12 }, senior: { morale: -12 } }, client: 10 } },
      { id: 'contractor', label: 'Bring in a contractor ($1,400)', effects: { money: -1400, client: 5 } },
      { id: 'own-it', label: 'Present the backlog as a roadmap', effects: { client: -12 } }
    ]
  },

  {
    id: 'the-case-study',
    weight: 3,
    minMonth: 7,
    when: (s) => s.client >= 75,
    text: () => 'The Case Study: the client wants to feature the project at their partner summit. Someone will have to stand next to the architecture diagram and answer questions.',
    choices: [
      {
        id: 'present',
        label: 'Present it yourself',
        check: { skill: 'coding', dc: 60, target: 'you' },
        success: { effects: { client: 15, money: 800 } },
        fail: { effects: { client: -15 } }
      },
      { id: 'send-senior', label: 'Send the senior', effects: { member: { senior: { morale: 10 } }, client: 5 } },
      { id: 'decline', label: 'Decline, citing focus', effects: { client: -5 } }
    ]
  },

  {
    id: 'the-audit-of-the-audit',
    weight: 4,
    minMonth: 10,
    when: (s) => s.cd >= 8,
    text: () => "The Audit of the Audit: the client's new CTO would like to know who wrote the payments module. The commit log says 'assistant'. All of it says 'assistant'.",
    choices: [
      {
        id: 'come-clean',
        label: 'Walk them through it honestly',
        check: { skill: 'judgment', dc: 65, target: 'you' },
        success: { effects: { client: 12, cd: -3 } },
        fail: { effects: { client: -25 } }
      },
      { id: 'rewrite-history', label: 'Tidy the commit log first', effects: { client: 5, cd: 3, defects: 3 } },
      { id: 'stall', label: 'Schedule a follow-up for Q5', effects: { client: -15 } }
    ]
  },

  {
    id: 'black-friday-every-friday',
    weight: 4,
    minMonth: 10,
    when: () => true,
    text: () => 'Black Friday, Every Friday: year-end traffic is forty times projection. This is either the best month of the contract or the last one.',
    choices: [
      { id: 'all-hands', label: 'All hands on the pager', effects: { energy: -35, member: { junior: { morale: -10 }, qa: { morale: -10 }, senior: { morale: -10 } }, client: 18 } },
      {
        id: 'trust-autoscaler',
        label: 'Trust the autoscaler',
        check: { skill: 'debugging', dc: 60, target: 'team' },
        success: { effects: { client: 15 } },
        fail: { effects: { defects: 5, client: -20 } }
      },
      { id: 'throttle', label: 'Throttle the traffic, keep it boring', effects: { client: -10, money: -500 } }
    ]
  }
];

export default events;
