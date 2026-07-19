# The Token Trail — Levers & Economy v3 (aligned with PLAN.md)

*The monthly loop, the stats, the event system, and the starting numbers.*

---

## The economy in one sentence

Working software converts into **monthly revenue**; payroll and tokens convert cash into **capacity**; the AI converts cash into progress faster than anything else while silently minting decay, Cognitive Debt, and hidden defects. Deployment is continuous — work ships as it lands — so the only control point is **one review capacity pool per month**, split between prevention (reviewing incoming code) and cure (hunting live bugs). Attention is the choke point; everything else is negotiable.

The temptation, mechanized: **AI tasks don't consume task slots.** Humans are capacity-limited; the AI is not. The only limit on throughput is how much of it you can review — and your hidden Understanding sets what your reviews actually catch. You can atrophy out of the ability to use your own capacity.

Every lever maps onto the five balances — 💰 Money, ⚡ Burnout, 🧠 Understanding, 🚚 Velocity, 🤝 Client happiness. The complete action-to-axis matrices are in **PLAN.md §1**; this doc holds the numbers.

---

## The monthly loop (12 turns, ~90 seconds each)

1. **Plan** — 2–3 fresh feature tasks arrive, alongside any backlog items. Route each: Self / AI / AI+Review / Assign — or let a fresh task slip to the backlog. Spend **your focus** (one per month — see below).
2. **Work resolves & ships continuously** — energy spent, skills shift, reviewed work gets filtered, unreviewed work ships raw (hidden defects + Cognitive Debt).
3. **Bug hunt** (only if your focus went to it) — the minigame. Remaining review capacity is the ammo. Fix live defects, pay down Cognitive Debt, feed Debugging skill.
4. **Event** — ~65% chance of one weighted draw from the eligible regular deck; some months pass quietly. **Quarter-end months (3, 6, 9, 12) draw a major instead** — the river-crossing set pieces (month 12 is always the Renewal Review). Live defects may also flare: incident roll scaled by the defect pool.
5. **Books** — revenue in (contract minus SLA penalties for open incident severity), payroll and tokens out, slip fees and goodwill lines itemized.

**Your focus (one per month — the wagon-stop decision).** Self-building a task consumes it. Otherwise it goes to one of:

- **Hunt** — go debugging; remaining capacity is your ammo.
- **Rest** — +30 Energy, small team-morale aura.  Oregon Trail's "rest a few days."
- **1:1** — pick a teammate: +10 morale, and they tell you how they're actually doing — **morale in words, never numbers**. (True understanding is never shown outside a check.)

Every focus is a task you didn't personally build. The AI hunt's seduction, restated: it's the only stop that doesn't cost a stop. At quarter ends the **store opens** (hire/fire, switch model) before the major hits — structural changes wait for landmarks.

## Stocks

| Stock | Visible? | Notes |
|---|---|---|
| **Money** | Yes | Starting cash + monthly revenue − payroll/tokens/fees. Below zero = **Bankruptcy**. |
| **Months** | Yes | 12. The clock. |
| **Energy (yours)** | Yes | Burned by self-work and crunch; restored by rest. Zero = **Burnout**. |
| **Client happiness** | Yes (mood face) | 0–100. Moved by slips, open incidents, lingering backlog (down); on-time months, cleared backlog, event effects (up). Zero = **Fired** — contract canceled. Adjusts Renewal Review DCs. Never gates revenue directly — money keeps its own ledger lines. |
| **Review capacity** | Yes | Per-month pool. Base 3, +2 with QA, −1 per low Energy band. Split is emergent: AI+Review routes spend it, the remainder is hunt ammo. |
| **Skills ×3** (Coding, Debugging, Judgment) | Confidence shown; **Understanding hidden** | Each has a decay floor set by how it was learned. A check is the only in-run reveal. |
| **Cognitive Debt** | Yes | +1 per unreviewed AI task. Incident damage multiplier. Paid down by review/refactor and hunting. |
| **Backlog** | Yes | Pool of slipped tasks, routable alongside fresh ones. Pressure *and* opportunity. |
| **Defect pool** | **Hidden** | Fed by skipped QA, unreviewed AI work. Feeds incidents. |
| **Team member: understanding, morale** | Hidden (mood icon only) | Moved by your routing and pace of work. Read by event predicates. Morale is their burnout meter. |

**Calibration is derived, not stored:** `100 − mean(|Confidence − Understanding|)` across the three skills. Actions "build Calibration" by converging Confidence toward truth — self-work, reviews, and check reveals (a reveal snaps Confidence 50% of the way to reality in that skill). It surfaces only at reveals, the postmortem chart, and the score.

