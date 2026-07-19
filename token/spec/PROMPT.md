# Implementation prompt for The Token Trail

Implement **The Token Trail**, a vanilla-JS web game, in `/token` of this repo.

## Read first, in this order

1. `token/spec/PLAN.md` — **the build authority.** Where it conflicts with anything else, it wins. Its §4 frozen interfaces and §2 scope guardrails are law.
2. The four spec docs in `token/spec/` (`token-trail-design-doc.md`, `token-trail-economy.md`, `token-trail-build-plan.md`, `token-trail-ui-spec.md`) — design detail and voice, all aligned with PLAN.md. If you ever find a residual conflict, PLAN.md wins.

## Ground rules

- Vanilla JS, native ES modules, zero dependencies, no build step. The only `package.json` content is `{"type": "module"}`.
- Tests use `node:test`. **`node --test test/` (run from `/token`) must be green before every commit.** Never proceed onto a package whose upstream is red.
- No new game mechanics, stats, screens, or decision types beyond PLAN.md (§2). New *events* inside the existing schema and §5 tone/magnitude caps are welcome; new *mechanics* are not.
- Commit locally per completed work package (message per repo convention + Co-Authored-By line). **Do not push** — main auto-deploys via GitHub Pages; I will review and push myself.
- Work autonomously: make calls per PLAN.md, and record any deviation or judgment call in the final report instead of asking questions.

## Sub-agent orchestration

Use **Opus sub-agents**, one per work package (PLAN.md §6). You are the orchestrator and integrator: you launch agents, review their diffs, run the full test suite between integrations, and own the commits.

1. **WP0 + WP1** (scaffold + pure sim core) — one agent, sequential, first. This is the keystone: everything downstream codes against its interfaces. Integrate and verify before anything else launches.
2. **Then three agents in parallel:**
   - **WP2** — content decks (`src/data/*`), written to §5 Tone & magnitude (punny titles, deadpan delivery, capped effects).
   - **WP3** — harness, runner, and the five policies (visible-state only).
   - **WP5** — UI shell over `visibleState` + `pendingDecisions` (hunt as a placeholder button; auto-save/resume included).
3. **WP4** (balance tuning) after WP2 + WP3 integrate: iterate **`config.js` only** against `test/balance.test.js`, using the runner's `--sweep`. It is timeboxed: if targets prove mutually unreachable, adjust the offending band, document why in a comment above the assertion, and flag it in the report — do not thrash.
4. **WP6** (whack-a-mole skin, animated office scene, WebAudio, overlay/polish) after WP5, on the locked config.
5. **WP7** — add The Token Trail card to the root `index.html` matching the existing site pattern, then the final checklist (one death run, one Impostor run, one win attempt; mobile portrait + desktop).

When briefing each sub-agent, give it: the PLAN.md sections that govern its package, the exact file list it owns (no two concurrent agents share a file), its "done when" criteria verbatim, and the frozen-interface rule. Reject and re-run any agent work that changes a frozen interface or adds unplanned game surface.

## Verification & final report

- All suites in PLAN.md §7: unit, schema, balance, drift.
- Run the headless runner for all five policies and capture ending/death distributions.
- Final report must include: what shipped per package, full test results, balance numbers vs. targets, every flagged deviation or judgment call, and how to play locally (`python -m http.server` from the repo root, then `http://localhost:8000/token/`).
