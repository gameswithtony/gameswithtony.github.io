// Print the move history of one AI-vs-AI game.
// node sim/replay.js --seed 3 --personas balanced,cotton
import { newGame, applyAction, currentPlayer } from '../engine/core.js';
import { chooseTurn } from '../engine/ai.js';
import { history, playerSummary } from '../engine/describe.js';

const a = process.argv.slice(2);
const get = (k, d) => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : d; };
const personas = get('personas', 'balanced,balanced').split(',');
const s = newGame({ players: personas.map((p, i) => ({ name: ['Eliza', 'Eleanor', 'Isambard', 'Robert'][i] + `(${p})`, kind: 'ai', persona: p })), seed: +get('seed', 1) });
while (!s.over) for (const act of chooseTurn(s, s.players[currentPlayer(s)].persona).actions) { applyAction(s, act); if (s.over) break; }
let lastRound = '';
for (const h of history(s)) {
    const key = `${h.era}-${h.round}`;
    if (key !== lastRound) { console.log(`\n=== ${h.era ? 'Rail' : 'Canal'} round ${h.round} ===`); lastRound = key; }
    for (const l of h.lines) if (!l.startsWith('---')) console.log((h.player !== null ? '  ' : '') + l);
    if (h.player !== null) console.log(`    (spent £${h.spent}, now £${h.money})`);
}
console.log('\n' + s.players.map((_, p) => playerSummary(s, p)).join('\n'));
console.log(s.players.map(p => p.name + ' ' + JSON.stringify(p.score)).join('\n'));
