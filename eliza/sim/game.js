// Play one AI-vs-AI game headlessly and return a compact record.
import { newGame, applyAction, currentPlayer, incomeLevel, ranking, components } from '../engine/core.js';
import { chooseTurn } from '../engine/ai.js';
import { sellableTiles } from '../engine/moves.js';
import { planSale, sellTargets } from '../engine/core.js';
import { countMoments } from './moments.js';
import { PERSONAS } from '../engine/ai.js';
import { readFileSync } from 'node:fs';

/** "balanced" or "balanced:denialW=0.3+orderW=2" -> persona weights object (or the name). */
/** Also "cotton@sim/tuned-all.json": persona overrides on top of a saved weight file. */
export function parsePersona(spec) {
    if (typeof spec !== 'string') return spec;
    let base = {};
    if (spec.includes('@')) {
        const [name, file] = spec.split('@');
        base = { ...JSON.parse(readFileSync(file.split(':')[0], 'utf8')), ...(PERSONAS[name] || {}) };
        spec = name + (file.includes(':') ? ':' + file.split(':')[1] : '');
        if (!spec.includes(':')) return base;
    }
    if (!spec.includes(':')) return Object.keys(base).length ? base : spec;
    const [name, rest] = spec.split(':');
    const o = { ...base, ...(Object.keys(base).length ? {} : PERSONAS[name] || {}) };
    for (const kv of rest.split('+')) { const [k, v] = kv.split('='); o[k] = +v; }
    return o;
}

/** Number of p's tiles that could be sold right now (merchant route + beer). */
function sellReady(s, p) {
    let n = 0;
    for (const sp of sellableTiles(s, p)) if (sellTargets(s, sp).some(mi => planSale(s, p, sp, mi))) n++;
    return n;
}

/**
 * @param {{seed:number, personas:string[]|object[], measureDenial?:boolean, names?:string[]}} cfg
 */
export function playGame(cfg) {
    const seats = cfg.personas.map((persona, i) => ({ name: (cfg.names && cfg.names[i]) || `P${i}`, kind: 'ai', persona: parsePersona(persona) }));
    const s = newGame({ players: seats, seed: cfg.seed, mode: 'phone' });
    const denial = new Array(s.n).fill(0);
    const incomeCanalEnd = new Array(s.n).fill(0);
    const unflippedL2 = new Array(s.n).fill(0), flippedL2 = new Array(s.n).fill(0);
    const actionMix = s.players.map(() => ({ canal: {}, rail: {} }));
    const t0 = Date.now();
    let turns = 0;
    while (!s.over) {
        const p = currentPlayer(s);
        const persona = s.players[p].persona;
        const { actions } = chooseTurn(s, persona);
        for (const a of actions) {
            const before = cfg.measureDenial ? s.players.map(pl => pl.id === p ? 0 : sellReady(s, pl.id)) : null;
            const era = s.era;
            const mix = actionMix[p][era === 0 ? 'canal' : 'rail'];
            mix[a.t] = (mix[a.t] || 0) + 1;
            applyAction(s, a);
            if (before && s.era === era) {
                s.players.forEach(pl => { if (pl.id !== p && sellReady(s, pl.id) < before[pl.id]) denial[p]++; });
            }
            if (era === 0 && s.era === 1) {
                s.players.forEach(pl => { incomeCanalEnd[pl.id] = incomeLevel(pl.inc); });
                // level 2+ tiles built in canal that missed their double score
                for (const t of s.spaces) if (t && t.lvl >= 2 && !t.flip) unflippedL2[t.o]++;
                for (const t of s.spaces) if (t && t.lvl >= 2 && t.flip) flippedL2[t.o]++;
            }
            if (s.over) break;
        }
        turns++;
    }
    const moments = countMoments(s, { denial: cfg.measureDenial ? denial : undefined, incomeCanalEnd });
    moments.incomeEnd = s.players.map(pl => incomeLevel(pl.inc));
    moments.canalL2Unflipped = unflippedL2;
    moments.canalL2Flipped = flippedL2;
    return {
        seed: cfg.seed,
        personas: cfg.personas.map(p => typeof p === 'string' ? p : 'custom'),
        vp: s.players.map(p => p.vp),
        score: s.players.map(p => p.score),
        money: s.players.map(p => p.money),
        rank: ranking(s),
        moments,
        actionMix,
        ms: Date.now() - t0,
        turns,
    };
}
