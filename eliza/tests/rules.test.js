// Targeted rule tests on hand-built positions. Rules: v2/notes/01-RULES-MODEL.md
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    newGame, applyAction, doAction, incomeLevel, topSpaceOfLevel, coalCost, ironCost, planCoal, planIron,
    coalPlanValid, buildSpacesAt, planBuild, planNetwork, planDevelop, planSale, sellTargets, scoreEra,
    currentPlayer, components, nextLevel, canLoan,
} from '../engine/core.js';
import { IND, SPACES, SPACES_AT, LINKS, LOCATIONS, CARDS, WILD_LOC, WILD_IND } from '../engine/data.js';

const loc = name => LOCATIONS.find(l => l.name.startsWith(name)).id;
const link = (a, b) => LINKS.find(l => l.locs.includes(loc(a)) && l.locs.includes(loc(b))).id;
const space = (name, idx) => SPACES_AT[loc(name)][idx];
const card = name => CARDS.find(c => c.name.startsWith(name)).id;

/** 2-player phone game, player 0 to act, both with full control over hands. */
function game(opts = {}) {
    const s = newGame({ players: [{ name: 'A', kind: 'ai' }, { name: 'B', kind: 'ai' }], seed: 42, firstPlayer: 0, ...opts });
    s.log = [];
    return s;
}
function put(s, p, sp, ind, lvl, extra = {}) { s.spaces[sp] = { o: p, ind, lvl, res: 0, flip: false, ...extra }; }
function give(s, p, ...names) { s.players[p].hand.push(...names.map(card)); }
function merchants(s, list) { // list of [locName, accepts[]]
    s.merch = list.map(([n, acc], i) => ({ slot: i, loc: loc(n), accepts: acc, beer: acc.length ? 1 : 0 }));
}

test('income track levels and loans', () => {
    assert.equal(incomeLevel(10), 0);
    assert.equal(incomeLevel(0), -10);
    assert.equal(incomeLevel(11), 1);
    assert.equal(incomeLevel(12), 1);
    assert.equal(incomeLevel(25), 8);
    assert.equal(incomeLevel(26), 8);
    assert.equal(incomeLevel(31), 11);
    assert.equal(incomeLevel(36), 12);
    assert.equal(incomeLevel(61), 21);
    assert.equal(incomeLevel(99), 30);
    assert.equal(topSpaceOfLevel(-3), 7);
    assert.equal(topSpaceOfLevel(12), 36);
    const s = game();
    s.players[0].hand = [card('Iron')];
    applyAction(s, { t: 'loan', card: card('Iron') });
    assert.equal(s.players[0].money, 47);
    assert.equal(s.players[0].inc, 7); // level 0 -> -3, top space of -3
    s.players[0].inc = 2; // level -8
    assert.equal(canLoan(s, 0), false);
});

test('market prices', () => {
    const s = game();
    assert.equal(coalCost(s, 1), 1); // 13 cubes: one £1 cube left
    assert.equal(coalCost(s, 2), 3);
    assert.equal(ironCost(s, 1), 2); // both £1 iron spaces start empty
    s.coal = 0;
    assert.equal(coalCost(s, 2), 16);
    s.iron = 0;
    assert.equal(ironCost(s, 1), 6);
});

test('coal: closest connected mine first, then market only with a merchant connection', () => {
    const s = game();
    const wolv = space('Wolverhampton', 1), dudley = space('Dudley', 0);
    put(s, 1, dudley, IND.CoalMine, 2, { res: 3 });
    put(s, 0, wolv, IND.CoalMine, 2, { res: 2 });
    s.links[link('Wolverhampton', 'Dudley')] = 1;
    s.links[link('Dudley', 'Birmingham')] = 1;
    // from Birmingham: Dudley (1 link) is closer than Wolverhampton (2)
    const plan = planCoal(s, 0, [loc('Birmingham')], 4);
    assert.deepEqual(plan.take, [[dudley, 3], [wolv, 1]]);
    assert.equal(plan.mkt, 0);
    // not connected to any merchant: market not allowed
    assert.equal(planCoal(s, 0, [loc('Birmingham')], 6), null);
    s.links[link('Birmingham', 'Oxford')] = 0;
    assert.equal(planCoal(s, 0, [loc('Birmingham')], 6).mkt, 1);
    // skipping the closer mine is illegal
    assert.equal(coalPlanValid(s, [loc('Birmingham')], 1, { take: [[wolv, 1]], mkt: 0 }), false);
    assert.equal(coalPlanValid(s, [loc('Birmingham')], 1, { take: [[dudley, 1]], mkt: 0 }), true);
});

