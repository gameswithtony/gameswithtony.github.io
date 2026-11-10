# Voidfall Solo

A buildless, dark-only Voidfall solo table. Play a House against the Voidborn using the co-op/solo rules.

## Run

Serve this folder over HTTP, just like Pathfinder, KEV, and WM:

```text
node dev/serve.mjs
```

Open **http://127.0.0.1:8086/**. There is no install, bundler, framework, build command, or external runtime asset request. The development server refuses to serve `resources/`, dotfiles, development scripts, or tests. GitHub Pages can serve the tracked folder directly at `/vf/`.

## At the table

- Eight official solo scenarios; fourteen Houses, both origins; three difficulties; optional Focus selection before revealing the Crisis; repeatable setup seeds.
- The Galaxy uses large sectors with Population, guilds and vacancies, installations, fleets, Corruption, Harbingers, and sector rewards. Scroll or drag to pan, use +/- to zoom, tap the percentage to fit, and use the center control to return to your sectors.
- The header keeps stockpiles, production yields, Influence, the Voidborn target, the Event, the next Skirmish, upkeep, and Crisis count available.
- Mobile tabs: Galaxy, House, Cards, Voidborn, and Log. Wide screens add a simultaneous House rail and action tray.
- The action tray shows legal choices and live costs. Back, Cancel, Skip, and Finish stay outside the scrolling choices. Bonus actions remain in the scrolling area. Collapse the tray to inspect more of the table; the preference survives tab changes.
- Every sector, card, resource, and Civilization space can be inspected. Each choice has a separate information button. The tray's `?` turns choices into explanations without selecting them.
- The Cards view includes Focuses, Technologies, Agendas, and the current Event. The Voidborn view includes Crises, Safe Havens, and a live target breakdown.

## Saves

Autosave uses `localStorage` key `vf.v1`. Saves contain a setup seed and a validated decision log. A fresh rules worker replays that log when loading or undoing, preserving hidden decks and pending nested decisions without serializing JavaScript callbacks. Input is acknowledged before another choice is accepted, and a short guard prevents a double tap from selecting the next decision.

The menu exports JSON or a compressed `VF1:` code. `loadgame.html` opens the import screen. A new game replaces the existing autosave only when it reaches a valid decision. Research files, browser test profiles, and downloaded game artwork stay under ignored `resources/`.

## Checks

```text
node --test tests/*.test.mjs
node dev/headless.mjs
```

The unit/integration tests exercise all House origins and all solo setups, fleet conservation, deterministic restore/undo, stale choice rejection, and save validation. `dev/simulate.mjs` can drive a mechanical smoke playthrough through the same worker boundary.

`dev/headless.mjs` uses the installed Chrome, a separate ignored profile, and a local server. It exercises actual pointer clicks, local fonts, responsive layouts, map controls, sheets, mobile dock behavior, save controls, and a complete game including payments and combat. Reports and screenshots are retained under `resources/browser-qa/`. This is browser verification and sampled visual review, not proof of complete rules fidelity, physical touch-device behavior, or full accessibility conformance.

## Implementation

- `js/rules/`: rules/component implementation adapted from Mark Hutchinson's public Voidfall solo app; local store and persistence adapters replace its framework and network integrations.
- `js/engine.js`: public board descriptions, legal-choice validation, and UI commands.
- `js/worker.js`: isolated rules process and deterministic replay.
- `js/views.js`, `js/app.js`, `styles.css`: dependency-free interface and interaction state.
- `js/icons.js`: original SVG fleets, resources, installations, crests, dials, and sectors.
- `js/printed-rules.js`: searchable component text extracted from the supplied Glossary, with page references.
- `fonts/`: locally served Barlow and Oxanium, with their SIL Open Font Licenses.
- `lz-string.min.js`: the repository's existing LZ-String save-code library.

[Design decisions](docs/DESIGN.md) · [Sources and adaptations](docs/SOURCES.md)

Voidfall is designed by Nigel Buckle and Dávid Turczi and published by Mindclash Games. This is an unofficial fan project with original interface graphics.
