# On Mars — Rules Reference (2 players: you vs. Pathfinder)

A compact summary of the base game rules, in our own words, as the engine implements them. Pathfinder's
own behaviour is in [PATHFINDER.md](PATHFINDER.md); piece values are in [COMPONENTS.md](COMPONENTS.md).
Items marked **Clarification** come from the community-compiled designer/editor rulings (OnMarsNotes v7).

Shorthand: M Mineral, B Battery, W Water, P Plant, O Oxygen, C Crystal, OP Opportunity Points,
LQ Living Quarters, WA Working Area, AB Advanced Building.

---

## 1. Setup (2 players)

1. Discovery tiles shuffled face down; 2 face up on the Exploration space (Pathfinder changes this — see its setup).
2. Warehouse: 2 each of C, B, W, P, O.
3. Tech Grid: one set of 8 regular Tech tiles placed face up at random; the other set leaves the game.
   Shelter Techs go to the players.
4. Blueprints: L1 deck stacked on L3 deck; deal the top 6 (all L1) into the display.
5. Scientists in order Geologist, R&D Engineer, Hydrologist, Biochemist, Geochemist, Systems Engineer;
   Contract deck beside them.
6. Starting Mine on the centre hex; the four starting LSS buildings randomly on their four hexes.
7. Building stacks shuffled by type, back side up. Research tiles: one type per corner.
8. Missions: 2 Short + 1 Long (short game) or 1 Short + 2 Long (long game) on corners A/B/C; tracker cubes
   on the 2-player target; Remaining Missions marker on 3.
9. LSS markers on row 1; Colony level marker on row 2 (Colony level 1); 4 random LSS Reward tiles on top.
10. Each player: board, 1 of each resource, 1 C, Shelter Tech on Lab column 2 middle, 5 ships on the Depot,
    1 Shelter on their starting hex (2p: just above / just below centre) with 1 Bot on it, 3 more Bots,
    8 AB markers, 3 colonists in LQ + 9 in supply, Rover (virtually on the centre Mine), 5 Progress cubes,
    3 Private Goals.
11. Choose turn order spaces and take their benefits (Pathfinder: random First Colonist tile, no benefit).
    The Shuttle starts on a red travel space (Pathfinder: its own side).

## 2. Round structure

Each round = **Colonization phase** (every player takes one turn, in turn order 1 → 8) then
**Shuttle phase**.

On your turn: **exactly one Main action** (from the side your marker is on) plus **at most one Executive
action** before or after it.

- Crystals you gain go *below* your Depot and only enter it at the start of your next turn (overflow is lost).
- Resources are usable immediately; storage cap per resource is Shelters + 1, excess is lost.
- **Clarification:** finish the main action before the executive action (or vice versa) — no interleaving.
- **Clarification:** colonists or crystals gained during an action can't boost that same action, but
  resources gained by the first repetition of a boosted action can pay for the next.

## 3. Placing colonists on actions (2 players)

Actions showing a red colonist need one of your LQ colonists on an action slot.

