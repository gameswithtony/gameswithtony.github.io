# Eliza Bug Analysis & Fix Plan

## Context
Full code review of `eliza/app.js` (~4900 lines) and `eliza/data.js` (~1600 lines) for the Brass: Birmingham solo opponent app. The app is a Vue 2 application running in-browser with no build step, managing AI opponents (Eliza, Eleanor) and full game state.

---

## CONFIRMED BUGS

### BUG 1: Wrong variable in AI iron market depletion (CRITICAL)
**File:** `app.js:2931`
```javascript
// CURRENT (wrong):
if (c.coalConsumed > ironInMarket) {
// SHOULD BE:
if (c.ironConsumed > ironInMarket) {
```
**Impact:** When the AI buys iron from the market, the guard check uses `c.coalConsumed` (which is undefined in an iron consumption entry, so always falsy). This means the `else` branch always executes, which works correctly for normal cases. But if `ironConsumed > ironInMarket` (edge case: market nearly empty), the market goes negative instead of being floored to 0. The coal consumption block at line 2898 has the correct pattern.

**Fix:** Change `c.coalConsumed` to `c.ironConsumed` on line 2931.

---

### BUG 2: VPs subtracted instead of LinkVPs in setupRailEra (MODERATE)
**File:** `app.js:3061, 3064`
```javascript
// CURRENT (wrong):
l.possibleLinkVPs = l.possibleLinkVPs - s.tile.VPs;
l.totalLinkVPs = l.totalLinkVPs - s.tile.VPs;

// SHOULD BE:
l.possibleLinkVPs = l.possibleLinkVPs - s.tile.LinkVPs;
l.totalLinkVPs = l.totalLinkVPs - s.tile.LinkVPs;
```
**Impact:** When clearing Level 1 tiles at the start of the Rail Era, the code subtracts `VPs` (victory points) instead of `LinkVPs`. For example, Cotton Mill I has VPs=5 but LinkVPs=1 - the code subtracts 5 instead of 1. The `calculateScore` function recalculates link VPs from actual tiles rather than reading these cached fields, so **scoring is not affected**. However, any UI or logic reading `totalLinkVPs` or `possibleLinkVPs` will show corrupted values in the Rail Era.

**Fix:** Change `.VPs` to `.LinkVPs` on both lines.

---

### BUG 3: Mismatched null/undefined check for AI second network link (MODERATE)
**File:** `app.js:2793`
```javascript
// CURRENT (checks different variables):
if (this.currentPlayer.nextAction.actiondata.linktargetlocationid3 !== null
    && this.currentPlayer.nextAction.actiondata.linktargetlocationid4 !== undefined) {

// Line 2781 checks the SAME variable correctly:
if (this.currentPlayer.nextAction.actiondata.linktargetlocationid1 !== null
    && this.currentPlayer.nextAction.actiondata.linktargetlocationid1 !== undefined) {
```
**Impact:** Line 2781 correctly checks id1 for both null and undefined. Line 2793 checks id3 for null but id4 for undefined. If id3 is `undefined` (not null), `undefined !== null` is `true`, potentially triggering a network lay with an undefined location.

**Fix:** Change to check `linktargetlocationid3 !== null && linktargetlocationid3 !== undefined`.

---

### BUG 4: AI market consumption loop off-by-one for large amounts (LOW)
**File:** `app.js:3617, 3700`
```javascript
// CURRENT (subtly wrong for amounts >= 4):
for (let i=0; i <= neededCoal - consumedCoal; i++) {
    spaceConsumeData.coalConsumed++;
    consumedCoal++;
}
```
**Impact:** The `<=` with dynamic `consumedCoal` in the condition causes under-consumption for amounts >= 4. Traced behavior: need 1 -> gets 1 (ok), need 2 -> gets 2 (ok), need 3 -> gets 2 (WRONG), need 4 -> gets 3 (WRONG). With current game data max cost is 2, so **unreachable now** but a latent defect.

**Fix:** Capture remaining before loop:
```javascript
let remaining = neededCoal - consumedCoal;
for (let i = 0; i < remaining; i++) { ... }
```
Same fix for iron at line 3700.

---

### BUG 5: Property name typo on Iron Market consume entry (LOW)
**File:** `app.js:1140`
```javascript
coalAvailable: totalIronNeeded - totalIronAvailable,  // should be ironAvailable
```
**Fix:** Change `coalAvailable` to `ironAvailable`.

