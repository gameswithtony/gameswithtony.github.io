// @ts-check
// Plain-English text for engine events. Used by the AI turn screens, the move history screen,
// and the headless replay tool.

import { IND_NAMES, LOCATIONS, LINKS, SPACES, tileDef, ERA } from './data.js';
import { incomeLevel } from './core.js';

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
export const tileName = (ind, lvl) => `${IND_NAMES[ind]} (Level ${ROMAN[lvl]})`;
export const spaceName = sp => `${LOCATIONS[SPACES[sp].loc].name} (Space ${SPACES[sp].idx + 1})`;
export const linkName = l => LINKS[l].locs.slice(0, 2).map(x => LOCATIONS[x].name).join(' to ');
const who = (s, p) => s.players[p].name;
const owner = (s, from) => typeof from === 'number' ? `${who(s, from)}'s` : from;

/** Second person for a player named "You": "You buys" -> "You buy", "You's" -> "Your". */
function youify(line) {
    if (!line) return line;
    return line
        .replace(/(^|[^A-Za-z])You's /g, '$1Your ')
        .replace(/ from Your /g, ' from your ')
        .replace(/^(You .*) their own /, '$1 your own ')
        .replace(/(^|\. |: |; )You (\w+)/g, (m, pre, w) => pre + 'You ' + (w === 'passes' ? 'pass' : w === 'has' ? 'have' : w.endsWith('s') && w !== 'must' ? w.slice(0, -1) : w));
}

/** One event -> one line of text (or null for bookkeeping events). */
export function describeEvent(s, e) {
    return youify(describeEvent3(s, e));
}

function describeEvent3(s, e) {
    switch (e.t) {
        case 'build': return `${who(s, e.p)} builds ${tileName(e.ind, e.lvl)} in ${spaceName(e.sp)}, paying £${tileDef(e.ind, e.lvl).cost}.`;
        case 'overbuild': return `${who(s, e.p)} overbuilds ${owner(s, e.victim)} ${tileName(e.ind, e.lvl)} in ${spaceName(e.sp)}.`;
        case 'link': return `${who(s, e.p)} places a ${e.era === ERA.Canal ? 'canal' : 'rail'} link from ${linkName(e.link)}.`;
        case 'consume':
            if (e.from === 'merchant') return `${who(s, e.p)} drinks the merchant beer at ${LOCATIONS[e.loc].name}.`;
            return `${who(s, e.p)} takes ${e.n} ${e.res} from ${e.from === e.p ? 'their own' : owner(s, e.from)} tile in ${spaceName(e.sp)}.`;
        case 'market': return `${who(s, e.p)} buys ${e.n} ${e.res} from the market for £${e.cost}.`;
        case 'toMarket': return `${who(s, e.p)} sells ${e.n} ${e.res} to the market for £${e.earned}.`;
        case 'flip': return e.by === e.p
            ? `${who(s, e.p)}'s ${tileName(e.ind, e.lvl)} in ${spaceName(e.sp)} flips (+${tileDef(e.ind, e.lvl).inc} income).`
            : `${who(s, e.p)}'s ${tileName(e.ind, e.lvl)} in ${spaceName(e.sp)} flips thanks to ${who(s, e.by)} (+${tileDef(e.ind, e.lvl).inc} income).`;
        case 'sell': return `${who(s, e.p)} sells ${tileName(e.ind, e.lvl)} in ${spaceName(e.sp)} to ${LOCATIONS[e.loc].name}.`;
        case 'bonus': return `${who(s, e.p)} gets the ${LOCATIONS[e.loc].name} bonus (${e.type === 'money' ? '£' + e.amount : e.type === 'vp' ? e.amount + ' VP' : e.type === 'income' ? '+' + e.amount + ' income' : 'free develop'}).`;
        case 'develop': return `${who(s, e.p)} develops away ${tileName(e.ind, e.lvl)}${e.free ? ' (free)' : ''}.`;
        case 'loan': return `${who(s, e.p)} takes a £30 loan (income drops 3 levels).`;
        case 'scout': return `${who(s, e.p)} scouts for a wild location and a wild industry.`;
        case 'pass': return `${who(s, e.p)} passes.`;
        case 'turnOrder': return `Turn order: ${e.after.map(p => `${who(s, p)} (spent £${e.spent[p]})`).join(', ')}.`;
        case 'income': return `${who(s, e.p)} collects £${e.amount} income.`;
        case 'shortfallSell': return `${who(s, e.p)} must sell ${tileName(e.ind, e.lvl)} in ${spaceName(e.sp)} to cover a shortfall.`;
        case 'shortfallVP': return `${who(s, e.p)} loses ${e.vp} VP for a shortfall.`;
        case 'eraEnd': return `End of the ${e.era === ERA.Canal ? 'Canal' : 'Rail'} Era: ` + e.scores.map((r, p) => `${who(s, p)} +${r.links} links, +${r.tiles} tiles (total ${e.vp[p]})`).join('; ') + '.';
        case 'round': return `--- Round ${e.round} ---`;
        case 'gameOver': return `Game over: ` + e.vp.map((v, p) => `${who(s, p)} ${v} VP`).join(', ') + '.';
        default: return null;
    }
}

/**
 * Group the log into turns for a history screen: one entry per action (everything it caused,
 * including rivals' tiles flipping) plus entries for round bookkeeping (turn order, income, scoring).
 * @returns {{era:number, round:number, player:number|null, action?:string, lines:string[], spent:number, money?:number}[]}
 */
export function history(s) {
    const out = [];
    let pending = [];
    const flushSystem = () => { if (pending.length) { out.push({ era: pending[0].era, round: pending[0].round, player: null, lines: pending.map(x => x.line), spent: 0 }); pending = []; } };
    for (const e of s.log) {
        if (e.t === 'start') continue;
        if (e.t === 'action') {
            out.push({ era: e.era, round: e.round, player: e.p, action: e.a, lines: pending.map(x => x.line), spent: e.spent, money: e.money });
            pending = [];
            continue;
        }
        const line = describeEvent(s, e);
        if (!line) continue;
        if (['turnOrder', 'income', 'round', 'eraEnd', 'gameOver', 'shortfallSell', 'shortfallVP'].includes(e.t)) {
            // bookkeeping: close any action lines first (should be none) and add as a system entry
            pending.push({ line, era: e.era, round: e.round });
            flushSystem();
        } else {
            pending.push({ line, era: e.era, round: e.round });
        }
    }
    flushSystem();
    return out;
}

export function playerSummary(s, p) {
    const pl = s.players[p];
    return `${pl.name}: £${pl.money ?? '?'}, income ${incomeLevel(pl.inc)}, ${pl.vp} VP, ${pl.links} links left`;
}
