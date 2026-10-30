# Brass: Birmingham research: deck, tiles, strategy

Researched 2026-10-29 for the Eliza v2 AI. This covers Brass: **Birmingham** only (not Lancashire).
Source tags: **[R]** rulebook text, **[C]** open-source code (several independent repos), **[S]** strategy
writing (expert or community), **[D]** my own derivation from the rules and numbers. Anything marked
**UNVERIFIED** is folk wisdom I couldn't pin to a source.

---

## Part A: Card deck composition

**Resolved from the official player aid (coordinator).** Not researched further.

Cross-check only: five independent code repos agree on 40/54/64 with the same breakdown (andre, quasrain,
a-whitehouse, julius-retzer, npow; see Sources). Two repos are wrong and should not be used: LahavBarak/BrassRL
(totals are off) and lpopov101/brassbot (Derby = 2 at 4p, which gives 63).

What the deck means for strategy [D, from the consensus counts]:
- **2p has no Cotton/Manufacturer industry cards.** All 8 dual cards are marked 3p or 4p. At 2p, cotton and
  goods can only be built from location cards (Worcester ×2, Kidderminster ×2, Birmingham ×3, Tamworth,
  Nuneaton, Coventry, Wolverhampton...) or a wild card. That is why the 2p cotton advice centres on
  Kidderminster and Worcester.
- 2p industry cards: Brewery 5, Iron 4, Coal 2, Pottery 2. Beer and iron are the easy builds to get at 2p.
- 1-card towns (Tamworth, Walsall, Nuneaton, Redditch) can be targeted by location card at most once per era,
  so a brewery slot there is scarce [S: Mafiul].

---

## Part B: Industry tile stats (cross-check)

Sources [C]: ikegami/tts_brass (TTS mod), jgilles23 CSV, LahavBarak CSV and Quasrain-Coder tiles.ts all agree on
every value below. npow says its data comes from TTS, so it isn't independent. Per player: 45 tiles (×4 players =
180, which matches the box count).

Columns: **Inc** = income **spaces** on the progress track (not levels). **Link** = link icons scored by adjacent
links. **Beer** = beer needed to sell. **Out** = cubes produced.

| Tile | # | £ | Coal | Iron | Beer | VP | Link | Inc | Out | Era / flags |
|---|---|---|---|---|---|---|---|---|---|---|
| Coal I | 1 | 5 | – | – | – | 1 | 2 | 4 | 2 coal | canal only |
| Coal II | 2 | 7 | – | – | – | 2 | 1 | 7 | 3 coal | |
| Coal III | 2 | 8 | – | 1 | – | 3 | 1 | 6 | 4 coal | |
| Coal IV | 2 | 10 | – | 1 | – | 4 | 1 | 5 | 5 coal | |
| Iron I | 1 | 5 | 1 | – | – | 3 | 1 | 3 | 4 iron | canal only |
| Iron II | 1 | 7 | 1 | – | – | 5 | 1 | 3 | 4 iron | |
| Iron III | 1 | 9 | 1 | – | – | 7 | 1 | 2 | 5 iron | |
| Iron IV | 1 | 12 | 1 | – | – | 9 | 1 | 1 | 6 iron | |
| Brewery I | 2 | 5 | – | 1 | – | 4 | 2 | 4 | 1 beer (canal) | canal only |
| Brewery II | 2 | 7 | – | 1 | – | 5 | 2 | 5 | 1 canal / 2 rail | |
| Brewery III | 2 | 9 | – | 1 | – | 7 | 2 | 5 | 1 canal / 2 rail | |
| Brewery IV | 1 | 9 | – | 1 | – | 10 | 2 | 5 | 2 beer | **rail only** |
| Cotton I | 3 | 12 | – | – | 1 | 5 | 1 | 5 | – | canal only |
| Cotton II | 2 | 14 | 1 | – | 1 | 5 | 2 | 4 | – | |
| Cotton III | 3 | 16 | 1 | 1 | 1 | 9 | 1 | 3 | – | |
| Cotton IV | 3 | 18 | 1 | 1 | 1 | 12 | 1 | 2 | – | |
| Manuf. I | 1 | 8 | 1 | – | 1 | 3 | 2 | 5 | – | canal only |
| Manuf. II | 2 | 10 | – | 1 | 1 | 5 | 1 | **1** | – | |
| Manuf. III | 1 | 12 | 2 | – | **0** | 4 | 0 | 4 | – | sells with no beer |
| Manuf. IV | 1 | **8** | – | 1 | 1 | 3 | 1 | **6** | – | |
| Manuf. V | 2 | 16 | 1 | – | 2 | 8 | 2 | 2 | – | |
| Manuf. VI | 1 | 20 | – | – | 1 | 7 | 1 | 6 | – | no resources |
| Manuf. VII | 1 | 16 | 1 | 1 | **0** | 9 | 0 | 4 | – | sells with no beer |
| Manuf. VIII | 2 | 20 | – | 2 | 1 | 11 | 1 | 1 | – | |
| Pottery I | 1 | 17 | – | 1 | 1 | 10 | 1 | 5 | – | lightbulb; **buildable in rail** |
| Pottery II | 1 | 0 | 1 | – | 1 | 1 | 1 | 1 | – | |
| Pottery III | 1 | 22 | 2 | – | 2 | 11 | 1 | 5 | – | lightbulb |
| Pottery IV | 1 | 0 | 1 | – | 1 | 1 | 1 | **1** | – | |
| Pottery V | 1 | 24 | 2 | – | 2 | 20 | 1 | 5 | – | **rail only** |

