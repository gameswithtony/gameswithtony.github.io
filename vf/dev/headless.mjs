// Actual headless Chrome QA, requested by the user. No npm packages or build step.
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {contrastAudit} from '../../wm/dev/contrast.mjs';
const root=path.resolve(import.meta.dirname,'..'),out=path.join(root,'resources/browser-qa');
fs.mkdirSync(out,{recursive:true});
const port=Number(process.env.VF_QA_PORT||8087),chrome=process.env.VF_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe';
let browser,server,socket,seq=0,session;const pending=new Map(),errors=[],failures=[],checks=[],screenshots=[],contrasts=[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function call(method,params={},target=session){const id=++seq;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('CDP timed out: '+method)),20000);pending.set(id,{resolve:v=>{clearTimeout(timer);resolve(v)},reject});socket.send(JSON.stringify({id,method,params,...(target?{sessionId:target}:{})}));});}
async function evaluate(expression){const r=await call('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
async function wait(expression){for(let i=0;i<200;i++){if(await evaluate(expression))return;await sleep(30);}throw Error('Timed out: '+expression);}
function check(label,value){assert.ok(value,label);checks.push(label);}
async function click(selector){const point=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e||e.disabled)throw Error('Missing or disabled '+${JSON.stringify(selector)});e.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);check('Reachable '+selector,await evaluate(`document.querySelector(${JSON.stringify(selector)}).contains(document.elementFromPoint(${point.x},${point.y}))`));await call('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});await call('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});}
async function viewport(width,height=900){await call('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<=700});await evaluate('window.scrollTo(0,0)');await evaluate('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');}
async function shot(name){await evaluate('document.fonts.ready');const result=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(result.data,'base64'));screenshots.push(name+'.png');}
async function layout(label){const r=await evaluate(`(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,panels:[...document.querySelectorAll('.topbar,.resources,.outlook,.tabs,.decision,.setup-controls,.view-head,dialog[open]')].filter(e=>e.getClientRects().length).map(e=>({class:e.className,x:e.getBoundingClientRect().x,right:e.getBoundingClientRect().right,scroll:e.scrollWidth,width:e.clientWidth})).filter(e=>e.x<-.5||e.right>innerWidth+.5||e.scroll>e.width+1),buttons:[...document.querySelectorAll('.decision-footer button,.topbar button,.resources button')].filter(e=>e.getClientRects().length).map(e=>({text:e.textContent.trim(),x:e.getBoundingClientRect().x,right:e.getBoundingClientRect().right})).filter(e=>e.x<-.5||e.right>innerWidth+.5)}))()`);if(r.scroll>r.width+1||r.panels.length||r.buttons.length)failures.push({label,...r});checks.push('Layout '+label);}
async function contrast(label){contrasts.push({label,...await evaluate('('+contrastAudit.toString()+')()')});}
async function option(index){await wait('VF.ready');const code=await evaluate('VF.view.decision.code');await click(`.decision [data-do="option"][data-index="${index}"]`);await wait(`VF.ready&&VF.view.decision?.code!==${code}`);check('No action error',!await evaluate('document.querySelector("dialog[open] #sheet-title")?.textContent.includes("could not")'));}
try{
  server=spawn(process.execPath,[path.join(root,'dev/serve.mjs'),String(port)],{windowsHide:true,stdio:['ignore','pipe','pipe']});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.stdout.once('data',resolve);server.stderr.once('data',b=>reject(Error(String(b))));});
  browser=spawn(chrome,['--headless=new','--remote-debugging-port=0','--remote-debugging-address=127.0.0.1','--user-data-dir='+path.join(out,'chrome-profile'),'--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-extensions','--disable-sync','--disable-component-update','--hide-scrollbars','about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
  const ws=await new Promise((resolve,reject)=>{let text='';const timer=setTimeout(()=>reject(Error('Chrome startup: '+text.slice(-900))),20000);browser.once('error',reject);browser.stderr.on('data',data=>{text+=data;const found=text.match(/DevTools listening on (ws:\/\/\S+)/);if(found){clearTimeout(timer);resolve(found[1]);}});});
  socket=new WebSocket(ws);await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  socket.addEventListener('message',event=>{const m=JSON.parse(event.data);if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);if(m.method==='Log.entryAdded'&&m.params.entry.level==='error')errors.push(m.params.entry.text);if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push(m.params.args.map(a=>a.value||a.description).join(' '));});
  const t=await call('Target.createTarget',{url:'about:blank'},null);session=(await call('Target.attachToTarget',{targetId:t.targetId,flatten:true},null)).sessionId;
  await call('Page.enable');await call('Runtime.enable');await call('Log.enable');
  await call('Storage.clearDataForOrigin',{origin:`http://127.0.0.1:${port}`,storageTypes:'all'});
  await viewport(375,812);await call('Page.navigate',{url:`http://127.0.0.1:${port}/`});await wait('!!document.querySelector("[data-do=start]")');
  const fonts=await evaluate('Promise.all([...document.fonts].map(f=>f.load())).then(()=>[...document.fonts].map(f=>({family:f.family,status:f.status})))');check('All six local font faces load',fonts.length===6&&fonts.every(f=>f.status==='loaded'));
  for(const width of [320,375,430,700,820,1280,1600]){await viewport(width,width<700?812:1000);await layout('setup-'+width);if([375,1600].includes(width)){await shot('setup-'+width);await contrast('setup-'+width);}}
  await viewport(375,812);await evaluate('document.getElementById("seed").value="complete-evaluation";document.getElementById("house").value="Belitan"');await click('[data-do=start]');await wait('VF.ready&&!!VF.view');
  for(const width of [320,375,430,650,700,820,1280,1600]){
    await viewport(width,width<=700?812:1000);
    for(const tab of ['galaxy','house','cards','void','log']){await click(`.tabs [data-tab="${tab}"]`);await layout(tab+'-'+width);if([375,1600].includes(width)){await shot(tab+'-'+width);await contrast(tab+'-'+width);}}
    if(width<=700){const pos=await evaluate('(()=>{const d=document.querySelector(".decision").getBoundingClientRect(),n=document.querySelector(".tabs").getBoundingClientRect();return{bottom:d.bottom,tab:n.top,nav:n.bottom,h:d.height}})()');check('Dock flush with mobile tabs '+width,Math.abs(pos.bottom-pos.tab)<1&&Math.abs(pos.nav-(width<=700?812:1000))<1);}
  }
  await viewport(375,812);await click('.tabs [data-tab=galaxy]');
  await click('[data-do=collapse]');check('Action collapses',await evaluate('getComputedStyle(document.querySelector(".decision-scroll")).display==="none"'));await shot('collapsed-375');await click('.tabs [data-tab=house]');check('Collapse survives view changes',await evaluate('document.querySelector(".decision").classList.contains("collapsed")'));await click('[data-do=collapse]');
  await click('.topbar [data-do=menu]');await layout('menu-phone');await shot('menu-phone');await click('dialog [data-do=share]');const code=await evaluate('document.getElementById("share-code").value');check('Share code available',code.startsWith('VF1:'));await click('dialog [data-do=close]');
  await click('.resources [data-key=food]');await layout('resource-details');await shot('resource-details');await click('dialog [data-do=close]');
  await click('.tabs [data-tab=galaxy]');await click('[data-do=zoom-fit]');await layout('map-fit-phone');await shot('map-fit-phone');await click('[data-do=zoom-in]');
  const beforeChoice=await evaluate('JSON.stringify({player:VF.view.player,sectors:VF.view.sectors,code:VF.view.decision.code})');
  await option(0);await click('.decision-footer [data-do=undo]');await wait('VF.ready&&VF.view?.decision?.code===1');
  check('Undo restores the complete prior position through UI',beforeChoice===await evaluate('JSON.stringify({player:VF.view.player,sectors:VF.view.sectors,code:VF.view.decision.code})'));
  await option(0);const stored=await evaluate('JSON.stringify({player:VF.view.player,sectors:VF.view.sectors,code:VF.view.decision.code})');
  await call('Page.reload');await wait('typeof VF!=="undefined"&&VF.ready&&VF.view?.decision?.code===2');check('Reload restores browser autosave',stored===await evaluate('JSON.stringify({player:VF.view.player,sectors:VF.view.sectors,code:VF.view.decision.code})'));
  await click('.topbar [data-do=menu]');await click('dialog [data-do=share]');const savedCode=await evaluate('document.getElementById("share-code").value');await click('dialog [data-do=close]');
  await click('.topbar [data-do=menu]');await click('dialog [data-do=import]');await evaluate(`document.getElementById('load-code').value=${JSON.stringify(savedCode)}`);await click('dialog [data-do=load]');await wait('VF.ready&&VF.view?.decision?.code===2');check('Import restores shared code through UI',stored===await evaluate('JSON.stringify({player:VF.view.player,sectors:VF.view.sectors,code:VF.view.decision.code})'));
  const mapPosition=await evaluate('document.querySelector(".map-viewport").scrollLeft');await click('[data-do=home]');check('Map controls work',await evaluate('!!document.querySelector(".sector.you")'));
  // Walk real user controls through varied decision types and a complete solo game.
  let payments=0,combats=0,selections=0;
  for(let n=0;n<400&&!await evaluate('VF.view.ended');n++){
    await wait('VF.ready');const d=await evaluate('VF.view.decision');if(!d)break;
    if(n%30===0){console.log('UI choice',n,d.message);await layout('decision-'+n);}
    const textFit=await evaluate(`(()=>[...document.querySelectorAll('.score b,.resource-value b')].every(e=>{const r=document.createRange();r.selectNodeContents(e);const t=r.getBoundingClientRect(),b=e.closest('button').getBoundingClientRect();return t.left>=b.left-1&&t.right<=b.right+1}))()`);check('Score and stockpile text fits at choice '+n,textFit);
    if(n===15||n===60){await shot('live-decision-'+n);await contrast('live-decision-'+n);}
    if(d.cost){payments++;check('Payment has one commit action',await evaluate('document.querySelectorAll(".decision-footer [data-do=pay]").length===1&&!document.querySelector(".decision-footer [data-do=option]")'));if(payments===1){await shot('payment-phone');await contrast('payment-phone');}await click('[data-do=pay]');}
    else if(d.combat){combats++;await click('[data-do=combat-confirm]');}
    else if(d.adjust||d.ranges){if(d.adjust){const available=d.adjust.available;for(let i=0;i<d.adjust.num;i++)await click(`[data-do=amount][data-resource="${available[0]}"][data-amount="1"]`);}await click('[data-do=amount-confirm]');}
    else{const options=d.choices.filter(c=>!c.disabled&&!c.toggle);const text=options.find(c=>c.type==='text'&&c.label!=='Finish')||options.find(c=>c.type==='text');if(text){await option(text.index);continue;}if(d.singleClick&&d.selectionNum===1){await option(options[0].index);continue;}selections++;for(const c of options.slice(0,d.optional?0:d.selectionNum||1)){await click(`.decision [data-do=option][data-index="${c.index}"]`);await wait('VF.ready');}await click('[data-do=confirm]');}
    await wait(`VF.ready&&(VF.view.ended||VF.view.decision?.code!==${d.code})`);
  }
  check('Complete solo game reaches result',await evaluate('VF.view.ended'));await shot('result-phone');await click('[data-do=result]');await layout('result-dialog');await shot('result-dialog');await contrast('result-dialog');
  fs.writeFileSync(path.join(out,'final-save.json'),await evaluate('JSON.stringify({format:"VF1",version:"1.00",config:VF.config,journal:VF.log})'));
  const finalScores=await evaluate('({you:VF.view.player.influence,voidborn:VF.view.voidborn.score,scoreText:document.querySelector(".scores").textContent})');
  await click('dialog [data-do=close]');await click('.topbar [data-do=menu]');await click('dialog [data-do=import]');
  const polishSave={format:'VF1',version:'1.00',config:{scenario:'First Stand',house:'Belitan',side:'A',difficulty:'easy',seed:'polish-2',preselected:false},journal:[]};
  await evaluate(`document.getElementById('load-code').value=${JSON.stringify(JSON.stringify(polishSave))}`);await click('dialog [data-do=load]');await wait('VF.ready&&VF.view?.cards["focus_heroic.Reinforcement"]');
  await click('.tabs [data-tab=cards]');await evaluate('document.querySelector("[data-do=card][data-id=\\"focus_heroic.Reinforcement\\"]").scrollIntoView({block:"center",behavior:"instant"})');await click('[data-do=card][data-id="focus_heroic.Reinforcement"]');
  for(const width of [320,375,1280]){await viewport(width,width<700?812:1000);await layout('heroic-details-'+width);await shot('heroic-reinforcement-'+width);await contrast('heroic-details-'+width);check('Effect title and cost align '+width,await evaluate('Array.from(document.querySelectorAll(".effect-line>header")).every(e=>{const t=e.querySelector("h3").getBoundingClientRect(),c=e.querySelector(".costs").getBoundingClientRect();return Math.abs((t.top+t.bottom)/2-(c.top+c.bottom)/2)<2})'));}
  await click('dialog [data-do=close]');check('Voidborn symbol has no cross or thruster strokes',await evaluate('document.querySelector(".scores .enemy .ship").querySelectorAll("path").length===1'));
  const report={browser:(await call('Browser.getVersion',{},null)).product,checks:checks.length,payments,combats,selections,finalScores,layoutFailures:failures,errors,screenshots,contrastFailures:contrasts.reduce((n,r)=>n+r.failures.length,0)};
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));fs.writeFileSync(path.join(out,'contrast.json'),JSON.stringify(contrasts,null,2));console.log(JSON.stringify(report,null,2));
  assert.equal(failures.length,0,'Layout failures');assert.equal(errors.length,0,'Browser errors');assert.equal(report.contrastFailures,0,'Contrast failures');
}catch(error){fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({error:error.stack,checks,failures,errors},null,2));console.error(error.stack);process.exitCode=1;}finally{if(socket?.readyState===WebSocket.OPEN){try{await call('Browser.close',{},null)}catch{}socket.close();}browser?.kill();server?.kill();}
