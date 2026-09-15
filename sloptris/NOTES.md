# Sloptris implementation notes

SPEC.md is the source of truth. These are the places where the implementation had to
decide something the spec leaves open or gets wrong. Code comments that mention a
"CONTRACT resolution" refer to the numbered items here.

1. **Mutation candidates for I and O.** SPEC 6.2 says every tetromino bounding box admits a
   different tetromino. That is false for I (4x1) and O (2x2). Rule used: compute candidates
   in the tight bounding box; if there are none, widen the box by one cell along its shorter
   axis (toward the higher index when that stays inside the frame or well, else the lower)
   and retry. Generate-time targets widen as far as the 4x4 local frame allows (I gets a 4x2
   box, O a 3x2 box). Board-aware picks (refactors, and the lock-time fallback in item 12)
   widen at most `TARGET_WIDEN_MAX` (2) steps so a boxed-in piece stays instead of moving to
   a distant empty area.
2. **Retro buttons on coarse pointers.** On a coarse pointer the stats block omits its
   `[enter] again` line and the hint row shows `[again]` (and `[help]`, item 17) in place
   of `[generate]` `[clear]`.
3. **Ticket number.** The ticket title is `TICKET #{n}` where n is the id the piece will get,
   starting at 1.
4. **Spawn orientations** in the 4x4 local frame, `(x, y)` with y down:
   I (0,1)(1,1)(2,1)(3,1); O (1,0)(2,0)(1,1)(2,1); T (1,0)(0,1)(1,1)(2,1);
   S (1,0)(2,0)(0,1)(1,1); Z (0,0)(1,0)(1,1)(2,1); J (0,0)(0,1)(1,1)(2,1);
   L (2,0)(0,1)(1,1)(2,1). The piece spawns with its topmost cell in well row 0 and local
   x=0 at well column 3.
5. **Rotation.** Clockwise: cell `(x, y) -> (3 - y, x)`; outline vertex `(vx, vy) -> (4 - vy, vx)`.
   A piece stores `orientation` as a rotation count 0..3 applied to its spawn-frame cells;
   `targetLocal` is stored in the spawn frame and rotated by the same count. Wall kicks try
   `(0,0) (-1,0) (1,0) (-2,0) (2,0) (0,-1)` in that order.
6. **The 19 orientations** used for workbench matching and mutation candidates are
   normalized cell sets (min x = min y = 0), deduplicated, tagged with the shape letter.
7. **Backgrounded tab.** Elapsed time per clock tick is capped at 1000 ms so a throttled tab
   cannot chain several deadlines at once. The falling piece is driven by
   `requestAnimationFrame`, which browsers pause in hidden tabs, so a hidden tab's piece does
   not fall while the clock keeps counting.
8. **`locking` state.** Between a piece landing and the return to Spec, the lock pipeline
   (mutation beat, refactor beat, line flash) runs with `state = 'locking'`. It is never
   saved; for the deadline rule it counts as Falling; workbench input is ignored during it.
9. **Pointer type.** `matchMedia('(pointer: coarse)')` decides the hint row, the how-to
   controls block, the sound toggle label and the retro buttons. `body.coarse` mirrors it.
10. **Assistant `…` beat.** The `…` line is pushed instantly, the change applies after the
    beat, and the same line is then replaced by the typed assistant line. Saved chat lines
    are the completed texts.
11. **Held inputs.** A held R or Down key (or a touch hold) ends when the piece locks; the
    next piece needs a new press.
12. **Lock-time fallback target.** SPEC 6.2 says a target that does not fit at lock fizzles,
    full stop. Measured against a snug-placing player (see Tuning), 61% of rolled mutations
    fizzled that way, which is why mutations felt rare next to refactors, which never fizzle.
    Rule used: if the pre-rolled target does not fit and the piece was **not reviewed**, pick
    a new target against the live board, the same way a refactor does (bounding box, widen at
    most `TARGET_WIDEN_MAX`, no overlap, inside the well). If that finds nothing, the fizzle
    stands. A **reviewed** piece never falls back: the outline the player paid for is a
    promise, and placing it where that shape cannot fit is the intended counterplay. The
    fallback consumes PRNG at lock, so the run is still deterministic for the same inputs.
    Caveat: the `show hidden targets` dev toggle draws the pre-rolled target, so when the
    fallback fires the result on the board will differ from the outline that was shown.
