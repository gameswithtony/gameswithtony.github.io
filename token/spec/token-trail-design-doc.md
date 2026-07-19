# The Token Trail — Design Doc v4 (aligned with PLAN.md)

*A web game about losing skill in the age of AI, in the body of a 90s edutainment classic.*

**Tagline:** How much of you will arrive?

---

## Premise

You run a small dev shop. You've signed a one-year contract: build the software, keep it running for twelve months. The client pays monthly — as long as it stays up. Payroll and AI tokens burn cash constantly. A run is **12 monthly turns, 15–20 minutes total.**

## The three pillars

1. **AI vs. hand work.** Every task can go to you, the AI, or a teammate. The AI is fastest and cheapest per turn; hands are how skill and understanding exist at all. Delegation quietly causes **skill atrophy** — use it or lose it, mechanized. Neither extreme wins: pure abstinence loses to the clock, pure dependence loses to the first real incident.
2. **Confidence vs. hidden Understanding.** The UI shows Confidence — big friendly bars that rise as you ship. True Understanding is hidden, revealed only at checks: *"You believed: 78. Reality: 41."* A check is the **only** moment true Understanding is ever shown, and only for the checked party. Atrophy is invisible until tested, so the interface itself is the trap.
3. **Cognitive Debt.** Work no human has reviewed accrues **Cognitive Debt** — a visible meter that multiplies incident damage. You can ship a system nobody in the room has ever met. Understanding is *built* two ways — reviewing code before it ships, or debugging it after — and both draw from the same limited review capacity. The bill for skipping both arrives at 2am.

The game never lectures. The systems argue the thesis.

## The five balances

Everything the player can do moves at least one of five axes, and every axis pushes back:

**💰 Money · ⚡ Burnout · 🧠 Understanding · 🚚 Velocity · 🤝 Client happiness**

Three are mortal meters — money below zero is **Bankruptcy**, energy at zero is **Burnout**, client at zero is **Fired**. The other two never kill directly: Understanding fails you at the Renewal Review and multiplies every incident; Velocity bleeds Money and Client until one of *them* finishes the job. The two axes that can't kill you are the two that decide whether surviving meant anything. Full action-to-axis matrices and failure modes: **PLAN.md §1**.

## Structure (Oregon Trail's skeleton)

