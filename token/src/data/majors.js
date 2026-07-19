// majors.js — STUB (WP1). One quarter-end set piece (river-crossing shape:
// by hand / AI full-auto / pay / wait). Drawn without repeats at months 3/6/9;
// month 12 is the fixed Renewal Review (handled in engine, not this deck).
// WP2 replaces with 4 majors per PLAN.md §5. Marked stub on purpose.

export const majors = [
  {
    id: 'prompt-and-circumstance',
    weight: 1,
    when: () => true,
    text: () => 'Prompt and Circumstance: the platform demands a migration.',
    choices: [
      { id: 'hand', label: 'Do it by hand', effects: { energy: -15, skill: { coding: 2 } } },
      { id: 'ai', label: 'AI full-auto', effects: { cd: 2, defects: 2 } },
      { id: 'pay', label: 'Hire a contractor', effects: { money: -1000 } },
      { id: 'wait', label: 'Wait it out', effects: { client: -10 } }
    ]
  }
];

export default majors;
