import * as D from './data.js';
import { H, DONE, add, ask, takeAnswer, log } from './runner.js';
import { benefits, canPay, funding, cp } from './economy.js';
import { challenge, unlock, botCount } from './state.js';

export const OFFICE_KINDS = ['government', 'lab', 'rd'];
export function officeSpaces(st, token) {
  const options = [];
  st.p.office.forEach((row, r) => row.tokens.forEach((value, c) => {
    if (value || row.published) return;
    if (token.kind !== 'award' && (OFFICE_KINDS[c] !== token.kind || row.weather && row.weather !== token.weather)) return;
    options.push({ row: r, col: c });
  }));
  return options;
}
export function recordToken(st, token, row, col) {
  const r = st.p.office[row]; r.tokens[col] = token;
  if (token.kind !== 'award' && token.kind !== 'citation') r.weather = token.weather;
  log(st, 'you', `Placed ${token.kind === 'award' ? 'Award' : token.weather + ' ' + token.kind + ' research'} in Office row ${row + 1}.`);
  benefits(st, D.OFFICE[row].spaces[col]);
}
export function publishOptions(st) {
  const result = [];
  st.p.office.forEach((r, i) => {
    if (r.published || !r.tokens.some(t => t?.weather)) return;
    const n = r.tokens.filter(Boolean).length;
    if (n === 3) result.push({ row: i, cite: null });
    else if (n === 2 && !st.locked[r.weather] && !challenge(st, 9)) {
      const col = r.tokens.findIndex(x => !x);
      for (const id of st.p.goals.filter(id => D.GOALS[id].kind === OFFICE_KINDS[col])) result.push({ row: i, cite: id });
    }
  });
  return result;
}
export function goalProgress(st, goalOrId) {
  const g = typeof goalOrId === 'number' ? D.GOALS[goalOrId] : goalOrId;
  const p = st.p, condition = g.condition;
  const allTokens = p.office.flatMap(r => r.tokens).filter(Boolean);
  const boardBots = (k, w) => w ? botCount(st, 'you', k, w) : D.WEATHER.reduce((n, w) => n + botCount(st, 'you', k, w), 0);
  let value = 0;
  switch (condition) {
    case 'governmentBots': value = boardBots('government'); break;
    case 'labBots': value = boardBots('lab'); break;
    case 'rdBots': value = boardBots('rd'); break;
    case 'bots': value = ['government', 'lab', 'rd'].reduce((n, k) => n + boardBots(k), 0); break;
    case 'constructed': value = p.assembly.filter(x => !x).length; break;
    case 'workshops': value = p.workshop.length; break;
    case 'papers': value = p.office.filter(r => r.published).length; break;
    case 'rows': value = p.office.filter(r => r.tokens.every(Boolean)).length; break;
    case 'awards': case 'awards3': value = p.totalAwards; break;
    case 'research': value = allTokens.filter(t => OFFICE_KINDS.includes(t.kind)).length; break;
    case 'officeTokens': value = allTokens.length; break;
    case 'parts': value = p.items.filter(i => i.type === 'part').length; break;
    case 'bottomRightBots': value = p.assembly.slice(9).filter(present => !present).length; break;
    case 'sameRows': value = Math.max(0, ...D.WEATHER.map(w => p.office.filter(r => r.weather === w && r.tokens.every(Boolean)).length)); break;
    case 'governmentResearch': value = allTokens.filter(t => t.kind === 'government').length; break;
    case 'labResearch': value = allTokens.filter(t => t.kind === 'lab').length; break;
    case 'rdResearch': value = allTokens.filter(t => t.kind === 'rd').length; break;
    case 'subsidies': value = p.subsidies.length; break;
    case 'funding': value = Math.max(...Object.values(p.funding)); break;
    case 'allFunding': value = Math.min(...Object.values(p.funding)); break;
    case 'weatherResearch': value = new Set(allTokens.map(t => t.weather).filter(Boolean)).size; break;
    case 'breakthroughs': value = p.office.filter(r => r.breakthrough).length; break;
    default:
      if (condition?.startsWith('funding:')) value = p.funding[condition.split(':')[1]];
      else if (condition?.startsWith('sameBots:')) value = Math.max(...D.WEATHER.map(w => boardBots(condition.split(':')[1], w)));
      else if (condition?.startsWith('columnTokens:')) value = p.office.filter(r => r.tokens[OFFICE_KINDS.indexOf(condition.split(':')[1])]).length;
      else if (condition?.startsWith('distinctResearch:')) value = new Set(p.office.map(r => r.tokens[OFFICE_KINDS.indexOf(condition.split(':')[1])]).filter(Boolean).map(t => t.weather || t.kind)).size;
      else if (condition?.startsWith('bots:')) value = D.WEATHER.filter(w => boardBots(condition.split(':')[1], w) > 0).length;
      else if (condition?.startsWith('weather:')) value = allTokens.filter(t => t.weather === condition.split(':')[1]).length;
      else if (condition?.startsWith('published:')) value = p.office.filter(r => r.published && r.weather === condition.split(':')[1]).length;
      else throw new Error('Unknown goal condition: ' + condition);
  }
  return { value, need: g.need, met: value >= g.need };
}
export const metGoals = st => st.p.activeGoals.filter(g => goalProgress(st, g.id).met).length;
export function immediateVictory(st) {
  return st.p.cp > st.target && metGoals(st) >= (challenge(st, 5) ? 5 : 4) && Object.values(st.p.funding).filter(n => n >= 5).length >= 2 && (!challenge(st, 4) || st.p.nobel);
}
export function finalVictory(st) {
  return !challenge(st, 12) && st.p.cp > st.target && (!challenge(st, 4) || st.p.nobel) && (!challenge(st, 5) || metGoals(st) >= 5);
}

