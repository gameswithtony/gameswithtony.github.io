// @ts-check
//
// ────────────────────────────────────────────────────────────────────────────────────
//  LINKEDUP POSTS — the lose screen's content. This file is meant to be edited by hand.
// ────────────────────────────────────────────────────────────────────────────────────
//
// When a run ends with nobody served, the game shows one of these at random, rendered as a
// fake social post. They are the joke the loss is wrapped in: relentless corporate optimism
// annexing a catastrophe.
//
// TO ADD A POST: copy any entry below, change the words, done. There is nothing to register
// and no other file to touch. Order does not matter; one is picked at random each time.
//
//   {
//     author:   'A made-up person',        // invented names only — never a real person
//     headline: 'Their invented job title',
//     body:     'The post. Blank lines separate paragraphs.',
//   }
//
// TOKENS you can use anywhere in `author`, `headline` or `body`. Each is replaced with the
// real number from the run that just ended:
//
//   {map}          the level's display name, e.g. "The Sprawl"
//   {served}       users who reached B  (on this screen it is always 0 — that is the joke)
//   {total}        users the level scheduled in all
//   {lost}         users who gave up waiting or were caught in a blast
//   {detonations}  defects that went off
//   {ticks}        how many turns the run lasted
//
// An unknown token is left alone rather than blanked, so a typo shows up as `{tikcs}` on the
// card instead of silently vanishing.
//
// HOUSE RULES: no real companies, no real people, no real products. "LinkedUp" is the only
// brand named. The satire is of a register, not of anyone in particular.

/**
 * @typedef {object} Post
 * @property {string} author
 * @property {string} headline
 * @property {string} body
 */

/** @type {Post[]} */
export const POSTS = [
  {
    author: 'Devrin Kale',
    headline: 'Head of Platform Velocity',
    body: `Thrilled to announce that we have officially sunset the {map} initiative. 🌊

Did we serve {served} of {total} users? Technically, yes. Did we ship {ticks} ticks of AI-generated infrastructure straight out over open ocean? Absolutely we did.

The {lost} users who walked away were never churn. They were unpaid researchers, and their patience was the most honest feedback this org has ever received.

Failing fast is still fast. 🚀

#BuildInPublic #FailFast #OceanFirst`,
  },
  {
    author: 'Marisol Adeyemi-Frost',
    headline: 'Director of Lessons Learned (newly created role!)',
    body: `Some personal news. 🎉

After {ticks} ticks leading delivery on {map}, I am stepping into a brand-new position created specifically for me: Director of Lessons Learned.

Were there {detonations} detonations? There were. Did our own causeway revert to open water underneath the people standing on it? It did.

But here is what nobody tells you early in your career: you cannot spell "learnings" without "earnings." I am grateful to every one of the {lost} users who gave up on us, and in doing so, gave me this opportunity. 🙏`,
  },
  {
    author: 'Corbin Vale',
    headline: 'AI Transformation Evangelist · ex-Builder · Girl Dad',
    body: `Unpopular opinion: {served} users served is a metric like any other. 📊

We let the model generate {map} end to end. Did it ship defects? Yes — {detonations} of them went off under live load. Was that the model's fault?

No. It was ours, for asking it to build over water we had not finished believing in.

We are not slowing down. We are doubling the block size. 💪

#AI #Leadership #Resilience`,
  },
  {
    author: 'Priya Ravensworth',
    headline: 'Chief Momentum Officer',
    body: `Reflecting on {map} this morning over a flat white. ☕

{total} users arrived. {served} reached the other side. {lost} of them stood at the origin long enough to work out that their time was worth more than our roadmap.

That last number is the one I will be journaling about tonight. Not because it is a failure — because it is a gift.

Grateful. Humbled. Already hiring. 🌱

#GratitudeJourney #FailForward`,
  },
  {
    author: 'Tobias Renn',
    headline: 'Founder & CEO, stealth (again)',
    body: `We did not lose {lost} users on {map}.

We deprecated them. ✅

In {ticks} ticks we validated that the market is not yet ready for a bridge that intermittently becomes ocean. That is called de-risking, and we did it for a fraction of what it would have cost to do properly.

Raising a small round to do it again, larger. DMs open. 🚀`,
  },
  {
    author: 'Anneke Solberg',
    headline: 'Staff Engineer → Storyteller',
    body: `Postmortem thread on {map}. 🧵

1/ {detonations} defects detonated in production. Blast radius: exactly as documented. Documentation: written afterwards.

2/ We shipped {ticks} ticks. Velocity was never the problem.

3/ The real users were the learnings we made along the way.

4/ No action items. Closing the retro. Incredible work, everyone. 👏`,
  },
];

/**
 * @typedef {object} PostFacts
 * @property {string} map
 * @property {number} served
 * @property {number} total
 * @property {number} lost
 * @property {number} detonations
 * @property {number} ticks
 */

/**
 * Replace every `{token}` this file documents. Unknown tokens are left verbatim so a typo in
 * a hand-edited post is visible on the card rather than silently swallowed.
 * @param {string} text
 * @param {PostFacts} facts
 * @returns {string}
 */
export function fill(text, facts) {
  return text.replace(/\{(\w+)\}/g, (whole, key) => (
    Object.prototype.hasOwnProperty.call(facts, key) ? String(facts[/** @type {keyof PostFacts} */ (key)]) : whole
  ));
}

/**
 * One post, tokens already substituted.
 * @param {PostFacts} facts
 * @param {() => number} [rand]  injectable for tests; defaults to Math.random
 * @returns {Post}
 */
export function pickPost(facts, rand = Math.random) {
  const post = POSTS[Math.min(POSTS.length - 1, Math.floor(rand() * POSTS.length))];
  return {
    author: fill(post.author, facts),
    headline: fill(post.headline, facts),
    body: fill(post.body, facts),
  };
}

/**
 * Initials for the avatar disc — first letters of the first two words, which is what every
 * one of these sites does when somebody has not uploaded a photograph.
 * @param {string} author
 * @returns {string}
 */
export function initials(author) {
  const words = author.split(/[\s·]+/).filter(Boolean);
  return (words.slice(0, 2).map((w) => w[0]).join('') || '?').toUpperCase();
}
