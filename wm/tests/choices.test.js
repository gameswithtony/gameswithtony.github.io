// The decision panel is laid out by question. No layout may lose an option or hide End turn.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../js/engine.js';
import * as V from '../js/views.js';
import { actionPrice, shortReason } from '../js/actions.js';

const start = (seed = 41) => { const st = E.newGame({ seed }); E.answer(st, false); return st; };
const listPart = html => html.slice(html.indexOf('class="choice-list'), html.indexOf('choice-pinned') > 0 ? html.indexOf('choice-pinned') : undefined);

test('every option is exactly one button at every decision, across random games', () => {
  const layouts = new Set();
  for (let seed = 1; seed <= 25; seed++) {
    const st = E.newGame({ seed }); let r = seed * 6271;
    for (let n = 0; n < 500 && st.prompt && !st.over; n++) {
      for (const explain of [false, true]) {
        const html = V.decision(st, false, explain);
        st.prompt.options.forEach((o, i) => assert.equal(html.split(`data-choice="${i}"`).length - 1, 1, `seed ${seed} ${st.prompt.task}: ${o.label}`));
        layouts.add((html.match(/class="choice-list ([a-z-]*)/) || [])[1]);
      }
      const legal = st.prompt.options.filter(o => !o.disabled && o.v !== 'cancel');
      r = (r * 1103515245 + 12345) & 0x7fffffff;
      E.answer(st, legal[r % legal.length].v);
    }
  }
  for (const shape of ['is-menu', 'is-seats', 'is-slots', 'two']) assert.ok(layouts.has(shape), 'never rendered: ' + shape);
});

test('End turn is pinned outside the scrolling options', () => {
  const st = start(), html = V.decision(st);
  const done = st.prompt.options.findIndex(o => o.v === 'done');
  assert.equal(st.prompt.kind, 'menu');
  assert.ok(!listPart(html).includes(`data-choice="${done}"`), 'not in the list');
  assert.ok(html.slice(html.indexOf('choice-pinned')).includes(`data-choice="${done}"`), 'in the pinned row');
});

test('tiles show live costs, gains and short reasons', () => {
  const st = start();
  assert.deepEqual(actionPrice(st, 'sell'), { kind: 'government', n: '1' });
  assert.equal(actionPrice(st, 'construct').n, '1-2');
  st.p.assembly = st.p.assembly.map((_, i) => i >= 3);
  assert.equal(actionPrice(st, 'construct').n, '2');
  st.p.items.push({ id: 'c1', type: 'chemical', color: 'green' }); st.supply.green = 2;
  assert.deepEqual(actionPrice(st, 'returnChemical'), { kind: 'supply', n: '2', gain: true });
  assert.equal(shortReason('Need 1 Government (or Science / exchanges)'), 'Need 1 Government');
  assert.equal(shortReason('Construct an available Bot first'), 'Need a Bot');
});

test('Back stays pinned and the move grid marks where you are', () => {
  const st = start();
  E.answer(st, st.prompt.options.find(o => o.v === 'buyChemical').v);
  const back = st.prompt.options.findIndex(o => o.v === 'cancel');
  assert.ok(back >= 0);
  assert.ok(!listPart(V.decision(st)).includes(`data-choice="${back}"`));
  E.answer(st, 'cancel');
  E.answer(st, st.prompt.options.find(o => o.v === 'done').v);
  assert.equal(st.prompt.task, 'move');
  const html = V.decision(st);
  assert.match(html, /is-seats/); assert.match(html, /seat-off/); assert.match(html, /current-spot/);
});
