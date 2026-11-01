// Replays sim/run.js's random game G (same RNG stream) and reports the first step breaking an invariant.
// Usage: node sim/repro.js <games-seed> <game-index>
import { newGame, answer, choices } from '../js/engine.js';
const SEED = +process.argv[2], G = +process.argv[3];
let rs = SEED;
const rnd = () => (rs = (rs * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
function choose(pr) {
    const cs = choices(pr);
    if (pr.kind === 'menu') {
        const end = cs.find(c => c.a === 'end'); if (end && rnd() < 0.6) return end;
        const m = cs.filter(c => c.a === 'main'); if (m.length && rnd() < 0.8) return m[Math.floor(rnd() * m.length)];
    }
    if (cs.length > 1 && cs.includes('done') && rnd() < 0.7) { const r = cs.filter(c => c !== 'done' && c !== 'back'); if (r.length) return r[Math.floor(rnd() * r.length)]; }
    return cs[Math.floor(rnd() * cs.length)];
}
const bad = st => { const c = st.p[0].col; return c.lq < 0 || c.wa < 0 || c.sup < 0; };
for (let g = 0; g <= G; g++) {
    let st = newGame({ seed: SEED * 1000 + g, difficulty: ['rookie', 'chief', 'legend'][g % 3], length: g % 2 ? 'long' : 'short' });
    while (!st.over) {
        const v = choose(st.prompt);
        const prev = JSON.parse(JSON.stringify(st));
        st = answer(JSON.parse(JSON.stringify(st)), v);
        if (g === G && bad(st)) {
            console.log('answered', JSON.stringify(prev.prompt).slice(0, 400), '\nwith', JSON.stringify(v));
            console.log('col before', JSON.stringify(prev.p[0].col), 'after', JSON.stringify(st.p[0].col));
            console.log('stack before', JSON.stringify(prev.stack));
            console.log(st.log.slice(prev.log.length - 3).map(l => l.w + ' ' + l.k + ' ' + l.text).join(' | '));
            process.exit(0);
        }
    }
}
