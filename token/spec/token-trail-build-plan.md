# The Token Trail — Build Plan (aligned with PLAN.md)

*Engine and tester first. Screens land on numbers that already hold up.*

**PLAN.md §6 is the authoritative work-package breakdown (WP0–WP7) with agent orchestration and "done when" criteria; this doc keeps the engineering detail behind it — state shape, policy heuristics, commit order.**

**North star:** a strong deterministic bot, playing only from visible information, wins **~30% of seeds** (assert 25–35% over 1,000 runs). Win = alive at month 12 **and** the Renewal Review passed. The Impostor ending (survived, failed renewal) is not a win.

---

## Ground rules

- Vanilla JS, native ES modules, no build step. Browser dev via `python -m http.server`; headless via Node ≥ 18 (same modules, untouched). One minimal `package.json` containing only `{"type": "module"}` — required so Node treats `.js` as ESM; not a build step, still zero dependencies.
- Tests use `node:test` + `assert` — keeping the no-build ethos end to end.
- **The fair-bot boundary:** `visibleState(state)` strips everything hidden (Understanding, defect pool, member internals — mood icon stays; the log, including past check reveals, is visible). Policies receive *only* the projection. The UI renders *only* the projection. One boundary enforces both honest balance and no-leak screens.
- All randomness flows through the seeded RNG, whose cursor is serializable (`getState()`/`setState()`) so auto-saves resume exactly. The strong bot is deterministic: same seed → same run, so win-rate deltas between configs are real, not noise.
- `gameState` is plain JSON-serializable data — no functions, class instances, or Dates.

## Phase 0 — Scaffold (= WP0)

`index.html`, `package.json`, `/src` layout per design doc, `config.js` with every knob from the economy doc, `sim/rng.js` (mulberry32 + `d100`, `pick`, `shuffle`, `range`, serializable cursor).

**Done when:** `node --test` passes RNG determinism tests (same seed → same sequence; distribution sanity).

## Phase 1 — State & pure engine (= WP1)

- `state.js` — the shape and `initState(classId, hires, model, seed)`:

```js
{
  seed, rngState, month, phase,
  money, energy, client, focusUsed, capacity: { total, spent },
  skills: { coding: {conf, und, floor, streak}, debugging: {...}, judgment: {...} },
  cd, slipped,
  tasks: [],                                            // this month's fresh tasks
  backlog: [ {task} ],                                  // slipped tasks, routable
  defects: [ {severity, provenance, monthShipped} ],    // hidden
  openSeverity,                                         // SLA pool from incidents
  team: { junior: {name, trait, salary, und, morale} | null, qa, senior },
  model,
  history: [ {month, conf, und, money, cd, client} ],   // feeds the postmortem chart
  flags: {},                                            // event bookkeeping
  log: []                                               // feeds the postmortem
}
```

(Calibration is derived from `conf`/`und`, never stored. No sliders, no contingencies, no member burnout — cut; see PLAN.md §1.)

- `sim/engine.js` — `pendingDecisions(state)`, `applyDecision(state, id, choice, rng)`, and the month pipeline as pure steps: `plan → resolveWork → resolveHunt → maybeEvent → settleBooks → advanceMonth`.
- `sim/decay.js`, `sim/checks.js` (d100 vs. hidden understanding; `you`/member/`team` target resolution), `sim/effects.js` (`applyEffects` — the one function events touch; throws on illegal keys), `sim/hunt.js` (statistical resolution), `sim/visible.js` (the projection).

**Done when:** unit tests cover decay curves and floors, streak acceleration, check targets (including team = best-in-shop and absent-member choice filtering), effects application, hunt math (surfacing scales with hidden Debugging, carry limit, AI-hunt regression seeding), the ±20% skin-modifier clamp, and a full 12-month run advances headless with stub content.

## Phase 2 — Minimum viable content (= WP2)

`data/classes.js` (4), `data/candidates.js` (generator: salary bands, resume −5 ± variance, traits), `data/tasks.js` (generator), `data/events.js` (~12 regular), `data/majors.js` (4 + fixed Renewal Review), `data/incidents.js` (~6), `data/linkedup.js` (death-post copy per cause). Writing per PLAN.md §5 Tone & magnitude: punny titles, deadpan delivery, capped effects.

