// Rules run in a worker; the interface never waits for combat search or game replay.
import {get,deepClone} from './rules/runtime.js';
import {state,ui} from './rules/stores.js';
import {start} from './rules/setup.js';
import {advance} from './rules/ui.js';
import {lo,at,bl} from './rules/utils.js';
import {getReadableDescription,renderCost,getAnytimeEffects,doAnytimeEffect} from './rules/game.js';
import {getSectorList,controlledBy,guildSpaces} from './rules/sectors.js';
import {scenarios} from './rules/scenarios.js';
import {houses,house} from './rules/houses.js';
import {originCards} from './rules/origins.js';
import {getTier} from './rules/tracks.js';
import {score_agenda} from './rules/agendas.js';
import {voidbornScore,scoreWeights,boardCosts,getCrisisMilitaryBoost} from './rules/crisis.js';
import {totalUpkeep,payableUpkeep,setProductionLevels} from './rules/resources.js';
import {adjust,canAdjust,listConvertibleResources,conversions,getCostElements,hasFractions} from './rules/costs.js';
import {actions} from './rules/actions.js';
import {destinationInfo,alertInfo} from './entities.js';
import {fleetType} from './rules/fleets.js';
import {actionHelp} from './action-help.js';
import {combatView} from './combat-view.js';

