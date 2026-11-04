// Board topology: every connection on images/board.jpg, with its canal/rail type.
// v1's data.js was checked against the board in October 2026; v2 must match it exactly.
// (Walsall-Birmingham was missing from v2 until 2026-11-04.)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { LINKS, LOCATIONS } from '../engine/data.js';
import { newGame, upgradeState, components } from '../engine/core.js';

const key = (a, b) => a < b ? `${a}-${b}` : `${b}-${a}`;
const name = id => LOCATIONS[id].name;
const loc = n => LOCATIONS.find(l => l.name.startsWith(n)).id;

function v1Edges() {
    const ctx = {};
    vm.createContext(ctx);
    vm.runInContext(readFileSync(new URL('../v1/data.js', import.meta.url), 'utf8') + ';this.B = INITIAL_BOARD;', ctx);
    const out = new Map();
    for (const l of ctx.B.locations) {
        for (const e of l.edgesCanal) out.set(key(l.id, e.toId), { ...(out.get(key(l.id, e.toId)) || {}), canal: true });
        for (const e of l.edgesRail) out.set(key(l.id, e.toId), { ...(out.get(key(l.id, e.toId)) || {}), rail: true });
    }
    return out;
}

function v2Edges() {
    const out = new Map();
    for (const l of LINKS) for (let i = 0; i < l.locs.length; i++) for (let j = i + 1; j < l.locs.length; j++) out.set(key(l.locs[i], l.locs[j]), { canal: l.canal, rail: l.rail });
    return out;
}

test('every board connection exists with the right canal/rail type', () => {
    const v1 = v1Edges(), v2 = v2Edges();
    for (const [k, e] of v1) {
        const [a, b] = k.split('-').map(Number);
        assert.ok(v2.has(k), `missing link ${name(a)} - ${name(b)}`);
        assert.equal(!!v2.get(k).canal, !!e.canal, `canal flag ${name(a)} - ${name(b)}`);
        assert.equal(!!v2.get(k).rail, !!e.rail, `rail flag ${name(a)} - ${name(b)}`);
    }
    for (const k of v2.keys()) { const [a, b] = k.split('-').map(Number); assert.ok(v1.has(k), `extra link ${name(a)} - ${name(b)}`); }
});

test('Walsall - Birmingham is a canal and rail link', () => {
    const l = LINKS.find(x => x.locs.includes(loc('Walsall')) && x.locs.includes(loc('Birmingham')));
    assert.ok(l && l.canal && l.rail);
});

test('saves from before a link was added load with that link unbuilt', () => {
    const s = newGame({ players: [{ name: 'A', kind: 'human' }, { name: 'B', kind: 'ai' }], seed: 1 });
    const old = JSON.parse(JSON.stringify(s));
    old.links = old.links.slice(0, LINKS.length - 1); // a save made before the newest link existed
    upgradeState(old);
    assert.equal(old.links.length, LINKS.length);
    assert.equal(old.links[LINKS.length - 1], -1);
    const comp = components(old);
    assert.notEqual(comp[loc('Walsall')], comp[loc('Birmingham')], 'not connected until someone builds it');
});