## Routing a task (the atomic decision)

| Route | Slots | $ | Skill effect | CD | Defect risk |
|---|---|---|---|---|---|
| **Self** | 1 yours, −Energy | — | You +2 Coding (dim. above 80) | 0 | Low, scales inversely w/ your Understanding |
| **AI raw** | **0** | tokens | You −(1 + 0.5×streak) | **+1** | Full model error rate |
| **AI + review** | 0 + 1 capacity | tokens | Half decay; Judgment +1; converges Confidence | 0 | Model rate × (1 − yourUnd/120) |
| **Assign** | 1 theirs | (salary sunk) | They +3, +morale | 0 | Scales inversely w/ their understanding |

**Slip & backlog.** A fresh task left unrouted **slips**: −$250 that month ("missed commitment"), −5 client, and the task joins the visible backlog. Backlog items appear at every later Plan step and route exactly like any task — same table above, same consequences. **Clearing a backlog item: +$150 goodwill, +5 client.** Event predicates read `backlog.length`; a chronic pile makes client-anger events eligible. Since AI tasks cost no slots, the model can clear the whole pile in a month for tokens — maximum client delight, maximum Cognitive Debt.

## One pool, two spends: prevention vs. cure

Review capacity (base 3/month, +2 with QA, reduced at low Energy) is the game's single attention currency. **The split is emergent, never asked:** each AI+Review route spends a point at routing time; whatever remains is hunt ammo if your focus goes to the hunt. Every point does one of two jobs:

**Code review (prevention).** Spent on incoming AI or teammate diffs before they merge. Catches defects at a rate scaled by your relevant Understanding, prevents Cognitive Debt accrual for that work, halves your decay on AI tasks, grows Judgment (+1), and converges Confidence toward truth. This is the filter on a stream that never stops.

**Bug hunting (cure — the minigame).** Spent going into the live system after shipped defects. Rules:

- **Surfacing scales with hidden Debugging Understanding.** Bugs pop up on the code panels less often and for shorter windows at low understanding — the screen looks *calm*, not degraded, and Confidence files the session as thorough.
- **Carry limit:** you can flag more bugs than remaining capacity can fix-and-verify. Overflow returns fully to the pool (found, not fixed — no partial credit).
- **Yields:** each fixed bug removes a live defect, clears one open incident-severity point (protecting revenue — the meat), pays down Cognitive Debt, and grows Debugging (+2). Hunting is the *only* way to reduce debt on code that already shipped.

**Or delegate the hunt.** Send the AI debugging instead: tokens (≈1.5× a task), **zero capacity** — which is exactly the temptation, since it frees every attention point for review in the months you're most stretched. It closes a percentage of the live pool by model tier, but: each fix has a small chance of introducing a new *hidden* bug (you see "Closed 8 tickets," never the regression); every patch is code nobody understands (**+1 Cognitive Debt per 3 fixes**); it ticks the Debugging decay streak; and it teaches nothing. Because atrophied Debugging shrinks what you can see on future manual hunts, AI-hunting makes your own hunts blinder, which makes delegating them more rational. The atrophy spiral, localized to the cure.

The tension is the point: a point spent reviewing can't hunt, a delegated hunt quietly deepens the disease it treats, and prevention is cheaper per defect — but cure is the only option for the past.

---

## The event system (built for authoring)

Events are plain data. Adding one = appending an object to `data/events.js`. The engine (`sim/events-engine.js`) does exactly three things: filter by predicate, weighted draw, apply declarative effects.

```js
{
  id: 'recruiter-coffee',
  weight: 4,
  when: (s) => s.team.senior && s.team.senior.morale < 45,
  text: (s) => `A recruiter buys ${s.team.senior.name} a coffee.`,
  choices: [
    { label: 'Counter-offer ($1,200)',
      effects: { money: -1200, member: { senior: { morale: +20 } } } },
    { label: 'Wish them well',
      effects: { removeMember: 'senior' } },
    { label: 'Make the case yourself',
      check: { skill: 'judgment', dc: 60, target: 'you' },
      success: { effects: { member: { senior: { morale: +15 } } } },
      fail:    { effects: { removeMember: 'senior' } } }
  ]
}
```

