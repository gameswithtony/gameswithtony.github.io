# Voidfall: design decisions

## What WM improved

Reviewed recent commits with GitHub CLI, then inspected `84af6e7` and `b1497fb`, including `icons.js`, `views.js`, `polish.css`, `typography.css`, `tips.js`, and the mobile dock.

The visual changes matter as much as the flow changes:

- **Pieces became recognizable objects.** Chemicals became drums and Parts became gears, with their own five symbols. Owner-specific Bots have different silhouettes. Color is accompanied by shape.
- **The board gained landmarks.** Solid location nameplates and hanging weather flags establish identity; unrelated panels stay quiet. Experiment blueprints, Security Reports, the Assembly Line, and Research Office use different structures because they represent different things.
- **Typography became a system.** Numbers, titles, and labels have distinct roles. The scale and weights are controlled in one place; a maximum never looms larger than the current value.
- **Information predicts consequences.** The Table exposes the next Saboteur movement, Experiment timing, Citation locks, progress, and defeat clocks. The decision tray exposes live costs instead of making the player infer them.
- **Inspection is independent from commitment.** Every item has specific help; the `?` can explain a choice without taking it. Back/Skip/End turn sit outside scrolling options, with a double-tap guard.

VF carries those ideas forward through its own component language, rather than applying another decorative skin to rectangular business panels.

## Subject and job

The subject is a Voidfall solo game against the Voidborn. The player needs to read the galaxy, see the next threat, inspect their development options, and make a legal decision quickly on a phone. The map is the table's signature; the interface around it is deliberately restrained.

## Tokens

| Role | Color | Use |
| --- | --- | --- |
| Abyss | `#0d1020` | Deep navy background |
| Hull | `#181d32` | Stable reading surfaces |
| Parchment | `#eee7d9` | Primary text and Population dice |
| Gold | `#d5b274` | Actions, references, hierarchy |
| Ion | `#69d4da` | Your fleets, ownership, selections |
| Corruption | `#d98bb7` | Corruption and Crisis identity |
| Voidborn | `#e99467` | Opponent fleets and target |

These choices come from the physical sectors' navy, blue-green, magenta, and orange, with the game's warm gold interface details. The PDFs' parchment becomes a small foreground material, especially for Population, rather than a light theme. Resource colors remain distinct and always have their own symbols and names.

**Type:** Oxanium 600 for the wordmark, major headings, and headline scores; Barlow 400/500 for prose and supporting labels; Barlow 600/700 with tabular numerals for compact game readings. All fonts are local. Dense labels are restrained; the main game values remain large.

## Layout and signature

```text
Phone                         Wide screen
Score / Cycle / menu          Score / Cycle / menu
Five stockpiles + yields      Five stockpiles + yields
Event / Skirmish / upkeep     Event / Skirmish / upkeep
                              Navigation
Galaxy or selected view      House rail | Galaxy / selected view | Decision
                              (all available together)
Current decision (collapse)
Back / Finish / Confirm
Galaxy House Cards Void Log
```

The sector is a 240 × 208 flat-top hex with an inner hull line and restrained orbital marks. Its internal hierarchy is consistent: coordinate/owner, name, guilds/vacancies, Population die and fleet silhouettes, installations/Harbingers, then rewards. Gold edges identify legal targets. Cyan fills and checks mark selection. Corruption changes the hull treatment and adds its own symbol.

The deliberate aesthetic risk is making the real sector map the central information surface, retaining pan/zoom on a phone instead of replacing the galaxy with a list. A single sector remains legible at normal zoom, and all fine rules live in sheets. Fit and center controls provide orientation. Map position survives inspection, decisions, and tab changes.

## Critique and revisions

- Rejected a generic dashboard opening with detached totals. The score and resource strip is compact, while the actual scenario map anchors both setup and play.
- Rejected one generic icon for all material and fleet categories. The SVG vocabulary uses distinct silhouettes, geometric guild symbols, a physical Population die, and production dials.
- Kept the palette specific to Voidfall. Cyan indicates the player, plum Corruption, and rust the opponent; gold is for interaction and structure.
- Browser screenshots exposed the loss of map position after changing tabs, collisions between resource labels and yields, and the need to distinguish unavailable actions from completed ones. The map state persists and the stockpile readings use separate rows.
- Actual browser interaction exposed an initialization race in the worker and an acknowledgment gap after multi-selection. The app now waits for worker readiness and acknowledges selection changes before accepting the next command.
- Bonus effects moved out of the fixed footer after narrow-screen review. Only navigation and completion controls belong there.
- The user explicitly chose **Log**, not Journal. That name is used in navigation, the screen title, and user-facing save explanations.
- House insignia were redrawn from the fourteen actual House mats, replacing arbitrary rotated box crests. Their distinctive silhouettes share the original lower pennant.
- Decision destinations use component names and matching symbols: Society track, Statecraft track, Economy track, Agenda slots, storage and Fleet Power. Engine IDs stay out of choice labels.
- Payments have one commit action. A played Focus appears as an unboxed context header with a separate info button, keeping it distinct from the action choices.

There is no official artwork in the served UI. Reference sheets and PDFs remain local research material.
