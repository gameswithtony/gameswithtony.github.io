# The Token Trail — UI Spec v2 (aligned with PLAN.md)

*Mobile-first, touch-first, pleasantly retro. Text and SVG only.*

---

## Principles

1. **Menus, not widgets.** Oregon Trail was a numbered-list game, and numbered lists are the most touch-friendly UI ever accidentally designed. Every decision is a full-width tappable row (≥44px). Number keys work on desktop. Authentic and thumb-friendly are the same choice.
2. **One virtual pixel.** Fixed logical stage (640×400). One CSS var — `--px: calc(var(--scale) * 1px)` — sizes every border, glyph, and gap. Desktop: proportionally scaled, letterboxed stage (DOSBox-fullscreen feel), `--scale: min(vw/640, vh/400)`. Mobile (portrait, < ~700px): break the aspect ratio, reflow to a single column — office as a banner, status strip, menu anchored low in the thumb zone.
3. **SVG retro, no bitmaps.** Flat 16-color EGA fills, thick outlines, checkerboard dither via SVG `<pattern>` for shading, `shape-rendering: crispEdges` where chunk matters. Characters are SVG groups with swappable poses. Bitmap-style webfont (Web437 VGA) with monospace fallback.
4. **No hover-dependent information.** Anything a tooltip would say is either visible, or a tap away. Touch is the primary input; mouse is the guest.
5. **The art leaks the truth.** Hidden state never appears as numbers, but it shows in the fiction: posture, typing speed, empty chairs, phone-scrolling. The dashboard flatters; the room doesn't.

## The frame

Persistent status strip (top on desktop, under the banner on mobile):

```
MONTH 7 · JUL   $3,250   ⚡62   REVIEW ▮▮▮▯▯   CD ▓▓▓░░   [🤝☺]   [☺][😐][☹]
```

Money, Energy, review capacity pips, Cognitive Debt meter, the **client mood face** (the relationship readout — the ledger itemizes the dollars), one mood face per hire. All tap-to-explain: tapping CD opens a one-liner ("Work no one here understands. Multiplies incident damage."). Confidence bars appear only on the skills panel — chunky segmented LED bars with dithered fill. Understanding appears nowhere. That's the game.

---

## Screens

### 1. TITLE
Logo in big dithered type, deadpan OT-style menu: *Travel the year / Continue the year (when a save exists) / Learn about the trail / See the Top Ten*. Top Ten is localStorage scores with names — the Oregon Trail hall-of-fame homage.

### 2. PROFESSION
Pick your class. Four SVG portraits, stats as segmented bars, multiplier stated plainly: *"Craftsperson: the hard way. ×2.5 points."*

### 3. OUTFITTING (the general store)
The clerk behind a counter (SVG, one raised eyebrow). Two category rows: **Hires / The Model**. Hires open candidate cards — name, salary, trait, resume bar labeled *"claimed"*. No reference checks: the resume is all you get, and the first check is the first truth. Model tier as three boxed cards with stat lines. Running total and monthly burn projected at the bottom: *"Burn: $850/mo against $2,500/mo contract."* Clerk mutters contextual blurbs.

### 4. MONTH HUB (the office — the wagon screen)
The centerpiece. Top two-thirds: the office scene. Four desks — you and up to three hires. The scene renders state:

- Typing speed = workload (CSS `steps()` animation, duration from a var).
- Slumped on desk = morale sinking; leaning back scrolling a phone = the AI is doing their work.
- Empty chair with boxes on the desk = never hired. Chair still spinning = just quit.
- Monitors glow when the model works; a small rack in the corner bears the model tier's nameplate.
- The window shows the season: one per quarter. Snow melts, leaves fall, the year passes behind glass.

Below, the OT question: **"It is month 7. What will you do?"**
*1. Assign the work (2 waiting · 1 in the backlog) · 2. Spend your focus · 3. Look at the year · 4. Continue.*
"Look at the year" is the map: a road across four quarters, landmarks flagged, crossings behind you marked with what they cost.

