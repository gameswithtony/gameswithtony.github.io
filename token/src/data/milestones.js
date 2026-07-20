// milestones.js — the quarterly deliverables (MOREFUN D4). Plain data. Each
// quarter the client names one of these; 1–2 fresh tasks per month arrive
// tagged toward it, and the tagged set must ship by the quarter-end month.
// Titles are cosmetic — the numbers (bonus, client hit, tags per month) live
// in config.milestone. Add one by appending an object; ids must be unique
// (they key the no-repeat flags, `ms-<id>`).

export const milestones = [
  { id: 'reporting-dashboard', title: 'The reporting dashboard' },
  { id: 'mobile-checkout', title: 'Checkout that works on phones' },
  { id: 'sso-rollout', title: 'Single sign-on for the enterprise deal' },
  { id: 'partner-api', title: 'The partner API, versioned' },
  { id: 'billing-migration', title: 'Billing off the spreadsheet' },
  { id: 'audit-exports', title: 'Exports the auditors will accept' },
  { id: 'realtime-sync', title: 'Real-time sync, or close enough' },
  { id: 'data-retention', title: 'The retention policy, enforced' }
];

export default milestones;
