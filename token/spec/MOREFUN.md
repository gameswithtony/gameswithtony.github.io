# The Token Trail — MOREFUN (fun-pass decisions)

*Diagnosis and adopted adjustments from the 2026-07 fun review. The game ran fine
but played flat: no tension, too easy, and the same month twelve times. The core
commentary stays; the systems get teeth. This doc records the **decisions** — it
overrides the baseline numbers in the economy doc where they conflict.*

---

## Diagnosis (why it was flat)

1. **Supply exceeded demand all year.** With a QA hired, review capacity (5)
   covers every task (2–3/month) with ammo to spare. Cognitive Debt never
   accrues, the defect pool stays empty, incidents rarely flare, and money
   compounds. "Attention is the choke point" never actually chokes. The optimal
   line is discoverable in month 1 and repeats unchanged eleven times — that one
   root cause is both "too easy" and "repetitive."
2. **The scary stat was invisible *and* painless until minute 15.** Reveals are
   rare (~1–2 per run), so the Renewal Review plays as an unforeshadowed verdict,
   not a dreaded exam.
3. **Flat structure.** Every month has the identical shape and no goal inside
   it. Small decks (13 events / 4 majors / 6 incidents) and hard effect caps
   make events wallpaper. The bot's ~30% win rate comes from one authored ambush
   (the Outage) plus month-12 dice — difficulty as ambush, not tension.

**Design stance adopted:** Understanding stays **fully hidden** (see D3). All
felt tension must therefore come from the *visible* axes — money, incidents,
client, milestones. The squeeze does the work; the reveal stays a gut-punch.

---

## Decisions

### D1 — The demand ramp (adopted)

Success breeds scope. Tasks per month scale by quarter while capacity stays flat:

| Quarter | Tasks/month (tune from here) |
|---|---|
| Q1 (m1–3) | 2 |
| Q2 (m4–6) | 3 |
| Q3 (m7–9) | 4 |
| Q4 (m10–12) | 5–6 |

By ~month 5 the player can no longer review everything; every later month is
triage — which AI work ships raw, whose growth gets starved, what slips. This is
the thesis mechanized (pressure is what drives real teams to raw AI) and it makes
the twelve months structurally different from each other. Oregon Trail analog:
the terrain worsens westward.

*Config:* `tasksPerMonth` becomes a per-quarter schedule instead of one min/max.

### D2 — Thin margins (adopted)

Baseline monthly surplus drops to ~zero. Profit comes from **performance**:
cleared backlog goodwill, quiet incidents, and milestone bonuses (D4) — not from
the contract's idle drip. One bad month should hurt for two.

*Knobs:* lower `contractMonthly` and/or raise salary bands / token costs until a
QA-hiring, moderately-AI player breaks roughly even before bonuses. Exact numbers
are the harness's call (see "Balance consequences").

### D3 — Understanding stays fully hidden (adopted; alternative rejected)

Considered and **rejected**: quarterly calibration beats (a light client check
per quarter with a "You believed / Reality" reveal) and a visible "Renewal Review
in N months" countdown. The ambush *is* the thesis — no foreshadowing of the
hidden stat. A check remains the only reveal, exactly as today. Tension is
carried entirely by D1/D2/D4/D5/D6.

### D4 — Quarterly milestones (adopted)