test('iron comes from any iron works (own first by default), market without connection', () => {
    const s = game();
    put(s, 1, space('Dudley', 1), IND.IronWorks, 2, { res: 1 });
    put(s, 0, space('Coalbrookdale', 1), IND.IronWorks, 2, { res: 1 });
    assert.deepEqual(planIron(s, 0, 1).take, [[space('Coalbrookdale', 1), 1]]);
    assert.deepEqual(planIron(s, 0, 1, 'other').take, [[space('Dudley', 1), 1]]);
    const p = planIron(s, 0, 3);
    assert.equal(p.mkt, 1);
});

test('build: single-icon space first, one tile per location in canal era', () => {
    const s = game();
    // Coalbrookdale: [Iron/Brewery], [Iron], [Coal]. Iron Works must use the iron-only space first.
    assert.deepEqual(buildSpacesAt(s, 0, IND.IronWorks, loc('Coalbrookdale')), [space('Coalbrookdale', 1)]);
    put(s, 1, space('Coalbrookdale', 1), IND.IronWorks, 2, { res: 0, flip: true });
    assert.deepEqual(buildSpacesAt(s, 0, IND.IronWorks, loc('Coalbrookdale')), [space('Coalbrookdale', 0)]);
    put(s, 0, space('Coalbrookdale', 2), IND.CoalMine, 1, { res: 1 });
    assert.deepEqual(buildSpacesAt(s, 0, IND.IronWorks, loc('Coalbrookdale')), [], 'canal: already have a tile here');
});

test('build: era restrictions on tiles', () => {
    const s = game();
    s.players[0].mat[IND.Brewery] = [0, 0, 0, 1];
    assert.equal(nextLevel(s, 0, IND.Brewery), 4);
    assert.deepEqual(buildSpacesAt(s, 0, IND.Brewery, loc('Burton')), [], 'Brewery IV is rail only');
    s.era = 1;
    assert.equal(buildSpacesAt(s, 0, IND.Brewery, loc('Burton')).length, 1);
    s.players[0].mat[IND.CoalMine] = [1, 2, 2, 2];
    assert.deepEqual(buildSpacesAt(s, 0, IND.CoalMine, loc('Dudley')), [], 'Coal I is canal only');
});

test('build: card rules (location vs industry card, network, farm brewery)', () => {
    const s = game();
    s.players[0].hand = [card('Dudley'), card('Brewery'), WILD_LOC];
    const dud = space('Dudley', 0);
    assert.ok(planBuild(s, 0, card('Dudley'), IND.CoalMine, dud), 'location card');
    // no tiles on board: an industry card can build anywhere
    assert.ok(planBuild(s, 0, card('Brewery'), IND.Brewery, space('Farm Brewery (Kidd', 0)));
    assert.equal(planBuild(s, 0, WILD_LOC, IND.Brewery, space('Farm Brewery (Kidd', 0)), null, 'wild location cannot be a farm brewery');
    put(s, 0, space('Worcester', 0), IND.CottonMill, 1);
    // now has a tile: industry card needs the location in network
    assert.equal(planBuild(s, 0, card('Brewery'), IND.Brewery, space('Burton', 1)), null);
    assert.ok(planBuild(s, 0, WILD_LOC, IND.Brewery, space('Burton', 1)));
});

test('build: coal mine sells to market only when connected to a merchant; flips when emptied', () => {
    const s = game();
    s.players[0].hand = [card('Dudley'), card('Dudley')];
    s.coal = 12; // two £1 spaces empty
    applyAction(s, planBuild(s, 0, card('Dudley'), IND.CoalMine, space('Dudley', 0)));
    assert.equal(s.spaces[space('Dudley', 0)].res, 2, 'Coal I has 2 cubes, not connected: stays');
    assert.equal(s.coal, 12);
    const s2 = game();
    s2.players[0].hand = [card('Redditch')];
    s2.links[link('Redditch', 'Oxford')] = 1;
    s2.coal = 12;
    const before = s2.players[0].money;
    applyAction(s2, planBuild(s2, 0, card('Redditch'), IND.CoalMine, space('Redditch', 0)));
    const t = s2.spaces[space('Redditch', 0)];
    assert.equal(t.res, 0);
    assert.equal(s2.coal, 14);
    assert.equal(t.flip, true, 'flips when its last cube goes to market');
    assert.equal(s2.players[0].money, before - 5 + 2);
    assert.equal(s2.players[0].inc, 14, 'Coal I: +4 income spaces');
});

test('build: iron works always sells to the iron market', () => {
    const s = game();
    s.players[0].hand = [card('Dudley')];
    put(s, 0, space('Dudley', 0), IND.CoalMine, 2, { res: 3 });
    s.players[0].mat[IND.IronWorks] = [0, 1, 1, 1];
    s.players[0].hand = [card('Iron')];
    const a = planBuild(s, 0, card('Iron'), IND.IronWorks, space('Dudley', 1));
    // Canal era: player 0 already has a tile in Dudley -> not allowed
    assert.equal(a, null);
    s.era = 1;
    const b = planBuild(s, 0, card('Iron'), IND.IronWorks, space('Dudley', 1));
    applyAction(s, b);
    assert.equal(s.iron, 10, 'two £1 spaces filled');
    assert.equal(s.spaces[space('Dudley', 1)].res, 2);
});

