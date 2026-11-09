import * as D from './data.js';
import { choices } from './runner.js';
import { packing } from './workshop.js';
const fail = text => { throw new Error(text); };
export function assertState(st) {
  if(!st||st.version!==1||!Number.isInteger(st.rng)||!Array.isArray(st.stack)||!st.p)fail('Unrecognized Weather Machine save.');
  const p=st.p;
  for(const [k,v]of Object.entries(p.vouchers))if(!Number.isInteger(v)||v<0||v>D.VOUCHER_CAP[k])fail('Voucher track out of range: '+k);
  for(const [k,v]of Object.entries(p.funding))if(!Number.isInteger(v)||v<0||v>9)fail('Funding track out of range: '+k);
  if(!Number.isFinite(p.cp)||!Number.isFinite(st.target)||st.target<0)fail('Invalid score.');
  if(!Array.isArray(p.assembly)||p.assembly.length!==12||p.assembly.some(x=>typeof x!=='boolean'))fail('Invalid Assembly Line.');
  if(!packing(st, p.items, {fixed:Object.fromEntries(p.items.map(i=>[i.id,i.slot]))}))fail('Resources do not fit the Workshop.');
  const ids=p.items.map(i=>i.id), usedSlots=p.items.map(i=>i.slot);
  if(new Set(ids).size!==ids.length||new Set(usedSlots).size!==usedSlots.length)fail('Duplicate Workshop item or storage slot.');
  let bots=p.items.filter(i=>i.type==='bot').length+p.assembly.filter(Boolean).length;
  let saboteurs=0,lativ=0;
  for(const k of ['government','lab','rd'])for(const w of D.WEATHER){
    for(const s of st[k][w]){
      if(s.owner==='you'){bots++;ids.push(s.id)}
      if(s.owner==='saboteurs')saboteurs++;
      if(s.owner==='lativ')lativ++;
    }
    if(!Number.isInteger(st.research[k][w])||st.research[k][w]<0||st.research[k][w]>2)fail('Invalid Research supply.');
  }
  if(bots!==12||saboteurs>12||lativ>5)fail(`Bot conservation failed (${bots}, ${saboteurs}, ${lativ}).`);
  if(new Set(ids).size!==ids.length)fail('Duplicate Bot identity.');
  if(!Number.isInteger(st.awardReserve)||st.awardReserve<0||st.awardReserve+p.totalAwards+st.saboteurs.awards>12)fail('Invalid Award reserve.');
  const tiles=[...st.workshopDeck,...st.workshopOffer,...p.workshop.map(t=>t.id)];
  if(tiles.length!==30||new Set(tiles).size!==30)fail('Workshop tile conservation failed.');
  for(const w of D.WEATHER){
    const e=st.extreme[w],all=[...e.layers,...e.stack];
    if(all.length!==3||new Set(all).size!==3||e.level!==(e.layers.at(-1)||0))fail('Extreme Weather tile conservation failed.');
  }
  for(const color of D.COLORS){
    const n=st.supply[color]+st.saboteurs.chemicals[color]+p.items.filter(i=>i.type==='chemical'&&i.color===color).length+D.WEATHER.flatMap(w=>st.rd[w]).filter(s=>s.chemical===color).length;
    if(n!==5||st.supply[color]<0)fail('Chemical conservation failed: '+color+' = '+n);
  }
  const reports=[...st.reportDeck,...st.reportDiscard,...st.currentReport!==null?[st.currentReport]:[]];
  // Call Security temporarily holds two draws on its task, outside both deck and discard.
  const security=st.stack.find(t=>t.t==='security'&&t.cards);
  if(security)reports.push(...security.cards.filter(id=>id!==st.currentReport));
  if(reports.some(id=>!D.REPORTS[id])||new Set(reports).size!==reports.length)fail('Invalid Security Report deck.');
  if(reports.length!==(st.challenges.includes(6)?18:20))fail('Security Report conservation failed.');
  for(const row of p.office){const weather=row.tokens.filter(t=>t?.weather).map(t=>t.weather);if(new Set(weather).size>1)fail('Mixed weather in an Office row.');}
  if(!st.over&&(!st.prompt||!choices(st.prompt).length))fail('Game stopped without a legal decision.');
  return true;
}
export function parseSave(input) {
  const save=typeof input==='string'?JSON.parse(input):input;
  const state=save.state||save.st;
  assertState(state);
  const undo=Array.isArray(save.undo)?save.undo.slice(-40):[];
  undo.forEach(assertState);
  return{state,undo};
}
export function encodeSave(save) {
  const json=JSON.stringify(save);
  if(globalThis.LZString)return'WM1:'+globalThis.LZString.compressToEncodedURIComponent(json);
  return json;
}
export function decodeSave(raw) {
  if(typeof raw!=='string'||raw.length>10000000)fail('Invalid or oversized save.');
  if(raw.startsWith('WM1:')){
    if(!globalThis.LZString)fail('Save decoder unavailable. Reload the page and try again.');
    const json=globalThis.LZString.decompressFromEncodedURIComponent(raw.slice(4));
    if(!json)fail('The share code is incomplete or damaged.');
    return JSON.parse(json);
  }
  return JSON.parse(raw);
}
