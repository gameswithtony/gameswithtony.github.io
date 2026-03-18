# Removing AI Special Rules While Maintaining Competitiveness

## The Three Special Rules to Remove

### 1. Coal Market Bypass
**Where:** `generateAICoalConsumption` lines 3608-3622 — takes from coal market unconditionally without checking `isConnectedToMarket`. Compare with human's `humanConsumeLocations` lines 1057-1073 which explicitly checks connectivity.

### 2. Beer Bypass for Selling
**Where:** The AI's sell execution at lines 2812-2822 flips tiles (completes the sale) without ever checking if sufficient beer is available. Beer consumption at lines 2834-2871 runs AFTER the sell — it's opportunistic, not required. The computed property `findPlayerUnflippedSellableIndustriesConnectedToMarket` also has no beer check.

### 3. Guaranteed Sale in Last 3 Rounds
**Where:** Lines 1962-1977 — dice roll with increasing probability. If the AI hasn't sold this era and it's round 8+ (2-player), a die is rolled: `rollDie(1, roundsRemaining+1)`, sell on 1. Last round = guaranteed.

---

## Why These Rules Exist — The AI's Structural Weaknesses

The AI's decision-making is fundamentally **card-driven and distance-based**. It doesn't plan ahead. The special rules compensate for:

1. **No strategic planning:** The AI draws 2 cards and reacts. It builds at the location the card says. It networks to the closest unconnected thing. There's no lookahead, no goal-setting.

2. **No resource awareness in build decisions:** When the AI draws "Stafford" and tries to build a Coal Mine there, it doesn't check whether Stafford has coal access. It just builds and assumes coal is available from the market.

3. **No beer awareness in sell decisions:** The AI's sell trigger is "both cards are industry cards" or "guaranteed sale timer." It doesn't check if it HAS beer before committing to sell.

4. **Networking is industry-agnostic for resource industries:** When the AI builds a brewery/coal/iron, it networks toward the "closest unconnected unflipped industry" — it doesn't consider WHAT that industry is or whether it needs a market/merchant connection.

---

## Strategy for Removal

The core principle: **Replace blanket bypasses with smarter decision-making.** Rather than letting the AI cheat the rules, make it play better within the rules.

### Approach A: Incremental — Add Checks, Keep AI Otherwise the Same

**Coal market check (smallest change):**
- In `generateAICoalConsumption`, add `isConnectedToMarket(locationid, player_type)` check before the market fallback at line 3608
- If NOT connected: the AI simply can't build tiles requiring coal unless connected coal mines have it
- Risk: The AI may fail to build frequently, especially early game when few links exist

**Beer check for selling:**
- Before selling, calculate total beer needed and total beer available (own unflipped breweries + connected opponent breweries + merchant beer)
- Only include tiles in `industriestosell` where beer can be sourced
- If no beer at all: sell fails, fall back to NetworkCouldntSell
- Risk: The AI may rarely sell, accumulating unsold tiles

**Remove guaranteed sale:**
- Simply delete lines 1962-1977
- Risk: Combined with beer requirement, the AI may go entire eras without selling

**Net effect of Approach A:** The AI becomes significantly weaker. It would frequently be unable to build (no coal access) or sell (no beer). The distance-based networking doesn't compensate because it doesn't prioritize coal/beer/merchant connections.

### Approach B: Smarter Networking (Recommended)

The highest-leverage change is making the AI's **network decisions resource-aware**. Currently the AI networks toward the closest unconnected location. Instead:

**New network priority for resource industries (Coal/Iron/Brewery):**
1. If the built tile is a Coal Mine → network toward the coal market (if not already connected)
2. If the built tile needs connectivity → network toward merchants or coal sources
3. Fall back to closest unconnected industry (current behavior)

**New network priority for sellable industries (Pottery/Cotton/Manufacturer):**
1. First: Connect to a matching merchant (current behavior, already exists)
2. **New:** If connected to merchant but no beer access → network toward a brewery
3. Fall back to closest unflipped industry

**New pre-build check:**
- Before the AI commits to building at a location, check if the tile's coal cost can be met:
  - Connected coal mines have enough coal, OR
  - Location is connected to coal market
- If not: **try the next build priority** or **skip this card's location and try the other card**
- This replaces the bypass with intelligent avoidance

