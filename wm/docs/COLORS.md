# Board color in the practice app

The reference is the supplied main board and player board, checked against the board setup spread (printed pages 4–5) in `resources/wm_rulebook_v28.pdf`. Research images stay under ignored `resources/`; the interface uses CSS colors and original SVGs.

The board combines blue-green metal and sky, ivory panels, copper machinery, and three distinctive location colors: Government indigo, Lab sage, and R&D mauve. Its weather bands use navy rain, pale stone wind, burnt orange sun, brown fog, and ice blue snow. These are interpreted hues, adjusted for screen contrast rather than exact samples of printed/shaded artwork.

| Role | Light text/accent | Dark text/accent | Use |
| --- | --- | --- | --- |
| Government indigo | `#4e537e` | `#c1c7ef` | Location header, vouchers, funding, Office column |
| Laboratory sage | `#53643c` | `#c4d2a1` | Location header, vouchers, funding, Lativ |
| R&D mauve | `#795671` | `#dfbbd5` | Location header, vouchers, funding, Office column |
| Copper | `#8d542d` | `#e3bb8b` | Supply, Workshop, Office, Awards |
| Blue-green | `#256674` | `#9bd4d9` | Decisions, selection, navigation |

Light mode uses ivory reading surfaces over a cool gray-green background. Dark mode uses blue-green charcoal with restrained sage, indigo, and mauve washes. Brightening foreground colors independently from background washes preserves readability in both themes.

Location colors repeat only where they mean the same thing. Each location's panel has a solid nameplate in its color; panels that are not locations use the header slate. Solid weather flags mark branches, cards and the sticky defeat-clock strip. Each of the five colors carries its own symbol: a drum is a Chemical, a gear is a Machine Part, and Workshop tile edges are colored half-circles. Brass gears hold CP values and orange shields hold Science costs. Experiments are drawn as blueprints and Security Reports as simple cards banded by Agent. Bot spaces tint by owner: blue-green for you, red for the Saboteurs, sage for Lativ. The icon inside still names the owner. Active branches still say “Active,” occupied spaces still name the Scientist, the strip counts Extreme Weather levels in bars, and navigation selection has a bar. Color adds recognition without carrying the rule alone.

Keyboard focus uses a contrasting copper/gold ring. Disabled choices keep readable reasons. The browser QA measures rendered text contrast across all tabs in both themes and checks phone, tablet, and desktop layout; the measurements are saved under ignored `resources/browser-qa/contrast.json`.
