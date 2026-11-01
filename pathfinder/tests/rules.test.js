// Rules tests. Run: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { HEXES, dist, neighbors, cardOrder, step } from '../js/hex.js';
import { newGame, answer, choices, scoreBreakdown, YOU, PF } from '../js/engine.js';
import { buildSpots, slotCost, placeOnSlot, lqScore, colonyUpdateDue, payOptions, H } from '../js/core.js';
import { construct } from '../js/tasks.js';
import { resupply, pfConstruct, moveBots } from '../js/pathfinder.js';
import * as D from '../js/data.js';

const fresh = (o = {}) => newGame({ seed: 5, ...o });
/** Clear every building except the ones listed. */
function clearMap(st) { for (const h of HEXES) { st.hex[h] = { b: null, crystal: 0, disc: null, res: null }; } st.bots = []; st.rover = null; }
const put = (st, h, type, o) => { st.hex[h].b = { type, adv: null, col: null, ...(type === 'shelter' ? { o } : {}) }; };

test('map has 91 hexes and symmetric neighbours', () => {
    assert.equal(HEXES.length, 91);
    for (const h of HEXES) for (const n of neighbors(h)) {
        assert.equal(dist(h, n), 1);
        assert.ok(neighbors(n).includes(h), `${h} <-> ${n}`);
    }
    assert.equal(neighbors('6,4').length, 6);
    assert.equal(dist('6,0', '6,8'), 8);
    assert.equal(step('6,4', 'n'), '6,3');
    assert.equal(step('6,4', 'se'), '7,4');   // even column: SE is same row
    assert.equal(step('7,4', 'se'), '8,5');   // odd column: SE is next row
});

test('card order sweeps columns in the four directions', () => {
    const ids = ['2,3', '2,5', '8,1', '8,6'];
    assert.equal(cardOrder(ids, { n: 1, x: false })[0], '2,3'); // left→right, top→bottom
    assert.equal(cardOrder(ids, { n: 2, x: false })[0], '8,1'); // right→left, top→bottom
    assert.equal(cardOrder(ids, { n: 3, x: false })[0], '2,5'); // left→right, bottom→top
    assert.equal(cardOrder(ids, { n: 1, x: true })[0], '8,6');  // right→left, bottom→top
});

test('starting setup matches the 2-player board', () => {
    const st = fresh();
    assert.equal(st.hex['6,4'].b.type, 'mine');
    assert.deepEqual(D.START_LSS.map(h => st.hex[h].b.type).sort(), ['gen', 'green', 'oxy', 'water']);
    assert.equal(st.hex['6,5'].b.o, YOU); assert.equal(st.hex['6,3'].b.o, PF);
    assert.equal(Object.values(st.ware).every(n => n === 2), true);
    assert.equal(st.bpBot.filter(Boolean).length, 6);
    assert.equal(st.pfDisc[3].length + st.pfDisc[4].length + st.pfDisc[5].length, 6);
    assert.ok([...st.pfDisc[3], ...st.pfDisc[4], ...st.pfDisc[5]].every(id => !D.disc(id).res), 'LSS discovery tiles are non-resource');
    assert.equal(st.p[YOU].lab['2b'], 'shelter');
    assert.equal(st.shuttle.side, st.p[PF].side);
    assert.equal(st.missions.filter(m => D.mission(m.id).short).length, 2, 'short game = 2 short + 1 long');
    assert.equal(st.prompt.q, 'space');
});

