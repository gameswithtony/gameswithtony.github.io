# Weather Machine: solo implementation reference

This is an original, condensed implementation reference for Vital Lacerda's base game and Dávid Turczi's official **The Saboteurs** solo mode. It is not a replacement rulebook. Page references below are the printed page numbers, not PDF image numbers.

## Sources and version choice

- Local `resources/wm_rulebook_v28.pdf`: base rules, printed pp. 2–23. The PDF contains two printed pages on most PDF pages.
- Local `resources/weathermachine_Solo_v0.99.pdf`: solo rules, pp. 2–13.
- The English published **Solo and SG Rules v8**, pp. 6–7, adds two clarifications absent from the supplied v0.99: Saboteurs resolve no more than one research set each turn; if an unlocked weather has all three different research colors, all three are discarded rather than retaining one through citation. [English published PDF](https://gamers-hq.de/media/pdf/c2/03/b7/Solo-and-SG-Rules-v8-LowRes.pdf).
- Those two clarifications are independently present in the corrected solo rules linked by German publisher Skellig Games: [publisher product/download page](https://www.skellig-games.de/weather-machine.html), [corrected solo PDF](https://www.skellig-rules.de/rules/0073-0007/WeatherMachine_Solo%20and%20SG%20v1_DE2_p.pdf).
- Eagle-Gryphon's [Weather Machine page](https://www.eagle-gryphon.com/products/weather-machine) links its English rulebook, player aid, and solo rules folder. That folder was not readable through the research tool. No claim is made that every later erratum has been located.

Use the published v8 clarifications above for solo play. All other rules summarized here come from the user's supplied PDFs. Component icon values must be checked against the local board, tiles, and player-aid images; extracted text omits those values.

## Setup

Use two-player setup, with the three main Locations' rightmost action spaces **open**. The human starts at Supply, first in both turn order and initiative. Lativ starts in Supply. Place one Lativ Bot in the bottom space of every Lab branch. Each Location uses two research tokens per weather. Citation spaces start locked. Extreme weather starts at Level 1, with Level 2 above Level 3 in the reserve for each weather. (Base pp. 4–7, 23; solo pp. 2–3.)

The human has 12 assembly Bots; vouchers start at Supply 4, Government 1, Lab 1, R&D 1, Science 2. Start with a random Machine Part in the middle Workshop row and a random Workshop tile extending that row. Workshop base spaces separately hold any one Chemical, one Part, and one Bot. (Base pp. 6–7.)

Remove majority Goals and the three-Award Goal. Select two Goals of each color, rejecting repeated central icons. Only these six remain available; Saboteurs have no Goals. Start the shared Saboteur target at 35 and their Hideout with 12 Bots and two distinct random Chemicals, removed from the leftmost Supply spaces. (Solo p. 2.)

Shuffle the 20 Reports. Find a main-Location Report; discard it, place its agent in that Location's middle action space, and give the Hideout its matching research token. Find a second main-Location Report for the other agent and do likewise, using rightmost if middle is occupied. Shuffle all cards except those two into the deck and expose the first Current Report. The top discard is the Previous Report. (Solo p. 3.)

Experiments: shuffle each Stage separately; keep all five Stage I, all five Stage II, and two random Stage III tiles, in that draw order. Reveal three display tiles and one below-deck tile. The Assistant starts at the weather on the still-topmost deck tile, not the below-deck tile. (Base p. 5.)

## Round and human turn

First resolve a human-only post-setup Supply turn: any number of Supply actions at normal prices. Then start round 1 with the human first. Each later round is:

1. Both sides take one turn in current turn order.
2. Resolve the Assistant's experiment.
3. Copy initiative to turn order. If Lativ is in his Office, resolve income then return him to Supply.

Changing initiative can give a side consecutive turns across a round boundary. Only one of the two Saboteur agents moves on the shared Saboteur turn. (Base pp. 8–9, 20–21; solo p. 4.)

A human turn is: use at most one available Subsidy **or** Investment; move Scientist; perform permitted actions; place all pending research tokens. Awards can be placed in empty Office spaces at any point during your turn, or retained. (Base pp. 9–12.)

Move to an empty action space of a different Location. In round 1, leftmost main-Location spaces are prohibited: use middle if available, otherwise rightmost. Main Locations give their depicted voucher plus one more of that type per other Scientist to the left; Lativ gives one Science only if also to the left. Supply first gives any voucher, plus Science if Lativ is there, then costs any voucher per other Scientist to the left. Lativ does not additionally count as a Scientist for the ordinary voucher bonus; that is a separate optional two-player variant. (Base pp. 11, 23.)

After entry rewards/payment, if you joined Lativ's Location, move Lativ to the next numbered Location, taking its leftmost free main action space and skipping full Locations. Whenever Lativ moves, place one of his reserve Bots in the first eligible Lab branch, starting at the Assistant and cycling Rain, Wind, Sun, Fog, Snow. An eligible branch has space and no Lativ Bot. When he enters Government or R&D, remove one research token matching the Assistant's weather from the Location entered, if available. (Base pp. 11, 23.)

Supply allows unlimited repeat actions. Each main Location's action symbol allows either one action, or both actions once each. Actions are optional. (Base pp. 12–13.)

## Payments and Workshop

Science substitutes for any voucher type. Only when the required type and Science are unavailable may any three other vouchers pay for the missing voucher via a Science exchange. When a required Chemical is missing, exchange one owned Chemical for one available in Supply by paying any two vouchers; immediately use the received Chemical without needing storage. When a required Part is missing, exchange one owned Part for the required color for any two vouchers. These are responses to an actual payment, not arbitrary free-standing trades. (Base p. 8.)

Bots, Parts, and Chemicals must fit immediately when gained. A Workshop tile stores one Bot **or** Part. Matching colored semicircles between vertically adjacent tiles create Chemical spaces. Tiles extend orthogonally within three rows, with matching touching semicircles and either valid orientation; placement is permanent. Items may be rearranged freely but cannot simply be discarded. All prototype Parts supplied by the human must fit in one row; every Part left in that row is returned when the prototype is built, including unused extras. (Base pp. 7, 13, 19.)

## Location actions

| Location | Action | Cost and resolution |
| --- | --- | --- |
| Supply | Extend Workshop | One Supply; choose one of four display tiles or face-up stack top; place immediately. Refill a chosen display space from the face-up stack; when empty, turn over the face-down stack. |
| Supply | Construct Bot | Pay section's Supply price, move chosen assembly Bot to Workshop, gain its space benefit. Sections three/four unlock at 6/9 constructed Bots **or** 5/8 Office and pending tokens. Top two sections' empty slots repeat their benefits at income. |
| Supply | Initiative | One Supply; choose initiative position. |
| Supply | Acquire Chemical | Pay leftmost remaining Chemical's Supply price; store it. |
| Supply | Return Chemical | Put owned Chemical into rightmost empty Supply slot; gain that slot's Supply value. |
| Government | Sell Part | One Government; advance Government funding; place available Bot on matching Part color; take a Subsidy in that branch and replace it with the paid Part; gain research or an Investment if none. Must take a Subsidy type not already owned if possible; otherwise discard the duplicate tile. |
| Government | Secure Subsidy | Two Government; choose an unflipped board Subsidy; gain its column reward, row reward, and tile effect; flip it. |
| Lab | Work on Experiment | One Lab; advance Lab funding; place Bot in empty Lab space (or displace a Lativ Bot); return matching Chemical to Supply. |
| Lab | Publish Paper | Two Lab; complete eligible Office row, optionally citing; gain row publication benefit, 2 CP per research, 4 CP per Award, and one Investment. Citation tokens score zero. Unlock that weather; may pay one Science for 3 CP if newly unlocked. |
| R&D | Research | One R&D; advance R&D funding; place Bot and matching Chemical in empty R&D slot; pay bottom-slot extra Chemical/Part if applicable; gain slot benefit and research. If the branch becomes full, gain Investment instead and unlock its citation, optionally paying Science for 3 CP. |
| R&D | Breakthrough | Two R&D; use published row with unspent Breakthrough marker; pay weather's Science cost; choose empty marker space and gain benefit; build prototype; take Award. Third Award also takes Nobel and triggers game end. |

Base pp. 13–19. A benefit granting a Location action removes its voucher cost, but material costs remain unless its icon expressly waives the Chemical. (Base p. 23.)

Government activates a branch once its Bot spaces fill: human gains 3 CP per own Bot, target rises 3 per Saboteur Bot, then place a Government marker in its weather tile's leftmost open marker space. A full weather tile is returned to the top of its weather reserve; Breakthrough markers on it leave play and Government markers return to reserve. (Base p. 14; solo p. 9.)

For a prototype, each R&D Bot can supply its slot's Part or the human may supply it. Human gains 2 CP for each own Bot in that branch and 2 CP per supplied Part. Each Saboteur Bot used as a supplier raises target by 2. Printed extra Parts on the weather tile always need supplying. Only one human Breakthrough marker can occupy a given weather tile. (Base pp. 18–19; solo p. 11.)

## Office, Goals, and funding

Six Office rows each have Government/Lab/R&D token spaces. A row's research weather must remain consistent; multiple rows can use the same weather. Awards are wild. Tokens cover and earn their space benefit. At turn end, all pending research must be placed legally or removed if no space exists. Experiment research is placed immediately. (Base p. 12.)

Publishing requires at least one research token. If a row has two tokens and its weather citation is unlocked, sacrifice an unplaced Goal of the missing column's color to insert a Citation token, taking the covered benefit immediately. Publish that row normally. (Base p. 17.)

One Investment can set an unplaced Goal into an empty matching-color Goal slot, granting its slot benefit (choose one of the two upper-slot alternatives); or flip an active unflipped Goal and receive that color's funding. Flipped Goals still score and count for victory. Government funding gains all benefits at/before the current position; Lab gives cumulative Science and grants Government or R&D funding at a temporary positive modifier; R&D offers one available benefit at/before its position. Funding markers do not move when receiving funding. (Base pp. 9–10.)

## Saboteur turn

At turn start, if no Current Report can be used because all remaining Reports are discarded, lose immediately. Read agent/destination from Current, but use **Previous** Report's weather and priority for the plan. Move to indicated Location or follow Lativ. If prohibited by same Location/full Location/Lativ's Office, cycle through main Locations numerically, never entering Supply except when explicitly directed or following Lativ there. Main spaces use leftmost, rightmost, middle priority; Supply uses leftmost free. Add one target per piece to the left, including Lativ, then move Lativ if joined. (Solo pp. 5–6.)

The main Location double-action space grants the extra preliminary effect before the main plan:

- Supply: take first initiative, or target +2 if already first; steal two Chemicals.
- Government double: steal one Chemical and flip indicated blue Subsidy; then perform ordinary Government plan.
- Lab double: gain one Hideout Award; then perform ordinary Lab plan.
- R&D double: first place an extra Bot at Previous weather/priority slot, cycling branches if full; use matching Hideout Chemical if held to gain research; then perform ordinary R&D plan.

Ordinary plans choose an eligible branch with a payable available slot. Government and R&D prioritize research usefulness. Lab additionally requires a matching display Experiment and first prioritizes most Bots already in branch (including Lativ). Research usefulness is: completes set, then matches another color already held for that weather, then any token. Weather ties cycle from Previous Report's weather. Government chooses first payable Bot slot clockwise from left; Lab and R&D use Previous top/bottom priority. Government replaces priority Subsidy with reserve Part and takes research or target +5; Lab returns Chemical to Supply and places Bot; R&D keeps Chemical next to its Bot and takes research or target +5 plus citation unlock. An impossible branch selection discards deck top and steals one Chemical, then ends the plan. Bots are a limited supply. (Solo pp. 7–11.)

Chemical theft repeats its selection after each theft: cheapest Supply section, least held type in Hideout, then topmost/bottommost type per Previous priority. Saboteurs never spend/gain vouchers or Parts, use Goals/Subsidies/Investments/Citations, or take Nobel. An Investment they would gain instead raises target by 5. (Solo pp. 4, 7–8.)

After the plan, discard Current, reveal next Current if possible, **then** resolve havoc. Thus the plan's just-discarded Report is now Previous, unless an intervening discard changed the pile. Locked weather needs all three research colors; unlocked needs two distinct colors. Awards substitute missing research. Resolve only one set: locked-weather sets first, then weather order from Previous. A locked set worsens weather, discards deck top, and unlocks citation. An unlocked set makes the human choose target +5 or deck-top discard (discard unavailable if deck empty). With all three research colors for unlocked weather, discard all three. (Solo pp. 6–7; published v8 clarifications.)

## Call Security

Only during step 3 of your human turn, in any Location, pay one voucher matching that Location (or Science). Draw two Reports next to Current. Of those three, choose one Current, one returned to deck top, and one discarded. Repeat any number of times if affordable. It does not spend a Location action allowance. This can change Previous as well as Current. The supplied rules do not explicitly define a partial draw with fewer than two deck cards; do not silently invent one. (Solo p. 5.)

## Experiment and income

The Assistant's branch runs only if every Bot space is occupied and a matching Experiment is in display. Use the rightmost matching tile. Resolve participants in turn order: return their Bots; human may pay tile's Science cost once to gain CP per returned Bot, one of its two rewards, and one research token (or Science if exhausted). A human declining payment only takes Bots back. Saboteurs always gain target per Bot and one research token if available, with no payment or additional reward. Return Lativ Bots; if any participated, remove one remaining Lab research token. Successful experiments place the next weather tile on top of existing weather. (Base p. 20, 23; solo p. 11.)

If an experiment fails, the human may return own Bots or leave them. Return Lativ Bots. Saboteur Bots stay; their presence still worsens weather, with no experiment rewards. Remove rightmost matching tile if present; slide/refill display from below-deck tile and refill below-deck from deck. Advance Assistant one weather. (Base p. 20; solo p. 11.)

Income occurs only when Lativ is in Office at round end. Pay benefits for empty assembly slots in top two sections. Resolve income Challenge effects, then return Lativ to Supply. (Base p. 21; solo p. 13.)

## Endings and checks

Check **at beginning of the human turn** for immediate victory: CP strictly exceeds target, at least four active Goals currently met, and at least two funding markers at position 5 or later. Apply Challenge 4/5 requirements. (Solo p. 4.)

Check **at end of the human turn** for immediate loss if at least two Level 3 weather tiles are showing. Check **at beginning of Saboteur turn** for exhausted Reports. Deck empty alone while a Current Report remains is not the same as every Report discarded. (Solo p. 5.)

Regular end triggers are human Nobel, last Experiment entering display, complete Government Machine, or all R&D slots filled. Finish current round, then one final round; omit final Phase C. Final Phase B resolves all completed branches with matching display tiles, starting at Assistant and cycling; do not add weather tiles. Before final score, allow remaining research/Awards into Office and Investments to set/flip Goals. Add target +30; human scores funding tracks, 5 CP per met active Goal, and 5 CP for Nobel. CP must strictly exceed target to win; apply Challenge 4/5/12. (Base p. 22; solo pp. 4, 12–13.)

## Official Challenges

| # | Name | Rule |
| --- | --- | --- |
| 1 | Fully Stocked Opponents | Start Hideout with one Chemical of each type instead of two distinct types. |
| 2 | Jamming Devices | At income, target rises by number of Saboteur Bots on board. |
| 3 | Creative Accounting | Start Hideout with Award; at income human moves one nonzero funding marker back one, if possible. |
| 4 | Nobel Laureate | Start Hideout with extra random Chemical; human cannot win without Nobel. |
| 5 | Only Overachievers Apply | Human cannot win without at least five met active Goals. |
| 6 | The Clock is Ticking | After setup remove deck's top two Reports from play. |
| 7 | One Step Ahead | At human turn end, if Saboteurs first initiative, target +3. |
| 8 | Moral High Ground | Human gains no ordinary entry voucher bonus for Saboteurs to left. |
| 9 | Peer Review | Human cannot cite or pay Science for citation-unlock CP. |
| 10 | Independent Prototypes | Start Hideout with Award; cannot use Saboteur Bots as prototype Part suppliers. |
| 11 | Budget Cuts | Start Hideout with extra random Chemical; Lab funding modifier treated as zero. |
| 12 | Publish or Perish | Initial target -5; Saboteur-caused unlocks add target +5; only immediate victory can win. |

Solo p. 13. Effects of different selected Challenges are cumulative.

## Explicit implementation questions to keep visible

- Resource/benefit order matters. Actions gained from Subsidies and token-space rewards must finish before their parent action resumes.
- The user chooses voucher composition, optional reward payments, token order/placement, Workshop arrangement, prototype suppliers, and any permitted benefit alternatives; an automatic choice must not remove a meaningful legal decision.
- Returning Bots that cannot fit may go into any empty top-two-section assembly slot; that affects future income, so the return slot is a human choice.
- Newly covering a weather tile discards its markers; removing only the top weather tile must preserve any tile underneath it.
- The supplied pre-release PDFs and publicly corrected rules may differ beyond the two published solo clarifications already verified. Track assumptions separately from rules, rather than silently inventing them.