### 5. ASSIGN THE WORK
One card per task — fresh tasks first, then backlog items marked ⏳: name, domain icon, difficulty pips. Four route buttons per card: **DO IT · AI · AI+REVIEW · GIVE TO ___**. Routes that don't exist (no hire, no capacity left) render as empty sockets — absence is visible, not hidden. A fresh task left unrouted slips to the backlog (the confirm row says what that costs). Confirm returns to the hub.

### 6. FOCUS
Four rows: **Build it yourself** (picks up an unrouted task) · **Go bug hunting** · **Rest** · **Sit down with ___**. One choice, then back.

### 7. THE HUNT (whack-a-mole)
Grid of code panels (2×3 mobile, 3×3 desktop), plausible dimmed pseudo-code. Bugs pop as chunky SVG glyphs with timed windows — tap to fix. Ammo pips (remaining capacity) top-left, 45-second timer bar top-right, running tally bottom. Big targets, fat fingers welcome. Exit line deadpans the count: *"You fixed 4 bugs."* (What it doesn't say: how many surfaced.)

### 8. EVENT / MAJOR
Full-screen card, dithered border. Icon, event text, choices as tappable rows — each row carries **derived axis icons** (💰⚡🧠🚚🤝) showing which of the five balances the choice puts at stake (never the numbers), and checks are marked with the target: *(you)*, *(Priya)*, *(anyone)*. Resolution beat on the same card, and when a check targeted you, the reveal in small caps beneath: **YOU BELIEVED: 78. REALITY: 41.** Majors get a wider frame and a landmark title plate: *"THE SECURITY AUDIT — Q2."*

### 9. QUARTER STORE
The outfitting screen, revisited: hire/fire, switch model (costs a task slot). The clerk remembers you.

### 10. BOOKS (month close)
A ledger stamp, three seconds, tap to skip: revenue, SLA penalties in red, slip fees, goodwill lines, payroll, tokens, net. Then the office again, one month older.

### 11. GAME OVER / POSTMORTEM
Death: **the LinkedUp post** — a cartoony LinkedIn-parody card with a LinkedUp header (original parody wordmark, not a clone of LinkedIn's branding). Class portrait as avatar, name + title, timestamp ("Month 8"), the post body typing itself in — chirpy announcement voice (*"Thrilled to share I'm exploring new opportunities…"*) — the cause line in clinical deadpan beneath (*"Laid off: the AI did 90%, and they couldn't do the 10%."*), and a small reactions row. Oregon Trail's typed-epitaph ritual, preserved in the new fiction.
Any ending: **the postmortem** — an SVG line chart, Confidence vs. Understanding across twelve months, the gap shaded, the client's arc alongside. A marker on the month the run was lost. Then the score, the multiplier, the Top Ten table, initials entry.

### 12. RENEWAL REVIEW (month 12 major)
Same event frame, higher stakes staging: the client across a table, three questions drawn against your skills and CD (client happiness tilts the difficulty). Pass or fail, the calibration chart follows — the ending is always a mirror.

---

## Input & accessibility

- Tap targets ≥ 44px; entire menu rows are hit areas, not just labels.
- Desktop: number keys select menu items, Enter confirms — the 1990 keyboard interface, free.
- All state readable as text (the office scene is decorative truth, never the *only* truth — mood faces in the strip mirror what posture shows).
- `prefers-reduced-motion`: typing animations settle to stills; the hunt keeps its timers but drops shake/flash.
- Landscape phones get the desktop stage, scaled.

## Implementation notes

- One `<svg>` per scene component (office, portraits, LinkedUp card, chart), inline in JS template literals so fills inherit CSS vars — palette lives in one place.
- Poses are `<g>` visibility swaps; animation is CSS `steps()` on transforms. No canvas, no rAF loops outside the hunt timer.
- The hub screen re-renders like everything else: state → template. The office is a pure function of `visibleState`, which is the no-leak guarantee in pictures.
- Auto-save is invisible UI: every applied decision persists silently; the only surface is *Continue the year* on the title screen.