Answers to the coordinator's specific questions:
- **Manufacturer II income = 1** in all sources.
- **Manufacturer IV = £8 + 1 iron, income 6**, 3 VP, 1 link, 1 beer, in all sources.
- **Pottery IV income = 1** in all sources. **Possible bug:** the v1 `eliza/data.js` (tile id 14) has Pottery IV
  income **5**. Every external source says 1.
- **Rail-only tiles are exactly Brewery IV and Pottery V.** Confirmed by the TTS mod (`canal_era=false`), the
  gilles CSV (`rail`) and Quasrain (`railEraOnly`). The v1 `data.js` has no rail-only flag at all.
- **Canal-only tiles** (cannot be built in rail; Develop them away): Coal I, Iron I, Brewery I ×2, Cotton I ×3,
  Manufacturer I. Pottery I is the one level-1 tile with **no** canal-only restriction. It can be built in the Rail
  era [C, and S: "Level 1 Pottery can always be built in the Rail Era"].
- **Lightbulb (cannot be Developed):** Pottery I and Pottery III. They have to be built to clear them from the mat [R].

Rule reminders that bear on the numbers [R]:
- At the end of the canal era, **all level 1 tiles on the board are removed**. A Pottery I built in canal is
  removed and scores only once (10 VP). Building it in rail is worth the same 10 VP.
- A brewery places 1 beer in canal and 2 in rail.
- A develop costs 1 iron per tile, up to 2 tiles per action.
- Overbuild your own tiles freely. You may overbuild an opponent's Coal Mine or Iron Works only when there are
  zero cubes of that resource on the whole board, market included.
- Canal link costs £3. One rail link costs £5 + 1 coal. Two rail links cost £15 + 2 coal + 1 beer, and that
  beer must come from a brewery, not a merchant.
- Loan: +£30, income drops 3 **levels** (to the top space of the new level), and income can't go below −10.
- Income track: levels 1–10 are 2 spaces each, 11–20 are 3 spaces, 21–30 are 4 spaces [C, npow].
- Merchant beer bonuses [C, npow and vivi]: **Shrewsbury +4 VP**, **Nottingham +3 VP** (4p only),
  **Oxford +2 income spaces**, **Gloucester 1 free develop**, **Warrington +£5** (3p and up). Merchant beer is
  refilled once, at the end of the canal era. Each merchant location has 2 link icons.
- Market coal needs a connection to a merchant. Market iron doesn't need a connection. Board iron is free from
  any iron works, anywhere.

---

## Part C: Strategy

### C1. The core economy (numbers for an evaluator)

- **Actions per player:** 2p 39 (19 canal + 20 rail), 3p 35, 4p 31 [S: Mafiul, Steam guide]. Rounds per era:
  10 / 9 / 8.
