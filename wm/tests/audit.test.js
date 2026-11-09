// Regressions from the rules audit against the rulebook, solo rules and component images.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../js/data.js';
import * as E from '../js/engine.js';
import * as V from '../js/views.js';
import { explain } from '../js/tips.js';
import { run } from '../js/runner.js';

const start = (seed = 41) => { const st = E.newGame({ seed }); E.answer(st, false); return st; };
const onlyTask = (st, task) => { st.stack = [task]; st.prompt = null; st.over = false; run(st); };
const finish = st => { while (st.prompt && !st.over) E.answer(st, st.prompt.options.find(o => !o.disabled && o.v !== 'cancel').v); };

test('Stage III Experiments cost 2 Science', () => {
  assert.deepEqual(D.EXPERIMENTS.filter(e => e.stage === 3).map(e => e.cost), [2, 2, 2, 2, 2]);
});
test('Government Funding at space 4 advances any track instead of a second voucher', () => {
  assert.deepEqual(D.FUNDING.government[4].benefits.map(b => b.type), ['voucher', 'chemical', 'funding']);
  assert.equal(D.FUNDING.government[4].benefits[2].kind, 'any');
});
test('Level 1 third markers match the tiles', () => {
  const third = w => D.EXTREME[w][0].spaces[2][0].type;
  assert.deepEqual(D.WEATHER.map(third), ['chemical', 'workshop', 'part', 'voucher', 'funding']);
});
test('Report 20 has bottom priority', () => {
  const r = D.REPORTS[19];
  assert.deepEqual([r.agent, r.location, r.weather, r.priority], ['white', 1, 'wind', 'bottom']);
});

function researchFree(st, weather, space, extra = {}) {
  onlyTask(st, { t: 'action', kind: 'research', free: true, ...extra });
  E.answer(st, st.prompt.options.find(o => o.v?.weather === weather && o.v?.space === space).v);
}
test('Research without a Chemical moves one from Supply onto the space', () => {
  const st = start(); st.p.items = [{ id: 'b1', type: 'bot', slot: 'bot' }]; st.p.assembly[0] = false;
  const before = st.supply.white;
  researchFree(st, 'fog', 0, { noChemical: true });
  assert.equal(st.supply.white, before - 1);
  assert.equal(st.rd.fog[0].chemical, 'white');
  finish(st);
  assert.equal(st.supply.white + st.saboteurs.chemicals.white + st.rd.fog.filter(s => s.chemical === 'white').length, 5);
});
test('Research without a Chemical is not offered when that color is gone', () => {
  const st = start(); st.p.items = [{ id: 'b1', type: 'bot', slot: 'bot' }];
  st.saboteurs.chemicals.white += st.supply.white; st.supply.white = 0;
  const spaces = E.actionOptions(st, 'research', true, true);
  assert.ok(!spaces.some(o => o.weather === 'fog' && o.space === 0));
  assert.ok(spaces.some(o => o.weather === 'rain' && o.space === 0));
});
test('Research with no token left gives an Investment and unlocks Citations', () => {
  const st = start(); st.p.items = [{ id: 'b1', type: 'bot', slot: 'bot' }, { id: 'c1', type: 'chemical', color: 'white', slot: 'chemical' }];
  st.research.rd.fog = 0; const before = st.p.investments;
  researchFree(st, 'fog', 0); finish(st);
  assert.equal(st.p.investments, before + 1);
  assert.equal(st.locked.fog, false);
});

function breakthroughReady() {
  const st = start();
  st.p.office[0] = { weather: 'rain', tokens: [{ kind: 'government', weather: 'rain' }, { kind: 'lab', weather: 'rain' }, { kind: 'rd', weather: 'rain' }], published: true, breakthrough: false };
  st.extreme.rain = { level: 2, layers: [1, 2], stack: [3], markers: [] };
  st.p.workshop = [{ id: 0, row: 1, col: 1, flip: false }, { id: 1, row: 1, col: 2, flip: false }, { id: 2, row: 1, col: 3, flip: false }];
  st.p.items = ['magenta', 'pink', 'pink', 'blue'].map((color, i) => ({ id: 'x' + i, type: 'part', color, slot: i ? 'tile:1:' + i : 'part' }));
  for (const k of Object.keys(st.p.vouchers)) st.p.vouchers[k] = 0;
  return st;
}
test('A Breakthrough gained as a benefit costs no Vouchers', () => {
  const st = breakthroughReady();
  assert.ok(E.actionOptions(st, 'breakthrough', true).length > 0, 'free with no Science');
  assert.equal(E.actionOptions(st, 'breakthrough', false).length, 0, 'paid still needs its vouchers');
  onlyTask(st, { t: 'breakthrough', free: true });
  finish(st);
  assert.equal(st.p.office[0].breakthrough, true);
  assert.equal(st.p.totalAwards, 1);
});

