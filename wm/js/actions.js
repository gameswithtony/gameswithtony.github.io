import * as D from './data.js';
import { H, DONE, ask, add, takeAnswer, log, clone } from './runner.js';
import { items, canStore, store, packing, repack } from './workshop.js';
import { canPay, payments, describePayment, costList, materialPlans, consumePlan, chemicalPrice, constructible, benefits, funding, voucher, cp, target } from './economy.js';
import { challenge, placeYourBot, takeResearch, activateGovernment, unlock, tileData, fixWeather, checkEnd, botCount, takeAward } from './state.js';
import { publishOptions } from './office.js';

export const ACTIONS = {
  extend: { name: 'Extend Workshop', icon: 'workshop', text: 'Add permanent storage · 1 Supply' },
  construct: { name: 'Construct a Bot', icon: 'bot', text: 'Build from your Assembly Line · 1 to 3 Supply' },
  buyChemical: { name: 'Acquire a Chemical', icon: 'chemical', text: 'Take the leftmost Chemical · 1 to 3 Supply' },
  returnChemical: { name: 'Return a Chemical', icon: 'chemical', text: 'Gain Supply vouchers for its return space' },
  initiative: { name: 'Take the Initiative', icon: 'initiative', text: 'Choose who acts first next round · 1 Supply' },
  sell: { name: 'Sell a Part', icon: 'government', text: 'Bot + Machine Part → research + Subsidy · 1 Government' },
  subsidy: { name: 'Secure Subsidy', icon: 'subsidy', text: 'Use a blue board Subsidy · 2 Government' },
  work: { name: 'Work on Experiment', icon: 'lab', text: 'Bot + Chemical → prepare an experiment · 1 Lab' },
  publish: { name: 'Publish a Paper', icon: 'paper', text: 'Complete an Office row → CP + Investment · 2 Lab' },
  research: { name: 'Research', icon: 'rd', text: 'Bot + Chemical → research + benefit · 1 R&D' },
  breakthrough: { name: 'Breakthrough', icon: 'award', text: 'Published paper + prototype → Award · 2 R&D + Science' },
};
export const LOCATION_ACTIONS = { 1: ['extend', 'construct', 'buyChemical', 'returnChemical', 'initiative'], 2: ['sell', 'subsidy'], 3: ['work', 'publish'], 4: ['research', 'breakthrough'] };
export const ACTION_COST = { sell: { government: 1 }, subsidy: { government: 2 }, work: { lab: 1 }, publish: { lab: 2 }, research: { rd: 1 }, breakthrough: { rd: 2 } };
const baseCost = (kind, free) => free ? [] : costList(ACTION_COST[kind]);
const prototypeCache = new Map();
export function placementRequirements(st, kind, w, i, noChemical, noPart) {
  if (kind === 'sell') return noPart ? [] : [{ type: 'part', color: D.GOV[w][i] }];
  const color = kind === 'work' ? D.LAB[w][i] : D.RD[w][i].color;
  const req = noChemical ? [] : [{ type: 'chemical', color, ...(kind === 'research' ? { destination: 'rd', weather: w, space: i } : {}) }];
  if (kind === 'research' && D.RD[w][i].extra) req.push({ type: D.RD[w][i].extra });
  return req;
}
export function prototypeOptions(st, row, free = false, paid = false) {
  const r = st.p.office[row], w = r.weather, results = [];
  if (!r.published || !w || r.breakthrough || !st.extreme[w].level || st.extreme[w].markers.some(m => String(m).startsWith('you:'))) return [];
  const tile = tileData(st, w);
  const cacheKey = JSON.stringify([row,free,paid,r,st.p.vouchers,st.p.items,st.p.workshop,st.rd[w],st.extreme[w],st.challenges]);
  if (prototypeCache.has(cacheKey)) return prototypeCache.get(cacheKey);
  const base = paid || free ? [] : [...baseCost('breakthrough', false), ...Array(tile.cost).fill('science')];
  const eligible = st.rd[w].map((s, i) => s.owner && !(challenge(st, 10) && s.owner === 'saboteurs') ? i : -1).filter(i => i >= 0);
  for (let mask = 0; mask < 2 ** eligible.length; mask++) {
    const providers = eligible.filter((_, j) => mask & 1 << j);
    const req = [...D.RD[w].filter((_, i) => !providers.includes(i)).map(s => ({ type: 'part', color: s.color })), ...tile.parts.map(color => ({ type: 'part', color }))];
    for (const plan of materialPlans(st, req)) {
      if (!canPay(st, [...base, ...plan.extra])) continue;
      for (let workshopRow = 0; workshopRow < 3; workshopRow++) {
        const ids = plan.materials.map(m => m.id), others = items(st, 'part').filter(i => !ids.includes(i.id)).map(i => i.id);
        const arrangement = packing(st, st.p.items, { row: workshopRow, rowItems: ids, avoidRowItems: others }) || packing(st, st.p.items, { row: workshopRow, rowItems: ids });
        if (!arrangement) continue;
        const discarded = others.filter(id => arrangement[id] === 'part' ? workshopRow === 1 : Number(arrangement[id]?.split(':')[1]) === workshopRow);
        results.push({ row, workshopRow, providers, plan, arrangement, discarded, cp: 2 * (botCount(st, 'you', 'rd', w) + req.length), target: 2 * providers.filter(i => st.rd[w][i].owner === 'saboteurs').length });
      }
    }
  }
  const unique = new Map();
  for (const x of results) {
    const key = JSON.stringify([x.workshopRow, x.providers, x.plan.materials.map(m => [m.color, m.original]).sort(), x.discarded.length]);
    if (!unique.has(key)) unique.set(key, x);
  }
  const result = [...unique.values()];
  if (prototypeCache.size >= 128) prototypeCache.delete(prototypeCache.keys().next().value);
  prototypeCache.set(cacheKey,result); return result;
}
export function actionOptions(st, kind, free = false, noChemical = false, noPart = false) {
  if (kind === 'buyChemical') return D.COLORS.filter(c => st.supply[c] && canStore(st, 'chemical', c) && (free || canPay(st, { supply: chemicalPrice(st, c) }))).map(color => ({ color }));
  if (kind === 'returnChemical') return items(st, 'chemical').map(i => ({ id: i.id }));
  if (kind === 'initiative') return free || canPay(st, { supply: 1 }) ? [{ first: st.initiative[0] !== 'you' }] : [];
  if (kind === 'publish') return canPay(st, baseCost(kind, free)) ? publishOptions(st) : [];
  if (kind === 'breakthrough') return st.p.office.flatMap((_, row) => breakthroughOffers(st, row, free).length ? [{ row }] : []);
  if (kind === 'subsidy') return canPay(st, baseCost(kind, free)) ? D.WEATHER.flatMap(weather => st.governmentSubsidies[weather].flatMap((tile, index) => !tile.part && !tile.used ? [{ weather, index }] : [])) : [];
  if (['sell', 'work', 'research'].includes(kind)) {
    if (!items(st, 'bot').length) return [];
    const result = [], key = kind === 'sell' ? 'government' : kind === 'work' ? 'lab' : 'rd';
    for (const weather of D.WEATHER) st[key][weather].forEach((s, space) => {
      if (s.owner && !(kind === 'work' && s.owner === 'lativ')) return;
      if (kind === 'research' && noChemical && !st.supply[D.RD[weather][space].color]) return;
      const plans = materialPlans(st, placementRequirements(st, kind, weather, space, noChemical, noPart)).filter(p => canPay(st, [...baseCost(kind, free), ...p.extra]));
      if (plans.length) result.push({ weather, space });
    });
    return result;
  }
  return [];
}
export function actionAvailable(st, kind, free = false) {
  if (kind === 'construct') return canStore(st, 'bot') && constructible(st).some(i => free || canPay(st, { supply: D.ASSEMBLY[i].cost }));
  if (kind === 'extend') return (st.workshopOffer.length || st.workshopDeck.length) && (free || canPay(st, { supply: 1 }));
  return actionOptions(st, kind, free).length > 0;
}
export function actionReason(st, kind) {
  if (ACTION_COST[kind] && !canPay(st,ACTION_COST[kind])) return 'Need '+Object.entries(ACTION_COST[kind]).map(([k,n])=>`${n} ${D.VOUCHER_NAME[k]}`).join(' + ')+' (or Science / exchanges)';
  if (['sell','work','research'].includes(kind) && !items(st,'bot').length) return 'Construct an available Bot first';
  if (kind==='sell'&&!items(st,'part').length) return 'Need a Machine Part';
  if (['work','research'].includes(kind)&&!items(st,'chemical').length) return 'Need a Chemical';
  if (kind==='publish') return 'Need a complete research row, or two tokens and a legal Citation';
  if (kind==='breakthrough') return st.p.office.some(r=>r.published&&!r.breakthrough)?'Need payable Science and enough Parts in one Workshop row':'Publish an eligible paper first';
  if (kind==='construct') return !canStore(st,'bot')?'Extend Workshop for Bot storage':'Need Supply vouchers for an unlocked Assembly Bot';
  if (kind==='extend') return !st.workshopOffer.length&&!st.workshopDeck.length?'No Workshop tiles remain':'Need 1 Supply (or Science / exchange)';
  if (kind==='returnChemical') return 'No Chemical in your Workshop';
  if (kind==='buyChemical') return 'Need Chemical storage and Supply vouchers';
  if (kind==='initiative') return 'Need 1 Supply (or Science / exchange)';
  if (kind==='subsidy') return 'No blue Subsidy remains';
  return 'No matching available space, or required exchange is unaffordable';
}
/** What a turn-menu tile shows in its corner, from the current board. */
export function actionPrice(st, kind) {
  const range = list => { if (!list.length) return null; const lo = Math.min(...list), hi = Math.max(...list); return lo === hi ? String(lo) : `${lo}-${hi}`; };
  if (ACTION_COST[kind]) { const [k, n] = Object.entries(ACTION_COST[kind])[0]; return { kind: k, n: String(n) }; }
  if (kind === 'extend' || kind === 'initiative') return { kind: 'supply', n: '1' };
  if (kind === 'construct') return { kind: 'supply', n: range(constructible(st).map(i => D.ASSEMBLY[i].cost)) || '1-3' };
  if (kind === 'buyChemical') return { kind: 'supply', n: range(D.COLORS.filter(c => st.supply[c]).map(c => chemicalPrice(st, c))) || '1-3' };
  if (kind === 'returnChemical') return { kind: 'supply', n: range(items(st, 'chemical').map(i => D.CHEMICAL_PRICES[4 - st.supply[i.color]])) || '1-3', gain: true };
  return null;
}
const SHORT_REASON = [[/^Need (\d \S+(?: \+ \d \S+)*) \(/, '$1'], [/^Action allowance used/, 'Already used'], [/^Construct an available Bot/, 'Need a Bot'], [/^Need a Machine Part/, 'Need a Part'], [/^Need a Chemical/, 'Need a Chemical'], [/^Need a complete research row/, 'No row ready'], [/^Need payable Science/, 'Need Science, Parts'], [/^Publish an eligible paper/, 'Publish first'], [/^Extend Workshop for Bot/, 'No Bot space'], [/^Need Supply vouchers/, 'Need Supply'], [/^No Workshop tiles/, 'No tiles left'], [/^No Chemical in/, 'No Chemical'], [/^Need Chemical storage/, 'No room or Supply'], [/^No blue Subsidy/, 'None left'], [/^No matching available/, 'No space fits']];
/** The few words that fit on a tile. The full reason stays in the explanation. */
export function shortReason(text) {
  for (const [from, to] of SHORT_REASON) if (from.test(text)) return to.startsWith('$') ? `Need ${text.match(from)[1]}` : to;
  return text;
}
// Marker-space benefits happen before building. Enumerate only benefit/payment
// combinations that leave a legal prototype, including using the Part just gained.
export function breakthroughOffers(st, row, free = false) {
  const r = st.p.office[row];
  if (!r.published || r.breakthrough || !r.weather || !st.extreme[r.weather].level || st.extreme[r.weather].markers.some(m => String(m).startsWith('you:'))) return [];
  const d = tileData(st, r.weather), cost = free ? [] : [...baseCost('breakthrough', false), ...Array(d.cost).fill('science')], out = [];
  d.spaces.forEach((list, space) => {
    if (st.extreme[r.weather].markers[space]) return;
    const b = list[0];
    const variants = b.type === 'part' ? D.COLORS.map(color => ({ ...b, color })) : b.type === 'voucher' && (!b.kind || b.kind === 'any') ? ['supply','government','lab','rd','science'].map(kind => ({ ...b, kind })) : [b];
    for (const payment of payments(st, cost)) for (const benefit of variants) {
      const preview = { ...st, p: { ...st.p, vouchers: { ...st.p.vouchers }, items: st.p.items.map(i => ({...i})) } };
      for (const k of Object.keys(payment)) preview.p.vouchers[k] -= payment[k];
      if (benefit.type === 'part' && canStore(preview, 'part', benefit.color)) store(preview, 'part', benefit.color);
      if (benefit.type === 'voucher') preview.p.vouchers[benefit.kind] = Math.min(D.VOUCHER_CAP[benefit.kind], preview.p.vouchers[benefit.kind] + (benefit.n || 1));
      if (prototypeOptions(preview, row, true, true).length) out.push({ space, payment, benefit, cost });
    }
  });
  return out;
}
H.breakthrough = (st, t) => {
  const a = takeAnswer(t);
  if (a === 'cancel') return DONE;
  if (!t.stage) {
    const opts = st.p.office.flatMap((r,row) => breakthroughOffers(st,row,t.free).length ? [{ v: row, label: `Row ${row+1} · ${D.WEATHER_NAME[r.weather]}`, text: `Level ${st.extreme[r.weather].level}`, weather: r.weather }] : []);
    if (!opts.length) return DONE;
    if (a !== undefined) { t.row=a; t.stage='space'; return; }
    ask(st,t,'Choose a published paper',[...opts,{v:'cancel',label:'Back'}],'Build a prototype for its current Extreme Weather tile.'); return;
  }
  if (t.stage==='space') {
    const offers=breakthroughOffers(st,t.row,t.free), spaces=[...new Set(offers.map(o=>o.space))], w=st.p.office[t.row].weather;
    if(a!==undefined){t.space=a;t.stage='benefit';return;}
    ask(st,t,'Choose a Breakthrough benefit',[...spaces.map(space=>({v:space,label:D.benefitText(tileData(st,w).spaces[space]),text:'Gain this before building your prototype'})),{v:'cancel',label:'Back'}]);return;
  }
  if(t.stage==='benefit'){
    const offers=breakthroughOffers(st,t.row,t.free).filter(o=>o.space===t.space), variants=[...new Map(offers.map(o=>[JSON.stringify(o.benefit),o.benefit])).values()];
    if(a!==undefined||variants.length===1){t.benefit=variants[a??0];t.stage='pay';return;}
    ask(st,t,'Choose your marker-space reward',[...variants.map((b,i)=>({v:i,label:b.color?D.COLOR_NAME[b.color]+' Machine Part':D.benefitText([b]),text:'Leaves a legal prototype available',color:b.color})),{v:'cancel',label:'Back'}]);return;
  }
  if(t.stage==='pay'){
    const offers=breakthroughOffers(st,t.row,t.free).filter(o=>o.space===t.space&&JSON.stringify(o.benefit)===JSON.stringify(t.benefit));
    if(!offers.length)throw new Error('Breakthrough no longer affordable');
    t.stage='reward';if(offers[0].cost.length)add(st,{t:'pay',cost:offers[0].cost,allowed:offers.map(o=>o.payment),reason:'Breakthrough'});return;
  }
  if(t.stage==='reward'){t.stage='prototype';benefits(st,[t.benefit]);return;}
  if(t.stage==='prototype'){
    const plans=prototypeOptions(st,t.row,true,true);
    if(!plans.length)throw new Error('No legal prototype after marker-space benefit');
    if(a!==undefined){t.plan=plans[a];t.stage='exchange';return;}
    ask(st,t,'Build your prototype',plans.map((p,i)=>({v:i,label:`${p.plan.materials.length} Parts · +${p.cp} CP${p.target?' · target +'+p.target:''}`,text:`Use ${p.plan.materials.map(m=>`${m.original}${m.exchanged?' → '+m.color:''}`).join(', ')||'no own Parts'}. ${p.providers.length?'Bots supply spaces '+p.providers.map(i=>i+1).join(', ')+'. ':''}Workshop row ${p.workshopRow+1}${p.discarded.length?' · discard '+p.discarded.length+' extra Parts':''}${p.plan.extra.length?' · '+p.plan.extra.length+' exchange vouchers':''}`,icon:'part'})),'All Parts you supply must fit in the same Workshop row.');return;
  }
  if(t.stage==='exchange'){t.stage='finish';if(t.plan.plan.extra.length)add(st,{t:'pay',cost:t.plan.plan.extra,reason:'Prototype material exchanges'});return;}
  const plan=t.plan,row=st.p.office[t.row],w=row.weather;
  for(const [id,slot]of Object.entries(plan.arrangement)){const item=st.p.items.find(x=>x.id===id);if(item)item.slot=slot;}
  consumePlan(st,plan.plan);
  st.p.items=st.p.items.filter(i=>!plan.discarded.includes(i.id));
  row.breakthrough=true;cp(st,plan.cp,'Built prototype');if(plan.target)target(st,plan.target,'Saboteur Bots supplied Parts');
  takeAward(st,'you');fixWeather(st,w,`you:${t.row}`,t.space);checkEnd(st);repack(st);
  if(!t.free&&st.turn&&!st.turn.used.includes('breakthrough'))st.turn.used.push('breakthrough');
  return DONE;
};
function choiceText(st, kind, v) {
  if (kind === 'buyChemical') return { label: D.COLOR_NAME[v.color], color: v.color, text: `${st.supply[v.color]} in Supply`, cost: `${chemicalPrice(st, v.color)} Supply` };
  if (kind === 'returnChemical') {
    const item = st.p.items.find(i => i.id === v.id), price = D.CHEMICAL_PRICES[4 - st.supply[item.color]];
    return { label: D.COLOR_NAME[item.color], color: item.color, text: `Gain ${price} Supply` };
  }
  if (kind === 'initiative') return { label: v.first ? 'Act first next round' : 'Act second next round', text: 'Current round order stays the same' };
  if (kind === 'publish') return { label: `Row ${v.row + 1} · ${D.WEATHER_NAME[st.p.office[v.row].weather]}`, text: v.cite === null ? 'Three tokens ready' : `Cite by returning unused Goal: ${D.GOALS[v.cite].name}` };
  if (kind === 'breakthrough') return { label: `Row ${v.row + 1} · ${D.WEATHER_NAME[st.p.office[v.row].weather]}`, text: `Level ${st.extreme[st.p.office[v.row].weather].level} · build a prototype`, weather: st.p.office[v.row].weather };
  if (kind === 'subsidy') { const d = D.SUBSIDIES[st.governmentSubsidies[v.weather][v.index].id]; return { label: d.name, text: `${D.WEATHER_NAME[v.weather]} · row ${v.index + 1} · ${D.benefitText(d.benefits)}`, weather: v.weather }; }
  const color = kind === 'sell' ? D.GOV[v.weather][v.space] : kind === 'work' ? D.LAB[v.weather][v.space] : D.RD[v.weather][v.space].color;
  return { label: `${D.WEATHER_NAME[v.weather]} · space ${v.space + 1}`, weather: v.weather, color, text: `${D.COLOR_NAME[color]} ${kind === 'sell' ? 'Part' : 'Chemical'}${kind === 'research' ? ' · ' + D.benefitText(D.RD[v.weather][v.space].reward) + (D.RD[v.weather][v.space].extra ? ' · extra ' + D.RD[v.weather][v.space].extra : '') : ''}` };
}

H.finishResearch = (st, t) => {
  if (st.rd[t.weather].every(x => x.owner) || !st.research.rd[t.weather]) { st.p.investments++; unlock(st, t.weather, 'you'); }
  else takeResearch(st, 'you', 'rd', t.weather);
  checkEnd(st); return DONE;
};
H.action = (st, t) => {
  const a = takeAnswer(t), kind = t.kind;
  if (a === 'cancel') return DONE;
  if (kind === 'breakthrough') { add(st, { t: 'breakthrough', free: t.free }); return DONE; }
  if (kind === 'extend' || kind === 'construct') { add(st, { t: kind, free: t.free }); return DONE; }
  if (!t.stage) {
    const options = actionOptions(st, kind, t.free, t.noChemical, t.noPart);
    if (!options.length) { log(st, 'you', `${ACTIONS[kind].name} is unavailable.`); return DONE; }
    if (a !== undefined) { t.choice = a; t.stage = ['sell', 'work', 'research'].includes(kind) ? 'materials' : 'pay'; return; }
    ask(st, t, ACTIONS[kind].name, [...options.map(v => ({ v, ...choiceText(st, kind, v) })), { v: 'cancel', label: 'Back', icon: 'back' }], ACTIONS[kind].text); return;
  }
  if (t.stage === 'materials') {
    const v = t.choice;
    const plans = materialPlans(st, placementRequirements(st, kind, v.weather, v.space, t.noChemical, t.noPart)).filter(p => canPay(st, [...baseCost(kind, t.free), ...p.extra]));
    if (a !== undefined || plans.length === 1) { t.plan = plans[a ?? 0]; t.stage = kind === 'sell' ? 'subsidyPick' : 'pay'; return; }
    ask(st, t, 'Choose materials', [...plans.map((p, i) => ({ v: i, label: p.materials.map(m => `${D.COLOR_NAME[m.original]} ${m.type}`).join(' + '), text: p.extra.length ? `${p.extra.length} vouchers to exchange for the required colors` : 'Use matching materials' })), { v: 'cancel', label: 'Back' }]); return;
  }
  if (t.stage === 'subsidyPick') {
    const tiles = st.governmentSubsidies[t.choice.weather].map((x, index) => ({ ...x, index })).filter(x => !x.part);
    const novel = tiles.filter(x => !st.p.subsidies.some(s => D.SUBSIDIES[s.id].name === D.SUBSIDIES[x.id].name)), list = novel.length ? novel : tiles;
    if (a !== undefined) { t.subsidy = a; t.discardSubsidy = !novel.length; t.stage = 'pay'; return; }
    ask(st, t, 'Choose your Subsidy', [...list.map(x => ({ v: x.index, label: D.SUBSIDIES[x.id].name, text: novel.length ? D.benefitText(D.SUBSIDIES[x.id].benefits) : 'Duplicate: remove this tile from the game' })),{v:'cancel',label:'Back'}], 'Receive it blue-side up, even if it was already flipped on the board.'); return;
  }
  if (t.stage === 'pay') {
    let cost = baseCost(kind, t.free);
    if (kind === 'buyChemical' && !t.free) cost = Array(chemicalPrice(st, t.choice.color)).fill('supply');
    if (kind === 'initiative' && !t.free) cost = ['supply'];
    cost.push(...t.plan?.extra || []);
    t.stage = 'resolve'; if (cost.length) add(st, { t: 'pay', cost, reason: ACTIONS[kind].name }); return;
  }
  const v = t.choice;
  if (kind === 'buyChemical') { store(st, 'chemical', v.color); st.supply[v.color]--; }
  if (kind === 'returnChemical') {
    const item = st.p.items.find(i => i.id === v.id); st.p.items.splice(st.p.items.indexOf(item), 1);
    voucher(st, 'supply', D.CHEMICAL_PRICES[4 - st.supply[item.color]]); st.supply[item.color]++;
  }
  if (kind === 'initiative') st.initiative = v.first ? ['you', 'saboteurs'] : ['saboteurs', 'you'];
  if (kind === 'publish') add(st, { t: 'publish', ...v });
  if (kind === 'sell' || kind === 'work' || kind === 'research') {
    const key = kind === 'sell' ? 'government' : kind === 'work' ? 'lab' : 'rd';
    funding(st, key); placeYourBot(st, key, v.weather, v.space); consumePlan(st, t.plan);
    if (kind === 'sell') {
      const tile = st.governmentSubsidies[v.weather][t.subsidy];
      if (!t.discardSubsidy) st.p.subsidies.push({ id: tile.id, used: false });
      tile.part = D.GOV[v.weather][v.space];
      takeResearch(st, 'you', 'government', v.weather);
      if (st.government[v.weather].every(x => x.owner)) activateGovernment(st, v.weather);
    }
    if (kind === 'research') {
      if (t.noChemical) { const c = D.RD[v.weather][v.space].color; st.supply[c]--; st.rd[v.weather][v.space].chemical = c; }
      add(st, ...D.RD[v.weather][v.space].reward.map(benefit => ({ t: 'benefit', benefit })), { t: 'finishResearch', weather: v.weather });
    }
  }
  if (kind === 'subsidy') {
    const tile = st.governmentSubsidies[v.weather][v.index]; tile.used = true;
    benefits(st, [...D.SECURE_COLUMNS[v.weather], ...D.SECURE_ROWS[v.index], ...D.SUBSIDIES[tile.id].benefits]);
  }
  if (!t.free && st.turn && !st.turn.used.includes(kind)) st.turn.used.push(kind);
  log(st, 'you', ACTIONS[kind].name + (v.weather ? ` · ${D.WEATHER_NAME[v.weather]}` : '') + '.');
  repack(st); return DONE;
};
