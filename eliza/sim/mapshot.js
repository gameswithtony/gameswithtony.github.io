// Write an HTML file showing the phone-mode map for a simulated game (for headless screenshots).
// node sim/mapshot.js --seed 3 --round 8 --era 0 --out file.html
import { writeFileSync } from 'node:fs';
import { newGame, applyAction, currentPlayer } from '../engine/core.js';
import { chooseTurn } from '../engine/ai.js';
import { mapSVG, MAP_CSS } from '../ui/map.js';
const a = process.argv.slice(2), get = (k, d) => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : d; };
const s = newGame({ players: [{ name: 'You', kind: 'ai', color: 'purple' }, { name: 'Eliza', kind: 'ai', color: 'gray' }, { name: 'Eleanor', kind: 'ai', color: 'yellow' }], seed: +get('seed', 3) });
const era = +get('era', 0), round = +get('round', 8);
while (!s.over && (s.era < era || (s.era === era && s.round < round))) for (const x of chooseTurn(s).actions) { applyAction(s, x); if (s.over) break; }
writeFileSync(get('out', 'map.html'), `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width"><style>body{margin:8px;background:#F5EFE1;font-family:sans-serif}${MAP_CSS}</style></head><body>${mapSVG(s, 19)}</body></html>`);
