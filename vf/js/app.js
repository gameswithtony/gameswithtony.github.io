import * as V from './views.js';
import {icon,ship,crest,glyphName} from './icons.js';
import {tips,guildNames,resourceNames} from './reference.js';
import {printedRules} from './printed-rules.js';
import {VERSION,SAVE_KEY,makeSave,encodeSave,decodeSave,validateSave} from './saves.js';

const root=document.getElementById('app'),sheet=document.getElementById('sheet');
let worker,catalog,view=null,journal=[],pendingSave=null,failedSave=null,hasSave=false,busy=false,readyAt=0,active='galaxy',noticeTimer,lastFocus,initialized=false,initialCenter=false;
let config={scenario:'First Stand',house:'Valnis',side:'A',difficulty:'easy',seed:'',preselected:false};
const ui={scale:1,cardTab:'focus',collapsed:false,explain:false,amounts:{},route:0};
const scrolls={};
let decisionCode=null,lastGoodSave=null,launchRequest=null,mapPosition=null;
const q=selector=>document.querySelector(selector);
const esc=V.esc,rich=V.rich,plain=V.plain,btn=V.btn,ib=V.ib;
try{const saved=localStorage.getItem(SAVE_KEY);if(saved){pendingSave=JSON.parse(saved);hasSave=true;}}catch(e){failedSave=e.message;hasSave=true;}
try{ui.collapsed=localStorage.getItem('vf.action-collapsed')==='true';}catch{}

