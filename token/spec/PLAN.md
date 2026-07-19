# The Token Trail — Implementation Plan (v1)

*The build authority. The four spec docs were aligned to this plan on 2026-07-19 — they carry the design detail and voice; if a residual conflict is ever found, this plan wins. Written for implementation by Opus sub-agents; every work package has a hard "done when."*

**Sources (all aligned):** `token-trail-design-doc.md` (what the game is) · `token-trail-economy.md` (numbers, schemas, balance targets) · `token-trail-build-plan.md` (engineering detail: state shape, policy heuristics, commit order) · `token-trail-ui-spec.md` (screens, art direction).

---

## 1. Locked decisions

Confirmed with Tony 2026-07-19:

| Decision | Call |
|---|---|
| Balance harness | **Full** — 5 bot policies, 1,000-run assertion suite, config tuned before UI polish. |
| Hunt minigame | **Whack-a-mole ships in v1**, as a skin over the statistical resolution. |
| Office scene | **Full animated scene per the UI spec** (revised 2026-07-19 — animation is state communication, not feature creep): typing speed tied to pace, pose swaps, monitor glow, seasonal window. CSS `steps()` on transforms only; no canvas, no rAF outside the hunt timer. |
| Terminology | **"Competence" is renamed "Understanding"** throughout the game, code, this plan, and the four spec docs (Tony, 2026-07-19). The pillars restate cleanly: Confidence (shown) vs. hidden Understanding (the truth); Cognitive Debt is the *system-level* inverse — the share of the codebase nobody understands; the team check is literally "does anyone here understand this?" Code uses `und` where specs sketched `comp`. |
| Death screen | **Not a tombstone — a LinkedUp post** (Tony, 2026-07-19). A cartoony, stylized LinkedIn-parody card with a **LinkedUp** header (original wordmark and styling — parody, not a clone of LinkedIn's actual branding). Structure: class portrait as avatar, name + title, timestamp ("Month 8"), post body in chirpy LinkedIn-announcement voice ("Thrilled to share I'm exploring new opportunities…"), the **cause line in clinical deadpan beneath** ("Cause: cognitive surrender."), and a small reactions row. The post body types itself in — Oregon Trail's epitaph ritual, preserved in the new fiction. `data/epitaphs.js` becomes `data/linkedup.js`: death-post copy per cause, same plain-data authoring as events. |
| Understanding reveals | **A check is the only moment true Understanding is revealed, and only for the checked party** — you (in the checked skill), the named member, or whoever answered a team check. The reveal is a moment, not a display: it shows on the resolution card and enters the log, then the number goes dark again (Understanding keeps drifting). Nothing else in-run ever prints a Understanding number — the 1:1 focus gives morale **in words, never numbers**, and member cards never show true understanding. One boundary case, outside the run: the post-run postmortem chart (the ending is always a mirror). |
| Outfitting | **Simplified — the reference check is cut entirely** (Tony, 2026-07-19: too much at the outset). Outfitting is two clean decisions: **who to hire** (two candidates per role; salary, trait, and claimed-understanding resume visible — the truth stays hidden until a check reveals it) and **which model tier**. **Contingencies are cut too** — they were never mechanically specified in any doc. Consequences: `referenceCheckCost` drops from config, `contingencies` drops from the state shape, the quarter store sells only hires and model switches, and the qualified bot hires from resumes and salaries alone. Resume bias/variance stay — resumes are still Confidence artifacts. |

Economy doc open questions, resolved per its own leanings (revisit only after playtesting):

1. **Review capacity splits emergently — there is no commit step** (supersedes the economy doc's "test committed first" lean; see the complexity pass below). Each AI+Review route spends 1 capacity at routing time; whatever remains is hunt ammo if your focus goes to the hunt. Same prevention/cure tension, zero added decisions.
2. **No partial credit** for found-but-uncarried hunt bugs — overflow returns fully to the pool.
3. **Junior gets a visible title bump** at understanding thresholds (30 → "Developer", 50 → "Mid-level"). One line in the month log; makes compounding felt.
4. **No Cognitive Debt for unreviewed teammate code** in v1.

Additional calls made here (flag to Tony if any feels wrong, don't silently change):

- **Event predicates stay as JS functions** (`when: (s) => ...`). Tony edits JS comfortably; functions beat a declarative condition language for flexibility, and the schema test guards against breakage.
- **A minimal `package.json` with `{"type": "module"}` and nothing else is required** — Node treats extensionless `.js` as CommonJS otherwise, and the same files must run in browser and Node. Zero dependencies still; this is not a build step.
- **Renewal Review mechanic (month 12):** three checks — Coding (target: you), Judgment (target: you), and a bus-factor question (target: team) — with DCs raised by Cognitive Debt and adjusted by Client happiness (`dc = base + 2 × CD ∓ clientMod`, ±10 at the extremes). Pass 2 of 3 → renewed. Every check shows the calibration reveal.
- **Scoring (v1 placeholder, tune in Phase 4):** `(money/100 + sum(hiddenUnderstanding) + 25×teamMembersRetained + calibrationBonus + client/2 + endingBonus) × classMultiplier`. Ending bonus: Qualified Human +200, Impostor +0, others n/a.
- **Auto-save to localStorage; no backend, ever.** The full `gameState` is serialized after every applied decision and month close. The title screen shows *Continue the year* when a save exists; finishing or abandoning a run clears it. One save slot. Top Ten scores are localStorage too — nothing leaves the browser.

**Second-pass ambiguity sweep (2026-07-19)** — five places the specs left a mechanic undefined, resolved here so agents don't resolve them differently. Flagged for Tony's review:

- **Calibration is derived, not a fourth trained stat:** `100 − mean(|Confidence − Understanding|)` across the three skills. Spec phrases like "+Calibration" mean *convergence*: self-work, reviews, and check reveals pull Confidence toward hidden Understanding (a reveal snaps Confidence 50% of the way to reality in that skill). Surfaces only in reveals, the postmortem chart, and `calibrationBonus` in scoring.
- **The backlog is a workable pool, not just pressure** (revised per Tony, 2026-07-19). An unrouted task slips into the backlog: a one-time −$250 "missed commitment" line in that month's books, and the task joins a visible pool. From then on, backlog items appear alongside the fresh tasks at every Plan step and **route exactly like any task** — point yourself, a teammate, or the AI at them, with all the usual consequences of that route (energy, tokens, skill growth or decay, Cognitive Debt, defects). No new mechanics: a backlog card is a task card with a ⏳ mark. **Clearing backlog makes the client happy:** a +$150 goodwill line in the books per cleared item, and the pressure it exerted goes with it. Event predicates read `backlog.length` — a chronic backlog makes client-anger events eligible, and since AI tasks cost no slots, the model can chew through the whole pile in a month for tokens: velocity heaven, understanding hell. The trap, self-serve.
- **SLA penalties recur until cured:** incidents add points to a live **severity pool**; monthly revenue = `contractMonthly − slaPerSeverity × pool`, floored at $0 (pool capped in config). Each bug fixed in the hunt clears a live defect *and* one severity point — hunting literally restores revenue, the meat metaphor mechanized. Incident cleanup (lost slots next month) remains one-time.
- **Ending conditions:** engine-level deaths only for the three mortal meters — Bankruptcy (money < 0 at Books), Burnout (energy ≤ 0), and Fired (client ≤ 0, contract canceled). All other deaths (Everyone Quit, the Outage You Couldn't Solve) arrive via the `endRun` effect key in event data — new deaths are authorable without engine changes. Month 12: renewal passed → **Qualified Human**; failed → **Impostor**. **The Purist** is a LinkedUp-post variant of Bankruptcy (high hidden Understanding, low AI usage), not a separate mechanic.
- **Skill↔work mapping:** **Coding** grows from self-building tasks; **Debugging** from hunting; **Judgment** from reviewing diffs (+1 per review) and surviving event checks. Rust (−0.5/month) hits whichever skills went unused that month. (Without this, Judgment would have had no growth path.)

**Complexity pass (2026-07-19).** Tony's directive: the player's work should be **(a) reacting to events** and **(b) balancing understanding/understanding against velocity and reliability (bugs)**. Every system was audited against that bar — anything that was a second dial for a decision the core loop already makes got cut:

- **Both sliders are cut** (Pace and Quality bar — the pace/rations homage loses to focus). Each duplicated the core dial: choosing Self vs. AI vs. AI+Review *is* the quality decision, and routing work to the AI *is* the throttle. Their effects fold into the routing table's existing numbers. Consequences: no "Change pace or quality" menu item; no second-focus-at-grueling rule; no Leisurely energy trickle (Rest is the energy lever); crunch/burnout event predicates read Energy, self-work streaks, and backlog size instead of a pace setting.
- **The capacity-commit step is cut** (see resolution 1 above) — the prevention/cure split is emergent from routing + focus, never asked as its own question.
- **The member burnout stat is cut** — members carry two hidden stats (understanding, morale), not three. Burnout-flavored team events predicate on low morale plus sustained workload. *You* still burn out (Energy ≤ 0); teammates just quit.
- **What survives, and why:** task routing (the core balance), the one focus (the wagon-stop decision), review capacity (the attention economy), Energy (the cost of doing it yourself), Cognitive Debt, hidden defects + open-incident severity (reliability), three skills, member morale, the backlog (velocity pressure *and* a workable pool — see the sweep), model tier, quarter store. Each feeds one of the two core jobs.

**The monthly loop after the pass:** route 2–3 tasks → spend your one focus → react to what the deck brings → books. Two decision moments plus the event. All remaining depth lives in the routing tradeoff and the decks — which is exactly where Tony will be editing.

**The five balances (Tony's design compass, 2026-07-19).** Every meaningful decision should trade at least two of these against each other — that's the test for every event, major, and tuning change:

| Axis | Lives in | Moved by |
|---|---|---|
| **Understanding** (hidden) | Your three skills + each member's hidden stat; Cognitive Debt is its system-level inverse | Built by self-work, review, and hunting; eroded by delegation streaks and rust |
| **Money** (visible) | Cash against monthly burn | Contract in; payroll + tokens out; SLA penalties, slip fees, goodwill lines |
| **Burnout** (yours visible, theirs hidden) | Your Energy; member morale | Self-work and crunch down; Rest and 1:1s up |
| **Velocity** (visible) | Tasks shipped vs. slipped; the backlog | Routing volume — the AI sells unlimited velocity, priced in Understanding |
| **Client happiness** (visible — **new stat**) | `client`, 0–100, a client mood face in the status strip (replacing the `SLA ✓` slot — the face *is* the relationship readout) | Slips, open incidents, and lingering backlog down; on-time months and cleared backlog up; events via the `client` effect key |

Client happiness mechanics, kept deliberately light: event predicates read it (anger and contract-trouble events become eligible as it sinks), it adjusts Renewal Review DCs (±10 at the extremes, knob), and it feeds the score. It does **not** gate revenue directly — money keeps its own explicit ledger lines (SLA, slip fees, goodwill), which is what keeps the books interesting. It consolidates the client-relationship signals that were previously smeared invisibly across fees and predicates into one legible axis.

**The complete mapping — every lever hits the five axes (2026-07-19).** The five are not five among many; they are the whole game. Two design laws, schema-enforced where possible:

1. **Every player action, decision, and check moves at least one axis.** Anything that touches none is dead weight — cut it.
2. **Every axis has an up-lever, a down-pressure, and a failure mode.**

Icons used throughout the UI and this plan: 💰 Money · ⚡ Burnout · 🧠 Understanding · 🚚 Velocity · 🤝 Client. ⏱ marks effects that arrive later, through the defect pool, incidents, and the decks.

*Routing & work (the Plan step):*

| Action | 💰 | ⚡ | 🧠 | 🚚 | 🤝 |
|---|---|---|---|---|---|
| Build it yourself | — | −Energy | you ↑ (Coding) | uses your slot | reliable ⏱ |
| AI raw | −tokens | — | you ↓ (decay, +CD) | ↑↑ (no slot) | defect risk ⏱ |
| AI + review | −tokens | — | protected; Judgment ↑ | ↑ (1 capacity) | filtered ⏱ |
| Assign to teammate | (salary sunk) | their morale ↑ | their und ↑ | their slot | scales with their und ⏱ |
| Slip a task | −$250 | — | — | ↓ | ↓ |
| Clear a backlog item | +$150 | (per route) | (per route) | ↑ | ↑ |
| Review a diff (capacity) | — | — | Judgment ↑; CD prevented | — | defects filtered ⏱ |

*Focus (one per month):*

| Focus | 💰 | ⚡ | 🧠 | 🚚 | 🤝 |
|---|---|---|---|---|---|
| Build it yourself | — | ↓ | ↑ | the focus is the slot | ⏱ |
| Hunt (manual) | — | — | Debugging ↑; CD ↓ | — | ↑ (closes incidents, restores SLA) |
| Hunt (AI, no focus cost) | −tokens ×1.5 | — | ↓ (decay, +CD, hidden regressions) | — | ↑ now, risk ⏱ |
| Rest | — | ↑↑ (+morale aura) | rust risk | — | — |
| 1:1 | — | their morale ↑ | — | — | — |

*Structural (outfitting & quarter store):*

| Choice | 💰 | ⚡ | 🧠 | 🚚 | 🤝 |
|---|---|---|---|---|---|
| Hire | −salary/mo | — | team und pool ↑ | +slots (+capacity if QA) | steadier ⏱ |
| Fire | +salary/mo | survivors' morale ↓ | team pool ↓ | −slots | — |
| Model tier ↑ | −$/task | — | subtler errors — reviews catch less | error rate ↓ | fewer visible defects ⏱ |

*Checks:* every check is a d100 against hidden Understanding — yours, a member's, or the shop's best. Success protects whatever the event put at stake; a check targeting you always recalibrates Confidence. Checks are where Understanding, invisible all month, cashes out.

*Failure modes — one per axis:*

| Axis | How it ends a run — or takes a teammate |
|---|---|
| 💰 Money | **Bankruptcy** — engine death; money < 0 at Books. |
| ⚡ Burnout | **Burnout** — engine death; your Energy ≤ 0. For teammates, morale is their meter: starved of real work, overloaded, or bypassed by the AI, low morale unlocks quit / recruiter / exodus events. Members are lost to the axes one predicate at a time. |
| 🤝 Client | **Fired** — engine death (new, completing the set); client ≤ 0 and the contract is canceled. |
| 🧠 Understanding | Never kills directly. It fails you at the **Renewal Review** (Impostor), multiplies every incident through CD, and blinds your hunts. The late bill. |
| 🚚 Velocity | Never kills directly. It bleeds 💰 (slip fees) and 🤝 (anger events) until one of *them* does. |

**Win = keep the three mortal meters (💰 ⚡ 🤝) alive for twelve months, then pass the Renewal Review — a 🧠 exam, adjusted by 🤝.** The two axes that can't kill you are the two that decide whether surviving meant anything. That's the game's argument, in mechanical form.

**Events declare their axes by construction.** An event's `effects` and `check` *are* its declaration: the fixed effect-key → axis mapping (`money`→💰 · `energy`, `member.morale`→⚡ · `skill`, `cd`, `conf`→🧠 · `defects`→🤝⏱ · `client`→🤝 · `removeMember`→⚡🚚) lets the UI derive small axis icons for every choice row, so the player always sees *which* of the five a choice puts at stake — never the exact numbers. No separate authoring field, no drift possible. The schema test asserts every choice touches at least one axis.

## 2. Scope guardrails — do NOT build

**The discipline is about the game, not the engineering.** The harness, tests, and pure-sim rigor are in scope and non-negotiable — they're what keeps the game correct and tunable. What's out is adding to the *game itself*: no new mechanics, stats, resources, screens, decision types, or systems beyond what this plan specifies. The specs define a complete game; build exactly that game.

- Anything in the design doc's parking lot (auto-play, coverage map, weather, shared tombstones, daily-run mode).
- No frameworks, no npm dependencies, no build step, no canvas. (The rest of this repo uses Vue; this app deliberately does not.)
- No sound files — WebAudio square waves only, behind a mute toggle, initialized on first user gesture.
- No mid-run difficulty selection, no settings screen beyond mute.
- Sub-agents: do not add systems, stats, or screens not in this plan — and do not invent "nice to have" game content (extra endings, extra resources, tutorial modes, achievements). If a spec doc mentions something this plan omits, it's omitted on purpose. New *events* within the existing schema are welcome; new *mechanics* are not.

## 3. Run-length budget (15–20 min)

12 turns × ~90s. Enforced by design, verified in playtesting:

- Plan step: 2–3 route taps (+ any backlog items you choose to route) + 1 focus tap.
- Books screen auto-advances after 3s (tap to skip).
- Hunt session timer: **45 seconds** fixed.
- Event cards: one read + one tap; resolution on the same card.
- Quarter store: optional, skippable with one tap.

If a playtest run exceeds 20 minutes, cut waiting/transition time, never decisions.

## 4. Architecture

Everything from the design doc's tech plan, with these boundaries treated as law:

1. **`src/sim/` never touches the DOM.** Pure functions, `(state, action, rng) → newState`.
2. **All randomness flows through the seeded RNG** (mulberry32). Same seed → same run, in browser and Node.
3. **The fair-bot boundary:** `visibleState(state)` strips Understanding, Calibration, the defect pool, and member internals (mood icon stays). Policies receive only the projection; screens render only the projection. One function enforces honest balance and no-leak UI.
4. **The decision surface is data.** `pendingDecisions(state)` returns every currently-askable choice as plain objects; `applyDecision(state, decisionId, optionId, rng)` answers one. The human is just another policy.
5. **The hunt resolves statistically in the sim.** The minigame skin modulates the formula's expected fixes by **±20%, clamped** — twitch skill matters, stats rule, and headless runs use the baseline.
6. **`gameState` is plain JSON-serializable data** — no functions, no class instances, no Dates. This is what makes auto-save a one-liner (`JSON.stringify` after every decision) and the drift test possible. The RNG exposes `getState()`/`setState()` so its cursor serializes into the save; a resumed run continues its seed exactly.

### File tree

```
/token
  index.html            // <script type="module" src="./src/main.js">
  package.json          // {"type": "module"} — nothing else
  styles.css            // layout + EGA palette vars
  overlay.css           // scanline tint + vignette, pointer-events: none
  config.js             // every tuning knob (economy doc §Tuning knobs)
  /src
    main.js             // boot + screen router (state machine)
    state.js            // gameState shape, initState(classId, hires, model, seed)
    audio.js            // WebAudio square-wave beeps
    /sim
      rng.js            // mulberry32 + d100, pick, shuffle, range
      engine.js         // pendingDecisions, applyDecision, month pipeline
      decay.js          // skill growth/decay/rust/floors/streaks
      checks.js         // d100 vs hidden comp; you/member/team targets
      effects.js        // applyEffects — the ONE function events touch
      events-engine.js  // filter by predicate → weighted draw → apply
      hunt.js           // statistical hunt resolution (surfacing, carry, yields)
      visible.js        // visibleState projection
      runner.js         // headless: node src/sim/runner.js --policy=X --runs=N --seed=S
    /policies
      random.js  pure-ai.js  pure-self.js  no-qa.js  qualified.js
    /data
      events.js majors.js incidents.js      // ← the files Tony edits
      classes.js candidates.js tasks.js linkedup.js
    /screens
      title.js profession.js outfitting.js month.js assign.js
      focus.js hunt.js event.js store.js books.js gameover.js
  /test
    rng.test.js sim.test.js schema.test.js drift.test.js balance.test.js
```

### Frozen interfaces (agents must not change without updating this plan)

**gameState** — the full aligned shape is in build-plan Phase 1: includes `client`, `backlog` (slipped tasks, routable), `slipped`, `openSeverity`, `history` (monthly `{month, conf, und, money, cd, client}` snapshots for the postmortem chart), `flags`, and the serializable RNG cursor; no slider, contingency, member-burnout, or stored-calibration fields.

**Decision object** (what `pendingDecisions` returns):

```js
{ id: 'route-task-2',            // unique within the current phase
  kind: 'route' | 'focus' | 'event' | 'store' | 'outfit',
  prompt: 'Route: Payment retry logic (Medium)',
  options: [ { id: 'self', label: 'Do it yourself', disabled: false, detail: '−10 Energy' }, ... ] }
```

**Legal effect keys** (exhaustive; `applyEffects` throws on anything else, schema test enforces):
`money, energy, cd, skill: {coding|debugging|judgment: ±n}` (moves Understanding; Confidence moves by its own rules), `conf: {…}` (rare, Confidence directly), `member: {junior|qa|senior: {morale, comp, burnout}}`, `removeMember, defects` (±n or `{add: {severity, provenance}}`), `client: ±n`, `capacityDelta` (next month), `tokensCostMult` (this month), `flag: 'name'`, `endRun: 'cause-id'`.

## 5. Event authoring (the thing Tony will actually touch)

The whole point of the architecture: **editing what happens in the game = editing three data files.** Each file opens with a `HOW TO ADD AN EVENT` comment block documenting the schema inline.

- `data/events.js` — the regular monthly deck (~12 at launch). Fields: `id, weight, when(s), text(s), choices[]`. Each choice: `label`, optional `cost`, either `effects` or a `check: {skill, dc, target}` with `success`/`fail` branches. Full example in economy doc §Event system.
- `data/majors.js` — the quarter-end set pieces (4 + fixed Renewal Review). Same schema plus `slot: 'q1'|'q2'|'q3'|'any'` hints via predicates; drawn without repeats at months 3/6/9. Choices follow the river-crossing shape: by hand / AI full-auto / pay / wait.
- `data/incidents.js` — flare-ups (~6). Same schema; monthly flare chance = `min(0.08 × defectPool, 0.70)`; responder checks default to `target: 'team'`; severity formula per economy doc §Incident damage.

**Tone & magnitude (2026-07-19).** The decks ship seeded with fun, punny, theme-appropriate events — sub-agents author them; these rules keep them on-register and on-scale:

- **Register: punny titles, deadpan delivery.** The joke lives in the title and the setup; consequences read clinical. The game never lectures — the systems argue the thesis. Canon samples to match: *Merge Conflict of Interest* (senior and QA feud publicly), *Prompt and Circumstance* (model deprecated overnight, your prompts are ruins), *Token Gesture* (vendor offers free credits — with strings), *Regression to the Mean* (an AI fix quietly reopens an old bug), *Cache Cow* (the client's pet feature is just caching), *Schrödinger's Deploy* (nobody can say whether it shipped). The design doc's §Event deck lines remain canon for voice.
- **Impactful, never swingy — magnitude caps, schema-enforced.** Per choice in the regular and incident decks: `money` ±$800, `energy` ±20, any one `skill` ±5, `cd` ±2, `defects` ±3, `client` ±15, member `morale` ±20. Majors get 2× (they're the set pieces). An event should change your month and nudge your year — never decide the run by itself.
- **The big guns are earned, not drawn.** `removeMember` and `endRun` never hang on an unconditional choice in the regular deck — only as check-fail outcomes, or behind predicates requiring accumulated state (sunk morale, high CD, a soured client). Dramatic swings come from the player's trajectory, never from a single roll of the dice.

**Safety net:** `test/schema.test.js` walks all three decks — every predicate callable against a sample state without throwing, every effect key legal, every check skill/target real, every weight positive, all ids unique, majors deck covers months 3/6/9 under any predicate outcome (no empty draw possible), every choice's effects/check touching at least one of the five axes, every effect inside the §5 magnitude caps (2× for majors), and `removeMember`/`endRun` appearing only behind checks or earned-state predicates. A bad edit fails `node --test`, not a live run. This test is the contract that keeps event editing safe.

## 6. Work packages

Sized for Opus sub-agents. Interfaces in §4 are frozen up front, which is what makes the parallel tracks safe.

### WP0 — Scaffold *(sequential, small)*
`index.html`, `package.json`, `config.js` (every knob from economy doc §Tuning knobs *minus cut systems* — no slider, quality-bar, reference-check, or contingency knobs; baseline v0.2 numbers), `src/sim/rng.js`, `test/rng.test.js`.
**Done when:** `node --test test/` passes determinism tests (same seed → same sequence; d100 distribution sanity).

### WP1 — Pure sim core *(sequential; the keystone)*
`state.js`, `sim/decay.js`, `sim/checks.js`, `sim/effects.js`, `sim/visible.js`, `sim/hunt.js`, `sim/events-engine.js`, `sim/engine.js` with the month pipeline: `plan → resolveWork → resolveHunt → maybeEvent → settleBooks → advanceMonth`. Stub content (1 class, 2 events, 1 major) to exercise the pipeline. RNG gains `getState()`/`setState()` for save serialization.
**Done when:** unit tests cover decay curves/floors/streak acceleration, check target resolution (team = best in shop; choices naming unhired members are pruned), effects application incl. illegal-key throw, hunt formula (surfacing scales with hidden Debugging, carry limit, AI-hunt regression seeding), and a scripted 12-month run completes headless.

### WP2 — Content decks *(parallel with WP3 after WP1)*
All of `/data`: 4 classes, candidate generator (resume = true − 5 ± variance, 4 traits), task generator, ~12 regular events, 4 majors + Renewal Review, ~6 incidents, LinkedUp death-post copy per cause (`linkedup.js`). Writing per §5 Tone & magnitude — punny titles, deadpan delivery, effects inside the caps; the design doc's §Event deck lines and the §5 canon samples set the voice.
**Done when:** `test/schema.test.js` passes; every deck entry reachable (at least one seed/state satisfies each predicate — assert via targeted state fixtures).

### WP3 — Harness & policies *(parallel with WP2 after WP1)*
`sim/runner.js` (per-run records: ending, death cause, month of death, final hidden stats, money curve; aggregate report; `--csv`; `--sweep knob=v1,v2,v3`). Five policies against `visibleState` only, per build-plan Phase 3 heuristics — minus the cut systems (§1): no reference checks (`qualified` hires from resumes and salaries alone), no pace/quality moves. `qualified` is deterministic.
**Done when:** all five policies complete 1,000 runs without error; report prints ending/death distributions and month-of-death histograms.

### WP4 — Balance tuning *(sequential, after WP2+WP3; timeboxed)*
`test/balance.test.js` encodes the promises: qualified wins 25–35%; pure-ai reaches month 12 ≥60% but passes renewal ≤10%; pure-self fails 75–85% (Greybeard best); no-qa tracks qualified through Q1 then diverges; random ≤5%; no single death cause >50% of qualified losses. Tune `config.js` only.
**Done when:** balance suite green, config committed as v1. **Timebox: if targets prove mutually unreachable after a bounded sweep effort, adjust the offending band, document why in a comment above the assertion, and flag it for Tony's review — do not thrash.**

### WP5 — UI shell *(parallel with WP4 after WP1; integrate on locked config)*
Router + all screens as templates over `visibleState` + `pendingDecisions`, per UI spec, adjusted for the §1 cuts (no reference-check button, no contingencies category, no "Change pace or quality" menu item or slider UI; a client mood face replaces the `SLA ✓` strip slot): fixed 640×400 logical stage with `--px` scaling, mobile portrait reflow, numbered-menu rows ≥44px, number keys + Enter on desktop, status strip with tap-to-explain, ledger Books screen, event cards with calibration reveals and derived axis icons on choice rows (§1 mapping), quarter store, LinkedUp death post (per §1 — parody card, typed-in body, deadpan cause line) + postmortem (SVG Confidence-vs-Understanding line chart from `state.history`, "month you lost" marker), Top Ten in localStorage. Auto-save after every applied decision (state + RNG cursor to localStorage); title screen offers *Continue the year* when a save exists; run end clears it. Hunt screen is a placeholder button (formula + results text) in this package.
**Done when:** a full run is playable start to finish in the browser; closing the tab mid-run and reopening resumes exactly where you left off; and `test/drift.test.js` passes — a recorded browser run's decision log replays headless to an identical final state.

### WP6 — Hunt skin, office scene, audio, polish *(after WP5)*
- **Whack-a-mole:** grid of code panels (2×3 mobile, 3×3 desktop), plausible dimmed pseudo-code, chunky SVG bug glyphs on timed windows, ammo pips, 45s timer, tally. Spawn frequency/window from hidden Debugging Understanding; density follows defect provenance (bugs cluster in unreviewed modules). Performance modulates the statistical baseline ±20% clamped. `prefers-reduced-motion`: timers stay, shake/flash drops.
- **Office scene (full, per UI spec):** SVG office with pose swaps that leak hidden state (slumped = burnout, phone-scrolling = the AI is doing their work, empty chair + boxes = never hired, chair still spinning = just quit), typing animation with speed driven by the pace slider (CSS `steps()`, duration from a var), monitor glow by model activity, seasonal window per quarter. `prefers-reduced-motion`: animations settle to stills. The scene is a pure function of `visibleState` — decorative truth, never the only truth (mood faces in the strip mirror what posture shows).
- **Audio:** square-wave beeps (menu tick, bug fixed, event sting, month-close stamp, death dirge). Mute toggle, persisted.
- `overlay.css`, EGA palette vars, Web437-style webfont with monospace fallback.
**Done when:** hunt is playable by touch and mouse; a reduced-motion run works; full run stays inside 15–20 min; drift test still green (skin never touches sim state except through the clamped modifier).

### WP7 — Ship *(small)*
Add The Token Trail card to the root `index.html` (match existing site pattern). Final manual playthrough checklist: one death run, one Impostor run, one win attempt; mobile portrait + desktop.

**Critical path:** WP0 → WP1 → {WP2 ∥ WP3} → WP4 → WP6-integration. WP5 starts right after WP1 in parallel. Suggested agent allocation: one agent each for WP2, WP3, WP5 concurrently after WP1 lands.

## 7. Testing summary

| Test | Guards |
|---|---|
| `rng.test.js` | Determinism, distribution sanity |
| `sim.test.js` | Decay/floors/streaks, checks, effects, hunt math, month pipeline |
| `schema.test.js` | **Every future event edit Tony makes** |
| `balance.test.js` | The fun-shape promises (1,000-seed batches) |
| `drift.test.js` | Browser and headless never diverge |

All via `node --test test/` from `/token`. No CI config needed; it's the pre-commit ritual.

## 8. Risks & watch-outs

- **Balance targets may fight each other** (e.g., pure-self 75–85% failure vs. Greybeard "winnable as challenge run"). Mitigation: WP4 timebox + documented band adjustments.
- **The 30% qualified win rate is a feel, not a law.** If tuning lands at 35–40% and runs feel tense, prefer feel; update the assertion with a comment.
- **Hunt skin leaking into balance:** the ±20% clamp is load-bearing — assert it in `sim.test.js`.
- **Confidence/Understanding bookkeeping is the subtlest code in the game** (two parallel skill tracks with different update rules). It gets the densest unit tests and lives entirely in `decay.js`.
- **Scope creep via the spec docs themselves** — they're rich, and agents will be tempted. §2 is the answer.