test('construct: exactly two away, or adjacent with enough tech', () => {
    const st = fresh();
    clearMap(st);
    put(st, '6,4', 'gen');
    st.bots.push({ o: YOU, h: '6,6' });
    const spots = buildSpots(st, YOU, 'gen');
    const by = Object.fromEntries(spots.map(s => [s.h, s]));
    assert.ok(by['6,6'] && by['6,6'].size === 1, '2 away is legal');
    assert.ok(!by['6,5'], 'adjacent needs the generator tech, nobody has it');
    st.p[PF].lab['1a'] = 'gen';
    const by2 = Object.fromEntries(buildSpots(st, YOU, 'gen').map(s => [s.h, s]));
    assert.equal(by2['6,5'].size, 2); assert.equal(by2['6,5'].need, 1);
    // a 3-complex needs level 3 to join
    put(st, '6,3', 'gen'); put(st, '6,2', 'gen');
    st.bots.push({ o: YOU, h: '7,4' });
    const by3 = Object.fromEntries(buildSpots(st, YOU, 'gen').map(s => [s.h, s]));
    assert.ok(!by3['7,4'], 'level-1 tech cannot join a complex of 3');
    assert.equal(buildSpots(st, YOU, 'gen', { techBoost: 2 }).find(s => s.h === '7,4').size, 4);
});

test('construct pays out, places crystals, moves LSS and scores the first build', () => {
    const st = fresh();
    clearMap(st);
    put(st, '6,4', 'water'); put(st, '6,6', 'shelter', YOU);
    st.stacks.water = [{ id: 'w', arrows: true }];
    st.stack = []; st.prompt = null;
    const op0 = st.p[YOU].op;
    construct(st, YOU, 'water', '6,2');
    assert.equal(st.hex['6,1'].crystal, 1, 'north arrow');
    assert.equal(st.hex[step('6,2', 'sw')].crystal, 1);
    assert.equal(st.lss.water, 2);
    const reward = D.LSS_TILES.find(t => t.k === st.lssTiles[1]);
    assert.ok(st.p[YOU].op >= op0 + 2, 'first water extractor scores 2 + LSS tile');
    assert.equal(st.stack.at(-1).t, 'lssBen', 'you choose an LSS bonus');
    assert.ok(reward);
});

test('2-player slot cost counts every colonist; full slots clear the majority', () => {
    const st = fresh();
    st.slots.construct = [PF, PF];
    assert.equal(slotCost(st, 'construct', YOU), 2);
    st.slots.construct = [PF, PF, YOU];
    assert.equal(slotCost(st, 'construct', YOU), 1, 'PF has most → cleared, your 1 remains');
    const lq = st.p[YOU].col.lq;
    placeOnSlot(st, 'construct', YOU);
    assert.deepEqual(st.slots.construct, [YOU, YOU]);
    assert.equal(st.p[YOU].col.lq, lq - 1);
    st.slots.hire = [PF];
    assert.equal(slotCost(st, 'hire', YOU), 1);
});

test('minerals substitute for resources but not crystals', () => {
    const p = { res: { mineral: 1, battery: 0, water: 0, plant: 0, oxygen: 0 }, cr: 0, goals: [] };
    assert.equal(payOptions(p, ['oxygen']).length, 1);
    assert.deepEqual(payOptions(p, ['oxygen'])[0], { mineral: 1 });
    assert.equal(payOptions(p, ['crystal']).length, 0);
    p.goals = [3];
    assert.deepEqual(payOptions(p, ['crystal'])[0], { goal: 1 }, 'a goal card pays for a crystal');
});

test('colony level-up: blueprints, warehouse refill, progress scoring, Pathfinder extras', () => {
    const st = fresh();
    st.stack = []; st.prompt = null;
    D.LSS_TYPES.forEach(t => st.lss[t] = 2);
    st.p[YOU].progress = { gen: true, water: true };
    st.ware.water = 0;
    assert.ok(colonyUpdateDue(st));
    const pfShips = st.p[PF].hangar, pfBots = st.bots.filter(b => b.o === PF).length;
    st.turn = { p: YOU, techUses: [] };
    st.stack.push({ t: 'colonyUpdate', s: 0 });
    while (st.stack.length && !st.prompt) { const t = st.stack.at(-1); if (H[t.t](st, t) === 'done') st.stack.splice(st.stack.lastIndexOf(t), 1); }
    assert.equal(st.level, 2);
    assert.equal(st.bpTop.filter(Boolean).length, 6, 'top row gets level-3 cards');
    assert.equal(st.p[YOU].opLog.progress, 2, '2 cubes score 2');
    assert.equal(st.p[PF].hangar, pfShips + 1, 'Pathfinder welcomes a ship');
    assert.equal(st.bots.filter(b => b.o === PF).length, pfBots + 1, 'and gains a bot on its new shelter');
    assert.equal(st.pfDisc[3].length, 0, 'it used the level-2 discovery tile');
});

