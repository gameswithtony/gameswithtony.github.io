// @ts-check
// THE M1 GATE (PLAN §14.2): a scripted hand-only game of `plain` completes headless in Node.
import test from 'node:test';
import assert from 'node:assert/strict';

import { cellAt, cellXY } from '../src/core/grid.js';
import { init, legalActions, reduce } from '../src/core/reduce.js';
import { getLevel } from '../src/levels/index.js';

test('a hand-only playthrough of plain reaches phase won', () => {
  const level = getLevel('plain');
  let s = init(level, 1);
  assert.equal(s.w, 32);
  assert.equal(s.h, 20);

  const a = cellXY(s, s.origin);
  const b = cellXY(s, s.dest);
  assert.equal(a.y, b.y, 'plain runs straight across');

  // One tile per tick, straight from A to B.
  for (let x = a.x + 1; x < b.x; x++) {
    const cell = cellAt(s, x, a.y);
    assert.deepEqual(legalActions(s, cell), ['place'], `cell (${x},${a.y}) should be placeable`);
    const r = reduce(s, { t: 'place', cell });
    assert.deepEqual(r.ev[0], { t: 'placed', cells: [cell] });
    s = r.s;
  }
  assert.equal(s.stats.placed, b.x - a.x - 1);
  assert.equal(s.phase.k, 'play');
  assert.ok(s.users.some((u) => u.state === 'moving'), 'the queue flushed when the path completed');

  // Then wait out the schedule.
  /** @type {import('../src/core/state.js').Ev[]} */
  const ev = [];
  let guard = 0;
  while (s.phase.k === 'play' && guard++ < 500) {
    const r = reduce(s, { t: 'wait' });
    s = r.s;
    ev.push(...r.ev);
  }

  assert.equal(s.phase.k, 'won');
  const won = /** @type {any} */ (ev.find((e) => e.t === 'won'));
  assert.deepEqual(won, { t: 'won', served: s.stats.served, total: level.arrivals.count },
    'the win event carries the score');
  // Under the points economy a thirty-turn hand build is slow enough that the first user
  // runs out of patience waiting for it — the level is won, but not perfectly. That is the
  // gate doing its job: it proves the loop completes headless, not that hand-only is free.
  assert.ok(s.stats.served >= level.arrivals.count - 1,
    `served only ${s.stats.served} of ${level.arrivals.count}`);
  assert.equal(s.stats.served + s.stats.lost, level.arrivals.count, 'everyone resolved');
  assert.equal(s.stats.detonations, 0, 'nothing was generated, so nothing blew up');
  assert.equal(s.users.length, level.arrivals.count);
  assert.equal(s.users.every((u) => u.state === 'arrived' || u.state === 'gone'), true);
  assert.equal(ev.filter((e) => e.t === 'arrived').length, s.stats.served);
  assert.equal(s.stats.generated, 0, 'hand-only');
  assert.ok(s.tick < 100, `finished in ${s.tick} ticks`);
});
