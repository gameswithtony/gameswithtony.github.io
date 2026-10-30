// Sell must find every connected buyer, whatever else sits at the merchant (blank tiles, slot order).
// Exhaustive: player counts x merchant slots x sellable industries x every space that can hold the industry,
// connected by the shortest chain of links (canal era and rail era). Bug report 2026-10-30: Manufactured
// Goods I in Birmingham, canal to Oxford holding a blank + a Manufactured Goods merchant, Sell said "not connected".
import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, sellTargets, planSale } from '../engine/core.js';
import { sellableTiles } from '../engine/moves.js';
import { IND, ERA, LOCATIONS, LINKS, LINKS_AT, SPACES, SELLABLE } from '../engine/data.js';

/** Shortest list of link ids joining two locations using lines open in `era` (BFS). */
function pathLinks(from, to, era) {
    const prev = new Map([[from, null]]);
    const q = [from];
    while (q.length) {
        const a = q.shift();
        if (a === to) break;
        for (const l of LINKS_AT[a]) {
            if (era === ERA.Canal ? !LINKS[l].canal : !LINKS[l].rail) continue;
            for (const b of LINKS[l].locs) if (!prev.has(b)) { prev.set(b, { a, l }); q.push(b); }
        }
    }
    if (!prev.has(to)) return null;
    const out = [];
    for (let x = to; prev.get(x); x = prev.get(x).a) out.push(prev.get(x).l);
    return out;
}

const name = id => LOCATIONS[id].name;

for (const n of [2, 3, 4]) {
    test(`sell finds every connected buyer, ${n} players`, () => {
        let checked = 0;
        const base = newGame({ players: Array.from({ length: n }, (_, i) => ({ name: 'P' + i, kind: i ? 'ai' : 'human' })), seed: n, mode: 'phone', firstPlayer: 0 });
        for (let mi = 0; mi < base.merch.length; mi++) {
            const merchLoc = base.merch[mi].loc;
            for (const ind of SELLABLE) {
                for (const partner of ['blank', 'buyer']) {
                    for (const era of [ERA.Canal, ERA.Rail]) {
                        for (const sp of SPACES.filter(x => x.types.includes(ind))) {
                            const links = pathLinks(sp.loc, merchLoc, era);
                            if (!links) continue; // e.g. no canal reaches that town
                            const s = JSON.parse(JSON.stringify(base));
                            s.era = era;
                            // every merchant blank except this slot (buys ind); its partner at the same merchant: blank or a 2nd buyer
                            s.merch.forEach((m, i) => { m.accepts = []; m.beer = 0; });
                            s.merch[mi].accepts = [ind]; s.merch[mi].beer = 1;
                            const other = s.merch.findIndex((m, i) => i !== mi && m.loc === merchLoc);
                            if (other >= 0 && partner === 'buyer') { s.merch[other].accepts = [IND.Manufacturer, IND.CottonMill, IND.Pottery]; s.merch[other].beer = 1; }
                            s.spaces[sp.id] = { o: 0, ind, lvl: 2, res: 0, flip: false };
                            for (const l of links) s.links[l] = 1; // rival links count too
                            const where = `${name(sp.loc)} space ${sp.idx + 1} -> ${name(merchLoc)} slot ${mi} (partner ${partner}), ${era ? 'rail' : 'canal'}`;
                            assert.ok(sellableTiles(s, 0).includes(sp.id), 'not offered for sale: ' + where);
                            assert.ok(sellTargets(s, sp.id).includes(mi), 'buyer missing: ' + where);
                            const sale = planSale(s, 0, sp.id, mi);
                            assert.ok(sale, 'cannot plan sale: ' + where);
                            assert.deepEqual(sale.beer.filter(b => b.m !== undefined), [{ m: mi }], 'merchant beer not used: ' + where);
                            // and the negative: one missing link means no route
                            s.links[links[0]] = -1;
                            assert.ok(!sellTargets(s, sp.id).includes(mi) || links.length === 0, 'claims a route with a gap: ' + where);
                            checked++;
                        }
                    }
                }
            }
        }
        assert.ok(checked > 500, `checked ${checked} cases`);
    });
}
