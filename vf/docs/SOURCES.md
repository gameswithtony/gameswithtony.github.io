# Sources and adaptations

## Primary game material supplied for this project

- `resources/VOIDFALL-Rulebook-websafe.pdf` — cycle of play, sector control, production, movement, combat, corruption, Technologies, Agendas, and co-op/solo systems.
- `resources/VOIDFALL-Glossary-websafe.pdf` — component effects, tracks, House abilities, Technologies, Agendas, Galactic Events, Crises, and sector abilities. The interface's printed component references include the relevant page number.
- `resources/VOIDFALL_Compendium.pdf` — setup, origins, tutorial, and scenario layouts. This PDF is image-based; relevant pages were rendered for visual review.
- `resources/Voidfall-Official_Errata_Clarifications1.0.pdf` — corrections and clarifications. Component references should be read together with this errata.

These files and all extracted/rendered research stay excluded from Git.

## Existing solo implementation

The project brief identified [the Voidfall solo app](https://voidfall-solo-app.surge.sh/). Its About screen credits **Mark Hutchinson**, Nigel Buckle and Dávid Turczi, and Mindclash Games. The original app states that its implementation was released with the designers' and publisher's permission; that statement is attribution to the original app, not a claim of separate endorsement for VF.

The public JavaScript, source map, offline manifest, image table, and component sheets were retrieved on November 9, 2026 into `resources/`. The source map contained Git conflict markers; its complete HEAD source-map record was extracted for research. Its readable rules modules form the basis of `js/rules/`. Source attribution is retained on adapted modules. Firebase, remote game storage, image loading, Svelte UI components, and analytics are not used in VF.

The same image list used by the app's opening-page offline downloader was resolved to **234 downloaded reference files**, totaling about **122 MB**. `images/consume_tech.png` returned 404 from the original server. The sheets retain their original card ordering/grid metadata in `resources/asset-manifest.json`; `resources/asset-downloads.json` records every result. No downloaded game artwork is referenced by the served interface.

## Changes to the rules/UI boundary

- Plain local stores replace the framework's store API. All runtime imports are local ES modules.
- A rules worker validates commands against the current pending decision. It preserves the reference implementation's nested choices, action effects, combat calculations, Crisis and Alert resolution, House triggers, and solo scoring.
- A setup seed and command log replace serializing pending callbacks. Loading and undo replay in a new worker. Hidden deck order and the current decision are reproduced from that seed and log.
- All rules-tied Skirmish targets remain eligible, but their display order is stable by sector ID instead of using unseeded `Math.random()` while sorting. This prevents display ordering from undermining deterministic saves.
- The original implementation's label “First Contact” is presented as the official **First Stand**, matching the supplied game references and the repository's combat calculator.
- Only the eight official co-op/solo scenarios for one player are exposed. Competitive, multiplayer, custom-map, and community-challenge setup are not exposed.
- House/Crisis effects outside a selected Focus are exposed only during the player's selection/actions portion, rather than during clean-up.
- Stale unused imports that the reference app's bundler removed were removed explicitly so the modules load directly without a build.

This adaptation inherits the reference implementation's rules interpretations. Browser playthroughs and integration tests do not constitute a new exhaustive audit of every House/Technology/Crisis interaction. The original PDFs and official errata remain the authority.

## Visual references and local libraries

- WM commits `84af6e7` and `b1497fb`: visual hierarchy, material-specific SVG pieces, meaningful color, consistent typography, detailed inspection, and mobile decisions.
- Pathfinder, WM, and KEV: folder-local HTML/CSS/JavaScript, no build step, local autosave, undo, share codes, and a dedicated import URL.
- The repository's `voidfall/` combat calculator remains available from the combat details sheet.
- VF interface SVGs are hand-written code in `js/icons.js` and `js/house-emblems.js`. The fourteen House insignia are vector interpretations of the actual emblems on the downloaded House mats. No raster crops are served.
- Barlow and Oxanium are served locally with their SIL Open Font Licenses in `fonts/`.
- LZ-String is the existing repository library, copied locally for compressed game codes.