test('overbuild: own tiles freely, rival coal only when no coal anywhere', () => {
    const s = game();
    const sp = space('Dudley', 0);
    put(s, 1, sp, IND.CoalMine, 1, { res: 0, flip: true });
    s.players[0].mat[IND.CoalMine] = [0, 2, 2, 2]; // my next coal is level II
    assert.ok(!buildSpacesAt(s, 0, IND.CoalMine, loc('Dudley')).includes(sp), 'market still has coal');
    s.coal = 0;
    assert.ok(buildSpacesAt(s, 0, IND.CoalMine, loc('Dudley')).includes(sp));
    put(s, 1, space('Cannock', 1), IND.CoalMine, 2, { res: 1 });
    assert.ok(!buildSpacesAt(s, 0, IND.CoalMine, loc('Dudley')).includes(sp), 'a cube on the board blocks it');
    // own pottery overbuild
    put(s, 0, space('Stafford', 1), IND.Pottery, 1, { flip: true });
    s.players[0].mat[IND.Pottery] = [0, 1, 1, 1, 1];
    assert.ok(buildSpacesAt(s, 0, IND.Pottery, loc('Stafford')).includes(space('Stafford', 1)));
    // rival's pottery: never
    put(s, 1, space('Coventry', 0), IND.Pottery, 1, { flip: true });
    assert.ok(!buildSpacesAt(s, 0, IND.Pottery, loc('Coventry')).includes(space('Coventry', 0)));
});

test('network: canal single link £3; rail double needs brewery beer (not merchant)', () => {
    const s = game();
    s.players[0].hand = [card('Dudley')];
    put(s, 0, space('Dudley', 0), IND.CoalMine, 2, { res: 3 });
    assert.equal(planNetwork(s, 0, card('Dudley'), [link('Dudley', 'Birmingham'), link('Birmingham', 'Coventry')]), null, 'canal: 1 link');
    const a = planNetwork(s, 0, card('Dudley'), [link('Dudley', 'Birmingham')]);
    assert.equal(a.cost, 3);
    assert.equal(planNetwork(s, 0, card('Dudley'), [link('Birmingham', 'Coventry')]), null, 'must touch network');
    s.era = 1;
    assert.equal(planNetwork(s, 0, card('Dudley'), [link('Dudley', 'Birmingham'), link('Birmingham', 'Coventry')]), null, 'no beer');
    put(s, 1, space('Coventry', 1), IND.Brewery, 2, { res: 1 }); // not a brewery space, but fine for the test
    const d = planNetwork(s, 0, card('Dudley'), [link('Dudley', 'Birmingham'), link('Birmingham', 'Coventry')]);
    assert.ok(d, 'rival brewery connected to the 2nd link');
    assert.equal(d.cost, 15);
    s.players[0].hand = [card('Dudley')];
    applyAction(s, d);
    assert.equal(s.spaces[space('Dudley', 0)].res, 1, 'one coal per rail link');
    assert.equal(s.spaces[space('Coventry', 1)].flip, true, 'rival brewery flipped by my beer use');
});

test('farm brewery: one Kidderminster-Worcester link connects all three', () => {
    const s = game();
    s.links[link('Kidderminster', 'Worcester')] = 0;
    const comp = components(s);
    assert.equal(comp[loc('Kidderminster')], comp[loc('Farm Brewery (Kidd')]);
    assert.equal(comp[loc('Worcester')], comp[loc('Farm Brewery (Kidd')]);
});

test('sell: needs a matching merchant and beer; merchant beer gives the bonus', () => {
    const s = game();
    merchants(s, [['Shrewsbury', [IND.CottonMill]], ['Oxford', []], ['Oxford', [IND.Manufacturer]], ['Gloucester', []], ['Gloucester', [IND.Pottery]]]);
    const cot = space('Coalbrookdale', 0); // not a cotton space, test only
    put(s, 0, cot, IND.CottonMill, 1);
    assert.deepEqual(sellTargets(s, cot), [], 'not connected');
    s.links[link('Shrewsbury', 'Coalbrookdale')] = 1; // rival link counts
    assert.deepEqual(sellTargets(s, cot), [0]);
    const sale = planSale(s, 0, cot, 0);
    assert.deepEqual(sale.beer, [{ m: 0 }]);
    s.players[0].hand = [card('Dudley')];
    const vp = s.players[0].vp;
    applyAction(s, { t: 'sell', card: card('Dudley'), sales: [sale] });
    assert.equal(s.spaces[cot].flip, true);
    assert.equal(s.players[0].vp, vp + 4, 'Shrewsbury bonus 4 VP');
    assert.equal(s.merch[0].beer, 0);
    // second cotton: no merchant beer left, no brewery -> cannot sell
    put(s, 0, space('Coalbrookdale', 1), IND.CottonMill, 1);
    assert.equal(planSale(s, 0, space('Coalbrookdale', 1), 0), null);
    // own brewery anywhere works
    put(s, 0, space('Burton', 1), IND.Brewery, 1, { res: 1 });
    assert.deepEqual(planSale(s, 0, space('Coalbrookdale', 1), 0).beer, [{ sp: space('Burton', 1) }]);
    // a rival's brewery must be connected
    s.spaces[space('Burton', 1)].o = 1;
    assert.equal(planSale(s, 0, space('Coalbrookdale', 1), 0), null);
});

