# Pathfinder — Solo Mode Reference (v1.0 + errata)

Pathfinder is Tony Alicea's unofficial solo opponent for On Mars, borrowing some rules from Vital Lacerda's
official "Lacerda" solo mode. This file restates the Pathfinder rules with both errata applied inline, then
lists the interpretations the app's engine uses where the rules leave room.

Base rules: [RULES.md](RULES.md). Pieces and the 12 solo cards: [COMPONENTS.md](COMPONENTS.md).

---

## 1. Setup

Set up a normal 2-player game, with these changes:

1. Pathfinder gets **no Rover**. It only moves Bots.
2. Pathfinder gets **no Private Goals**.
3. Set aside the **6 Discovery tiles that give specific resources or crystals**.
4. Shuffle the other **13** Discovery tiles and use them for steps 5–7.
5. One face-down Discovery tile on the left of LSS **row 3**.
6. Two face-down Discovery tiles on the left of LSS **row 4**.
7. Three face-down Discovery tiles on the left of LSS **row 5**.
8. Shuffle the remaining 7 with the 6 set aside → the Discovery stack (2 face up on Exploration as normal).
9. Shuffle the 12 solo cards face down.
10. Pathfinder's starting turn order space = a random **First Colonist tile** (spaces 2, 3, 4, 6, 7, 8). You
    choose your own space and take its benefit; **Pathfinder never takes turn order benefits**.
11. The Shuttle starts on the red space on **Pathfinder's side**.

## 2. Workers, Tech, resources, crystals

- Pathfinder **always has every worker it needs**.
- It **always uses Tech when available**; when it uses your Tech you gain 1 O (or develop, as normal).
- It **never stores or pays** resources or crystals. Anything it would gain goes to the general supply.

## 3. Pathfinder's turn

1. Draw the top solo card (if the deck is empty, reshuffle all cards first).
2. Perform the action numbered on the astronaut, for the side Pathfinder is on (§5).
3. If the deck has been **exhausted at least once**, also move the Mission tracker cube of the card's letter
   (A/B/C) one space. *This is the only way Pathfinder advances missions.*
4. After an action on the **Colony** side, Pathfinder moves one Bot (§7).

If the card's action is impossible, Pathfinder takes a **Move Bots** action instead.

## 4. Card Order tiebreaking

Whenever Pathfinder must choose between hexes (where to build, which Bot, which building to upgrade…) or
between turn order spaces, look at the **most recently drawn solo card**.

**Hexes** — sweep the map column by column until the first valid hex:

| Card | Sweep |
|---|---|
| 1, no X | columns left → right, each column top → bottom |
| 2, no X | columns right → left, each column top → bottom |
| 3, no X | columns left → right, each column bottom → top |
| any card with X | columns right → left, each column bottom → top |

**Turn order spaces:**

| Card | Space (Orbit / Colony) |
|---|---|
| 1, no X | 1 / 5 |
| 2, no X | 2 / 6 |
| 3, no X | 3 / 7 |
| any card with X | 4 / 8 |

If that space is taken, use the next space to its left; if that's impossible, the next space to its right.

## 5. Actions

### Orbit side

**1 — Obtain Blueprint.** Take a Blueprint of a type scored by Pathfinder's Scientists, preferring the type that
scores highest (most Blueprints of that type in the game). Tie → leftmost card of the row holding the most cards
(bottom row if tied). Pathfinder keeps its Blueprints in a line, oldest on the left.

**2 — Learn New Technology.** Take the cheapest tile, leftmost if tied. Place it in Lab column 1, top space
first, and take that space's benefit as normal.

**3 — Research & Development.** Develop the most-developed Tech that can move once, then the least-developed
Tech that can move once. Ties → the bottom tile. Each move goes **right-and-down if possible, otherwise
right-and-up**. Take benefits as normal, except crystal and specific-resource benefits are ignored; Resupply
and other benefits are taken.

**Resupply** (only from a Colony Status Update or an R&D/Lab benefit): take the resource your **built**
Blueprints produce least (so resources none of your ABs produce come first). Tie → the one least produced by all
your Blueprints, built or not. Tie → leftmost available.

### Colony side