function notice(message){clearTimeout(noticeTimer);document.getElementById('notice').textContent=message;noticeTimer=setTimeout(()=>document.getElementById('notice').textContent='',5500);}
function persist(){
  if(!view||!config.seed)return;
  const save=makeSave(config,journal);lastGoodSave=save;
  try{localStorage.setItem(SAVE_KEY,JSON.stringify(save));hasSave=true;}catch{notice('Browser storage is unavailable. Export your game from the menu.');}
}
function bindWorker(){
  worker?.terminate();worker=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});
  worker.onmessage=event=>{
    const message=event.data;
    if(message.type==='catalog'){
      catalog=message.catalog;
      if(launchRequest){const request=launchRequest;launchRequest=null;worker.postMessage(request);return;}
      if(!initialized){
        initialized=true;
        if(pendingSave){try{const saved=validateSave(pendingSave,catalog);startGame(saved.config,saved.journal);pendingSave=null;return;}catch(e){failedSave=e.message;}}
        render();if(failedSave)modal('Saved game could not be read',`<p>${esc(failedSave)}</p><p>Your previous save is still in this browser. Load a known good game code or export a backup before replacing it.</p><div class="sheet-actions">${btn('Load a saved game','import','primary')}${btn('Export stored backup','raw-backup','secondary')}${btn('Close','close','secondary')}</div>`,'info');
        else if(new URLSearchParams(location.search).has('load'))importDialog();
      }
      return;
    }
    if(message.type==='view'){
      if(!message.view)return;
      const previous=view?.decision?.code;view=message.view;config=message.config;journal=message.journal;
      busy=false;if(previous!==view.decision?.code)readyAt=performance.now()+220;
      if(previous!==view.decision?.code){ui.amounts={};ui.route=0;ui.explain=false;decisionCode=view.decision?.code;}
      persist();render();
      if(!initialCenter){initialCenter=true;centerHome();}
      return;
    }
    if(message.type==='rewind'){undo();return;}
    if(message.type==='error'){
      busy=false;console.error('Voidfall rules:',message.message,message.stack);
      render();modal('This choice could not be completed',`<p>${esc(message.message)}</p><p>Your saved decision log is available. Step back to the previous choice or export this position for a bug report.</p><div class="sheet-actions">${btn('Undo last choice','undo','primary')}${btn('Share game code','share','secondary')}${btn('Close','close','secondary')}</div>`,'info');
    }
  };
  worker.onerror=event=>{busy=false;console.error(event);modal('The game could not open',`<p>${esc(event.message||'The rules worker could not load.')}</p><p>Reload the page. If you opened this file directly, serve the vf folder over HTTP.</p>${btn('Reload','reload','primary')}`,'info');};
}
function startGame(nextConfig,replay=[]){
  close();busy=true;view=null;journal=[];config={...nextConfig};initialCenter=false;active='galaxy';ui.explain=false;ui.amounts={};
  if(!config.seed)config.seed=Array.from(crypto.getRandomValues(new Uint32Array(2)),n=>n.toString(36)).join('-');
  launchRequest={type:'start',config,journal:replay};
  bindWorker();root.innerHTML='<div class="loading"><span class="loading-mark"></span><p>Opening the galaxy…</p></div>';
}
function render(){
  if(!catalog)return;
  const map=q('.map-viewport');if(map)mapPosition={x:map.scrollLeft,y:map.scrollTop};
  const choiceScroll=q('.decision-scroll')?.scrollTop||0;
  root.innerHTML=view?V.game(view,active,ui):V.setup(catalog,config,hasSave&&!!lastGoodSave);
  root.toggleAttribute('aria-busy',busy);
  if(view){
    const nextMap=q('.map-viewport');if(nextMap&&mapPosition){nextMap.scrollLeft=mapPosition.x;nextMap.scrollTop=mapPosition.y;}
    const nextChoices=q('.decision-scroll');if(nextChoices&&decisionCode===view.decision?.code)nextChoices.scrollTop=choiceScroll;
    if(busy)root.querySelectorAll('[data-do="option"],[data-do="map-choice"],[data-do="pay"],[data-do="confirm"],[data-do="amount-confirm"],[data-do="combat-confirm"]').forEach(b=>b.disabled=true);
    requestAnimationFrame(()=>document.documentElement.style.setProperty('--dock-height',(q('.decision')?.offsetHeight||0)+'px'));
  }
}
function send(command){
  if(busy||!view?.decision||performance.now()<readyAt)return;
  const cmd={...command,code:view.decision.code};
  if(cmd.kind==='option')cmd.indices=view.decision.choices.filter(c=>c.selected).map(c=>c.index);
  busy=true;if(cmd.kind!=='selection'){close();ui.explain=false;}render();
  worker.postMessage({type:'command',command:cmd});
}
function choose(index){
  const c=view.decision.choices[index];if(!c)return;
  if(ui.explain||c.disabled){choiceInfo(c);return;}
  if(c.type!=='text'&&!(view.decision.singleClick&&view.decision.selectionNum===1)){
    let selected=view.decision.choices.filter(c=>c.selected).map(c=>c.index);
    selected=selected.includes(index)?selected.filter(i=>i!==index):[...selected,index];
    if(view.decision.selectionNum&&selected.length>view.decision.selectionNum)selected=selected.slice(-view.decision.selectionNum);
    send({kind:'selection',indices:selected});return;
  }
  send({kind:'option',index});
}
function changeTab(tab){
  scrolls[active]=scrollY;active=tab;render();window.scrollTo({top:scrolls[tab]||0,behavior:'instant'});
}
function centerHome(){requestAnimationFrame(()=>{const map=q('.map-viewport'),owned=[...document.querySelectorAll('.sector.you')];if(map&&owned.length){const r=map.getBoundingClientRect(),boxes=owned.map(e=>e.getBoundingClientRect()),cx=(Math.min(...boxes.map(b=>b.left))+Math.max(...boxes.map(b=>b.right)))/2,cy=(Math.min(...boxes.map(b=>b.top))+Math.max(...boxes.map(b=>b.bottom)))/2;map.scrollLeft+=cx-(r.left+r.width/2);map.scrollTop+=cy-(r.top+r.height/2);mapPosition={x:map.scrollLeft,y:map.scrollTop};}});}
function zoom(amount,fit=false){
  const map=q('.map-viewport');if(!map)return;
  const old=ui.scale,cx=(map.scrollLeft+map.clientWidth/2)/old,cy=(map.scrollTop+map.clientHeight/2)/old;
  const width=(Math.max(...view.sectors.map(s=>s.column),0)*183+250);
  ui.scale=fit?Math.max(.3,Math.min(1,(map.clientWidth-50)/width)):Math.max(.35,Math.min(1.6,Math.round((old+amount)*100)/100));
  render();const next=q('.map-viewport');if(next){next.scrollLeft=Math.max(0,cx*ui.scale-next.clientWidth/2);next.scrollTop=Math.max(0,cy*ui.scale-next.clientHeight/2);}
}
function modal(title,body,glyph='info'){
  lastFocus=document.activeElement;
  sheet.innerHTML=`<header class="sheet-head"><h2 id="sheet-title">${icon(glyph,24)}<span>${esc(title)}</span></h2>${ib('close','close','Close details')}</header><div class="sheet-body">${body}</div>`;
  if(!sheet.open)sheet.showModal();sheet.scrollTop=0;
}
function close(){if(sheet.open){sheet.close();if(lastFocus?.isConnected)lastFocus.focus({preventScroll:true});}}
function tip(key){
  if(key==='crisis-board'&&view){modal('Crisis board · Evaluation',`<p>At Evaluation, the Military track adds <strong>${view.crisisPressure.military} Voidborn Fleet Power</strong> to the Skirmish.</p><h3>Economic payment</h3>${Object.keys(view.crisisPressure.economic).length?V.costs(view.crisisPressure.economic):'<p>No extra resources required.</p>'}<p>Each missing resource costs 3 Influence. Adding Crises or Harbingers increases the pressure.</p><p class="sheet-rule">Rulebook pp. 15, 33–34.</p>`,'corruption');return;}
  if(['bounty','reclaim','glory'].includes(key)&&view){const tokens=view.player[key]||[];modal(V.human(key),`<p>${esc(tips[key][1])}</p>${tokens.length?tokens.map(t=>`<div class="owned-token">${icon(key,28)}<span>${key==='glory'?esc(t.value+' Glory'):rich(t.value?.effect?readTokenEffect(t.value.effect):V.human(t.value||t.id))}</span></div>`).join(''):'<p class="muted">None held.</p>'}<p class="sheet-rule">${esc(tips[key][2])}</p>`,key);return;}
  if(key==='voidborn'&&view){modal('Voidborn target',`<p class="tip-value">${view.voidborn.score} Influence</p><p>${esc(tips.voidborn[1])}</p><div class="target-breakdown">${Object.entries(view.voidborn.elements).filter(([,n])=>n).map(([k,n])=>`<div><span>${V.human(k)}</span><small>${n} × ${view.scoreWeights[k]||1}</small><b>${n*(view.scoreWeights[k]||1)}</b></div>`).join('')}</div><p class="sheet-rule">${esc(tips.voidborn[2])}</p>`,'voidborn');return;}
  if(key==='combat'&&view){
    const sk=view.skirmish;
    modal('Next Skirmish',`<p class="tip-value">${sk?.power??0} Fleet Power</p><p>${esc(tips.combat[1])}</p>${sk?.sectors?.length?`<h3>Possible targets</h3><div class="sheet-actions">${sk.sectors.map(id=>{const s=view.sectors.find(s=>s.id===id);return btn(esc(s?coordName(s):id),'sector','secondary',`data-id="${esc(id)}"`)}).join('')}</div>`:''}<div class="sheet-actions">${btn('Open combat calculator ↗','calculator','secondary')}</div><p class="sheet-rule">${esc(tips.combat[2])}</p>`,'defense');return;
  }
  const t=tips[key]||[V.human(key),'Inspect the current card or sector for its exact effect.',''];
  let value='';if(view?.player.resources[key]){const r=view.player.resources[key];value=`<p class="tip-value">${r.store}<small> / 15 stored</small></p><div class="detail-grid"><div>${icon(key,28)}<span><strong>${r.yield}</strong><small>Production yield</small></span></div><div>${icon('economy',28)}<span><strong>${r.level}</strong><small>Production level</small></span></div></div>`;}
  else if(key==='upkeep'&&view)value=`<p class="tip-value">${view.upkeep} upkeep</p>`;
  else if(key==='influence'&&view)value=`<p class="tip-value">${view.player.influence} Influence</p>`;
  modal(t[0],`${value}<p>${esc(t[1])}</p>${t[2]?`<p class="sheet-rule">${esc(t[2])}</p>`:''}`,key);
}
function printed(c){
  const item=printedRules[(c.name||'').toLowerCase()];if(!item)return '';
  let text=esc(item.text).replace(/ (BASIC - #[\d+]+|IMPROVED - #[\d+]+|PERMANENT ABILITY\*?|IMMEDIATE EFFECT|Condition|Penalty) /g,'</p><p><strong>$1</strong><br>');
  return `<details class="reference-toggle"><summary>Printed rules · Glossary p. ${item.page}</summary><div class="printed-reference"><p>${text}</p></div></details>`;
}
function cardDetails(c){
  const type=V.kind(c),effects=c.effects||[];
  let body=`<div class="detail-emblem">${icon(type==='focus'?c.name:type,52)}<div><strong>${esc(V.cardTitle(c))}</strong><small>${esc(V.typeLabel(c))}${V.refLabel(c)?' · '+esc(V.refLabel(c)):''}</small></div></div>`;
  if(c.rounds)body+=`<p>${c.rounds} rounds this Cycle.</p>`;
  if(c.score)body+=`<p class="tip-value">${c.score.total} Influence</p>`;
  if(c.influence)body+=`<p>${c.influence} Influence when gained.</p>`;
  if(c.boostDescription)body+=`<h3>Production bonus</h3><p>${rich(c.boostDescription)}</p>`;
  body+=effects.map(e=>`<div class="effect-line"><header><h3>${esc(e.name||V.human(e.type)||'Effect')}</h3>${V.costs(e.cost)}</header><p>${rich(e.description||e.actionDescription||'Resolve this effect during play.')}</p></div>`).join('');
  for(const [key,label] of [['effectDescription','When gained'],['actionDescription','Effect'],['focusDescription','Focus bonus'],['penaltyDescription','Penalty']])if(c[key])body+=`<h3>${label}</h3><p>${rich(c[key])}</p>`;
  if(c.reactionDescriptions?.length)body+=`<h3>Triggered effects</h3>${c.reactionDescriptions.map(t=>`<p>${rich(t)}</p>`).join('')}`;
  if(c.scoringDescriptions?.length&&!printedRules[(c.name||'').toLowerCase()])body+=`<h3>Scoring</h3><ul>${c.scoringDescriptions.map(t=>`<li>${rich(t)}</li>`).join('')}</ul>`;
  const printedText=printedRules[(c.name||'').toLowerCase()]?.text||'';
  if(type==='crisis'&&printedText)body+=`<h3>Condition & penalty</h3><p>${esc(printedText.replace(/^(ECONOMIC|MILITARY|GENERAL) CRISIS /,'').replace(/ \d+$/,''))}</p>`;
  if(type==='agenda'&&printedText)body+=`<h3>Objectives</h3><p>${esc(printedText.replace(/ [MSWD]\d+$/,''))}</p>`;
  const techSection=c.type==='improved'?printedText.split(/IMPROVED - #[\d+]+/)[1]:printedText.split(/IMPROVED - #[\d+]+/)[0];
  const permanent=techSection?.match(/PERMANENT ABILITY\*? (.*?)(?:IMMEDIATE EFFECT|$)/)?.[1];
  if(type==='tech'&&permanent)body+=`<h3>Permanent ability</h3><p>${esc(permanent)}</p>`;
  else if(c.ability)body+=`<h3>Ability</h3><p>${abilityText(c.ability)}</p>`;
  const ref=printed(c);body+=ref;
  if(!effects.length&&!ref&&!c.actionDescription&&!c.effectDescription&&!c.ability&&!c.scoringDescriptions?.length)body+=`<p>${esc(tips[glyphName(c.value||type)]?.[1]||'This piece follows its matching action in the current decision.')}</p>`;
  return body;
}
function abilityText(a){
  const lines=[a].flat().map(x=>{const key=typeof x==='string'?x:x.type;const labels={shields:'Corvettes gain Salvo Absorption. Improved Shields also grants Approach Absorption.',destroyers:'You may deploy Destroyer fleets.',sentries:'You may deploy Sentry fleets. Sentries can be deployed when an Installation is built.',dreadnoughts:'You may deploy Dreadnought fleets.',carriers:'You may deploy Carrier fleets. Their combat effect depends on the Technology level.',starbases:'You may build Starbases.',extra_guilds:'Allows extra guild capacity in the Home sector.',extra_upkeep:'Changes your upkeep.',free_tier_increase:'Increase Civilization Tiers without the normal deactivation cost.'};return esc(labels[key]||V.human(key||'Permanent ability'))});return lines.join('<br>');
}
function inspectCard(id){const c=view?.cards[id];if(!c){notice('Inspect the matching sector or current choice for this piece.');return;}modal(V.cardTitle(c),cardDetails(c),V.kind(c));}
function sectorDetails(id){
  const s=view.sectors.find(s=>s.id===id);if(!s)return;
  const title=coordName(s),choices=view.decision?.choices.filter(c=>c.id===id&&!c.disabled)||[];
  const population=`<div class="detail-grid">${V.tip('population',`${icon('population',28)}<span><strong>${s.population||0}</strong><small>Population</small></span>`)}${V.tip('corruption',`${icon(s.corrupted?'corruption':'check',28)}<span><strong>${s.corrupted?'Corrupted':'Pure'}</strong><small>${s.owner==='you'?'Your sector':s.owner==='voidborn'?'Voidborn':'Uncontrolled'}</small></span>`)}</div>`;
  const guilds=(s.guilds||[]).map(g=>V.tip(glyphName(g.value),`${icon(g.value,26)}<span>${esc(guildNames[g.value]||V.human(g.value))}</span>`,'secondary')).join('');
  const installations=(s.installations||[]).map(i=>V.tip(i.value,`${icon(i.value,26)}<span>${V.human(i.value)}</span>`,'secondary')).join('');
  const fleetBody=(s.fleets||[]).map(f=>`<div class="detail-emblem ${f.owner==='blue'?'you':'enemy'}">${ship(f.type,44)}<div><strong>${f.cubes.length} ${V.human(f.type)}</strong><small>${f.owner==='blue'?'Your Fleet Power':'Voidborn Fleet Power'}</small></div></div>`).join('');
  const rewards=[...(s.bounty||[]),...(s.reclaim||[])].map(t=>`<p>${icon(t.id?.startsWith('bounty')?'bounty':'reclaim',22)} ${rich(t.value?.effect?readTokenEffect(t.value.effect):t.value?.description||V.human(t.value||t.id))}</p>`).join('');
  modal(title,`${population}<h3>Fleets</h3>${fleetBody||'<p class="muted">No fleets in this sector.</p>'}<h3>Guilds · ${(s.guilds||[]).length}/${s.guild_spaces||0}</h3><div class="sheet-actions">${guilds||'<p class="muted">No guilds.</p>'}</div><h3>Installations · ${(s.installations||[]).length}/${s.installation_spaces||0}</h3><div class="sheet-actions">${installations||'<p class="muted">No installations.</p>'}</div>${s.harbingers?.length?`<h3>Harbingers</h3><p>${s.harbingers.length} · ${s.harbingers.length*10} Voidborn Influence</p>`:''}${s.glory?.length?`<h3>Glory</h3><p>${s.glory.map(g=>g.value).join(' · ')}</p>`:''}${rewards?`<h3>Sector rewards</h3>${rewards}`:''}${s.description?`<h3>When conquered</h3><p>${rich(s.description)}</p>`:''}${s.fallen_house?`<h3>Fallen House ${esc(s.fallen_house.name)}</h3><p>Technologies: ${s.fallen_house.techs.map(esc).join(' · ')}</p>`:''}${choices.length?`<div class="sheet-actions">${choices.map(c=>btn('Choose this sector','option','primary',`data-index="${c.index}"`)).join('')}</div>`:''}<p class="sheet-rule">Sector ${esc(s.key)} · Rulebook pp. 18–19.</p>`,'galaxy');
}
function coordName(s){return V.coord(s)+' · '+s.name;}
function readTokenEffect(e){if(Array.isArray(e))return e.map(readTokenEffect).join(' and/or ');if(typeof e==='string')return V.human(e);if(e.either_or)return e.either_or.map(readTokenEffect).join(' OR ');if(e.types)return Object.entries(e.types).map(([k,n])=>n+' '+V.human(k)).join(' + ');return (e.num||1)+' '+V.human(e.verb?.replace(/^gain_/,''))+(e.type?' '+V.human(e.type):'');}
function choiceInfo(c){
  if(c.id?.startsWith('sectors.')){sectorDetails(c.id);return;}
  let body=c.detail?cardDetails(c.detail):c.help?.length?'':`<p>${rich(c.description||c.label)}</p>`;
  body+=(c.help||[]).map(h=>`${c.help.length>1?`<h3>${esc(h.title)}</h3>`:''}<p>${esc(h.text)}</p><p class="sheet-rule">${esc(h.reference)}</p>`).join('');
  if(c.cost)body+=`<h3>Cost</h3>${V.costs(c.cost)}`;
  if(c.disabled)body=`<p class="error">${c.done?'Already resolved this turn.':'Unavailable in the current position. Check the cost, available targets, and action limit.'}</p>`+body;
  modal(plain(c.name||c.label),body,c.detail?V.kind(c.detail):'info');
}
function menu(){modal('Your solo game',`<p>${esc(view.scenario)} · ${esc(view.player.house)} ${esc(view.player.side)} · ${V.phaseLabel(view)}</p><div class="sheet-actions">${btn(icon('undo')+' Undo last choice','undo','secondary',journal.length?'':'disabled')}${btn(icon('download')+' Export save file','download','secondary')}${btn('Share game code','share','secondary')}${btn('Load game','import','secondary')}${btn('Rules & credits','help','secondary')}${btn('New solo game','new','secondary')}</div><div class="menu-version"><span>VF ${VERSION} · ${journal.length} saved choices</span>${btn('Report a bug','share','text-button')}</div><p class="sheet-rule">Saved in this browser. Export a copy to move between devices.</p>`,'menu');}
function help(){modal('Voidfall · Solo',`<p>Play your House against the Voidborn using the co-op/solo rules. Complete three Cycles and match or exceed the final Voidborn target.</p><h3>At the table</h3><ul><li>Choose a Focus, then resolve two different actions. A Trade token lets you use all three.</li><li>Tap any sector, card, resource, or track to inspect it.</li><li>The ? on the action tray explains choices without selecting them.</li><li>Pan the galaxy by dragging or scrolling. Use +, −, and the percentage to zoom or fit.</li></ul><h3>Save & undo</h3><p>Every choice is saved locally. Undo restores the previous decision, including hidden decks. Export a game file or a VF1 code from the menu.</p><h3>Credits</h3><p>Voidfall: Nigel Buckle and Dávid Turczi. Published by <a href="https://mindclashgames.com/our-games/voidfall/" target="_blank" rel="noopener">Mindclash Games</a>.</p><p>Rules implementation adapted from <a href="https://voidfall-solo-app.surge.sh/" target="_blank" rel="noopener">Mark Hutchinson’s solo app</a>. New interface and original SVG graphics. Combat reference: your existing <a href="../voidfall/" target="_blank" rel="noopener">Voidfall calculator</a>.</p><p>This is an unofficial fan project. <a href="docs/SOURCES.md" target="_blank" rel="noopener">Sources</a> · <a href="docs/DESIGN.md" target="_blank" rel="noopener">Design notes</a></p><p class="sheet-rule">VF ${VERSION} · No build step. All fonts and game files are local.</p>`,'help');}
function share(){modal('Share your game',`<p>This code restores the setup and every choice. Include it when reporting a bug.</p><textarea class="save-code" id="share-code" readonly aria-label="Game code">${esc(encodeSave(makeSave(config,journal)))}</textarea><div class="sheet-actions">${btn('Copy code','copy','primary')}${btn('Export save file','download','secondary')}</div>`,'cards');}
function importDialog(){modal('Load a solo game',`<p>Paste a VF1 code or the contents of an exported save file.</p><textarea class="save-code" id="load-code" aria-label="Saved game code" placeholder="VF1:…"></textarea><label class="field">Or select a save file<input type="file" id="load-file" accept=".json,text/plain,application/json"></label><div id="import-error" class="error" role="alert"></div><div class="sheet-actions">${btn('Load this game','load','primary')}</div><p class="sheet-rule">Your current game is replaced after the saved setup and choices have been checked.</p>`,'cards');}
function download(raw=false){
  const text=raw?localStorage.getItem(SAVE_KEY):JSON.stringify(makeSave(config,journal),null,2);
  if(!text){notice('There is no saved game to export.');return;}
  const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=`voidfall-${raw?'backup':config.house.toLowerCase()}-cycle-${view?.turn.cycle||1}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notice('Save file exported.');
}
function undo(){if(!journal.length){notice('No earlier choice to undo.');return;}const earlier=journal.slice(0,-1);startGame(config,earlier);notice('Restoring the previous choice.');}
function result(){const won=!view.catastropheLoss&&view.player.influence>=view.voidborn.score;modal(view.catastropheLoss?'Catastrophe loss':won?'Victory':'The Voidborn prevail',`<div class="result-scores"><div class="you">${crest(view.player.house,66)}<strong>${view.player.influence}</strong><span>${esc(view.player.house)}</span></div><div class="enemy">${icon('voidborn',66)}<strong>${view.voidborn.score}</strong><span>Voidborn</span></div></div><p>${view.catastropheLoss?'A catastrophe ended your game.':won?'Your civilization held back the Void.':'The Voidborn finished with more Influence.'}</p><div class="sheet-actions">${btn('Inspect the final table','close','primary')}${btn('Export game','download','secondary')}${btn('New solo game','new','secondary')}</div>`,'glory');}

document.addEventListener('click',async event=>{
  const el=event.target.closest('[data-do]');if(!el||el.disabled)return;
  const action=el.dataset.do;
  if(action==='close'){close();return;}
  if(action==='reload'){location.reload();return;}
  if(action==='tip'){tip(el.dataset.key);return;}
  if(action==='help'){help();return;}
  if(action==='card'){inspectCard(el.dataset.id);return;}
  if(action==='sector'){sectorDetails(el.dataset.id);return;}
  if(action==='choice-info'){choiceInfo(view.decision.choices[Number(el.dataset.index)]);return;}
  if(action==='option'||action==='map-choice'){choose(Number(el.dataset.index));return;}
  if(action==='anytime'){send({kind:'anytime',index:Number(el.dataset.index)});return;}
  if(action==='tab'){changeTab(el.dataset.tab);return;}
  if(action==='card-tab'){ui.cardTab=el.dataset.tab;render();return;}
  if(action==='event'){const c=view.event||view.foreground.find(c=>c.id?.startsWith('event'));if(c)inspectCard(c.id);else tip('phase');return;}
  if(action==='track-step'){const track=view.tracks[el.dataset.track],step=track.steps[Number(el.dataset.index)];modal(V.human(el.dataset.track)+' · space '+el.dataset.index,`<p>${rich(step.description)||'Starting space.'}</p><p class="sheet-rule">${track.index===step.index?'Your current position.':track.index>step.index?'Already passed.':'Not yet reached.'} Rulebook p. 28.</p>`,el.dataset.track);return;}
  if(action==='menu'){menu();return;}
  if(action==='share'){share();return;}
  if(action==='import'){importDialog();return;}
  if(action==='download'){download();return;}
  if(action==='raw-backup'){download(true);return;}
  if(action==='copy'){try{await navigator.clipboard.writeText(q('#share-code').value);notice('Game code copied.');}catch{q('#share-code').select();notice('Select and copy the game code.');}return;}
  if(action==='load'){
    try{const saved=decodeSave(q('#load-code').value,catalog);lastGoodSave=makeSave(config,journal);startGame(saved.config,saved.journal);}catch(error){q('#import-error').textContent=error.message;}return;
  }
  if(action==='new'){modal('Start a new solo game?',`<p>Your current game stays available until you enter the next galaxy. Export a copy to keep it.</p><div class="sheet-actions">${btn('Choose new setup','new-setup','primary')}${btn('Keep playing','close','secondary')}${btn('Export current game','download','secondary')}</div>`,'galaxy');return;}
  if(action==='new-setup'){close();lastGoodSave=makeSave(config,journal);view=null;config={...config,seed:''};worker?.terminate();render();window.scrollTo(0,0);return;}
  if(action==='resume'){if(lastGoodSave)startGame(lastGoodSave.config,lastGoodSave.journal);return;}
  if(action==='setup-origin'){readSetup();config.side=el.dataset.side;render();return;}
  if(action==='start'){readSetup();startGame(config);return;}
  if(action==='undo'){undo();return;}
  if(action==='collapse'){ui.collapsed=!ui.collapsed;try{localStorage.setItem('vf.action-collapsed',String(ui.collapsed));}catch{}render();q('.decision-toggle')?.focus({preventScroll:true});return;}
  if(action==='explain'){ui.explain=!ui.explain;ui.collapsed=false;render();return;}
  if(action==='zoom-in'){zoom(.15);return;}
  if(action==='zoom-out'){zoom(-.15);return;}
  if(action==='zoom-fit'){zoom(0,true);return;}
  if(action==='home'){centerHome();return;}
  if(action==='confirm'){send({kind:'confirm',indices:view.decision.choices.filter(c=>c.selected).map(c=>c.index)});return;}
  if(action==='cancel'){send({kind:'cancel'});return;}
  if(action==='pay'){send({kind:'pay'});return;}
  if(action==='convert'){send({kind:'convert',resource:el.dataset.resource,wildcard:el.dataset.wildcard,amount:Number(el.dataset.amount)});return;}
  if(action==='amount'){
    const d=view.decision,k=el.dataset.resource,old=ui.amounts[k]??(d.adjust?d.adjust.res[k]||0:d.ranges[k].initial??d.ranges[k].min??0),next=old+Number(el.dataset.amount),min=d.ranges?.[k].min||0,max=d.adjust?(d.adjust.spendable?.[k]?.store??d.adjust.num):d.ranges[k].max??100;
    if(next<min||next>max)return;ui.amounts[k]=next;render();return;
  }
  if(action==='amount-confirm'){
    const d=view.decision,keys=d.adjust?d.adjust.available:Object.keys(d.ranges),values=Object.fromEntries(keys.map(k=>[k,ui.amounts[k]??(d.adjust?d.adjust.res[k]||0:d.ranges[k].initial??d.ranges[k].min??0)]));
    if(d.adjust&&Object.values(values).reduce((a,b)=>a+b,0)!==d.adjust.num){notice('Choose exactly '+d.adjust.num+' resources.');return;}
    send({kind:d.adjust?'adjust':'ranges',values});return;
  }
  if(action==='combat'){ui.route=Number(el.dataset.index);render();return;}
  if(action==='combat-confirm'){send({kind:'combat',index:ui.route||0});return;}
  if(action==='result'){result();return;}
  if(action==='calculator'){window.open('../voidfall/','_blank','noopener');return;}
});
function readSetup(){for(const key of ['scenario','house','difficulty','seed'])if(q('#'+key))config[key]=q('#'+key).value;config.preselected=!!q('#preselected')?.checked;}
document.addEventListener('change',async event=>{
  if(['scenario','house','difficulty','preselected'].includes(event.target.id)){readSetup();render();}
  if(event.target.id==='load-file'&&event.target.files[0]){const file=event.target.files[0];if(file.size>3000000){q('#import-error').textContent='This save is too large.';return;}q('#load-code').value=await file.text();}
});
sheet.addEventListener('click',event=>{if(event.target===sheet){const r=sheet.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();}});
sheet.addEventListener('close',()=>lastFocus?.isConnected&&lastFocus.focus({preventScroll:true}));
window.addEventListener('storage',event=>{if(event.key===SAVE_KEY)notice('This game changed in another tab. Reload before continuing.');});
window.addEventListener('resize',()=>requestAnimationFrame(()=>document.documentElement.style.setProperty('--dock-height',(q('.decision')?.offsetHeight||0)+'px')));
// Native scrolling handles touch; mouse dragging pans the same map without choosing a tile.
let pan=null,suppressClick=false;
document.addEventListener('pointerdown',event=>{
  const map=event.target.closest('.map-viewport');
  if(!map||event.pointerType!=='mouse'||event.button!==0)return;
  pan={map,x:event.clientX,y:event.clientY,left:map.scrollLeft,top:map.scrollTop,id:event.pointerId,moved:false};
});
document.addEventListener('pointermove',event=>{
  if(!pan||event.pointerId!==pan.id)return;
  const dx=event.clientX-pan.x,dy=event.clientY-pan.y;
  if(!pan.moved&&Math.hypot(dx,dy)>7){pan.moved=true;pan.map.setPointerCapture(event.pointerId);pan.map.style.cursor='grabbing';}
  if(pan.moved){pan.map.scrollLeft=pan.left-dx;pan.map.scrollTop=pan.top-dy;event.preventDefault();}
});
document.addEventListener('pointerup',()=>{if(pan){suppressClick=pan.moved;pan.map.style.cursor='';pan=null;setTimeout(()=>suppressClick=false,0);}});
document.addEventListener('pointercancel',()=>{pan=null;});
document.addEventListener('click',event=>{if(suppressClick){event.preventDefault();event.stopImmediatePropagation();suppressClick=false;}},true);
bindWorker();
// Read-only diagnostics, matching the other games in this repository.
window.VF={get view(){return view},get config(){return {...config}},get log(){return journal.slice()},get ready(){return !busy&&performance.now()>=readyAt}};