- **`when` predicates read hidden state** — this is how decisions make the party susceptible. Burnout events unlock at low Energy and long self-work streaks; quit events at low morale; the nastiest incident templates require high CD; client-anger events read `backlog.length`, `slipped`, and `client`. Disasters are earned, never explained.
- **Effects are declarative deltas** (`money`, `energy`, `cd`, `skill`, `conf`, `member`, `defects`, `client`, `capacityDelta`, `tokensCostMult`, `flag`, `removeMember`, `endRun`). One `applyEffects(state, effects)` function; no event ever contains engine code. The effect keys double as the event's **axis declaration** — the UI derives which of the five balances each choice puts at stake and shows the icons on the choice row. No separate field, no drift.
- **Tone & magnitude:** punny titles, deadpan delivery, and per-choice caps so an event changes your month, never decides your run — the full authoring contract is PLAN.md §5. `removeMember` and `endRun` appear only behind checks or earned-state predicates.
- **Checks are optional** — many events are pure choice-and-consequence. When present, a check names a `skill`, a difficulty (`dc`), and a `target`:
  - `'you'` (default) — d100 vs. your hidden Understanding in that skill. Every such check is also a calibration reveal ("You believed / Reality").
  - A named member (`'junior'` / `'qa'` / `'senior'`) — vs. that member's single hidden understanding. Choices targeting an unhired member are never shown: outfitting silently prunes your option space all year.
  - `'team'` — vs. the **best hidden understanding in the shop**, you included. The bus-factor roll: "does *anyone* here understand this?" If the AI did all the work, the team's best is nobody.
  - A check is the **only** moment true Understanding is revealed, and only for the checked party. The reveal is a moment, not a display.
- Incidents are the same schema in a separate deck; each month the flare-up chance scales with the live defect pool (e.g., 8% per pooled defect, capped ~70%). Incident responder checks default to `'team'` — 2am pages go to whoever can answer.
- **Majors are the same schema in a third deck** (`data/majors.js`): drawn without repeats at months 3, 6, and 9, replacing that month's regular draw; month 12 is fixed (Renewal Review). Majors follow the river-crossing option shape — by hand / AI full-auto / pay / wait — and predicates steer which crossing you face: your state casts your own set pieces. Major effect caps are 2× the regular deck's.

## Incident damage

```
Severity = Base
         × (1 + 0.10 × CognitiveDebt)
         × (0.25 if responder passes d100 vs Understanding, else 1.0)
         + floor(DefectPool / 3)
```

Severity points join the **open pool**: each costs $250/month revenue (SLA) and −5 client per month while open; hunted bug fixes clear them one per fix. Cleanup (lost slots next month) is one-time. Nothing is random except when and which — every term was set by earlier decisions, so the postmortem can show the month where you actually lost.

## The Renewal Review (month 12, fixed)

Three checks — Coding (you), Judgment (you), and a bus-factor question (team) — at `dc = base + 2 × CD ∓ clientMod` (±10 when client is at the extremes). Pass 2 of 3 → contract renewed (**The Qualified Human**); fail → **The Impostor**. Every check shows the calibration reveal. No money can buy past it.

---

## Outfitting (the general store)

Two clean decisions: **who to hire** and **which model.**

**Candidates, not archetypes.** Each run seeds two candidates per role from `data/candidates.js` (names, traits, and the RNG). A candidate is:

- **Salary** (monthly): Junior $150–250 · QA $200–300 · Senior $350–500.
- **Claimed understanding** (the resume — visible): Junior 20–40 · QA 40–60 · Senior 55–80.
- **True understanding** (hidden): claimed **− 5 ± variance** (±10 junior/QA, ±15 senior). Resumes average five points optimistic — they're calibrated exactly like Confidence bars. Pillar 2 is live before month one. There is no way to buy the truth; the first check is the first reveal.
- **One trait** (visible, plain data, predicate hooks): *flight risk* (recruiter events weighted up), *quick study* (+growth per task), *steady under pages* (+10 on incident checks), *inflated resume* (rare: claimed far above true — undiscoverable until a check exposes them).

**The model is the fourth hire:**

| Model | Per task | Error rate | Error subtlety | Deprecation risk |
|---|---|---|---|---|
| Budget | $50 | 25% | Obvious — review catch +10% | Low (old and stable) |
| Standard | $100 | 15% | — | Medium |
| Frontier | $200 | 8% | Subtle — review catch −10% | **High** |

The frontier trap: fewer errors, but the ones that exist slip past review — and polished output makes reviewing *feel* pointless, feeding the decay loop. Deprecation-event weight scales with tier. Switching models is allowed at quarter ends and costs one task slot (retooling).

**Burn rate, not a pile.** Salaries and revenue are both monthly: outfitting chooses a monthly burn against income the SLA can cut at any time. A full team on Craftsperson cash ($2,500) is underwater after one bad month — which is exactly why skipping hires feels rational, with the usual silent bet attached.

