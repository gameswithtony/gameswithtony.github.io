// incidents.js — STUB (WP1). Flare-up templates. In WP1 an incident flare is
// engine-computed: the severity formula (economy doc §Incident damage) runs
// with an internal team-Debugging responder check, and severity joins the open
// pool. The `base` here is that formula's Base term; `text` is the log line.
//
// WP2 aligns these to the full event schema (responder choices) and adds ~6 of
// them, guarded by test/schema.test.js. Marked stub on purpose.

export const incidents = [
  {
    id: 'schrodingers-deploy',
    weight: 1,
    base: 3,
    when: () => true,
    text: () => "Schrodinger's Deploy: nobody can say whether it shipped."
  }
];

export default incidents;
