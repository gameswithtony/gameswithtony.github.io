// Random legal games: the engine must never throw and must keep its invariants.
import test from 'node:test';
import assert from 'node:assert/strict';
import { playRandom as playRandomBase } from '../sim/random.js';
import { deckFor, SPACES } from '../engine/data.js';

function checkInvariants(s) {
    assert.ok(s.coal >= 0 && s.coal <= 14, 'coal market range');
    assert.ok(s.iron >= 0 && s.iron <= 10, 'iron market range');
    for (const t of s.spaces) if (t) assert.ok(t.res >= 0, 'tile resources >= 0');
    for (const p of s.players) {
        if (p.money !== null) assert.ok(p.money >= 0, `${p.name} money >= 0 (${p.money})`);
        assert.ok(p.links >= 0);
        for (const lv of p.mat) for (const c of lv) assert.ok(c >= 0, 'mat counts >= 0');
        if (p.hand) assert.ok(p.hand.length <= 8);
    }
}

function playRandom(seed, seats, mode = 'phone') {
    return playRandomBase(seed, seats, mode, checkInvariants);
}

const ai = n => Array.from({ length: n }, (_, i) => ({ name: 'AI' + i, kind: 'ai' }));

for (const n of [2, 3, 4]) {
    test(`random ${n}p games finish with valid state`, () => {
        for (let seed = 1; seed <= 30; seed++) {
            const s = playRandom(seed * 7919 + n, ai(n));
            assert.equal(s.era, 1);
            // every player used all their cards
            for (const p of s.players) assert.equal(p.hand.length, 0, 'hands empty at game end');
        }
    });
}

test('physical mode with humans (unknown hands) runs', () => {
    for (let seed = 1; seed <= 10; seed++) {
        playRandom(seed, [{ name: 'H1', kind: 'human' }, { name: 'H2', kind: 'human' }, { name: 'Eliza', kind: 'ai' }], 'physical');
    }
});

test('deck sizes match the player aid', () => {
    assert.equal(deckFor(2).length, 40);
    assert.equal(deckFor(3).length, 54);
    assert.equal(deckFor(4).length, 64);
});

test('pure pass-and-play: 2-4 humans, no AI, both modes', () => {
    for (const n of [2, 3, 4]) {
        const seats = Array.from({ length: n }, (_, i) => ({ name: 'H' + i, kind: 'human' }));
        playRandom(100 + n, seats, 'phone');
        playRandom(200 + n, seats, 'physical');
    }
});
