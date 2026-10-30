// Count interaction "moments" from a finished game's event log. See v2/notes/02-AI-DESIGN.md.
import { IND } from '../engine/data.js';

export function countMoments(s, extra = {}) {
    const n = s.n;
    const per = () => new Array(n).fill(0);
    const m = {
        gift: per(),        // I consumed a rival's coal/iron/beer
        bigGift: per(),     // ...and that flipped their tile
        merchantBeer: per(),
        marketEmptied: per(),
        overbuildRival: per(),
        turnOrderJump: per(), // went last in a round, first in the next
        loan: per(),
        bigTurn: per(),     // spent £30+ in one round
        denial: extra.denial || per(),
        rivalLinkVP: per(), // link VP earned from rivals' flipped tiles
        incomeCanalEnd: per(), incomeEnd: per(),
    };
    for (const e of s.log) {
        switch (e.t) {
            case 'consume':
                if (typeof e.from === 'number' && e.from !== e.p) m.gift[e.p]++;
                if (e.from === 'merchant') m.merchantBeer[e.p]++;
                break;
            case 'flip': if (e.by !== e.p) m.bigGift[e.by]++; break;
            case 'market': if (e.before > 0 && e.before - e.n <= 0) m.marketEmptied[e.p]++; break;
            case 'overbuild': if (e.victim !== e.p) m.overbuildRival[e.p]++; break;
            case 'loan': m.loan[e.p]++; break;
            case 'turnOrder': {
                const last = e.before[e.before.length - 1];
                if (e.after[0] === last) m.turnOrderJump[last]++;
                e.spent.forEach((x, p) => { if (x >= 30) m.bigTurn[p]++; });
                break;
            }
            case 'eraEnd': e.scores.forEach((r, p) => { m.rivalLinkVP[p] += r.fromRivals; }); break;
        }
    }
    if (extra.incomeCanalEnd) m.incomeCanalEnd = extra.incomeCanalEnd;
    return m;
}