**1 — Construct a Building.** *(Errata #2 applied)* Pathfinder builds only building types whose LSS marker is
**below the Colony level marker** — it never builds Mines with this action (the only Mine it can ever build
comes from a Discovery tile). It may build on any available hex on Mars — Bot positions don't matter. It always
builds the **largest complex possible**, using any available Tech. Multiple valid hexes → Card Order.
Afterwards apply normal Progress cube and OP rewards. For the second LSS benefit: if Pathfinder has a colonist
on the Hire a Scientist slot it retrieves it; otherwise it ignores the benefit.
- *Difficulty modifier #2:* if several types tie for the largest complex, choose the type whose LSS Reward tile
  gives Pathfinder the most OP right now; leftmost if tied.

**2 — Upgrade a Building.** Choose the Blueprint that adds the most OP through Pathfinder's Scientists; if none
does, the oldest Blueprint. Use Tech if available to upgrade as many buildings as possible. Target buildings by
Card Order.

**3 — Hire a Scientist or take an Earth Contract.** If any Contract is on display, take the one worth the most OP
(leftmost if tied). Otherwise take the Scientist that would score the most potential OP from the Blueprint cards
owned by **you and Pathfinder together** (built or not). Tie → the one scoring Pathfinder's own Blueprints,
oldest first; with no Blueprints, the leftmost Scientist. Then shuffle the Contract deck and refill the display
with its top card.

## 6. Shuttle phase

*(Errata #1 applied)* Pathfinder **always travels with the Shuttle** unless the most recent solo card shows an
**X beside the cube**. With an X it does not travel; instead it moves to turn order space **4 (Orbit) or
8 (Colony) on the side it is already on** (Card Order rules for occupied spaces). It never takes turn order
benefits.

Travelling to the Colony, Pathfinder:
1. Chooses one of its Bots by Card Order.
2. Places the **leftmost** Exploration Discovery tile **3 hexes from that Bot**, at least 3 hexes from all its
   other Bots, and as far from your Rover as possible (Card Order for ties).
3. Skips Retrieve Colonists.
4. Chooses a turn order space by Card Order.
- *Difficulty modifier #1:* it then also performs Colony Action 1 (Construct).

Travelling to Orbit, Pathfinder skips Production and Retrieve Colonists, then chooses a turn order space by Card
Order.

## 7. Move Bots

After any Colony-side action (Card Order for every hex choice):
1. Choose one Bot by Card Order.
2. Move it a number of hexes equal to the **current Colony level** toward the nearest Research tile, Discovery
   tile, or crystal.
3. If it lands on one, it stops there and removes that tile/crystal from the game.

## 8. Colony Status Update extras

On every update, after the normal steps:
1. Pathfinder gains the benefits of the face-down Discovery tiles on the row the Colony level marker just moved
   onto (row 3 → 1 tile, row 4 → 2, row 5 → 3), using the matching Pathfinder action rules. Then remove them.
2. Pathfinder builds a Shelter.
3. Pathfinder gains a Bot and places it on that new Shelter.
4. Pathfinder welcomes a ship (to its Hangar) but gains no Bot or colonists from it.
5. After the Warehouse refill, Pathfinder takes a Resupply action.

## 9. Difficulty

| Level | Modifiers |
|---|---|
| Rookie | none |
| Chief | #1 (build when landing on the Colony) |
| Legend | #1 and #2 (break type ties by LSS Reward OP) |

## 10. End of game

For Pathfinder's score: no penalty for unbuilt Blueprints; every Living Quarters space counts as occupied; every
Contract counts as completed. Highest OP wins — **ties go to you**.

---

## Engine interpretations

Decisions the app makes where the rules are silent or open:

1. **Action slots.** Pathfinder places a colonist on red-colonist action slots for free and never pays the
   extra placement cost. It never retrieves them, except through the LSS second benefit on Hire a Scientist.
   Slots still clear under the normal full-slots rule.
2. **Your use of Pathfinder's Tech.** Pathfinder develops that tile (right-and-down, else right-and-up) if it
   can, taking benefits by its R&D rules; otherwise nothing happens.
3. **Placement freedom.** Pathfinder's Upgrade, like its Construct, ignores Bot building zones. For Construct it
   only uses hexes with no piece on them (no Bot, Rover or colonist); crystals and tiles on the chosen hex are
   removed.
4. **Fallback Move Bots.** When the card's action is impossible, Move Bots replaces it. On the Colony side this
   is its one Bot move for the turn (no second move).
5. **X cards and travel.** With an X card, in every Shuttle phase Pathfinder moves to space 4 (Orbit) / 8
   (Colony) on its current side (occupied → next left, else next right). Without an X it travels only when the
   Shuttle departs from its side.
6. **R&D order.** "Then the last developed Tech" is read as the least-developed Tech (as in Lacerda's rules).
   Ties → the bottom-most tile. The second development is chosen after the first resolves; the same tile may be
   chosen again if it is the only one that can move.
7. **Obtain Blueprint.** Candidates are display cards whose building type is scored by one of Pathfinder's
   Scientists; prefer the type with the most Blueprints already owned by both players. Ties, and the case with
   no Scientists, → leftmost card of the row with the most cards, bottom row if tied.
8. **Upgrade.** First the unbuilt Blueprint whose type its Scientists score (oldest first); otherwise the oldest
   Blueprint with a legal target. With Efficient Upgrading, repeat with further Blueprints by the same order.
   Target buildings by Card Order.
9. **Hire ties.** Between Scientists with equal potential OP → the one scoring the type of Pathfinder's oldest
   Blueprint, then leftmost.
10. **Discovery tiles at a Colony update.** "Construct depicted type" builds that type regardless of the LSS
    restriction (the Mine exception from errata #2). "Construct any" follows Action 1. Develop → R&D; Blueprints
    → Obtain twice; Tech → Learn; Upgrade → Upgrade twice; Scientist/Contract → Action 3; Warehouse → Resupply
    twice.
11. **LSS Reward tiles for Pathfinder.** Colonists-in-quarters counts its full Living Quarters capacity; Rover
    Discovery tiles count 0; ships = ships it welcomed at Colony updates.
12. **Move Bots path.** Target = nearest Research tile, Discovery tile or crystal by hex distance (ties by Card
    Order). The Bot follows a shortest path for up to Colony-level hexes and ends on the last legal hex along
    it. A Bot that lands on a target removes it.
13. **Resupply counting.** Your ABs are counted by what they produce (AB Shelter → crystal), then your Blueprints,
    then leftmost of crystal / battery / water / plant / oxygen. Only items actually in the Warehouse qualify.
14. **Shelter Tech.** Each player's Shelter Tech connects only that player's Shelters.
15. **When it uses Efficient Upgrading.** Pathfinder only uses the Upgrade Tech when it has more usable
    Blueprints than its base upgrades, so it never hands you an Oxygen for a Tech that does nothing.
16. **Benefits are not actions.** Discovery-tile and R&D-space benefits (Blueprint, Upgrade, Hire, Resupply)
    do not place a colonist on an action slot; only the card's main action does.
17. **Displacing your pieces.** If Pathfinder's Upgrade lands on your Bot or Rover and more than one hex is
    equally close, the app asks you where it goes (you own the piece).