const safe = (fn,fallback='') => {try{return fn()}catch{return fallback}};
const call = v => typeof v==='function'?safe(()=>v()):v;
const human = s => String(s??'').replaceAll('_',' ').replace(/^./,c=>c.toUpperCase());
const desc = a => safe(()=>getReadableDescription(a,false));
export const catalog = {
  scenarios:scenarios.filter(s=>s.players===1&&s.type==='coop'&&!s.name.includes('challenge')).map(s=>({name:s.name,complexity:s.complexity,sectors:s.sectors,voidstorms:s.voidstorms})),
  houses:houses.map(h=>({name:h.name,complexity:h.complexity,preferred:h.preferred,techs:h.techs,origins:originCards.filter(o=>o.house===h.name)}))
};
export function cardInfo(ref){
  if(!ref) return null;
  const card=ref.lo?lo(ref):ref, p=get(state).players[0];
  const pieceName=typeof card.value==='string'?human(card.value):card.id?.startsWith('bounty')?'Bounty':card.id?.startsWith('reclaim')?'Reclaim':card.id?.startsWith('glory')?'Glory '+card.value:card.id?.startsWith('fleet_')?'Fleet Power':human(card.id);
  const result={...card,name:card.name||card.house||pieceName,effects:[],...destinationInfo(card),...alertInfo(card)};
  if(card.id?.startsWith('alert_cards.')&&card.type==='war'){
    const labels={voidborn_power:'Voidborn Fleet Power',voidborn_initiative:'Voidborn Initiative',voidborn_salvoAbsorption:'Voidborn Salvo Absorption',voidborn_approachAbsorption:'Voidborn Approach Absorption'};
    result.effects=[1,2,3].map(cycle=>({name:`Cycle ${cycle}${cycle===get(state).turn.cycle?' · current':''}`,description:Object.entries(card[`cycle_${cycle}_mods`]||{}).map(([key,value])=>key==='defender_reward'?`After a successful defense: ${desc(value)}`:`${value>0?'+':''}${value} ${labels[key]||human(key)}`).join('. ')||'No additional Skirmish modifier.'}));
  }
  if(card.id?.startsWith('fleet_')){
    const type=safe(()=>fleetType(card),null),address=safe(()=>bl(card.id)?.address||'');
    result.name=type?human(type)+' Fleet Power':address.includes('.inactive')?'Inactive Fleet Power':address.includes('.active')?'Ready Fleet Power':'Fleet Power';result.glyph=type||'corvette';result.entityType='fleet-power';
  }
  if(card.id?.startsWith('sectors.')) return {...card,name:sectorName(card),description:desc(card.on_invade)};
  if(card.scoring) result.score=safe(()=>score_agenda(p,card),{total:0,elements:[]});
  if(Array.isArray(card.effects)) result.effects=card.effects.map(e=>({name:e.name,cost:e.cost,description:desc(e.action)}));
  for(const key of ['effect','action','on_invade']) if(card[key]) result[key+'Description']=desc(card[key]);
  if(card.value?.effect)result.effectDescription=desc(card.value.effect);
  if(card.penalty) result.penaltyDescription=desc(card.penalty);
  if(card.boosts) result.boostDescription=Object.entries(card.boosts).map(([k,v])=>`+${v} ${human(k)} production level`).join(' · ');
  if(card.focusBoost) result.focusDescription=`${card.focusBoost.card||'Preferred Focus'}: ${desc(card.focusBoost.action)}`;
  if(card.reactions) result.reactionDescriptions=[card.reactions].flat().map(r=>`${human(r.beforePhase||r.duringFocus||r.after?.verb||r.before?.verb||r.when||'Triggered effect')}: ${desc(r.action)}`);
  if(card.scoring) result.scoringDescriptions=card.scoring.map(r=>`${r.influence||1} Influence per ${human([r.per].flat().join(' / '))}${r.filter?' · '+(typeof r.filter==='string'?human(r.filter):[r.filter.min?'at least '+r.filter.min:r.filter.num||'',human(r.filter.type||'')].join(' ')):''}`);
  return JSON.parse(JSON.stringify(result));
}
export function sectorName(s){
  return s.type==='home'?'Home sector':s.fallen_house?`Fallen ${s.fallen_house.name}`:s.special==='outpost'?'Outpost':s.name||human(s.type==='basic'?'sector '+String.fromCharCode(65+s.column)+(s.row+1):s.type);
}
function sectorInfo(s){
  return {...s,name:sectorName(s),guildCapacity:safe(()=>guildSpaces(get(state).players[0],s),s.guild_spaces),owner:controlledBy(s,'blue')?'you':controlledBy(s,'voidborn')?'voidborn':'neutral',description:desc(s.on_invade)};
}
export function optionInfo(c,index){
  const disabled=!!(call(c.disabled)||(c.condition&&!safe(()=>c.condition(get(ui),get(state)),false)));
  let detail=c.id?cardInfo(at(c.id)||c):null;
  const location=c.id?safe(()=>bl(c.id)?.address?.match(/sectors\.([^.]+)/)?.[1],null):null;
  if(detail&&location&&!c.id.startsWith('sectors.'))detail.location=sectorName(get(state).sectors[location])+' · '+location;
  let label=call(c.choice)||detail?.name||human(c.id);
  const object=c.value&&typeof c.value==='object'?c.value:null;
  return {index,id:c.id,type:c.type||'piece',label,disabled,done:c.done,ok:!!c.ok,warn:!!c.warn,extra:!!c.extra,toggle:!!c.toggle,selected:c.toggle?c.obj?.[c.key]===c.value:get(ui).selection.some(s=>s.id===c.id),
    name:c.effectName||object?.name||detail?.name,location:detail?.location,
    cost:object?.cost||c.cost,
    help:actionHelp(object?.action||c.value),
    description:object?.action?desc(object.action):detail?.choiceDescription??(detail?.effectDescription||detail?.actionDescription||''),detail};
}
export function snapshot(){
  const s=get(state),u=get(ui),w=u.waiting[0],p=s.players[0];
  if(!s.ready)return null;
  setProductionLevels(p);
  const cards={};
  const add = c=>{if(c?.id)cards[c.id]=cardInfo(c)};
  for(const c of [...p.focus.available,...p.focus.discard,...p.techs,...p.improved_tech,...p.agenda_hand,...p.agendas.map(a=>a.card),...s.galactic_board.improved_techs.flat(),...s.basic_techs.flat(),...s.galactic_board.special_focus.river.flat(),...Object.values(s.agenda_board).map(a=>a.offer),s.galactic_board.current_event,s.crisis_board.current_crisis,s.crisis_board.current_alert,...s.crisis_board.military,...s.crisis_board.economic,...s.crisis_board.catastrophes,...s.crisis_board.consumed_techs,s.focus.card].filter(Boolean)) add(c);
  const foreground=Object.values(s.foreground||{}).flat().filter(Boolean);
  for(const c of foreground)add(c);
  if(w?.choices)for(const c of w.choices.filter(c=>c.id))add(at(c.id)||c);
  const sectors=getSectorList(s.sectors).map(sectorInfo);
  const tracks=Object.fromEntries(Object.entries(p.tracks).map(([key,t])=>[key,{...t,tier:getTier(p,key),steps:house(p).tracks[key].map((a,i)=>({index:i,description:desc(a)}))}]));
  let decision=null;
  if(w){
    decision={code:w.code,message:call(w.message),choices:(w.choices||[]).map(optionInfo),optional:!!w.optional,cancellable:!!w.cancellable,cancel:w.cancel,singleClick:!!w.singleClick,selectionNum:Number.isFinite(u.selectionNum)?u.selectionNum:null,selected:u.selection.map(c=>c.id),canConfirm:!!((u.selection.length||w.optional)&&(!w.condition||safe(()=>w.condition(u,s),false))),okText:w.okText,liveInfo:w.liveInfo?safe(()=>w.liveInfo(s,u)):null,cost:w.cost,adjust:w.adjust,ranges:w.ranges,combat:w.combat};
    if(w.cost){
      decision.payment=getCostElements(w.cost).filter(k=>w.cost[k].raw).map(k=>({resource:k,amount:w.cost[k].raw}));
      decision.canPay=!hasFractions(w.cost);
      decision.conversions=safe(()=>listConvertibleResources(w.cost).flatMap(r=>conversions(w.cost,r).map(c=>({resource:r,wildcard:c.wildcard,rate:c.conversionRate,canAdd:canAdjust(w.cost,r,c.wildcard,1),canRemove:canAdjust(w.cost,r,c.wildcard,-1)}))),[]);
    }
  }
  const crisisPressure={military:getCrisisMilitaryBoost(),economic:boardCosts.economic[s.crisis_board.economic.length]||{}};
  const anytime=anytimeEffects().map((a,index)=>({index,label:a.button,description:a.text,disabled:!!a.disabled?.(s)}));
  const log=s.log.filter(l=>l.type!=='stats').map(l=>({...l,text:l.text||(l.verb?safe(()=>actions.find(a=>a.verb===l.verb)?.log?.(l.params)):'')}));
  return JSON.parse(JSON.stringify({scenario:s.scenario,mode:s.mode,difficulty:s.difficulty,turn:s.turn,phase:s.turnInfo.breadcrumbs,ended:s.ended,catastropheLoss:s.catastropheLoss,player:p,sectors,voidstorms:s.voidstorms,tracks,cards,basicTechs:s.basic_techs.flat(),foreground,event:s.galactic_board.current_event,board:s.galactic_board,agendas:s.agenda_board,crisis:s.crisis_board,havens:s.havens,skirmish:u.nextSkirmishTarget[0],voidborn:safe(()=>voidbornScore(s),{score:0,elements:{}}),scoreWeights,upkeep:totalUpkeep(p),payableUpkeep:payableUpkeep(p),decision:s.ended?null:decision,anytime,crisisPressure,log}));
}

