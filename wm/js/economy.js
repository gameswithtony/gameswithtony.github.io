import * as D from './data.js';
import { H, DONE, ask, add, log, takeAnswer } from './runner.js';
import { items, canStore, store, placements, repack } from './workshop.js';
import { takeAward } from './state.js';

export const VOUCHERS = ['supply', 'government', 'lab', 'rd', 'science'];
const zero = () => Object.fromEntries(VOUCHERS.map(k => [k, 0]));
export const costList = cost => Array.isArray(cost) ? cost : Object.entries(cost || {}).flatMap(([k, n]) => Array(n).fill(k));
function combinations(v, n, start = 0, p = zero(), out = []) {
  if (!n) { out.push({ ...p }); return out; }
  for (let i = start; i < VOUCHERS.length; i++) {
    const k = VOUCHERS[i]; if (p[k] >= v[k]) continue;
    p[k]++; combinations(v, n - 1, i, p, out); p[k]--;
  }
  return out;
}
export function payments(st, cost) {
  const req = costList(cost), out = new Map();
  function visit(v, p, i) {
    if (i === req.length) { out.set(JSON.stringify(p), { ...p }); return; }
    const k = req[i];
    const spend = used => {
      const next = { ...v }, plan = { ...p };
      for (const key of VOUCHERS) { next[key] -= used[key] || 0; plan[key] += used[key] || 0; }
      visit(next, plan, i + 1);
    };
    if (k === 'any') { VOUCHERS.filter(x => v[x] > 0).forEach(x => spend({ [x]: 1 })); return; }
    if (v[k]) spend({ [k]: 1 });
    if (k !== 'science' && v.science) spend({ science: 1 });
    if (!v[k] && !v.science) for (const used of combinations(v, 3)) spend(used);
  }
  visit(st.p.vouchers, zero(), 0);
  return [...out.values()].sort((a, b) => a.science - b.science || VOUCHERS.reduce((n, k) => n + a[k] - b[k], 0));
}
export const canPay = (st, cost) => payments(st, cost).length > 0;
export const describePayment = p => VOUCHERS.filter(k => p[k]).map(k => `${p[k]} ${D.VOUCHER_NAME[k]}`).join(' + ') || 'Free';
export function voucher(st, kind, n = 1) {
  const got = Math.min(n, D.VOUCHER_CAP[kind] - st.p.vouchers[kind]);
  st.p.vouchers[kind] += got;
  if (got) log(st, 'you', `Gained ${got} ${D.VOUCHER_NAME[kind]} voucher${got === 1 ? '' : 's'}.`);
}
export function funding(st, kind, n = 1) {
  const prev = st.p.funding[kind]; st.p.funding[kind] = Math.min(D.FUNDING[kind].length - 1, prev + n);
  log(st, 'you', `${D.VOUCHER_NAME[kind]} funding ${prev} → ${st.p.funding[kind]}.`);
}
export function cp(st, n, reason) { if (!n) return; st.p.cp += n; log(st, 'you', `${n >= 0 ? '+' : ''}${n} CP${reason ? ': ' + reason : ''}.`); }
export function target(st, n, reason) { if (!n) return; st.target += n; log(st, 'saboteurs', `Target +${n} → ${st.target}${reason ? ': ' + reason : ''}.`); }
export function returnChemical(st, color) { st.supply[color]++; }
export function chemicalPrice(st, color) { return D.CHEMICAL_PRICES[5 - st.supply[color]]; }
export function hasMaterial(st, type, color) {
  if (items(st, type, color).length) return true;
  return items(st, type).length > 0 && (type !== 'chemical' || st.supply[color] > 0) && canPay(st, ['any', 'any']);
}
export function materialExtra(st, type, color) { return items(st, type, color).length ? [] : ['any', 'any']; }
export function materialPlans(st, requirements) {
  const out = [];
  function visit(pool, supply, i, plan, extra) {
    if (i === requirements.length) { out.push({ materials: plan, extra }); return; }
    const req = requirements[i], all = pool.filter(x => x.type === req.type);
    const exact = req.color ? all.filter(x => x.color === req.color) : all;
    const candidates = [...new Map((exact.length ? exact : all.filter(x => req.type !== 'chemical' || supply[req.color] > 0)).map(item => [item.color, item])).values()];
    for (const item of candidates) {
      const exchanged = !!req.color && item.color !== req.color;
      const nextSupply = { ...supply }, color = req.color || item.color;
      if (req.type === 'chemical') {
        if (exchanged) { nextSupply[item.color]++; nextSupply[color]--; }
        if (req.destination !== 'rd') nextSupply[color]++;
      }
      visit(pool.filter(x => x.id !== item.id), nextSupply, i + 1, [...plan, { ...req, id: item.id, color, original: item.color, exchanged }], [...extra, ...exchanged ? ['any', 'any'] : []]);
    }
  }
  visit(st.p.items, st.supply, 0, [], []);
  return out;
}
export function consumePlan(st, plan) {
  for (const m of plan.materials) {
    const item = st.p.items.find(x => x.id === m.id);
    if (!item) throw new Error('Missing planned material');
    st.p.items.splice(st.p.items.indexOf(item), 1);
    if (m.type === 'chemical') {
      if (m.exchanged) { st.supply[item.color]++; st.supply[m.color]--; }
      if (m.destination === 'rd') st.rd[m.weather][m.space].chemical = m.color;
      else st.supply[m.color]++;
    }
  }
  repack(st);
}
export function constructible(st) {
  const built = st.p.assembly.filter(x => !x).length;
  const tokens = st.p.office.reduce((n, r) => n + r.tokens.filter(Boolean).length, 0) + st.p.pending.length + st.p.awards;
  return st.p.assembly.map((present, i) => ({ present, i })).filter(({ present, i }) => present && (i < 6 || i < 9 && (built >= 6 || tokens >= 5) || i >= 9 && (built >= 9 || tokens >= 8))).map(x => x.i);
}
export function benefits(st, list) { add(st, ...list.map(b => ({ t: 'benefit', benefit: b }))); }

