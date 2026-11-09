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
- The decision panel offers validated actions and payments. Inspect any board item for its rules and current values.
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

`dev/devices.html` places the app in 320px, 375px, 820px, and 1600px frames for visual review. These frames share browser storage; use one active game tab when playing. `dev/icons.html` previews the Rain, Lativ, and distinct owner Bot icons at their small on-board sizes.

The rule tests include a publication-to-prototype sequence, use of a marker-space Part in the prototype, covered weather layers, official solo timing, payments, conservation, final scoring, and both victory routes. Random legal games are a robustness check, not proof of complete rules fidelity.

`dev/headless.mjs` drives the locally installed Chrome through its DevTools protocol, with no npm dependency. It starts its own local server and uses a separate test profile under ignored `resources/browser-qa/`; it does not use your normal Chrome profile or saved games. The default Chrome path is Windows-specific; set `WM_CHROME` for another installation. The script closes its browser and server when finished.

Headless Chrome verification passed 414 checks on November 8, 2026: all five views at 320, 375, 430, 650, 820, 1280, and 1600 pixels; actual UI purchases and Workshop placement; Lab contribution and official Saboteur resolution; undo, reload, share/import; detail dialogs; dark mode; and a complete game through the result screen. Mobile checks cover fixed bottom tabs, drawer collapse/expand, scrolling, tab switching, safe-area spacing, and controls remaining unobstructed. Typography checks verify local font loading, equal current/max metric sizes, readable labels and action text, and text fitting its controls. No runtime errors or horizontal overflow were found. Representative phone, tablet, desktop, dark-mode, and icon-size screenshots were visually reviewed. The report and 20 screenshots remain in `resources/browser-qa/`, excluded from Git. This verifies the browser interactions and sampled layouts; it does not establish complete rules fidelity or replace testing on physical touch devices.

## Sources and implementation

- [Rules reference](docs/RULES.md): original paraphrase, printed page references, and the published v8 solo corrections.
- [Engine notes](docs/ENGINE.md): architecture and explicit interpretations.
- `js/data.js`: component values transcribed from the supplied PDFs, TTS images, and local TTS workshop definitions. The ten missing Workshop faces were read from their original Steam URLs and retained only under ignored research material.
- `lz-string.min.js`: the existing repository's LZ-String library, copied locally for save compression.
- `fonts/`: KEV's Barlow and Barlow Semi Condensed font families, served locally with their SIL Open Font Licenses. `typography.css` defines a consistent scale: 15px body text, 12–14px labels/supporting text, 16px action labels, and equal-size current/max metric values. Dense symbol labels remain 11px where their physical slots require it.

Weather Machine is designed by Vital Lacerda and published by Eagle-Gryphon Games. The Saboteurs solo mode is by Dávid Turczi. This is a fan-made practice implementation with original graphics, not an official EGG product.
