# On Mars — Component Reference

Every piece in the game, what it is for, and its values. Compiled from the Tabletop Simulator assets in
`resources/images`, the reference book, and the rulebook. Written for building the Pathfinder engine
(2 players: you vs. Pathfinder). Where something could not be confirmed from the sources it is listed under
**Unverified assumptions** at the end.

Resource shorthand used below: **M** Mineral, **B** Battery (power), **W** Water, **P** Plant, **O** Oxygen,
**C** Crystal, **OP** Opportunity Points. Minerals are wild for any resource (never for crystals, never for
contracts).

---

## 1. Main board

The board has two halves. The left strip is **Orbit** (the space station). Everything else is the
**Colony** (the hex map plus the colony action panel on the right).

### 1.1 Orbit actions (left strip, top to bottom)

| Action | Needs colonist on a slot? | Slots | Boost | Effect |
|---|---|---|---|---|
| Landing Pod | No | – | – | Travel to the Colony now (no Discovery tile placed). |
| Obtain Blueprint | Yes | 3 | +1 Blueprint per colonist sent to Working Area | Take 1 Blueprint from the display. |
| Learn New Technology | No | – | 1 colonist → take a 2nd Tech tile | Take 1 Tech tile from the Tech Grid into Lab column 1. |
| Research & Development | Yes | 3 | +1 development per colonist | Develop one Tech twice or two Techs once. |
| Resupply (Warehouse) | No | – | +1 item per colonist | Take 1 resource or crystal from the Warehouse. |

### 1.2 Tech Grid (orbit)

8 spaces in three rows, plus room for two face-down reserve stacks (unused in 2 players).

| Row | Spaces | Cost to take |
|---|---|---|
| Top | 3 | 1 B + 1 any resource |
| Middle | 3 | 1 B |
| Bottom | 2 | free |

Tiles are only refilled at a Colony level-up, and never in a 2-player game.

### 1.3 Warehouse (orbit)

Columns: Crystal, Battery, Water, Plant, Oxygen. Three rows printed; **2-player games use only 2 of each**
(10 items at setup, refilled to 2 of each at every Colony level-up). Minerals are never in the Warehouse.

### 1.4 Colony actions (right panel, top to bottom)

| Action | Needs colonist? | Slots | Boost | Effect |
|---|---|---|---|---|
| Construct a Building | Yes | 3 | – | Build one tile in a Bot's building zone. |
| Upgrade a Building | Yes | 3 | (Upgrade Tech) | Use a Blueprint to turn a building Advanced. |
| Hire a Scientist / Take an Earth Contract | Yes | 1 per player colour (4 coloured squares) | – | Take a Scientist or Contract card. Slots do **not** clear when full. |
| Control Center | No | – | crystals = extra movement | 2 movement for Bots + 2 movement for Rover. |
| Welcome a Ship | No | – | +1 ship per colonist | Move a ship Depot → Hangar for 1 P + 1 W. |

### 1.5 Life Support System (LSS) track

Four columns: **Generator, Water Extractor, Greenhouse, Oxygen Condenser**. Rows 1 → 5, then a top "LSS"
row; above each column sits one LSS Reward tile.

- Each LSS marker starts on **row 1** (one starting building of each type is already on Mars).
- The **Colony level marker** starts on the left of **row 2**. Colony level = the row *below* the marker
  (so the game starts at level 1).
- Moving a marker from row 1 to row 2 (first new building of that type) scores **2 OP** (printed "2" on row 2).

What happens when the Colony level marker reaches each row (i.e. the colony reaches that level):

| Colony level | Progress scoring | Missions needed to end | Shuttle |
|---|---|---|---|
| 1 (start) | – | 3 | lands on travel space 1 |
| 2 | score Progress area | 3 | lands on travel space 2 |
| 3 | score Progress area | 2 | lands on travel space 3 |
| 4 | no | 1 | stops moving |
| 5 | no | end of game triggered | travels one last time, then removed |

Blueprint display changes: level 2 → clear display, deal 12 (the 6 remaining L1 + 6 L3); level 3 → remove L1
cards, add the last 6 L3.

**LSS Reward tiles** (8 exist, 4 random ones used, one per column):