---

### BUG 6: Incomplete Southern Farm (location 22) handling (LOW - likely dead code)
**File:** `app.js:3282-3284`
When `locationid2 === 22`, only lays 21-25 link but misses 22-21 and 22-25 links (which the `locationid1 === 22` case at line 3276 does lay). However, location 22 only connects to 21 and 25, so this branch is effectively unreachable with current board topology.

**Fix:** Add missing `layNetworkTileBase` calls to match the locationid1 === 22 case.

---

---

## USER-REPORTED BUGS

### REPORT A: Stale action data causes coal consumption on Canal Era networking (CONFIRMED BUG)
**User report:** "It's making me consume coal to build links in the canal era."
**Root cause:** When a player starts a Build action for a tile that costs coal, `consumelocations.coal` is populated at line 836-837. If the player then goes back and switches to a Network action, the stale `consumelocations` data is never cleared. The Network action's Canal Era path (line 932) goes directly to confirmation step '13' without resetting `consumelocations`.

The confirmation screen (`getHumanActionDescription`, line 1444) and execution (`executeNextHumanAction`, line 1711) both check `consumelocations.coal` unconditionally - they don't check which action type is being performed. So the stale coal consumption from the cancelled Build action gets displayed AND executed during the Network action.

**Code trace:**
1. User starts Build → `setHumanBuildLocationAndSpace` (line 836) sets `consumelocations.coal`
2. User goes back → `prevBuildActionConfirm` / `prevSetHumanAction` do NOT clear `consumelocations`
3. User selects Network → `setNetworkLocationFrom` (line 885) sets `action = HUMAN_ACTION.Network` but does NOT clear `actiondata.consumelocations`
4. Canal Era → `setNetworkLocationTo` (line 932) goes to step '13' without clearing stale data
5. `executeNextHumanAction` (line 1711) sees `consumelocations.coal` and executes it

**Fix:** Clear `consumelocations` when entering the Canal Era network confirmation. At line 932, before `setHumanAction('13')`, add:
```javascript
this.humanPlayer.nextAction.actiondata.consumelocations = {};
```
A more robust fix would also clear stale data when ANY new top-level action is selected (in `setHumanAction` when actionStep is null, '00', '10', '20', '30', '40', '50').

---

### REPORT B: Cannot overbuild on AI player tiles (RULES QUESTION)
**User report:** "Overbuilding on Eliza/Eleanor's coal mines and ironworks doesn't seem to function. Trying to overbuild my level 3 coal mine on Eleanor's flipped level 2 coal mine in Wolverhampton - option didn't appear."
**Also reported:** "Not being able to overbuild on Eliza's flipped level 2 ironworks with my level 3 ironworks in Coventry."

**Code:** `validHumanBuildLocationsForIndustryType` at line 299:
```javascript
let isAIPlayersTile = (s.tile !== null && s.tile !== undefined && s.tile.color !== self.humanPlayer.color);
```
Line 301 then excludes all AI tiles:
```javascript
if (_.includes(s.types, industrytype) && !isAIPlayersTile && ...)
```

**Analysis:** The code **explicitly blocks** building on any space occupied by an AI player's tile. Per standard Brass: Birmingham rules, you can only overbuild your OWN tiles (same industry type, higher level). Other players' tiles block the space.

**Decision needed:** Is this intentional (following standard rules), or should the solo variant allow the human to overbuild on AI tiles? If you want to allow it:

**Potential fix** (if desired): Change line 301 to allow overbuilding on AI tiles with same industry type and lower level:
```javascript
let canOverbuildAITile = isAIPlayersTile && s.tile.flipped
    && s.tile.industrytype === industrytype
    && s.tile.level < self.humanPlayer.nextAction.actiondata.buildtile.level;

if (_.includes(s.types, industrytype) && (!isAIPlayersTile || canOverbuildAITile) && ...)
```

---

### REPORT C: AI repeatedly can't sell, does double network instead (DESIGN ISSUE)
**User report:** "AI double builds rail few times in a row as it can't sell, however it has sell options (cotton from kidderminster to shrewsbury). During the entire game the AI didn't produce a single beer."

**Analysis:** The AI uses the computed property `findPlayerUnflippedSellableIndustriesConnectedToMarket` (line 2302) to determine what it can sell. When this returns empty, the AI falls back to `AI_ACTION.NetworkCouldntSell` (line 2326+). This requires ALL of:
1. The AI has unflipped Manufacturer/CottonMill/Pottery tiles
2. Those tiles' locations are connected to a Merchant via network links (ANY player's links)
3. The Merchant location has a merchant tile with matching `industryTypes`