Each quarter the client names a deliverable ("the reporting dashboard — by
month 6"). 1–2 fresh tasks per month arrive **tagged** toward the current
milestone. At the quarter-end month:

- **All tagged tasks shipped** → milestone bonus (real money, per D2 this is a
  main profit source) + client bump.
- **Any tagged task unshipped** (slipped or sitting in backlog) → large client
  hit, and the miss is readable by major/event predicates — a missed milestone
  steers you toward the angrier set pieces. You earn your river crossings.

Twelve months become four acts with goals; routing gains a scheduling dimension
(a tagged task in the backlog is a fuse, not a pile).

*Sketch:* `state.milestone = { id, title, deadlineMonth, taskIds[], bonus,
clientHit }`; task generation stamps `milestone: true` on 1–2 tasks/month;
settlement runs in the quarter-end Books step. Data lives in
`data/milestones.js` (same plain-data discipline as events).

### D5 — Events with teeth + bigger deck (adopted)

- Effect caps **scale by quarter**: ×1.0 in Q1 rising to ~×2.5 by Q4 (tune). The
  authoring contract becomes "an event changes your month early, and can
  genuinely wound you late."
- **8–10 new regular events**, weighted toward mid/late-year eligibility
  predicates (high CD, big backlog, missed milestones, low morale) so late-game
  draws feel earned and dangerous.
- Same schema, same engine — content and one cap multiplier, no new systems.

### D6 — Incident set-piece screens (adopted)

Defect flares stop being a log line. A flare becomes a **pending event** drawn
from the incidents deck (which already carries choices in the event schema) and
gets its own screen: the 2am page, the responder check played out, the severity
landing. Engine change is moderate: `flareIncident` routes through
`pendingEvent { deck: 'incident' }` like majors do, instead of auto-resolving.
Incidents keep their damage formula; they just happen *to* you on screen instead
of near you in a ledger.

### D7 — Hunt redesign: Spot the Bug (adopted; whack-a-mole retired)

The whack-a-mole skin is replaced. New skin: a grid of code panels containing
real, readable pseudo-code; buggy panels contain one genuinely flawed line
(off-by-one, `=` vs `==`, swapped args, missing await, inverted condition…).
**Click the flawed line.** Perception and knowledge, not reflexes.

- **Atrophy is rendered as illegibility.** Low Debugging Understanding replaces
  a fraction of panels with code you cannot parse (`▒▒▒`-garbled) — you are
  staring at your own system and cannot read it. High Understanding runs get
  clean, fully legible grids. Same message the calm whack-a-mole board tried to
  send, now literal.
- Wrong clicks waste ammo (found nothing, spent attention). Clean decoy panels
  exist at every skill level.
- Bug panels still cluster by provenance (unreviewed modules), so the hunt keeps
  quietly mapping where the Cognitive Debt lives.
- **Sim contract unchanged:** the hunt still resolves statistically in `sim/`
  (understanding + ammo + pool), and the skin modulates the baseline by at most
  ±20%, clamped. Headless runs need no eyes.

*Rejected alternatives:* triage-queue push-your-luck; single-bug fault tracing;
keep-whack-a-mole-with-target-choice.

### D8 — The Top Ten is dropped entirely (adopted)

The Oregon Trail hall-of-fame homage (localStorage scores, initials entry, the
Top Ten table on title and gameover) is removed. The run ends on the postmortem
chart and the score, then back to the title. Cut: `getTopTen`/`saveTopTen` and
the initials flow in `main.js`, the title pane, the gameover table, the
`table.topten`/`.initials` CSS.

### Rejected outright

- **Task personality tags** (urgent / client-facing / security-sensitive /
  legacy) — variety per task judged not worth the rules overhead alongside D4.
- Everything already in the design doc's parking lot stays parked.

---

## Retune record (implemented 2026-07-19)

All of D1–D8 are in. What the retune actually changed and where it landed:

- **Numbers:** `contractMonthly` 2500 → 2000; `tasksPerMonth` is a per-quarter
  schedule (2/3/4/5–6); milestone bonus $1,200 / client +8 hit / −12 miss;
  `eventEffectCaps.quarterMultipliers [1, 1.5, 2, 2.5]` keyed to `minMonth`.
- **New rule (D1 support):** a teammate holds ONE assigned task per month
  (`memberTasksPerMonth: 1`) — without it the ramp is dodged by dumping the
  pile on the junior. Enforced in `routeOptions` and mirrored in the assign
  screen's draft layer.
- **The Outage** is now reserved for deep wreckage (`cd ≥ 8 || openSeverity ≥ 5
  || defects ≥ 7`): with difficulty systemic, the deck-authored death is for
  shops that truly shipped a system nobody understands. Merely-dented runs draw
  the other crossings and die of their own arithmetic.
- **`qualified` learned discipline** (policy, not config): rests below 45
  Energy, won't self-build hard tasks below 55, buys the `pay` ferry at set
  pieces when cash ≥ $4,000, and avoids `hand` options when tired. That is what
  moved its deaths from an M9 burnout cliff into the Q4 systemic crunch.
- **Assertion re-aimed:** "no single death cause > 50%" guarded against one
  dominant *trap*; it now says exactly that — no *deck-authored* endRun cause
  may dominate `qualified`'s losses. Engine deaths (fired/bankruptcy/burnout)
  may, because dying of the squeeze is the designed shape.

Observed at seed 1 × 1,000 runs: **qualified wins 28.2%** (band 25–35%),
reaches the month-12 verdict 94.2%, deaths cluster in months 10–12. random
≤ 5%, pure-ai renewal-pass ≤ 10%, no-qa tracks-then-diverges — all 51 tests
pass, plus a 5-seed headless UI smoke over every touched screen.

**Open tuning note (honest caveat):** the thin margin binds hardest on classes
that pay for tokens. The bot's favorite (Vibe Coder + free-frontier quirk) still
banks ~$26k average by year end — its constraint is Understanding, not cash,
which is thematically right for that class but worth watching in human play. If
Vibe feels too cushioned, the lever is its quirk or salary bands, not the
contract.