| Tile | OP |
|---|---|
| Most-developed Tech | OP equal to the level (column number) of your best Tech |
| Ships | 2 per ship in your Hangar |
| Advanced Buildings | 2 per Advanced Building marker you have on Mars |
| Mines | 2 per Mine holding your colonist or your Advanced marker |
| Bots | 2 per Bot you have on Mars |
| Discovery | 2 per Discovery tile your Rover has collected |
| Shelters | 2 per Shelter you have on Mars |
| Colonists | 1 per colonist in your Living Quarters |

**LSS benefits** (choose one, top-left of the LSS): move Bots 2 (crystals add movement) · gain 1 M · gain
1 C · retrieve 1 colonist from any action slot or your Working Area. Only granted for the four LSS building
types, never for Mines or Shelters.

### 1.6 Progress area

Below the LSS: one column per building type that forms complexes (Mine, Generator, Water, Greenhouse,
Oxygen), each with a slot per player colour. Score by cubes placed: **1/2/3/4/5 cubes → 1/2/4/7/11 OP**, at
the level 2 and level 3 updates and again at game end.

### 1.7 Shuttle track and Turn Order spaces (top edge)

- **Orbit side shuttle row** (top-left): travel spaces 3 → 2 → 1 (1 is red). From here the shuttle goes to
  the Colony. Travel steps printed after it: (1) Exploration, (2) Retrieve Colonists, then Colony turn order.
- **Colony side shuttle row** (top-middle, lower line): travel spaces 1 ← 2 ← 3. From here the shuttle goes
  to Orbit. Steps: (1) Production, (2) Retrieve Colonists, then Orbit turn order.
- **Exploration space**: two face-up Discovery tiles.

Turn order spaces (play goes 1 → 8):

| Space | Side | Benefit when you land there |
|---|---|---|
| 1 | Orbit | none |
| 2 | Orbit | take 1 crystal or 1 resource from the Warehouse |
| 3 | Orbit | take 1 Tech tile (normal cost) |
| 4 | Orbit | pay 1 W or 1 P: move a colonist from your supply into Living Quarters |
| 5 | Colony | none |
| 6 | Colony | take 1 crystal or 1 resource from the Warehouse |
| 7 | Colony | move Bots 2 (crystals add movement) |
| 8 | Colony | take 1 Blueprint |

### 1.8 Missions and end trigger

- Three mission corners on the map, **A** (top-left), **B** (top-right), **C** (bottom-left). Each has a
  mission card space and a numbered tracker (1–14) for the Mission tracker cube.
- **Remaining Missions track** (bottom-right of the map): 3 → 2 → 1 → end. The marker starts on 3.

---

## 2. Hex map

- **91 hexes**, flat-topped, in **13 columns**. Column heights left to right:
  **3, 6, 7, 8, 9, 8, 9, 8, 9, 8, 7, 6, 3**. The map is symmetric left/right and top/bottom.
- Coordinates used by the engine: column `c` = −6…+6 (0 = centre column), row `r` with **odd columns shifted
  down half a hex** ("odd-q"). Column ranges:

| c | rows |
|---|---|
| 0 | −4 … 4 |
| ±1 | −4 … 3 |
| ±2 | −4 … 4 |
| ±3 | −4 … 3 |
| ±4 | −3 … 3 |
| ±5 | −3 … 2 |
| ±6 | −1 … 1 |

- **Starting Mine**: centre hex (0,0). Rovers start here virtually (in garages, never displaced).
- **Starting LSS buildings** (placed randomly, one of each of Generator/Water/Greenhouse/Oxygen):
  (0,−2), (−2,0), (2,0), (0,2).
- **Starting Shelters, 2 players**: directly above and below the centre — (0,−1) and (0,1).
  (3p adds (−1,0),(1,0); 4p uses (±2,±2).)
- **Research tile spots** (8, two per corner; one research type per corner):
  top-left (−3,−4),(−5,−3) · top-right (3,−4),(5,−3) · bottom-left (−5,2),(−3,3) · bottom-right (5,2),(3,3).

---

## 3. Player board

