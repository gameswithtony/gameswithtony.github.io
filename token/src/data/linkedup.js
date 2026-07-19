// linkedup.js — the death (and victory) screen copy. Every run's ending is
// announced as a cartoony LinkedIn-parody post under a LinkedUp header: a chirpy
// announcement-voice body that types itself in (Oregon Trail's epitaph ritual,
// re-skinned), with a clinical deadpan CAUSE line beneath it. Plain data, authored
// exactly like events — Tony edits the strings here.
//
// ── HOW TO ADD / EDIT A POST ─────────────────────────────────────────────────
// Add or edit an entry keyed by the run's ending cause. Each entry is:
//   { headline, body, cause, reactions? }
//     headline  the bold LinkedUp status line (chirpy)
//     body      the announcement post (chirpy LinkedIn-announcement voice — the
//               part that types itself in). Keep the humor in the framing; let
//               the deadpan cause line do the puncturing.
//     cause     the clinical one-liner beneath ("Cause: cognitive surrender.")
//     reactions optional small reactions row (emoji + label), UI flavor
//
// Ending causes come from two places:
//   • engine deaths / verdicts: 'bankruptcy', 'burnout', 'fired', 'impostor',
//     'qualified'  (see engine.js settleBooks + resolveRenewal)
//   • deck-authored endRun causes: 'everyone-quit' (events.js), 'outage-unsolved'
//     (majors.js The Outage). Add a matching key here whenever you author a new
//     endRun cause, or the fallback 'default' post is used.
//
// 'purist' is not a stored ending — it is a VARIANT of 'bankruptcy' selected by
// linkedUpFor() when you went broke with high hidden Understanding and low AI
// dependence (the beautiful-fundamentals-bankrupt-by-August run). See below.
// ─────────────────────────────────────────────────────────────────────────────

const R = (str) => str; // identity; kept so bodies read as one paragraph literal

