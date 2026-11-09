// Browser QA using the locally installed Chrome and its DevTools protocol.
// No npm packages, build, or connection to the user's existing browser profile.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'resources', 'browser-qa');
fs.mkdirSync(out, { recursive: true });
const chromePath = process.env.WM_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const port = Number(process.env.WM_QA_PORT || 8079);
let browser, server, socket, seq = 0, session;
const pending = new Map(), errors = [], failures = [], checks = [], screenshots = [];
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const test = (name, fn) => { assert.ok(fn, name); checks.push(name); };
function call(method, params = {}, target = session) {
  const id = ++seq;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('CDP timeout: ' + method)); }, 20000);
    pending.set(id, { resolve: value => { clearTimeout(timer); resolve(value); }, reject });
    socket.send(JSON.stringify({ id, method, params, ...(target ? { sessionId: target } : {}) }));
  });
}
async function evaluate(expression) {
  const r = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ': ' + r.exceptionDetails.exception?.description);
  return r.result.value;
}
async function waitFor(expression) {
  for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await delay(50); }
  throw new Error('Timed out: ' + expression);
}
async function click(selector) {
  const point = await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e||e.disabled)throw Error('Missing/enabled control: '+${JSON.stringify(selector)});e.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);
  const reachable = await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});return e.contains(document.elementFromPoint(${point.x},${point.y}))})()`);
  assert.ok(reachable, 'Control is not covered by another panel: ' + selector);
  await call('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: 1 });
  await call('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: 1 });
}
async function answer(wanted) {
  if(await evaluate('document.querySelector(".decision-body") && getComputedStyle(document.querySelector(".decision-body")).display === "none"'))await click('[data-do="toggleDecision"]');
  const index = await evaluate(`WM.state.prompt.options.findIndex(o=>!o.disabled&&(${wanted}))`);
  assert.ok(index >= 0, 'Expected legal option: ' + wanted);
  await click(`[data-do="answer"][data-choice="${index}"]`);
  assert.equal(await evaluate('document.querySelector("dialog[open] #sheet-title")?.textContent || ""'), '', 'No action failure modal');
}
async function answerFirst() { await answer('true'); }
async function reachMenu() {
  for (let i = 0; i < 12; i++) {
    if (await evaluate('WM.state.prompt?.kind === "menu"')) return;
    await answerFirst();
  }
  throw new Error('Did not return to action menu');
}
async function viewport(width, height = 900) {
  await call('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 650 });
  await evaluate('window.scrollTo(0,0)');
  await evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
}
async function layout(label) {
  const data = await evaluate(`(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,body:document.body.scrollWidth,offenders:[...document.querySelectorAll('.panel,.decision,.topbar,.voucher-bar,.tabs,.setup-card,dialog[open]')].map(e=>({class:e.className,x:e.getBoundingClientRect().x,right:e.getBoundingClientRect().right,width:e.getBoundingClientRect().width})).filter(r=>r.x < -1 || r.right > innerWidth+1),modalOverflow:[...document.querySelectorAll('dialog[open],dialog[open] .sheet-body')].filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>({class:e.className,width:e.clientWidth,scroll:e.scrollWidth}))}))()`);
  if (data.scroll > data.width + 1 || data.offenders.length || data.modalOverflow.length) failures.push({ label, ...data });
  const clipped = await evaluate(`(()=>[...document.querySelectorAll('.voucher span,.scientists button>span:last-child,.branch-weather b,.rd-weather b,.office-bonus,.paper-status small,.experiment-stage,.experiment-card b small,.dock-title strong,.dock-toggle-state,.choice-content strong,.choice-content small,.goal-top,.goal-card>b')].filter(e=>e.getClientRects().length&&e.textContent.trim()).flatMap(e=>{const box=e.closest('button')?.getBoundingClientRect();if(!box)return[];const range=document.createRange();range.selectNodeContents(e);const text=range.getBoundingClientRect();return text.left<box.left-1||text.right>box.right+1?[{text:e.textContent.trim(),left:text.left,right:text.right,boxLeft:box.left,boxRight:box.right}]:[]}))()`);
  if(clipped.length)failures.push({label,clippedText:clipped});
  checks.push('Layout measured: ' + label);
  return data;
}
async function screenshot(name, full = false) {
  await waitFor('!document.getElementById("notice")?.textContent');
  await evaluate('window.scrollTo(0,0)');
  const bounds = await evaluate('({width:innerWidth,height:Math.min(12000,Math.max(innerHeight,document.documentElement.scrollHeight))})');
  const r = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: full, ...(full ? { clip: { x: 0, y: 0, ...bounds, scale: 1 } } : {}) });
  fs.writeFileSync(path.join(out, name + '.png'), Buffer.from(r.data, 'base64')); screenshots.push(name + '.png');
}
async function openTab(tab) { await click(`.tabs [data-do="tab"][data-tab="${tab}"]`); }
async function mobileDock(width) {
  const before = await evaluate('JSON.stringify(WM.state)');
  if(await evaluate('document.querySelector(".decision").dataset.collapsed === "true"'))await click('[data-do="toggleDecision"]');
  const position = () => evaluate(`(()=>{const d=document.querySelector('.decision').getBoundingClientRect(),t=document.querySelector('.tabs').getBoundingClientRect();return{y:d.y,left:d.left,right:d.right,bottom:d.bottom,height:d.height,tabY:t.y,tabBottom:t.bottom,viewport:innerHeight,width:innerWidth,fixed:getComputedStyle(document.querySelector('.decision')).position,tabFixed:getComputedStyle(document.querySelector('.tabs')).position}})()`);
  const first = await position();
  test('Bottom tabs fixed: '+width,first.tabFixed==='fixed'&&Math.abs(first.tabBottom-first.viewport)<1);
  test('Full-width action drawer is flush with tabs: '+width,first.fixed==='fixed'&&Math.abs(first.bottom-first.tabY)<1&&Math.abs(first.left)<1&&Math.abs(first.right-first.width)<1&&first.height<first.viewport*.57);
  await evaluate('window.scrollTo(0,document.documentElement.scrollHeight)');
  const scrolled=await position();test('Drawer and tabs stay fixed while scrolling: '+width,Math.abs(first.y-scrolled.y)<1&&Math.abs(first.tabY-scrolled.tabY)<1);
  await click('[data-do="toggleDecision"]');
  const collapsed=await position();
  test('Collapsed action leaves board visible: '+width,collapsed.height<100&&await evaluate('getComputedStyle(document.querySelector(".decision-body")).display==="none"'));
  await openTab('office');test('Tab changes preserve collapsed action: '+width,await evaluate('document.querySelector(".decision").dataset.collapsed==="true"'));
  assert.equal(await evaluate('JSON.stringify(WM.state)'),before);checks.push('Dock controls preserve game state: '+width);
  if(width===375){await screenshot('dock-collapsed-phone');await evaluate('document.documentElement.style.setProperty("--mobile-safe-bottom","24px")');const safe=await position();test('Safe area remains below tabs and action',Math.abs(safe.tabY+84-safe.viewport)<1&&Math.abs(safe.bottom-safe.tabY)<1);await evaluate('document.documentElement.style.removeProperty("--mobile-safe-bottom")');}
  await click('[data-do="toggleDecision"]');
  test('Action expands again: '+width,await evaluate('document.querySelector(".decision-toggle").getAttribute("aria-expanded")==="true"&&getComputedStyle(document.querySelector(".decision-body")).display!=="none"'));
  await openTab('table');if(width===375)await screenshot('dock-expanded-phone');
}

try {
  server = spawn(process.execPath, [path.join(root, 'dev', 'serve.mjs'), String(port)], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((resolve, reject) => { server.once('error', reject); server.stdout.once('data', resolve); server.stderr.once('data', b => reject(new Error(String(b)))); });
  browser = spawn(chromePath, ['--headless=new', '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1', '--user-data-dir=' + path.join(out, 'chrome-profile'), '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-extensions', '--disable-sync', '--disable-component-update', '--hide-scrollbars', 'about:blank'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
  const ws = await new Promise((resolve, reject) => {
    let output = '';
    const timer = setTimeout(() => reject(new Error('Chrome startup timed out: ' + output.slice(-1200))), 20000);
    browser.once('error', reject); browser.stderr.on('data', data => { output += data; const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/); if (match) { clearTimeout(timer); resolve(match[1]); } });
    browser.once('exit', code => reject(new Error('Chrome exited ' + code + ': ' + output.slice(-1200))));
  });
  socket = new WebSocket(ws);
  await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id) { const p = pending.get(message.id); if (!p) return; pending.delete(message.id); message.error ? p.reject(new Error(JSON.stringify(message.error))) : p.resolve(message.result); }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    if (message.method === 'Log.entryAdded' && message.params.entry.level === 'error') errors.push(message.params.entry.text);
  });
  const target = await call('Target.createTarget', { url: 'about:blank' }, null);
  session = (await call('Target.attachToTarget', { targetId: target.targetId, flatten: true }, null)).sessionId;
  await call('Runtime.enable'); await call('Page.enable'); await call('Log.enable');
  await call('Storage.clearDataForOrigin', {origin:`http://127.0.0.1:${port}`,storageTypes:'all'});
  await viewport(375, 812);
  await call('Page.navigate', { url: `http://127.0.0.1:${port}/` });
  await waitFor('typeof WM === "object" && !!document.querySelector("[data-do=start]")');
  const loadedFonts=await evaluate('Promise.all([...document.fonts].map(f=>f.load())).then(()=>[...document.fonts].map(f=>({family:f.family,weight:f.weight,status:f.status})))');
  test('All seven local Barlow font faces load',loadedFonts.length===7&&loadedFonts.every(f=>f.status==='loaded'));
  test('KEV body and heading fonts applied',await evaluate('getComputedStyle(document.body).fontFamily.includes("Barlow")&&getComputedStyle(document.querySelector("h1")).fontFamily.includes("Barlow Semi Condensed")'));
  await evaluate(`document.head.insertAdjacentHTML('beforeend','<style>*,*::before,*::after{animation:none!important;scroll-behavior:auto!important}</style>')`);
  for (const width of [320, 375, 820, 1600]) { await viewport(width); await layout('setup-' + width); if (width === 375 || width === 1600) await screenshot('setup-' + width); }
  await viewport(375, 812);
  await evaluate('document.getElementById("seed").value="41"'); await click('[data-do="start"]');
  await waitFor('WM.state?.prompt?.task === "setupWorkshop"'); test('New game starts through the UI', true);
  await answerFirst(); await answer('o.v === "construct"'); await answer('o.v === 0'); await reachMenu();
  test('Bot constructed through UI', await evaluate('WM.state.p.items.filter(i=>i.type==="bot").length===1'));
  await answer('o.v === "buyChemical"'); await answer('o.v?.color === "green"'); await reachMenu();
  test('Chemical acquired through UI', await evaluate('WM.state.p.items.some(i=>i.type==="chemical"&&i.color==="green")'));
  await answer('o.v === "extend"'); await answerFirst(); await reachMenu();
  test('Workshop extension placed through UI', await evaluate('WM.state.p.workshop.length===2'));
  const saved = await evaluate('JSON.stringify(WM.state)');
  await answer('o.v === "done"'); test('Round one movement offered', await evaluate('WM.state.prompt.task==="move"'));
  await click('[data-do="undo"]'); assert.equal(await evaluate('JSON.stringify(WM.state)'), saved); checks.push('Undo restores complete state');
  await call('Page.reload'); await waitFor('typeof WM === "object" && !!WM.state');
  assert.equal(await evaluate('JSON.stringify(WM.state)'), saved); checks.push('Reload restores autosave');
  await answer('o.v === "done"'); await answer('o.v?.location === 3'); await reachMenu();
  await answer('o.v === "work"'); await answer('o.v?.weather === "rain" && o.v?.space === 0'); await reachMenu();
  test('Lab contribution resolves through UI', await evaluate('WM.state.lab.rain[0].owner==="you" && !WM.state.p.items.some(i=>i.type==="chemical")'));
  await answer('o.v === "done"');
  test('Official Saboteur turn reached', await evaluate('WM.state.prompt?.task==="botTurn"'));
  await answerFirst(); test('Saboteur turn resolves', await evaluate('WM.state.log.some(e=>e.who==="saboteurs"&&e.text.includes("moved"))'));
  const current = await evaluate('JSON.stringify(WM.state)');
  await click('[data-do="menu"]'); await click('dialog [data-do="share"]');
  const code = await evaluate('document.querySelector("#share-code").value'); test('Share code available', code.startsWith('WM1:'));
  await click('dialog [data-do="close"]'); await click('[data-do="menu"]'); await click('dialog [data-do="import"]');
  await evaluate('document.getElementById("import-code").value="broken save"'); await click('dialog [data-do="load"]');
  test('Invalid import reports an error without replacing state', await evaluate('!!document.getElementById("import-error").textContent') && await evaluate('JSON.stringify(WM.state)') === current);
  await evaluate('document.getElementById("import-code").value=' + JSON.stringify(code)); await click('dialog [data-do="load"]');
  assert.equal(await evaluate('JSON.stringify(WM.state)'), current); checks.push('WM1 import restores exact state');
  for (const width of [320, 375, 430, 650, 820, 1280, 1600]) {
    await viewport(width, width < 650 ? 812 : 1000);
    test('Current and maximum voucher values share a font size: '+width,await evaluate('[...document.querySelectorAll(".voucher")].every(e=>getComputedStyle(e.querySelector("b")).fontSize===getComputedStyle(e.querySelector("small")).fontSize)'));
    test('Voucher labels are readable: '+width,await evaluate('[...document.querySelectorAll(".voucher span")].every(e=>parseFloat(getComputedStyle(e).fontSize)>=12)'));
    test('Action text stays readable: '+width,await evaluate('[...document.querySelectorAll(".choice-content strong,.choice-content small")].every(e=>parseFloat(getComputedStyle(e).fontSize)>=13)'));
    if(width<=650)await mobileDock(width);
    for (const tab of ['table', 'workshop', 'office', 'reports', 'history']) {
      await openTab(tab); await layout(`${tab}-${width}`);
      if ([375,820,1600].includes(width) && ['table','workshop','office','reports'].includes(tab)) await screenshot(`${tab}-${width}`, true);
    }
  }
  await viewport(375,812);
  if(await evaluate('document.querySelector(".decision").dataset.collapsed!=="true"'))await click('[data-do="toggleDecision"]');
  for (const tab of ['table','workshop','office','reports','history']) {
    await openTab(tab);
    const keys = await evaluate('[...new Set([...document.querySelectorAll("[data-info]")].map(e=>e.dataset.info))]');
    for (const key of keys) {
      const sel = `[data-info=${JSON.stringify(key)}]`;
      // Desktop-only rail controls are hidden on mobile; choose a displayed instance.
      const visible = await evaluate(`(()=>{const list=[...document.querySelectorAll(${JSON.stringify(sel)})];const e=list.find(e=>e.getClientRects().length);if(!e)return false;e.dataset.qaTarget='1';return true})()`);
      if (!visible) continue;
      await click('[data-qa-target="1"]');
      test('Inspect: ' + key, await evaluate('!!document.querySelector("dialog[open] #sheet-title")?.textContent'));
      await layout('modal-' + key);
      await click('dialog [data-do="close"]'); await evaluate('document.querySelector("[data-qa-target]")?.removeAttribute("data-qa-target")');
    }
  }
  await openTab('table'); await click('[data-do="menu"]'); await click('dialog [data-do="theme"]'); await click('dialog [data-do="close"]');
  test('Dark theme applied', await evaluate('document.documentElement.dataset.theme==="dark"')); await screenshot('dark-phone',true); await layout('dark-phone');
  await viewport(1600,1000); await screenshot('dark-desktop',true); await layout('dark-desktop');
  await viewport(375,812);
  for(let i=0;i<180&&!await evaluate('WM.state.over');i++){
    const menu=await evaluate('WM.state.prompt?.kind === "menu"');
    await answer(menu?'o.v === "done"':'o.v !== "cancel"');
  }
  test('A complete game reaches its result screen through UI controls',await evaluate('WM.state.over && !!document.querySelector(".decision.result")'));
  await screenshot('game-result-phone');await layout('game-result-phone');
  await viewport(760,560);
  await call('Page.navigate',{url:`http://127.0.0.1:${port}/dev/icons.html`});
  await waitFor('document.querySelectorAll(".sample").length===5');
  await evaluate('document.fonts.ready');
  await screenshot('icon-review');
  test('No browser runtime errors', errors.length === 0);
  const report = { browser: (await call('Browser.getVersion',{},null)).product, checks: checks.length, layoutFailures: failures, errors, screenshots };
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
  assert.equal(failures.length,0,'No horizontal overflow or out-of-bounds panels');
} catch (error) {
  fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({error:error.stack,checks,failures,errors},null,2));
  console.error(error.stack); process.exitCode=1;
} finally {
  if(socket?.readyState===WebSocket.OPEN){try{await call('Browser.close',{},null)}catch{}socket.close();}
  browser?.kill();server?.kill();
}
