# Rules model (what the engine implements)

Rulebook v2018.11 + board/mat images. Every rule here should have a test in `eliza/tests/`.

## Setup
- Players 2-4. Each: £17, income space 10 (= level 0), VP 0, 14 links, full mat (45 tiles).
- Deck by player count (player aid card). 2p: no blue/teal locations, no Man/Cotton cards.
  Location: Belper 0/0/2, Derby 0/0/3, Leek 0/2/2, Stoke 0/3/3, Stone 0/2/2, Uttoxeter 0/1/2,
  Stafford 2, Burton 2, Cannock 2, Tamworth 1, Walsall 1, Coalbrookdale 3, Dudley 2,
  Kidderminster 2, Wolverhampton 2, Worcester 2, Birmingham 3, Coventry 3, Nuneaton 1, Redditch 1.
  Industry: Iron Works 4/4/4, Coal Mine 2/2/3, Man/Cotton 0/6/8, Pottery 2/2/3, Brewery 5/5/5.
  Totals 40/54/64. Rounds per era 10/9/8.
- Deal 8 to each, +1 face down to each discard pile. 4 wild location + 4 wild industry cards.
- Merchant tiles (9): 2p+: blank, blank, Cotton, Man, Cotton+Man+Pottery ("all").
  3p+: blank, Pottery. 4p: Man, Cotton. Placed randomly on merchant slots for the player count:
  Shrewsbury (1 slot, 2p+), Oxford (2, 2p+), Gloucester (2, 2p+), Warrington (2, 3p+), Nottingham (2, 4p).
  1 beer beside each non-blank merchant tile.
- Markets: coal 14 spaces (£1..£7, 2 each), starts 13. Iron 10 spaces (£1..£5, 2 each), starts 8.
  Buy = cheapest filled space. Empty market: coal £8, iron £6 (unlimited).
  Sell to market (new mine/works) = most expensive empty space, one cube at a time.
- Turn order round 1: random.

## Income track
Space s (0..99) -> level: s<=10: s-10; s<=30: ceil((s-10)/2); s<=60: 10+ceil((s-30)/3); else 20+ceil((s-60)/4), max 30.
Income increases move *spaces*. Loan: back 3 *levels*, to the highest space of the new level;
not allowed if that goes below level -10.

## Round
- Players act in turn order; 2 actions each (1 each in the first canal round). Each action discards
  1 card (wilds return to supply). Pass = discard without acting.
- Refill hand to 8 after your turn while the deck lasts.
- Money spent this round is recorded. Next round order: least spent first; ties keep relative order.
- Income: everyone collects income level (negative = pay; shortfall -> sell own industry tiles for
  half cost rounded down (removed from game) until covered; otherwise lose 1 VP per £1 short).
  No income after the final round of the game (rail era). Canal era final round DOES pay income.
- Era ends after the round where all hands are empty.

## Network membership
Location in my network if it has my industry tile or is adjacent to my link.
Connected = path of links (any owner). The Kidderminster-Worcester link also joins the Southern
Farm Brewery (one link, three locations). Cannock <-> Northern Farm Brewery is its own link.

## Build
- Card: Location card (that location, any industry, not in network needed; not farm breweries);
  Wild location (any location except farm breweries); Industry card (that industry, location in my
  network); Wild industry. Man/Cotton card works for either. Farm breweries: brewery card or wild industry only.
- No tiles of mine on the board at all (industry or link): industry card builds anywhere.
- Tile = lowest level remaining of that industry on my mat. Canal-only tiles (all level I except Pottery I)
  not in rail era; rail-only tiles (Brewery IV, Pottery V) not in canal era.
- Space: prefer an empty space showing only that industry; if none, a mixed space with that icon.
- Canal era: max 1 of my industry tiles per location (not counting the tile I overbuild).
- Overbuild: replace a tile of the same industry with a higher level. Own: always. Opponent's:
  only Coal Mine / Iron Works and only when there are no cubes of that resource anywhere
  (board tiles + market). Resources on the removed tile are returned. Removed tile is gone.
- Pay £ + coal + iron. Coal: location must be connected to a source after placing:
  closest connected unflipped mine first (by link count, ties = choice), then next closest...,
  then market only if the location is connected to any merchant location (blank or not). Iron: any
  unflipped iron works anywhere (free, any choice), then market (no connection needed).
- After build: Coal mine gets its cubes; if connected to any merchant location, move as many as possible
  to the coal market (most expensive empty spaces first), owner earns that money.
  Iron works: always move as many as possible to the iron market. Brewery: 1 beer (canal) / 2 (rail).
  If all cubes leave, flip immediately (+income).

## Network action
- Canal: 1 canal link, £3. Rail: 1 rail link £5 + 1 coal, or 2 rail links £15 + 2 coal + 1 beer.
- Link must touch a location in my network (the network as it is when that link is placed, so the
  second rail link can extend from the first). No tiles on board: anywhere.
- Each rail link's coal: from the closest mine connected to that link (after placing), else market via merchant.
- The beer for a double link: own brewery anywhere, or opponent brewery connected to the second link. Never merchant beer.

## Develop
Remove 1 or 2 tiles (lowest level of chosen industry each time), 1 iron each (any works / market).
Pottery with lightbulb (I, III) cannot be developed.

## Sell
Repeat per tile: unflipped Cotton/Man/Pottery connected to a merchant tile that shows its icon.
Beer needed = tile's beer number: own brewery anywhere, opponent brewery connected to the selling tile,
or the beer beside the merchant you are selling to (gives that merchant's bonus: Warrington £5,
Nottingham 3 VP, Shrewsbury 4 VP, Oxford +2 income spaces, Gloucester free develop 1 tile, no iron).
Flip, gain income. Must be able to sell at least 1 tile.

## Loan / Scout
Loan: £30, income back 3 levels (not below -10). Scout: discard 3 cards, take 1 wild location
+ 1 wild industry; not if holding a wild.

## Flip
Coal/iron/brewery flips when its last resource is removed (often on an opponent's turn) -> owner gains income.
Cotton/Man/Pottery flip by selling.

## End of era
1. Links: each of my links scores the link icons of its 2 locations (merchant location = 2;
   industry location = sum of link VPs of FLIPPED tiles there, any owner). Remove links.
   Farm-brewery 3-way link: scores Kidderminster + Worcester only (as v1 did). (Check.)
2. Flipped tiles score their VPs (all eras; level 2+ stay and can score again in rail).
3. Canal end: remove level I tiles from board, refill merchant beer, reshuffle deck, deal 8 (no face-down card).
Winner: VPs, then income level, then money.

## Open questions (rules)
- Farm brewery 3-way link scoring. v1 scored only Kidderminster-Worcester. Rulebook says the link
  "also connects both locations to the Farm Brewery". A Farm Brewery tile has link icons (2), so a
  flipped farm brewery should add to that link. Engine: link value = sum over ALL locations the link touches.
