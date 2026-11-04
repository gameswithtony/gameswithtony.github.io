// Rules tests. Run: node --test tests/*.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, answer, choices, canAssemble, cleanFullLines, refillDesigns, advancePace, toTestTrack, certOrder, weekScore, finalScore, botFinalScore, partCount, carCount, kanbanAdds, H, pgCount, trackLeader } from '../js/engine.js';
import { rollSync, stationOpts } from '../js/tasks.js';
import { botSelect, sandraMove, dealPlans, endOfWeek, botTrain } from '../js/bots.js';
import * as D from '../js/data.js';

const fresh = (o = {}) => newGame({ seed: 5, sandbox: true, ...o });
const play = (st, v) => answer(JSON.parse(JSON.stringify(st)), v);

test('setup: parts and cars conserved, 4 Performance Goals in hand, Colleagues stack of 4', () => {
    const st = fresh();
    assert.deepEqual(Object.values(partCount(st)), D.PARTS.map(() => 10));
    assert.deepEqual(Object.values(carCount(st)), D.MODELS.map(() => 8));
    assert.equal(st.p.hand.length, 4);
    assert.equal(st.pg.room.length, 4);
    assert.equal(st.bots.stack.length, 4);
    assert.ok(st.bots.stack.every(id => D.dPart(id)));
    assert.equal(st.p.desk.length, 1);
    assert.equal(st.p.parts.length, 1);
    assert.equal(st.prompt.q, 'certStart');
});

test('every Kanban card has 5 Part types: the missing one is your starting Part', () => {
    D.KANBAN.forEach(card => assert.equal(new Set(card.flat()).size, 5));
});

test('starting certification: Colleagues avoid your space', () => {
    let st = play(fresh(), 0);
    assert.deepEqual(st.p.cert, [0, 0]);
    assert.deepEqual(st.bots.L.cert, [0, 1]);
    assert.deepEqual(st.bots.T.cert, [0, 2]);
    st = play(fresh(), 2);
    assert.deepEqual(st.bots.L.cert, [0, 0]);
    assert.deepEqual(st.bots.T.cert, [0, 3]);
    assert.deepEqual(certOrder(st), ['T', 'you', 'L']);
    assert.equal(st.p.vouchers, 2, 'space 3 gives a Parts Voucher (plus the one from setup)');
});

test('assembly: a car rolling into an occupied plate bumps it on; exits score', () => {
    const st = fresh();
    st.asm.at = Object.fromEntries(Object.keys(st.asm.at).map(k => [k, null]));
    st.asm.at['s:city'] = 'city'; st.asm.at.P5 = 'suv'; st.asm.at.P4 = 'truck';
    const pp = st.p.pp;
    rollSync(st, 'city', 'T');
    assert.equal(st.asm.at.P5, 'city');
    assert.equal(st.asm.at.P4, 'suv');
    assert.deepEqual(st.track.slice(-1), ['truck'], 'the truck rolled off the middle exit');
    assert.ok(st.p.pp <= pp - 2, 'Turczi scored 2 PP (you lose it)');
    assert.equal(st.asm.at['s:city'], 'city', 'a new City car enters');
});

test('assembly: Lacerda turns toward the middle row, Turczi goes left', () => {
    for (const [who, want] of [['L', 'P5'], ['T', 'P2']]) {
        const st = fresh();
        st.asm.at = Object.fromEntries(Object.keys(st.asm.at).map(k => [k, null]));
        st.asm.at['s:suv'] = 'suv'; st.asm.at.P3 = 'concept';
        rollSync(st, 'suv', who);
        assert.equal(st.asm.at[want], 'concept', who);
    }
});

test('assembly: Upgraded Parts first, no duplicates, full lines clean', () => {
    const st = fresh();
    st.upg.city[0] = 'motor';
    assert.equal(canAssemble(st, 'city', 'battery'), false);
    assert.equal(canAssemble(st, 'city', 'motor'), true);
    assert.equal(canAssemble(st, 'city', 'battery', true), true, 'Speedcharger ability 2');
    st.asm.sp.city = ['motor'];
    assert.equal(canAssemble(st, 'city', 'motor'), false);
    assert.equal(canAssemble(st, 'city', 'battery'), true);
    st.asm.sp.city = ['motor', 'battery', 'body'];
    assert.deepEqual(cleanFullLines(st), ['city']);
    assert.deepEqual(st.asm.sp.city, []);
});

test('Kanban layouts: only symbols on their warehouse side add Parts', () => {
    // card 0: [autopilot x2], [drivetrain, motor], [battery, electronics]
    assert.deepEqual(kanbanAdds(0, { flip: false, up: true }).out.sort(), ['autopilot', 'autopilot', 'electronics', 'motor'].sort());
    assert.deepEqual(kanbanAdds(0, { flip: false, up: false }).out.sort(), ['autopilot', 'autopilot', 'drivetrain', 'electronics'].sort());
});

test('test track: 4 cars max; the 5th pushes out the front car', () => {
    const st = fresh();
    st.track = ['city', 'suv', 'truck', 'sports'];
    const before = st.carSupply.city;
    assert.equal(toTestTrack(st, 'concept'), 'city');
    assert.deepEqual(st.track, ['suv', 'truck', 'sports', 'concept']);
    assert.equal(st.carSupply.city, before + 1);
});

test('Pace Car: a Meeting every 4 spaces on the 3-player overlay', () => {
    const st = fresh();
    assert.equal(advancePace(st, 3), false);
    assert.equal(advancePace(st, 1), true);
    assert.equal(st.meetingDue, true);
});

test('Design display slides right and refills from its First Office stack', () => {
    const st = fresh();
    const top0 = st.design.fo[0][0];
    st.design.disp[0][3] = null;
    refillDesigns(st);
    assert.ok(st.design.disp[0].every(Boolean));
    assert.equal(st.design.disp[0][0], top0);
});

