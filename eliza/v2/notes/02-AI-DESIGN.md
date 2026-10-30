# AI design

## Shape
- `engine/moves.js` generates candidate actions (with "own first" / "rival first" consumption variants).
- `engine/ai.js`
  - `evaluate(s, p, persona)`: expected final VP of player p (no hidden info about rivals' hands).
  - `relValue(s, p)`: evaluate(p) - max over rivals (2p: plain difference). Helping a rival flip a tile,
    or denying their beer, shows up automatically because their estimate moves.
  - `chooseTurn(s, p)`: beam search over the turn's actions: score every first action, keep the top K
    (plus the best of each action type for diversity), then score every second action after each.
  - Optional softmax temperature for variety (and easier difficulty levels).
- Personas = weight sets (industry interest, link appetite, loan tolerance, denial, tempo).

## Evaluation terms (all in VP)
1. Banked VP.
2. Own tiles: flipped -> vp x eras it will still score (L2+ in canal = 2). Unflipped -> P(flip this era) x same,
   plus for L2+ canal tiles (1-P) x P(rail flip) x vp.
3. Own links (current era): sum of location link values; unflipped tiles count by P(flip).
4. Money: £ x moneyRate, fading to 0 as actions run out. Income: level x income phases left x incomeRate.
   Expected income from future flips is included.
5. Mat quality: per industry, how good the next tile is (develop raises it), weighted by persona interest.
   Next tile canal-only in rail = a dead tile that costs a develop.
6. Hand: card keep-values (small).
7. Turn order: estimated position next round from money spent.

P(flip) for sellables: route (connected accepting merchant) and beer (own anywhere, connected rival,
merchant beer), allocated greedily across own tiles. Resource tiles: expected demand over rounds left vs cubes.
All of these rates are tunable constants; calibrate them from the harness logs.

## Moments (measured by sim/moments.js from the event log)
- gift: I consumed a rival's coal/iron/beer (they move toward a flip). bigGift: it flipped their tile.
- denial: a rival's ability to sell dropped because of my action (beer or merchant beer taken).
- marketSwing: a market purchase that emptied or nearly emptied a market.
- sharedLink: a rival's flipped tile next to my link, or my sale routed over a rival's link.
- overbuildRival, contestedSpace (I took a space type a rival could use in their network).
- turnOrder: player who went last went first next round. bigTurn: £30+ spent in one turn. loan.
- incomeClimb per era.

## Tuning loop
`node sim/run.js --games 200 --players 2 --personas a,b` prints score ranges, win rates,
action mix and moments per game. `sim/tune.js` does simple hill-climbing on persona weights vs a baseline.