| Area | Contents / values |
|---|---|
| **Storage** | Columns M, B, W, P, O in chain order. Capacity per resource = **Shelters on Mars + 1**. Each column also shows the building it builds: M→Generator, B→Water Extractor, W→Greenhouse, P→Oxygen Condenser, O→Shelter. Progress cube for each type sits below. |
| **Laboratory** | 6 columns (Tech levels 1–6), see 3.1. Starting Shelter Tech on column 2, middle space. |
| **Depot** | 8 crystal spaces, top 5 covered by Ships at start (so 3 free). Each space has an Executive action beside it, usable once the space is not covered by a ship. |
| **Hangar** | Welcomed ships. **3 OP each** at game end; one can be spent to travel. |
| **Living Quarters** | 4 base slots (3 colonists at start) + 2 slots per extra Shelter. Scoring by highest occupied tier, see 3.3. |
| **Working Area** | Unlimited; colonists sent to boost actions wait here. |
| Space below Depot | Newly gained crystals; moved into the Depot at the start of your next turn (overflow is lost). |

### 3.1 Laboratory

| Column (level) | Spaces | Cost to develop into it | End OP per tile | Space benefits |
|---|---|---|---|---|
| 1 | 2 (top, bottom) | – (Learn Tech places here) | 1 | top: take 1 C or resource from Warehouse · bottom: gain 1 C |
| 2 | 3 (top, middle, bottom) | 1 any resource | 2 | – |
| 3 | 2 | 1 O | 3 | top: gain 1 M · bottom: move Bots 2 (+crystals) |
| 4 | 3 | 1 O | 4 | – |
| 5 | 2 | 1 O + 1 any resource | 5 | top: upgrade 1 building (+1 per colonist) · bottom: take 1 Blueprint (+1 per colonist) |
| 6 | 1 | 1 O + 1 C | 9 | – |

Developing moves a tile to an adjacent empty space in the next column right. Spaces interlock: a 2-space
column's top touches the top and middle of the 3-space column next to it; its bottom touches middle and
bottom; column 6's single space touches both spaces of column 5.

### 3.2 Executive actions (Depot, top to bottom)

| # | Cost | Action |
|---|---|---|
| 1 | 4 C | Develop one Tech once, free |
| 2 | 4 C | Move Rover 2 (crystals / Rover Tech add movement) |
| 3 | 3 C | Take 1 Blueprint |
| 4 | 3 C | Upgrade 1 building |
| 5 | 3 C | Gain 1 M |
| 6 | 2 C | Move Bots 2 (crystals add movement) |
| 7 | 2 C | Take 1 resource from the Warehouse |
| 8 | 2 C or a matching Scientist | Use one Advanced Building's action |

Rows 6–8 are open from the start; rows 1–5 open as you choose which ship to welcome.

### 3.3 Living Quarters scoring

| Shelters built (incl. starting) | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| Slots | 4 | 6 | 8 | 10 | 12 |
| OP if the top tier is occupied | 3 | 6 | 10 | 15 | 21 |

Colonists fill from the bottom; you score the value beside your highest occupied tier.

---

## 4. Building tiles

| Type | Count | Build cost | Gain on build | Notes |
|---|---|---|---|---|
| Mine | 6 + starting | place 1 colonist from Living Quarters on it | M × complex size | not LSS; colonist produces 1 M each trip to Orbit |
| Generator | 6 + starting | 1 M | B × complex size | LSS |
| Water Extractor | 6 + starting | 1 B | W × complex size | LSS |
| Greenhouse | 6 + starting | 1 W | P × complex size | LSS |
| Oxygen Condenser | 6 + starting | 1 P | O × complex size | LSS |
| Shelter | 5 per player (1 starts on map, 4 on board) | 1 O | C × complex size | each player's shelters are their own type |

Some building tiles show crystal arrows on the back: when placed, a crystal goes in each empty adjacent hex
an arrow points to. Stacks are kept back-side up, so you can see whether the next tile has arrows.

---

## 5. Blueprints (24)

Level 1 cards upgrade a building of any size (+3 OP built / −3 unbuilt). Level 3 cards need a building in a
complex of size 3+ (+5 / −5). Upgrading costs 1 M. Each card grants an item when taken.