---

## Baseline numbers (v0.3 — tune from here)

**Classes** — cash / (Coding, Debugging, Judgment) / quirk / multiplier:

| Class | Cash | C / D / J | Quirk | Mult |
|---|---|---|---|---|
| Vibe Coder | $8,000 | 30 / 20 / 25 | Frontier tokens included | ×1.0 |
| Bootcamp Grad | $5,000 | 40 / 35 / 35 | +1 capacity | ×1.5 |
| Greybeard | $4,000 | 70 / 75 / 65 | Tokens cost +25% (distrust tax) | ×2.0 |
| Craftsperson | $2,500 | 60 / 60 / 70 | High floors (deep learning) | ×2.5 |

**Money:** contract pays **$2,500/month**, minus $250 per open incident-severity point (SLA). Slip fee −$250; backlog-clear goodwill +$150. Salaries and token costs: see Outfitting. **AI hunt:** 1.5× task token cost per outing; closes 40% / 55% / 70% of the live pool by tier; regression chance 15% / 10% / 6% per fix (hidden); +1 CD per 3 fixes; ticks Debugging decay. Contractor (ferry): $1,000.

**Client happiness:** starts at **70**, clamped 0–100. Per month: −5 per slip, −5 per open incident-severity point, −1 per backlog item lingering, +2 for an all-shipped month, +5 per backlog item cleared; plus event `client` effects. Renewal DC mod: −10 at client ≥ 75, +10 at client ≤ 35. Zero = Fired (engine death).

**Tasks:** Easy / Medium / Hard — self-cost −5/−10/−15 Energy; Hard risky below Und 60 and AI error ×1.5. 2–3 tasks/month; unrouted tasks slip to the backlog (see Routing).

**Skill dynamics:** self +2 Coding (diminishing >80); hunting +2 Debugging; reviewing +1 Judgment; delegate −(1 + 0.5×consecutive streak in that skill), floored; rust −0.5/month unused. Floors: 40 if learned by doing (or Craftsperson start), 0 if learned by watching. Confidence +1 per shipped success by any route; converges toward Understanding only through self-work, review, and reveals. **Junior title bumps** at understanding 30 ("Developer") and 50 ("Mid-level") — one line in the month log, so the compounding is felt.

**Hunt session:** 45-second timer. The whack-a-mole skin modulates the statistical baseline by at most ±20%, clamped.

## Balance targets

- **Headline: a strong deterministic bot playing only from visible information wins ~30% of seeds** (assert 25–35% over 1,000 runs). Win = alive at month 12 and Renewal Review passed.
- Optimal play ≈ **60–70% AI usage with full capacity spend** — the qualified human wins on points.
- Pure AI-raw runs cruise until ~month 8, then fail the Renewal Review ≥90% of the time.
- Pure-self runs go bankrupt ~80% of the time (Greybeard best odds; winnable as a challenge run).
- No-QA feels fine for a quarter; the defect pool bill arrives mid-year.
- Median first run: death. Median third: The Impostor. The Qualified Human takes deliberate play.

## Tuning knobs & the balance harness

One `config.js`: months, tasksPerMonth, eventChance, majorMonths, capacityBase, decayBase, decayAccel, rustRate, growthRates, errorRates, subtletyMods, deprecationWeights, resumeBias, resumeVariance, cdCoef, slaPerSeverity, contractMonthly, salaryBands, tokenCosts, floors, energyBands, slipFee, goodwillBonus, clientStart, clientDeltas, renewalClientMod, huntTimer, eventEffectCaps.

**The harness.** `sim/` is pure and every decision is a data object, so a bot can play the whole game:

- `policies/` — strategy archetypes as functions `(visibleState, pendingDecision, rng) → choice`: `pure-ai`, `pure-self`, `qualified`, `no-qa`, `random`.
- `node src/sim/runner.js --policy=X --runs=1000 --seed=42` — each run emits a summary record (ending, death cause, month of death, final hidden stats, money curve); the runner aggregates distributions.
- **Balance targets are assertions** (`test/balance.test.js`): the targets above become executable checks. Change a number in `config.js`, run the suite, see which promises broke.
- **Seed replay:** any pathological run is a seed — replay it in the browser and watch the failure month by month.

## Formerly open questions — all resolved (PLAN.md §1)

Capacity split is emergent (no commit step); found-but-uncarried hunt bugs return fully to the pool; the Junior gets visible title bumps; unreviewed teammate code accrues no Cognitive Debt in v1.