- **Skilled winning score:** about **200 (2p), 175 (3p), 155 (4p)** [S: Mafiul Robin via eurostrategygames].
  That works out to about **5 VP per action**. Develop and Loan score nothing, so the scoring actions have to
  average 6 or more.
- Other reported scores: a BGG 3p game ended 202 vs 141/142 (the thread asks whether 200+ is common).
  A blog's 3p game had all three players within 8 points of 150. Casual winners are usually 120–160
  [S, partly **UNVERIFIED**].
- **Score benchmarks for the AI** [D]: aim for 2p ≥ 180, 3p ≥ 160, 4p ≥ 140 for "strong". For "beatable",
  aim 2p 130–150, 3p 120–140.
- **Level 2+ tiles score twice** [S: everyone; R]. A tile built in canal **and flipped in canal** scores at the
  end of canal and again at the end of rail.
  - Cotton III: 9 + 9 = 18 VP, plus link icons in both eras [S: Erik Twice]. Cotton IV: 24. Manuf. V: 16.
  - **A tile counts only if it is flipped by the era end.** An L2+ tile built in canal but not flipped until
    rail scores only once. The AI should treat an unflipped canal tile as half value.
- **Rail links:** "rarely worth less than 4 VP, often 8" [S: Erik Twice].
- **Canal links:** "Don't build one unless it's worth 4–5+ VP" [S: Steam guide, flathery]. Canal links mostly
  exist to enable builds and sales.
- **What a loan really costs** [D]: 3 income levels × the income phases left. At 2p, a round-1 loan costs about
  £57 of income for £30 (roughly 19 phases × £3). A loan in the last 3 rail rounds costs £9 or less.
  So: take loans early only if they buy tempo, and late loans are almost free.
- **Loans are cheapest at low income** [S: Erik Twice commenter; D]. At income ≤ 0 each level is 1 space, so a
  loan costs only 3 spaces. Above 10 it costs 9 spaces. Hence the primer line "develop through Coal I and use
  Coal II to erase 2 loans": Coal II's +7 spaces covers two loans taken at income ≤ 0.
- **Avoid negative income** [S: Mafiul]. If needed, build a level 1 Coal or Iron just for the income.
- **Income targets:**
  - "Income 10+ by the end of canal" is **UNVERIFIED**; no source states it.
  - Counter-evidence: "many games are won with low income, roughly £7–12" [S: flathery], and "Brass isn't
    about maximising money" [S: BGG loans thread].
  - Suggested AI band [D]: enter rail at about £8–15 income, with £20–30 cash in hand so the first rail turn
    can be a double rail (£15 + coal).
  - Over-building coal for income is a named beginner mistake: you end up with high income and nothing to
    spend it on [S: Steam guide, flathery].
- **Iron demand:** "about 32 iron cubes leave the board in an average 4p canal era". That is enough for one
  player to reach Iron IV and another Iron III. Don't crowd into iron [S: BGG 4p primer, via search snippet].

### C2. Canal era

**Goal:** do most of your Loans and Develops here, and land 2–4 flipped L2+ tiles that will score again in
rail [S: Mafiul; Erik Twice; Steam guide].

- **Develop early and often.**
  - Develop the L1 tiles of your main industry off the mat, so your next builds are L2/L3 [S: all].
  - Exceptions:
    - Coal I and Iron I are sometimes worth building for income [S: Mafiul].
    - Pottery I and III must be built (lightbulb).
    - Brewery I is often developed away "because breweries are scarce" [S: Mafiul]. Others build one
      Brewery I early to claim a beer space [S: Mafiul opening].
- **Rulebook tip** [R/S]: build or develop past at least one Coal and one Iron during canal, so you don't
  spend a rail action clearing canal-only L1 tiles.
- **Few canals** [S: all]. Every canal you skip is an action saved for developing. A winning pattern is getting
  iron out in canal **without building connections** [S: flathery], since iron needs no network.