| # | Name | Lvl | Upgrades | Gain | Executive action of the Advanced Building |
|---|---|---|---|---|---|
| 1 | Construction Yard | 1 | Mine | M | Upgrade 1 building (Tech allowed), +1 per colonist |
| 2 | Metal Deposit | 1 | Mine | M | Construct a Mine (colonists count as Tech levels) |
| 3 | Automated Production | 1 | Generator | B | Every Mine/Advanced Building of yours produces once; +1 production per colonist |
| 4 | Wind Turbines | 1 | Generator | B | Construct a Generator (colonists = Tech levels) |
| 5 | Private Ship | 1 | Water | W | Welcome 1 Ship (1 P + 1 W) bringing 2 colonists + 1 Bot or 3 colonists; +1 ship per colonist |
| 6 | Moisture Vaporator | 1 | Water | W | Construct a Water Extractor (colonists = Tech levels) |
| 7 | Biomarket | 1 | Greenhouse | P | Take 1 C or resource from Warehouse, +1 per colonist |
| 8 | Hydroponic Farm | 1 | Greenhouse | P | Construct a Greenhouse (colonists = Tech levels) |
| 9 | Oxygen Tank | 1 | Oxygen | O | Take 1 Tech tile (normal rules), +1 per colonist |
| 10 | Concentrator | 1 | Oxygen | O | Construct an Oxygen Condenser (colonists = Tech levels) |
| 11 | Casino | 1 | Shelter | C | Gain 2 C, +1 per colonist |
| 12 | Gym | 1 | Shelter | C | Construct a Shelter (colonists = Tech levels) |
| 13 | Mineral Mine | 3 | Mine | M | Score 2 OP |
| 14 | Biolab | 3 | Mine | M | Take 1 Earth Contract, paying its cost |
| 15 | Radar | 3 | Generator | B | On upgrade, move one Exploration Discovery tile onto this card (replace it) and gain it; afterwards the action repeats that tile's benefit |
| 16 | Builder Drone AI600 | 3 | Generator | B | Upgrade a building anywhere on Mars (Upgrade Tech may add more) |
| 17 | Research Lab | 3 | Water | W | Develop Tech twice (paying costs), +1 per colonist |
| 18 | Aqueduct | 3 | Water | W | Move up to 2 colonists Working Area → Living Quarters |
| 19 | Eco Resort | 3 | Greenhouse | P | Retrieve all your colonists from the action slots of one side (Orbit or Colony) |
| 20 | Trade Market | 3 | Greenhouse | P | Pay 1 resource, take 2 non-Mineral resources from supply, +1 per colonist |
| 21 | Recycling Bots | 3 | Oxygen | O | Move Bots 2 (crystals add) as if they were Rovers (collect crystals/tiles; only one tile kept) |
| 22 | Aerial Elevator | 3 | Oxygen | O | Travel to Orbit (normal travel steps) |
| 23 | Library | 3 | Shelter | C | Take 1 Blueprint, +1 per colonist |
| 24 | Command Center | 3 | Shelter | C | Move Rover up to the highest Rover Tech level in play, +1 per crystal |

Shelter Blueprints may only upgrade your own Shelters. A Scientist working in an Advanced Building lets its
owner and the building's owner use that action for free.

---

## 6. Scientists (6)

