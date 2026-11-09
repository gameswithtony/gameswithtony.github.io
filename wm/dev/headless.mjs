// Browser QA using the locally installed Chrome and its DevTools protocol.
// No npm packages, build, or connection to the user's existing browser profile.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { contrastAudit } from './contrast.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'resources', 'browser-qa');
fs.mkdirSync(out, { recursive: true });
const chromePath = process.env.WM_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const port = Number(process.env.WM_QA_PORT || 8079);
let browser, server, socket, seq = 0, session;
const pending = new Map(), errors = [], failures = [], checks = [], screenshots = [];
const contrastReports = [];
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
  await waitFor('WM.ready');
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
const FITS=`(()=>{const list=document.querySelector('.choice-list');if(!list)return true;const cells=[...list.querySelectorAll('.seat-cell,.seat-off,.slot-cell,.act-tile,.act-free,.choice')];return list.scrollWidth<=list.clientWidth+1&&!cells.some(c=>{if(!c.getClientRects().length)return false;const b=c.getBoundingClientRect();return c.scrollWidth>c.clientWidth+1||[...c.querySelectorAll('*')].some(e=>{const r=e.getBoundingClientRect();return r.width&&(r.left<b.left-1||r.right>b.right+1)})})})()`;
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
  test('Collapsed action keeps vouchers visible and leaves board visible: '+width,collapsed.height<130&&await evaluate('getComputedStyle(document.querySelector(".decision-body")).display==="none"&&document.querySelector(".decision > .voucher-bar").getBoundingClientRect().height>=36'));
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
  for (const width of [320, 375, 820, 1600]) {
    await viewport(width); await layout('setup-' + width);
    if (width === 375 || width === 1600) {await screenshot('setup-' + width);contrastReports.push({tab:'setup',width,...await evaluate('('+contrastAudit.toString()+')()')});}
  }
  await viewport(375, 812);
  await evaluate('document.getElementById("seed").value="41"'); await click('[data-do="start"]');
  await waitFor('WM.state?.prompt?.task === "setupWorkshop"'); test('New game starts through the UI', true);
  await answerFirst(); await answer('o.v === "construct"'); await answer('o.v === 0'); await reachMenu();
  test('Bot constructed through UI', await evaluate('WM.state.p.items.filter(i=>i.type==="bot").length===1'));
  await answer('o.v === "buyChemical"'); await answer('o.v?.color === "green"'); await reachMenu();
  test('Chemical acquired through UI', await evaluate('WM.state.p.items.some(i=>i.type==="chemical"&&i.color==="green")'));
  await answer('o.v === "extend"'); await answerFirst(); await reachMenu();
  test('Workshop extension placed through UI', await evaluate('WM.state.p.workshop.length===2'));
  for (const [w,h] of [[320,568],[320,812],[375,812],[430,932],[650,800],[820,700],[1280,640],[1600,1000]]) {
    await viewport(w,h);
    test(`End turn stays in view without scrolling the options: ${w}x${h}`,await evaluate('(()=>{const b=document.querySelector(".choice-pinned .primary-choice").getBoundingClientRect(),t=document.querySelector(".tabs"),limit=getComputedStyle(t).position==="fixed"?t.getBoundingClientRect().top:innerHeight;return WM.state.prompt.kind==="menu"&&!document.querySelector(".choice-list .primary-choice")&&b.top>=0&&b.bottom<=limit+1})()'));
  }
  await viewport(375,812);
  const saved = await evaluate('JSON.stringify(WM.state)');
  await answer('o.v === "done"'); test('Round one movement offered', await evaluate('WM.state.prompt.task==="move"'));
  await click('[data-do="toggleDecision"]');
  await click('.decision-dock-header [data-do="undo"]'); assert.equal(await evaluate('JSON.stringify(WM.state)'), saved); checks.push('Undo from collapsed decision restores complete state');
  test('Undo expands the restored decision', await evaluate('document.querySelector(".decision").dataset.collapsed === "false"'));
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
    test('Top bar has a single icon-only theme button and no Undo: '+width,await evaluate('document.querySelectorAll(".topbar [data-do=theme]").length===1&&!document.querySelector(".topbar [data-do=theme]").textContent.trim()&&!document.querySelector(".topbar [data-do=undo]")'));
    test('Visible decision Undo sits left of explain: '+width,await evaluate('(()=>{const groups=[...document.querySelectorAll(".decision-controls")].filter(e=>e.getClientRects().length);return groups.length===1&&groups.every(e=>{const u=e.querySelector("[data-do=undo]").getBoundingClientRect(),h=e.querySelector("[data-do=explain]").getBoundingClientRect();return u.width>=36&&u.height>=38&&u.right<=h.left&&u.top===h.top})})()'));
    test('A maximum never renders taller than its current value: '+width,await evaluate('[...document.querySelectorAll(".voucher")].every(e=>Math.abs(parseFloat(getComputedStyle(e.querySelector("small")).fontSize)/parseFloat(getComputedStyle(e.querySelector("b")).fontSize)-.95)<.01)'));
    test('Header gives readable scores room: '+width,await evaluate('(()=>{const h=document.querySelector(".topbar").getBoundingClientRect();return h.height<=90&&document.querySelector(".brand").textContent==="WM"&&[...document.querySelectorAll(".topbar .inspect,.topbar .icon-button")].every(e=>{const r=e.getBoundingClientRect();return r.top>=h.top&&r.bottom<=h.bottom&&r.left>=h.left&&r.right<=h.right})&&[...document.querySelectorAll(".score-pair b")].every(e=>parseFloat(getComputedStyle(e).fontSize)>=22)})()'));
    test('Vouchers belong to the decision, with inventory repeated in the header: '+width,await evaluate('!document.querySelector(".topbar .voucher")&&document.querySelectorAll(".decision .voucher").length===5&&[...document.querySelectorAll(".header-inventory b")].every((e,i)=>Number(e.textContent)===WM.state.p.items.filter(t=>t.type===["bot","part","chemical"][i]).length)'));
    await evaluate('window.scrollTo(0,document.documentElement.scrollHeight)');
    test('Header remains at the top while scrolling: '+width,await evaluate('Math.abs(document.querySelector(".topbar").getBoundingClientRect().top)<1'));
    test('Defeat clocks stay directly under the header while scrolling: '+width,await evaluate('(()=>{const g=document.querySelector(".weather-gauge").getBoundingClientRect(),h=document.querySelector(".topbar").getBoundingClientRect();return Math.abs(g.top-h.bottom)<1.5&&document.querySelectorAll(".gauge-cell").length===5&&Number(document.querySelector(".gauge-reports b").textContent)===WM.state.reportDeck.length})()'));
    await evaluate('window.scrollTo(0,0)');
    test('Subsidies name their benefit: '+width,await evaluate('![...document.querySelectorAll(".subsidy-pips button")].some(e=>e.textContent.trim()==="blue")'));
    test('Action text stays readable: '+width,await evaluate('[...document.querySelectorAll(".choice-content strong,.choice-content small")].every(e=>parseFloat(getComputedStyle(e).fontSize)>=13)'));
    if(width<=650)await mobileDock(width);
    if(width===375){
      const beforeExplain=await evaluate('JSON.stringify(WM.state)');
      await click('.decision-dock-header [data-do="explain"]');
      test('Explain mode says what to do',await evaluate('!!document.querySelector(".explain-bar")'));
      await click('[data-do="answer"][data-choice="0"]');
      test('Explain mode opens the option, not the move',await evaluate('!!document.querySelector("dialog[open] .tip-lines")')&&await evaluate('JSON.stringify(WM.state)')===beforeExplain);
      contrastReports.push({tab:'explain',width,...await evaluate('('+contrastAudit.toString()+')()')});
      await click('dialog [data-do="close"]');await click('.decision-dock-header [data-do="explain"]');
    }
    for (const tab of ['table', 'workshop', 'office', 'reports', 'history']) {
      await openTab(tab); await layout(`${tab}-${width}`);
      if(width===375||width===1600)contrastReports.push({tab,width,...await evaluate('('+contrastAudit.toString()+')()')});
      test('Storage summary appears only in Workshop: '+tab+'-'+width,await evaluate('(()=>{const s=document.querySelector(".hand-bar");return '+JSON.stringify(tab)+'==="workshop"?!!s&&!!s.closest(".main-view .panel")&&s.previousElementSibling?.classList.contains("panel-head"):!s})()'));
      if ([375,820,1600].includes(width) && ['table','workshop','office','reports'].includes(tab)) await screenshot(`${tab}-${width}`, true);
    }
  }
  for (const width of [320,375]) {
    await viewport(width,812);
    test('Late-game scores and final-round flag fit the header: '+width,await evaluate('(async()=>{const {header}=await import("./js/views.js"),s=structuredClone(WM.state),original=document.querySelector(".topbar").outerHTML;s.p.cp=125;s.target=160;s.round=9;s.endRound=9;document.querySelector(".topbar").outerHTML=header(s);const h=document.querySelector(".topbar").getBoundingClientRect(),groups=[...document.querySelectorAll(".topbar .brand,.topbar .round,.topbar .score-pair,.header-inventory,.header-actions")].map(e=>e.getBoundingClientRect()),fits=groups.every((r,i)=>r.left>=h.left&&r.right<=h.right&&groups.every((other,j)=>i===j||r.right<=other.left||other.right<=r.left||r.bottom<=other.top||other.bottom<=r.top));document.querySelector(".topbar").outerHTML=original;return fits})()'));
  }
  for (const [w,h] of [[1280,640],[1440,900],[820,700]]) {
    await viewport(w,h);
    test(`Decision panel fits the first screen, options scroll inside it: ${w}x${h}`,await evaluate('(()=>{window.scrollTo(0,0);const d=document.querySelector(".decision").getBoundingClientRect(),l=document.querySelector(".choice-list"),r=l.getBoundingClientRect();return d.bottom<=innerHeight&&r.bottom<=d.bottom&&getComputedStyle(l).overflowY==="auto"&&r.height>=90})()'));
  }
  await viewport(1440,900);await openTab('table');
  const belowLab=()=>evaluate('document.querySelector("[data-panel=supply]").getBoundingClientRect().top');
  const openTop=await belowLab();
  await click('.panel-toggle[data-panel="lativ-s-lab"]');
  test('A collapsed block lets the rest of its column close up',await evaluate('document.querySelector("section[data-panel=lativ-s-lab]").dataset.closed==="true"')&&await belowLab()<openTop-100);
  await click('.panel-toggle[data-panel="lativ-s-lab"]');
  test('A collapsed block reopens',await evaluate('document.querySelector("section[data-panel=lativ-s-lab]").dataset.closed==="false"'));
  for (const w of [320,360,375,430,651,700,950,1100,1280,1400,1401,1500,1650,1920]) {
    await viewport(w,900);
    const fitted=await evaluate(`(async()=>{const {decision}=await import("./js/views.js"),{run}=await import("./js/runner.js"),s=structuredClone(WM.state);Object.assign(s.positions,{you:{location:3,space:1},lativ:{location:1,space:-1},white:{location:1,space:0},pink:{location:2,space:1}});for(const k of Object.keys(s.p.vouchers))s.p.vouchers[k]=3;s.stack=[{t:'move'}];s.prompt=null;s.over=false;run(s);const old=document.querySelector(".decision"),keep=old.outerHTML;old.outerHTML=decision(s);await new Promise(r=>requestAnimationFrame(r));const ok=${FITS};document.querySelector(".decision").outerHTML=keep;return ok&&s.prompt.task==="move"})()`);
    test('Worst-case move grid fits without side scrolling: '+w,fitted);
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
      contrastReports.push({tab:'modal-'+key,width:375,...await evaluate('('+contrastAudit.toString()+')()')});
      await layout('modal-' + key);
      await click('dialog [data-do="close"]'); await evaluate('document.querySelector("[data-qa-target]")?.removeAttribute("data-qa-target")');
    }
  }
  await openTab('table'); await click('.topbar [data-do="theme"]');
  for (const width of [375,1600]) {
    await viewport(width,width===375?812:1000);
    for (const tab of ['table','workshop','office','reports','history']) {
      await openTab(tab);contrastReports.push({tab,width,...await evaluate('('+contrastAudit.toString()+')()')});
      await layout('dark-'+tab+'-'+width);
      if(tab==='office'||tab==='workshop')await screenshot('dark-'+tab+'-'+width,true);
    }
  }
  await openTab('table');await viewport(375,812);
  test('Dark theme applied', await evaluate('document.documentElement.dataset.theme==="dark"')); await screenshot('dark-phone',true); await layout('dark-phone');
  await viewport(1600,1000); await screenshot('dark-desktop',true); await layout('dark-desktop');
  await viewport(375,812);
  const overflowed=[],sweptShapes=new Set();
  for(let i=0;i<180&&!await evaluate('WM.state.over');i++){
    const shape=await evaluate('WM.state.prompt?.task+":"+WM.state.prompt?.options.length');
    if(!sweptShapes.has(shape)){sweptShapes.add(shape);for(const w of [320,700,1280,1500]){await viewport(w,900);if(!await evaluate(FITS))overflowed.push(w+': '+await evaluate('WM.state.prompt?.title'));}await viewport(375,812);}
    const menu=await evaluate('WM.state.prompt?.kind === "menu"');
    await answer(menu?'o.v === "done"':'o.v !== "cancel"');
  }
  test('No decision in a whole game overflows its panel: '+overflowed.slice(0,6).join('; '),overflowed.length===0);
  test('A complete game reaches its result screen through UI controls',await evaluate('WM.state.over && !!document.querySelector(".decision.result")'));
  await screenshot('game-result-phone');await layout('game-result-phone');
  contrastReports.push({tab:'result',width:375,...await evaluate('('+contrastAudit.toString()+')()')});
  await click('.topbar [data-do="menu"]');
  contrastReports.push({tab:'dark-menu',width:375,...await evaluate('('+contrastAudit.toString()+')()')});
  await click('dialog [data-do="close"]');
  await click('.decision [data-do="new"]');await click('dialog [data-do="newSetup"]');
  await viewport(375,812);await layout('dark-setup');
  contrastReports.push({tab:'dark-setup',width:375,...await evaluate('('+contrastAudit.toString()+')()')});
  await screenshot('dark-setup-phone');
  await viewport(760,560);
  await call('Page.navigate',{url:`http://127.0.0.1:${port}/dev/icons.html`});
  await waitFor('document.querySelectorAll(".sample").length===6');
  await evaluate('document.fonts.ready');
  await screenshot('icon-review');
  test('No browser runtime errors', errors.length === 0);
  fs.writeFileSync(path.join(out,'contrast.json'),JSON.stringify(contrastReports,null,2));
  const report = { browser: (await call('Browser.getVersion',{},null)).product, checks: checks.length, layoutFailures: failures, contrastFailures:contrastReports.reduce((n,r)=>n+r.failures.length,0), errors, screenshots };
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
  assert.equal(failures.length,0,'No horizontal overflow or out-of-bounds panels');
  assert.equal(report.contrastFailures,0,'Rendered text meets the contrast threshold');
} catch (error) {
  fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({error:error.stack,checks,failures,errors},null,2));
  console.error(error.stack); process.exitCode=1;
} finally {
  if(socket?.readyState===WebSocket.OPEN){try{await call('Browser.close',{},null)}catch{}socket.close();}
  browser?.kill();server?.kill();
}
