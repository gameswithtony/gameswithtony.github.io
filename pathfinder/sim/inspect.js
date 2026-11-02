// Plays one game with a simple "always act" human and prints the Pathfinder breakdown.
// Usage: node sim/inspect.js [seed]
import { newGame, answer, choices, scoreBreakdown } from '../js/engine.js';
let st = newGame({ seed: +(process.argv[2] || 42) });
let n = 0;
while (!st.over && n++ < 5000) {
    const c = choices(st.prompt);
    const v = c.find(x => x && x.a === 'main' && x.k !== 'pod') || c.find(x => x && x.a === 'end') || (c.find(x => x !== 'done' && x !== 'back') ?? c[0]);
    st = answer(st, v);
}
console.log('round', st.round, 'level', st.level, 'missions', JSON.stringify(st.missions));
console.log('PF ', JSON.stringify(scoreBreakdown(st, 1, true)), 'inGame', JSON.stringify(st.p[1].opLog));
console.log('YOU', JSON.stringify(scoreBreakdown(st, 0, true)), 'inGame', JSON.stringify(st.p[0].opLog));
const p = st.p[1];
console.log('PF bps', p.bps.map(b => b.id + (b.h ? '*' : '')).join(','), 'scis', p.scis, 'contracts', p.contracts.length, 'lab', JSON.stringify(p.lab), 'hangar', p.hangar);
const cnt = {}; st.log.filter(l => l.w === 'pf').forEach(l => cnt[l.k] = (cnt[l.k] || 0) + 1); console.log(JSON.stringify(cnt));