Start face up on the Scientist display in this order. Each scores **3 OP per Advanced Building of its scoring
type on Mars** (anyone's).

| Scientist | Cost to hire | Works in (free action) | Scores |
|---|---|---|---|
| Geologist | send 2 colonists LQ → Working Area | Advanced Mine | Generators |
| R&D Engineer | 2 M | Advanced Generator | Water Extractors |
| Hydrologist | 2 B | Advanced Water Extractor | Greenhouses |
| Biochemist | 2 W | Advanced Greenhouse | Oxygen Condensers |
| Geochemist | 2 P | Advanced Oxygen Condenser | Shelters |
| Systems Engineer | 2 O | Advanced Shelter | Mines |

When a Scientist leaves, its space shows a crystal: Contracts placed there cost **1 C**.

---

## 7. Earth Contracts (12)

Cost 1 C to take. Scored at game end: complete → gain, incomplete → lose.

| # | Type | Requirement | Complete / Fail |
|---|---|---|---|
| 1 | Upgrade | Your Advanced marker on a Generator complex of size ≥ 4 | +12 / −6 |
| 2 | Upgrade | … Water Extractor complex ≥ 4 | +12 / −6 |
| 3 | Upgrade | … Greenhouse complex ≥ 4 | +12 / −6 |
| 4 | Upgrade | … Oxygen Condenser complex ≥ 4 | +12 / −6 |
| 5 | Upgrade | … Shelter complex ≥ 4 | +12 / −6 |
| 6 | Upgrade | … Mine complex ≥ 4 | +12 / −6 |
| 7 | Delivery | 4 M | +9 / −4 |
| 8 | Delivery | 3 B + 2 M | +9 / −4 |
| 9 | Delivery | 3 W + 2 M | +9 / −4 |
| 10 | Delivery | 3 O + 2 M | +9 / −4 |
| 11 | Delivery | 3 P + 2 M | +9 / −4 |
| 12 | Delivery | 3 C + 2 M | +9 / −4 |

Delivery items are placed on the card at any time (bypassing storage, cannot be removed). Minerals are not wild
here.

---

## 8. Missions (9)

Each contribution moves the tracker cube one step and pays the contributor crystals. Targets are for
2 / 3 / 4 players.

| # | Deck | Counts each time… | Target 2/3/4 | Reward |
|---|---|---|---|---|
| 1 | Long | a Research tile is taken from the map | 5 / 5 / 7 | 2 C |
| 2 | Long | an Advanced Building is placed on the map | 8 / 8 / 10 | 1 C |
| 3 | Long | a Discovery tile is taken by a Rover | 5 / 7 / 9 | 1 C |
| 4 | Long | a Progress cube is placed | 8 / 11 / 14 | 1 C |
| 5 | Long | an Earth Contract is completed | 2 / 2 / 3 | 2 C |
| 6 | Short | a Blueprint is taken from the display | 10 / 10 / 13 | 1 C |
| 7 | Short | a Bot is placed on the map (starting Bots excluded) | 3 / 4 / 5 | 2 C |
| 8 | Short | a Tech is taken from the display | 8 / 11 / 12 | 1 C |
| 9 | Short | a Scientist is taken from the display | 4 / 4 / 5 | 2 C |

Short game: 2 Short + 1 Long. Long game: 1 Short + 2 Long. First game suggestion: Blueprints, Scientists,
Bots (markers by Obtain Blueprint, Hire, Control Center).

---

## 9. Private Goals (16)

Each player is dealt 3; only one may be completed. Every goal offers **"Develop Tech twice, free"** or the
listed alternative. Any goal card in hand may instead be spent as a crystal.

| # | Goal | Alternative reward |
|---|---|---|
| 1 | Own 4 Blueprints (built or not) | Upgrade up to 2 buildings free |
| 2 | Have 3 Shelters | Move 2 colonists from supply to Living Quarters |
| 3 | 3 Mines holding your colonist or Advanced marker | Gain 3 M |
| 4 | Collect 3 Discovery tiles with your Rover | Move Rover up to 5 (crystals/Tech add) |
| 5 | Your Advanced marker on a complex of size ≥ 4 | Move 2 colonists from supply to Living Quarters |
| 6 | 4 of one resource type (not Minerals) | Take an Earth Contract free |
| 7 | Upgrade 3 buildings | Gain up to 3 resources (not Minerals) |
| 8 | Colony reaches level 3 | Move Rover up to 5 |
| 9 | 7 colonists in Living Quarters | Welcome a Ship free |
| 10 | Own 5 Tech tiles (Shelter Tech counts) | Retrieve 2 colonists (action slots / Working Area) |
| 11 | 3 Ships in your Hangar | Travel to the other side (normal steps) |
| 12 | Collect 2 Research tiles | Hire a Scientist free |
| 13 | 1 Scientist and 1 completed Earth Contract | Take an Earth Contract free |
| 14 | 3 Tech tiles on the marked Lab spaces (column 4 middle, both column-5 spaces) | Gain up to 3 C |
| 15 | 3 cubes in the Progress area | Retrieve 2 colonists |
| 16 | Advanced markers in 2 different complexes of size ≥ 3 | Upgrade up to 2 buildings free |

---

## 10. Discovery tiles (19) and Research tiles (8)

Discovery tiles are face-down in a stack; two are face up on the Exploration space. A Rover ending on one
collects it (cost must be payable, benefit at least partly usable). A Bot ending on one destroys it.

| Tile | Qty | Benefit |
|---|---|---|
| Construct Mine | 1 | Build a Mine (Tech needed for complex) |
| Construct Generator | 1 | Build a Generator, paying cost |
| Construct Water Extractor | 1 | Build a Water Extractor, paying cost |
| Construct Greenhouse | 1 | Build a Greenhouse, paying cost |
| Construct Oxygen Condenser | 1 | Build an Oxygen Condenser, paying cost |
| Construct Shelter | 1 | Build a Shelter, paying cost |
| Construct any | 1 | Build any type, paying cost |
| Develop ×2 | 1 | Develop twice, paying costs |
| Blueprints | 1 | Take up to 2 Blueprints |
| Tech | 1 | Take 1 Tech tile, paying cost |
| Upgrade ×2 | 1 | Upgrade up to 2 buildings, paying costs |
| Scientist / Contract | 1 | Hire 1 Scientist or take 1 Contract, paying cost |
| Warehouse ×2 | 1 | Take up to 2 items from the Warehouse |
| 3 Crystals | 1 | Gain 3 C |
| 3 Minerals / Batteries / Water / Plants / Oxygen | 1 each (5) | Gain 3 of that resource |

**Research tiles**: 4 types (A olive, B teal, C pink, D light green) × 2. All grant *develop one Tech twice
or two Techs once, free*. A player may not take two tiles of the same type.

---

## 11. Tech tiles

- **16 regular tiles** in two sets of 8 (different backs). A 2-player game uses one set; the other goes back
  in the box. Each set has one of: Mine, Generator, Water, Greenhouse, Oxygen (each lets a building of that
  type join a complex), **Faster Rovers** (+Rover movement = level), **Increased Colonist Capacity**
  (+colonists when welcoming a ship = level), **Efficient Upgrading** (+extra upgrades = level).
- **4 Shelter Tech tiles**, one per player colour, start in each Lab (column 2 middle).
- Connecting Techs: the tile's level must be at least the number of same-type buildings being joined.
- A player may hold only one tile of each type. Anyone may use anyone's Tech; the owner then gets 1 O or a
  free development.

---

## 12. Pathfinder solo cards (12)

Each card shows a mission letter (A/B/C), a travel indicator (a cube, with or without a red X), and an action
number (1–3) on the astronaut.

| # | Mission | X (no travel) | Action |
|---|---|---|---|
| 1 | B | X | 3 |
| 2 | A | X | 2 |
| 3 | A | – | 3 |
| 4 | C | – | 3 |
| 5 | B | – | 1 |
| 6 | C | X | 1 |
| 7 | C | – | 2 |
| 8 | C | – | 1 |
| 9 | A | – | 2 |
| 10 | B | – | 2 |
| 11 | B | – | 1 |
| 12 | A | – | 1 |

Totals: actions 1×5, 2×4, 3×3; three X cards; four cards per mission letter.

---

## 13. First Colonists

- **First Colonist tiles (6)**: one per turn order space **2, 3, 4 (Orbit) and 6, 7, 8 (Colony)**. Pathfinder
  draws one at random for its starting space.
- **First Colonist cards**: 4 "A" cards (each shows 4 building types; building any of them reveals the card and
  draws 2 "B" cards) and 8 "B" task cards (upgrade → M, take Tech → B, hire Scientist → M, welcome ship → P,
  take Discovery tile → C, take Blueprint → C, develop → O, take Research tile → O). Optional variant.

---

## 14. Player pieces (per colour)

| Piece | Qty | Use |
|---|---|---|
| Colonists | 12 | 3 in Living Quarters at start, 9 in supply |
| Bots | 4 | 1 on your starting Shelter, 3 beside the board |
| Rover | 1 | starts virtually on the centre Mine |
| Ships | 5 | top 5 Depot spaces |
| Progress cubes | 5 | one under each storage column |
| Advanced Building markers | 8 | go on Blueprints, then on upgraded buildings |
| Shelter tiles | 5 | 1 on the map, 4 on the board |
| Player marker, OP marker | 1 each | turn order / score |
| Starting resources | 1 of each M B W P O, 1 C | |

Shared: 30 Crystals (unlimited in practice), 20 of each resource, Shuttle, Colony level marker, 4 LSS markers,
3 Mission cubes, 3 Mission markers, Remaining Missions marker, Building display board.

---

## Unverified assumptions

These could not be confirmed from the TTS assets and are engine defaults until checked against a physical copy:

1. **Building tiles**: 6 per type (30 total). Assumed **3 per type have crystal arrows and 3 have none**.
   Arrow tiles point to the **N, SW and SE** neighbours (board orientation, notch down).
2. **Discovery resource tiles**: assumed **3** of the resource (and 3 crystals) on each of the six
   resource/crystal tiles.
3. Shelter tiles have no crystal arrows.
