// events.js — STUB (WP1). Two regular-deck events, valid against the frozen
// schema, enough to exercise maybeEvent + resolveEvent (one plain, one check).
// WP2 replaces with ~12 punny events per PLAN.md §5. Marked stub on purpose.
//
// Schema: { id, weight, when(s)->bool, text(s)->string, choices[] }
//   choice: { id, label, cost?, effects? }  OR
//           { id, label, check:{skill,dc,target}, success:{effects}, fail:{effects} }

export const events = [
  {
    id: 'token-gesture',
    weight: 4,
    when: () => true,
    text: () => 'Token Gesture: a vendor dangles free credits — with strings.',
    choices: [
      { id: 'take', label: 'Take the credits', effects: { tokensCostMult: 0.5, cd: 1 } },
      { id: 'decline', label: 'Decline politely', effects: { client: 2 } }
    ]
  },
  {
    id: 'merge-conflict',
    weight: 3,
    when: () => true,
    text: () => 'Merge Conflict of Interest: two modules disagree about reality.',
    choices: [
      {
        id: 'sort',
        label: 'Sort it out yourself',
        check: { skill: 'judgment', dc: 55, target: 'you' },
        success: { effects: { skill: { judgment: 1 } } },
        fail: { effects: { defects: 1 } }
      },
      { id: 'ship', label: 'Ship it and hope', effects: { defects: 1, client: -3 } }
    ]
  }
];

export default events;
