# Weather Machine · Solo Laboratory

A static, mobile-first implementation of Weather Machine against Dávid Turczi's official **The Saboteurs** solo opponent. Agent White and Agent Pink share one opponent. There is no custom opponent or AI service.

All application files live here. There is **no build step**, package installation, CDN, or artwork download at runtime. All displayed graphics are original SVGs and CSS. `resources/` contains local research material and is ignored by Git.

## Run locally

From the repository root:

```sh
node wm/dev/serve.mjs
```

Open **http://127.0.0.1:8078/**. The development server deliberately refuses to serve `resources/` and dotfiles. For GitHub Pages, the app is served directly at `/wm/` without this server. JavaScript modules require HTTP(S); do not double-click the HTML as a `file:` URL.

## Play and save

- Choose any of the 12 official Challenges, optionally enter a setup seed, and start.
- Orient the starting Workshop tile, then take the initial Supply round.
- The decision panel offers validated actions and payments as tiles and board-shaped grids. End turn, Back, and Skip stay pinned outside the scrolling area. Tap any board item for its current value and rule. The `?` in the decision panel explains the options: tap one to see what it does without choosing it. All of this text lives in `js/tips.js`.
- The sticky header shows round, scores, and Workshop totals. Below it, one strip shows both ways to lose: Extreme Weather levels and Reports left. Vouchers sit below the decision heading and remain visible when collapsed. Tap any metric for details; the Workshop tab keeps the full inventory breakdown. Every major block collapses from its header, and that choice is remembered in this browser. A decision reopens the block it is about.
- Phone views keep the Table, Workshop, Office, Saboteurs, and Journal tabs fixed at the bottom. The full-width current action sits flush against the top of the tabs; tap its header to collapse or expand it. The collapsed title stays visible while inspecting the board or changing tabs. Wide screens expose a personal rail and simultaneous board panels.
- Autosave uses `localStorage` under `wm.v1`, with up to 40 undo steps. Undo includes hidden decks and the random seed.
- Export a JSON file or a `WM1:` share code from the menu. Load through the menu or `loadgame.html`. Codes are local data; the app does not upload games.

## Verify

```sh
node --test wm/tests/*.test.js
node wm/sim/run.js 1000 1
node wm/sim/run.js 1000 2200 challenges
node wm/dev/headless.mjs
```

`dev/devices.html` places the app in 320px, 375px, 820px, and 1600px frames for visual review. These frames share browser storage; use one active game tab when playing. `dev/icons.html` previews the Rain, Saboteur agent, Lativ, and distinct owner Bot icons at their small on-board sizes.

The rule tests include a publication-to-prototype sequence, use of a marker-space Part in the prototype, covered weather layers, official solo timing, payments, conservation, final scoring, and both victory routes. Random legal games are a robustness check, not proof of complete rules fidelity.

`dev/headless.mjs` drives the locally installed Chrome through its DevTools protocol, with no npm dependency. It starts its own local server and uses a separate test profile under ignored `resources/browser-qa/`; it does not use your normal Chrome profile or saved games. The default Chrome path is Windows-specific; set `WM_CHROME` for another installation. The script closes its browser and server when finished.

Headless Chrome verification passed 785 checks on November 9, 2026: all five views at 320, 375, 430, 650, 820, 1280, and 1600 pixels; actual UI purchases and Workshop placement; Lab contribution and official Saboteur resolution; undo, reload, share/import; detail dialogs; both themes; and a complete game through the result screen. Mobile checks cover fixed bottom tabs, drawer collapse/expand, scrolling, tab switching, safe-area spacing, and controls remaining unobstructed. Typography checks verify local font loading, current/max metric proportions, readable labels and action text, and text fitting its controls. No runtime errors or horizontal overflow were found.

The visual pass uses the board's indigo, sage, mauve, copper, and weather colors through CSS. [Palette notes](docs/COLORS.md) explain the mapping. `dev/contrast.mjs` measures rendered text against layered backgrounds, waits for entrance animations, and skips hidden content. Across 303 sampled screens (both themes, all tabs, setup, detail dialogs, and results), 46,030 text measurements passed, with a minimum measured contrast of 4.94:1. The report, contrast measurements, and 25 screenshots remain under ignored `resources/browser-qa/`. These are browser interaction and sampled visual checks; they do not establish complete rules fidelity, full accessibility conformance, or replace physical touch-device testing.

## Sources and implementation

- [Rules reference](docs/RULES.md): original paraphrase, printed page references, and the published v8 solo corrections.
- [Engine notes](docs/ENGINE.md): architecture and explicit interpretations.
- `js/data.js`: component values transcribed from the supplied PDFs, TTS images, and local TTS workshop definitions. The ten missing Workshop faces were read from their original Steam URLs and retained only under ignored research material.
- `lz-string.min.js`: the existing repository's LZ-String library, copied locally for save compression.
- `fonts/`: KEV's Barlow and Barlow Semi Condensed font families, served locally with their SIL Open Font Licenses. `typography.css` loads last and is the one authority on type: Semi Condensed 700 for numbers, 600 to 700 for names and titles, Barlow 400 to 500 for labels, on sizes 12, 13, 15, 17, 18, 20, 22, 24 and 28, with the maximum of an X/Y value at 95% of the current value so it never renders taller.

Weather Machine is designed by Vital Lacerda and published by Eagle-Gryphon Games. The Saboteurs solo mode is by Dávid Turczi. This is a fan-made practice implementation with original graphics, not an official EGG product.
