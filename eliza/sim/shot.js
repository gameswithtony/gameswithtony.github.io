// Dev tool: screenshot the app at phone size with headless Chrome (DevTools protocol, no dependencies).
// Needs the site served at http://127.0.0.1:8765 (python -m http.server 8765 --bind 127.0.0.1 from the repo root).
// node sim/shot.js --out dir [--mode phone|physical] [--rounds 3] [--width 390] [--height 844]
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const a = process.argv.slice(2), get = (k, d) => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : d; };
const out = get('out', join(tmpdir(), 'eliza-shots')), mode = get('mode', 'phone'), rounds = +get('rounds', 3);
const W = +get('width', 390), H = +get('height', 844), theme = get('theme', 'light');
mkdirSync(out, { recursive: true });
const CHROME = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const port = 9300 + Math.floor(Math.random() * 500);
const proc = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${join(out, 'profile')}`, '--no-first-run', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));

let ws, id = 0;
const pending = new Map();
function send(method, params = {}) {
    const msg = { id: ++id, method, params };
    ws.send(JSON.stringify(msg));
    return new Promise(res => pending.set(msg.id, res));
}
async function evaluate(expr) {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails).slice(0, 400));
    return r.result.result.value;
}
async function shot(name, full = true) {
    const m = await evaluate('({w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight})');
    const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: full, clip: { x: 0, y: 0, width: W, height: full ? Math.min(m.h, 4000) : H, scale: 1 } });
    writeFileSync(join(out, name + '.png'), Buffer.from(r.result.data, 'base64'));
    console.log('wrote', join(out, name + '.png'));
}

try {
    let targets;
    for (let i = 0; i < 40; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); break; } catch { await sleep(250); } }
    const page = targets.find(t => t.type === 'page');
    ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise(r => ws.addEventListener('open', r));
    ws.addEventListener('message', e => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
    await send('Page.enable'); await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: true });
    await send('Page.navigate', { url: 'http://127.0.0.1:8765/eliza/reset.html' }); await sleep(800);
    await evaluate(`localStorage.setItem('elizatheme', '${theme}')`);
    await send('Page.navigate', { url: 'http://127.0.0.1:8765/eliza/index.html' }); await sleep(2000);
    await shot('01-start', false);
    await evaluate(`(async () => {
        const a = window.elizaApp; a.setup.mode = '${mode}'; a.startGame();
    })()`);
    await sleep(400); await shot('02-setup', false);
    // play: the AI brain drives the human too, until the given round
    await evaluate(`(async () => {
        const a = window.elizaApp; const sleep = ms => new Promise(r => setTimeout(r, ms));
        const ai = await import('./engine/ai.js');
        a.beginPlay();
        for (let i = 0; i < 400 && a.g.round < ${rounds} && !a.g.over; i++) {
            await sleep(20);
            if (a.thinking) { await sleep(200); continue; }
            if (a.aiTurn || ['roundEnd','eraEnd','handoff'].includes(a.screen)) { a.next(); continue; }
            if (a.isHumanTurn) { const { actions } = ai.chooseTurn(a.g, 'balanced'); a.apply(actions[0]); a.afterChange(); }
        }
        // stop on a human decision screen
        for (let i = 0; i < 50 && !(a.isHumanTurn && !a.aiTurn && a.screen === 'turn'); i++) { await sleep(150); if (!a.thinking && (a.aiTurn || a.screen !== 'turn')) a.next(); }
    })()`);
    await sleep(600); await shot('03-turn', false);
    for (const k of ['standings', 'hand', 'board', 'mat']) {
        await evaluate("(async () => { const a = window.elizaApp; if (a.phoneTabs.some(x => x.k === '" + k + "')) a.toggleSheet('" + k + "'); })()");
        await sleep(300); await shot('03-sheet-' + k, false);
        await evaluate("(() => { const b = document.querySelector('.sheet__body'); if (b) b.scrollTop = b.scrollHeight; })()");
        await sleep(200); await shot('03-sheet-' + k + '-end', false);
        await evaluate(`(async () => { window.elizaApp.sheet = null; })()`);
    }
    await evaluate(`(async () => { const a = window.elizaApp; a.startAction('build'); a.chooseIndustry(a.buildIndustries()[0]); })()`);
    await sleep(300); await shot('04-build-space', false);
    await evaluate(`(async () => { const a = window.elizaApp; a.draft = null; a.screen = 'turn'; a.next && 0; })()`);
    // an AI turn screen
    await evaluate(`(async () => { const a = window.elizaApp; const sleep = ms => new Promise(r => setTimeout(r, ms));
        a.startAction('pass'); if (a.draft.stage === 'card') a.chooseCard(a.curPlayer.hand[0]); a.next(); await sleep(50); if (a.isHumanTurn && !a.aiTurn) { a.startAction('pass'); if (a.draft.stage === 'card') a.chooseCard(a.curPlayer.hand[0]); a.next(); }
        for (let i = 0; i < 40 && !a.aiTurn; i++) { await sleep(150); if (['roundEnd','handoff'].includes(a.screen)) a.next(); }
        for (let i = 0; i < 40 && a.thinking; i++) await sleep(150);
    })()`);
    await sleep(400); await shot('05-ai-turn', false);
    await evaluate(`(async () => { const a = window.elizaApp; a.toggleShowHistory(); })()`);
    await sleep(300); await shot('06-history', false);
} catch (e) {
    console.error(e);
} finally {
    proc.kill();
}
