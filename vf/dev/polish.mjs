// Focused headless checks for the user's Politics/payment/alignment feedback.
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {automatic,session as rulesSession,answer,config as defaultConfig} from '../tests/helpers.mjs';
const root=path.resolve(import.meta.dirname,'..'),out=path.join(root,'resources/browser-qa'),port=8089;
fs.mkdirSync(out,{recursive:true});
let server,browser,socket,session,seq=0;const pending=new Map(),checks=[];
function call(method,params={},target=session){const id=++seq;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error(method+' timeout')),20000);pending.set(id,{resolve:r=>{clearTimeout(timer);resolve(r)},reject});socket.send(JSON.stringify({id,method,params,...(target?{sessionId:target}:{})}));});}
async function evalPage(expression){const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
async function wait(expression){for(let i=0;i<250;i++){if(await evalPage(expression))return;await new Promise(r=>setTimeout(r,25));}throw Error('Timed out '+expression);}
async function click(selector){const p=await evalPage(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e||e.disabled)throw Error('Missing '+${JSON.stringify(selector)});e.scrollIntoView({block:'center',behavior:'instant'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);assert.ok(await evalPage(`document.querySelector(${JSON.stringify(selector)}).contains(document.elementFromPoint(${p.x},${p.y}))`),'Reachable '+selector);await call('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'left',clickCount:1});await call('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'left',clickCount:1});}
async function viewport(width){await call('Emulation.setDeviceMetricsOverride',{width,height:width<700?812:1000,deviceScaleFactor:1,mobile:width<700});}
async function shot(name){const r=await call('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(r.data,'base64'));}
async function execute(cmd,d){
  if(cmd.kind==='option')await click(`.decision [data-do=option][data-index="${cmd.index}"]`);
  else if(cmd.kind==='confirm'){for(const index of cmd.indices){await click(`.decision [data-do=option][data-index="${index}"]`);await wait('VF.ready');}await click('[data-do=confirm]');}
  else if(cmd.kind==='pay')await click('[data-do=pay]');
  else if(cmd.kind==='combat')await click('[data-do=combat-confirm]');
  else if(cmd.kind==='adjust'||cmd.kind==='ranges'){for(const [key,n] of Object.entries(cmd.values)){const start=d.adjust?d.adjust.res[key]||0:d.ranges[key].initial??d.ranges[key].min??0;for(let i=start;i<n;i++)await click(`[data-do=amount][data-resource="${key}"][data-amount="1"]`);}await click('[data-do=amount-confirm]');}
  await wait(`VF.ready&&(VF.view.ended||VF.view.decision?.code!==${d.code})`);
}
try{
  server=spawn(process.execPath,[path.join(root,'dev/serve.mjs'),String(port)],{windowsHide:true,stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);});
  browser=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--remote-debugging-port=0','--remote-debugging-address=127.0.0.1','--user-data-dir='+path.join(out,'polish-profile'),'--no-first-run','--disable-extensions','--disable-sync','--disable-background-networking','--hide-scrollbars','about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
  const ws=await new Promise((resolve,reject)=>{let s='';browser.once('error',reject);browser.stderr.on('data',b=>{s+=b;const m=s.match(/DevTools listening on (ws:\/\/\S+)/);if(m)resolve(m[1]);});});
  socket=new WebSocket(ws);await new Promise(r=>socket.addEventListener('open',r,{once:true}));socket.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}});
  const target=await call('Target.createTarget',{url:'about:blank'},null);session=(await call('Target.attachToTarget',{targetId:target.targetId,flatten:true},null)).sessionId;
  await call('Runtime.enable');await call('Page.enable');await call('Storage.clearDataForOrigin',{origin:`http://127.0.0.1:${port}`,storageTypes:'all'});
  await viewport(375);await call('Page.navigate',{url:`http://127.0.0.1:${port}/`});await wait('!!document.querySelector("[data-do=start]")');
  if(process.argv.includes('--icons')){
    await evalPage(`(async()=>{const {icon}=await import('./js/icons.js');const {rich}=await import('./js/views.js');document.body.innerHTML='<main style="padding:24px;max-width:1000px;margin:auto"><h1>Corruption &amp; track advancement</h1><div style="padding:20px 0;font-size:18px;line-height:2">'+rich('[[gain_corruption]] Gain corruption OR [[gain_corruption]] Gain corruption and [[advance_track]] Advance track')+'</div>'+[18,24,48].map(size=>'<div style="display:flex;align-items:center;gap:24px;padding:20px 0;border-top:1px solid var(--line);color:var(--gold)">'+icon('gain_corruption',size)+icon('advance_track',size)+'<span>'+size+'px</span></div>').join('')+'</main>';await document.fonts.ready;})()`);
    for(const width of [375,1000]){
      await viewport(width);assert.ok(await evalPage('document.documentElement.scrollWidth<=innerWidth'),'Icon sample fits viewport');
      assert.ok(await evalPage('Array.from(document.querySelectorAll("svg")).every(s=>{const b=s.getBBox();return b.x>=1&&b.y>=1&&b.x+b.width<=23&&b.y+b.height<=23})'),'Icon paths fit their viewBox');
      await shot('corruption-advance-icons-'+width);
    }
    console.log('Corruption and Advance track checked inline and at 18, 24 and 48px, on phone and desktop.');
  }else if(process.argv.includes('--action-help')){
    await evalPage('document.getElementById("seed").value="action-help"');await click('[data-do=start]');await wait('typeof VF!=="undefined"&&VF.ready&&!!VF.view');
    for(let n=0;n<25;n++){
      const d=await evalPage('VF.view.decision');
      if(d.choices.some(c=>c.help?.some(h=>h.title==='Establish')&&!c.name))break;
      const dev=d.choices.find(c=>c.id==='focus_blue.Development'&&!c.disabled),grow=d.choices.find(c=>c.name==='Grow'&&!c.disabled);
      await execute(dev?{kind:'confirm',indices:[dev.index]}:grow?{kind:'option',index:grow.index}:automatic(d),d);
    }
    const before=await evalPage('JSON.stringify(VF.log)');
    for(const [title,text] of [['Establish','free Guild space'],['Build','free Installation space']]){
      const index=await evalPage(`VF.view.decision.choices.find(c=>c.help?.some(h=>h.title===${JSON.stringify(title)}))?.index`);assert.notEqual(index,undefined);
      await click(`.decision [data-do=choice-info][data-index="${index}"]`);await wait(`document.querySelector('dialog[open]')?.textContent.includes(${JSON.stringify(text)})`);
      assert.equal(await evalPage('JSON.stringify(VF.log)'),before,'Inspection does not take the action');
      assert.ok(await evalPage('document.querySelector(".sheet-body").textContent.length<350'),'Action explanation stays concise');
      await shot(title.toLowerCase()+'-help-phone');await click('dialog [data-do=close]');
    }
    console.log('Establish and Build info sheets show concise rules without taking the action.');
  }else{
  await evalPage('document.getElementById("seed").value="complete-evaluation";document.getElementById("house").value="Belitan"');await click('[data-do=start]');await wait('typeof VF!=="undefined"&&VF.ready&&!!VF.view');
  for(let n=0;n<12&&(await evalPage('VF.view.decision.message'))!=='Alert card for this round';n++){const d=await evalPage('VF.view.decision');await execute(automatic(d),d);}
  assert.equal(await evalPage('document.querySelector(".decision-context strong")?.textContent'),'Level 1 Alert');
  assert.ok(await evalPage('!document.querySelector(".decision").textContent.includes("Alert cards.")'),'Alert title has no engine ID');await shot('alert-reveal-phone');
  await click('.decision-context [data-do=card]');await wait('document.querySelector("dialog[open]")?.textContent.includes("Reveal a level 1 Crisis")');await shot('alert-details-phone');await click('dialog [data-do=close]');
  checks.push('Alert reveal and inspector show its level, recognizable symbol and Crisis instructions');
  for(let n=0;n<70;n++){
    const v=await evalPage('VF.view'),d=v.decision;
    if(d.message==='Select action to perform'&&await evalPage('document.querySelector(".decision-context strong")?.textContent==="Politics"'))break;
    const politics=v.phase.includes('choose focus card')?d.choices.find(c=>c.id==='focus_blue.Politics'&&!c.disabled):null;
    await execute(politics?{kind:'confirm',indices:[politics.index]}:automatic(d),d);
  }
  assert.ok(await evalPage('document.querySelector(".decision-context strong")?.textContent==="Politics"'),'Politics context reached');
  assert.ok(await evalPage('document.querySelector(".decision-context").tagName!=="BUTTON"&&!document.querySelector(".decision-context").classList.contains("card-tile")'),'Context is not a choice button');checks.push('Politics uses a non-button context header with a separate inspector');
  await shot('politics-context-phone');await viewport(1280);await shot('politics-context-desktop');await viewport(375);
  const prevail=await evalPage('VF.view.decision.choices.find(c=>c.name==="Prevail"&&!c.disabled)?.index');assert.notEqual(prevail,undefined);
  const d=await evalPage('VF.view.decision');await execute({kind:'option',index:prevail},d);await wait('VF.ready&&!!VF.view.decision.cost');
  assert.ok(await evalPage('document.querySelectorAll(".decision-footer [data-do=pay]").length===1&&!document.querySelector(".decision-footer [data-do=option]")'),'Only Pay & continue commits payment');checks.push('Politics Prevail payment has one commit action');await shot('politics-payment-phone');
  const game=rulesSession();let saved;
  try{
    let m=await game.start({...defaultConfig,seed:'emblem-0'});
    for(let n=0;n<60;n++){
      if(m.view.decision.choices.some(c=>c.id?.startsWith('tracks.'))){saved={format:'VF1',version:'1.00',config:m.config,journal:m.journal};break;}
      m=await answer(game,m.view,automatic(m.view.decision));
    }
  }finally{await game.stop();}
  assert.ok(saved,'Reached real Corruption destination choice');
  await click('.topbar [data-do=menu]');await click('dialog [data-do=import]');await evalPage(`document.getElementById('load-code').value=${JSON.stringify(JSON.stringify(saved))}`);await click('dialog [data-do=load]');
  await wait('VF.ready&&VF.view?.decision?.message==="Select destination for corruption"');
  assert.deepEqual(await evalPage('Array.from(document.querySelectorAll(".decision .choice-copy strong")).slice(0,3).map(e=>e.textContent)'),['Society track','Statecraft track','Economy track']);
  assert.ok(await evalPage('!document.querySelector(".decision").textContent.includes("Tracks.")'),'No internal track IDs');
  checks.push('Real Corruption destination choice has readable names and distinct track icons');await shot('corruption-destinations-phone');
  await click('.decision [data-do=choice-info][data-index="0"]');await wait('document.querySelector("dialog[open]")?.textContent.includes("Society track")');await shot('society-destination-detail');await click('dialog [data-do=close]');
  await viewport(1280);
  await evalPage(`(async()=>{const {crest,icon}=await import('./js/icons.js');const {houseEmblems}=await import('./js/house-emblems.js');document.body.innerHTML='<main style="padding:32px;max-width:1200px;margin:auto"><h1>House insignia</h1><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:24px">'+Object.keys(houseEmblems).map(name=>'<div style="color:var(--gold);text-align:center;padding:16px;background:var(--surface)">'+crest(name,90)+'<h3>'+name+'</h3><div>'+crest(name,32)+'</div></div>').join('')+'</div><p style="display:flex;gap:24px;align-items:center">'+icon('leadership',80)+icon('leadership',24)+'Heroic Leadership</p></main>';await document.fonts.ready;})()`);
  assert.equal(await evalPage('document.querySelectorAll(".crest").length'),28);await shot('house-insignia-gallery');checks.push('All fourteen House emblems render at large and small sizes; Leadership pole sits at the hoist');
  console.log(JSON.stringify({checks},null,2));
  }
}catch(e){console.error(e.stack);process.exitCode=1;try{await shot('polish-failure')}catch{}}finally{if(socket?.readyState===WebSocket.OPEN){try{await call('Browser.close',{},null)}catch{}socket.close();}browser?.kill();server?.kill();}
