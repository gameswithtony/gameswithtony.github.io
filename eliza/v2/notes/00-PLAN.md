# Eliza v2: plan and status

Read this first when resuming. Then read `01-RULES-MODEL.md` (the game as the engine implements it)
and `02-AI-DESIGN.md` (how the AI thinks). `research-strategy.md` is web research on strategy.

## Goal (from Version2.md)
- The AI players follow the exact same rules as a human. No AI-only special rules.
- Balance comes from the real deck composition and per-player card counts, not dice and fudges.
- The AI plays broadly well (several strategies, not one) and creates good "moments" of interaction:
  using your coal/iron/beer (helps you), taking a resource or space you needed (hurts you),
  spending to fight for turn order, climbing income for big moves.
- A headless harness: AI vs AI, lots of games, stats on scores and moments, so we can tune quickly.
- The existing physical-board UX stays (layout is sacred, see memory). New guts only.
- A new phone-only mode: no board, no game art, very mobile friendly; map, your mat, hand,
  money/income/VP, choose the card for each action.

## Source of truth
- `images/board.jpg` (board), `images/playerboard.webp` (tile stats),
  `images/birmingham_card_counts.webp` (deck), the rulebook PDF.
- `images/cardcounts.webp` is the **Lancashire** player aid. Ignore it.

## Key decisions
1. **Engine is plain-JS ES modules** in `eliza/engine/`, no build step, runs in browser and Node.
   `eliza/package.json` is only `{ "type": "module" }` so Node treats the files as modules.
2. **Engine owns the rules.** State is plain JSON (save/undo/bug-report friendly).
   `legalActions` + `applyAction` + `endOfRound` etc. are pure functions over state.
3. **Cards**
   - Phone mode: one real shared deck. Exact game.
   - Physical mode: same as v1 setup text (human takes their share of a shuffled real deck).
     Each AI is dealt its share from a *virtual* full deck: shuffle the 40/54/64 card deck,
     AI 1 takes the first 2*rounds cards, AI 2 the next 2*rounds. So each AI sees exactly
     the right card distribution and the AIs never share a card. Re-dealt at the rail era.
   - The human does NOT report which card they used (less overhead), except that a Build still
     implies a card. The AI never needs the human's hand.
3b. **Seats (user request 2026-10-29):** 1-3 humans + 1-2 AIs (Eliza, Eleanor), total 2-4 players; design
   so a 3rd AI can be added later. Pass-and-play for humans in BOTH modes.
   - Physical: humans share the real deck after removing each AI's share (2*rounds cards per AI,
     face down to the box). Each AI draws from its own share of a virtual deck.
   - Phone/digital: one shared virtual deck; a "pass the phone to X" screen hides hands between turns.
   The engine already takes any list of `{name, kind:'ai'|'human'}` seats.