- **Opening patterns** [S]:
  - **First player:** take a Loan (or Scout) as action 1. You spend £0 and stay first next round, then build
    iron first in round 2 [S: Mafiul, flathery].
  - **Develop Brewery I:** secures beer spaces for later. Iron is also possible, but not at 2p if the previous
    player took a loan [S: Mafiul].
  - **Build a link:** at 2p, only after P1 has developed (the link costs just £3). Avoid linking straight to a
    merchant, and look for a future link to coal [S: Mafiul].
  - **"Iron & Develop":** build Iron Works, then Develop 2–3 times using your own cheap iron [S: TablePriest].
  - **Classic resource opener:** loan, canal, coal, loan, coal [S: BGG primer snippet]. Opening sequences are
    7–9 actions long [S: same].
  - **"Beer anchor":** an early brewery near Birmingham, Coventry or Worcester, sold from quickly before rivals
    drink it [S: TablePriest].
- **Sell several tiles in one Sell action.** This is easiest in canal [S: Mafiul].
- **Use your canal beer in canal.** Saving it for rail is usually weaker; using it secures about 5 VP early
  [S: Mafiul].
  - The opposite mistake also happens: building all your breweries in canal and having no beer for rail
    [S: flathery].
  - Target [D]: 1–2 breweries in canal, and keep a Brewery II/III plus the IV for rail.
- **End-of-canal checklist** [D from R]:
  1. Every L2+ tile you built is flipped.
  2. No L1 tile is left unflipped (it will be removed for 0 VP).
  3. Iron and coal are ready for rail.
  4. Cash is banked for a double rail.
  5. Last 1–2 actions: a final Sell, or Develops ("late-canal prune") [S: TablePriest].
- **Don't hand out free iron** [S: flathery, Steam guide]. Avoid Iron Works next to cheap coal (for example
  Coalbrookdale) where it gives rivals easy develops. Make opponents build a canal before you drop iron.

### C3. Rail era

- **Points shift to links and high tiles** [S: Mafiul]. Prioritise links, especially around **Birmingham**
  (4 industry slots, the hub). Head toward the farm-brewery spaces (near Cannock, and between Kidderminster and
  Worcester) [S: Mafiul].
- **Double rail is the key tempo tool** [S: Erik Twice, TablePriest]. It costs £15 + 2 coal + 1 brewery beer.
  - It is worth taking even if it costs turn order or forces a loan.
  - Pattern: grab beer, double rail, and repeat next turn if possible.
- **Strong double-rail areas:** Uttoxeter, Worcester, Birmingham [S: Erik Twice]. At 3p/4p, monopolising the
  north around Uttoxeter is a winning pattern [S: flathery].
- **Build spines, not spurs** [S: TablePriest]. Run lines through 2+ of Birmingham, Coventry, Worcester and
  Wolverhampton. Avoid dead ends unless they flip immediately.
- **Order of priorities** [S: Mafiul; D]:
  1. Best links while they're cheap.
  2. Highest-value industries once the good links are gone: Pottery V 20, Cotton IV 12, Manuf. VIII 11,
     Brewery IV 10, Iron IV 9, Manuf. VII 9.
  3. Final rounds: whatever VP is left.
- **Value of a rail link** [D]: the sum of the link icons at both ends, counting only flipped tiles, plus 2 for
  each merchant location. Links score at the end of the era, so building early links next to tiles that will
  flip later is fine.
- **Beer supply decides rail** [S: BGG primer; flathery].
  - Plenty of beer in rail favours link players. Scarce beer favours players with developed industry.
  - Winning players get **all** their beer tiles out by game end [S: flathery].
- **Endgame, last 3–4 actions** [S: TablePriest]:
  - Count the remaining beer and merchant demand.
  - Deny a rival's sale while you secure your own flip.
  - If your flips are done, take link VP.
  - Don't strand a pottery.
- **Coal in rail:** don't feed rivals' rails with cheap coal. Your own coal flipping is mostly irrelevant unless
  the market is empty, in which case it's a big cash boost [S: Erik Twice].

### C4. Turn order and tempo

- **Rule:** the player who spends the least goes first next round. Ties keep their relative order [R].
  Loan and Scout spend £0. Develop spends only what you pay for market iron.
- **Aim for 4 actions in a row** [S: Mafiul]. Spend little while you're last, so you're first next round
  (your last 2 actions + their first 2). Then make the big spending moves while you're first. This gives a
  repeating last → first cycle.