H.placeResearch = (st, t) => {
  const a = takeAnswer(t);
  if (!st.p.pending.length) return DONE;
  if (a !== undefined) { const token = st.p.pending.splice(a.index, 1)[0]; recordToken(st, token, a.row, a.col); return; }
  const opts = st.p.pending.flatMap((token, index) => officeSpaces(st, token).map(v => ({ v: { ...v, index }, label: `${D.WEATHER_NAME[token.weather]} ${D.VOUCHER_NAME[token.kind]} · row ${v.row + 1}`, text: D.benefitText(D.OFFICE[v.row].spaces[v.col]) || 'No immediate benefit', weather: token.weather, icon: token.kind })));
  if (!opts.length) { for (const token of st.p.pending) log(st, 'you', `No legal Office space: discarded ${token.weather} ${token.kind} research.`); st.p.pending = []; return DONE; }
  ask(st, t, 'Record your research', opts, 'Choose the token and row. A row holds one weather type; research must match its color column.', 'office');
};
H.award = (st, t) => {
  const a = takeAnswer(t);
  if (a === 'cancel' || !st.p.awards) return DONE;
  const opts = officeSpaces(st, { kind: 'award' });
  if (!opts.length) return DONE;
  if (a !== undefined) { st.p.awards--; recordToken(st, { kind: 'award' }, a.row, a.col); return DONE; }
  ask(st, t, 'Place an Award', [...opts.map(v => ({ v, label: `Row ${v.row + 1} · ${D.VOUCHER_NAME[OFFICE_KINDS[v.col]]}`, text: D.benefitText(D.OFFICE[v.row].spaces[v.col]) || 'Wild research · worth 4 CP when published' })), { v: 'cancel', label: 'Keep Award for later' }], 'An Award can fill any empty Office space and counts as wild research.');
};
H.publish = (st, t) => {
  const row = st.p.office[t.row];
  if (!t.stage) {
    t.stage = 'finish';
    if (t.cite !== null && t.cite !== undefined) {
      const col = row.tokens.findIndex(x => !x);
      st.p.goals.splice(st.p.goals.indexOf(t.cite), 1);
      recordToken(st, { kind: 'citation' }, t.row, col);
    }
    return;
  }
  if (t.stage === 'finish') {
    row.published = true; t.stage = 'score'; benefits(st, D.OFFICE[t.row].publish); return;
  }
  st.p.investments++;
  cp(st, row.tokens.reduce((n, tok) => n + (tok.kind === 'award' ? 4 : tok.kind === 'citation' ? 0 : 2), 0), `Published ${row.weather} paper`);
  unlock(st, row.weather, 'you'); return DONE;
};
H.useTile = (st, t) => {
  const a = takeAnswer(t);
  if (t.stage === 'finish' || a === 'skip') return DONE;
  if (!t.stage) {
    const opts = (t.investmentOnly ? [] : st.p.subsidies.filter(s => !s.used)).map(s => ({ v: { type: 'subsidy', id: s.id }, label: D.SUBSIDIES[s.id].name, text: D.benefitText(D.SUBSIDIES[s.id].benefits), icon: 'subsidy' }));
    if (st.p.investments) {
      if (st.p.goals.some(id => st.p.activeGoals.filter(g => D.GOALS[g.id].kind === D.GOALS[id].kind).length < 2)) opts.push({ v: { type: 'goal' }, label: 'Set a Goal', text: 'Spend 1 Investment · place a Goal and gain its space benefit', icon: 'goal' });
      if (st.p.activeGoals.some(g => !g.flipped)) opts.push({ v: { type: 'funding' }, label: 'Receive funding', text: 'Spend 1 Investment · flip a Goal for its funding track', icon: 'funding' });
    }
    if (!opts.length) return DONE;
    if (a !== undefined) {
      if (a.type === 'subsidy') { st.p.subsidies.find(s => s.id === a.id).used = true; t.stage = 'finish'; benefits(st, D.SUBSIDIES[a.id].benefits); }
      else t.stage = a.type;
      return;
    }
    ask(st, t, 'Start-of-turn tile', [...opts, { v: 'skip', label: 'Continue to movement' }], 'You may use one blue Subsidy or one Investment before moving.'); return;
  }
  if (t.stage === 'goal') {
    const opts = [];
    for (const id of st.p.goals) {
      const g = D.GOALS[id], placed = st.p.activeGoals.filter(x => D.GOALS[x.id].kind === g.kind);
      for (let slot = 0; slot < 2; slot++) if (!placed.some(x => x.slot === slot)) opts.push({ v: { id, slot }, label: g.name, text: `${slot === 0 ? 'Upper' : 'Lower'} ${D.VOUCHER_NAME[g.kind]} space · ${D.benefitText(D.GOAL_SPACES[g.kind][slot])}`, goal: id });
    }
    if (a !== undefined) {
      st.p.investments--; st.p.goals.splice(st.p.goals.indexOf(a.id), 1); st.p.activeGoals.push({ id: a.id, slot: a.slot, flipped: false });
      t.stage = 'finish'; add(st, { t: 'goalBenefit', kind: D.GOALS[a.id].kind, slot: a.slot }); return;
    }
    ask(st, t, 'Set a Goal', [...opts, { v: 'skip', label: 'Back to movement' }], 'An active Goal scores 5 CP at final scoring when its condition is met.'); return;
  }
  if (t.stage === 'funding') {
    const opts = st.p.activeGoals.filter(g => !g.flipped).map(g => ({ v: g.id, label: D.GOALS[g.id].name, text: `${D.VOUCHER_NAME[D.GOALS[g.id].kind]} funding · position ${st.p.funding[D.GOALS[g.id].kind]}` }));
    if (a !== undefined) { st.p.investments--; st.p.activeGoals.find(g => g.id === a).flipped = true; t.stage = 'finish'; add(st, { t: 'receiveFunding', kind: D.GOALS[a].kind }); return; }
    ask(st, t, 'Choose funding', [...opts, { v: 'skip', label: 'Continue without funding' }], 'The flipped Goal still counts for scoring and your immediate victory.');
  }
};
H.goalBenefit = (st, t) => {
  const a = takeAnswer(t), list = D.GOAL_SPACES[t.kind][t.slot];
  if (t.slot === 1) { benefits(st, list); return DONE; }
  if (a !== undefined) { benefits(st, [list[a]]); return DONE; }
  ask(st, t, 'Choose the Goal-space benefit', list.map((b, i) => ({ v: i, label: D.benefitText([b]) })));
};
H.receiveFunding = (st, t) => {
  const a = takeAnswer(t);
  if (t.done) return DONE;
  const pos = Math.min(9, st.p.funding[t.kind] + (t.modifier || 0)), d = D.FUNDING[t.kind][pos];
  if (t.kind === 'government') { t.done = true; benefits(st, d.benefits); return; }
  if (t.kind === 'lab') {
    if (!t.scienceDone) { t.scienceDone = true; benefits(st, [{ type: 'voucher', kind: 'science', n: d.science }]); return; }
    if (a !== undefined) { t.done = true; add(st, { t: 'receiveFunding', kind: a, modifier: challenge(st, 11) ? 0 : d.modifier }); return; }
    ask(st, t, 'Choose additional Lab funding', ['government', 'rd'].map(k => ({ v: k, label: `${D.VOUCHER_NAME[k]} funding`, text: `Treat position ${st.p.funding[k]} as ${Math.min(9, st.p.funding[k] + (challenge(st, 11) ? 0 : d.modifier))}` })), 'Your Funding marker does not move.'); return;
  }
  if (a !== undefined) { t.done = true; benefits(st, d.alternatives[a]); return; }
  if (!d.alternatives?.length) return DONE;
  ask(st, t, 'Choose R&D funding', d.alternatives.map((b, i) => ({ v: i, label: D.benefitText(b) })));
};