export async function command(cmd){
  const u=get(ui),w=u.waiting[0];
  if(get(state).ended)throw Error('This solo game has ended');
  if(!w)throw Error('No decision is waiting');
  if(cmd.code!==w.code)throw Error('That choice belongs to an earlier decision');
  if(cmd.kind==='anytime'){
    const a=anytimeEffects()[cmd.index];
    if(!a||a.disabled?.(get(state)))throw Error('That effect is unavailable');
    doAnytimeEffect(a).catch(error=>globalThis.vfError?.(error));return;
  }
  if(cmd.kind==='selection'){
    const selection=(cmd.indices||[]).map(i=>w.choices[i]);
    if(selection.some(c=>!c||c.type==='text'||optionInfo(c,0).disabled))throw Error('Invalid selection');
    if(new Set(selection.map(c=>c.id)).size!==selection.length)throw Error('A piece can only be selected once');
    if(selection.length>u.selectionNum)throw Error('Too many pieces selected');
    ui.update(u=>({...u,selection:selection.map(c=>at(c.id)||c)}));
    return;
  }
  if(cmd.kind==='convert'){
    if(!w.cost||!canAdjust(w.cost,cmd.resource,cmd.wildcard,cmd.amount))throw Error('That trade cannot be made');
    w.cost=adjust(w.cost,cmd.resource,cmd.wildcard,cmd.amount);ui.update(u=>u);return;
  }
  if(cmd.kind==='cancel'){
    if(!w.cancellable)throw Error('This decision must be resolved');
    await advance('cancelled');return;
  }
  if(cmd.kind==='pay'){
    if(!w.cost||hasFractions(w.cost))throw Error('Finish adjusting this payment');
    await advance(w.cost);return;
  }
  if(cmd.kind==='adjust'){
    const d=deepClone(w.adjust),values=cmd.values||{};
    if(!d)throw Error('No resources to distribute');
    if(Object.keys(values).some(k=>!d.available.includes(k)||!Number.isInteger(values[k])||values[k]<0||d.spendable&&values[k]>d.spendable[k].store)||Object.values(values).reduce((a,b)=>a+b,0)!==d.num)throw Error('Choose the exact number of resources');
    d.res=values;await advance(d);return;
  }
  if(cmd.kind==='ranges'){
    if(!w.ranges)throw Error('No amount to choose');
    if(Object.keys(cmd.values||{}).length!==Object.keys(w.ranges).length||Object.keys(cmd.values||{}).some(k=>!Object.hasOwn(w.ranges,k)))throw Error('Choose only the requested amounts');
    for(const [key,r] of Object.entries(w.ranges)){const v=cmd.values[key];if(!Number.isInteger(v)||v<(r.min||0)||v>(r.max??Infinity))throw Error('Amount outside allowed range');}
    await advance(cmd.values);return;
  }
  if(cmd.kind==='combat'){
    const routes=Array.isArray(w.combat)?w.combat:[w.combat];
    if(!routes[cmd.index])throw Error('Choose a combat outcome');
    await advance(routes[cmd.index]);return;
  }
  if(cmd.kind==='confirm'){
    await command({kind:'selection',code:w.code,indices:cmd.indices||[]});
    if((!get(ui).selection.length&&!w.optional)||(w.condition&&!w.condition(get(ui),get(state))))throw Error('Finish selecting pieces');
    await advance(get(ui).selection);return;
  }
  if(cmd.kind==='option'){
    if(w.cost||w.adjust||w.ranges||w.combat)throw Error('Use the confirmation for this payment or selection');
    const c=w.choices[cmd.index];
    if(!c||optionInfo(c,cmd.index).disabled)throw Error('This option is unavailable');
    if(cmd.indices)await command({kind:'selection',code:w.code,indices:cmd.indices});
    if(c.toggle){c.obj[c.key]=c.value;ui.update(u=>u);return;}
    if(c.type!=='text'){
      // Single-piece choices are explicit tiles; multi-piece choices use Confirm.
      if(!w.singleClick||u.selectionNum!==1)throw Error('Select pieces and confirm');
      await advance(at(c.id)||c);return;
    }
    const value=Object.hasOwn(c,'value')?c.value:call(c.choice);
    if(typeof w.singleClick==='function')await w.singleClick(value);
    else await advance(c.warn?{warning:c.warn,selection:u.selection}:value);
    return;
  }
  throw Error('Unknown command');
}
export {start,state,ui};
function anytimeEffects(){
  const s=get(state),phase=s.turnInfo.breadcrumbs||'';
  if(!phase.includes('player turn')||phase.includes('cleanup')||s.ended)return [];
  return getAnytimeEffects(s.players[0],s);
}