- **Free actions** (Scout, Loan, cheap Develop) let you go first and grab a contested slot. Example: a round-1
  loan lets you drop iron in a town before the opponent who just took coal there [S: Steam guide].
- **AI rule** [D]: on a planned "cheap" round, rank Loan, Develop (with board iron) and £3 canals above
  expensive builds when the next round has a contested slot or a double rail ready.

### C5. Beer, merchants, denial

- **Breweries are the most important industry** [S: Erik Twice; Steam guide].
  - They are nearly as many VP as other industries, cheap, and use iron instead of coal.
  - They flip without a Sell action and don't need to be in your network.
  - Their beer enables double rails.
- **Never spend a beer (brewery) card on something else** if beer is your plan [S: Mafiul].
- **Use opponents' beer when you can.** Beer is rarely abundant, and denying beer late wins games
  [S: Steam guide, Erik Twice]. Draining the beer a rival needs can swing about 15–25 VP
  [S: TablePriest, **UNVERIFIED** magnitude].
- **Merchant beer:** use it when convenient, but build your own for VP [S: Steam commenter]. Mafiul is stricter:
  use merchant beer only when yours is taken and it's the only way to sell.
  - The bonuses vary a lot. Treat them as tiebreakers when choosing a merchant [D]:
    - Shrewsbury: +4 VP.
    - Gloucester: a free develop, worth about one action plus 1 iron.
    - Oxford: +2 income spaces.
    - Warrington: £5.
    - Nottingham: +3 VP.
- **Beer fork:** set up two possible sales and take whichever still has beer after the others act
  [S: TablePriest].
- **Blocking:**
  - Taking a single brewery slot that feeds two merchants forces opponents into worse plays [S: TablePriest].
  - In canal, one tile per town per player still lets you take the second slot a rival needs [R; D].
  - Building Pottery I in rail blocks a rival's Pottery V path [S: Mafiul].
- **Overbuilding:**
  - Overbuild your own L1 Iron or Coal in canal with L2+ when efficient. It reuses existing coal and iron
    links [S: Mafiul; BGG primer].
  - Overbuilding an opponent's mine needs an empty board and market for that resource. It is rare, and only
    worth checking late in rail [R; D].
- **Parasitism:** one blog author won by building only 2 canals and riding opponents' canal and rail networks
  [S: flathery]. Exploiting others' links is a legitimate plan, especially at 3p and 4p [S: BGG 2p cotton thread].

### C6. Industry choice by player count (expert view)

From Mafiul Robin's notes [S]:
- **Universal: Iron and Beer.** Everyone should touch them.
- **Pick ONE main sale industry.** Mixing Cotton with Manuf., or Manuf. with Pottery, stops you from reaching
  the high levels. The exception is a rail-era Pottery I.

| Player count | Best main industry | Notes |
|---|---|---|
| **2p** | **Cotton** | Its many develops need the higher action count. Build **at least 2 Cotton III in canal**, sold with your own Brewery II. Key towns: **Kidderminster, Worcester** (2 cotton slots each, 2 cards each) [S: Mafiul, Steam guide]. Alternative: Manuf. with an extra develop to clear Manuf. III/IV, then surround Birmingham with links [S: Mafiul]. |
| **3p/4p** | **Manufacturer** | Needs only 2 develops. Build Manuf. II ×2 + Brewery II in canal, sold with your own beer. Manuf. II needs no coal [S: Mafiul]. "Big cotton" at 4p works only if you're the sole cotton player, using Birmingham + the Oxford merchant [S: BGG 4p primer]. |
| **Any** | **Pottery** | High risk, high reward. Rivals can block it. Pursue only when merchants, your hand and a lack of Cotton/Manuf. cards favour it. Build Pottery I **and** III in canal and flip at least one with your own beer, then Pottery V (20 VP) in rail. 2p pottery towns: Stafford and Coventry (Belper/Stoke have no location cards at 2p) [S: Mafiul, Steam guide, flathery]. |

Manufacturer tile quirks [S: Steam guide]:
- I and V have **2 link icons**: build them next to your own links.
- III and VII have **0 links and need no beer**: build them next to rivals' links (they get nothing), and sell
  them late when the beer is gone. VIII also sells late.