13. **Dev panel close.** SPEC 10.2 gives only the backtick to close the panel, which a touch
    device does not have and which the keyboard handler ignored while a dev field had focus.
    Added an `[x]` in the panel's top border, made backtick work from inside a dev field
    (blurring it), and made Escape and Enter leave a dev field. Checkboxes, radios and the
    cue dropdown blur themselves after a change, and a pointer click on any button blurs it,
    so the next Space or Enter goes to the game instead of re-clicking the control.

14. **Review threshold and the answer's look.** SPEC 6.4 sets the charge threshold at 6 rows
    (about 7 seconds at review gravity). Playtesting found that too long; `REVIEW_THRESHOLD`
    is 3 (about 3.6 seconds), still editable in the dev panel. The pulse in 6.4 is kept, and
    two things are added on top because the pulse alone was easy to miss: when the charge
    reaches the threshold the whole well flashes the highlight and drains over
    `REVIEW_FLASH_MS` (600) while a ring runs out from the piece; and for the rest of the
    fall the reviewed piece is drawn as one tetromino, seams closed, fill pushed toward the
    highlight, with its **final** shape stroked in the highlight. For a stable piece that is
    its own silhouette; for a mutating piece it is the target outline, which replaces the
    dim 40% accent stroke the spec asked for. Same palette, no new hue.