**Done when:** a schema-validation test walks every deck — predicates callable, effect keys legal, check skills/targets real, weights positive, ids unique, every choice touches ≥1 of the five axes, every effect inside the magnitude caps (2× for majors), `removeMember`/`endRun` only behind checks or earned-state predicates. Content errors fail in CI, not at runtime.

## Phase 3 — Harness & the strong bot (= WP3)

- `sim/runner.js` — `node src/sim/runner.js --policy=qualified --runs=1000 --seed=42 [--csv] [--sweep knob=v1,v2,v3]`. Emits per-run records (ending, death cause, month of death, final stats, money curve) and aggregates.
- `policies/` — `(visible, pendingDecision, helpers) → choice`:
  - `random` — floor check.
  - `pure-ai` — everything raw, never reviews, AI-hunts.
  - `pure-self` — never delegates to the model.
  - `no-qa` — qualified play minus the QA hire.
  - **`qualified` — the strong deterministic player.** Heuristics, visible-info only: hire QA + junior if the burn rate fits (judged from resumes and salaries alone); route hard tasks to self while energy > 40; review all AI output up to capacity; hunt when CD, open severity, or SLA penalties climb; clear backlog before it lingers; rest below energy 30; 1:1 when a mood icon (or the client face) sours; feed the junior easy tasks every month.

**Done when:** all five policies complete 1,000 runs without error and the aggregate report prints ending/death distributions and month-of-death histograms.

## Phase 4 — Balance to the target (= WP4, timeboxed)

`test/balance.test.js` — the promises, as assertions over 1,000-seed batches:

- `qualified` wins 25–35% (target 30%).
- `pure-ai` reaches month 12 ≥ 60% of the time but passes renewal ≤ 10%.
- `pure-self` fails ~75–85% (bankruptcy or deadline), Greybeard its best class.
- `no-qa` survival tracks `qualified` through Q1, then visibly diverges mid-year.
- `random` wins ≤ 5%.
- Death causes are distributed — no single cause > 50% of `qualified` losses (variety = fairness).

Tuning loop: change `config.js`, run suite, read which promise broke; use `--sweep` for coarse searches. If targets prove mutually unreachable, adjust the offending band, document why in a comment above the assertion, and flag it — do not thrash. **Deliverable: locked config v1.** The game is now proven fun-shaped before a single pixel exists.

## Phase 5 — UI shell (= WP5)

Router + screens over `visibleState` and `pendingDecisions`: TITLE → OUTFITTING → MONTH (plan + focus) → EVENT → STORE (quarter ends) → GAMEOVER. Auto-save to localStorage after every applied decision (state + RNG cursor); title screen offers *Continue the year*; run end clears the slot. Event choice rows show derived axis icons. The hunt is a button first — formula resolution, results text — the skin comes later. A human playing the shell is just another policy answering the same decision objects.

**Done when:** a full run is playable start to finish in the browser; closing the tab mid-run and reopening resumes exactly; a completed game's log replays a headless seed identically (drift test).

## Phase 6 — Hunt skin & polish (= WP6)

Whack-a-mole over the statistical baseline (player performance modulates the formula ±20% clamped, so twitch skill matters but stats rule; 45s timer), the full animated office scene (typing speed from workload, pose swaps, monitor glow, seasonal window; CSS `steps()` only), PC-speaker audio, `overlay.css`, the LinkedUp death post (parody card, typed-in body, deadpan cause line), the postmortem screen — including the calibration reveal chart and "the month you lost."

## Phase 7 — Ship (= WP7)

The Token Trail card on the root `index.html`; final manual checklist (one death run, one Impostor run, one win attempt; mobile portrait + desktop).

---

## Order of first commits

1. `sim/rng.js` + tests
2. `config.js`
3. `state.js` + `sim/visible.js`
4. `sim/decay.js`, `sim/checks.js`, `sim/effects.js` + tests
5. `sim/engine.js` + `sim/hunt.js` (month pipeline) + stub content
6. `data/*` decks + schema tests
7. `policies/*` + `sim/runner.js`
8. `test/balance.test.js` → tune → lock config v1
9. Screens (+ auto-save)
10. Skin

Nothing in steps 1–8 knows the DOM exists.