- **Outfitting:** pick a class (Vibe Coder / Bootcamp Grad / Greybeard / Craftsperson — banker-to-farmer score multipliers), then two clean decisions: **who to hire** and **which model**. Hiring draws from a seeded candidate pool — two candidates per role (Junior, QA, Senior), each with a salary, one visible trait, and a *resume*: claimed understanding you can see, true understanding you can't. Resumes are Confidence artifacts; the truth only ever surfaces at a check. **The model is the fourth hire**, with its own stat block: cost, error rate, error *subtlety*, deprecation risk. A deadpan clerk advises: *"I always tell folks: hire the QA. Nobody listens."* Since salaries and revenue are both monthly, outfitting isn't spending a pile — it's choosing a burn rate against income you can't guarantee.
- **12 monthly legs.** Each month: route the work (fresh tasks and any backlog), spend **your one focus** (build a task yourself, hunt, rest, or a 1:1 with a teammate — the wagon-stop decision), survive whatever the dice bring, settle the books. Quarter ends reopen the store (hire/fire, switch model) before the major hits — tactical choices are monthly, structural ones wait for landmarks.
- **Continuous deployment.** Completed work ships as it lands — there is no deploy gate. The only control point is attention: one **review capacity** pool per month. The split is emergent — each AI+Review route spends a point at routing time; whatever remains is hunt ammo if your focus goes to the hunt. Live defects can flare into incidents any month.
- **Debugging is hunting.** The optional outing, the skill ritual, the minigame. Go bug hunting in the live system: fixed bugs restore SLA health (revenue — the meat), pay down Cognitive Debt, and grow Debugging skill. What surfaces scales with hidden Debugging understanding — atrophied hunters watch a screen full of live bugs where almost nothing seems to appear, and Confidence files the session as thorough. You can spot more bugs than your remaining capacity can fix: you shot 500 pounds, you carry 100. **Or skip the hunt and send the AI:** for tokens and zero attention it closes a percentage of the pool — but each fix has a small chance of planting a new hidden bug, every patch is code nobody understands (+Cognitive Debt), and your Debugging decays. The cure that deepens the disease.
- **The backlog is workable, not just pressure.** An unrouted task slips — a one-time fee, a dent in client happiness — and joins a visible pool. Backlog items route exactly like fresh tasks (point yourself, a teammate, or the AI at them, with all the usual consequences of that route), and clearing one earns a goodwill line in the books. Since AI tasks cost no slots, the model can chew through the whole pile in a month for tokens: velocity heaven, understanding hell. The trap, self-serve.
- **Dice events at semi-random intervals.** Most months *may* roll on the weighted event deck (~65% chance); some months pass quietly. Crucially, **eligibility predicates read the game state** — your decisions change hidden stats, and the stats decide which disasters are even possible (see Party). Some events carry skill checks (many don't); checks roll against *hidden* understanding and target either you, a named teammate, or the whole team — where a team check means the best understanding in the shop: "does *anyone* here understand this?" If the AI did all the work, the team's best is nobody.
- **Quarter-end majors: the river crossings.** Months 3, 6, and 9 always end in a set piece drawn (no repeats) from a majors deck — The Big Migration, The Security Audit, The Client Pivot, The Outage — each in the classic shape: ford it (by hand), caulk the wagon (AI full-auto), pay the ferry (contractor), or wait (lose time). Predicates apply to majors too: high Cognitive Debt steers Q2 toward The Outage; a neglected team invites The Mass Exodus. You earn your set pieces. The major replaces that month's regular draw, giving the run four acts that each close on a big beat.
- **The gate:** Month 12's major is fixed — the **Renewal Review**, where the client asks you to explain your own system. A final calibration check against Understanding and Cognitive Debt that no money can buy past.
- **LinkedUp posts** for failed runs: every death is announced as a cartoony LinkedIn-parody post under a **LinkedUp** header — chirpy body copy, clinical cause line beneath. *"Thrilled to share I'm exploring new opportunities…" — Cause: cognitive surrender.*

## Party: decisions shape abilities

Team members have visible roles and moods, and hidden stats underneath — understanding and morale — that *your routing decisions* move. The consequences arrive through the event deck: bypass the junior every month and their stalled growth and sinking morale make the "junior quits" event eligible. Overwork the team and burnout-flavored events unlock for everyone. Grow your senior and neglect their morale, and the recruiter event enters the deck. Nobody announces the mechanism; players discover that the disasters were *earned*.

- **Junior:** slow, compounds with every task actually given to them — with visible title bumps as they grow. Starved: *"[Junior] has left the wagon."*
- **QA:** adds review capacity and purges defects monthly. Skip the hire and the AI "covers" testing — free, green, and quietly filling a hidden defect pool.
- **Senior:** high understanding, covers what you can't. The one recruiters circle.

## Event deck (deadpan, sampled)

- "A subtle race condition appears. The AI offers a plausible fix." (It's wrong. High Judgment notices.)
- "Production is down. So is the AI. Same cloud region."
- "Your junior asks how auth works. You wrote none of it."
- "Model deprecated overnight. Your prompts are ruins."
- "A recruiter buys your senior a coffee."
- "The postmortem requires an explanation. 'The AI wrote it' is not on the form."

Titles are punny, delivery deadpan, and effects capped so no single draw can decide a run — the authoring contract lives in PLAN.md §5.

## The hunt screen (minigame presentation)

Whack-a-mole. A grid of code panels — plausible monospace pseudo-code in EGA colors, representing recently shipped modules. Bugs pop up on timed windows; click to fix (spends capacity); a 45-second session timer ends the hunt. Small quick bugs are worth little, big slow ones worth more — the squirrel/buffalo economy, nothing fancier.

The depth is all in the underlying systems, not the targets: spawn frequency and window length scale with hidden Debugging understanding (a low-understanding hunt looks *calm*, not degraded — and Confidence files it as thorough), and spawn density follows defect provenance, so bugs cluster in blocks that shipped unreviewed. The minigame quietly maps where your Cognitive Debt lives without adding any new system.

## Endings

Scored on *who* finishes the year, times class multiplier:

- **The Qualified Human** — contract renewed, calibrated, team intact. The true win.
- **The Impostor** — the software runs; you can't explain it. A victory screen that reads like horror.
- **The Purist** — beautiful fundamentals, bankrupt by August. (A LinkedUp-post variant of Bankruptcy, not a separate mechanic.)
- Deaths: **Bankruptcy** (money), **Burnout** (energy), **Fired** (client) — the three mortal meters — plus deck-authored ends like Everyone Quit and the Outage You Couldn't Solve. Cause lines read in plain clinical deadpan: *"Cause: cognitive surrender."*

Signature line, earned at the worst possible moment: **"You have shipped to production."**

## Aesthetic

16-color EGA palette, period bitmap monospace, PC-speaker beeps via WebAudio. Educational-software deadpan throughout. One lightweight `pointer-events: none` CSS overlay — subtle scanline tint and vignette that *suggests* an old monitor. No curvature, no flicker.

## Tech plan

**Vanilla JS, no build step.** Native ES modules, template-literal rendering, static hosting; `python -m http.server` is the toolchain. One minimal `package.json` containing only `{"type": "module"}` (so the same files run under Node for headless testing — not a build step). Screen state machine (TITLE → OUTFITTING → MONTH → HUNT → EVENT → GAMEOVER), one `gameState` object, pure updates `(state, action, rng) → newState`, full re-render per action, one delegated click listener.

```
/src
  main.js          // boot + screen router
  state.js         // gameState shape + update dispatch
  sim/             // pure: decay.js, checks.js, effects.js, hunt.js, events-engine.js, rng.js, visible.js, engine.js, runner.js
  data/            // events.js, majors.js, incidents.js, classes.js, candidates.js, tasks.js, linkedup.js
  screens/         // title.js, outfitting.js, month.js, hunt.js, event.js, ...
  policies/        // bot strategies for the balance harness
  audio.js         // WebAudio square waves — zero asset files
  overlay.css      // simple old-monitor suggestion (tint + vignette)
```

**No DOM code in `sim/`.** Events are plain data objects with eligibility predicates and declarative effects — adding one means appending an object, never touching the engine (full schema in the economy doc). Seeded RNG (mulberry32, with serializable cursor) so runs are replayable and balance-testable headless. **Auto-save to localStorage after every applied decision** — close the tab mid-run, reopen, resume exactly; the title screen offers *Continue the year*. No backend, ever.

**Built for headless balance testing.** Two architectural rules make hundreds of automated runs possible:

- **The decision surface is data.** `pendingDecisions(state)` returns every currently-askable choice (routings, focus, event choices, store options) as plain objects. Screens render them; bot policies answer them. The human is just another policy — headless runs exercise the *real* game, so nothing can drift.
- **The hunt resolves statistically in the sim** (expected fixes from understanding, ammo, and pool). The whack-a-mole minigame is a skin modulating that baseline (±20%, clamped), so outcomes stay stat-driven and headless runs need no reflexes.

`node src/sim/runner.js --policy=pure-ai --runs=1000 --seed=42` runs the same ES modules under Node — no build step harmed. Balance targets live as executable assertions; any outlier run is a seed replayable in the browser.

## Parking lot (cut from core, maybe never)

Trailblazer Auto-play, the Understanding coverage map, the seasons/weather system, shared-tombstone backend, daily-run mode with share blocks. Good ideas that were becoming a second game. Also cut during design (see PLAN.md §1): the pace/quality sliders, reference checks, contingencies, and the separate member-burnout stat. Revisit only after the core loop is fun.