**Beer-aware selling:**
- New function: `findAISellableIndustriesWithBeer(player_type)` that filters `findPlayerUnflippedSellableIndustriesConnectedToMarket` to only include tiles where beer is available:
  - Own unflipped breweries (anywhere — per rules, own beer doesn't require connection)
  - Connected opponent breweries
  - Merchant tile beer at the connected merchant
- Only sell tiles where beer can be sourced
- Sell as MANY tiles as beer allows (don't sell all-or-nothing)

### Approach C: Smarter Networking + Build Adaptations

Everything from Approach B, plus:

**Adaptive brewery building:**
- Track a flag: `aiNeedsBeer` — set to true when the AI has unflipped sellable industries but failed a sell due to no beer
- When `aiNeedsBeer` is true, the next build action prioritizes brewery regardless of drawn card
- This simulates a human player thinking "I need to brew before I can sell"

**Coal-aware location selection:**
- When an industry card is drawn (no location), the AI currently tries adjacent locations to the other card
- Enhancement: Filter adjacent locations to those that have coal access (for tiles needing coal)
- This prevents building in coal-dead locations

**Merchant-proximity bias for sellable industries:**
- When building Pottery/Cotton/Manufacturer, prefer locations closer to merchants
- Current behavior tries the drawn location first; enhancement would check if an adjacent location with merchant access is available

**Replace guaranteed sale with proactive sell-seeking:**
- Instead of a dice roll, have the AI actively check for sell opportunities each round (not just when both cards are industry)
- If the AI has sellable industries with beer AND matching merchant access: sell
- Check this BEFORE the build decision
- This replaces the artificial timer with genuine strategic awareness

---

## Recommended Implementation — Phased Approach

### Phase 1: Enforce Rules + Minimal Smartness
Goal: Remove bypasses, add just enough intelligence to keep the AI functional.

1. **Coal market check in `generateAICoalConsumption`** — add `isConnectedToMarket` guard
2. **Pre-build coal check in `calculateAIAction`** — skip builds where coal can't be met
3. **Beer-aware sell filter** — only sell tiles with beer access
4. **Remove guaranteed sale**
5. **Adjust "can't sell" fallback** — when AI can't sell due to no beer, prefer networking toward breweries

### Phase 2: Smarter Networking
Goal: Make the AI earn its competitiveness through better decisions.

6. **Network toward coal market** — when building coal-consuming tiles, prioritize market connectivity
7. **Network toward breweries** — when the AI has unsold industries but no beer access
8. **Brewery urgency flag** — if AI has 2+ unsold sellable tiles and no unflipped brewery, force brewery build on next opportunity

### Phase 3: Tuning & Difficulty Levels
Goal: Balance and optionality.

9. **Playtest and adjust** — the AI will be weaker initially; tune brewery priority and network weights
10. **Difficulty setting per rule** — let players choose which rules to enforce:
    - Apprentice: All bypasses active (current)
    - Professional: Coal market check enforced
    - Manager: Coal + beer enforced
    - Titan: All rules enforced, smarter AI

---

## Complexity Assessment

| Change | Lines of Code | Risk | Impact |
|--------|--------------|------|--------|
| Coal market guard | ~5 lines | Low | Medium — prevents market usage without connection |
| Pre-build coal check | ~15 lines | Medium | High — avoids wasted builds |
| Beer-aware sell filter | ~25 lines | Medium | High — prevents sells without beer |
| Remove guaranteed sale | Delete ~15 lines | Low | Medium — sell frequency drops |
| Network toward market | ~20 lines | Medium | Medium — improves coal access over time |
| Network toward brewery | ~20 lines | Medium | High — key for beer access |
| Brewery urgency flag | ~10 lines | Low | Medium — ensures brewery gets built |
| Difficulty levels | ~30 lines | Low | High — lets players choose |

**Total estimate:** ~150 lines of new/modified code across all phases.

---

## Key Risks

1. **AI becomes too weak:** The biggest risk. Without beer, the AI may rarely sell, losing massive VP potential. Mitigation: brewery urgency + smarter networking.

2. **AI gets stuck in loops:** Can't build (no coal) → can't sell (no beer) → networks randomly → still can't build/sell. Mitigation: pre-build checks + targeted networking.

3. **First-round bootstrapping:** The AI has no links at game start. Coal-requiring builds would fail immediately. Mitigation: The AI already prioritizes Brewery first (no coal needed), and Coal Mine costs 0 coal. Only Iron Works (1 coal) and some Manufacturer tiles need coal. The AI board starts at Level 2+ tiles, so most early builds are viable.

4. **Merchant tile randomization:** If matching merchants are far from the AI's industries, even smart networking may not help. This is an existing issue not caused by the rule changes.

---

## Alternative: "Soft" Rule Removal

Instead of hard enforcement, use the rules as tie-breakers or cost modifiers:

- **Coal:** AI takes from market but pays a VP penalty (e.g., -2 VP per market coal without connection)
- **Beer:** AI can sell without beer but flipped tiles get reduced VP (e.g., half income increase)
- **Guaranteed sale:** Keep but start later (last 2 rounds instead of 3)

This preserves AI competitiveness while adding a cost to the bypasses, creating a sliding scale rather than a cliff.