test('scoring: links count flipped tiles (any owner) and 2 per merchant', () => {
    const s = game();
    s.links[link('Dudley', 'Birmingham')] = 0;
    s.links[link('Birmingham', 'Oxford')] = 1;
    put(s, 1, space('Dudley', 0), IND.CoalMine, 2, { flip: true }); // link 1
    put(s, 0, space('Birmingham', 2), IND.IronWorks, 2, { flip: true }); // link 1
    put(s, 0, space('Birmingham', 1), IND.Manufacturer, 1, { flip: false }); // unflipped: 0
    const r = scoreEra(s);
    assert.equal(r[0].links, 1 + 1);
    assert.equal(r[1].links, 1 + 2);
    assert.equal(r[0].tiles, 5);
    assert.equal(r[1].tiles, 2);
});

test('flow: first canal round is 1 action each; turn order by money spent; rail deal', () => {
    const s = game();
    assert.equal(s.acts, 1);
    const p0 = currentPlayer(s);
    s.players[p0].hand[0] = card('Dudley');
    applyAction(s, planBuild(s, p0, card('Dudley'), IND.CoalMine, space('Dudley', 0))); // spends £5
    const p1 = currentPlayer(s);
    assert.notEqual(p0, p1);
    applyAction(s, { t: 'pass', card: s.players[p1].hand[0] });
    assert.equal(s.round, 2);
    assert.equal(s.acts, 2);
    assert.deepEqual(s.order, [p1, p0], 'least spent goes first');
    assert.equal(s.players[p0].hand.length, 8);
    // play out the canal era with passes
    while (s.era === 0) applyAction(s, { t: 'pass', card: s.players[currentPlayer(s)].hand[0] });
    assert.equal(s.round, 1);
    assert.equal(s.spaces[space('Dudley', 0)], null, 'level 1 removed');
    for (const p of s.players) { assert.equal(p.hand.length, 8); assert.equal(p.discard.length, 0); assert.equal(p.links, 14); }
    assert.equal(s.acts, 2, 'rail round 1 has 2 actions');
    let rounds = 0, last = 1;
    while (!s.over) { applyAction(s, { t: 'pass', card: s.players[currentPlayer(s)].hand[0] }); if (s.round !== last) { rounds++; last = s.round; } }
    assert.equal(rounds, 9, '10 rail rounds');
});

test('physical mode: each AI gets its own 2*rounds card share, disjoint', () => {
    const s = newGame({ players: [{ name: 'H', kind: 'human' }, { name: 'Eliza', kind: 'ai' }, { name: 'Eleanor', kind: 'ai' }], seed: 3, mode: 'physical' });
    const [h, e1, e2] = s.players;
    assert.equal(h.hand, null);
    assert.equal(h.money, 17, 'money is tracked for physical humans too');
    for (const p of [e1, e2]) assert.equal(p.hand.length + p.discard.length + p.pile.length, 18);
});

test('develop: lightbulb potteries cannot be developed; costs 1 iron each', () => {
    const s = game();
    assert.equal(planDevelop(s, 0, null, [IND.Pottery]), null);
    const d = planDevelop(s, 0, null, [IND.CoalMine, IND.CoalMine]);
    assert.equal(d.iron.mkt, 2);
    assert.equal(d.cost, 2 + 2);
});

test('AI considers overbuilding a rival coal mine when coal has run out', async () => {
    const { generateActions } = await import('../engine/moves.js');
    const s = game();
    s.coal = 0;
    const sp = space('Dudley', 0);
    put(s, 1, sp, IND.CoalMine, 1, { res: 0, flip: true });
    s.players[0].mat[IND.CoalMine] = [0, 2, 2, 2];
    s.players[0].hand = [card('Dudley')];
    const acts = generateActions(s).filter(a => a.t === 'build' && a.sp === sp);
    assert.equal(acts.length, 1, 'overbuild offered');
});
