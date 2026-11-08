// @ts-check
// Public engine API. Importing this registers every task handler.
import './tasks.js';
import './bots.js';
import { answer as rawAnswer } from './core.js';

/** Apply an answer after checking it is one of the prompt's legal choices. */
export function answer(st, v) {
    const pr = st.prompt;
    const key = JSON.stringify(v);
    if (!choices(pr).some(c => JSON.stringify(c) === key)) throw new Error(`invalid answer ${key} for ${pr ? pr.q || pr.kind : 'no prompt'}`);
    return rawAnswer(st, v);
}
export * from './core.js';
export { menuPrompt, shiftsLeft, active, stationOpts, designOpts, provideOpts, claimOpts, recycleOpts, kanbanAdds, speakValue, tableCards, meetOpts, partSources, canDouble, openGarages, upgradeDesigns, endTriggered } from './tasks.js';
export { sandraValue, botLine, resolveStation, pickQueue, planOutlook, selCounts } from './bots.js';

/**
 * Every valid answer to a prompt (tests and sims use this; the UI renders from the prompt itself).
 * @param {any} pr
 * @returns {any[]}
 */
export function choices(pr) {
    if (!pr) return [];
    switch (pr.kind) {
        case 'over': return [];
        case 'num': { const out = []; for (let i = pr.min; i <= pr.max; i++) out.push(i); return out; }
        case 'menu': return pr.acts.filter(x => !x.why).map(x => {
            const v = { a: x.k };
            if (x.d) v.d = x.d;
            if (x.g !== undefined) v.g = x.g;
            return v;
        });
    }
    switch (pr.q) {
        case 'stations': case 'botTurn': case 'sandra': case 'eod': return [true];
        default: return pr.opts || [];
    }
}
