// Tally what the human did over N games of a policy: node sim/tally.js [N] [policy]
import { newGame, answer, choices } from '../js/engine.js';
const N = +(process.argv[2] || 30), POLICY = process.argv[3] || 'builder';
const PREF = ['construct', 'upgrade', 'ship', 'hire', 'blueprint', 'rnd', 'tech', 'control', 'resupply'];
let rs = 3; const rnd = () => (rs = (rs * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const tally = {}, blocks = {};
for (let g = 0; g < N; g++) {
    let st = newGame({ seed: 900 + g });
    while (!st.over) {
        const pr = st.prompt, cs = choices(pr);
        if (pr.kind === 'menu') pr.main.forEach(m => { if (m.why) blocks[m.k + ':' + m.why] = (blocks[m.k + ':' + m.why] || 0) + 1; });
        let v;
        if (pr.kind === 'menu') {
            const ex = cs.filter(c => c.a === 'exec' || c.a === 'goal');
            v = (ex.length && rnd() < 0.5) ? ex[0] : PREF.map(k => cs.find(c => c.a === 'main' && c.k === k)).find(Boolean) || cs.find(c => c.a === 'end') || cs[0];
        } else v = cs.find(c => c !== 'done' && c !== 'back') ?? cs[0];
        st = answer(st, v);
    }
    st.log.filter(l => l.w === 'you').forEach(l => tally[l.k] = (tally[l.k] || 0) + 1);
}
console.log('actions', JSON.stringify(tally));
console.log('blocked', JSON.stringify(blocks));
