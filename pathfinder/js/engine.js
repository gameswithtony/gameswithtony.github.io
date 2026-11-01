// @ts-check
// Public engine API. Importing this registers every task handler.
import './tasks.js';
import './pathfinder.js';
import { answer as rawAnswer } from './core.js';

/**
 * Apply an answer after checking it is one of the prompt's legal choices.
 * Contract deliveries are free actions offered alongside the turn menu.
 */
export function answer(st, v) {
    const pr = st.prompt;
    const free = pr && pr.kind === 'menu' && v && v.a === 'deliver';
    if (!free) {
        const key = JSON.stringify(v);
        if (!choices(pr).some(c => JSON.stringify(c) === key)) throw new Error(`invalid answer ${key} for ${pr ? pr.q || pr.kind : 'no prompt'}`);
    }
    return rawAnswer(st, v);
}
export { newGame, run, scoreBreakdown, YOU, PF, lqCap, storageCap, depotCap, complexOf, techTile, B, slotCost, zoneOf, progressCount, lssValue, colonyRow, shelterCount, contractMet, advHexes, roverHex } from './core.js';
export { menuPrompt, actionName, execName, goalMet, bpCards } from './tasks.js';

/**
 * Every valid answer to a prompt (used by tests/sim; the UI renders from the prompt itself).
 * @param {any} pr
 * @returns {any[]}
 */
export function choices(pr) {
    if (!pr) return [];
    const skip = pr.skip ? ['done'] : [];
    switch (pr.kind) {
        case 'ack': return [true];
        case 'over': return [];
        case 'num': { const out = []; for (let i = pr.min; i <= pr.max; i++) out.push(i); return out; }
        case 'menu': return [
            ...pr.main.filter(m => !m.why).map(m => ({ a: 'main', k: m.k })),
            ...pr.exec.filter(e => !e.why).map(e => ({ a: 'exec', i: e.i })),
            ...pr.goals.map(g => ({ a: 'goal', id: g.id })),
            ...(pr.canEnd ? [{ a: 'end' }] : []),
        ];
        case 'hex': return [...pr.hexes.map(h => h.v ?? h.h), ...(pr.btns || []), ...(pr.back ? ['back'] : []), ...skip];
    }
    switch (pr.q) {
        case 'slotCost': return pr.opts.map(o => o.v);
        case 'blueprint': return [...pr.cards.map(c => c.id), ...skip];
        case 'tech': return [...pr.techs.map(t => t.i), ...skip];
        case 'labSpace': return pr.spaces;
        case 'develop': return [...pr.tiles, ...skip];
        case 'devTo': return pr.to;
        case 'warehouse': return [...pr.items, ...skip];
        case 'pay': return [...pr.bags, ...skip];
        case 'goalCrystal': return pr.goals;
        case 'buildType': return [...pr.types.map(t => t.type), ...skip];
        case 'retrieve': return [...pr.src, ...skip];
        case 'upgradeBp': return [...pr.ids, ...skip];
        case 'hire': return [...pr.choices.map(c => c.i), ...skip];
        case 'refill': return pr.contracts;
        case 'ship': return [...pr.slots, ...skip];
        case 'adv': return pr.choices.flatMap(c => c.ways.map(way => ({ id: c.id, way })));
        case 'tradeOut': return pr.items;
        case 'tradeIn': return [...pr.items, ...skip];
        case 'radar': case 'discPick': return pr.discs;
        case 'space': return pr.spaces;
        default: return [...(pr.opts || []), ...skip];
    }
}