15. **Sprint goals (2026-09-15).** SPEC 7 has the clock as the only sprint pressure: at 0:00
    the sprint counter just increments. The owner asked for a shipping goal per sprint and a
    clock that is impossible to miss. Rule used: `GOALS_LINES` (3, 4, 5, 5, 5, dev-panel
    editable) is the number of lines to clear within the sprint (`G.sprintLines`,
    `G.sprintGoal`, both saved). Meeting it ends the sprint at once, mid-lock, right after
    the line clear; the clock resets to the next deadline. Lines cleared past a goal carry
    forward (capped at goal - 1), so a four-line clear is never wasted. **Missing the
    deadline ends the run** (owner's call, replacing an earlier carry-over draft): the
    auto-generate of SPEC 7 and the `AUTOGEN` line are gone, `deadlineReached` calls
    `endRun('deadline')`, the same path as top-out (`G.overReason` is saved so a reload lands
    on the same retro). Presentation: the header shows `{k}/{goal} lines` and a much larger
    clock (24px bold; 18px on phones) right after the sprint label, over the well, not
    pushed to the far right; both flare and swell for 0.9 s at a transition and the clock
    pulses in the danger state. The well flashes and a band across its upper third reads
    `SPRINT n DONE` then `SPRINT n+1 / ship g lines / by m:ss` for `SPRINT_BANNER_MS`
    (3000) and the status bar carries the same line for that long. On a missed deadline the
    band is held (`hold: true`, no flash or fade, no animation loop) reading
    `DEADLINE MISSED / sprint n / k of g lines`, the assistant types one last upbeat line,
    and the retro head reads `Sprint {n} deadline missed with {k} of {goal} lines shipped.`
    (top-out keeps its head plus `k of g lines shipped this sprint`). The 11.5 lines
    `Sprint {n} done. Sprint {n+1} deadline is {m:ss}.` and the 1:00 variant are replaced.

16. **Title and how-to copy (2026-09-15).** The owner found SPEC 11.1 and 11.2 too long and
    asked for a ruthless rewrite in his own voice. The title body and the four how-to
    paragraphs in index.html and in `COPY` are new text (about half the length); the
    controls lines are unchanged. The paragraphs no longer name keys ("press G", "hold R"),
    because the same paragraphs show on touch devices where there is no G or R; they use the
    game's own verbs, generate and review, and the controls block under them maps each verb
    to a key or a gesture.

17. **A visible way into how-to-play.** SPEC 8 reaches the how-to after the title only by
    `?` or by tapping the sprint label, and nothing on screen said so. The fine-pointer hint
    row now ends with `[?] help` and the coarse-pointer button row has a `[help]` button
    (shown during play and on the retro). The sprint-label tap still works.

18. **No sharing.** The owner dropped the share feature (2026-09-15): SPEC 11.7 share text,
    the `S` key and `[share]` button on the retro (SPEC 8, 11.6), the `copied.` status line
    (11.5) and the share-text seed suffix (10.2) are all gone. The retro controls line is
    `[enter] again`. The clipboard helpers stay only for the dev panel's seed copy button.

19. **Audio assets (2026-09-15).** The owner asked for royalty-free retro music and effects.
    Shipped: sixteen CC0 Ogg Vorbis clips from Kenney's Interface Sounds and Digital Audio
    packs, chosen by name and by measured length (move and rotate are 7 to 20 ms clicks,
    the rest 100 to 1000 ms), and Juhani Junkala's CC0 "Level 1" chiptune as `loop.mp3`,
    downmixed to mono and encoded at 96 kbps (891 KB, 74 s, 9 ms of silence at each end).
    The manifest now names `.ogg` for those sixteen cues; `mutate`, `refactor`,
    `review_charge` and `typing` keep their synthesized versions on purpose (see the
    audio.js header). A browser that cannot decode Ogg Vorbis falls back to the synth per
    cue. Credits and the file-to-clip mapping are in audio/README.md, and the how-to
    screen ends with a one-line credit. No ffmpeg was available, so the MP3 was made with
    lamejs in a scratchpad script; the WAV originals are not in the repo.

20. **New game during play.** SPEC only starts a run from the title, the resume screen or
    the retro. Added `N` during play (fine pointer, listed in the hint row) and a `[new]`
    button (coarse pointer, hidden on the retro where `[again]` already is). The first press
    shows `Press n again to throw this run away.` (touch: `Tap again ...`) and turns the
    button into `[throw it away]` for `NEW_CONFIRM_MS` (3000); a second press inside that
    window calls `newRun`. Any state is allowed, including mid-lock: `newRun` bumps
    `G.runId` and `runLock` re-checks it after each of its awaits, so a pipeline from the
    old run stops touching the new board.

## Tuning

Defaults in `CONFIG` differ from the numbers in SPEC 6.1 after playtesting. The owner found
mutations too rare and refactors too frequent. A headless simulation (an all-generate
player with a greedy hole-avoiding placement, 200 seeded games) measured:

| rule set | rolled at streak 5+ | visible at streak 5+ | fizzle of rolled | refactors per 100 generated |
|---|---|---|---|---|
| spec: 10/20/35/50/60, refactor 25, no fallback | 60% | 23% | 61% | 14 |
| spec table + fallback (item 12) | 60% | 54% | 11% | 14 |
| 15/25/40/55/65, refactor 10, fallback | 64% | 57% | 11% | 6 |
| **shipped: 25/40/55/70/80, refactor 10, fallback** | not measured | not measured | | |

The first tuning pass lifted the low-streak odds so a player who builds every few tickets
still sees a change now and then. A second pass (2026-09-15) raised every entry by 10 to 15
points after the owner still found mutations too rare in play; the simulation was not
re-run for that row. `REFACTOR_CHANCE` 10 makes a refactor roughly one in twelve max-streak
pieces at the new odds. All of it stays editable in the dev panel.

## Testing

No automated framework, per the site's convention. Throwaway Node harnesses were used during
development to check the shape math, the lock pipeline, a full run to top-out and the
mutation odds in the Tuning table; they are not part of the site. Manual checks in Chrome covered the checklist in SPEC.md
section 14 over http; opening `index.html` directly from disk was not exercised in a browser.
