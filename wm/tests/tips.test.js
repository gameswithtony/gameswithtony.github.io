// Every item you can tap and every option you can explain has real text, through whole games.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as E from '../js/engine.js';
import * as V from '../js/views.js';
import { explain, choice } from '../js/tips.js';

const TABS = ['table', 'workshop', 'office', 'reports', 'history'];
function check(t, where) {
  assert.ok(t.t && !/undefined|null|NaN|\[object/.test(t.t), `title: ${where}: ${t.t}`);
  assert.ok(t.d.length > 0 || t.v, `no content: ${where}`);
  const all = [t.v, ...t.d, ...(t.rows || []).flat().map(String)].join(' ');
  assert.ok(!/undefined|\bNaN\b|\[object/.test(all), `text: ${where}: ${all}`);
  assert.ok(!/[–—]/.test(all + t.t + t.rule), `dash: ${where}: ${all}`);
}
function keysOn(st) {
  const keys = new Set();
  for (const tab of TABS) for (const m of V.game(st, tab, {}).matchAll(/data-info="([^"]+)"/g)) keys.add(m[1].replace(/&amp;/g, '&'));
  return keys;
}

test('every data-info key and every option explains itself across random games', () => {
  const seenKeys = new Set(), seenTasks = new Set();
  for (let seed = 1; seed <= 12; seed++) {
    const st = E.newGame({ seed }); let r = seed * 7919;
    for (let step = 0; step < 400 && st.prompt && !st.over; step++) {
      for (const key of keysOn(st)) { check(explain(st, key), `seed ${seed} key ${key}`); seenKeys.add(key.split(':')[0]); }
      seenTasks.add(st.prompt.task);
      for (const o of st.prompt.options) check(choice(st, st.prompt, o), `seed ${seed} task ${st.prompt.task} option ${o.label}`);
      const legal = st.prompt.options.filter(o => !o.disabled && o.v !== 'cancel');
      r = (r * 1103515245 + 12345) & 0x7fffffff;
      E.answer(st, legal[r % legal.length].v);
    }
  }
  for (const k of ['score', 'target', 'round', 'gauge', 'seat', 'voucher', 'funding', 'space', 'research', 'subsidy', 'experiment', 'weather', 'proto', 'chemical', 'tile', 'workshop', 'assembly', 'officeSlot', 'paper', 'goal', 'report', 'havoc', 'hideoutChem', 'nextMove', 'citation']) assert.ok(seenKeys.has(k), 'never rendered: ' + k);
  for (const k of ['menu', 'move', 'action', 'pay']) assert.ok(seenTasks.has(k), 'never asked: ' + k);
});

test('explain mode lets you read a disabled option, and says why it is off', () => {
  const st = E.newGame({ seed: 3 }); let found = null;
  for (let step = 0; step < 200 && !found; step++) {
    found = st.prompt.options.find(o => typeof o.disabled === 'string');
    if (found) break;
    E.answer(st, st.prompt.options.find(o => !o.disabled && o.v !== 'cancel').v);
  }
  assert.ok(found, 'a disabled option appears');
  assert.match(V.decision(st, false, true), /is-off/);
  assert.ok(!/data-choice="\d+"\s+disabled/.test(V.decision(st, false, true)), 'no option is disabled in explain mode');
  assert.match(choice(st, st.prompt, found).d[0], /^Unavailable: /);
});

test('choosing where to move shows where you are now', () => {
  const st = E.newGame({ seed: 5 }); let r = 41, seen = false;
  for (let step = 0; step < 400 && st.prompt && !st.over && !seen; step++) {
    if (st.prompt.task === 'move' && st.positions.you?.location >= 1) {
      const html = V.decision(st, false, false), at = st.positions.you;
      assert.match(html, /current-spot/);
      assert.ok(html.includes(`data-info="seat:${at.location}:${at.space}"`), 'it explains that seat');
      seen = true;
    } else if (st.prompt.task !== 'move') assert.ok(!V.decision(st, false, false).includes('current-spot'), 'only while moving');
    const legal = st.prompt.options.filter(o => !o.disabled && o.v !== 'cancel');
    r = (r * 1103515245 + 12345) & 0x7fffffff;
    E.answer(st, legal[r % legal.length].v);
  }
  assert.ok(seen, 'reached a move from a Location');
});

test('Workshop offer tiles keep both edges inside the tile', () => {
  const html = V.workshopTile(0);
  assert.equal((html.match(/class="dome /g) || []).length, 2);
  assert.ok(html.includes('dome top') && html.includes('dome bottom'));
});
