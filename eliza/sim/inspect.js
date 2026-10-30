// Read a bug report (the text from "report a bug") without loading it into the app.
// node sim/inspect.js report.txt [--history 40] [--ai]
//   prints the app version, any error, where the game is, everyone's position, the last moves,
//   and with --ai re-runs the AI's decision for the current turn.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { incomeLevel, currentPlayer } from '../engine/core.js';
import { history } from '../engine/describe.js';
import { chooseTurn } from '../engine/ai.js';

// lz-string is a classic browser script; run it in a sandbox to get the LZString object
const box = {};
vm.runInNewContext(readFileSync(new URL('../lz-string.min.js', import.meta.url), 'utf8') + ';this.LZString = LZString;', box);
const LZString = box.LZString;
const a = process.argv.slice(2), get = (k, d) => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : d; };
const text = readFileSync(a[0], 'utf8').trim();
const json = text.startsWith('ELIZA2:') ? LZString.decompressFromBase64(text.slice(7)) : Buffer.from(text, 'base64').toString('utf8');
const d = JSON.parse(json);
if (d.v !== 2) { console.log('This is a version 1 save (open it with eliza/v1/).'); process.exit(0); }
const g = d.g;
console.log(`App ${d.appVersion || '?'} · ${g.mode} mode · ${g.n} players · ${g.era ? 'Rail' : 'Canal'} era round ${g.round} of ${g.rounds} · screen: ${d.screen}${g.over ? ' · GAME OVER' : ''}`);
if (d.error) console.log('\nERROR SHOWN TO THE PLAYER:\n' + d.error + '\n');
for (const p of g.players) console.log(`  ${p.name.padEnd(10)} ${p.kind.padEnd(5)} £${p.money}  income ${incomeLevel(p.inc)}  ${p.vp} VP  links ${p.links}${p.persona ? '  persona ' + (typeof p.persona === 'string' ? p.persona : 'custom') : ''}`);
if (!g.over) console.log(`  Turn: ${g.players[currentPlayer(g)].name}, ${g.acts} action(s) left`);
const h = history(g), n = +get('history', 30);
console.log(`\nLast ${Math.min(n, h.length)} history entries:`);
for (const e of h.slice(-n)) {
    const who = e.player !== null ? `${g.players[e.player].name} ${e.action} (spent £${e.spent})` : 'round';
    console.log(`  [${e.era ? 'R' : 'C'}${e.round}] ${who}: ${e.lines.join(' ')}`);
}
console.log(`\nUndo snapshots in the report: ${(d.undoStack || []).length}`);
if (a.includes('--ai') && !g.over && g.players[currentPlayer(g)].kind === 'ai') {
    const r = chooseTurn(g, g.players[currentPlayer(g)].persona);
    console.log('\nAI would now play: ' + r.actions.map(x => x.t).join(' + ') + ` (value ${r.value.toFixed(1)}, ${r.considered} positions considered)`);
}