**Likely causes for the reported issue:**
- **Merchant tile mismatch:** In 2-player, 5 merchant tiles are placed (2 with null industryTypes that accept nothing, 3 with specific types). If the random placement puts CottonMill-accepting tiles far from the AI's cotton mills, the AI can never sell cotton.
- **No connectivity in Rail Era:** Each era uses separate edge arrays (`edgesCanal` vs `edgesRail`). Canal Era links don't carry over to Rail Era. If neither player has built rail links connecting the AI's industries to matching merchants, the AI can't sell.
- **Northern location exclusion:** In 2-player, the AI path-finding at line 4169 excludes ALL locations with id < 8 (Warrington, Stoke, Leek, Belper, Stone, Uttoxeter, Derby, Nottingham). This includes merchants Warrington (id 0) and Nottingham (id 7). So the AI can never sell through those two merchants.

**This is primarily a strategic/design issue rather than a code bug.** The AI doesn't prioritize connecting to matching merchants when networking. Possible improvements:
1. When AI does "NetworkCouldntSell", prioritize building links TOWARD matching merchants
2. Adjust AI build priority to build near connected matching merchants
3. Consider making the AI's sell check less restrictive (e.g., not requiring merchant tile industry type match, since the AI already has a beer handicap)

---

### REPORT D: Same as Report B (AI Iron Works overbuild)
See Report B above. Same root cause - `!isAIPlayersTile` at line 301 blocks all AI tiles.

---

## CODE QUALITY ISSUES (not functional bugs)

1. **Inconsistent spaceid convention:** AI coal/iron uses 0-indexed, AI beer/human uses 1-indexed. Each pair is consistent but confusing.
2. **Loose equality for numberOfPlayers:** Compared with string `'2'` using `==` throughout (initialized as number `2`).
3. **Variable shadowing:** `let self = this` declared at line 1631 and re-declared at line 1782 in same function.
4. **Empty `updateTurnOrder`:** Line 3292-3296 is a stub for an unfinished feature.
5. **Scoring re-entrancy:** `calculateScore` adds VPs additively, guarded by finished flags. If flags fail to persist, scores inflate.

---

## FIX PLAN

### Priority 1 (game-affecting bugs)
1. **Line 2931:** `c.coalConsumed` -> `c.ironConsumed` (Bug 1)
2. **Line 3061:** `s.tile.VPs` -> `s.tile.LinkVPs` (Bug 2)
3. **Line 3064:** `s.tile.VPs` -> `s.tile.LinkVPs` (Bug 2)
4. **Line 2793:** Fix null/undefined check to use `linktargetlocationid3` for both (Bug 3)
5. **Line 932:** Clear `consumelocations` before Canal Era network confirmation (Report A)

### Priority 2 (correctness)
6. Line 1140: `coalAvailable` -> `ironAvailable` (Bug 5)
7. Lines 3617, 3700: Fix market consumption loops (Bug 4)
8. Lines 3282-3284: Complete location 22 handling (Bug 6)

### Priority 3 (design decisions needed)
9. **Report B:** Allow overbuilding on AI tiles? (needs your decision)
10. **Report C:** Improve AI sell connectivity strategy? (design change)

### Priority 4 (code quality, optional)
11. Standardize spaceid convention
12. Strict equality for numberOfPlayers
13. Remove redundant `let self = this` at line 1782

---

## VERIFICATION
No automated tests exist. Manual browser testing:
1. **Bug 1:** Play until AI buys iron from nearly-empty market -> verify market count doesn't go negative
2. **Bug 2:** Play through Canal Era with level 1 tiles -> verify Rail Era transition doesn't corrupt link VP tracking
3. **Bug 3:** Have AI build double network in Rail Era -> verify both links placed
4. **Bug 4:** Code inspection only (unreachable with current data)
5. **Bug 5:** Open iron consume UI with market as only source -> verify display
6. **Bug 6:** Code inspection only (unreachable with current topology)
7. **Report A:** Start Build for a coal-consuming tile, go back, then do Canal Era Network -> verify no coal consumption prompt
8. **Report B:** (If fix applied) Try overbuilding on AI's flipped coal mine/iron works in Rail Era -> verify it appears as option