Erik Twice's dissent: development is weaker in Birmingham than in Lancashire. High-level industry is a tool,
not the whole plan. Everyone should contest **beer, rails and iron**, and coal ranks lowest.

### C7. Distinct archetypes for the AI

Give each AI persona one archetype with its own weights, and let it switch when its signals fail. All of them
share the universal rules: flip L2+ tiles in canal, own at least 1 brewery per era, and keep cash for a double
rail at the start of rail.

**1. Cotton Developer** (best at 2p)
- **Canal priorities:** Develop Cotton I ×3 away. Build 2–3 Cotton II/III in the Worcester/Kidderminster/
  Birmingham area. Build Brewery II. Iron for develops.
- **Rail priorities:** Cotton IV ×3. Links joining the cotton towns to merchants. Brewery IV.
- **Pick it when:** you hold Worcester/Kidderminster cards, cotton-buying merchants are out, and no rival is
  doing cotton.
- **Weakness:** rivals contest the slots and the beer. Exposed if 2+ players go cotton.

**2. Manufacturer Merchant** (best at 3p/4p)
- **Canal priorities:** Manuf. I build or develop, then Manuf. II ×2 + Brewery II, sold with your own beer.
  Birmingham/Coventry/Wolverhampton.
- **Rail priorities:** Manuf. V/VII/VIII. Use III and VII (0 beer) for late sales. Birmingham hub links.
- **Pick it when:** there are many Birmingham/Coventry/Wolverhampton cards and good-buying merchants
  (Oxford, Gloucester, Nottingham).
- **Weakness:** the tile ladder is long (11 tiles). It needs a sustained money supply.

**3. Potter** (situational)
- **Canal priorities:** Pottery I + III, flipped with your own beer. Develop II/IV cheaply.
- **Rail priorities:** Pottery V (20 VP). Links to the pottery towns.
- **Pick it when:** pottery merchants are out (Shrewsbury/Oxford/Warrington/Gloucester) and you hold
  Stafford/Coventry/Stoke cards.
- **Weakness:** easily blocked or stranded. Abandon it if beer gets denied.

**4. Brewer–Rail Baron** (any count)
- **Canal priorities:** 1–2 breweries, a few L2 sale tiles, minimal canals, heavy loans and develops.
- **Rail priorities:** double rail every turn while beer lasts. Birmingham spine. Farm-brewery spots.
  Brewery II/III/IV.
- **Pick it when:** you're in good turn-order position, hold brewery cards, and rail-era beer is plentiful.
- **Weakness:** scarce beer, or rivals cutting the hub links.

**5. Iron/Coal Supplier** (support plan)
- **Canal priorities:** Iron I → II/III early, sell iron to rivals' develops, Coal II as a loan-eraser, income.
- **Rail priorities:** Iron IV (9 VP), coal timed for rivals' rail bursts. Then pivot to links.
- **Pick it when:** rivals are all developing (high iron demand) and the market is thin.
- **Weakness:** coal and iron VP is low. **Never a solo winning plan** [S]. It must pivot to links or a
  main industry.

**6. Opportunist / Parasite** (3p/4p)
- **Canal priorities:** few canals. Build in rivals' networks and drink their beer.
- **Rail priorities:** cheap links off rivals' spines. Deny their final sales.
- **Pick it when:** rivals are building big networks and your hand is mixed.
- **Weakness:** it depends on rivals. Weak at 2p.

Extra persona knobs [D]:
- **Tempo appetite:** how often it plans "cheap rounds".
- **Loan tolerance:** maximum loans per era, for example 1–4.
- **Canal-link threshold:** minimum VP for a canal, 3–6.
- **Merchant-beer use:** strict vs. convenient.
- **Denial weight:** extra value for actions that take beer or slots a rival needs.

### C8. Compact heuristics (prioritised list for an evaluator)

1. Score an action as VP in the near term plus the enabling value of upcoming flips or double rails. If it
   moves no flip or link forward within about a round, distrust it [S: TablePriest].
2. Canal: Loans + Develops ≈ 30–50% of actions [D, from "bulk of loans and develops in canal"].
   Rail: ≤ 1 develop.