H.pay = (st, t) => {
  const options = payments(st, t.cost).filter(p => !t.allowed || t.allowed.some(x => JSON.stringify(x) === JSON.stringify(p)));
  if (!options.length) throw new Error('Unaffordable payment ' + JSON.stringify(t.cost));
  const a = takeAnswer(t);
  if (a !== undefined || options.length === 1) {
    const p = a ?? options[0];
    for (const k of VOUCHERS) st.p.vouchers[k] -= p[k];
    log(st, 'you', 'Paid ' + describePayment(p) + '.'); return DONE;
  }
  ask(st, t, 'Choose vouchers to pay', options.map(p => ({ v: p, label: describePayment(p) })), t.reason || 'Science substitutes for any voucher. A 3-for-1 exchange is available when the required voucher and Science are both unavailable.', 'payment');
};
H.consume = (st, t) => {
  const a = takeAnswer(t);
  if (t.stage === 'finish') {
    const item = st.p.items.find(i => i.id === t.item);
    if (!item) throw new Error('Missing material');
    st.p.items.splice(st.p.items.indexOf(item), 1);
    if (t.type === 'chemical') {
      if (item.color !== t.color) { returnChemical(st, item.color); st.supply[t.color]--; }
      if (t.destination === 'rd') st.rd[t.weather][t.space].chemical = t.color;
      else returnChemical(st, t.color);
    }
    repack(st); return DONE;
  }
  const exact = items(st, t.type, t.color), list = exact.length ? exact : items(st, t.type);
  if (!list.length) throw new Error('Missing ' + t.type);
  if (a !== undefined || list.length === 1) {
    const item = list.find(i => i.id === (a ?? list[0].id)); t.item = item.id; t.stage = 'finish';
    if (item.color !== t.color) add(st, { t: 'pay', cost: ['any', 'any'], reason: `Exchange ${D.COLOR_NAME[item.color]} for ${D.COLOR_NAME[t.color]} ${t.type}.` });
    return;
  }
  ask(st, t, `Choose a ${t.type}`, list.map(i => ({ v: i.id, label: D.COLOR_NAME[i.color], text: exact.length ? 'Use this material.' : `Exchange for ${D.COLOR_NAME[t.color]} · 2 vouchers` })));
};
H.benefit = (st, t) => {
  const b = t.benefit, a = takeAnswer(t);
  if (t.started) return DONE;
  if (b.n === 0) return DONE;
  if (b.type === 'cp') { cp(st, b.n, b.reason); return DONE; }
  if (b.type === 'investment') { st.p.investments += b.n || 1; log(st, 'you', 'Gained an Investment tile.'); return DONE; }
  if (b.type === 'award') { for (let i=0;i<(b.n??1);i++) takeAward(st,'you'); return DONE; }
  if (b.type === 'voucher') {
    if (b.kind && b.kind !== 'any') { voucher(st, b.kind, b.n || 1); return DONE; }
    if (a !== undefined) { voucher(st, a); if ((b.n || 1) > 1) benefits(st, [{ ...b, n: b.n - 1 }]); return DONE; }
    const opts = VOUCHERS.filter(k => st.p.vouchers[k] < D.VOUCHER_CAP[k]).map(k => ({ v: k, label: D.VOUCHER_NAME[k], text: `${st.p.vouchers[k]} / ${D.VOUCHER_CAP[k]}` }));
    if (!opts.length) return DONE;
    ask(st, t, 'Gain a voucher', opts, 'Choose any type, including Science.'); return;
  }
  if (b.type === 'funding') {
    if (b.kind && b.kind !== 'any') { funding(st, b.kind, b.n || 1); return DONE; }
    if (a !== undefined) { funding(st, a, b.n || 1); return DONE; }
    const opts = ['government', 'lab', 'rd'].filter(k => st.p.funding[k] < D.FUNDING[k].length - 1).map(k => ({ v: k, label: D.VOUCHER_NAME[k], text: `Funding ${st.p.funding[k]} → ${st.p.funding[k] + 1}` }));
    if (!opts.length) return DONE;
    ask(st, t, 'Advance a funding track', opts); return;
  }
  if (b.type === 'part' || b.type === 'chemical') {
    const cs = b.color ? [b.color] : D.COLORS;
    const opts = cs.filter(c => (b.type !== 'chemical' || st.supply[c] > 0) && canStore(st, b.type, c));
    if (!opts.length) { log(st, 'you', `Cannot store another ${b.type}; benefit unavailable.`); return DONE; }
    if (a !== undefined || b.color) {
      const c = a ?? b.color; store(st, b.type, c); if (b.type === 'chemical') st.supply[c]--;
      log(st, 'you', `Gained ${D.COLOR_NAME[c]} ${b.type}.`);
      if ((b.n || 1) > 1) benefits(st, [{ ...b, n: b.n - 1 }]); return DONE;
    }
    ask(st, t, `Gain a ${b.type}`, opts.map(c => ({ v: c, label: D.COLOR_NAME[c], color: c, icon: b.type })), 'Available storage is checked after free rearrangement.'); return;
  }
  if (b.type === 'bot') { t.started = true; add(st, { t: 'construct', free: true }); return; }
  if (b.type === 'workshop') { t.started = true; add(st, { t: 'extend', free: true }); return; }
  if (b.type === 'action') { t.started = true; add(st, { t: 'action', kind: b.kind, free: true, noChemical: b.noChemical, noPart: b.noPart }); return; }
  throw new Error('Unknown benefit ' + JSON.stringify(b));
};
H.construct = (st, t) => {
  const a = takeAnswer(t);
  if (a === 'cancel') return DONE;
  if (t.stage === 'finish') {
    st.p.assembly[t.slot] = false; store(st, 'bot', null, `bot${++st.itemSeq}`);
    log(st, 'you', `Constructed Bot ${t.slot + 1}.`); benefits(st, D.ASSEMBLY[t.slot].reward); return DONE;
  }
  const opts = canStore(st, 'bot') ? constructible(st).filter(i => t.free || canPay(st, { supply: D.ASSEMBLY[i].cost })) : [];
  if (!opts.length) return DONE;
  if (a !== undefined) { t.slot = a; t.stage = 'finish'; if (!t.free) add(st, { t: 'pay', cost: { supply: D.ASSEMBLY[a].cost } }); return; }
  ask(st, t, 'Construct a Bot', [...opts.map(i => ({ v: i, label: `Bot ${i + 1}`, text: D.benefitText(D.ASSEMBLY[i].reward), cost: t.free ? 'Free' : `${D.ASSEMBLY[i].cost} Supply`, icon: 'bot' })),{v:'cancel',label:t.free?'Decline benefit':'Back'}]);
};
H.extend = (st, t) => {
  const a = takeAnswer(t);
  if (a === 'cancel') return DONE;
  if (!t.stage) {
    const offer = [...st.workshopOffer, st.workshopDeck[0]].filter(x => x !== undefined);
    const opts = offer.filter(id => placements(st, id).length);
    if (!opts.length || !t.free && !canPay(st, { supply: 1 })) return DONE;
    if (a !== undefined) { t.tile = a; t.stage = 'place'; if (!t.free) add(st, { t: 'pay', cost: { supply: 1 } }); return; }
    ask(st, t, 'Choose a Workshop tile', [...opts.map(id => ({ v: id, label: `${D.COLOR_NAME[D.WORKSHOPS[id].top]} / ${D.COLOR_NAME[D.WORKSHOPS[id].bottom]}`, tile: id, icon: 'workshop' })),{v:'cancel',label:t.free?'Decline benefit':'Back'}], 'Tiles hold a Bot or Machine Part. Matching edges between rows create Chemical storage.'); return;
  }
  if (a !== undefined) {
    st.p.workshop.push({ id: t.tile, ...a });
    const i = st.workshopOffer.indexOf(t.tile);
    if (i >= 0) { st.workshopOffer.splice(i, 1); if (st.workshopDeck.length) st.workshopOffer.splice(i, 0, st.workshopDeck.shift()); }
    else st.workshopDeck.shift();
    log(st, 'you', `Extended Workshop at row ${a.row + 1}, column ${a.col}.`); return DONE;
  }
  ask(st, t, 'Place your Workshop tile', placements(st, t.tile).map(v => ({ v, label: `Row ${v.row + 1} · column ${v.col}`, text: `${D.COLOR_NAME[(v.flip ? D.WORKSHOPS[t.tile].bottom : D.WORKSHOPS[t.tile].top)]} on top`, tile: t.tile, flip: v.flip })), 'Placement is permanent. Touching semicircles must match.', 'workshop');
};