test('Colleague selection: occupied or same department moves on, top to bottom', () => {
    const st = fresh();
    st.plan.col = [3, 5, 7]; // Assembly, Logistics, Design
    st.sel.deck = [D.SELECTION.find(s => s.take === 't').id];
    st.pos.L = 3; // Lacerda is in Assembly bottom already
    botSelect(st, 'L');
    assert.equal(st.pos.L, 5, 'skips his own department to Logistics bottom');
    st.sel.deck = [D.SELECTION.find(s => s.take === 'b').id];
    st.pos.you = 12; st.pos.T = null;
    st.pos.you = 6; // you sit at Design top
    botSelect(st, 'T');
    assert.equal(st.pos.T, 8, 'Design top taken: Admin top');
});

test('Sandra: next empty workstation in the next department; Admin means her desk', () => {
    const st = fresh();
    st.pos.S = D.DESK;
    st.pos.L = 0; st.pos.T = 1;
    sandraMove(st);
    assert.equal(st.pos.S, 2, 'R&D full: Assembly top');
    st.pos.S = 6; // Design
    sandraMove(st);
    assert.equal(st.pos.S, D.DESK);
});

test('stations: never your department or Sandra\'s, never occupied', () => {
    const st = fresh();
    st.pos.you = 0; st.pos.S = 4; st.pos.L = 7; st.pos.T = null;
    const ok = stationOpts(st);
    assert.ok(!ok.includes(0) && !ok.includes(1), 'own department');
    assert.ok(!ok.includes(4) && !ok.includes(5), "Sandra's department");
    assert.ok(!ok.includes(7), 'occupied');
    assert.ok(ok.includes(2) && ok.includes(6) && ok.includes(8));
});

test('Plan column refills to 3; a drawn Reshuffle card reshuffles', () => {
    const st = fresh();
    st.plan.col = [1];
    st.plan.deck = [D.RESHUFFLE, 2, 3, 4];
    st.plan.discard = [5, 6];
    dealPlans(st);
    assert.deepEqual(st.plan.col, [1, 2, 3]);
    assert.equal(st.plan.discard.length, 0);
    assert.equal(st.plan.deck.length, 4); // 4 and 5, 6 and Reshuffle
});

test('Colleague certification: 2 PP for first, marker to space 1 (or 2)', () => {
    const st = fresh();
    st.p.cert = [1, 0];
    st.bots.L.tr[0] = 2;
    const pp = st.p.pp;
    botTrain(st, 'L', 'rd', []);
    assert.deepEqual(st.bots.L.cert, [1, 1]);
    assert.equal(st.p.pp, pp - 2);
    assert.equal(st.firstCert.rd, 'L');
});

test('End of Week: per car, upgrades to the Model plus your Tested Designs', () => {
    const st = fresh();
    st.p.garages = [{ car: 'city' }, { car: 'city' }, { car: 'sports' }, { car: null }, { car: null }];
    st.upg.city = ['motor', 'battery', 'body', null, null, null];
    st.upg.sports = ['motor', null, null, null, null, null];
    st.p.upgd = ['city:motor', 'city:battery'];
    assert.equal(weekScore(st), 2 * (3 + 2) + 1);
    st.bots.L.upgd = ['suv:motor']; st.bots.T.upgd = ['truck:body', 'concept:body'];
    const pp = st.p.pp;
    endOfWeek(st, []);
    assert.equal(st.p.pp, pp + 11 - 6);
    assert.equal(st.week, 1);
    assert.deepEqual(st.bots.L.upgd, []);
});

test('final scoring: training lead needs training; Tested Designs score Part value', () => {
    const st = fresh();
    st.p.garages = [{ car: 'concept' }, { car: null }, { car: null }, { car: null }, { car: null }];
    st.p.upgd = ['concept:motor'];
    st.val.motor = 3; // value 4
    st.p.tr = [4, 0, 0, 0, 0]; st.bots.L.tr = [4, 1, 1, 1, 1]; st.p.ts[0] = 9; st.bots.L.ts[0] = 3;
    st.bots.T.tr = [0, 0, 0, 0, 0];
    const f = finalScore(st);
    assert.equal(f.tested, 4);
    assert.equal(f.cars, 6);
    assert.equal(f.training, 5, 'tie on R&D: your later arrival wins');
    assert.equal(trackLeader(st, 1)[0], 'L');
    const b = botFinalScore(st);
    assert.equal(b.training, 20);
});

test('Colleague Parts on the unlabelled start space score 2', () => {
    const st = fresh();
    st.bots.parts = ['motor'];
    assert.equal(botFinalScore(st).parts, 2);
});

test('Performance Goal counts', () => {
    const st = fresh();
    st.p.garages = [{ car: 'city' }, { car: 'suv' }, { car: null }, { car: null }, { car: null }];
    assert.equal(pgCount(st, 1), 2);
    assert.equal(pgCount(st, 2), 2);
    assert.equal(pgCount(st, 19), 2);
    assert.equal(pgCount(st, 21), 0);
});

test('a full game finishes with legal answers only', () => {
    let st = fresh({ special: true, charger: true, addons: true, diff: [1, 2] });
    let guard = 0;
    while (!st.over && guard++ < 5000) {
        const cs = choices(st.prompt);
        assert.ok(cs.length, 'stuck at ' + st.prompt.q);
        st = play(st, cs.find(c => c && c.a === 'end') || cs[cs.length - 1]);
    }
    assert.ok(st.over);
    assert.ok(st.result);
});

test('invalid answers are rejected', () => {
    const st = fresh();
    assert.throws(() => answer(st, 9));
});