3. Build L2+ in canal only if it can be **flipped in canal** (a beer route exists or it's a resource tile).
4. Canal link only if ≥ 4–5 VP, or if it unlocks a build or sale you need this era.
5. Never enter rail without the cash and beer for a first-turn double rail [S: TablePriest].
6. Plan the beer route before building a sale tile: own beer, then a rival's connected beer, then merchant beer.
7. Don't build coal when the market is cheap or full and no one needs coal soon. Build it when the market is
   expensive and demand is imminent (just before a rival's rail burst) [S: TablePriest, Erik Twice].
8. Don't put a first coal mine at Redditch. It has no canal to Birmingham and two nearby markets, so the coal
   won't sell [S: Erik Twice].
9. Keep income ≥ 0. A loan is "free" at income ≤ 0 if a Coal II is coming.
10. Alternate spending rounds to string 4 actions together.
11. Sell multiple tiles per Sell action. Take the merchant bonus only as a tiebreaker.
12. Late rail: loans are nearly free, so take one to fund a final double rail or Pottery V / Cotton IV.

### C9. Rules points easy to get wrong (for a rules-faithful AI)

- Iron is free from any Iron Works, anywhere, with no connection. Coal must come from the **closest connected**
  mine, or from the market via a merchant connection [R].
- Merchant beer works only for a sale to that merchant, and **never** for a double rail [R].
- Rail era: an AI may build several tiles in one town. Canal era: max 1 tile per town per player [R].
- **UNVERIFIED:** "no loans once the draw deck is exhausted in the rail era". This shows up in tips, but it may
  be a Lancashire rule. Check it against the Birmingham rulebook before implementing.

---

## Sources

Code (tiles and deck cross-check):
- https://github.com/ikegami/tts_brass (lib/App/Birmingham.ttslua: tile table)
- https://github.com/npow/brass-birmingham (js/gameData.js: tiles, deck, merchants, income track)
- https://github.com/AndreSteenbergen/brass-birmingham (FrontEnd/src/constants/cards.js)
- https://github.com/Quasrain-Coder/BrassBirmingham (packages/engine/src/data/cards.ts, tiles.ts)
- https://github.com/a-whitehouse/bge-brass-birmingham (src/data/cards.ts)
- https://github.com/julius-retzer/brass-birmingham (src/data/cards.ts)
- https://github.com/LeoLiao031/Brass-Birmingham-Webport (IndustryCards.json)
- https://github.com/jgilles23/brass (industry_data.csv)
- https://github.com/LahavBarak/BrassRL (tiles.csv agrees; Deck.py is WRONG)
- https://github.com/lpopov101/brassbot (deck.py: Derby off by one)
- https://github.com/vivi-shiki/brass-birmingham (src/common/staticData.ts: merchants)

Rules:
- https://www.rulespal.com/brass-birmingham/rulebook
- http://files.roxley.com/Brass-Birmingham-Rulebook-2018.11.20-highlights.pdf
- https://lehi-innovation.github.io/boardgame-rules/rules/brass-birmingham/

Strategy:
- https://www.eurostrategygames.com/strategy-notes (Mafiul Robin / Legendary Tactics notes: the best single source)
- https://eriktwice.com/en/2020/11/06/brass-birmingham-beginner-mistakes/
- https://steamcommunity.com/sharedfiles/filedetails/?id=2539095235 (Avoiding Beginner Mistakes; now delisted)
- https://flathery.weebly.com/blog/brass-birmingham-strategy
- https://thetablepriest.com/mastering-brass-birmingham-tempo-plays-high-impact-openings/ (lower confidence; reads partly generic)
- https://boardgamegeek.com/thread/2571272/brass-birmingham-strategy-primer-and-openings-4p (snippets only; BGG blocked fetching)
- https://boardgamegeek.com/thread/3398674/how-to-fight-against-cotton-strategy-in-2p (snippets only)
- https://boardgamegeek.com/thread/3061778/loans (snippets only)
- https://boardgamegeek.com/thread/2756965/average-scores (snippets only)
- https://steamcommunity.com/app/1287920/discussions/0/3047231300186949614
- https://www.letsplayindex.com/video/brass-birmingham-ultimate-strategy-guide-in-depth-strategy-GZG5zzrM-wY (Legendary Tactics video; chapters not retrievable)
