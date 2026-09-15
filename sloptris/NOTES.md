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
   `[enter] again    [s] copy share text` line and the hint row shows `[again]` and `[share]`
   in place of `[generate]` `[clear]`.
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

## Tuning

Defaults in `CONFIG` differ from the numbers in SPEC 6.1 after playtesting. The owner found
mutations too rare and refactors too frequent. A headless simulation (an all-generate
player with a greedy hole-avoiding placement, 200 seeded games) measured:

| rule set | rolled at streak 5+ | visible at streak 5+ | fizzle of rolled | refactors per 100 generated |
|---|---|---|---|---|
| spec: 10/20/35/50/60, refactor 25, no fallback | 60% | 23% | 61% | 14 |
| spec table + fallback (item 12) | 60% | 54% | 11% | 14 |
| **shipped: 15/25/40/55/65, refactor 10, fallback** | 64% | 57% | 11% | 6 |

The shipped table lifts the low-streak odds (15% and 25% at streak 1 and 2) so a player who
builds every few tickets still sees a change now and then, and `REFACTOR_CHANCE` 10 makes a
refactor roughly one in seventeen max-streak pieces instead of one in seven. Both stay
editable in the dev panel.

## Testing

No automated framework, per the site's convention. Throwaway Node harnesses were used during
development to check the shape math, the lock pipeline, a full run to top-out and the
mutation odds in the Tuning table; they are not part of the site. Manual checks in Chrome covered the checklist in SPEC.md
section 14 over http; opening `index.html` directly from disk was not exercised in a browser.