test('the face-up top of the Experiment deck is visible', () => {
  const st = start();
  assert.ok(V.lab(st).includes(`data-info="experiment:${st.experimentDeck[0]}"`));
  assert.match(explain(st, `experiment:${st.experimentDeck[0]}`).d[0], /Top of the deck/);
});
test('Lab research help says Saboteurs gain nothing when it runs out', () => {
  const st = start();
  assert.ok(explain(st, 'research:lab:rain').d.some(l => /Saboteurs gain nothing/.test(l)));
});

test('a returning Bot always has somewhere to go', () => {
  const st = start();
  st.p.assembly = st.p.assembly.map((_, i) => i < 6); // top two sections all full
  st.p.items = [{ id: 'by', type: 'bot', slot: 'bot' }, { id: 'p1', type: 'part', color: 'blue', slot: 'part' }]; st.p.workshop = [];
  st.lab.fog[0] = { owner: 'you', id: 'bx' };
  st.stack = [{ t: 'returnYourBot', weather: 'fog', space: 0 }]; st.prompt = null; run(st);
  assert.deepEqual(st.prompt.options.map(o => o.v), [6, 7, 8, 9, 10, 11]);
  E.answer(st, 8);
  assert.equal(st.p.assembly[8], true);
  assert.equal(st.lab.fog[0].owner, undefined);
});

function won(cp) { const st = start(); st.over = true; st.result = { won: true, reason: 'x' }; st.p.cp = cp; return st; }
test('solo ranks: best title earned, and what the next one needs', () => {
  assert.deepEqual(E.rankOf({ result: { won: false } }), { rank: null, next: null });
  const st = won(10); let r = E.rankOf(st);
  assert.equal(r.rank, null); assert.equal(r.next.name, 'Stormchaser');
  const goal = (condition, need) => ({ id: D.GOALS.find(g => g.condition === condition && g.need === need).id, slot: 0, flipped: false });
  st.p.totalAwards = 1; st.p.activeGoals = [goal('parts', 3), goal('subsidies', 5)];
  st.p.items = ['blue', 'pink', 'white'].map((color, i) => ({ id: 'p' + i, type: 'part', color }));
  st.p.subsidies = [0, 1, 2, 3, 4].map(id => ({ id, used: false }));
  r = E.rankOf(st);
  assert.equal(r.rank, 'Stormchaser'); assert.equal(r.next.name, 'Forecaster'); assert.ok(r.next.missing.includes('3+ Papers'));
  st.p.cp = 120; st.p.funding = { government: 4, lab: 5, rd: 9 }; st.p.workshop = Array(6).fill({}); st.p.vouchers = { supply: 1, government: 1, lab: 0, rd: 0, science: 0 };
  r = E.rankOf(st);
  assert.equal(r.rank, 'Terraformer'); assert.equal(r.next, null);
});
test('final scoring records how the score was built', () => {
  const st = start(); st.p.funding.government = 4; st.p.cp = 10; st.target = 0;
  st.stack = [{ t: 'final', stage: 'score' }]; st.prompt = null; run(st);
  assert.equal(st.result.score.play, 10);
  assert.equal(st.result.score.funding, D.FUNDING.government[4].cp);
  assert.ok(V.decision(st).includes('score-lines'));
  assert.ok(V.decision(st).includes('rank-card'));
});

test('the Table previews the Saboteur move the turn will make', () => {
  const st = start(); st.stack = [{ t: 'botTurn' }]; st.prompt = null; run(st);
  const planned = E.saboteurMove(st);
  E.answer(st, true);
  while (st.prompt && st.prompt.task === 'havoc') E.answer(st, st.prompt.options[0].v);
  assert.deepEqual(st.positions[planned.agent], { location: planned.location, space: planned.space });
});

test('every major block has a collapse control and remembers its state', () => {
  const st = start(), html = V.game(st, 'table', { closedPanels: new Set(['government']) });
  assert.match(html, /data-panel="government" data-closed="true"/);
  assert.match(html, /data-panel="supply" data-closed="false"/);
  assert.equal((html.match(/class="panel-toggle"/g) || []).length, (html.match(/<section class="panel/g) || []).length);
});
test('Citation locks and victory progress are on the boards', () => {
  const st = start();
  assert.ok(V.game(st, 'table', {}).includes('data-info="citation:rain"'));
  const office = V.game(st, 'office', {});
  assert.ok(office.includes('data-info="citation:rain"'));
  assert.ok(office.includes('class="inspect victory"'));
});
