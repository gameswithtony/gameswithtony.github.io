// Time the AI's turn decisions (desktop Node; phones are roughly 4-8x slower).
// node sim/timing.js [persona-spec] [players]
import { newGame, applyAction, currentPlayer } from '../engine/core.js';
import { chooseTurn } from '../engine/ai.js';
import { parsePersona } from './game.js';
const spec = parsePersona(process.argv[2] || 'balanced'), n = +(process.argv[3] || 2);
const times = [];
for (let seed = 1; seed <= 4; seed++) {
    const s = newGame({ players: Array.from({ length: n }, (_, i) => ({ name: 'P' + i, kind: 'ai' })), seed });
    while (!s.over) { const t0 = performance.now(); const { actions } = chooseTurn(s, spec); times.push(performance.now() - t0); for (const a of actions) { applyAction(s, a); if (s.over) break; } }
}
times.sort((a, b) => a - b);
const q = f => times[Math.floor(times.length * f)].toFixed(0);
console.log(`${times.length} turns: median ${q(0.5)}ms  p90 ${q(0.9)}ms  max ${times[times.length - 1].toFixed(0)}ms`);
