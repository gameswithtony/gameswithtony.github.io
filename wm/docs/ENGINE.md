# Engine notes · Weather Machine

## Structure

The engine follows the existing Pathfinder and KEV architecture: plain JSON state, a seeded RNG, and a stack of plain-object tasks. `engine.js` registers the task handlers and exposes `newGame`, `answer`, and `choices`. Every answer is validated against the current prompt before it changes state.

- `state.js`: setup, shared board queries, research, Lativ, weather layers, end triggers.
- `economy.js`: legal voucher compositions, executive exchanges, material plans, inventory benefits, construction, and Workshop extensions.
- `workshop.js`: permanent tile placement, actual storage spaces, and bipartite matching for free resource rearrangement.
- `office.js`: research placement, Awards, citations, publications, Investments, Goals, and funding.
- `actions.js`: human Location actions and prototype planning.
- `bots.js`: the official Saboteurs' movement, printed priorities, Hideout, and havoc. No custom opponent scoring or planning function.
- `flow.js`: initial Supply, rounds, human turns, experiments, income, and final scoring.
- `saves.js`: save validation, compression, and physical conservation checks.
- `views.js`, `icons.js`, `app.js`, `styles.css`, `mobile-dock.css`, and `typography.css`: dependency-free browser interface and original graphics. The fonts in `fonts/` are the same Barlow / Barlow Semi Condensed families used by KEV, served locally. Current/max values share their size and baseline. Mobile action-drawer expansion is UI state, separate from the game snapshot, and persists across view changes.

## Rules applied

The supplied base v28 and solo v0.99 PDFs are the initial rules source. The published Solo v8 corrections are applied: only one havoc set is resolved per Saboteur turn, and all three research colors are consumed when an unlocked-weather set contains all three. Source links and printed-page references are in [RULES.md](RULES.md).

All 30 Workshop tiles are the actual ten faces, three copies each, from the nested TTS tile objects. Goal setup rejects repeated center-icon families across all six Goals, including visually identical icons with different thresholds. Main action spaces stay open as required by the solo setup. Lab branches have their actual differing capacities.

Weather is a stack of physical layers. Worsening covers an existing tile and clears its markers; fixing returns only the top tile to its reserve, exposing the tile underneath. The three Government markers and twelve Awards are limited. Awards spent by the Saboteurs leave play.

Nested benefits finish before the parent action continues. Research space benefits precede receipt of research, publication benefits precede publication scoring/unlocking, and Breakthrough-space benefits precede prototype construction. A prototype may use the Part gained from its marker space.

## Explicit interpretations and automation

These points deserve comparison with an experienced physical-game playthrough; they are not additional solo rules.

1. **Call Security with a short deck:** unavailable when fewer than two cards remain in the deck, because the supplied instruction requires drawing two and supplies no partial-draw procedure.
2. **Free rearrangement:** inventory is automatically rearranged into legal Workshop spaces. Identical items of the same color are interchangeable. For prototypes, matching verifies an actual single-row arrangement and preserves unspent Parts outside that row when possible. If extra Parts must remain in the row, the choice states how many are discarded.
3. **Five token types in an Office column:** weather Research types, Award, and Citation are treated as distinct token types, following the literal component description. Filling a column counts all tokens, including Awards and Citations.
4. **Saboteur Awards:** multiple Awards can fill missing research colors, including a set consisting entirely of Awards. A real Research token is required for human publication, but the solo set rule does not state the same restriction.
5. **Research usefulness:** a duplicate-color token does not count as newly completing a set already complete in the Hideout. After completion priority, the printed other-color match and any-research priorities apply.
6. **No Saboteur Bot available:** the Saboteurs cannot place another Bot beyond their twelve. Preliminary effects that do not require a Bot still happen; an unavailable placement is skipped.
7. **Bot returns:** Workshop storage is used when it fits. Overflow offers the player every empty space in the top two Assembly sections, since the choice changes income. Assembly Bot identities have no distinct abilities.
8. **Combined Challenges:** separate starting extra-Chemical or Award effects add independently when multiple corresponding Challenges are selected.
9. **Funding position zero:** Government funding gives the printed initial voucher; Lab funding gives zero Science and then the other chosen track at modifier zero. Zero benefits remain zero.

The app does not expose hidden Report order or offer a nonofficial opponent. The discard pile, Current and Previous Reports, visible Experiment display, next Experiment, and all normal public board information remain inspectable.

## Verification limits

Automated tests cover the critical interactions and state invariants. Legal random play checks a complete game after every decision, including limited Bots, Chemicals, Workshop tiles, weather tiles, Awards, and Report cards. Those simulations make poor strategic moves and are not a difficulty or win-rate assessment.

The browser-extension connection was initially unavailable, but a subsequent run using installed headless Chrome completed browser verification. `dev/headless.mjs` passed 414 checks with Chrome 156.0.8078.81: seven viewport widths (320–1600px), all five views, actual UI actions, detail dialogs, save/load and undo, dark mode, and a complete game to its result screen. Mobile checks verify fixed tabs, the collapsible action drawer above them, unchanged docking while scrolling, preserved state across tab changes, safe-area spacing, and unobstructed pointer targets. Typography checks verify all seven local font faces, equal-size current/max voucher readings, readable labels and action text, and text staying inside controls. No browser runtime errors, document overflow, dialog overflow, or tested text clipping were found. Representative screenshots were visually reviewed; outputs remain in ignored `resources/browser-qa/`.

Responsive device frames are also supplied in `dev/devices.html`. Actual touch-device usability and component/rules transcription should still receive an experienced player's review before treating this implementation as an authoritative rules reference.