4. **Money and income are tracked for EVERY player in BOTH modes** (user, 2026-10-29: "very requested
   feature"). Everything is calculable from entered actions: start £17, income each round, build/network/market
   spending, coal/iron sold to market, loans (+£30), Warrington £5. So the physical UI must record Loan
   separately (today "Scout, Loan, Pass" is one screen with no input: split it).
   **The app is the authority on money** (user: "Money shouldn't drift. The app should be more accurate
   than the human."). No manual correction control; the app TELLS the human their money/income each turn.
   Shortfall (negative money after income): engine auto-sells tiles for AIs; for humans the UI should ask.
   (Engine still tolerates `money === null` for a player, but nothing creates that now.)
5. **The AI = candidate generation + evaluation + search over its 2 actions**, with weights
   that can be tuned by self-play. Several "personas" (weight sets) give strategic variety.
6. Data fixes vs. old `data.js` (checked against the player mat image):
   - Pottery IV income +1 (old data said +5).
   - Manufacturer II income +0 (old: +1). Manufacturer IV costs £14 and gives +7 income (old: £8, +6).
   - Brewery IV and Pottery V are **rail-era only** (grey era icon on the mat). Old data had no rail-only concept.

## Feature requests (user)
- **Move history screen** (2026-10-29): see how the whole game played out, what money was spent, etc.
  Built from the engine event log via `engine/describe.js` (same text the AI turn screens use).
  Needed in both the physical app and phone mode. `node sim/replay.js --seed N` prints one for a sim game.

- **Selectable AI personas at setup** (2026-10-29): per AI seat, a select in the spot where v1 had
  "Deck Type". Names/blurbs: `PERSONA_INFO` in engine/ai.js (Balanced, Cotton Baron, Manufacturer,
  Potter, Rail Baron, Ironmaster). Maybe a "Surprise me" option. Personas must each be competitive (harness check).

## Milestones
- [x] M0 Study: rulebook, images, old app. Notes written.
- [x] M1 Engine rules + node:test tests (`engine/core.js`, `engine/moves.js`, `tests/`). 22 tests.
- [ ] M2 AI v1 + headless harness (`sim/`), first tuning loop.
- [~] M3 Rewire the physical-board app (index.html/app.js) onto the engine. Same screens. (first pass done, see log)
- [~] M4 Phone-only mode. (first pass: ui/map.js SVG map, status strip, hand, mat, market panels; card choice step; pass-and-play handoff)
- [ ] M5 Tuning passes, docs, cleanup of old files (PLAN.md/PLAN2.md are v1 notes).

## Status log
- 2026-10-29: M0 done. M1 done (engine/data.js, core.js, moves.js; tests/rules + smoke).
- 2026-10-29: M2 in progress. engine/ai.js (evaluator + beam search), engine/describe.js (event text,
  history), sim/run.js (harness, worker threads), sim/replay.js (one game's history), sim/moments.js.
  Balanced vs balanced, 48 games: mean 138, winner 146, margin median 14, ~1.3s/game.
  Fixed so far: brewery demand model, income valued as money, route distance for unsold tiles,
  shortfall penalty (4-phase horizon; full horizon made them never loan -> passing forever),
  coal demand scaled by network size. Still to do: loans ~6/player/game (high), develop low,
  tuner (sim/tune.js), personas comparison, denial measurement, 3p/4p checks.
- Overbuild (user 2026-10-29): fully supported by the engine and the AI's candidate list; AI should do it only when
  useful. The old app did not fully support it. The human UI (M3) must offer overbuilds too.
- 2026-10-29: Tuner (sim/tune.js, log sim/tuned2p.log) accepted 5 steps; folded into BASE in ai.js
  (coalRate canal 0.4, moneyRate rail 0.25, spendPerAction 6, poorBoost 0.25). 2p winner mean 151, loans 7.5/game.
  3p works (winner 145, margin median 9).
- 2026-10-29: M3 first pass. v1 app preserved in eliza/v1/ (start screen links to it if a v1 save exists).
  New index.html + app.js (ES module, Vue 2 CDN, no lodash). Save key 'elizagamestate2' (reset/loadgame
  handle both). Engine state kept frozen outside Vue reactivity; replaced after every action; undo = stack.
  Screens: start (mode, seats, personas) -> setup -> turn (human steps | AI turn lines) -> roundEnd/eraEnd -> final.
  Human steps: build (industry -> space [overbuild labelled] -> coal/iron editors -> card (phone) -> confirm
  with preview + money after), network/double (from -> to -> coal/beer), sell (tiles -> merchant + beer per
  tile -> Gloucester free develop), develop, loan, scout, pass. History + board state views.
  Browser-tested with a scripted full 4p game (http.server on 127.0.0.1:8765): no errors.
  TODO M3: real tap-through on a phone width; check text of every screen; AI 'thinking' time on phones.
- 2026-10-29: M4 first pass. ui/map.js: mapSVG(g) string (Node + browser), Vue 'board-map' wraps it, MAP_CSS injected.
  `node sim/mapshot.js --seed 3 --era 1 --round 6 --out x.html` + headless Edge
  (`msedge --headless=new --screenshot=... --window-size=400,420 file:///x.html`) to eyeball it, because
  Claude-in-Chrome screenshots time out on this machine (page JS is fine).
  Personas 3p (120 games): balanced/cotton/goods 32/30/38%; potter/railBaron/supplier 46/31/23%.

## Next steps (in order)
1. Tony plays a real game in each mode; fix what feels wrong. Verify every screen's wording.
2. AI strength: winners ~150 (2p), research says skilled ~180-200. Longer tuner runs
   (`node sim/tune.js --iters 80 --games 160`), per-persona tuning, check the AI's canal-end checklist
   (flip L2+ before era end; cash for a rail double), rail double-link use, denial measurement (--denial).
3. Moments: add 'denial' to default sims, report per-persona moments; consider a 'friendly/nasty' knob.
4. Phone mode polish: tap map to pick build spaces/links; larger text; confirm hand privacy on handoff.
5. M5: update CLAUDE.md (Eliza section), remove old root data.js (v1 copy lives in v1/), PLAN.md/PLAN2.md
   are v1 notes (move into v1/ or delete, ask Tony).
6. Open data question: Manufacturer II income (+0 image vs +1 every code source) and Manufacturer IV
   (£14/+7 image vs £8/+6 code). Ask Tony to check his physical mat. Currently image values.
- 2026-10-29: Denial (Tony: "ok to tune for a bit. not aggressive but exists"). Added BASE.denialW (extra weight on
  rivals' pending sale VP in relValue). Sweep, 160 games each vs denialW 0, measured with --denial
  (= a rival's sell-ready tile count dropped after my action):
    0.6: 0.94 vs 0.82 denials/player/game, win 49/51.   2.0: 0.96 vs 0.84, win 48/52.
  So denial already happens ~0.8-0.9 times per AI per game; the knob barely moves it. Default set to 0.3.
  If more is wanted: the real levers are contesting brewery/merchant spaces and drinking a rival's connected
  beer before your own (sell variant 'merchant-other' exists; double-link beer has no rival-first variant yet).
  Harness: persona overrides `--personas balanced:denialW=0.3+orderW=2,balanced`; per-persona moment lines.
  Also fixed: Python edits on Windows had written '£' as cp1252 (ai.js, app.js, plan) -> repaired to UTF-8;
  always pass encoding='utf-8' when editing with Python.
- 2026-10-29: Big tuning run requested ("even 10 points up is good, but keep it balanced").
  Baseline frozen: sim/baseline-2026-10-29.json. Tuner upgraded: --players 2,3 mixed, candidate seat first/last
  on paired seeds, 1-2 params per step, every accept re-confirmed on fresh seeds. Run:
  `node sim/tune.js --iters 100 --games 200 --players 2,3 --seed 20000 --out sim/tuned-all.json` (log sim/tuned-all.log).
  Harness accepts `name@weights.json` personas (persona overrides on top of a weight file).
- 2026-10-29: Physical-mode card correlation (Tony asked). Independent shuffles give exact per-player odds but
  your share and the AI's are not mutually exclusive (e.g. 4+ Birmingham cards in play). Only exact fix: one deck
  deals everyone (app deals human hands too, tap card per action), or human enters full hand. DECISION: live with
  the current limitation and see how it plays. Don't build the "app deals cards" option unless Tony asks.
- 2026-10-29: Run 1 of the big tune accepted 0/48: BUG, margin was cand - max(rivals), biased negative in 3p
  (max of 2 equal players). Fixed to cand - mean(rivals); log kept as v2/notes/tuning-all-run1-biased.log
  (useful fact: single-step changes were all within ~even win rate, so weights were near a local optimum).
  Restarted: --seed 30000, same settings.
- 2026-10-29: Tony asked for: early loans, L2+ flipped before canal end, a bit more lookahead (phone-safe).
  Implemented in engine/ai.js (each has an off switch in BASE):
  * incomeGrowth 1.5: income valued along a projected climb (projectedIncome) -> loans cost what they really cost.
  * planFlips/flipSlack: unsold tiles' flip chance counts actions still needed vs actions left this era.
  * lookahead 6 / laBlend 0.5: top 6 turns re-scored after the next rival's best reply (rival hand hidden ->
    modelled as holding any card) and my best follow-up. Time: median 16ms, max 95ms per turn (desktop).
  Results, 200 games 2p vs all-off: incomeGrowth 59% win (+3 VP); lookahead 57% (+5); planFlips neutral (AIs
  already flip ~3.2 L2+ tiles/player in canal, ~0.5 miss); all three 67% win, 153 vs 144 VP.
  Loans: first canal loan by round 3 went from 5% of players to 89% (median round 1).
  Harness now reports canalL2Flipped/Unflipped and loans per persona. sim/timing.js times decisions.
  Next: retune with new knobs (sim/tune.js PARAMS gained incomeGrowth, flipSlack, laBlend, lookahead<=10),
  then re-balance personas.
- 2026-10-29: Design pass (frontend-design). Tony: "don't use any previous indicated designs", "fresh but simple and
  true to the mobile first design", "keep it usable and accessible". New look = "drawing office": tokens in
  styles.css :root (linen #EEF1EE, sheet #FBFCFA, Prussian #1B3A57, ink #15181B, muted #4A5560, signal #B3261E,
  resource colours coal #33363A / iron #9C4A17 / beer #7A5C0E, focus #F2C230). Type: Zilla Slab (titles only) +
  Atkinson Hyperlegible (everything else). Turn "plate" = Prussian block with the player's colour stripe.
  Phone mode order: plate -> Standings ledger (money, income, VP, spent, VP-if-era-ended-now; rounds/cards left)
  -> coal/iron price tracks -> hand (grouped chips) -> actions (each with a cost/why-not hint) -> map (your
  network underlined) -> mat table. Physical mode: same structure as before, restyled only.
  Screenshot tool: `node sim/shot.js --out DIR --mode phone|physical --rounds 4` (headless Chrome via CDP;
  needs the http.server on 127.0.0.1:8765). Claude-in-Chrome screenshots time out on this machine.
- 2026-10-29: Phone layout revised (Tony: standings/hand took too much space; turn state + action choice come first).
  Default view = turn plate + actions only. Sticky footer = Next button (when needed) + tabs
  Standings (money/income/VP/Spent + coal/iron tracks; "Era now" column removed, Spent kept) | Hand | Board (map) | Mat.
  Each tab opens a slide-up sheet (Close button, Esc, tab toggles; focus moves to sheet title). Hand and Mat tabs
  only on the current human's own turn. Mat table: Next tile (+ beer/produce line, era notes) | Cost | VP | Inc | Left.
- 2026-10-29: Dark mode. All colours are tokens in styles.css :root; :root[data-theme="dark"] overrides them
  (night drawing office: page #0E151C, surface #16212B, headings #9CC3E6, brightened coal/iron/beer). Map colours
  are CSS vars too (ui/map.js MAP_CSS, fallbacks for Node snapshots). Theme saved in localStorage 'elizatheme';
  default follows prefers-color-scheme; an inline head script sets it before first paint. Sun/moon button in the
  top nav (now a flex row with no '|' separators) and top-right of the start screen. Renames: "Game State"
  (was View Board State). `node sim/shot.js --theme dark`.
- 2026-10-29: Footer tab 'Standings' renamed 'Ledger' (Tony: Standings was awkward). Tabs: Ledger | Hand | Board | Mat.
- 2026-10-29: Pure human pass-and-play (Tony). Seats: any seat removable (down to 1); up to 4 humans when no AI;
  AIs still max 2; total 2-4. Start blocked unless 2-4 seats and >=1 human (startProblem computed shows why;
  button disabled). Persona blurbs reworded (Balanced: "Adapts to the cards and the board. No fixed plan.";
  Ironmaster: "Supplies everyone's coal and iron, then invests the profits."); blurb sits under the persona select
  with aria-describedby. sim/shot.js --seats human,human. Test: all-human games 2-4p, both modes.
- 2026-10-29: Bug reports. "report a bug" now saves first, then shows 'ELIZA2:' + LZString.compressToBase64(save JSON)
  (~10 KB for a mid-game; was ~27 KB plain base64, and btoa crashed on non-Latin-1 names like emoji). The save now
  includes appVersion and the error text if the error screen was shown. loadgame.html accepts ELIZA2 reports and
  old plain-base64 reports (v1 and early v2), asks before overwriting the browser's saved game.
  Read a report without the app: `node sim/inspect.js report.txt [--history 40] [--ai]` (summary, error, standings,
  last moves, undo count; --ai re-runs the AI's choice for the current turn).
  Map: flipped band is now the tile's own top edge (path with rounded top corners); Board sheet header has
  zoom -/+ (1x, 1.5x, 2x, 3x) instead of the "Larger map" link.