export const linkedup = {
  // ── engine deaths ──────────────────────────────────────────────────────────
  bankruptcy: {
    headline: 'Announcing my next chapter! 🚀',
    body: R("Thrilled to share that after an incredible twelve-month journey, my shop and I have made the difficult decision to run entirely out of money. Grateful to every teammate, every token, and everyone who told me the burn rate was 'a growth signal.' The software still runs. The bank account does not. Open to new opportunities — reach out!"),
    cause: 'Cause: insolvency.',
    reactions: [['👏', 'Devon and 47 others'], ['🔥', 'reacted']]
  },
  burnout: {
    headline: 'Some personal news. 🌱',
    body: R("After twelve unforgettable months, I've decided to step back and prioritize my wellbeing, which is a professional way of saying I have nothing left. I built, I shipped, I forgot to sleep. Deeply grateful for the ride and to my Energy bar, which fought valiantly to the very end. Taking some time to touch grass. Literally. It's right there."),
    cause: 'Cause: founder burnout — Energy reached zero.',
    reactions: [['💙', 'Priya and 31 others'], ['🙏', 'sent support']]
  },
  fired: {
    headline: 'Exciting update on my journey! ✨',
    body: R("Excited to announce that the client and I have mutually agreed to part ways — they keep the software, I keep the lessons, and everyone keeps a straight face. Twelve months of building a relationship that ended, technically, at zero. So proud of what we shipped and so ready for what's next. If you're hiring, my DMs are open and my calendar is suddenly very free."),
    cause: 'Cause: client happiness reached zero; contract canceled.',
    reactions: [['👏', 'Omar and 22 others'], ['😮', 'reacted']]
  },

  // ── month-12 verdicts ──────────────────────────────────────────────────────
  qualified: {
    headline: 'Contract renewed! Onward and upward! 🎉',
    body: R("Humbled and genuinely thrilled to share that we passed the Renewal Review — twelve months in, the software runs, the team is intact, and when the client asked me to explain my own system, I could. Turns out you can move fast AND know what you built. Grateful to everyone who reviewed a diff instead of rubber-stamping it. Here's to year two."),
    cause: 'Cause: none. The contract was renewed. You could explain it.',
    reactions: [['🎉', 'Vera and 88 others'], ['👏', 'celebrate']]
  },
  impostor: {
    headline: 'Proud to share we passed our review! 🏆',
    body: R("Beyond thrilled to announce the platform passed its twelve-month review with flying colors! Could I personally rebuild it from scratch? Could I explain what the auth layer does? These feel like questions for a future sprint. The software works, the metrics are green, and honestly, isn't that what matters? Blessed. Onward!"),
    cause: 'Cause: the software runs. You cannot explain it.',
    reactions: [['🔥', 'the AI and 0 humans'], ['🤔', 'reacted']]
  },

  // ── the Purist variant of bankruptcy (see linkedUpFor) ─────────────────────
  purist: {
    headline: 'Reflecting on a beautiful year. 🕊️',
    body: R("As my runway reaches its natural and completely foreseeable conclusion, I want to say: every line was understood. Every abstraction was earned. Every dependency was justified in writing. I delegated nothing I could not explain and I explained everything I built. I also went bankrupt in August. I regret none of the code and all of the timing. #Craftsmanship #Fundamentals"),
    cause: 'Cause: insolvency, with the cleanest codebase in the graveyard.',
    reactions: [['🙌', 'Greybeards everywhere'], ['💸', 'reacted']]
  },

  // ── deck-authored endRun causes ────────────────────────────────────────────
  'everyone-quit': {
    headline: 'Grateful for an amazing team! 💫',
    body: R("So incredibly grateful to the talented humans I got to work alongside this year — every single one of whom has now, simultaneously, in the same meeting, decided to pursue other opportunities. A team is only as strong as its morale bar, and ours reached the basement. Thank you all. Really. Wait — where's everyone going? The camera's still on. Hello?"),
    cause: 'Cause: total team departure.',
    reactions: [['👋', 'the entire team'], ['📦', 'has left the building']]
  },
  'outage-unsolved': {
    headline: 'Learned so much this year! 🔥',
    body: R("Sharing some vulnerable and authentic reflections on the Friday outage that, as of this posting, has not ended. Growth happens outside the comfort zone, and I can confirm I am very far outside it. Dashboards remain a color I'd describe as 'assertive.' Grateful for the learnings, the pager, and the region that took us with it. Circling back once we're back up. If we're back up."),
    cause: 'Cause: an outage that did not resolve.',
    reactions: [['🔥', 'production, literally'], ['🫡', 'the on-call']]
  },

  // ── fallback ───────────────────────────────────────────────────────────────
  default: {
    headline: 'Some news to share. 📮',
    body: R("Closing this chapter with gratitude and a suspiciously vague explanation. Twelve months, a lot of tokens, and a story I'll be telling at meetups for years — heavily edited. Thanks to everyone who followed along. Open to what's next."),
    cause: 'Cause: unspecified. It shipped to production.',
    reactions: [['👏', 'a few kind souls']]
  }
};

const SKILLS = ['coding', 'debugging', 'judgment'];

/** Mean hidden Understanding across the three skills (used for the Purist test). */
function meanUnd(state) {
  return SKILLS.reduce((a, k) => a + (state.skills?.[k]?.und ?? 0), 0) / SKILLS.length;
}

/**
 * Resolve the LinkedUp post for a finished run. Applies the Purist override:
 * a Bankruptcy reached with high hidden Understanding and low Cognitive Debt
 * (the beautiful-fundamentals-broke-by-August run) reads as The Purist.
 *
 * Heuristic thresholds are documented content calls (WP5 owns final wiring):
 *   Purist  =  ending 'bankruptcy'  AND  mean hidden Understanding ≥ 60
 *              AND  Cognitive Debt ≤ 3  (a proxy for low AI dependence).
 *
 * @param {string} ending  the run's ending cause
 * @param {object} state   the final gameState (for the Purist test)
 * @returns {{headline, body, cause, reactions?}}
 */
export function linkedUpFor(ending, state) {
  if (ending === 'bankruptcy' && state && meanUnd(state) >= 60 && (state.cd ?? 0) <= 3) {
    return linkedup.purist;
  }
  return linkedup[ending] || linkedup.default;
}

export default linkedup;