- If every slot is full, first send back (to their owners' WAs) all colonists of whoever has the most there
  (ties: all tied players).
- Then pay **1 C or 1 colonist (LQ → WA) for each colonist already on that action**, yours or the opponent's.
- Hire a Scientist has one slot per colour; you can't use it while your colonist is there, and its slots
  never clear by the full rule.
- Boosting ("teal colonist") means sending LQ colonists to your WA for the listed extra effect.

## 4. Orbit main actions

| Action | Rules |
|---|---|
| **Landing Pod** | Travel to the Colony right now: skip the Discovery tile step, do Retrieve Colonists, pick a Colony turn order space (with benefit). Your turn is then over. |
| **Obtain Blueprint** | Take a display card; gain its printed item; put one of your AB markers on it (no marker → can't take). No refill. Boost: +1 card per colonist. |
| **Learn New Technology** | Take a Tech tile into an empty space of Lab column 1, paying by row (bottom free, middle 1 B, top 1 B + 1 any). Gain that Lab space's benefit. One tile per type per player. Boost: 1 colonist → a second tile. |
| **R&D** | Develop one Tech twice or two Techs once. Each step moves a tile to an adjacent empty space one column right, paying that column's cost; gain the new space's benefit. Boost: +1 development (any tile) per colonist. |
| **Resupply** | Take 1 item (resource or crystal) from the Warehouse — only if you have room. Boost: +1 per colonist. |

## 5. Colony main actions

### Control Center
2 movement for Bots (split freely) and 2 for the Rover, in any order; each crystal in your Depot buys
+1 movement for either; a Rover Tech adds its level to Rover movement.
- Pieces may pass through but not stop on a hex with an AB marker, a colonist, another Bot or a Rover.
- A **Bot** ending on a Discovery/Research tile destroys it; ending on a crystal returns it to supply.
- A **Rover** collects crystals it passes or stops on. If it ends on a tile it takes it, provided it doesn't
  already have that Research type, can pay any cost, and can use at least part of the benefit (otherwise it
  may not stop there). Resolve the tile immediately.
- The Rover's first move starts from the centre Mine.

### Construct a Building
1. Choose a type: Mine, Generator, Water Extractor, Greenhouse, Oxygen Condenser, or your next Shelter.
2. Pay: Generator 1 M, Water 1 B, Greenhouse 1 W, Oxygen 1 P, Shelter 1 O, Mine = place an LQ colonist on it.
3. Place it on a hex **without a building** inside one of your Bots' building zones (Bot hex + 6 neighbours),
   either
   - **adjacent** to a building of that type (forms/extends a complex — needs a Tech of that type whose
     level ≥ the total number of same-type buildings being joined), or
   - **exactly 2 hexes** from a building of that type and not adjacent to any.
   Your Shelters and the opponent's are different types.
4. Crystal arrows on the tile back put a crystal on each empty pointed-to hex.
5. Gain items equal to the new complex size (1 if standalone): the building's resource, crystals for a Shelter,
   minerals for a Mine.
6. First time you create or grow a complex of a type (not Shelters): move that Progress cube to the Progress area.
7. LSS buildings: raise that marker one row (max top). First rise off row 1 → 2 OP. If the marker was **below**
   the Colony level marker before moving → score that column's LSS Reward tile, then choose one LSS benefit
   (Bots 2 · 1 M · 1 C · retrieve a colonist).
   - **Clarification:** score first, then the benefit. No LSS bonus for Mines or Shelters.
   - **Clarification:** "most developed Tech" reward = the column level, not its end-game OP.
   - **Clarification:** the colonist reward counts only colonists in LQ.

### Displacement (build or upgrade)
Crystal on the hex → supply. Discovery/Research tile → box. Bot/Rover → its owner moves it to the closest
hex that is empty or holds only a building. Upgrading also returns a colonist on a Mine to its owner's LQ (or
supply if full). **Clarification:** the Bot can still build even if the displaced position leaves its zone.
Rovers "in garages" on the centre Mine are never displaced.

### Upgrade a Building
Pay 1 M; move the AB marker from one of your Blueprints onto a matching building in a Bot's zone.
- L1: any building of that type. L3: the building must be in a complex of 3+.
- Each building and each Blueprint only once. Shelter Blueprints only on your own Shelters.
- Efficient Upgrading Tech: up to *level* extra upgrades.
- Anyone may upgrade a Mine; a colonist there goes home.

### Hire a Scientist or take an Earth Contract
Take one card from the display, paying the printed cost (Scientist costs vary; Contracts 1 C). At the end of
your turn refill the space with a Contract of your choice from the deck.
- Scientists can be moved into a matching AB (any owner's) just before using its action; both the Scientist's
  owner and the building's owner then use that action for free.
- Delivery contracts: put items on them at any time; complete if fully stocked at game end.
- Upgrade contracts: complete if you have an AB marker on a complex of that type of size 4+ at game end.
- **Clarification:** contracts may be completed at the start or end of any player's turn, in turn order.

### Welcome a Ship
Pay 1 P + 1 W; move any one ship from Depot to Hangar (this opens its Depot space and Executive action);
gain 1 colonist + 1 Bot, or 2 colonists. Colonist Capacity Tech adds up to its level in colonists.
New Bots go on an empty Shelter of yours (or the nearest empty hex to one). Total ships ever removed from the
Depot ≤ Colony level. Boost: +1 ship (paid and rewarded normally) per colonist.

## 6. Executive actions

Pay the crystals shown beside an uncovered Depot space (see COMPONENTS §3.2). A matching Scientist working
in an AB makes the AB action free. **Boosting Tech with colonists:** on AB actions showing a teal colonist,
each colonist sent to WA counts as +1 Tech level. A Private Goal card in hand can be spent as a crystal
(not for contracts).

## 7. Using Tech

Whenever an action can be improved by a Tech of the right type, you may use one tile — yours or the
opponent's. If you use the opponent's, they take 1 O; at the end of your turn they may instead develop that
tile one step for free (with its space benefit) and return the O.
**Clarification:** each use earns a separate O. Owners resolve these before any Colony level update.

## 8. Colony Status Update

Triggered when every LSS marker has reached the Colony level marker's row. It resolves at the end of the
current player's turn (after Tech-owner rewards):
1. Colony level marker up one row.
2. Blueprint display: level 2 → clear and deal 12; level 3 → remove L1 cards and add the last 6 L3.
3. Tech Grid refill — skipped in 2 players.
4. Warehouse refilled to 2 of each.
5. Levels 2 and 3 only: score the Progress area (1/2/4/7/11 OP for 1–5 cubes).
6. Level 3+ advances the Remaining Missions marker (level 3 and 4 each −1); level 5 triggers the end.
7. Each new level lets every player remove one more ship from their Depot.

## 9. Missions and the end trigger

Contributing to a mission pays its crystals and moves its cube; when it reaches the checkmark the mission is
complete and the Remaining Missions marker moves. **Clarification:** a boosted action that completes a mission
partway through only pays the mission once more.

The end is triggered at the end of a Colonization phase in which the Remaining Missions marker reached the
end: 3 completed missions, or fewer at higher Colony levels (2 at level 3, 1 at level 4, 0 at level 5). Finish
the round, then play **one more round without a Shuttle phase**, then score.

## 10. Private Goals

On your turn, if you meet a goal's requirement you may reveal it and take one of its two rewards. Only one
goal per game. Any unrevealed goal may be discarded to act as one crystal.

## 11. Shuttle phase

1. Move the Shuttle one space toward the middle; if it was already on the red space 1, it **travels** instead
   to the other side's travel space equal to the Colony level (level 4: it no longer moves; level 5: one last
   trip then removed).
2. In turn order each player decides to travel or stay. Travelling is free if the Shuttle just left your side;
   otherwise discard a ship from your Hangar. Staying keeps your space (no new benefit).

**Travel to the Colony:** (1) place one face-up Exploration tile on an empty hex exactly 3 from your Rover
(or the centre Mine) — if no such hex, skip — and refill from the stack; (2) Retrieve: colonists on Colony
action slots and in your WA return to LQ (overflow → supply); (3) take an empty Colony turn order space and
its benefit.

**Travel to Orbit:** (1) Production: each of your ABs makes 1 of its resource (AB Shelter → 1 C), each of your
colonists or ABs on Mines makes 1 M; (2) Retrieve: colonists from Orbit action slots and your WA → LQ;
(3) take an empty Orbit turn order space and its benefit.

## 12. End of game scoring

Move crystals gained last round into the Depot. Return colonists from the action slots on your current side
and from your WA to LQ (fill shelters bottom up; **Clarification:** colonists on Mines stay). Then add:

| Category | OP |
|---|---|
| Progress area | 1/2/4/7/11 for 1–5 cubes |
| Ships in Hangar | 3 each |
| Living Quarters | 3/6/10/15/21 by highest occupied tier |
| Tech tiles | 1/2/3/4/5/9 by Lab column |
| Blueprints | built L1 +3, L3 +5; unbuilt L1 −3, L3 −5 |
| Scientists | 3 per AB of the scored type on Mars (any owner) |
| Contracts | as printed (+12/−6 upgrade, +9/−4 delivery); items may still be moved onto contracts now |

Most OP wins. Base-game tiebreaks: most crystals, then most ABs, then most Progress cubes, else shared.
**Against Pathfinder, you win all ties.**