test('Pathfinder resupply takes what your advanced buildings make least', () => {
    const st = fresh();
    clearMap(st);
    put(st, '1,3', 'water'); st.hex['1,3'].b.adv = { o: YOU, bp: 5 };
    st.p[YOU].bps = [{ id: 5, h: '1,3' }, { id: 1, h: null }];
    D.WARE.forEach(w => st.ware[w] = 1);
    resupply(st, null);
    assert.equal(st.ware.crystal, 0, 'crystal: none produced, leftmost of the ties');
    st.hex['2,3'] = { b: { type: 'shelter', o: YOU, adv: { o: YOU, bp: 11 }, col: null }, crystal: 0, disc: null, res: null };
    resupply(st, null);
    assert.equal(st.ware.battery, 0, 'battery next (no generator blueprints)');
});

test('Pathfinder constructs the largest complex, only for types below the colony line', () => {
    const st = fresh();
    st.stack = []; st.prompt = null;
    st.solo.card = 5; // B · 1 · no X → left-to-right sweep
    st.p[PF].lab['1a'] = 'green';
    st.lss.gen = 2; // generators at the line: not eligible
    st.turn = { p: PF, techUses: [] };
    const t = { sum: [] };
    assert.ok(pfConstruct(st, t, { action: true }));
    assert.equal(t.sum[0].type, 'green', 'only the greenhouse tech allows a complex of 2');
    assert.equal(t.sum[0].size, 2);
    assert.equal(st.slots.construct.at(-1), PF, 'colonist placed on the action');
});

test('Pathfinder bots head for the nearest tile and clear it', () => {
    const st = fresh();
    clearMap(st);
    st.bots.push({ o: PF, h: '6,4' });
    st.hex['6,2'].crystal = 1; st.hex['1,4'].disc = 7;
    st.level = 2;
    moveBots(st, { sum: [] }, 2);
    assert.equal(st.bots[0].h, '6,2');
    assert.equal(st.hex['6,2'].crystal, 0);
});

test('living quarters scoring tiers', () => {
    assert.deepEqual([0, 3, 4, 5, 6, 7, 8, 9, 12].map(lqScore), [0, 3, 3, 6, 6, 10, 10, 15, 21]);
});

test('Pathfinder end scoring: no blueprint penalty, quarters full, contracts kept', () => {
    const st = fresh();
    st.p[PF].bps = [{ id: 13, h: null }];
    st.p[PF].contracts = [{ id: 7, del: {}, done: true }];
    st.p[YOU].bps = [{ id: 13, h: null }];
    st.p[YOU].contracts = [{ id: 7, del: {}, done: false }];
    const pf = scoreBreakdown(st, PF, true), you = scoreBreakdown(st, YOU, true);
    assert.equal(pf.blueprints, 0); assert.equal(you.blueprints, -5);
    assert.equal(pf.contracts, 9); assert.equal(you.contracts, -4);
    assert.equal(pf.colonists, 3, '4 slots with one shelter → 3 OP');
});

test('a full game is deterministic for a seed and answers', () => {
    const play = () => {
        let st = newGame({ seed: 77 });
        let n = 0;
        while (!st.over && n++ < 4000) {
            const c = choices(st.prompt);
            const v = c.find(x => x && x.a === 'main' && x.k !== 'pod') || c.find(x => x && x.a === 'end') || (c.find(x => x !== 'done' && x !== 'back') ?? c[0]);
            st = answer(st, v);
        }
        return st;
    };
    const a = play(), b = play();
    assert.ok(a.over, 'game finishes');
    assert.equal(JSON.stringify(a.result), JSON.stringify(b.result));
});
